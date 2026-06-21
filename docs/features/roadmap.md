# Product Roadmap

See also: [diagrams/product-roadmap.svg](../diagrams/product-roadmap.svg)

---

## Phase 1: MVP (Months 0–3, ~70 working days)

**Goal**: First paying customers. Prove core value prop: graph + blast radius + AI RCA.

**Milestone 1 — Infrastructure Foundation (Days 1–10)**
- [ ] Monorepo setup: Next.js 15 + Fastify + shared TypeScript config
- [ ] Supabase project: PostgreSQL + Auth + Realtime
- [ ] Neo4j AuraDB: Free tier, connection tested
- [ ] Upstash Redis: Account + BullMQ worker connected
- [ ] Clerk: Auth configured, Next.js middleware protecting routes
- [ ] Vercel deployment: main branch auto-deploys
- [ ] Sentry: Error tracking for both frontend and API

**Milestone 2 — AWS Scanner (Days 11–25)**
- [ ] IAM role assumption with ExternalId validation
- [ ] AWS Config SelectAggregateResourceConfig integration
- [ ] Resource normalization: 16 resource types → unified node schema
- [ ] Supplemental SDK calls: Lambda event sources, EventBridge targets, Step Functions ARNs, API Gateway VPC Links, RDS Proxy
- [ ] Relationship extraction: DEPENDS_ON edges from Config relationships + supplemental calls
- [ ] Neo4j writer: MERGE upsert, PART_OF/MEMBER_OF edges
- [ ] BullMQ: full-scan job (15-min cron), pruning job (nightly)
- [ ] Rate limit management: token bucket for CloudTrail (2 req/sec)
- [ ] S3 snapshot writer: Parquet snapshot after each full scan

**Milestone 3 — Graph Frontend (Days 26–38)**
- [ ] Sigma.js 3.x integration with Next.js (WebGL canvas in React)
- [ ] Graphology ForceAtlas2 layout
- [ ] Node rendering: type-specific colors, icons, size by connection degree
- [ ] Edge rendering: DEPENDS_ON (blue solid), MEMBER_OF (green dashed), PART_OF (amber dashed)
- [ ] Zoom/pan/select interactions
- [ ] Search and filter (name, type, region, tag)
- [ ] Resource detail panel (slide-in overlay, graph stays visible)
- [ ] Auto-refresh: 15-min poll, smooth node update without re-layout

**Milestone 4 — Blast Radius (Days 39–46)**
- [ ] tRPC blast radius endpoint → Neo4j Cypher variable-length traversal
- [ ] Severity scoring algorithm: hop × resource_multiplier × traffic_multiplier
- [ ] Frontend blast radius overlay: color-coded highlighting, severity labels
- [ ] Dim non-affected nodes (20% opacity)
- [ ] Hop-count labels on blast radius rings
- [ ] Legend panel
- [ ] Toggle on/off
- [ ] <100ms latency validation

**Milestone 5 — AI RCA Pipeline (Days 47–57)**
- [ ] Webhook listener: PagerDuty V2, OpsGenie, CloudWatch Alarm
- [ ] HMAC signature validation per webhook type
- [ ] Fuzzy ARN resolver (alert title → graph node ID)
- [ ] Graph context fetcher: 3-hop Neo4j query
- [ ] CloudTrail temporal context: last 24h events for the resource
- [ ] Upstash flow anomaly context
- [ ] Claude claude-sonnet-4-6 prompt builder (structured XML)
- [ ] Streaming API call with tool_choice: forced structured JSON output
- [ ] Supabase Realtime: token push to browser channel
- [ ] AI RCA panel: streaming render, evidence clickthrough, what_i_dont_know section
- [ ] RCA persistence to PostgreSQL
- [ ] Cost tracking: RCA call count per customer per month
- [ ] <8 second end-to-end latency validation

