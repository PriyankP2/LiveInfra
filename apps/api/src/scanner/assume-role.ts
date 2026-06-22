import { STSClient, AssumeRoleCommand } from '@aws-sdk/client-sts'
import type { AWSCredentials } from './types.js'

export async function assumeRole(
  roleArn: string,
  externalId: string,
  sessionName = 'LiveInfraScan'
): Promise<AWSCredentials> {
  // STS is a global service but the endpoint is regional for latency.
  // Default us-east-1 works everywhere; override with STS_REGION env var.
  const sts = new STSClient({ region: process.env['STS_REGION'] ?? 'us-east-1' })

  const res = await sts.send(
    new AssumeRoleCommand({
      RoleArn: roleArn,
      RoleSessionName: sessionName,
      ExternalId: externalId,
      DurationSeconds: 3600,
    })
  )

  const creds = res.Credentials
  if (!creds?.AccessKeyId || !creds.SecretAccessKey || !creds.SessionToken) {
    throw new Error(`STS AssumeRole failed for ${roleArn}: missing credentials in response`)
  }

  return {
    accessKeyId: creds.AccessKeyId,
    secretAccessKey: creds.SecretAccessKey,
    sessionToken: creds.SessionToken,
  }
}
