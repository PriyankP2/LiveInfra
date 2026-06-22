export interface AWSCredentials {
  accessKeyId: string
  secretAccessKey: string
  sessionToken: string
}

export interface ServiceScanParams {
  credentials: AWSCredentials
  accountId: string
  customerId: string
  region: string
}

export interface ScanJobInput {
  customerId: string
  accountId: string
  roleArn: string
  externalId: string
  regions: string[]
}

export interface ScanRegionResult {
  region: string
  nodeCount: number
  edgeCount: number
  errors: string[]
}

export interface ScanResult {
  customerId: string
  accountId: string
  startedAt: string
  completedAt: string
  totalNodes: number
  totalEdges: number
  regions: ScanRegionResult[]
  status: 'success' | 'partial' | 'failed'
}
