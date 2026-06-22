import {
  ElasticLoadBalancingV2Client,
  DescribeLoadBalancersCommand,
  type LoadBalancer,
} from '@aws-sdk/client-elastic-load-balancing-v2'
import type { GraphNode, GraphEdge } from '@liveinfra/shared'
import type { ServiceScanParams } from '../types.js'

function makeEdgeId(source: string, target: string, type: string): string {
  return `${source}__${target}__${type}`
}

/** Paginate DescribeLoadBalancers and return all load balancer objects. */
async function listAllLoadBalancers(client: ElasticLoadBalancingV2Client): Promise<LoadBalancer[]> {
  const lbs: LoadBalancer[] = []
  let marker: string | undefined
  do {
    const page = await client.send(new DescribeLoadBalancersCommand({ Marker: marker }))
    lbs.push(...(page.LoadBalancers ?? []))
    marker = page.NextMarker
  } while (marker !== undefined)
  return lbs
}

export async function scanELB(
  params: ServiceScanParams
): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }> {
  const { credentials, accountId, customerId, region } = params

  const elbv2 = new ElasticLoadBalancingV2Client({
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

  const loadBalancers = await listAllLoadBalancers(elbv2)

  for (const lb of loadBalancers) {
    if (!lb.LoadBalancerArn || !lb.LoadBalancerName) continue

    const lbArn = lb.LoadBalancerArn
    // ELBv2 type field is 'application' | 'network' | 'gateway'
    const lbType = lb.Type === 'application' ? 'ALB' : 'NLB'

    nodes.push({
      id: lbArn,
      type: lbType,
      name: lb.LoadBalancerName,
      accountId,
      region,
      customerId,
      lastSeen: now,
      tags: {},
      properties: {
        scheme: lb.Scheme ?? null,
        state: lb.State?.Code ?? null,
        dnsName: lb.DNSName ?? null,
      },
    })

    // Edge: LB → VPC (DEPLOYED_IN)
    if (lb.VpcId) {
      const vpcArn = `arn:aws:ec2:${region}:${accountId}:vpc/${lb.VpcId}`
      edges.push({
        id: makeEdgeId(lbArn, vpcArn, 'DEPLOYED_IN'),
        source: lbArn,
        target: vpcArn,
        type: 'DEPLOYED_IN',
        properties: { createdAt: now },
      })
    }

    // Edges: LB → each Subnet in its availability zones (MEMBER_OF)
    for (const az of lb.AvailabilityZones ?? []) {
      if (!az.SubnetId) continue
      const subnetArn = `arn:aws:ec2:${region}:${accountId}:subnet/${az.SubnetId}`
      edges.push({
        id: makeEdgeId(lbArn, subnetArn, 'MEMBER_OF'),
        source: lbArn,
        target: subnetArn,
        type: 'MEMBER_OF',
        properties: { createdAt: now },
      })
    }
  }

  return { nodes, edges }
}
