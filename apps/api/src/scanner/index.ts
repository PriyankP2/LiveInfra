import { assumeRole } from './assume-role.js'
import { scanEC2 } from './services/ec2.js'
import { scanRDS } from './services/rds.js'
import { scanLambda } from './services/lambda.js'
import { scanELB } from './services/elb.js'
import { scanECS } from './services/ecs.js'
import { buildGraph } from './graph-builder.js'
import { writeGraphToNeo4j } from './neo4j-writer.js'
import type { ScanJobInput, ScanResult, ScanRegionResult } from './types.js'
import type { GraphNode, GraphEdge } from '@liveinfra/shared'

const SERVICE_NAMES = ['EC2', 'RDS', 'Lambda', 'ELB', 'ECS'] as const

export async function scanAccount(input: ScanJobInput): Promise<ScanResult> {
  const startedAt = new Date().toISOString()

  // Assume the cross-account IAM role once — credentials are valid for 1 hour.
  const credentials = await assumeRole(input.roleArn, input.externalId)

  const regionResults: ScanRegionResult[] = []

  for (const region of input.regions) {
    const errors: string[] = []
    const scanParams = {
      credentials,
      accountId: input.accountId,
      customerId: input.customerId,
      region,
    }

    // Run all five service scanners concurrently; a single failure must not
    // abort the others — use allSettled and capture per-service errors.
    const results = await Promise.allSettled([
      scanEC2(scanParams),
      scanRDS(scanParams),
      scanLambda(scanParams),
      scanELB(scanParams),
      scanECS(scanParams),
    ])

    const successResults = results
      .filter(
        (r): r is PromiseFulfilledResult<{ nodes: GraphNode[]; edges: GraphEdge[] }> =>
          r.status === 'fulfilled'
      )
      .map((r) => r.value)

    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        const name = SERVICE_NAMES[i] ?? `service[${i}]`
        const message = r.reason instanceof Error ? r.reason.message : String(r.reason)
        errors.push(`${name}: ${message}`)
      }
    })

    const graphData = buildGraph({
      customerId: input.customerId,
      accountId: input.accountId,
      region,
      results: successResults,
    })

    // Persist to Neo4j; if the write fails, record the error rather than
    // crashing the entire scan loop.
    try {
      await writeGraphToNeo4j(graphData)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      errors.push(`Neo4j write: ${message}`)
    }

    regionResults.push({
      region,
      nodeCount: graphData.nodes.length,
      edgeCount: graphData.edges.length,
      errors,
    })
  }

  const completedAt = new Date().toISOString()
  const totalNodes = regionResults.reduce((sum, r) => sum + r.nodeCount, 0)
  const totalEdges = regionResults.reduce((sum, r) => sum + r.edgeCount, 0)
  const allErrors = regionResults.flatMap((r) => r.errors)

  const status: ScanResult['status'] =
    allErrors.length === 0 ? 'success' : totalNodes > 0 ? 'partial' : 'failed'

  return {
    customerId: input.customerId,
    accountId: input.accountId,
    startedAt,
    completedAt,
    totalNodes,
    totalEdges,
    regions: regionResults,
    status,
  }
}
