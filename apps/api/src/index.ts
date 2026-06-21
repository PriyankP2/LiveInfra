import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import { logger } from './lib/logger.js'
import { webhookRoutes } from './routes/webhooks.js'
import { healthRoutes } from './routes/health.js'
import { trpcPlugin } from './trpc/plugin.js'

const app = Fastify({ logger: false })

await app.register(helmet)
await app.register(cors, {
  origin: process.env['FRONTEND_URL'] ?? 'http://localhost:3000',
  credentials: true,
})

await app.register(healthRoutes)
await app.register(webhookRoutes, { prefix: '/webhooks' })
await app.register(trpcPlugin, { prefix: '/trpc' })

const port = Number(process.env['PORT'] ?? 4000)
const host = process.env['HOST'] ?? '0.0.0.0'

try {
  await app.listen({ port, host })
  logger.info(`API server listening on ${host}:${port}`)
} catch (err) {
  logger.error(err)
  process.exit(1)
}
