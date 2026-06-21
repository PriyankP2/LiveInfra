// ─── AI RCA Schema ────────────────────────────────────────────────────────────
// Mirrors the tool_use output schema forced from Claude

export type RcaSeverity = 'critical' | 'high' | 'medium' | 'low'
export type RcaStatus = 'pending' | 'streaming' | 'complete' | 'error'
export type IncidentSource = 'pagerduty' | 'opsgenie' | 'cloudwatch' | 'manual'

export type EvidenceType =
  | 'cloudtrail_event'
  | 'flow_log_anomaly'
  | 'graph_relationship'
  | 'metric'

export interface RcaEvidence {
  type: EvidenceType
  description: string
  timestamp?: string
  rawDataRef?: string   // ID linking to the source record in PostgreSQL
}

export interface AffectedService {
  arn: string
  impact: 'down' | 'degraded' | 'at_risk'
  reason: string
}

export interface RemediationStep {
  step: number
  action: string
  rationale: string
  estimatedImpact: string
}

export interface RcaOutput {
  rootCause: string
  confidence: number          // 0.0–1.0
  severity: RcaSeverity
  evidence: RcaEvidence[]
  whatIDontKnow: string[]
  affectedServices: AffectedService[]
  remediation: RemediationStep[]
}

export interface RcaRecord {
  id: string
  customerId: string
  incidentId?: string
  resourceArn: string
  status: RcaStatus
  output?: RcaOutput
  inputTokens?: number
  outputTokens?: number
  latencyMs?: number
  errorMessage?: string
  startedAt: string
  completedAt?: string
}

// ─── Incident ─────────────────────────────────────────────────────────────────

export interface Incident {
  id: string
  customerId: string
  source: IncidentSource
  sourceIncidentId?: string
  title: string
  severity?: RcaSeverity
  resourceArn?: string
  resourceId?: string         // Neo4j node id
  status: 'open' | 'analyzing' | 'resolved' | 'error'
  triggeredAt: string
  resolvedAt?: string
}
