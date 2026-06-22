import {
  LambdaClient,
  ListFunctionsCommand,
  type FunctionConfiguration,
} from '@aws-sdk/client-lambda'
import type { GraphNode, GraphEdge } from '@liveinfra/shared'
import type { ServiceScanParams } from '../types.js'

function makeEdgeId(source: string, target: string, type: string): string {
  return `${source}__${target}__${type}`
}

/** Paginate ListFunctions and return all function configurations. */
async function listAllFunctions(lambda: LambdaClient): Promise<FunctionConfiguration[]> {
  const fns: FunctionConfiguration[] = []
  let marker: string | undefined
  do {
    const page = await lambda.send(
      new ListFunctionsCommand({ Marker: marker, MaxItems: 50 })
    )
    fns.push(...(page.Functions ?? []))
    marker = page.NextMarker
  } while (marker !== undefined)
  return fns
}

export async function scanLambda(
  params: ServiceScanParams
): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }> {
  const { credentials, accountId, customerId, region } = params

  const lambda = new LambdaClient({
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

  const functions = await listAllFunctions(lambda)

  for (const fn of functions) {
    if (!fn.FunctionArn || !fn.FunctionName) continue

    const fnArn = fn.FunctionArn

    nodes.push({
      id: fnArn,
      type: 'Lambda',
      name: fn.FunctionName,
      accountId,
      region,
      customerId,
      lastSeen: now,
      tags: {},
      properties: {
        runtime: fn.Runtime ?? null,
        handler: fn.Handler ?? null,
        memorySize: fn.MemorySize ?? null,
        timeout: fn.Timeout ?? null,
        role: fn.Role ?? null,
        state: fn.State ?? null,
      },
    })

    // Edge: Lambda → VPC (DEPLOYED_IN)
    const vpcId = fn.VpcConfig?.VpcId
    if (vpcId) {
      const vpcArn = `arn:aws:ec2:${region}:${accountId}:vpc/${vpcId}`
      edges.push({
        id: makeEdgeId(fnArn, vpcArn, 'DEPLOYED_IN'),
        source: fnArn,
        target: vpcArn,
        type: 'DEPLOYED_IN',
        properties: { createdAt: now },
      })
    }

    // Edges: Lambda → each Subnet (MEMBER_OF)
    for (const subnetId of fn.VpcConfig?.SubnetIds ?? []) {
      const subnetArn = `arn:aws:ec2:${region}:${accountId}:subnet/${subnetId}`
      edges.push({
        id: makeEdgeId(fnArn, subnetArn, 'MEMBER_OF'),
        source: fnArn,
        target: subnetArn,
        type: 'MEMBER_OF',
        properties: { createdAt: now },
      })
    }

    // Edges: Lambda → each SecurityGroup (MEMBER_OF)
    for (const sgId of fn.VpcConfig?.SecurityGroupIds ?? []) {
      const sgArn = `arn:aws:ec2:${region}:${accountId}:security-group/${sgId}`
      edges.push({
        id: makeEdgeId(fnArn, sgArn, 'MEMBER_OF'),
        source: fnArn,
        target: sgArn,
        type: 'MEMBER_OF',
        properties: { createdAt: now },
      })
    }
  }

  return { nodes, edges }
}
