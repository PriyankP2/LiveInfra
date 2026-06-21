# Architecture Overview

See also: [diagrams/system-architecture.svg](../diagrams/system-architecture.svg) | [diagrams/data-pipeline.svg](../diagrams/data-pipeline.svg)

## Five-Layer Architecture

```
Layer 1: Users          SRE / Platform Engineers / On-call
Layer 2: Frontend       Next.js 15 + Sigma.js + Zustand + Tailwind
Layer 3: API Layer      Fastify + tRPC + Supabase Realtime + Claude client
Layer 4: Data Layer     Neo4j AuraDB + PostgreSQL (Supabase) + Upstash Redis
Layer 5: Scanner        BullMQ workers + AWS SDK v3 + Flow log parser
         ↓
         AWS Account    Config + CloudTrail + VPC Flow Logs + EC2/RDS/Lambda/etc.
```

## Key Architectural Decisions

### Agentless by Design

LiveInfra assumes a read-only IAM role in the customer's AWS account. No installation on customer infrastructure. The scanner workers run in LiveInfra's infrastructure and pull data from AWS APIs using the assumed role. This is the most significant architectural constraint — every data access pattern must be achievable via API calls without installed agents.

### Graph-First Data Model

All AWS resources are nodes. All dependencies are edges. This is not a relational database with a graph view bolted on — Neo4j AuraDB is the primary topology store. Every query that asks "what would break if X failed?" runs as a Cypher graph traversal, not a JOIN chain.

### Separation of Current State vs. History

**Neo4j AuraDB** stores ONLY current topology — one node per resource, one edge per relationship. No timestamps. No versions. No temporal annotations. This is a hard rule.

**PostgreSQL (Supabase)** stores everything historical: CloudTrail events, alert history, RCA outputs, snapshot metadata.

**S3 Parquet** stores graph snapshots every 5 minutes — the "Infrastructure DVR." DuckDB queries diffs between snapshots.

**Violation of this rule**: Temporal versioning in Neo4j creates 57,600 new nodes per day for a 1,000-resource account (one "version" node per resource per 5-minute snapshot × 1,000 resources × 288 snapshots/day). This has been explicitly validated as catastrophic and is permanently banned.

### Real-Time via Supabase Realtime

AI RCA results stream token-by-token from Claude claude-sonnet-4-6 through the API layer into Supabase Realtime WebSocket channels. The frontend subscribes to the channel for the current incident and renders tokens as they arrive. This is more reliable than maintaining a persistent WebSocket at the API layer and simpler than SSE with reconnection logic.

### Event-Driven Scanner Updates

Full AWS Config scan runs every 15 minutes as a scheduled BullMQ job. EventBridge rules push change notifications to the API layer within 30 seconds for topology changes. VPC Flow Logs have an inherent 1–15 minute delay from AWS.

---

## Data Flow Summary

1. **Scheduled scan** (every 15 min): BullMQ job → IAM AssumeRole → AWS Config SelectAggregateResourceConfig → resource collection → relationship extraction → Neo4j MERGE upsert + S3 snapshot
2. **Event update** (<30 sec): AWS EventBridge → API Layer webhook → targeted SDK call → Neo4j MERGE for affected resources
3. **Alert trigger** (→ AI RCA in <8 sec): PagerDuty/OpsGenie webhook → fuzzy ARN resolver → Neo4j 3-hop query + PostgreSQL CloudTrail 24h + Upstash flow anomalies → Claude claude-sonnet-4-6 streaming → Supabase Realtime push → Frontend render
4. **Blast radius** (<100ms): Frontend click → tRPC query → Neo4j Cypher variable-length traversal → severity scoring → frontend highlighting

---

## External Services

| Service | Purpose | Why |
|---|---|---|
| Clerk | Auth (OAuth + MFA) | Best DX for auth, Next.js native |
| Claude claude-sonnet-4-6 | AI RCA generation | Best reasoning at $0.01–0.03/call cost target |
| Stripe | Billing | Standard for B2B SaaS |
| PagerDuty / OpsGenie | Alert ingestion | Where SRE teams already manage incidents |
| Slack / GitHub | Notification + CI gate | Phase 2/3 integrations |
| Sentry | Error tracking | Standard observability for the product itself |

---

## Scalability Targets

| Dimension | MVP Target | Phase 3 Target |
|---|---|---|
| Resources per account | 5,000 | 50,000 |
| AWS accounts per customer | 2 | Unlimited |
| Graph render frame rate | 60 FPS at 5K nodes | 60 FPS at 50K nodes |
| AI RCA latency | <8 seconds | <5 seconds |
| Blast radius query | <100ms | <50ms |
| Full scan duration | <15 minutes | <5 minutes |
| Scanner worker concurrency | 5 workers | 50 workers |

---

## Security Architecture

- **IAM ExternalId**: Unique per customer, prevents confused deputy attacks
- **Role chain**: Max 1 hop — scanner must have direct trust to each account (AWS limit)
- **Secrets**: All credentials in Supabase Vault, never in environment variables or code
- **Network**: All API calls over HTTPS/TLS 1.3. No plaintext paths
- **Data isolation**: Each customer's Neo4j data namespaced by `customer_id` property on all nodes
- **Audit log**: All scanner IAM calls logged to CloudTrail in customer account (read-only, can't be disabled by LiveInfra)
- **Zero write access**: IAM policy explicitly denies all `*:Put*`, `*:Create*`, `*:Delete*`, `*:Update*` actions
