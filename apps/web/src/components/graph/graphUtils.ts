import Graph from 'graphology'
import type { ResourceType, EdgeType, GraphData } from '@liveinfra/shared'

// ── Node colour ───────────────────────────────────────────────────────────────

export function nodeColor(type: ResourceType): string {
  const map: Record<ResourceType, string> = {
    EC2:           '#f59e0b',
    RDS:           '#3b82f6',
    Lambda:        '#a855f7',
    ALB:           '#f97316',
    NLB:           '#fb923c',
    SQS:           '#10b981',
    SNS:           '#06b6d4',
    S3Bucket:      '#38bdf8',
    VPC:           '#475569',
    Subnet:        '#334155',
    SecurityGroup: '#1e3a4a',
    ECS:           '#6366f1',
    ElastiCache:   '#ec4899',
    EventBridge:   '#fbbf24',
    StepFunctions: '#a78bfa',
    APIGateway:    '#34d399',
    CloudFront:    '#67e8f9',
  }
  return map[type] ?? '#64748b'
}

// ── Edge style ────────────────────────────────────────────────────────────────

export function edgeStyle(type: EdgeType): { color: string; size: number } {
  const styles: Record<EdgeType, { color: string; size: number }> = {
    DEPENDS_ON:  { color: '#f97316', size: 2.5 }, // orange — traffic / dependency
    MEMBER_OF:   { color: '#2563eb', size: 1 },   // blue  — security membership
    PART_OF:     { color: '#1e293b', size: 0.5 }, // nearly invisible — structural only
    DEPLOYED_IN: { color: '#16a34a', size: 1.5 }, // green — deployment location
  }
  return styles[type] ?? { color: '#1e293b', size: 1 }
}

// ── Label helper: prefer Name tag, fall back to abbreviated resource ID ────────

function makeLabel(name: string, id: string): string {
  if (name && name !== id) {
    return name.length > 28 ? name.substring(0, 26) + '…' : name
  }
  // ARN → extract resource-id portion after the last '/'
  const raw = id.startsWith('arn:') ? (id.split('/').pop() ?? id) : id
  // Shorten long IDs: "sg-0abc12345678" → "sg-0abc…5678"
  return raw.length > 16 ? raw.substring(0, 8) + '…' + raw.slice(-4) : raw
}

// ── Node importance tier ──────────────────────────────────────────────────────

type Tier = 'primary' | 'secondary' | 'connector'

function nodeTier(type: ResourceType): Tier {
  if (['EC2','RDS','Lambda','ALB','NLB','ECS','ElastiCache','APIGateway','S3Bucket','SQS','SNS','CloudFront','EventBridge','StepFunctions'].includes(type)) return 'primary'
  if (['VPC'].includes(type)) return 'secondary'
  return 'connector'  // SecurityGroup, Subnet
}

// ── Base node size by tier ────────────────────────────────────────────────────

function baseNodeSize(type: ResourceType): number {
  const tier = nodeTier(type)
  if (tier === 'primary') {
    const overrides: Partial<Record<ResourceType, number>> = {
      RDS: 16, ALB: 15, NLB: 15, ECS: 14, EC2: 13,
      Lambda: 12, ElastiCache: 12, APIGateway: 12,
    }
    return overrides[type] ?? 11
  }
  if (tier === 'secondary') return 7  // VPC — small anchor
  return 3                            // SG, Subnet — tiny connectors
}

// ── Convert GraphData → graphology Graph ──────────────────────────────────────

export function graphDataToGraphology(data: GraphData): Graph {
  const graph = new Graph({ multi: false, type: 'directed' })

  const validNodes = data.nodes.filter((n) => !!n.id)
  const total = validNodes.length

  for (let i = 0; i < total; i++) {
    const node = validNodes[i]!
    if (graph.hasNode(node.id)) continue

    const angle = (2 * Math.PI * i) / Math.max(total, 1)
    const x = Math.cos(angle) * 10
    const y = Math.sin(angle) * 10
    const tier = nodeTier(node.type)

    graph.addNode(node.id, {
      label:            makeLabel(node.name, node.id),
      color:            nodeColor(node.type),
      size:             baseNodeSize(node.type),
      x,
      y,
      tier,
      resourceType:     node.type,
      region:           node.region,
      accountId:        node.accountId,
      customerId:       node.customerId,
      lastSeen:         node.lastSeen,
      tags:             node.tags,
      properties:       node.properties,
      blastRadiusScore: node.blastRadiusScore,
    })
  }

  for (const edge of data.edges) {
    if (!graph.hasNode(edge.source) || !graph.hasNode(edge.target)) continue
    if (graph.hasEdge(edge.source, edge.target)) continue

    // Skip PART_OF edges entirely — they create sunburst patterns (SG→VPC, Subnet→VPC)
    // without conveying meaningful dependency information for RCA.
    if (edge.type === 'PART_OF') continue

    const style = edgeStyle(edge.type)
    graph.addEdgeWithKey(edge.id, edge.source, edge.target, {
      color:    style.color,
      size:     style.size,
      edgeType: edge.type,
    })
  }

  // Drop orphaned connector nodes (SGs/Subnets with no edges after PART_OF removal).
  // They have no connections to anything meaningful — showing them as isolated dots
  // is pure noise.
  const toRemove: string[] = []
  graph.forEachNode((nodeId, attrs) => {
    if (attrs['tier'] === 'connector' && graph.degree(nodeId) === 0) {
      toRemove.push(nodeId)
    }
  })
  toRemove.forEach((id) => graph.dropNode(id))

  // Degree-based size boost for primary nodes — hub resources grow proportionally.
  // Capped so no single node dominates the canvas.
  graph.forEachNode((nodeId, attrs) => {
    if (attrs['tier'] !== 'primary') return
    const degree = graph.degree(nodeId)
    if (degree === 0) return
    const base = Number(attrs['size']) || 10
    const boost = Math.min(Math.log2(degree + 1) * 1.8, 7)
    graph.setNodeAttribute(nodeId, 'size', Math.round((base + boost) * 10) / 10)
  })

  return graph
}
