import {
  ECSClient,
  ListClustersCommand,
  DescribeClustersCommand,
  ListServicesCommand,
  DescribeServicesCommand,
} from '@aws-sdk/client-ecs'
import type { GraphNode, GraphEdge } from '@liveinfra/shared'
import type { ServiceScanParams } from '../types.js'

function makeEdgeId(source: string, target: string, type: string): string {
  return `${source}__${target}__${type}`
}

/** Split an array into chunks of at most `size` elements. */
function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size))
  }
  return chunks
}

/** Paginate ListClusters and return all cluster ARNs. */
async function listAllClusterArns(ecs: ECSClient): Promise<string[]> {
  const arns: string[] = []
  let token: string | undefined
  do {
    // Each iteration assigns a fresh const — no circularity for tsc
    const page = await ecs.send(new ListClustersCommand({ nextToken: token }))
    arns.push(...(page.clusterArns ?? []))
    token = page.nextToken
  } while (token !== undefined)
  return arns
}

/** Paginate ListServices for a cluster and return all service ARNs. */
async function listAllServiceArns(ecs: ECSClient, clusterArn: string): Promise<string[]> {
  const arns: string[] = []
  let token: string | undefined
  do {
    const page = await ecs.send(
      new ListServicesCommand({ cluster: clusterArn, nextToken: token })
    )
    arns.push(...(page.serviceArns ?? []))
    token = page.nextToken
  } while (token !== undefined)
  return arns
}

export async function scanECS(
  params: ServiceScanParams
): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }> {
  const { credentials, accountId, customerId, region } = params

  const ecs = new ECSClient({
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

  // ── Collect all cluster ARNs via pagination ───────────────────────────────
  const allClusterArns = await listAllClusterArns(ecs)

  if (allClusterArns.length === 0) {
    return { nodes, edges }
  }

  // ── Describe clusters in batches of 100 (AWS hard limit) ─────────────────
  for (const clusterBatch of chunk(allClusterArns, 100)) {
    const descRes = await ecs.send(
      new DescribeClustersCommand({ clusters: clusterBatch })
    )

    for (const cluster of descRes.clusters ?? []) {
      if (!cluster.clusterArn || !cluster.clusterName) continue

      const clusterArn = cluster.clusterArn

      nodes.push({
        id: clusterArn,
        type: 'ECS',
        name: cluster.clusterName,
        accountId,
        region,
        customerId,
        lastSeen: now,
        tags: {},
        properties: {
          status: cluster.status ?? null,
          activeServicesCount: cluster.activeServicesCount ?? null,
          runningTasksCount: cluster.runningTasksCount ?? null,
        },
      })

      // ── Collect all service ARNs for this cluster ──────────────────────
      const allServiceArns = await listAllServiceArns(ecs, clusterArn)

      // ── Describe services in batches of 10 (AWS hard limit) ─────────────
      for (const serviceBatch of chunk(allServiceArns, 10)) {
        const descSvcRes = await ecs.send(
          new DescribeServicesCommand({
            cluster: clusterArn,
            services: serviceBatch,
          })
        )

        for (const service of descSvcRes.services ?? []) {
          if (!service.serviceArn || !service.serviceName) continue

          const serviceArn = service.serviceArn

          nodes.push({
            id: serviceArn,
            type: 'ECS',
            name: service.serviceName,
            accountId,
            region,
            customerId,
            lastSeen: now,
            tags: {},
            properties: {
              status: service.status ?? null,
              desiredCount: service.desiredCount ?? null,
              runningCount: service.runningCount ?? null,
              launchType: service.launchType ?? null,
            },
          })

          // Edge: service → cluster (MEMBER_OF)
          edges.push({
            id: makeEdgeId(serviceArn, clusterArn, 'MEMBER_OF'),
            source: serviceArn,
            target: clusterArn,
            type: 'MEMBER_OF',
            properties: { createdAt: now },
          })

          const awsVpc = service.networkConfiguration?.awsvpcConfiguration

          // Edges: service → subnets (MEMBER_OF)
          for (const subnetId of awsVpc?.subnets ?? []) {
            const subnetArn = `arn:aws:ec2:${region}:${accountId}:subnet/${subnetId}`
            edges.push({
              id: makeEdgeId(serviceArn, subnetArn, 'MEMBER_OF'),
              source: serviceArn,
              target: subnetArn,
              type: 'MEMBER_OF',
              properties: { createdAt: now },
            })
          }

          // Edges: service → security groups (MEMBER_OF)
          for (const sgId of awsVpc?.securityGroups ?? []) {
            const sgArn = `arn:aws:ec2:${region}:${accountId}:security-group/${sgId}`
            edges.push({
              id: makeEdgeId(serviceArn, sgArn, 'MEMBER_OF'),
              source: serviceArn,
              target: sgArn,
              type: 'MEMBER_OF',
              properties: { createdAt: now },
            })
          }
        }
      }
    }
  }

  return { nodes, edges }
}
