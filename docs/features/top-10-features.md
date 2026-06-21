# Top 10 Features Deep-Dive

Ranked by value delivered to an SRE during an active incident.

---

## Feature 1: Live Dependency Graph

**The core product.** Everything else is built on top of this.

**What it does**: Continuously scans the connected AWS account, builds a directed graph of all resource dependencies, and renders it as an interactive WebGL canvas at 60 FPS.

**Technical depth**:
- Source: AWS Config `SelectAggregateResourceConfig` (primary) + targeted SDK calls for unmapped relationships
- Refresh cadence: Full scan every 15 minutes; event-driven partial updates within 30 seconds of Config change notification
- Rendering: Sigma.js 3.x with WebGL backend — handles 10,000+ nodes without frame rate degradation
- Layout: Graphology ForceAtlas2 on initial load, then frozen to avoid disorienting re-layout on refresh
- Node stabilization: New nodes animate in, updated nodes pulse once, deleted nodes fade out over 2 seconds

**Why it's hard to copy**: Most tools either over-simplify (diagram tools) or show only metrics-adjacent topology (APM tools). Getting the actual dependency graph correct — especially for serverless relationships like Lambda event source mappings and EventBridge rule targets — requires scanner engineering that diagram tools haven't done.

---

## Feature 2: Blast Radius Visualization (Pre-Incident)

**The feature that creates "aha" moments in demos.** SREs immediately see use cases for deployment planning, maintenance windows, and capacity changes.

**What it does**: Click any node → the graph instantly highlights every downstream dependent service, color-coded by severity score, with hop-count labels.

**Severity scoring**:
```
score = clamp(
  (1.0 / hop_count) × resource_type_multiplier × traffic_volume_multiplier,
  0.0, 1.0
)
```
- Red (0.8–1.0): Will break immediately if this node fails
- Amber (0.5–0.79): Will degrade within minutes
- Yellow (0.2–0.49): Will be affected but may survive with retry logic
- Blue (0.0–0.19): Marginally affected, likely unnoticed

**Pre-incident use case**: "I'm taking prod-api-db offline at 2am for a storage upgrade. Show me the blast radius." → 47 Lambda functions highlighted, 3 in critical range. The SRE knows to pre-warm connection pools and set up a maintenance page before starting the work.

**Post-incident use case**: Alert fires. Blast radius activates automatically on the alerting resource. SRE sees the full cascade before touching anything — reducing remediation mistakes.

---

## Feature 3: AI RCA with Evidence Trail

**The killer feature for incident response.** RCA in <8 seconds with auditable evidence.

**What it does**: On alert trigger (PagerDuty, OpsGenie, or manual), synthesizes:
1. Graph context: 3-hop neighborhood of the failing resource
2. CloudTrail history: last 24 hours of changes to that resource
3. Flow log anomalies: last 2 hours of traffic patterns

Sends to Claude claude-sonnet-4-6 with a structured prompt → streams back a root cause analysis with evidence.

**Output fields** (all required, no exceptions):
- `root_cause`: Plain English statement
- `confidence`: 0.0–1.0 with honest uncertainty
- `evidence[]`: Every data point used, clickable to raw source
- `what_i_dont_know`: Explicit gaps in available data
- `remediation[]`: Ordered action steps with rationale

**The transparency contract**: Evidence items are clickable. Every claim in root_cause must be traceable to at least one evidence item. The model is instructed to include `what_i_dont_know` even when it's embarrassing — gaps in CloudTrail coverage, missing flow log data, and ambiguous signals are surfaced, not hidden.

---

## Feature 4: Spatial RCA Panel (Graph + AI Unified)

**The interaction model that differentiates LiveInfra from everything else.**

**What it does**: The AI RCA panel slides in from the right, overlaid on the graph. The graph remains fully interactive behind it. The failing node pulses red. As the AI identifies related services in its reasoning, those nodes on the graph illuminate.

**Why it matters**: In Datadog or New Relic, you're looking at a separate "AI Insights" tab while the topology is in another tab. You're mentally context-switching between two representations of the same problem. In LiveInfra, they're the same surface. When the AI says "47 Lambda functions are being affected," you see 47 nodes highlight on the graph behind the text. Spatial memory is powerful — SREs build mental models of their topology, and LiveInfra reinforces rather than disrupts that model.

**Implementation detail**: RCA output schema includes `affected_services[].arn`. Frontend maps ARNs to node IDs in the Sigma.js graph and applies highlighting directly to the renderer state.

---

## Feature 5: AWS Account Onboarding (<5 Minutes)

**The feature that determines whether anyone sees the other 9 features.**

**What it does**: Step-by-step IAM role creation wizard. Generates a CloudFormation template for one-click deployment. Validates the role and runs a test scan. User sees their first graph within 5 minutes of starting.

