import {
  EC2Client,
  DescribeInstancesCommand,
  DescribeVpcsCommand,
  DescribeSubnetsCommand,
  DescribeSecurityGroupsCommand,
  type Tag,
} from '@aws-sdk/client-ec2'
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

function getTagName(tags: Record<string, string>, fallback: string): string {
  return tags['Name'] ?? fallback
}

function makeEdgeId(source: string, target: string, type: string): string {
  return `${source}__${target}__${type}`
}

// ── Scanner ───────────────────────────────────────────────────────────────────

export async function scanEC2(
  params: ServiceScanParams
): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }> {
  const { credentials, accountId, customerId, region } = params

  const ec2 = new EC2Client({
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

  // ── VPCs ──────────────────────────────────────────────────────────────────
  const vpcsRes = await ec2.send(new DescribeVpcsCommand({}))
  const vpcNodes: GraphNode[] = []

  for (const vpc of vpcsRes.Vpcs ?? []) {
    if (!vpc.VpcId) continue
    const vpcArn = `arn:aws:ec2:${region}:${accountId}:vpc/${vpc.VpcId}`
    const tags = extractTags(vpc.Tags)
    const vpcNode: GraphNode = {
      id: vpcArn,
      type: 'VPC',
      name: getTagName(tags, vpc.VpcId),
      accountId,
      region,
      customerId,
      lastSeen: now,
      tags,
      properties: {
        cidrBlock: vpc.CidrBlock ?? null,
        isDefault: vpc.IsDefault ?? false,
      },
    }
    vpcNodes.push(vpcNode)
    nodes.push(vpcNode)
  }

  // ── Subnets ───────────────────────────────────────────────────────────────
  const subnetsRes = await ec2.send(new DescribeSubnetsCommand({}))
  const subnetNodes: GraphNode[] = []

  for (const subnet of subnetsRes.Subnets ?? []) {
    if (!subnet.SubnetId) continue
    const subnetArn = `arn:aws:ec2:${region}:${accountId}:subnet/${subnet.SubnetId}`
    const tags = extractTags(subnet.Tags)
    const subnetNode: GraphNode = {
      id: subnetArn,
      type: 'Subnet',
      name: getTagName(tags, subnet.SubnetId),
      accountId,
      region,
      customerId,
      lastSeen: now,
      tags,
      properties: {
        cidrBlock: subnet.CidrBlock ?? null,
        availabilityZone: subnet.AvailabilityZone ?? null,
        availableIpCount: subnet.AvailableIpAddressCount ?? null,
      },
    }
    subnetNodes.push(subnetNode)
    nodes.push(subnetNode)

    // Edge: Subnet → VPC (PART_OF)
    if (subnet.VpcId) {
      const vpcArn = `arn:aws:ec2:${region}:${accountId}:vpc/${subnet.VpcId}`
      edges.push({
        id: makeEdgeId(subnetArn, vpcArn, 'PART_OF'),
        source: subnetArn,
        target: vpcArn,
        type: 'PART_OF',
        properties: { createdAt: now },
      })
    }
  }

  // ── Security Groups ───────────────────────────────────────────────────────
  const sgsRes = await ec2.send(new DescribeSecurityGroupsCommand({}))
  const sgNodes: GraphNode[] = []

  for (const sg of sgsRes.SecurityGroups ?? []) {
    if (!sg.GroupId) continue
    const sgArn = `arn:aws:ec2:${region}:${accountId}:security-group/${sg.GroupId}`
    const tags = extractTags(sg.Tags)
    const sgNode: GraphNode = {
      id: sgArn,
      type: 'SecurityGroup',
      name: getTagName(tags, sg.GroupId),
      accountId,
      region,
      customerId,
      lastSeen: now,
      tags,
      properties: {
        groupName: sg.GroupName ?? null,
        description: sg.Description ?? null,
        vpcId: sg.VpcId ?? null,
      },
    }
    sgNodes.push(sgNode)
    nodes.push(sgNode)

    // Edge: SecurityGroup → VPC (PART_OF)
    // Anchors each SG to its VPC so they're connected in the graph topology
    if (sg.VpcId) {
      const vpcArn = `arn:aws:ec2:${region}:${accountId}:vpc/${sg.VpcId}`
      edges.push({
        id: makeEdgeId(sgArn, vpcArn, 'PART_OF'),
        source: sgArn,
        target: vpcArn,
        type: 'PART_OF',
        properties: { createdAt: now },
      })
    }
  }

  // ── EC2 Instances ─────────────────────────────────────────────────────────
  const instancesRes = await ec2.send(new DescribeInstancesCommand({}))

  for (const reservation of instancesRes.Reservations ?? []) {
    for (const instance of reservation.Instances ?? []) {
      if (!instance.InstanceId) continue

      const instanceId = instance.InstanceId
      const ec2Arn = `arn:aws:ec2:${region}:${accountId}:instance/${instanceId}`
      const tags = extractTags(instance.Tags)

      const ec2Node: GraphNode = {
        id: ec2Arn,
        type: 'EC2',
        name: getTagName(tags, instanceId),
        accountId,
        region,
        customerId,
        lastSeen: now,
        tags,
        properties: {
          state: instance.State?.Name ?? null,
          instanceType: instance.InstanceType ?? null,
          privateIp: instance.PrivateIpAddress ?? null,
          publicIp: instance.PublicIpAddress ?? null,
        },
      }
      nodes.push(ec2Node)

      // Edge: EC2 → VPC (DEPLOYED_IN)
      if (instance.VpcId) {
        const vpcArn = `arn:aws:ec2:${region}:${accountId}:vpc/${instance.VpcId}`
        edges.push({
          id: makeEdgeId(ec2Arn, vpcArn, 'DEPLOYED_IN'),
          source: ec2Arn,
          target: vpcArn,
          type: 'DEPLOYED_IN',
          properties: { createdAt: now },
        })
      }

      // Edge: EC2 → Subnet (MEMBER_OF)
      if (instance.SubnetId) {
        const subnetArn = `arn:aws:ec2:${region}:${accountId}:subnet/${instance.SubnetId}`
        edges.push({
          id: makeEdgeId(ec2Arn, subnetArn, 'MEMBER_OF'),
          source: ec2Arn,
          target: subnetArn,
          type: 'MEMBER_OF',
          properties: { createdAt: now },
        })
      }

      // Edges: EC2 → SecurityGroup (MEMBER_OF)
      for (const sgRef of instance.SecurityGroups ?? []) {
        if (!sgRef.GroupId) continue
        const sgArn = `arn:aws:ec2:${region}:${accountId}:security-group/${sgRef.GroupId}`
        edges.push({
          id: makeEdgeId(ec2Arn, sgArn, 'MEMBER_OF'),
          source: ec2Arn,
          target: sgArn,
          type: 'MEMBER_OF',
          properties: { createdAt: now },
        })
      }
    }
  }

  // Suppress unused-variable warnings for the intermediate arrays — they are
  // already pushed into `nodes`; the variables exist for readability.
  void vpcNodes
  void subnetNodes
  void sgNodes

  return { nodes, edges }
}
