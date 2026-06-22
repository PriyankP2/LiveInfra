import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import Anthropic from '@anthropic-ai/sdk'
import { runQuery } from '../neo4j/client.js'
import { calcBlastScore, scoreToSeverity, type GraphData } from '@liveinfra/shared'
import type { GraphNode, GraphEdge } from '@liveinfra/shared'
import { scanAccount } from '../scanner/index.js'
import { env } from '../lib/env.js'
import { accountsRouter, resolveCustomerId } from './accounts-router.js'
import { supabase } from '../lib/supabase.js'
import { router, publicProcedure } from './init.js'
import { fetchCloudTrailEvents } from '../scanner/cloudtrail.js'
import { assumeRole } from '../scanner/assume-role.js'

export { router, publicProcedure }

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY ?? '' })

const COMMON_SCAN_REGIONS = [
  'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2', 'ca-central-1',
  'eu-west-1', 'eu-west-2', 'eu-central-1', 'eu-north-1',
  'ap-northeast-1', 'ap-northeast-2', 'ap-southeast-1', 'ap-southeast-2', 'ap-south-1',
  'sa-east-1',
]

export const appRouter = router({
  // ── Health ──────────────────────────────────────────────────────────────
  health: publicProcedure.query(() => ({ ok: true, ts: new Date().toISOString() })),

  // ── Accounts (multi-account management) ─────────────────────────────────
  accounts: accountsRouter,

  // ── Customer resolver ────────────────────────────────────────────────────
  // Resolves a Clerk user ID to the customer's Supabase UUID.
  // Creates the record on first call (upsert behaviour).
  customer: router({
    resolve: publicProcedure
      .input(z.object({ clerkUserId: z.string(), email: z.string().optional() }))
      .mutation(async ({ input }) => {
        const id = await resolveCustomerId(input.clerkUserId, input.email)
        const { data } = await supabase
          .from('customers')
          .select('id, tier, rca_calls_this_month, rca_calls_limit')
          .eq('id', id)
          .single()
        return {
          id,
          tier:              String(data?.['tier'] ?? 'starter'),
          rcaCallsThisMonth: Number(data?.['rca_calls_this_month'] ?? 0),
          rcaCallsLimit:     Number(data?.['rca_calls_limit'] ?? 50),
        }
      }),
  }),

  // ── Graph ────────────────────────────────────────────────────────────────
  graph: router({
    // Full topology for a customer account
    topology: publicProcedure
      .input(z.object({ customerId: z.string(), accountId: z.string().optional() }))
      .query(async ({ input }): Promise<GraphData> => {
        const { customerId, accountId } = input

        const nodeRows = await runQuery<{ n: Record<string, unknown> }>(
          `MATCH (n:Resource {customer_id: $customerId})
           ${accountId ? 'WHERE n.account_id = $accountId' : ''}
           RETURN n`,
          { customerId, ...(accountId ? { accountId } : {}) }
        )

        const edgeRows = await runQuery<{
          source: string
          target: string
          type: string
          props: Record<string, unknown>
        }>(
          `MATCH (a:Resource {customer_id: $customerId})-[r]->(b:Resource {customer_id: $customerId})
           ${accountId ? 'WHERE a.account_id = $accountId' : ''}
           RETURN a.id AS source, b.id AS target, type(r) AS type, properties(r) AS props`,
          { customerId, ...(accountId ? { accountId } : {}) }
        )

        const parseSafe = (val: unknown, fallback: Record<string, unknown>) => {
          try { return typeof val === 'string' ? JSON.parse(val) : fallback } catch { return fallback }
        }

        const nodes: GraphNode[] = nodeRows.map((row) => {
          // Neo4j returns Node objects — properties live at n.properties, not n
          const neo4jNode = row['n'] as { properties?: Record<string, unknown> } | Record<string, unknown>
          const n: Record<string, unknown> =
            (neo4jNode as { properties?: Record<string, unknown> }).properties ?? (neo4jNode as Record<string, unknown>)
          return {
            id: String(n['id'] ?? ''),
            type: String(n['type'] ?? 'EC2') as GraphNode['type'],
            name: String(n['name'] ?? ''),
            accountId: String(n['account_id'] ?? ''),
            region: String(n['region'] ?? ''),
            customerId: String(n['customer_id'] ?? ''),
            lastSeen: String(n['last_seen'] ?? ''),
            tags: parseSafe(n['tags'], {}),
            properties: parseSafe(n['properties'], {}),
          }
        })

        const edges: GraphEdge[] = edgeRows.map((row) => ({
          id: `${row['source']}__${row['target']}__${row['type']}`,
          source: row['source'],
          target: row['target'],
          type: row['type'] as GraphEdge['type'],
          properties: {
            createdAt: String((row['props'] as Record<string, unknown>)['created_at'] ?? ''),
            edgeType: String((row['props'] as Record<string, unknown>)['edge_type'] ?? ''),
            trafficVolume: Number((row['props'] as Record<string, unknown>)['traffic_volume'] ?? 0),
          },
        }))

        const lastScanAt = nodes[0]?.lastSeen ?? new Date().toISOString()

        return {
          nodes,
          edges,
          meta: {
            customerId,
            accountId: accountId ?? '',
            lastScanAt,
            nodeCount: nodes.length,
            edgeCount: edges.length,
          },
        }
      }),

    // Blast radius for a single node
    blastRadius: publicProcedure
      .input(z.object({ customerId: z.string(), resourceId: z.string(), maxHops: z.number().min(1).max(10).default(10) }))
      .query(async ({ input }) => {
        const { customerId, resourceId, maxHops } = input

        const rows = await runQuery<{
          downstream: Record<string, unknown>
          hops: number
          trafficVolume: number
        }>(
          `MATCH (source:Resource {id: $resourceId, customer_id: $customerId})
           MATCH path = (source)<-[:DEPENDS_ON*1..${maxHops}]-(downstream:Resource {customer_id: $customerId})
           WITH downstream, length(path) AS hops,
                reduce(vol = 0.0, r IN relationships(path) | vol + coalesce(r.traffic_volume, 0)) AS trafficVolume
           RETURN downstream, hops, trafficVolume
           ORDER BY hops ASC`,
          { customerId, resourceId }
        )

        const start = Date.now()
        const affected = rows.map((row) => {
          const n = row['downstream'] as Record<string, unknown>
          const score = calcBlastScore(
            row['hops'],
            String(n['type'] ?? 'EC2') as GraphNode['type'],
            row['trafficVolume'] > 0 ? row['trafficVolume'] : undefined
          )
          return {
            nodeId: String(n['id'] ?? ''),
            hops: row['hops'],
            score,
            severity: scoreToSeverity(score),
          }
        })

        return {
          sourceNodeId: resourceId,
          affected,
          queryMs: Date.now() - start,
        }
      }),
  }),

  // ── Scanner ───────────────────────────────────────────────────────────────
  scanner: router({
    // Fire-and-forget trigger: returns immediately; scan runs in background.
    trigger: publicProcedure
      .input(
        z.object({
          customerId: z.string(),
          accountId: z.string(),
          roleArn: z.string(),
          externalId: z.string(),
          regions: z.array(z.string()).min(1).default(['us-east-1']),
        })
      )
      .mutation(async ({ input }) => {
        void scanAccount(input).catch((err: unknown) => {
          console.error('[scanner] scanAccount failed:', err)
        })
        return { queued: true, startedAt: new Date().toISOString() }
      }),

    // Trigger a scan using stored credentials (from Supabase aws_accounts table,
    // with fallback to SCAN_ROLE_ARN env var for legacy single-account setups).
    triggerDefault: publicProcedure
      .input(
        z.object({
          customerId: z.string(),
          accountId: z.string(),
          regions: z.array(z.string()).optional(),
        })
      )
      .mutation(async ({ input }) => {
        // Try DB-stored credentials first
        let roleArn = env.SCAN_ROLE_ARN
        let externalId = env.SCAN_EXTERNAL_ID

        const { data: accountRow } = await supabase
          .from('aws_accounts')
          .select('role_arn, external_id, regions')
          .eq('customer_id', input.customerId)
          .eq('account_id', input.accountId)
          .single()

        if (accountRow) {
          roleArn   = String(accountRow['role_arn'])
          externalId = String(accountRow['external_id'] ?? 'liveinfra')
        }

        if (!roleArn) {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: 'No IAM role configured for this account. Add it via Settings → Accounts.',
          })
        }
        // Region priority: explicit input → DB-stored regions → default list
        const dbRegions = accountRow?.['regions'] as string[] | undefined
        const regions = input.regions ?? (dbRegions?.length ? dbRegions : COMMON_SCAN_REGIONS)
        void scanAccount({
          customerId: input.customerId,
          accountId: input.accountId,
          roleArn,
          externalId,
          regions,
        }).catch((err: unknown) => {
          console.error('[scanner] triggerDefault failed:', err)
        })
        return { queued: true, startedAt: new Date().toISOString(), regionCount: regions.length }
      }),

    // Returns the latest scan metadata stored in Neo4j for a given account.
    status: publicProcedure
      .input(z.object({ customerId: z.string(), accountId: z.string() }))
      .query(async ({ input }) => {
        const rows = await runQuery<{ lastSeen: string; nodeCount: number }>(
          `MATCH (n:Resource {customer_id: $customerId, account_id: $accountId})
           RETURN max(n.last_seen) AS lastSeen, count(n) AS nodeCount`,
          { customerId: input.customerId, accountId: input.accountId }
        )
        const row = rows[0]
        return {
          customerId: input.customerId,
          accountId: input.accountId,
          lastScanAt: row?.lastSeen ?? null,
          nodeCount: row?.nodeCount ?? 0,
        }
      }),
  }),
  // ── Incidents ─────────────────────────────────────────────────────────────
  incidents: router({
    list: publicProcedure
      .input(z.object({
        customerId: z.string(),
        limit:      z.number().min(1).max(100).default(20),
        since:      z.string().optional(), // ISO — only return incidents after this timestamp
      }))
      .query(async ({ input }) => {
        let query = supabase
          .from('incidents')
          .select('id, source, title, severity, status, resource_arn, resource_id, triggered_at, created_at')
          .eq('customer_id', input.customerId)
          .order('triggered_at', { ascending: false })
          .limit(input.limit)

        if (input.since) {
          query = query.gt('triggered_at', input.since)
        }

        const { data } = await query
        return (data ?? []).map(row => ({
          id:          String(row['id'] ?? ''),
          source:      String(row['source'] ?? ''),
          title:       String(row['title'] ?? ''),
          severity:    String(row['severity'] ?? 'low'),
          status:      String(row['status'] ?? 'open'),
          resourceArn: row['resource_arn'] ? String(row['resource_arn']) : null,
          resourceId:  row['resource_id']  ? String(row['resource_id'])  : null,
          triggeredAt: String(row['triggered_at'] ?? ''),
          createdAt:   String(row['created_at'] ?? ''),
        }))
      }),

    // Latest RCA for an incident
    getRca: publicProcedure
      .input(z.object({ incidentId: z.string() }))
      .query(async ({ input }) => {
        const { data } = await supabase
          .from('rca_history')
          .select('id, root_cause, status, input_tokens, output_tokens, latency_ms, completed_at')
          .eq('incident_id', input.incidentId)
          .order('started_at', { ascending: false })
          .limit(1)
          .single()
        if (!data) return null
        return {
          id:           String(data['id'] ?? ''),
          analysis:     data['root_cause'] ? String(data['root_cause']) : null,
          status:       String(data['status'] ?? 'pending'),
          inputTokens:  Number(data['input_tokens']  ?? 0),
          outputTokens: Number(data['output_tokens'] ?? 0),
          latencyMs:    Number(data['latency_ms']    ?? 0),
          completedAt:  data['completed_at'] ? String(data['completed_at']) : null,
        }
      }),
  }),

  // ── AI RCA ───────────────────────────────────────────────────────────────
  rca: router({
    analyze: publicProcedure
      .input(z.object({
        customerId:   z.string(),
        resourceId:   z.string(),
        resourceType: z.string(),
        resourceName: z.string(),
        region:       z.string(),
        accountId:    z.string(),
        // Connections passed from the client graph state
        connections: z.array(z.object({
          direction:    z.enum(['in', 'out']),
          edgeType:     z.string(),
          neighborType: z.string(),
          neighborName: z.string(),
        })).default([]),
        blastAffectedCount: z.number().default(0),
        // Optional: user-supplied incident description to focus the analysis
        incidentContext: z.string().optional(),
        // Optional: IAM role ARN for CloudTrail evidence enrichment
        roleArn:    z.string().optional(),
        externalId: z.string().default('liveinfra'),
      }))
      .mutation(async ({ input }) => {
        if (!env.ANTHROPIC_API_KEY) {
          return {
            analysis: '**AI RCA is not configured.** Add `ANTHROPIC_API_KEY` to your API environment to enable this feature.',
            model: 'none',
            promptTokens: 0,
            completionTokens: 0,
          }
        }

        const connectionSummary = input.connections.length === 0
          ? 'No direct connections in graph.'
          : input.connections
              .slice(0, 30)
              .map(c => `  - ${c.direction === 'out' ? '→' : '←'} ${c.edgeType} ${c.neighborType}:${c.neighborName}`)
              .join('\n')

        // CloudTrail enrichment — gracefully skip if no roleArn or if fetch fails
        let cloudTrailSection = ''
        if (input.roleArn) {
          try {
            const creds = await assumeRole(input.roleArn, input.externalId, 'LiveInfraRCA')
            const summary = await fetchCloudTrailEvents({
              resourceId:   input.resourceId,
              resourceType: input.resourceType,
              region:       input.region,
              credentials:  creds,
            })
            if (summary.events.length > 0) {
              const changes = summary.recentChanges.slice(0, 8)
                .map(e => `  - ${e.eventTime.slice(11, 19)} ${e.eventName} by ${e.username}`)
                .join('\n')
              const errors = summary.errorEvents.slice(0, 5)
                .map(e => `  - ${e.eventTime.slice(11, 19)} ${e.eventName} → ${e.errorCode}${e.errorMessage ? ': ' + e.errorMessage.slice(0, 80) : ''}`)
                .join('\n')
              cloudTrailSection = `\n\n**CloudTrail Evidence (last ${summary.lookbackHours}h — ${summary.events.length} events)**\n`
              if (changes) cloudTrailSection += `\nRecent changes:\n${changes}`
              if (errors)  cloudTrailSection += `\n\nErrors:\n${errors}`
            }
          } catch { /* CloudTrail enrichment is best-effort */ }
        }

        const systemPrompt = `You are LiveInfra's AI Root Cause Analysis engine, embedded directly in an AWS infrastructure dependency graph tool used by SRE teams.

Your role: given a specific AWS resource and its graph context, produce a concise, actionable RCA that helps engineers understand failure modes, blast radius, and remediation steps.

Tone: expert, direct, no fluff. Format: use markdown headers and bullet lists. Be specific — mention realistic AWS failure patterns, not generic advice.`

        const userPrompt = `Analyze this AWS resource for potential failure modes and root cause patterns:

**Resource**: ${input.resourceType} \`${input.resourceName}\`
**Region**: ${input.region}
**Account**: ${input.accountId}
**Blast radius**: ${input.blastAffectedCount} downstream resources affected

**Graph connections** (${input.connections.length} total):
${connectionSummary}
${input.incidentContext ? `\n**Incident context provided by engineer**:\n${input.incidentContext}` : ''}${cloudTrailSection}

Respond with:
1. **Most likely failure modes** for this specific resource type in this dependency context (3-5 bullets)
2. **Blast radius analysis** — what breaks downstream and in what order
3. **Immediate remediation steps** (numbered, specific AWS console/CLI actions)
4. **Prevention** — 2-3 specific changes to reduce future risk

Keep the entire response under 400 words. Be concrete and specific to ${input.resourceType}.`

        try {
          const response = await anthropic.messages.create({
            model:      env.ANTHROPIC_MODEL,
            max_tokens: 1024,
            system:     systemPrompt,
            messages:   [{ role: 'user', content: userPrompt }],
          })

          const text = response.content
            .filter(b => b.type === 'text')
            .map(b => (b as { type: 'text'; text: string }).text)
            .join('')

          // Track usage in Supabase for billing/rate limiting
          void supabase
            .from('customers')
            .update({ rca_calls_this_month: supabase.rpc('increment', { x: 1 }) })
            .eq('id', input.customerId)
            .then(() => {})

          return {
            analysis:         text,
            model:            env.ANTHROPIC_MODEL,
            promptTokens:     response.usage.input_tokens,
            completionTokens: response.usage.output_tokens,
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err)
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `AI analysis failed: ${msg}` })
        }
      }),
  }),
})

export type AppRouter = typeof appRouter
