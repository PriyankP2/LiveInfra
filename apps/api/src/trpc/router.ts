import { initTRPC } from '@trpc/server'
import { z } from 'zod'
import { runQuery } from '../neo4j/client.js'
import { calcBlastScore, scoreToSeverity, type GraphData } from '@liveinfra/shared'
import type { GraphNode, GraphEdge } from '@liveinfra/shared'
import { scanAccount } from '../scanner/index.js'

const t = initTRPC.create()

export const router = t.router
export const publicProcedure = t.procedure

export const appRouter = router({
  // ── Health ──────────────────────────────────────────────────────────────
  health: publicProcedure.query(() => ({ ok: true, ts: new Date().toISOString() })),

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

        const nodes: GraphNode[] = nodeRows.map((row) => {
          const n = row['n'] as Record<string, unknown>
          return {
            id: String(n['id'] ?? ''),
            type: String(n['type'] ?? 'EC2') as GraphNode['type'],
            name: String(n['name'] ?? ''),
            accountId: String(n['account_id'] ?? ''),
            region: String(n['region'] ?? ''),
            customerId: String(n['customer_id'] ?? ''),
            lastSeen: String(n['last_seen'] ?? ''),
            tags: (n['tags'] as Record<string, string>) ?? {},
            properties: (n['properties'] as Record<string, string | number | boolean | null>) ?? {},
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
})

export type AppRouter = typeof appRouter
