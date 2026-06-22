import Graph from 'graphology'
import type { ResourceType, EdgeType, GraphData } from '@liveinfra/shared'

// ── Node colour ───────────────────────────────────────────────────────────────

export function nodeColor(type: ResourceType): string {
  const map: Record<ResourceType, string> = {
    EC2: '#f59e0b',
    RDS: '#3b82f6',
    Lambda: '#a855f7',
    ALB: '#f97316',
    NLB: '#f97316',
    SQS: '#10b981',
    SNS: '#06b6d4',
    S3Bucket: '#06b6d4',
    VPC: '#475569',
    Subnet: '#334155',
    SecurityGroup: '#64748b',
    ECS: '#6366f1',
    ElastiCache: '#ec4899',
    EventBridge: '#f59e0b',
    StepFunctions: '#a78bfa',
    APIGateway: '#34d399',
    CloudFront: '#38bdf8',
  }
  return map[type] ?? '#64748b'
}

// ── Status / blast-radius colour ──────────────────────────────────────────────

export function statusColor(score?: number): string {
  if (score === undefined) return '#6b7280'
  if (score >= 0.8) return '#ef4444'
  if (score >= 0.5) return '#f97316'
  if (score >= 0.2) return '#eab308'
  return '#22c55e'
}

// ── Edge style ────────────────────────────────────────────────────────────────

export function edgeStyle(type: EdgeType): { color: string; size: number } {
  const styles: Record<EdgeType, { color: string; size: number }> = {
    DEPENDS_ON: { color: '#f97316', size: 2 },    // orange — traffic dependency
    MEMBER_OF:  { color: '#3b82f6', size: 1.5 },  // blue — security/membership
    PART_OF:    { color: '#475569', size: 1 },     // slate — structural hierarchy
    DEPLOYED_IN:{ color: '#22c55e', size: 1.5 },  // green — deployment location
  }
  return styles[type] ?? { color: '#475569', size: 1 }
}

// ── Node size by resource type ────────────────────────────────────────────────

function nodeSize(type: ResourceType): number {
  const sizes: Partial<Record<ResourceType, number>> = {
    RDS: 18,
    ALB: 16,
    NLB: 16,
    EC2: 14,
    ECS: 14,
    Lambda: 12,
    VPC: 12,
    ElastiCache: 12,
    Subnet: 7,
    SecurityGroup: 7,
  }
  return sizes[type] ?? 10
}

// ── Convert GraphData → graphology Graph ──────────────────────────────────────

export function graphDataToGraphology(data: GraphData): Graph {
  const graph = new Graph({ multi: false, type: 'directed' })

  const validNodes = data.nodes.filter((n) => !!n.id)
  const total = validNodes.length

  for (let i = 0; i < total; i++) {
    const node = validNodes[i]!
    if (graph.hasNode(node.id)) continue

    // Circular initial positions — ForceAtlas2 converges near origin from here
    const angle = (2 * Math.PI * i) / Math.max(total, 1)
    const x = Math.cos(angle) * 10
    const y = Math.sin(angle) * 10

    graph.addNode(node.id, {
      label: node.name || node.id,
      color: nodeColor(node.type),
      size: nodeSize(node.type),
      x,
      y,
      // Carry through original data for the panel
      resourceType: node.type,
      accountId: node.accountId,
      region: node.region,
      customerId: node.customerId,
      lastSeen: node.lastSeen,
      tags: node.tags,
      properties: node.properties,
      blastRadiusScore: node.blastRadiusScore,
    })
  }

  for (const edge of data.edges) {
    // Guard against edges referencing unknown nodes (defensive)
    if (!graph.hasNode(edge.source) || !graph.hasNode(edge.target)) continue
    // Guard against duplicate edges (multi: false graph would throw)
    if (graph.hasEdge(edge.source, edge.target)) continue

    const style = edgeStyle(edge.type)
    graph.addEdgeWithKey(edge.id, edge.source, edge.target, {
      color: style.color,
      size: style.size,
      edgeType: edge.type,
    })
  }

  return graph
}
