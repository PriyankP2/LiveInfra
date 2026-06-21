import neo4j, { type Driver } from 'neo4j-driver'
import { logger } from '../lib/logger.js'

let _driver: Driver | null = null

export function getNeo4jDriver(): Driver {
  if (_driver) return _driver
  _driver = neo4j.driver(
    process.env['NEO4J_URI'] ?? '',
    neo4j.auth.basic(
      process.env['NEO4J_USERNAME'] ?? 'neo4j',
      process.env['NEO4J_PASSWORD'] ?? ''
    )
  )
  return _driver
}

export async function verifyNeo4jConnection(): Promise<boolean> {
  try {
    const driver = getNeo4jDriver()
    await driver.verifyConnectivity()
    logger.info('Neo4j connection verified')
    return true
  } catch (err) {
    logger.error({ err }, 'Neo4j connection failed')
    return false
  }
}

export async function runQuery<T = unknown>(
  cypher: string,
  params: Record<string, unknown> = {}
): Promise<T[]> {
  const driver = getNeo4jDriver()
  const session = driver.session()
  try {
    const result = await session.run(cypher, params)
    return result.records.map((r) => r.toObject() as T)
  } finally {
    await session.close()
  }
}
