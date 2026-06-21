// ─── Scanner / AWS Account ────────────────────────────────────────────────────

export type AccountStatus = 'pending' | 'active' | 'error' | 'disconnected'

export interface AwsAccount {
  id: string
  customerId: string
  accountId: string       // 12-digit AWS account number
  accountAlias?: string
  roleArn: string
  externalId: string
  regions: string[]
  status: AccountStatus
  lastScanAt?: string
  lastScanDurationSec?: number
  lastScanResourceCount?: number
  lastError?: string
}

export type JobName =
  | 'full-scan'
  | 'event-scan'
  | 'flow-log-parse'
  | 'eni-cache-refresh'
  | 'snapshot-write'
  | 'pruning'
  | 'rca-trigger'

export interface ScanJob {
  name: JobName
  customerId: string
  awsAccountId: string
  triggeredBy: 'cron' | 'webhook' | 'manual'
  startedAt: string
  completedAt?: string
  resourcesScanned?: number
  error?: string
}

// ─── Filter State ─────────────────────────────────────────────────────────────
// In-memory filter applied to graph on the frontend

export interface TagFilter {
  key: string
  value: string
}

export interface GraphFilterState {
  tags: TagFilter[]
  resourceTypes: string[]
  regions: string[]
  vpcIds: string[]
  searchQuery: string
}

export const EMPTY_FILTER: GraphFilterState = {
  tags: [],
  resourceTypes: [],
  regions: [],
  vpcIds: [],
  searchQuery: '',
}

export function isFilterActive(f: GraphFilterState): boolean {
  return (
    f.tags.length > 0 ||
    f.resourceTypes.length > 0 ||
    f.regions.length > 0 ||
    f.vpcIds.length > 0 ||
    f.searchQuery.length > 0
  )
}
