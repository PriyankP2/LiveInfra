# 70-Day MVP Build Plan

**Constraint**: Solo founder, 2 hours/day = ~140 hours total.

All 51 tasks ordered by dependency. Complete each task before starting the next. Estimated hours assume focused 2-hour sessions.

---

## Milestone 1: Infrastructure Foundation (Days 1–10, ~20 hours)

| # | Task | Hours | Done |
|---|---|---|---|
| 1 | Init monorepo: Turborepo + pnpm workspaces (`apps/web`, `apps/api`, `packages/shared`) | 2h | [ ] |
| 2 | Next.js 15 app (`apps/web`): App Router, TypeScript, Tailwind v4, ShadCN init | 2h | [ ] |
| 3 | Fastify API (`apps/api`): TypeScript, tRPC router, Pino logger | 2h | [ ] |
| 4 | Shared package: TypeScript types for graph nodes, edges, RCA schema | 1h | [ ] |
| 5 | Supabase project: PostgreSQL provisioned, Auth enabled, Realtime enabled | 1h | [ ] |
| 6 | Supabase schema: `customers`, `aws_accounts`, `incidents`, `rca_history`, `cloudtrail_events`, `webhook_configs` tables | 2h | [ ] |
| 7 | Neo4j AuraDB: Free tier provisioned, connection from API tested | 1h | [ ] |
| 8 | Upstash Redis: Account created, BullMQ worker test job runs | 1h | [ ] |
| 9 | Clerk: Auth configured, Next.js middleware, protected route test | 1h | [ ] |
| 10 | Vercel deployment: `apps/web` deploys on push to main | 1h | [ ] |
| 11 | Sentry: Error tracking for web + API, source maps uploaded | 1h | [ ] |
| 12 | Environment variables: Supabase, Neo4j, Upstash, Clerk, Sentry — all in Vercel + local `.env.local` | 1h | [ ] |

**Milestone 1 Complete Criteria**: `https://liveinfra.app` loads a blank Next.js page with Clerk auth. API server starts. Neo4j connection verified. BullMQ test job runs and completes.

---

## Milestone 2: AWS Scanner (Days 11–25, ~30 hours)

| # | Task | Hours | Done |
|---|---|---|---|
| 13 | IAM role assumption: `STS.assumeRole()` with ExternalId, credential refresh logic | 2h | [ ] |
| 14 | AWS Config: `SelectAggregateResourceConfig` query for all 16 resource types | 2h | [ ] |
| 15 | Resource normalizer: Config JSON → unified node schema (id, name, type, region, account_id, tags, properties) | 3h | [ ] |
| 16 | Supplemental SDK: Lambda event source mappings extractor | 1h | [ ] |
| 17 | Supplemental SDK: EventBridge rule targets extractor | 1h | [ ] |
| 18 | Supplemental SDK: Step Functions task ARN extractor | 1h | [ ] |
| 19 | Supplemental SDK: API Gateway VPC Link extractor | 1h | [ ] |
| 20 | Supplemental SDK: RDS Proxy target group extractor | 1h | [ ] |
| 21 | Relationship extractor: DEPENDS_ON edges from Config relationships + supplemental data | 3h | [ ] |
| 22 | Neo4j writer: MERGE upsert for nodes, MERGE for edges, customer_id isolation | 2h | [ ] |
| 23 | Neo4j indexes: NODE KEY constraint on (id, customer_id), customer + region indexes | 1h | [ ] |
| 24 | BullMQ full-scan job: schedule every 15 min, timeout 10 min, retry on failure | 2h | [ ] |
| 25 | BullMQ pruning job: nightly, delete nodes with `last_seen` > 7 days | 1h | [ ] |
| 26 | Rate limit management: Upstash token bucket for CloudTrail (2 req/sec), EC2 describe calls | 2h | [ ] |
| 27 | S3 snapshot writer: Parquet file after each full scan, keyed by `customer_id/timestamp.parquet` | 2h | [ ] |
| 28 | Scanner integration test: connect to a real AWS account, verify graph has correct nodes and edges | 2h | [ ] |
| 29 | ENI→ResourceID cache: BullMQ job every 5 min, Upstash Redis, TTL 5 min | 2h | [ ] |

