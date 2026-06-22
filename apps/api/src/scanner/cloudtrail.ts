import { CloudTrailClient, LookupEventsCommand, type Event } from '@aws-sdk/client-cloudtrail'

export interface CloudTrailEvent {
  eventTime: string          // ISO string
  eventName: string          // e.g. "TerminateInstances"
  eventSource: string        // e.g. "ec2.amazonaws.com"
  username: string           // IAM user or role that triggered it
  errorCode?: string         // e.g. "AccessDenied"
  errorMessage?: string
  resourceName?: string
  requestParameters?: string // truncated JSON
}

export interface CloudTrailSummary {
  resourceId: string
  resourceType: string
  lookbackHours: number
  events: CloudTrailEvent[]
  errorEvents: CloudTrailEvent[]   // events with errorCode set
  recentChanges: CloudTrailEvent[] // Modify*/Delete*/Create* events in last 2h
  fetchedAt: string
  fetchError?: string
}

/** Extract the resource lookup name from an ARN or raw resource ID. */
function extractResourceName(resourceIdOrArn: string, resourceType: string): string {
  // If it's an ARN, extract the last segment after ':'
  if (resourceIdOrArn.startsWith('arn:')) {
    const segments = resourceIdOrArn.split(':')
    // noUncheckedIndexedAccess: last element may be undefined (empty array) — guard with ??
    const last = segments[segments.length - 1] ?? resourceIdOrArn
    // For Lambda ARNs the resource portion is "function:name" — take the last '/' or ':' segment
    if (last.includes('/')) return last.split('/').pop() ?? last
    return last
  }

  // EC2 instances: i-* — use as-is
  // RDS: use the DB identifier directly
  // ALB/NLB: use the name portion
  // Default: use as-is
  switch (resourceType.toUpperCase()) {
    case 'LAMBDA':
      // Could be a bare function name already
      return resourceIdOrArn.includes('/') ? (resourceIdOrArn.split('/').pop() ?? resourceIdOrArn) : resourceIdOrArn
    default:
      return resourceIdOrArn
  }
}

/** Map a raw CloudTrail SDK Event to our CloudTrailEvent shape. */
function mapEvent(raw: Event): CloudTrailEvent {
  // CloudTrail embeds the full event JSON inside CloudTrailEvent.CloudTrailEvent (string field)
  let errorCode: string | undefined
  let errorMessage: string | undefined
  let requestParameters: string | undefined

  if (raw.CloudTrailEvent) {
    try {
      const parsed = JSON.parse(raw.CloudTrailEvent) as Record<string, unknown>
      errorCode    = parsed['errorCode']    ? String(parsed['errorCode'])    : undefined
      errorMessage = parsed['errorMessage'] ? String(parsed['errorMessage']) : undefined
      if (parsed['requestParameters']) {
        const rp = JSON.stringify(parsed['requestParameters'])
        requestParameters = rp.length > 300 ? rp.slice(0, 300) + '…' : rp
      }
    } catch {
      // Ignore parse errors — CloudTrailEvent is best-effort
    }
  }

  return {
    eventTime:  raw.EventTime?.toISOString() ?? new Date(0).toISOString(),
    eventName:  raw.EventName ?? 'Unknown',
    eventSource: raw.EventSource ?? 'unknown',
    username:   raw.Username ?? 'unknown',
    // With exactOptionalPropertyTypes we must not assign undefined to optional fields —
    // spread conditionally so the key is absent rather than set to undefined.
    ...(errorCode       !== undefined ? { errorCode }                                              : {}),
    ...(errorMessage    !== undefined ? { errorMessage }                                           : {}),
    ...(raw.Resources?.[0]?.ResourceName !== undefined ? { resourceName: raw.Resources[0]!.ResourceName } : {}),
    ...(requestParameters !== undefined ? { requestParameters }                                    : {}),
  }
}

/** Fetch recent CloudTrail events for a specific AWS resource. */
export async function fetchCloudTrailEvents(params: {
  resourceId: string       // e.g. "i-0abc1234" or ARN
  resourceType: string     // e.g. "EC2", "RDS"
  region: string
  lookbackHours?: number   // default 24
  credentials: {
    accessKeyId: string
    secretAccessKey: string
    sessionToken?: string
  }
}): Promise<CloudTrailSummary> {
  const {
    resourceId,
    resourceType,
    region,
    lookbackHours = 24,
    credentials,
  } = params

  const fetchedAt = new Date().toISOString()

  const client = new CloudTrailClient({
    region,
    credentials: {
      accessKeyId:     credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
      // exactOptionalPropertyTypes: only include sessionToken when it is defined
      ...(credentials.sessionToken !== undefined ? { sessionToken: credentials.sessionToken } : {}),
    },
  })

  const resourceName = extractResourceName(resourceId, resourceType)
  const startTime    = new Date(Date.now() - lookbackHours * 3_600_000)
  const twoHoursAgo = new Date(Date.now() - 2 * 3_600_000)

  const recentChangesRegex = /^(Create|Modify|Update|Delete|Terminate|Stop|Start|Run|Put|Attach|Detach)/i

  try {
    const command = new LookupEventsCommand({
      LookupAttributes: [
        { AttributeKey: 'ResourceName', AttributeValue: resourceName },
      ],
      StartTime:  startTime,
      MaxResults: 50,
    })

    const response = await client.send(command)
    const rawEvents = response.Events ?? []

    const events = rawEvents.map(mapEvent)

    const errorEvents    = events.filter(e => !!e.errorCode)
    const recentChanges  = events.filter(
      e => recentChangesRegex.test(e.eventName) && new Date(e.eventTime) > twoHoursAgo
    )

    return {
      resourceId,
      resourceType,
      lookbackHours,
      events,
      errorEvents,
      recentChanges,
      fetchedAt,
    }
  } catch (err: unknown) {
    const fetchError = err instanceof Error ? err.message : String(err)
    return {
      resourceId,
      resourceType,
      lookbackHours,
      events:        [],
      errorEvents:   [],
      recentChanges: [],
      fetchedAt,
      fetchError,
    }
  }
}
