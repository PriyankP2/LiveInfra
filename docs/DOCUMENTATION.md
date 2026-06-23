# LiveInfra Documentation

**Version:** 1.0  
**Last Updated:** June 2026

## Table of Contents

1. [Product Overview](#product-overview)
2. [The Problem It Solves](#the-problem-it-solves)
3. [How It Works](#how-it-works)
4. [Core Features](#core-features)
5. [Getting Started (Quick Start)](#getting-started-quick-start)
6. [Setup & Configuration](#setup--configuration)
7. [Using LiveInfra](#using-liveinfra)
8. [Integrations](#integrations)
9. [API Reference](#api-reference)
10. [Architecture](#architecture)
11. [Security Model](#security-model)
12. [Roadmap & Future Improvements](#roadmap--future-improvements)
13. [FAQ](#faq)

---

## Product Overview

**LiveInfra** is a production-ready AWS infrastructure dependency graph analyzer designed for SRE teams, DevOps engineers, and platform teams. It maps your entire AWS environment as an interactive, real-time dependency graph and instantly shows you blast radius and root causes when incidents occur.

### What It Does

LiveInfra solves the critical gap between infrastructure complexity and incident response:

- **Agentless scanning**: One read-only IAM role. No agents to install or manage.
- **Live dependency graph**: See every AWS resource and every connection in a WebGL-rendered interactive graph.
- **Instant blast radius**: Click any resource to see all downstream dependencies that would fail if it goes down.
- **AI Root Cause Analysis**: Powered by Claude Sonnet 4.6 (primary) or Gemini Flash (fallback). Includes CloudTrail evidence.
- **Webhook integrations**: PagerDuty, OpsGenie, and CloudWatch/SNS automatically trigger incident analysis and graph focus.
- **Multi-account support**: Scan and visualize multiple AWS accounts from a single dashboard.

### Target Personas

LiveInfra is built for:

- **SRE Engineers** — Need rapid MTTR during incidents
- **DevOps Leads** — Responsible for infrastructure reliability and visibility
- **Platform Engineers** — Managing multi-team, multi-account AWS environments
- **CTO/VP Engineering** — Seeking cost-effective alternative to $150K+ enterprise tools

### Why It Exists

Enterprise tools like Dynatrace and Datadog cost $150K+ annually and require extensive setup. Lightweight tools (Cloudcraft, Hava) draw pretty diagrams but don't help you understand failure cascades or root causes. LiveInfra fills that gap with transparent, actionable, agentless intelligence at a fraction of the cost.

---

## The Problem It Solves

### AWS Complexity

Modern AWS infrastructure consists of hundreds or thousands of interconnected resources. When one fails, the blast radius is unknown:

- Which services depend on this database?
- What happens downstream if this ALB fails?
- How many resources are affected by this Lambda timeout?

### Mean Time To Resolution (MTTR)

Today's incident response is **manual and slow**:

- **15+ minutes** to identify the root cause (even for experienced engineers)
- **Tribal knowledge**: Dependency maps live in Slack threads, Notion docs, or engineers' heads — not in tools
- **Alert fatigue**: Hundreds of alerts fire, but no context on what's actually impacted

### Cost of Downtime

A single 30-minute production outage costs mid-market companies **~$50K** in lost revenue, customer churn, and engineering time. Better visibility and faster RCA directly reduce this cost.

### Existing Alternatives Are Broken

| Tool | Cost | Setup | Graph | RCA | Agentless |
|------|------|-------|-------|-----|-----------|
| Dynatrace | $150K+/year | Agents everywhere | Yes | Shallow | No |
| Datadog | $100K+/year | Agents + instrumentation | Yes | Shallow | No |
| Cloudcraft | $20-50/mo | Manual | Diagram only | No | No |
| Hava | $200/mo | Connector | Diagram only | No | Partial |
| **LiveInfra** | **$299/mo (Pro)** | **2 min IAM setup** | **Interactive, live** | **AI-powered** | **Yes** |

---

## How It Works

LiveInfra's architecture is built on four core pillars:

### 1. Agentless AWS Scanning

**No agents. Just read-only IAM.**

When you onboard, you create a single cross-account IAM role with read-only permissions. LiveInfra assumes this role to scan your AWS account. The role never stores credentials — it's temporary (1-hour session).

**What gets scanned:**
- EC2 instances, VPCs, subnets, security groups
- RDS databases (including read replicas, clusters)
- Lambda functions
- ALB / NLB load balancers (target groups, listeners, rules)
- ECS clusters, services, task definitions
- ElastiCache clusters, S3 buckets, SQS queues, SNS topics

**Scan frequency:**
- Manually triggered on-demand via the dashboard
- Or automatic on a schedule (configurable per account)

### 2. Neo4j Graph Database

**Infrastructure as a knowledge graph.**

Every scan result is transformed into a property graph stored in Neo4j AuraDB:

- **Nodes**: AWS resources (EC2, RDS, Lambda, etc.)
- **Edges**: Dependency relationships (DEPENDS_ON, PART_OF, DEPLOYED_IN)
- **Properties**: Tags, region, account ID, resource metadata

Example relationships:
```
EC2 -[DEPENDS_ON]-> RDS
EC2 -[DEPLOYED_IN]-> Subnet
Subnet -[PART_OF]-> VPC
ALB -[DEPENDS_ON]-> EC2
```

This graph is **queryable** — enabling instant blast radius, search, filtering, and topology visualization.

### 3. WebGL Graph Visualization (Sigma.js)

**Real-time, interactive infrastructure map.**

LiveInfra uses Sigma.js (WebGL-based graph rendering) to visualize the dependency graph in your browser:

- **Handles 10,000+ nodes** at 60fps
- **Interactive pan, zoom, search, filter**
- **Node colors by type** (EC2=orange, RDS=blue, Lambda=purple, etc.)
- **Edge thickness by traffic volume** (thicker = more traffic)
- **Tier-based sizing**: Infrastructure containers (VPC, Subnet) larger; leaf nodes (EC2) smaller

**You can:**
- Click any node to see details and trigger RCA
- Filter by resource type or AWS region
- Search for resources by name or ID
- Hover to see connection details

### 4. AI Root Cause Analysis

**Graph context + CloudTrail evidence → structured RCA**

When you click a resource or an incident fires via webhook, LiveInfra generates an AI-powered root cause analysis:

1. **Graph context** is sent to Claude Sonnet 4.6:
   - The selected resource (type, name, region)
   - Its incoming and outgoing connections
   - Blast radius (downstream affected resources)
   - Incident context (if provided by engineer)

2. **CloudTrail evidence** is fetched (best-effort):
   - Recent API calls on the resource
   - Configuration changes
   - Error events

3. **Claude responds** with:
   - **Most likely failure modes** for this specific resource type
   - **Blast radius analysis** — what breaks downstream
   - **Immediate remediation steps** — numbered AWS Console/CLI actions
   - **Prevention** — 2-3 concrete changes to reduce future risk

**Fallback support**: If Claude is unavailable, Gemini Flash is used automatically.

### 5. Webhook Auto-RCA

**Incidents trigger automatic analysis.**

LiveInfra listens for incidents from:

- **PagerDuty V2**: Webhook with HMAC signature validation
- **OpsGenie**: Webhook with token validation
- **CloudWatch/SNS**: SNS notifications via query param token

When an incident arrives:

1. LiveInfra extracts the resource ARN/ID from the alert
2. Logs the incident to Supabase
3. Looks up the resource in Neo4j
4. Fetches CloudTrail evidence
5. Generates RCA using Claude/Gemini
6. Stores analysis in the incident record
7. **Real-time update** pushes to the browser (Supabase real-time)

---

## Core Features

### 1. Live Dependency Graph

**Visual, interactive topology of your entire AWS infrastructure.**

- **WebGL rendering** — smoothly handles 10,000+ nodes
- **Pan, zoom, search** — find resources instantly
- **Filter by type or region** — focus on what matters
- **Color-coded nodes** — orange (EC2), blue (RDS), purple (Lambda), teal (S3), etc.
- **Edge visualization** — thickness represents traffic volume
- **Tier-based sizing** — infrastructure containers (VPC) are large; leaf nodes are smaller
- **Hover tooltips** — resource name, region, account ID

**Use case**: During an incident, see the entire dependency tree at a glance.

### 2. Blast Radius Calculator

**Select any resource. Instantly see all downstream dependencies.**

Given a resource, LiveInfra traverses the dependency graph up to 10 hops to find all downstream resources:

- **Severity scoring**: Each affected resource gets a risk score based on:
  - Distance (hops) from the source
  - Resource type (Lambda is higher risk than S3)
  - Traffic volume (high-traffic dependencies are higher risk)
- **Affected list**: Ordered by severity, showing exact resource names and regions
- **Canvas overlay**: Affected resources are highlighted on the live graph in red

**Example:**
```
You click ALB/prod-alb
↓
LiveInfra finds:
  - EC2/web-01 (1 hop, high severity)
  - EC2/web-02 (1 hop, high severity)
  - RDS/prod-db (2 hops via EC2, medium severity)
  - SQS/orders (3 hops via Lambda, low severity)
```

### 3. AI Root Cause Analysis

**Ask: "Why did this fail?" Get back actionable answers.**

Click any resource → LiveInfra generates an AI-powered RCA covering:

- **Failure modes**: What can realistically fail for this resource type (EC2: disk full, network timeout, memory OOM; RDS: connection pool exhaustion, CPU maxed, storage full)
- **Blast analysis**: What downstream services break immediately vs. eventually
- **Remediation steps**: Numbered, concrete AWS Console or CLI commands
- **Prevention**: Specific infrastructure changes (ASG policies, read replicas, SQS DLQ, etc.)

**Powered by**: Claude Sonnet 4.6 (primary) or Gemini Flash (fallback)

**Evidence-enriched**: Includes CloudTrail events showing recent API calls and errors

### 4. Multi-Provider AI (Claude + Gemini)

**Always get RCA, even if one provider is down.**

- **Claude preferred** — best reasoning, detailed RCA
- **Gemini fallback** — 24× cheaper, works as backup
- **Automatic failover** — if Claude API is down, Gemini kicks in
- **Works offline** — if both keys are missing, RCA explains configuration

This ensures your incident response isn't blocked by a single AI provider.

### 5. PagerDuty Integration

**Incidents fire → LiveInfra analyzes instantly.**

Setup:
1. Create a webhook in PagerDuty pointing to `https://api.liveinfra.dev/webhooks/pagerduty/<customer-id>`
2. Paste the signing secret into LiveInfra settings
3. Configure custom details in your PagerDuty alert (resource ARN or resource ID)

When incident fires:
- LiveInfra receives the PagerDuty message (HMAC signature validated)
- Extracts the resource ARN/ID
- Triggers auto-RCA in the background
- Real-time toast notification appears in your LiveInfra dashboard
- Graph auto-focuses on the affected resource
- RCA appears in the side panel

### 6. OpsGenie Integration

**Similar to PagerDuty, but simpler — no signature wrapping.**

Setup:
1. Create webhook in OpsGenie
2. Set `X-OG-Token` header to your signing secret
3. LiveInfra validates the token

Works the same as PagerDuty — auto-RCA, graph focus, real-time updates.

### 7. CloudWatch / SNS Integration

**CloudWatch alarms trigger via SNS.**

Setup:
1. Create SNS topic in your AWS account
2. Create CloudWatch alarm that publishes to SNS
3. Add SNS subscription to `https://api.liveinfra.dev/webhooks/cloudwatch/<customer-id>?token=<secret>`
4. Configure alarm dimensions (InstanceId, DBInstanceIdentifier, FunctionName)

LiveInfra parses the alarm, extracts the resource, and triggers RCA.

### 8. Incident Feed

**Real-time list of all incidents and their RCA status.**

Shows:
- **Incident source** (PagerDuty, OpsGenie, CloudWatch)
- **Title** and **severity** (critical, high, medium, low)
- **Affected resource** (if extracted)
- **RCA status** (pending, analyzing, complete, error)
- **Timestamp** when the incident was triggered

Click to see full RCA and blast radius details.

### 9. Multi-Account Support

**Scan and visualize multiple AWS accounts.**

- Add multiple AWS accounts via onboarding
- Each account gets its own read-only IAM role
- Scan all accounts independently or together
- Filter graph by account
- RCA works across accounts (CloudTrail evidence includes all accounts)

**Use case**: Large organizations with separate AWS accounts per team or environment.

### 10. Settings & Configuration

**Webhook configuration, API keys, notification settings.**

Access via dashboard → Settings:

- **Accounts**: Add/remove AWS accounts, view scan status
- **Webhooks**: Configure PagerDuty, OpsGenie, CloudWatch endpoints and secrets
- **API Keys**: Generate tRPC API keys for programmatic access
- **Notifications**: Email preferences, Slack channel (Phase 2)

---

## Getting Started (Quick Start)

### 1. Sign Up (Free)

Visit [liveinfra.dev](https://liveinfra.dev) → **Get started free**

- Clerk-based sign-up (email or GitHub)
- No credit card required for free tier
- Free plan: 1 AWS account, 5 RCA calls/month

### 2. Create AWS IAM Role (2 minutes)

In your AWS console:

1. Go to **IAM** → **Roles** → **Create role**
2. Choose **AWS account** (the LiveInfra account: `975050024946`)
3. Paste the **external ID**: `liveinfra`
4. Attach the **read-only policy** (provided in LiveInfra onboarding)
5. Copy the **role ARN** (looks like `arn:aws:iam::123456789012:role/LiveInfraRole`)

### 3. Onboard in LiveInfra

1. After sign-up, click **Connect AWS Account**
2. Paste the role ARN
3. Click **Validate** (LiveInfra verifies via STS)
4. Select regions to scan (default: us-east-1, us-west-2, eu-west-1)
5. Click **Start Scan**

### 4. Explore Your Graph (2-5 minutes)

Once the scan completes:

1. Go to **Dashboard** → **Graph Explorer**
2. See your AWS infrastructure as an interactive graph
3. Click any resource to see details and trigger RCA
4. Use the search bar to find resources
5. Filter by type or region

### 5. Setup Webhooks (Optional)

To get auto-RCA on incidents:

1. Go to **Settings** → **Webhooks**
2. Choose PagerDuty, OpsGenie, or CloudWatch
3. Copy the webhook URL and signing secret
4. Paste into your alerting tool
5. Next incident will trigger auto-RCA

---

## Setup & Configuration

### Environment Variables

The API server requires these environment variables in `apps/api/.env`:

```bash
# Neo4j (required)
NEO4J_URI=neo4j+s://xxxx.databases.neo4j.io
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=<from neo4j aura>

# Supabase (required)
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service role key>

# Upstash Redis (required)
UPSTASH_REDIS_URL=https://xxxx.upstash.io
UPSTASH_REDIS_TOKEN=<token>

# Anthropic Claude (recommended for RCA)
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-6

# Google Gemini (fallback for RCA, optional)
GEMINI_API_KEY=AIzaSy...
GEMINI_MODEL=gemini-2.5-flash

# Clerk (authentication)
CLERK_SECRET_KEY=sk_live_...
CLERK_PUBLISHABLE_KEY=pk_live_...

# Optional: Default scan role (for single-account setups)
SCAN_ROLE_ARN=arn:aws:iam::123456789012:role/LiveInfraRole
SCAN_EXTERNAL_ID=liveinfra

# Frontend
FRONTEND_URL=https://app.liveinfra.dev

# Port
PORT=4000
NODE_ENV=production
```

### AWS IAM Policy

Attach this read-only policy to the LiveInfra cross-account role:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ec2:DescribeInstances",
        "ec2:DescribeVpcs",
        "ec2:DescribeSubnets",
        "ec2:DescribeSecurityGroups",
        "rds:DescribeDBInstances",
        "rds:DescribeDBClusters",
        "lambda:ListFunctions",
        "lambda:GetFunction",
        "elasticloadbalancing:DescribeLoadBalancers",
        "elasticloadbalancing:DescribeTargetGroups",
        "ecs:ListClusters",
        "ecs:DescribeClusters",
        "ecs:ListServices",
        "ecs:DescribeServices",
        "ecs:ListTaskDefinitions",
        "ecs:DescribeTaskDefinition",
        "elasticache:DescribeCacheClusters",
        "s3:ListAllMyBuckets",
        "s3:GetBucketLocation",
        "sqs:ListQueues",
        "sqs:GetQueueAttributes",
        "sns:ListTopics",
        "sns:GetTopicAttributes",
        "cloudtrail:LookupEvents",
        "sts:GetCallerIdentity"
      ],
      "Resource": "*"
    }
  ]
}
```

### Database Schema

LiveInfra uses Supabase (PostgreSQL) for:

- **customers** — user accounts, tier, RCA call limits
- **aws_accounts** — connected AWS accounts, role ARNs, scan status
- **incidents** — incident log from webhooks
- **rca_history** — RCA analyses with token counts
- **webhook_configs** — PagerDuty/OpsGenie/CloudWatch webhook settings
- **graph_snapshots** — historical scan metadata

All tables have row-level security (RLS) enforced by `customer_id`.

### Neo4j Graph Schema

**Node Labels:**
- `Resource` — AWS resources with properties: `id`, `type`, `name`, `account_id`, `region`, `customer_id`, `last_seen`, `tags`, `properties`

**Relationship Types:**
- `DEPENDS_ON` — service-to-service dependency (EC2→RDS, Lambda→DynamoDB)
- `PART_OF` — containment (SG/Subnet→VPC, EC2→Cluster)
- `DEPLOYED_IN` — placement (EC2/RDS→Subnet/VPC)

**Indexes** (to be added in Phase 2):
- `Resource(customer_id)` — for RLS queries
- `Resource(id)` — for node lookup
- `Resource(account_id)` — for account-level queries

---

## Using LiveInfra

### Accessing the Dashboard

1. Sign in at [app.liveinfra.dev](https://app.liveinfra.dev)
2. **Graph Explorer** — Interactive dependency visualization
3. **Incident Feed** — Real-time incidents and RCA status
4. **Settings** — Accounts, webhooks, API keys

### The Golden Path: Incident to Resolution

**Scenario**: A production incident fires on your ALB.

1. **Alert arrives** (PagerDuty/OpsGenie)
2. **LiveInfra webhook** receives it, extracts the ALB resource ARN
3. **Auto-RCA triggers** in the background
4. **Real-time toast** notifies you in the dashboard
5. **Graph auto-focuses** on the ALB
6. **Blast radius highlights** all 12 downstream EC2s and RDS that are at risk
7. **RCA panel shows**:
   - **Failure modes**: Security group misconfiguration, listener rule conflict, target group health check failure
   - **Blast analysis**: 12 EC2 instances lose HTTP traffic; 2 RDS databases stay up (only queried via EC2)
   - **Remediation**: 3 numbered steps (check SG rules, verify TG health, review target instances)
   - **Prevention**: Add ALB to ASG lifecycle hooks, enable ALB access logs, set up target stickiness

8. **Engineer executes remediation** (2 minutes vs. 15+ minutes manual investigation)

### Reading the Graph

**Node colors:**
- **Orange** — EC2 instances
- **Blue** — RDS databases
- **Purple** — Lambda functions
- **Teal** — S3 buckets
- **Green** — SQS queues
- **Light blue** — VPCs, subnets (infrastructure)
- **Gray** — Security groups

**Edge types:**
- **Solid orange** — DEPENDS_ON (service dependency)
- **Solid green** — DEPLOYED_IN (resource placement)
- **Solid gray** — PART_OF (containment)

**Edge thickness** — represents traffic volume. Thicker edges = higher traffic.

### Performing Blast Radius Analysis

1. Click any resource on the graph
2. Right panel shows resource details
3. Scroll down → **Blast Radius**
4. See all affected resources, ordered by severity
5. Resources highlighted in red on the graph
6. Use **maxHops** slider to adjust traversal depth (1-10)

**Example output:**
```
Blast Radius for ALB/prod-alb:
  ▪ EC2/web-01 (1 hop) — CRITICAL
  ▪ EC2/web-02 (1 hop) — CRITICAL
  ▪ RDS/prod-db (2 hops via EC2) — HIGH
  ▪ SQS/orders (3 hops via Lambda) — MEDIUM
  ▪ S3/logs-bucket (4 hops) — LOW
```

### Triggering Manual RCA

1. Click any resource on the graph
2. Right panel → **AI Root Cause Analysis** section
3. Optionally type incident context (e.g., "404 errors, high latency")
4. Click **Analyze**
5. RCA generates in 3-5 seconds
6. Read failure modes, remediation, prevention

### Configuring Webhooks

#### PagerDuty

1. **LiveInfra Settings** → **Webhooks** → **PagerDuty**
2. Copy the webhook URL: `https://api.liveinfra.dev/webhooks/pagerduty/<customer-id>`
3. Go to **PagerDuty** → **Integrations** → **Webhooks** → **Create**
4. Paste the LiveInfra webhook URL
5. Copy the signing secret, paste it back into LiveInfra settings
6. **Save**
7. Test: Trigger a test incident in PagerDuty, confirm LiveInfra receives it

#### OpsGenie

1. **LiveInfra Settings** → **Webhooks** → **OpsGenie**
2. Copy the webhook URL
3. In **OpsGenie** → **Settings** → **Integrations** → **Webhook** → **Create**
4. Paste the webhook URL
5. In webhook headers, add: `X-OG-Token: <signing-secret-from-liveinfra>`
6. **Save**

#### CloudWatch

1. Create an **SNS topic** in your AWS account (e.g., `liveinfra-alerts`)
2. In CloudWatch → Create an **alarm**
3. Set **SNS action** to the topic
4. In **SNS subscriptions**, create an **HTTPS** subscription to:
   ```
   https://api.liveinfra.dev/webhooks/cloudwatch/<customer-id>?token=<secret>
   ```
5. Paste the signing secret from LiveInfra into the query param `token`
6. AWS will confirm the subscription automatically (or click the link)

### Filtering and Search

**Search bar:**
- Type resource name (e.g., `web-01`) to highlight on graph
- Type resource ID (e.g., `i-1234abcd`)
- Results appear as you type

**Filter by type:**
- Click checkbox to show/hide EC2, RDS, Lambda, etc.
- Graph re-renders instantly

**Filter by region:**
- Dropdown to select one region
- Graph filters to resources in that region
- Or "All regions" to see everything

### API Key Management

To use the tRPC API programmatically:

1. Go to **Settings** → **API Keys**
2. Click **Generate new key**
3. Copy the key (shown once only)
4. Include in your API calls as Bearer token

Example:
```bash
curl -X POST https://api.liveinfra.dev/trpc/graph.topology \
  -H "Authorization: Bearer <your-api-key>" \
  -H "Content-Type: application/json" \
  -d '{"customerId": "...", "accountId": "..."}'
```

---

## Integrations

### Supported Services

| Service | Type | Feature |
|---------|------|---------|
| **AWS EC2** | Compute | Scan, graph, RCA |
| **AWS RDS** | Database | Scan, graph, RCA |
| **AWS Lambda** | Compute | Scan, graph, RCA |
| **AWS ALB/NLB** | Load Balancing | Scan, graph, RCA |
| **AWS ECS** | Orchestration | Scan, graph, RCA |
| **AWS S3** | Storage | Scan, graph |
| **AWS SQS** | Messaging | Scan, graph |
| **AWS SNS** | Messaging | Scan, graph |
| **AWS ElastiCache** | Caching | Scan, graph |
| **AWS CloudTrail** | Logging | RCA evidence enrichment |
| **AWS STS** | Auth | Role assumption for scanning |
| **Neo4j AuraDB** | Graph DB | Topology storage and querying |
| **Supabase PostgreSQL** | Relational DB | Customer data, incidents, RCA history |
| **Upstash Redis** | Cache | (Planned: rate limiting, session cache) |
| **Clerk** | Auth | User authentication and management |
| **Anthropic Claude** | AI | Primary RCA engine |
| **Google Gemini** | AI | Fallback RCA engine |
| **PagerDuty** | Alerting | Webhook-based incident ingestion |
| **OpsGenie** | Alerting | Webhook-based incident ingestion |
| **CloudWatch** | Monitoring | SNS-based alarm ingestion |
| **Vercel** | Hosting | Frontend deployment |
| **Railway** | Hosting | API backend deployment |

### Extending Integrations (Phase 2+)

Planned integrations:

- **Slack**: Send RCA directly to Slack channel
- **Teams**: Microsoft Teams notifications
- **GitHub Actions**: Blast radius checks in CI/CD
- **Terraform**: OPA policy checks based on blast radius
- **Datadog**: Event ingestion for correlation
- **New Relic**: Metrics correlation with incidents

---

## API Reference

LiveInfra exposes a **tRPC** API for programmatic access. All endpoints require authentication via Clerk JWT.

### Authentication

Include the Clerk JWT in the `Authorization` header:

```bash
Authorization: Bearer <clerk-jwt>
```

Or for server-to-server, use an API key:

```bash
Authorization: Bearer <api-key>
```

### Endpoints

#### Graph Operations

**`graph.topology`** — Get full infrastructure topology

```
POST /trpc/graph.topology
Input: { customerId: string, accountId?: string }
Output: {
  nodes: GraphNode[],
  edges: GraphEdge[],
  meta: { customerId, accountId, lastScanAt, nodeCount, edgeCount }
}
```

**`graph.blastRadius`** — Calculate blast radius for a resource

```
POST /trpc/graph.blastRadius
Input: {
  customerId: string,
  resourceId: string,
  maxHops?: number (1-10, default 10)
}
Output: {
  sourceNodeId: string,
  affected: [
    { nodeId: string, hops: number, score: number, severity: string }
  ],
  queryMs: number
}
```

#### Scanner Operations

**`scanner.trigger`** — Start a manual scan

```
POST /trpc/scanner.trigger
Input: {
  customerId: string,
  accountId: string,
  roleArn: string,
  externalId: string,
  regions: string[]
}
Output: { queued: true, startedAt: string }
```

**`scanner.triggerDefault`** — Scan using stored account credentials

```
POST /trpc/scanner.triggerDefault
Input: {
  customerId: string,
  accountId: string,
  regions?: string[]
}
Output: { queued: true, startedAt: string, regionCount: number }
```

**`scanner.status`** — Get latest scan metadata

```
POST /trpc/scanner.status
Input: { customerId: string, accountId: string }
Output: {
  customerId: string,
  accountId: string,
  lastScanAt: string | null,
  nodeCount: number
}
```

#### RCA Operations

**`rca.analyze`** — Generate AI root cause analysis

```
POST /trpc/rca.analyze
Input: {
  customerId: string,
  resourceId: string,
  resourceType: string,
  resourceName: string,
  region: string,
  accountId: string,
  connections: [{ direction: 'in'|'out', edgeType: string, neighborType: string, neighborName: string }],
  blastAffectedCount: number,
  incidentContext?: string,
  roleArn?: string
}
Output: {
  analysis: string (markdown),
  model: string,
  promptTokens: number,
  completionTokens: number
}
```

#### Incidents Operations

**`incidents.list`** — Get incident history

```
POST /trpc/incidents.list
Input: {
  customerId: string,
  limit?: number (1-100, default 20),
  since?: string (ISO timestamp)
}
Output: [
  {
    id: string,
    source: 'pagerduty' | 'opsgenie' | 'cloudwatch',
    title: string,
    severity: 'critical' | 'high' | 'medium' | 'low',
    status: 'open' | 'analyzing' | 'resolved' | 'error',
    resourceArn: string | null,
    resourceId: string | null,
    triggeredAt: string,
    createdAt: string
  }
]
```

**`incidents.getRca`** — Get RCA for an incident

```
POST /trpc/incidents.getRca
Input: { incidentId: string }
Output: {
  id: string,
  analysis: string | null,
  status: 'pending' | 'analyzing' | 'complete' | 'error',
  inputTokens: number,
  outputTokens: number,
  latencyMs: number,
  completedAt: string | null
}
```

#### Account Management

**`accounts.list`** — List connected AWS accounts

```
POST /trpc/accounts.list
Input: { customerId: string }
Output: [
  {
    id: string,
    customerId: string,
    accountId: string,
    displayName: string,
    roleArn: string,
    status: 'active' | 'error' | 'pending',
    lastScanAt: string | null,
    lastScanResourceCount: number,
    createdAt: string
  }
]
```

**`accounts.add`** — Register a new AWS account

```
POST /trpc/accounts.add
Input: {
  customerId: string,
  accountId: string,
  displayName: string,
  roleArn: string,
  externalId?: string
}
Output: { id: string, status: 'pending' }
```

---

## Architecture

### System Diagram (Text-Based)

```
┌─────────────────────────────────────────────────────────────────────┐
│                         User Browser                                 │
│   ┌───────────────────────────────────────────────────────────────┐ │
│   │ Next.js 15 Frontend (Vercel CDN)                              │ │
│   │  • Graph explorer (Sigma.js, WebGL)                           │ │
│   │  • Incident feed (Supabase real-time)                         │ │
│   │  • Settings & onboarding                                      │ │
│   └───────────────────────────────────────────────────────────────┘ │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ tRPC + REST
                           ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    Fastify API (Railway)                              │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ tRPC Router (Authenticated)                                    │  │
│  │  • graph.topology, graph.blastRadius                           │  │
│  │  • rca.analyze (Claude/Gemini)                                 │  │
│  │  • scanner.trigger (async scan)                                │  │
│  │  • incidents.list, incidents.getRca                            │  │
│  │  • accounts.add, accounts.list                                 │  │
│  └────────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ Webhook Routes (Unauthenticated)                               │  │
│  │  • POST /pagerduty/:customerId (HMAC signed)                   │  │
│  │  • POST /opsgenie/:customerId (token validated)                │  │
│  │  • POST /cloudwatch/:customerId (token query param)            │  │
│  │  → Auto-RCA triggered in background                            │  │
│  └────────────────────────────────────────────────────────────────┘  │
└────────┬──────────────────────────────┬───────────────┬──────────────┘
         │                              │               │
    ┌────▼─────────────────────────────▼─┐   ┌────────▼──────────────┐
    │   AWS Account (Read-Only)            │   │ External Services    │
    │  ┌──────────────────────────────┐   │   │ ┌──────────────────┐ │
    │  │ Scanned Services:            │   │   │ │ Claude Sonnet    │ │
    │  │  • EC2, RDS, Lambda          │   │   │ │ (Primary RCA)    │ │
    │  │  • ALB, ECS, ElastiCache     │   │   │ └──────────────────┘ │
    │  │  • S3, SQS, SNS              │   │   │ ┌──────────────────┐ │
    │  │  • CloudTrail (RCA evidence) │   │   │ │ Gemini Flash     │ │
    │  │  • STS (role assumption)     │   │   │ │ (Fallback RCA)   │ │
    │  └──────────────────────────────┘   │   │ └──────────────────┘ │
    │                                      │   │ ┌──────────────────┐ │
    │  ┌──────────────────────────────┐   │   │ │ PagerDuty        │ │
    │  │ Cross-Account IAM Role       │   │   │ │ OpsGenie         │ │
    │  │  (read-only + external ID)   │   │   │ │ CloudWatch/SNS   │ │
    │  └──────────────────────────────┘   │   │ │ (incident sources)
    │                                      │   │ └──────────────────┘ │
    └──────────────────────────────────────┘   └─────────────────────┘
         │                 │
         └────────────────┬──────────────────────────┐
                          │                          │
                    ┌─────▼────────┐        ┌────────▼──────────┐
                    │  Neo4j Aura  │        │  Supabase         │
                    │ (Graph DB)   │        │  (PostgreSQL)     │
                    │  • Nodes     │        │  • Customers      │
                    │  • Edges     │        │  • Incidents      │
                    │  • RLS by    │        │  • RCA history    │
                    │    customer  │        │  • Webhooks       │
                    │              │        │  • Real-time subs │
                    └──────────────┘        └─────────────────┘
                                                    │
                                            ┌───────▼─────────┐
                                            │ Upstash Redis   │
                                            │ (Planned: cache,│
                                            │  rate limiting) │
                                            └─────────────────┘
```

### Data Flow: Incident to RCA

```
1. PagerDuty Alert
   ↓
2. Webhook → /pagerduty/:customerId
   ↓
3. HMAC signature validation
   ↓
4. Extract resource ARN from alert
   ↓
5. Insert incident record → Supabase
   ↓
6. Background job: runAutoRca()
   ├─ Look up resource in Neo4j
   ├─ Calculate blast radius
   ├─ Fetch CloudTrail events
   ├─ Call Claude/Gemini with context
   └─ Update rca_history table
   ↓
7. Supabase real-time broadcast → browser
   ↓
8. Toast notification + RCA panel update
```

### Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | Next.js 15 | React SSR, tRPC client |
| | Sigma.js | WebGL graph rendering |
| | TypeScript | Type safety |
| **Backend** | Fastify | HTTP server |
| | tRPC | Type-safe RPC |
| | Node.js 20+ | Runtime |
| **Database** | Neo4j Aura | Graph storage |
| | Supabase (PG) | Relational data, auth |
| | Upstash Redis | Cache/rate limiting |
| **AI** | Anthropic Claude | Primary RCA engine |
| | Google Gemini | Fallback RCA engine |
| **Auth** | Clerk | User authentication |
| **Hosting** | Vercel | Frontend CDN |
| | Railway | API backend |
| **Infrastructure** | AWS SDK | Cloud scanning |

---

## Security Model

### Agentless Architecture

**Core principle**: No persistent credentials stored.

- LiveInfra receives a **cross-account IAM role ARN** from you
- When scanning, it **assumes the role** using STS
- Credentials are **temporary** (1-hour session)
- The role has **read-only permissions** (no create/delete/modify)
- **No agents** need to be installed on your servers

### Cryptographic Security

#### Webhook Signature Validation

**PagerDuty** — HMAC-SHA256 validation:
```
Received signature: X-PagerDuty-Signature header
Expected signature: HMAC-SHA256(payload, signing_secret)
Timing-safe comparison to prevent timing attacks
```

**OpsGenie** — Token-based validation:
```
Received token: X-OG-Token header
Expected token: Configured in LiveInfra settings
String comparison (constant-time)
```

**CloudWatch/SNS** — Query parameter token:
```
Received token: ?token=... query param
Expected token: Configured in LiveInfra settings
```

### Authentication & Authorization

**User authentication**: Clerk JWT
- Issued by Clerk after sign-up/login
- Verified on every tRPC endpoint
- Includes `sub` (user ID) claim

**Authorization**: Row-Level Security (RLS)
- All Supabase tables have `customer_id` column
- RLS policies enforce `customer_id = auth.uid()`
- Neo4j queries include `customer_id` filter
- No customer can access another's data

### Encryption & Transport

- **TLS 1.3** — All connections encrypted in transit
- **HTTPS only** — No plain HTTP endpoints
- **API keys** — Hashed in database, shown once at creation

### Data Isolation

- **Multi-tenancy**: Each customer is isolated by UUID
- **Neo4j RLS**: Properties include `customer_id`; all queries filter by it
- **Supabase RLS**: Enforced at the table level
- **No shared state** between customers

### Compliance Roadmap

- **SOC 2 Type II** — In progress (Q2 2026)
- **HIPAA** — Available for Enterprise tier
- **GDPR** — Data deletion, export, consent management
- **CCPA** — California privacy rights

---

## Roadmap & Future Improvements

### Phase 2 (Q3 2026)

- [ ] **BullMQ durable scan queue** — Replace direct async calls with persistent job queue
- [ ] **Stripe subscription integration** — Automated billing for Pro/Enterprise tiers
- [ ] **Neo4j query indexes** — Performance optimization for large accounts
- [ ] **Upstash Redis rate limiting** — Prevent abuse of RCA endpoint
- [ ] **Streaming RCA** — Token-by-token response (Server-Sent Events)
- [ ] **SNS subscription auto-confirmation** — Automatic CloudWatch integration setup
- [ ] **Slack notifications** — Send RCA directly to Slack channels
- [ ] **Multi-node blast radius** — "What if" mode: select multiple nodes, see cascading failures

### Phase 3 (Q4 2026)

- [ ] **GitHub Actions integration** — Run blast radius checks in CI/CD before deployments
- [ ] **Terraform OPA policies** — Reject infrastructure changes that exceed blast radius thresholds
- [ ] **Evidence explorer** — Click CloudTrail events for raw log details
- [ ] **RBAC (Role-Based Access Control)** — Multiple team members with different permission levels
- [ ] **Mobile responsiveness** — Full-featured mobile app (React Native)
- [ ] **Teams/MS Graph integration** — Teams channel notifications
- [ ] **Cost correlation** — Link blast radius to estimated cost of downtime

### Phase 4 (Q1 2027+)

- [ ] **AWS service expansion** — Kinesis, DynamoDB, Neptune, DocumentDB, AppSync
- [ ] **GCP support** — Google Cloud resources and scanning
- [ ] **Azure support** — Microsoft Azure resources and scanning
- [ ] **Kubernetes integration** — Pod and service dependency graphs
- [ ] **Datadog/New Relic webhook** — Metrics correlation with incidents
- [ ] **Custom RCA prompts** — Customer-defined analysis templates
- [ ] **Open-source MIT scanner** — Standalone CLI tool
- [ ] **Self-hosted option** — Deploy LiveInfra on-premise

### Known Limitations (Current)

- **AWS SDK pagination** — Large accounts (>1000 resources) may timeout; needs pagination implementation
- **CloudTrail rate limits** — High-frequency RCA may hit CloudTrail API limits; needs backoff + caching
- **Neo4j query timeouts** — Blast radius on very large graphs (100K+ nodes) may time out; needs async queries
- **Webhook retries** — No automatic retry logic if webhook delivery fails; manual re-triggering needed
- **Mobile UI** — Dashboard not optimized for phones/tablets yet

---

## FAQ

### General

**Q: How much does LiveInfra cost?**

A: **Free** (1 AWS account, 5 RCA/month), **Pro** ($299/mo for 5 accounts, 100 RCA/month), **Enterprise** (custom pricing). No setup fees, no overage charges.

**Q: Is there a free trial?**

A: Yes. Sign up, create a free account, connect an AWS account, and explore your graph instantly. No credit card required.

**Q: What AWS regions are supported?**

A: All AWS regions. You select which regions to scan during onboarding. Common defaults: us-east-1, us-west-2, eu-west-1, ap-southeast-1.

**Q: Can I use LiveInfra with multiple AWS accounts?**

A: Yes. Add as many accounts as your plan allows (1 for Starter, 5 for Pro, unlimited for Enterprise). Each account gets its own read-only IAM role.

**Q: Is my data encrypted?**

A: Yes. All data in transit uses TLS 1.3. Data at rest in Neo4j and Supabase is encrypted by default.

### Security & Permissions

**Q: Do I need to give LiveInfra admin access?**

A: No. The IAM role is **read-only**. It can only describe/list resources, not create, modify, or delete anything.

**Q: What if I accidentally give the role write permissions?**

A: LiveInfra will still only perform read operations. The extra permissions are unused and safe.

**Q: Can LiveInfra modify or delete resources?**

A: No. The IAM role and all API calls are read-only. LiveInfra has no ability to modify or delete resources.

**Q: How often does LiveInfra scan my account?**

A: By default, manual on-demand. But you can set up automatic scans (daily/weekly) in the Pro/Enterprise plans. Scans run in the background and don't impact performance.

**Q: What if I remove the IAM role?**

A: LiveInfra can no longer scan that account. The connection is broken, and you'll see an error in the dashboard. Simply recreate the role to re-enable.

### Incidents & RCA

**Q: Why is the RCA sometimes incomplete?**

A: If CloudTrail evidence is unavailable (limited lookback, no events), RCA is based on graph context alone. It's still actionable, just without raw evidence.

**Q: Can I manually trigger RCA for a resource?**

A: Yes. Go to Graph Explorer, click any resource, scroll to "AI Root Cause Analysis", and click "Analyze". You can also add optional incident context.

**Q: Does RCA cost money?**

A: Included in your plan's RCA call limit. Free: 5/mo, Pro: 100/mo, Enterprise: unlimited.

**Q: What if my Claude/Gemini API key is missing?**

A: RCA returns a helpful error message explaining how to add keys. Use the other provider as fallback.

**Q: Can I get RCA for multiple resources at once?**

A: Not in a single call. But you can trigger RCA for each resource individually. Batch RCA is on the Phase 3 roadmap.

### Integration & Webhooks

**Q: Which alerting tools are supported?**

A: PagerDuty, OpsGenie, CloudWatch/SNS. Slack/Teams/email coming in Phase 2.

**Q: What if my webhook endpoint goes down?**

A: The alerting tool (PagerDuty, etc.) will retry based on its own retry policy. LiveInfra has no control over that. Manual trigger is available in the Incidents feed.

**Q: Can I route different resource types to different webhooks?**

A: Not currently. All alerts go to a single LiveInfra endpoint and are processed together. Routing rules are on the Phase 3 roadmap.

**Q: How do I extract the resource ARN from my alerts?**

A: Add custom details to your alerts in PagerDuty/OpsGenie. LiveInfra looks for fields like `resource_arn`, `resource_id`, `arn`, `instance_id`, or parses them from the alert title/message.

### Graph & Visualization

**Q: Why is my graph showing isolated nodes?**

A: Some resources (e.g., unused RDS databases) have no dependencies. This is correct — they're not connected to the service topology.

**Q: Can I export the graph as a diagram?**

A: Not yet. Exporting to SVG/PNG is on the Phase 2 roadmap.

**Q: Can I zoom in on a specific region or account?**

A: Yes. Use the filter dropdowns at the top to select a region or account. The graph re-renders to show only those resources.

**Q: Is the graph real-time?**

A: The graph updates after each scan (manual or automatic). Incident status is real-time via Supabase subscriptions.

### Performance & Scalability

**Q: How many resources can the graph handle?**

A: Sigma.js renders up to 10,000+ nodes at 60fps. Larger accounts may require pagination (Phase 2 feature).

**Q: How long does a scan take?**

A: Depends on account size and region count:
- Small account (100 resources, 1 region): ~30 seconds
- Large account (5000 resources, 9 regions): ~2-3 minutes
- Very large account (10,000+ resources): ~5-10 minutes

Scans run in the background; you can use the dashboard while scanning.

**Q: What if a scan fails?**

A: The error is logged, and you'll see a message in the dashboard (e.g., "CloudTrail rate limited"). Retry the scan after a few minutes.

**Q: Does scanning impact my AWS API limits?**

A: Minimally. LiveInfra uses efficient batch operations. But high-frequency scans (>1/minute) could hit limits. We recommend scanning on a daily schedule.

### Billing & Subscriptions

**Q: Can I upgrade/downgrade my plan anytime?**

A: Yes. Changes take effect at the start of the next billing cycle. You can cancel anytime with no penalty.

**Q: What happens if I exceed my RCA limit?**

A: RCA requests fail with a "limit exceeded" error. Upgrade your plan or wait for the next month's reset.

**Q: Can I get a refund?**

A: Yes. 30-day money-back guarantee if you're not satisfied. Email support@liveinfra.dev.

**Q: Do you offer annual billing discounts?**

A: Yes. Annual pricing is 15% off. Available on Pro and Enterprise plans.

### Troubleshooting

**Q: I'm not seeing resources in the graph.**

A: Check:
1. IAM role is correctly created and trusted by the LiveInfra account (975050024946)
2. External ID matches: `liveinfra`
3. Scan has completed (check scan status in Settings → Accounts)
4. You selected at least one region during onboarding

**Q: The blast radius is empty.**

A: This resource has no downstream dependencies. It's isolated in the graph. This is normal for leaf nodes like final databases.

**Q: RCA is taking a long time.**

A: RCA usually completes in 3-5 seconds. If it hangs:
1. Check API logs for errors
2. Verify ANTHROPIC_API_KEY or GEMINI_API_KEY is set
3. Try again in a few minutes (may be hitting AI API rate limits)

**Q: Webhook isn't triggering.**

A: Check:
1. Webhook URL is correctly copied from LiveInfra settings
2. Signing secret matches in both LiveInfra and your alerting tool
3. Test incident is sending the correct resource ARN/ID
4. Check API logs for rejected webhooks (HTTP 401/403)

**Q: I'm seeing a "No data" error on the dashboard.**

A: Likely causes:
1. First scan is still running (check scan status)
2. AWS credentials have expired or role was deleted
3. Customer ID mismatch (sign in as the correct user)

Reload the page or contact support.

---

## Support & Community

**Documentation**: https://docs.liveinfra.dev  
**GitHub Issues**: https://github.com/liveinfra/liveinfra/issues  
**Email**: support@liveinfra.dev  
**Slack Community**: [Join our Slack](https://slack.liveinfra.dev)

---

## License & Attribution

LiveInfra's agentless AWS scanner is **open-source under the MIT license**. Core product (graph database, RCA engine, dashboard) is proprietary and available under the LiveInfra SaaS terms.

**Contributors**: Built by solo founder Aditya (with ❤️ for the SRE community)  
**© 2026 LiveInfra, Inc. All rights reserved.**