**Milestone 2 Complete Criteria**: Full scan of a test AWS account completes in <15 minutes. Neo4j shows correct nodes with DEPENDS_ON edges. S3 snapshot written. Scan reruns every 15 minutes automatically.

---

## Milestone 3: Graph Frontend (Days 26–38, ~28 hours)

| # | Task | Hours | Done |
|---|---|---|---|
| 30 | tRPC graph endpoint: query Neo4j → return nodes + edges JSON for a customer | 2h | [ ] |
| 31 | Sigma.js 3.x: integrate with Next.js App Router (client component, dynamic import, SSR disabled) | 2h | [ ] |
| 32 | Graphology ForceAtlas2: layout on initial load, frozen after first render | 2h | [ ] |
| 33 | Node rendering: type-specific colors (EC2 blue, RDS purple, Lambda green, ALB orange), size by degree | 2h | [ ] |
| 34 | Edge rendering: DEPENDS_ON blue solid, MEMBER_OF green dashed, PART_OF amber dashed | 1h | [ ] |
| 35 | Zoom/pan/click interactions: Sigma camera controls, node click event → Zustand state | 2h | [ ] |
| 36 | Resource detail panel: slide-in from right, shows all node properties, direct neighbors | 3h | [ ] |
| 37 | Graph search/filter: Zustand filter state, live filtering on Sigma node visibility | 2h | [ ] |
| 38 | Topbar: logo, account selector (Clerk org), global search (opens search panel) | 2h | [ ] |
| 39 | Sidebar: incident feed placeholder, nav links, collapse to icon mode | 2h | [ ] |
| 40 | Auto-refresh: 15-min poll, smooth node update using Sigma graph.updateNode() | 2h | [ ] |
| 41 | Node label rendering: show labels at zoom > 1.2×, truncate at 20 chars | 1h | [ ] |
| 42 | Graph performance test: render 500+ nodes at 60 FPS, verify no jank on node click | 2h | [ ] |

**Milestone 3 Complete Criteria**: Graph renders live AWS infrastructure. 500 nodes at 60 FPS. Node click opens resource detail panel. Search filters nodes. Auto-refresh runs without re-layout.

---

## Milestone 4: Blast Radius (Days 39–46, ~14 hours)

| # | Task | Hours | Done |
|---|---|---|---|
| 43 | tRPC blast radius endpoint: Neo4j Cypher variable-length traversal (1..10 hops), severity scoring | 3h | [ ] |
| 44 | Severity scoring: hop × resource_multiplier × traffic_volume_multiplier, clamped 0–1 | 1h | [ ] |
| 45 | Frontend blast radius overlay: color-coded node highlights, dim non-affected nodes (20% opacity) | 2h | [ ] |
| 46 | Hop-count labels and legend (floating bottom-left of canvas) | 1h | [ ] |
| 47 | Blast radius toggle: click node to activate, click elsewhere to deactivate | 1h | [ ] |
| 48 | Staggered reveal animation: hop 1 at 50ms, hop 2 at 150ms, hop 3 at 250ms | 1h | [ ] |
| 49 | Blast radius latency test: <100ms from click to full overlay rendered | 1h | [ ] |

**Milestone 4 Complete Criteria**: Click any node → blast radius activates in <100ms. Downstream nodes color-coded correctly. Severity scores match algorithm. Toggle works.

---

## Milestone 5: AI RCA Pipeline (Days 47–57, ~22 hours)

