# AI RCA Pipeline

See also: [diagrams/ai-rca-pipeline.svg](../diagrams/ai-rca-pipeline.svg)

## Overview

End-to-end latency target: **<8 seconds** from alert webhook to first token rendered in browser.

Cost per RCA call: **~$0.01–0.03** (claude-sonnet-4-6 at ~4K–8K input tokens, 2K output tokens).

---

## Stage 1: Trigger (0.0–0.1s)

**Input**: Webhook from PagerDuty, OpsGenie, or CloudWatch Alarm

**Processing**:
1. Parse webhook payload — extract alert title, resource name/ID, and timestamp
2. Fuzzy ARN resolver — alert titles use human names ("prod-api-db"), not ARNs. Resolver queries Neo4j for `customer_id` + name/tag match to find the canonical ARN
3. Validate: resource exists in graph, customer account is active

**Fuzzy ARN Resolver**:
```typescript
// Example: "prod-api-db" → "arn:aws:rds:us-east-1:123456789:db:prod-api-db"
const candidates = await neo4j.query(`
  MATCH (r:Resource {customer_id: $cid})
  WHERE r.name CONTAINS $query OR any(tag IN keys(r.tags) WHERE r.tags[tag] CONTAINS $query)
  RETURN r ORDER BY r.last_seen DESC LIMIT 5
`)
```

If no match: queue for human review, return `status: "resource_not_found"` to the webhook caller.

---

## Stage 2: Graph Context (0.1–0.2s)

**Query**: 3-hop neighborhood from the failing resource

```cypher
MATCH (source:Resource {id: $resource_id, customer_id: $customer_id})
OPTIONAL MATCH (source)<-[:DEPENDS_ON*1..3]-(upstream)
OPTIONAL MATCH (source)-[:DEPENDS_ON*1..3]->(downstream)
OPTIONAL MATCH (source)-[:MEMBER_OF]->(sg:SecurityGroup)
OPTIONAL MATCH (source)-[:PART_OF]->(vpc:VPC)
RETURN source, collect(DISTINCT upstream) AS upstreams, 
       collect(DISTINCT downstream) AS downstreams,
       collect(DISTINCT sg) AS security_groups,
       collect(DISTINCT vpc) AS vpcs
```

**Output**: JSON object with:
- `failing_resource`: Full node properties
- `upstream_services`: Services that call the failing resource (these are already broken)
- `downstream_services`: Services the failing resource calls (these may be causing the failure)
- `network_context`: VPC, subnet, security group memberships

---

## Stage 3: Temporal Context (0.2–0.5s)

Two parallel fetches:

**3a: PostgreSQL — CloudTrail events (last 24 hours)**
```sql
SELECT event_name, event_source, event_time, request_parameters, user_identity
FROM cloudtrail_events
WHERE resource_arn = $resource_arn
  AND customer_id = $customer_id
  AND event_time > NOW() - INTERVAL '24 hours'
ORDER BY event_time DESC
LIMIT 50
```

Filtered to high-signal event types:
- Config changes: `ModifyDBInstance`, `UpdateFunctionConfiguration`, `ModifyLoadBalancerAttributes`
- IAM changes: `AttachRolePolicy`, `PutBucketPolicy`
- Deployments: `RegisterTaskDefinition`, `UpdateService`, `CreateDeployment`
- Network: `AuthorizeSecurityGroupIngress`, `RevokeSecurityGroupIngress`, `ModifyVpcAttribute`

**3b: Upstash Redis — VPC Flow Log anomalies (last 2 hours)**
```
Key pattern: flow_anomalies:{customer_id}:{resource_id}:{window_start}
TTL: 2 hours
Value: {reject_count, accept_count, unique_dest_ips, bytes_transferred, timestamp}
```

Flow log anomaly signals:
- Sudden spike in REJECT decisions (security group / NACL blocking new traffic)
- Drop to zero accepted connections (resource unreachable)
- Traffic volume collapse (upstream stopped sending)
- New source IPs appearing (unexpected callers, possible security event)

---

## Stage 4: Prompt Construction (0.5–0.6s)

**Token budget**: 4,000–8,000 input tokens. Stay within claude-sonnet-4-6 efficient range.

**System prompt** (cached across all RCA calls for the same customer):
```xml
<system>
You are an expert AWS SRE performing root cause analysis. You have access to:
- Live dependency graph showing which services depend on the failing resource
- CloudTrail events from the last 24 hours for the failing resource
- VPC Flow Log anomalies from the last 2 hours

Rules:
1. Base your conclusion ONLY on the provided evidence
2. Include ALL evidence used in the evidence[] array
3. If data is insufficient, say so in what_i_dont_know
4. Confidence must reflect genuine uncertainty — do not claim 0.9 if you're uncertain
5. Prioritize the most recent changes as likely root causes

Output format: structured JSON matching the RCA schema exactly.
</system>
```

