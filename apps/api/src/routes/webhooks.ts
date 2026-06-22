import type { FastifyPluginAsync } from 'fastify'
import { createHmac, timingSafeEqual } from 'crypto'
import { logger } from '../lib/logger.js'
import { supabase } from '../lib/supabase.js'
import { runQuery } from '../neo4j/client.js'
import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { env } from '../lib/env.js'
import { assumeRole } from '../scanner/assume-role.js'
import { fetchCloudTrailEvents } from '../scanner/cloudtrail.js'

// ── HMAC signature validation ─────────────────────────────────────────────────
function validateHmac(
  payload: string,
  secret: string,
  signature: string,
  algorithm: 'sha256' | 'sha512' = 'sha256'
): boolean {
  const expected = createHmac(algorithm, secret).update(payload).digest('hex')
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  } catch {
    return false
  }
}

// ── PagerDuty V2 payload types ────────────────────────────────────────────────
interface PdMessage {
  event: string
  incident: {
    id: string
    title: string
    status: string
    urgency?: string
    created_at?: string
    html_url?: string
    service?: { name?: string }
  }
  payload?: {
    severity?: string
    source?: string
    summary?: string
    custom_details?: Record<string, unknown>
  }
}

interface PdBody {
  messages?: PdMessage[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Extract a resource ARN or ID from a PagerDuty message. */
function extractResourceArn(msg: PdMessage): string | null {
  const cd = msg.payload?.custom_details ?? {}
  const arn = cd['resource_arn'] ?? cd['resourceArn'] ?? cd['arn']
    ?? cd['resource_id'] ?? cd['resourceId'] ?? cd['instance_id']
  if (arn) return String(arn)

  const text = (msg.payload?.summary ?? msg.incident.title ?? '') + ' ' + (msg.payload?.source ?? '')

  // Full ARN
  const arnMatch = text.match(/arn:aws:[a-z0-9-]+:[a-z0-9-]*:\d+:[^\s,"']+/)
  if (arnMatch?.[0]) return arnMatch[0]

  // EC2 instance ID
  const ec2Match = text.match(/\bi-[0-9a-f]{8,17}\b/)
  if (ec2Match?.[0]) return ec2Match[0]

  // RDS identifier
  const rdsMatch = text.match(/\b(db-[a-z0-9-]+|[a-z][a-z0-9-]{0,62}\.rds\.amazonaws\.com)\b/i)
  if (rdsMatch?.[0]) return rdsMatch[0]

  // Lambda function name (heuristic: word boundary, no slashes, contains letters+hyphens)
  const lambdaMatch = text.match(/\bfunction[:\s]+([a-zA-Z0-9_-]+)/i)
  if (lambdaMatch?.[1]) return lambdaMatch[1]

  return null
}

function mapSeverity(pd: string | undefined): 'critical' | 'high' | 'medium' | 'low' | 'info' {
  switch (pd?.toLowerCase()) {
    case 'critical': return 'critical'
    case 'error':    return 'high'
    case 'warning':  return 'medium'
    case 'info':     return 'info'
    default:         return 'low'
  }
}

/** Look up a resource in Neo4j by ARN or extracted ID. */
async function findNeo4jNode(customerId: string, resourceArn: string) {
  // Extract the last segment (handle both ARN formats and raw IDs)
  const lastColon  = resourceArn.split(':').at(-1) ?? resourceArn
  const resourceId = lastColon.includes('/')
    ? lastColon.split('/').at(-1) ?? lastColon
    : lastColon

  const rows = await runQuery<{
    id: string; name: string; type: string; region: string; accountId: string
  }>(
    `MATCH (n:Resource {customer_id: $customerId})
     WHERE n.id = $resourceArn
        OR n.id CONTAINS $resourceId
        OR n.name = $resourceId
     RETURN n.id AS id, n.name AS name, n.type AS type,
            n.region AS region, n.account_id AS accountId
     LIMIT 1`,
    { customerId, resourceArn, resourceId }
  )
  return rows[0] ?? null
}

/** Run RCA analysis and persist results — always called in background. */
async function runAutoRca(params: {
  customerId:    string
  incidentId:    string  // UUID in incidents table
  resourceArn:   string
  incidentTitle: string
  severity:      string
}) {
  const { customerId, incidentId, resourceArn, incidentTitle } = params
  const startedAt = Date.now()

  // Mark incident as "analyzing"
  await supabase.from('incidents').update({ status: 'analyzing' }).eq('id', incidentId)

  // Insert pending rca_history row
  const { data: rcaRow } = await supabase
    .from('rca_history')
    .insert({
      customer_id:  customerId,
      incident_id:  incidentId,
      resource_arn: resourceArn,
      status:       'pending',
      started_at:   new Date().toISOString(),
    })
    .select('id')
    .single()

  if (!rcaRow) {
    await supabase.from('incidents').update({ status: 'error' }).eq('id', incidentId)
    return
  }

  try {
    // Resolve Neo4j resource node
    const node = await findNeo4jNode(customerId, resourceArn)

    // Fetch blast radius if node found
    let blastInfo = ''
    let cloudTrailSection = ''

    if (node) {
      try {
        const blastRows = await runQuery<{ count: number }>(
          `MATCH (source:Resource {id: $resourceId, customer_id: $customerId})
           OPTIONAL MATCH path = (source)<-[:DEPENDS_ON|PART_OF|DEPLOYED_IN*1..6]-(downstream:Resource {customer_id: $customerId})
           RETURN count(DISTINCT downstream) AS count`,
          { resourceId: node.id, customerId }
        )
        const affectedCount = blastRows[0]?.count ?? 0
        blastInfo = `\n**Blast radius**: ${affectedCount} downstream resources at risk`
      } catch { /* best-effort */ }

      // CloudTrail enrichment — find the account's role ARN
      try {
        const { data: accountRow } = await supabase
          .from('aws_accounts')
          .select('role_arn, external_id')
          .eq('customer_id', customerId)
          .eq('account_id', node.accountId)
          .single()

        if (accountRow) {
          const creds = await assumeRole(
            String(accountRow['role_arn']),
            String(accountRow['external_id'] ?? 'liveinfra'),
            'LiveInfraAutoRCA'
          )
          const summary = await fetchCloudTrailEvents({
            resourceId:   node.id,
            resourceType: node.type,
            region:       node.region,
            credentials:  creds,
          })
          if (summary.events.length > 0) {
            const changes = summary.recentChanges.slice(0, 6)
              .map(e => `  - ${e.eventTime.slice(11, 19)} ${e.eventName} by ${e.username}`)
              .join('\n')
            const errors = summary.errorEvents.slice(0, 4)
              .map(e => `  - ${e.eventTime.slice(11, 19)} ${e.eventName} → ${e.errorCode ?? ''}`)
              .join('\n')
            cloudTrailSection = `\n\n**CloudTrail Evidence (last 24h — ${summary.events.length} events)**`
            if (changes) cloudTrailSection += `\nRecent changes:\n${changes}`
            if (errors)  cloudTrailSection += `\nErrors:\n${errors}`
          }
        }
      } catch { /* CloudTrail enrichment is best-effort */ }
    }

    const hasAnthropic = !!env.ANTHROPIC_API_KEY
    const hasGemini    = !!env.GEMINI_API_KEY
    if (!hasAnthropic && !hasGemini) {
      await supabase.from('rca_history').update({
        root_cause:    'AI RCA not configured — add ANTHROPIC_API_KEY or GEMINI_API_KEY to apps/api/.env',
        status:        'complete',
        completed_at:  new Date().toISOString(),
        latency_ms:    Date.now() - startedAt,
      }).eq('id', rcaRow.id)
      await supabase.from('incidents').update({ status: 'resolved' }).eq('id', incidentId)
      return
    }

    const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY ?? '' })
    const gemini    = env.GEMINI_API_KEY ? new GoogleGenerativeAI(env.GEMINI_API_KEY) : null

    const resourceLine = node
      ? `**Resource**: ${node.type} \`${node.name}\` (${node.region} / ${node.accountId})`
      : `**Resource ARN**: \`${resourceArn}\``

    const userPrompt = `You are performing an automated Root Cause Analysis triggered by a PagerDuty alert.

**Incident**: ${incidentTitle}
${resourceLine}${blastInfo}
${cloudTrailSection}

Provide a concise RCA (under 350 words):
1. **Most likely root cause** — what specifically failed and why
2. **Blast radius** — what services are downstream and affected
3. **Immediate actions** — numbered, concrete AWS console/CLI steps
4. **Prevention** — 2 specific changes to avoid recurrence

Be direct. This is a live incident.`

    const systemMsg = 'You are LiveInfra\'s AI RCA engine. Analyze AWS infrastructure incidents concisely and actionably. Use markdown formatting.'

    let analysis = ''
    let inputTokens = 0
    let outputTokens = 0

    if (hasAnthropic) {
      const response = await anthropic.messages.create({
        model:      env.ANTHROPIC_MODEL,
        max_tokens: 900,
        system:     systemMsg,
        messages:   [{ role: 'user', content: userPrompt }],
      })
      analysis     = response.content.filter(b => b.type === 'text').map(b => (b as { type: 'text'; text: string }).text).join('')
      inputTokens  = response.usage.input_tokens
      outputTokens = response.usage.output_tokens
    } else if (gemini) {
      const model  = gemini.getGenerativeModel({ model: env.GEMINI_MODEL })
      const result = await model.generateContent(`${systemMsg}\n\n${userPrompt}`)
      analysis     = result.response.text()
      inputTokens  = Math.ceil((systemMsg.length + userPrompt.length) / 4)
      outputTokens = Math.ceil(analysis.length / 4)
    }

    const latencyMs = Date.now() - startedAt

    await supabase.from('rca_history').update({
      root_cause:              analysis,
      status:                  'complete',
      completed_at:            new Date().toISOString(),
      input_tokens:            inputTokens,
      output_tokens:           outputTokens,
      latency_ms:              latencyMs,
      cloudtrail_events_count: cloudTrailSection ? parseInt(cloudTrailSection.match(/(\d+) events/)?.[1] ?? '0') : 0,
      ...(node ? { affected_services: { nodeId: node.id, type: node.type, region: node.region } } : {}),
    }).eq('id', rcaRow.id)

    await supabase.from('incidents').update({
      status:      'resolved',
      resource_id: node?.id ?? null,
    }).eq('id', incidentId)

    logger.info({ incidentId, latencyMs, tokens: inputTokens + outputTokens }, 'Auto-RCA complete')
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.error({ incidentId, err: msg }, 'Auto-RCA failed')
    await supabase.from('rca_history').update({ status: 'error', error_message: msg.slice(0, 500) }).eq('id', rcaRow.id)
    await supabase.from('incidents').update({ status: 'error' }).eq('id', incidentId)
  }
}

// ── Fastify plugin ─────────────────────────────────────────────────────────────
export const webhookRoutes: FastifyPluginAsync = async (app) => {
  // ── PagerDuty V2 ────────────────────────────────────────────────────────────
  app.post('/pagerduty/:customerId', {
    config: { rawBody: true },
  }, async (req, reply) => {
    const { customerId } = req.params as { customerId: string }
    const rawBody = (req as unknown as { rawBody?: string }).rawBody ?? JSON.stringify(req.body)

    // Look up signing secret for this customer
    const { data: config } = await supabase
      .from('webhook_configs')
      .select('signing_secret, is_active')
      .eq('customer_id', customerId)
      .eq('type', 'pagerduty')
      .eq('is_active', true)
      .single()

    if (!config) {
      logger.warn({ customerId }, 'PagerDuty webhook: no active config')
      return reply.status(403).send({ error: 'No active PagerDuty webhook config' })
    }

    // Validate PD-Signature: "v1=<hex>,v1=<hex>..." — check any v1 signature matches
    const pdSig = req.headers['x-pagerduty-signature'] as string | undefined
    if (pdSig) {
      const sigs = pdSig.split(',').map(s => s.trim().replace(/^v1=/, ''))
      const valid = sigs.some(sig => validateHmac(rawBody, config.signing_secret, sig))
      if (!valid) {
        logger.warn({ customerId }, 'PagerDuty webhook: invalid signature')
        return reply.status(401).send({ error: 'Invalid signature' })
      }
    }

    // Update last_received_at
    void supabase
      .from('webhook_configs')
      .update({ last_received_at: new Date().toISOString(), events_received_count: supabase.rpc('increment', { x: 1 }) })
      .eq('customer_id', customerId)
      .eq('type', 'pagerduty')
      .then(() => {})

    const body = req.body as PdBody
    const messages = body.messages ?? []

    for (const msg of messages) {
      // Only process trigger/acknowledge events (not resolve — no RCA needed)
      if (!msg.event?.includes('trigger') && !msg.event?.includes('alert')) continue

      const resourceArn = extractResourceArn(msg)
      const severity    = mapSeverity(msg.payload?.severity)
      const title       = msg.incident.title ?? msg.payload?.summary ?? 'PagerDuty alert'

      // Insert incident record
      const { data: incident } = await supabase
        .from('incidents')
        .insert({
          customer_id:        customerId,
          source:             'pagerduty',
          source_incident_id: msg.incident.id,
          title,
          severity,
          resource_arn:       resourceArn,
          status:             'open',
          raw_payload:        msg as unknown as Record<string, unknown>,
          triggered_at:       msg.incident.created_at ?? new Date().toISOString(),
        })
        .select('id')
        .single()

      if (!incident) continue

      logger.info({ customerId, incidentId: incident.id, event: msg.event, resourceArn }, 'PagerDuty incident recorded')

      if (resourceArn) {
        // Fire RCA in the background — don't await
        void runAutoRca({
          customerId,
          incidentId:    incident.id,
          resourceArn,
          incidentTitle: title,
          severity,
        }).catch((err: unknown) => {
          logger.error({ incidentId: incident.id, err: String(err) }, 'runAutoRca crashed')
        })
      }
    }

    return reply.status(200).send({ ok: true, processed: messages.length })
  })

  // ── OpsGenie ────────────────────────────────────────────────────────────────
  app.post('/opsgenie/:customerId', async (req, reply) => {
    const { customerId } = req.params as { customerId: string }
    const body = req.body as {
      action?: string
      alert?: {
        alertId?: string
        message?: string
        priority?: string
        details?: Record<string, unknown>
      }
    }

    if (!body.alert) return reply.status(200).send({ ok: true })

    const resourceArn = (() => {
      const details = body.alert.details ?? {}
      const r = details['resource_arn'] ?? details['resourceArn'] ?? details['arn']
      if (r) return String(r)
      const text = body.alert.message ?? ''
      const m = text.match(/arn:aws:[a-z0-9-]+:[a-z0-9-]*:\d+:[^\s,"']+/)
      return m?.[0] ?? null
    })()

    const { data: incident } = await supabase
      .from('incidents')
      .insert({
        customer_id:        customerId,
        source:             'opsgenie',
        source_incident_id: body.alert.alertId,
        title:              body.alert.message ?? 'OpsGenie alert',
        severity:           mapSeverity(body.alert.priority),
        resource_arn:       resourceArn,
        status:             'open',
        raw_payload:        body as unknown as Record<string, unknown>,
        triggered_at:       new Date().toISOString(),
      })
      .select('id')
      .single()

    if (incident && resourceArn) {
      void runAutoRca({
        customerId,
        incidentId:    incident.id,
        resourceArn,
        incidentTitle: body.alert.message ?? 'OpsGenie alert',
        severity:      body.alert.priority ?? 'P3',
      }).catch(() => {})
    }

    logger.info({ customerId }, 'OpsGenie webhook received')
    return reply.status(200).send({ ok: true })
  })

  // ── CloudWatch / SNS ─────────────────────────────────────────────────────────
  app.post('/cloudwatch/:customerId', async (req, reply) => {
    const { customerId } = req.params as { customerId: string }
    const body = req.body as {
      Type?: string
      SubscribeURL?: string
      Message?: string
      Subject?: string
    }

    // Handle SNS subscription confirmation
    if (body.Type === 'SubscriptionConfirmation' && body.SubscribeURL) {
      logger.info({ customerId }, 'CloudWatch SNS: subscription confirmation request received')
      // Auto-confirm would need an HTTP fetch of the SubscribeURL — left for Phase 2
      return reply.status(200).send({ ok: true })
    }

    // Parse SNS notification
    let alarmName = body.Subject ?? ''
    let resourceArn: string | null = null
    let severityStr = 'warning'

    try {
      const msg = JSON.parse(body.Message ?? '{}') as Record<string, unknown>
      alarmName = String(msg['AlarmName'] ?? alarmName)
      severityStr = msg['NewStateValue'] === 'ALARM' ? 'critical' : 'info'

      const dims = msg['Trigger'] as Record<string, unknown> | undefined
      const dimensions = dims?.['Dimensions'] as Array<{ Name: string; Value: string }> | undefined
      if (dimensions) {
        const instanceDim = dimensions.find(d => d.Name === 'InstanceId')
        const dbDim       = dimensions.find(d => d.Name === 'DBInstanceIdentifier')
        const fnDim       = dimensions.find(d => d.Name === 'FunctionName')
        resourceArn = instanceDim?.Value ?? dbDim?.Value ?? fnDim?.Value ?? null
      }
    } catch { /* Message may not be JSON */ }

    const { data: incident } = await supabase
      .from('incidents')
      .insert({
        customer_id:  customerId,
        source:       'cloudwatch',
        title:        alarmName || 'CloudWatch alarm',
        severity:     mapSeverity(severityStr),
        resource_arn: resourceArn,
        status:       'open',
        raw_payload:  body as unknown as Record<string, unknown>,
        triggered_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (incident && resourceArn) {
      void runAutoRca({
        customerId,
        incidentId:    incident.id,
        resourceArn,
        incidentTitle: alarmName || 'CloudWatch alarm',
        severity:      severityStr,
      }).catch(() => {})
    }

    logger.info({ customerId }, 'CloudWatch webhook received')
    return reply.status(200).send({ ok: true })
  })
}
