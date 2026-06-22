import Graph from 'graphology'
import type { ResourceType, EdgeType, GraphData } from '@liveinfra/shared'

// ── Node colour ───────────────────────────────────────────────────────────────
// Each type occupies a distinct hue sector so nodes are distinguishable
// even at 3-6px size on a near-black canvas.

export function nodeColor(type: ResourceType): string {
  const map: Record<ResourceType, string> = {
    // Compute — warm/violet spectrum
    EC2:           '#f9a825',   // Amber
    Lambda:        '#c47aff',   // Soft violet
    ECS:           '#7b8cff',   // Periwinkle (distinct from lambda)
    StepFunctions: '#b07aff',   // Mid-purple

    // Data — blue/pink spectrum
    RDS:           '#4d9fff',   // Cornflower blue
    ElastiCache:   '#ff6eb4',   // Hot pink
    S3Bucket:      '#40c8e0',   // Cyan

    // Networking — coral/green spectrum
    ALB:           '#ff7d54',   // Coral-orange
    NLB:           '#ffab76',   // Peach (lighter than ALB — same family, different tier)
    APIGateway:    '#34d98e',   // Spring green
    CloudFront:    '#56e0c8',   // Teal-mint

    // Messaging — green/gold spectrum
    SQS:           '#3ecf8e',   // Medium green
    SNS:           '#1cc0a0',   // Teal-green
    EventBridge:   '#ffd166',   // Golden-yellow

    // Network infrastructure — intentionally muted (structural, not primary)
    VPC:           '#3d5068',   // Muted slate
    Subnet:        '#2a3a4f',   // Darker slate
    SecurityGroup: '#1a2d3d',   // Near-canvas (connector dot only)
  }
  return map[type] ?? '#3d5068'
}

// ── Edge style ────────────────────────────────────────────────────────────────
// Edges subordinate to nodes — muted colors, fine widths.
// DEPENDS_ON is the most important (blast-radius path) so it's widest.

export function edgeStyle(type: EdgeType): { color: string; size: number } {
  const styles: Record<EdgeType, { color: string; size: number }> = {
    DEPENDS_ON:  { color: '#b06a28', size: 1.8 },  // Amber-brown — traffic/dependency path
    MEMBER_OF:   { color: '#2d5a8e', size: 1.0 },  // Muted blue — security membership
    PART_OF:     { color: '#162030', size: 0.5 },  // Near-invisible — skip in graphology
    DEPLOYED_IN: { color: '#1a6b45', size: 1.2 },  // Forest green — deployment location
  }
  return styles[type] ?? { color: '#162030', size: 1 }
}

// ── Label helper: prefer Name tag, fall back to abbreviated resource ID ────────

function makeLabel(name: string, id: string): string {
  if (name && name !== id) {
    return name.length > 28 ? name.substring(0, 26) + '…' : name
  }
  const raw = id.startsWith('arn:') ? (id.split('/').pop() ?? id) : id
  return raw.length > 16 ? raw.substring(0, 8) + '…' + raw.slice(-4) : raw
}

// ── Node importance tier ──────────────────────────────────────────────────────

type Tier = 'primary' | 'secondary' | 'connector'

function nodeTier(type: ResourceType): Tier {
  const primary: ResourceType[] = [
    'EC2', 'RDS', 'Lambda', 'ALB', 'NLB', 'ECS', 'ElastiCache',
    'APIGateway', 'S3Bucket', 'SQS', 'SNS', 'CloudFront', 'EventBridge', 'StepFunctions',
  ]
  if (primary.includes(type)) return 'primary'
  if (type === 'VPC') return 'secondary'
  return 'connector'  // SecurityGroup, Subnet
}

// ── Base node size by tier ────────────────────────────────────────────────────

function baseNodeSize(type: ResourceType): number {
  const overrides: Partial<Record<ResourceType, number>> = {
    // Internet-facing resources are largest — if they die, everything behind them dies
    ALB:           18,
    NLB:           17,
    RDS:           17,
    ECS:           15,
    EC2:           14,
    ElastiCache:   13,
    APIGateway:    13,
    CloudFront:    12,
    Lambda:        12,
    S3Bucket:      11,
    SQS:           10,
    SNS:           10,
    EventBridge:   10,
    StepFunctions: 10,
    // Structural
    VPC:            7,
    Subnet:         4,
    SecurityGroup:  3,  // Connector dot — near-invisible at rest
  }
  return overrides[type] ?? 10
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

    // Skip PART_OF — creates sunburst explosion (SG→VPC, Subnet→VPC with 100+ spokes)
    if (edge.type === 'PART_OF') continue

    const style = edgeStyle(edge.type)
    graph.addEdgeWithKey(edge.id, edge.source, edge.target, {
      color:    style.color,
      size:     style.size,
      edgeType: edge.type,
    })
  }

  // Drop orphaned connector nodes (SGs/Subnets with no edges after PART_OF removal)
  const toRemove: string[] = []
  graph.forEachNode((nodeId, attrs) => {
    if (attrs['tier'] === 'connector' && graph.degree(nodeId) === 0) {
      toRemove.push(nodeId)
    }
  })
  toRemove.forEach((id) => graph.dropNode(id))

  // Degree-based size boost for primary nodes — hub resources grow proportionally
  graph.forEachNode((nodeId, attrs) => {
    if (attrs['tier'] !== 'primary') return
    const degree = graph.degree(nodeId)
    if (degree === 0) return
    const base = Number(attrs['size']) || 10
    const boost = Math.min(Math.log2(degree + 1) * 1.8, 8)
    graph.setNodeAttribute(nodeId, 'size', Math.round((base + boost) * 10) / 10)
  })

  return graph
}