**User prompt structure** (XML context injection):
```xml
<incident>
  <timestamp>2024-01-15T02:34:00Z</timestamp>
  <alert_title>RDS prod-api-db - CPU 99% - Connection count 500/500</alert_title>
</incident>

<failing_resource>
  <arn>arn:aws:rds:us-east-1:123456789:db:prod-api-db</arn>
  <type>RDS</type>
  <engine>postgres-15.3</engine>
  <instance_class>db.t3.medium</instance_class>
  <max_connections>500</max_connections>
</failing_resource>

<dependency_graph>
  <upstream_services count="47">
    <service arn="..." type="Lambda" name="api-handler" traffic_volume="320 req/s" hops="1"/>
    <service arn="..." type="Lambda" name="auth-validator" traffic_volume="180 req/s" hops="1"/>
    <!-- ... -->
  </upstream_services>
  <downstream_services count="0"/>
</dependency_graph>

<cloudtrail_events last_24h="3">
  <event time="2024-01-15T01:58:00Z" name="ModifyDBInstance" user="terraform-deploy-role">
    <change>max_connections changed from 500 to 500 (no change), instance_class changed from db.t3.large to db.t3.medium</change>
  </event>
  <!-- ... -->
</cloudtrail_events>

<flow_log_anomalies>
  <anomaly type="connection_spike" time="2024-01-15T02:30:00Z">
    accept_count: 12000 (prev window: 8200) — 46% increase
  </anomaly>
</flow_log_anomalies>
```

---

## Stage 5: Claude claude-sonnet-4-6 Streaming (0.6–4.5s)

**API call**:
```typescript
const stream = await anthropic.messages.stream({
  model: 'claude-sonnet-4-6',
  max_tokens: 2048,
  system: CACHED_SYSTEM_PROMPT,  // cache_control: ephemeral → 5-min cache
  messages: [{ role: 'user', content: userPrompt }],
  // Force structured output via tool use
  tools: [{ name: 'submit_rca', input_schema: RCA_JSON_SCHEMA }],
  tool_choice: { type: 'tool', name: 'submit_rca' }
})
```

**RCA Output Schema** (enforced via tool use):
```typescript
{
  root_cause: string,           // Plain-English statement of the primary failure
  confidence: number,           // 0.0–1.0
  severity: 'critical' | 'high' | 'medium' | 'low',
  evidence: Array<{
    type: 'cloudtrail_event' | 'flow_log_anomaly' | 'graph_relationship' | 'metric',
    description: string,
    timestamp?: string,
    raw_data_ref?: string        // Link to source record ID
  }>,
  what_i_dont_know: string[],   // Explicit gaps
  affected_services: Array<{
    arn: string,
    impact: 'down' | 'degraded' | 'at_risk',
    reason: string
  }>,
  remediation: Array<{
    step: number,
    action: string,
    rationale: string,
    estimated_impact: string
  }>
}
```

**Streaming**: Each `input_json_delta` event from the tool use stream is forwarded to Supabase Realtime as it arrives. The frontend renders the JSON progressively — root cause appears first (usually in the first 500ms of generation), evidence appears as the model generates it.

---

## Stage 6: Stream → UI (4.5–8.0s)

**Supabase Realtime channel**:
```typescript
// Server-side: push tokens as they arrive
const channel = supabase.channel(`rca:${incidentId}:${customerId}`)
await channel.send({
  type: 'broadcast',
  event: 'rca_token',
  payload: { token: delta.partial_json, accumulated: accumulated }
})
```

**Frontend subscription**:
```typescript
supabase.channel(`rca:${incidentId}:${customerId}`)
  .on('broadcast', { event: 'rca_token' }, ({ payload }) => {
    updateRcaPanel(payload.accumulated)  // Re-render as JSON accumulates
  })
  .subscribe()
```

**UI behavior**:
1. AI panel slides in anchored to failing node on graph (graph stays visible behind)
2. "Analyzing..." spinner with elapsed time
3. Root cause appears first (streaming renders partial JSON from `root_cause` field)
4. Evidence items appear one by one — each is clickable, opens raw CloudTrail event or flow log
5. Remediation steps appear last
6. Confidence score + `what_i_dont_know` displayed prominently (not hidden in footer)

**Persistence**: Full RCA result saved to PostgreSQL `rca_history` table after stream completes. Linked to incident by `incident_id`, `resource_arn`, `customer_id`.

---

## Error Handling

| Failure | Response |
|---|---|
| Claude API timeout (>10s) | Return partial results if >50% complete; otherwise `status: "ai_timeout"`, show manual checklist |
| Resource not in graph | `status: "resource_not_found"`, prompt to re-scan |
| No CloudTrail data | Proceed with graph context only; flag `what_i_dont_know: ["No CloudTrail events found — CloudTrail may be disabled or event not yet propagated"]` |
| Claude API error (5xx) | Retry once with 2s delay; surface error to user if retry fails |
| Malformed tool output | Retry with stricter prompt; if still malformed, return raw text with disclaimer |

---

## Cost Controls

- System prompt is cached (Anthropic prompt cache, 5-min TTL) — repeated RCA calls for same customer save ~60% of input token cost
- Max input tokens hard-capped at 8,192 (graph context truncated if necessary — keep most recent CloudTrail events, drop older ones)
- Rate limit: max 10 concurrent RCA calls per customer per minute (Upstash Redis counter)
- Monthly cap configurable per tier — Starter: 50 calls/mo, Growth: 500 calls/mo, Enterprise: unlimited