**Milestone 6 — Launch (Days 58–70)**
- [ ] Onboarding wizard: IAM role creation, CloudFormation template, verification
- [ ] Dashboard: scanner status, resource counts, recent incidents
- [ ] Incident feed: real-time webhook alerts, RCA status
- [ ] Settings: webhook management, account connection, usage meter
- [ ] Stripe: billing integration, tier-based limits (50 RCA calls/mo for Starter)
- [ ] Beta customer onboarding: manual setup for first 3 customers
- [ ] End-to-end smoke test across all flows
- [ ] Sentry alerts tuned to production error rates

---

## Phase 2: Growth (Months 4–6)

**Goal**: $10K MRR. ~14 Starter + 8 Growth customers.

**Features**:
- Multi-account support: up to 10 accounts per customer
- Infrastructure DVR: graph snapshot diff viewer ("what changed in the last hour?")
- Drift detection: alert when topology changes unexpectedly (resource deleted, new SG rule added)
- Slack integration: post RCA summaries to incident channels
- GitHub integration: blast radius comment on PRs before merge
- AWS Marketplace listing
- PagerDuty App marketplace listing
- Self-serve billing (Stripe Checkout)
- Team collaboration: up to 5 seats
- Multi-account CloudTrail stitching

**Technical additions**:
- DuckDB integration for S3 Parquet diff queries (Infrastructure DVR)
- Cross-account Neo4j namespace merging
- Slack OAuth + Slack Block Kit message formatter
- GitHub App: webhook for PR events, GitHub Checks API for blast radius gate status

---

## Phase 3: Enterprise (Months 7–12)

**Goal**: $100K ARR. ~5 Enterprise + 20 Growth customers.

**Features**:
- SOC 2 Type II certification (begin audit at Month 7)
- SSO/SAML: Okta, Azure AD, Google Workspace
- RBAC: viewer / responder / admin roles
- CI/CD blast radius gate: GitHub Actions step blocks deployment if blast radius > threshold
- Kubernetes/EKS support: pod topology, namespace graph, EKS Access Entry API
- Security graph layer: IAM policy analysis, over-permissive role detection
- Compliance views: CIS AWS Foundations Benchmark mapping
- Custom runbook integration: attach runbooks to resource types for AI RCA recommendations
- API access: customer-facing REST API for graph queries and RCA triggering
- Unlimited accounts
- Dedicated onboarding + SLA

**Technical additions**:
- EKS API integration: pod list, deployment status, network policy parsing
- IAM policy simulator integration (read-only)
- SOC 2 audit logging: all user actions logged to append-only PostgreSQL table
- RBAC middleware in Fastify + Clerk organizations
- API key management system

---

## Phase 4: Multi-Cloud (Year 2)

**Goal**: $500K ARR. Expand addressable market 3×.

**Features**:
- Azure support: ARM resource graph, Azure Monitor alerts, Azure Active Directory
- GCP support: Cloud Asset Inventory, Cloud Monitoring, GKE
- Cross-cloud dependency edges: AWS Lambda calling GCP Cloud Run via API
- eBPF network sensing: optional agent for sub-second flow data (vs. 1–15 min VPC Flow Log delay)
- Custom AI model fine-tuning: customer-specific runbook knowledge distillation

**Technical additions**:
- Azure Resource Graph (equivalent to AWS Config Aggregator)
- GCP Cloud Asset Inventory API
- Multi-cloud node schema: abstract resource types with cloud-specific subtypes
- eBPF eBPF agent (optional, opt-in): Cilium or Falco integration

---

## Key Milestones (Business)

| Date (approximate) | Milestone |
|---|---|
| Month 3 | MVP live, 3 beta customers |
| Month 4 | First paid customer at full price |
| Month 6 | $10K MRR |
| Month 8 | SOC 2 audit begins |
| Month 12 | $100K ARR, SOC 2 Type II complete |
| Year 2 Q1 | Azure beta |
| Year 2 Q2 | $500K ARR target |
