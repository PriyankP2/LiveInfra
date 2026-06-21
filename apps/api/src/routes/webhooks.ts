import type { FastifyPluginAsync } from 'fastify'
import { createHmac, timingSafeEqual } from 'crypto'
import { logger } from '../lib/logger.js'

// Validates PagerDuty / OpsGenie / CloudWatch webhook signatures
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

export const webhookRoutes: FastifyPluginAsync = async (app) => {
  // PagerDuty V2
  app.post('/pagerduty/:customerId', {
    config: { rawBody: true },
  }, async (req, reply) => {
    const { customerId } = req.params as { customerId: string }
    // TODO: look up signing secret from Supabase for this customerId
    // TODO: validate PD-Signature header
    // TODO: push to BullMQ rca-trigger job

    const body = req.body as { messages?: Array<{ event: string; payload: { summary: string } }> }
    logger.info({ customerId, event: body.messages?.[0]?.event }, 'PagerDuty webhook received')

    return reply.status(200).send({ ok: true })
  })

  // OpsGenie
  app.post('/opsgenie/:customerId', async (req, reply) => {
    const { customerId } = req.params as { customerId: string }
    // TODO: validate OpsGenie signature
    // TODO: push to BullMQ rca-trigger job

    logger.info({ customerId }, 'OpsGenie webhook received')
    return reply.status(200).send({ ok: true })
  })

  // CloudWatch (via SNS)
  app.post('/cloudwatch/:customerId', async (req, reply) => {
    const { customerId } = req.params as { customerId: string }
    // TODO: validate SNS subscription confirmation
    // TODO: parse AlarmName + Dimensions to resolve ARN
    // TODO: push to BullMQ rca-trigger job

    logger.info({ customerId }, 'CloudWatch webhook received')
    return reply.status(200).send({ ok: true })
  })
}