**Steps**:
1. Enter AWS Account ID → generate ExternalId
2. Download CloudFormation template (pre-filled with ExternalId and minimum IAM permissions)
3. Deploy template in customer's account (opens AWS Console CloudFormation in new tab, pre-populated)
4. Return to LiveInfra → click "Verify Connection" → test STS AssumeRole
5. If OK: trigger first scan → graph populates live → onboarding complete

**What makes it <5 minutes**: CloudFormation deployment is ~2 minutes for an IAM role. The verification + first scan for a small account (<500 resources) runs in parallel and completes while the user is reading the "what's next" screen.

**Why agentless enables this**: No agent installation means no SSH access, no kernel versions, no compatibility matrices, no security team approval for a new binary on production servers. The approval chain for an IAM role with ReadOnlyAccess is typically <1 business day, often self-service.

---

## Feature 6: Incident Feed (Real-Time Alert Stream)

**The operational backbone for teams already using PagerDuty or OpsGenie.**

**What it does**: Receives webhooks from alert managers, displays incidents in a collapsible sidebar, and triggers AI RCA automatically.

**Feed items show**:
- Alert title and severity
- Affected resource name and type
- Time since alert fired
- RCA status: analyzing (spinner) / complete (checkmark) / error (warning)
- One-click to open the full RCA panel

**Design intent**: The feed is not the primary interface — the graph is. The feed is the entry point to the graph. When an incident fires, the feed item jumps to the top, the user clicks it, and the graph animates to center on the failing node with blast radius already active.

---

## Feature 7: Resource Detail Panel

**The "tell me everything about this resource" surface.**

**What it does**: Click any node → panel slides in from right. Shows all metadata for that resource from the last scan.

**Contents**:
- AWS ARN (copyable)
- Resource type, instance class, engine version (type-specific)
- State: running, stopped, available, etc.
- Tags (all key-value pairs)
- Region + AZ
- VPC + Subnet
- Security Group memberships
- Direct upstream dependencies (services that depend on this resource)
- Direct downstream dependencies (services this resource depends on)
- Last scan time

**Graph-anchored**: The panel is overlaid on the graph, not replacing it. Background graph shows neighbors highlighted. Clicking a neighbor node navigates to that node's detail panel.

---

## Feature 8: Graph Search and Filter

**Finding your RDS instance in a 500-node graph without this is miserable.**

**What it does**: Search bar (keyboard shortcut: `/`) searches by name, ARN substring, tag value. Matching nodes highlight instantly, non-matching nodes dim. Filter by resource type (checkboxes), region, AZ, VPC.

**Instant search**: Debounced 150ms. No server round-trip — search runs against the in-memory graph state in Zustand.

**Tag filtering**: Useful for "show me only production resources" (filter by `env: prod` tag), "show me only the data tier" (filter by `tier: database`), etc.

**Cluster by VPC**: Optional layout mode that groups resources by VPC — useful for multi-VPC accounts to understand network boundaries.

---

## Feature 9: Webhook Integration (PagerDuty + OpsGenie + CloudWatch)

**The entry point for AI RCA during active incidents.**

**What it does**: Listens on an HTTPS endpoint for alert webhooks. Validates HMAC signature. Parses alert payload. Resolves the alerting resource to an ARN. Triggers AI RCA pipeline.

**PagerDuty V2 webhook**:
```json
{
  "messages": [{
    "event": "incident.trigger",
    "payload": {
      "summary": "RDS prod-api-db - CPU 99%",
      "custom_details": { "resource_id": "prod-api-db" }
    }
  }]
}
```

**OpsGenie action webhook**:
```json
{
  "action": "Create",
  "alert": {
    "message": "RDS prod-api-db - CPU 99%",
    "entity": "prod-api-db"
  }
}
```

**CloudWatch → SNS → HTTPS**:
- CloudWatch Alarm → SNS Topic → HTTPS subscription to LiveInfra endpoint
- Message body contains alarm name, namespace, dimensions (e.g., `DBInstanceIdentifier`)
- Dimensions map directly to resource identifiers

**Security**: HMAC-SHA256 signature validation. Webhook secret stored in Supabase Vault. Secret rotation UI in settings.

---

## Feature 10: Scanner Health & Dashboard

**The "is this thing working?" surface. Critical for building trust.**

**What it does**: Shows scanner status, last scan time, resources discovered, any scan errors.

**Dashboard cards**:
- Scanner status: OK / Warning / Error (with last heartbeat time)
- Total resources discovered (by type)
- Last full scan: timestamp + duration + resources scanned
- Pending jobs in BullMQ queue
- AWS API error log (throttling, permission errors)

**Alert on scanner failure**: If scanner hasn't successfully completed a scan in >20 minutes, email the account owner. SREs cannot use the graph during an active outage if the graph is stale from a failed scan.

**Why it's in the top 10**: A LiveInfra instance that appears healthy but has a silently-failed scanner is worse than no tool at all — it gives false confidence. Scanner health must be visible, proactive, and alarmed.
