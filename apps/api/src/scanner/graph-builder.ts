import type { GraphNode, GraphEdge, GraphData } from '@liveinfra/shared'

interface BuildGraphInput {
  customerId: string
  accountId: string
  region: string
  results: Array<{ nodes: GraphNode[]; edges: GraphEdge[] }>
}

export function buildGraph(input: BuildGraphInput): GraphData {
  const { customerId, accountId, region, results } = input
  const now = new Date().toISOString()

  // Deduplicate nodes by id using a Map (last writer wins within same scan)
  const nodeMap = new Map<string, GraphNode>()
  for (const result of results) {
    for (const node of result.nodes) {
      nodeMap.set(node.id, { ...node, lastSeen: now })
    }
  }

  // Deduplicate edges by composite key: source__target__type
  const edgeMap = new Map<string, GraphEdge>()
  for (const result of results) {
    for (const edge of result.edges) {
      const key = `${edge.source}__${edge.target}__${edge.type}`
      edgeMap.set(key, {
        ...edge,
        id: key,
        properties: { ...edge.properties, createdAt: now },
      })
    }
  }

  const nodes = Array.from(nodeMap.values())
  const edges = Array.from(edgeMap.values())

  return {
    nodes,
    edges,
    meta: {
      customerId,
      accountId,
      lastScanAt: now,
      nodeCount: nodes.length,
      edgeCount: edges.length,
    },
  }
}
