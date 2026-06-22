import {
  ElasticLoadBalancingV2Client,
  DescribeLoadBalancersCommand,
  DescribeTargetGroupsCommand,
  DescribeTargetHealthCommand,
  type LoadBalancer,
} from '@aws-sdk/client-elastic-load-balancing-v2'
import type { GraphNode, GraphEdge } from '@liveinfra/shared'
import type { ServiceScanParams } from '../types.js'

function makeEdgeId(source: string, target: string, type: string): string {
  return `${source}__${target}__${type}`
}

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

    // Edges: LB → each Subnet (MEMBER_OF)
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

    // Edges: ALB → SecurityGroups (MEMBER_OF)
    // NLBs don't have security groups — this field is only set for ALBs
    for (const sgId of lb.SecurityGroups ?? []) {
      const sgArn = `arn:aws:ec2:${region}:${accountId}:security-group/${sgId}`
      edges.push({
        id: makeEdgeId(lbArn, sgArn, 'MEMBER_OF'),
        source: lbArn,
        target: sgArn,
        type: 'MEMBER_OF',
        properties: { createdAt: now },
      })
    }

    // Edges: LB → EC2 instances via target groups (DEPENDS_ON)
    // This is the key dependency edge: ALB depends on its backend EC2 targets.
    try {
      const tgsRes = await elbv2.send(
        new DescribeTargetGroupsCommand({ LoadBalancerArn: lbArn })
      )
      for (const tg of tgsRes.TargetGroups ?? []) {
        if (!tg.TargetGroupArn) continue

        const healthRes = await elbv2.send(
          new DescribeTargetHealthCommand({ TargetGroupArn: tg.TargetGroupArn })
        )
        for (const desc of healthRes.TargetHealthDescriptions ?? []) {
          const targetId = desc.Target?.Id
          if (!targetId) continue

          // EC2 instance targets have IDs like "i-0abc123def456"
          if (targetId.startsWith('i-')) {
            const ec2Arn = `arn:aws:ec2:${region}:${accountId}:instance/${targetId}`
            edges.push({
              id: makeEdgeId(lbArn, ec2Arn, 'DEPENDS_ON'),
              source: lbArn,
              target: ec2Arn,
              type: 'DEPENDS_ON',
              properties: {
                createdAt: now,
                edgeType: `target-group:${desc.TargetHealth?.State ?? 'unknown'}`,
              },
            })
          }
        }
      }
    } catch {
      // DescribeTargetGroups can fail if lb has no target groups — not an error
    }
  }

  return { nodes, edges }
}
