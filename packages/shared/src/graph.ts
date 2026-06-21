// ─── Node Types ──────────────────────────────────────────────────────────────

export type ResourceType =
  | 'EC2'
  | 'RDS'
  | 'Lambda'
  | 'ALB'
  | 'NLB'
  | 'SQS'
  | 'SNS'
  | 'S3Bucket'
  | 'VPC'
  | 'Subnet'
  | 'SecurityGroup'
  | 'ECS'
  | 'ElastiCache'
  | 'EventBridge'
  | 'StepFunctions'
  | 'APIGateway'
  | 'CloudFront'

export type EdgeType = 'DEPENDS_ON' | 'MEMBER_OF' | 'PART_OF' | 'DEPLOYED_IN'

export interface GraphNode {
  id: string              // ARN or unique resource identifier
  type: ResourceType
  name: string            // Human-readable display name (from tags or resource ID)
  accountId: string
  region: string
  customerId: string
  lastSeen: string        // ISO datetime
  tags: Record<string, string>
  // Type-specific properties (subset varies by resource type)
  properties: Record<string, string | number | boolean | null>
  // Computed by blast radius algorithm (not stored in Neo4j)
  blastRadiusScore?: number
  blastRadiusHops?: number
}

export interface GraphEdge {
  id: string              // `${sourceId}__${targetId}__${type}`
  source: string          // Node id
  target: string          // Node id
  type: EdgeType
  properties: {
    edgeType?: string       // e.g. "event_source_mapping", "target_group"
    trafficVolume?: number  // req/sec from VPC flow logs
    lastFlowLog?: string    // ISO datetime
    createdAt: string
  }
}

export interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
  meta: {
    customerId: string
    accountId: string
    lastScanAt: string
    nodeCount: number
    edgeCount: number
  }
}

// ─── Blast Radius ─────────────────────────────────────────────────────────────

export type BlastSeverity = 'critical' | 'degraded' | 'at-risk' | 'monitoring'

export interface BlastRadiusResult {
  sourceNodeId: string
  affected: Array<{
    nodeId: string
    hops: number
    score: number           // 0.0–1.0
    severity: BlastSeverity
  }>
  queryMs: number
}

export const RESOURCE_TYPE_MULTIPLIERS: Record<ResourceType, number> = {
  RDS: 3.0,
  ALB: 2.5,
  NLB: 2.5,
  EC2: 2.0,
  ElastiCache: 2.0,
  Lambda: 1.5,
  ECS: 1.5,
  SQS: 1.2,
  SNS: 1.2,
  APIGateway: 1.2,
  StepFunctions: 1.0,
  EventBridge: 1.0,
  S3Bucket: 0.8,
  CloudFront: 0.8,
  VPC: 0.5,
  Subnet: 0.5,
  SecurityGroup: 0.5,
}

export function calcBlastScore(
  hops: number,
  resourceType: ResourceType,
  trafficVolume?: number
): number {
  const typeMult = RESOURCE_TYPE_MULTIPLIERS[resourceType] ?? 1.0
  let trafficMult = 1.0
  if (trafficVolume !== undefined) {
    if (trafficVolume > 1000) trafficMult = 1.5
    else if (trafficVolume > 100) trafficMult = 1.2
    else if (trafficVolume < 10) trafficMult = 0.8
  }
  return Math.min(1.0, (1.0 / hops) * typeMult * trafficMult)
}

export function scoreToSeverity(score: number): BlastSeverity {
  if (score >= 0.8) return 'critical'
  if (score >= 0.5) return 'degraded'
  if (score >= 0.2) return 'at-risk'
  return 'monitoring'
}