| # | Task | Hours | Done |
|---|---|---|---|
| 50 | Webhook listener: Fastify route for PagerDuty V2, OpsGenie, CloudWatch Alarm; HMAC validation | 3h | [ ] |
| 51 | Fuzzy ARN resolver: alert title → Neo4j node lookup by name + tags | 2h | [ ] |
| 52 | Graph context fetcher: 3-hop Neo4j query, returns upstream + downstream + SG + VPC | 2h | [ ] |
| 53 | CloudTrail temporal context: PostgreSQL query for last 24h events by resource ARN | 1h | [ ] |
| 54 | Upstash flow anomaly context: read anomaly keys for resource, last 2 hours | 1h | [ ] |
| 55 | Prompt builder: structured XML from graph + temporal + flow context | 2h | [ ] |
| 56 | Claude claude-sonnet-4-6 API: streaming call with tool_choice forced to `submit_rca` schema | 2h | [ ] |
| 57 | Supabase Realtime: broadcast RCA tokens to `rca:{incidentId}:{customerId}` channel | 1h | [ ] |
| 58 | AI RCA panel: subscribe to Realtime channel, render streaming JSON progressively | 3h | [ ] |
| 59 | Evidence clickthrough: raw CloudTrail event side drawer (JSON pretty-printed) | 1h | [ ] |
| 60 | RCA persistence: save full RCA to PostgreSQL `rca_history` after stream completes | 1h | [ ] |
| 61 | RCA cost tracking: increment usage counter in Supabase per customer per month | 1h | [ ] |
| 62 | End-to-end latency test: webhook → first token in browser, target <8 seconds | 1h | [ ] |

**Milestone 5 Complete Criteria**: PagerDuty webhook → AI RCA panel renders in <8 seconds. Evidence items are clickable. `what_i_dont_know` section visible. RCA saved to PostgreSQL.

---

## Milestone 6: Launch (Days 58–70, ~26 hours)

| # | Task | Hours | Done |
|---|---|---|---|
| 63 | Onboarding wizard: IAM role creation step, CloudFormation template generation, ExternalId flow | 4h | [ ] |
| 64 | Onboarding: "Verify Connection" → test STS AssumeRole, show specific error on failure | 2h | [ ] |
| 65 | Dashboard: scanner status card, resource count by type, last scan time, recent incidents | 3h | [ ] |
| 66 | Incident feed sidebar: real-time updates via Supabase Realtime, RCA status badges | 2h | [ ] |
| 67 | Settings: webhook management UI, account connection management | 2h | [ ] |
| 68 | Stripe: billing portal, tier-based RCA call limits enforcement in API middleware | 3h | [ ] |
| 69 | VPC Flow Log parser: S3 log reader, REJECT/ACCEPT anomaly detection, Upstash storage | 3h | [ ] |
| 70 | Manual beta customer onboarding: set up 3 customers, collect feedback | 3h | [ ] |
| 71 | End-to-end smoke test: signup → onboard → graph → blast radius → webhook → AI RCA | 2h | [ ] |
| 72 | Production incident drill: simulate RDS failure, run full RCA flow, verify <8s | 2h | [ ] |

**Milestone 6 Complete Criteria (MVP Done)**:
- [ ] New customer connects AWS account in <5 minutes
- [ ] Graph loads in <2 seconds for 500-resource account
- [ ] Blast radius query completes in <100ms
- [ ] AI RCA completes in <8 seconds
- [ ] 3 paying beta customers using the product
- [ ] Scanner runs 7 consecutive days without manual intervention
- [ ] Zero cross-customer data leakage (isolation verified)

---

## Buffer & Risk

**10% buffer built in**: 51 core tasks × avg 2h = ~102h. At 2h/day × 70 days = 140h. ~38 hours of buffer for debugging, rework, and scope creep.

**Highest-risk tasks**:
1. Task 31 (Sigma.js + Next.js integration) — WebGL in App Router has SSR edge cases
2. Task 43 (Blast radius Cypher query) — variable-length traversal performance at scale
3. Task 56 (Claude streaming + tool_choice) — structured JSON output may need prompt iteration
4. Task 63 (CloudFormation template) — IAM permissions edge cases per account type

**Risk mitigation**: Start Milestone 2 (Scanner) on Day 11 in parallel with researching Sigma.js App Router integration. Don't wait for Milestone 1 to be perfect before scouting Milestone 2.
