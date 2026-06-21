import type { FastifyPluginAsync } from 'fastify'
import { verifyNeo4jConnection } from '../neo4j/client.js'

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get('/health', async () => {
    const neo4jOk = await verifyNeo4jConnection()
    return {
      status: neo4jOk ? 'ok' : 'degraded',
      neo4j: neo4jOk,
      ts: new Date().toISOString(),
    }
  })
}
