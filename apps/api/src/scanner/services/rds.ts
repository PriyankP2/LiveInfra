import {
  RDSClient,
  DescribeDBInstancesCommand,
  DescribeDBClustersCommand,
  type Tag,
} from '@aws-sdk/client-rds'
import type { GraphNode, GraphEdge } from '@liveinfra/shared'
import type { ServiceScanParams } from '../types.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractTags(awsTags: Tag[] | undefined): Record<string, string> {
  if (!awsTags) return {}
  return Object.fromEntries(
    awsTags
      .filter((t): t is Tag & { Key: string; Value: string } =>
        typeof t.Key === 'string' && typeof t.Value === 'string'
      )
      .map((t) => [t.Key, t.Value])
  )
}

function makeEdgeId(source: string, target: string, type: string): string {
  return `${source}__${target}__${type}`
}

// ── Scanner ───────────────────────────────────────────────────────────────────

export async function scanRDS(
  params: ServiceScanParams
): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }> {
  const { credentials, accountId, customerId, region } = params

  const rds = new RDSClient({
    region,
    credentials: {
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
      sessionToken: credentials.sessionToken,
    },
  })

  const now = new Date().toISOString()
  const nodes: GraphNode[] = []
  const edges: GraphEdge[] = []

  // ── DB Clusters ───────────────────────────────────────────────────────────
  const clustersRes = await rds.send(new DescribeDBClustersCommand({}))
  const clusterArnMap = new Map<string, string>() // clusterIdentifier → clusterArn

  for (const cluster of clustersRes.DBClusters ?? []) {
    if (!cluster.DBClusterArn || !cluster.DBClusterIdentifier) continue

    const clusterArn = cluster.DBClusterArn
    clusterArnMap.set(cluster.DBClusterIdentifier, clusterArn)

    const tags = extractTags(cluster.TagList)

    nodes.push({
      id: clusterArn,
      type: 'RDS',
      name: cluster.DBClusterIdentifier,
      accountId,
      region,
      customerId,
      lastSeen: now,
      tags,
      properties: {
        isCluster: true,
        engine: cluster.Engine ?? null,
        engineVersion: cluster.EngineVersion ?? null,
        status: cluster.Status ?? null,
        endpoint: cluster.Endpoint ?? null,
        port: cluster.Port ?? null,
        multiAZ: cluster.MultiAZ ?? false,
      },
    })
  }

  // ── DB Instances ──────────────────────────────────────────────────────────
  const instancesRes = await rds.send(new DescribeDBInstancesCommand({}))

  for (const dbInstance of instancesRes.DBInstances ?? []) {
    if (!dbInstance.DBInstanceArn || !dbInstance.DBInstanceIdentifier) continue

    const instanceArn = dbInstance.DBInstanceArn
    const tags = extractTags(dbInstance.TagList)

    const endpointStr =
      dbInstance.Endpoint?.Address && dbInstance.Endpoint?.Port
        ? `${dbInstance.Endpoint.Address}:${dbInstance.Endpoint.Port}`
        : null

    nodes.push({
      id: instanceArn,
      type: 'RDS',
      name: dbInstance.DBInstanceIdentifier,
      accountId,
      region,
      customerId,
      lastSeen: now,
      tags,
      properties: {
        isCluster: false,
        engine: dbInstance.Engine ?? null,
        engineVersion: dbInstance.EngineVersion ?? null,
        dbInstanceClass: dbInstance.DBInstanceClass ?? null,
        status: dbInstance.DBInstanceStatus ?? null,
        multiAZ: dbInstance.MultiAZ ?? false,
        endpoint: endpointStr,
      },
    })

    // Edge: DB instance → VPC (DEPLOYED_IN)
    const vpcId = dbInstance.DBSubnetGroup?.VpcId
    if (vpcId) {
      const vpcArn = `arn:aws:ec2:${region}:${accountId}:vpc/${vpcId}`
      edges.push({
        id: makeEdgeId(instanceArn, vpcArn, 'DEPLOYED_IN'),
        source: instanceArn,
        target: vpcArn,
        type: 'DEPLOYED_IN',
        properties: { createdAt: now },
      })
    }

    // Edge: DB instance → cluster (MEMBER_OF)
    if (dbInstance.DBClusterIdentifier) {
      const clusterArn = clusterArnMap.get(dbInstance.DBClusterIdentifier)
      if (clusterArn) {
        edges.push({
          id: makeEdgeId(instanceArn, clusterArn, 'MEMBER_OF'),
          source: instanceArn,
          target: clusterArn,
          type: 'MEMBER_OF',
          properties: { createdAt: now },
        })
      }
    }
  }

  return { nodes, edges }
}
