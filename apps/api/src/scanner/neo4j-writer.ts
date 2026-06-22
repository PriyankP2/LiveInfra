import { runQuery } from '../neo4j/client.js'
import type { GraphData, GraphEdge, EdgeType } from '@liveinfra/shared'

// All valid edge types from the shared schema
const EDGE_TYPES: EdgeType[] = ['DEPENDS_ON', 'MEMBER_OF', 'PART_OF', 'DEPLOYED_IN']

export async function writeGraphToNeo4j(graphData: GraphData): Promise<void> {
  const { nodes, edges, meta } = graphData
  const { customerId } = meta

  if (nodes.length === 0 && edges.length === 0) return

  // ── Batch upsert nodes ────────────────────────────────────────────────────
  // Neo4j's MERGE on a large UNWIND list is idempotent: it creates the node
  // if absent and updates properties if it already exists.
  if (nodes.length > 0) {
    // Neo4j only stores primitives — serialize tags/properties as JSON strings
    const serializedNodes = nodes.map((n) => ({
      ...n,
      tags: JSON.stringify(n.tags),
      properties: JSON.stringify(n.properties),
    }))
    await runQuery(
      `UNWIND $nodes AS n
       MERGE (r:Resource {id: n.id, customer_id: n.customerId})
       SET r += {
         type:       n.type,
         name:       n.name,
         account_id: n.accountId,
         region:     n.region,
         last_seen:  n.lastSeen,
         tags:       n.tags,
         properties: n.properties
       }`,
      { nodes: serializedNodes }
    )
  }

  if (edges.length === 0) return

  // ── Batch upsert edges grouped by type ───────────────────────────────────
  // Neo4j does not allow dynamic relationship types inside UNWIND, so we must
  // run a separate query for each distinct edge type.
  const edgesByType = new Map<EdgeType, GraphEdge[]>()
  for (const edge of edges) {
    const bucket = edgesByType.get(edge.type) ?? []
    bucket.push(edge)
    edgesByType.set(edge.type, bucket)
  }

  const writePromises: Promise<unknown>[] = []

  for (const edgeType of EDGE_TYPES) {
    const bucket = edgesByType.get(edgeType)
    if (!bucket || bucket.length === 0) continue

    // Build the Cypher with a literal relationship type — safe because edgeType
    // is narrowed to the EdgeType union, never user-supplied freeform input.
    const cypher = `
      UNWIND $edges AS e
      MATCH (a:Resource {id: e.source, customer_id: $customerId})
      MATCH (b:Resource {id: e.target, customer_id: $customerId})
      MERGE (a)-[r:${edgeType}]->(b)
      SET r += {
        edge_type:  e.properties.edgeType,
        created_at: e.properties.createdAt
      }`

    writePromises.push(runQuery(cypher, { edges: bucket, customerId }))
  }

  await Promise.all(writePromises)
}
