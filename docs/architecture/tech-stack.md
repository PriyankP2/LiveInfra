# Tech Stack

Every choice is justified. No speculative additions.

---

## Frontend

### Next.js 15 (App Router)
**Why**: React Server Components for the dashboard shell reduces JS bundle size. Server Actions replace a REST endpoint for form submissions. Built-in image optimization. Vercel-native deployment.
**Not**: Remix (less ecosystem maturity for SaaS), Nuxt (team is React-oriented), plain React (no SSR).

### Sigma.js 3.x (WebGL graph renderer)
**Why**: WebGL-based rendering delivers 60 FPS at 10,000+ nodes. This is the graph canvas — it must never drop frames during incident response.
**Not**:
- React Flow: SVG-based, degrades to 12 FPS at 200+ nodes. React Flow's own maintainers state it's not designed for 200+ node graphs.
- D3.js: DOM manipulation conflicts with React's reconciler. Would require full custom graph layout algorithm.
- Cytoscape.js: Canvas/SVG hybrid, adequate for medium graphs but slower than WebGL at scale.

### Zustand (state management)
**Why**: Minimal boilerplate for global graph state (selected node, blast radius overlay, RCA panel open/closed). Avoids Redux ceremony for what is essentially 3–4 global state slices.
**Not**: Redux Toolkit (overkill for this use case), Context API (re-render cascade on graph selection changes).

### Tailwind CSS v4
**Why**: Utility-first allows fast dark-mode UI iteration. Consistent design tokens. No CSS module naming overhead.
**Not**: CSS Modules (verbose), styled-components (runtime overhead), plain CSS (no design system).

### ShadCN/UI (component primitives)
**Why**: Accessible, unstyled component primitives that integrate with Tailwind. Radix UI under the hood for accessibility. No lock-in — components are copied into the repo, not imported from a package.
**Not**: Headless UI (less complete), MUI (opinionated styling conflicts with Tailwind), Chakra UI (same conflict).

---

## API Layer

### Fastify (HTTP server)
**Why**: 2× throughput vs Express on Node.js. Plugin architecture. TypeScript-native. Handles webhook ingestion from PagerDuty/OpsGenie at high volume.
**Not**: Express (slower, no built-in TypeScript), Hono (edge-first, less ecosystem for heavy Node.js workloads), NestJS (too much abstraction ceremony).

### tRPC (type-safe API)
**Why**: Shared TypeScript types between Next.js frontend and Fastify backend. Eliminates API contract drift. Auto-generates React Query hooks for the frontend.
**Not**: REST + OpenAPI (manual type generation, drift risk), GraphQL (overkill for this data shape, N+1 query risk on graph data).

### Supabase Realtime (WebSocket streaming)
**Why**: AI RCA tokens stream from Claude → Fastify → Supabase Realtime channel → browser. Supabase Realtime handles WebSocket connection management, reconnection, and fan-out to multiple browser tabs automatically.
**Not**: Raw WebSocket server on Fastify (reconnection logic, tab sync complexity), SSE (unidirectional, harder to fan-out), Socket.io (additional dependency, same reconnection problem).

---

## Data Layer

### Neo4j AuraDB (graph database)
**Why**: Native graph database — Cypher traversals for blast radius (`MATCH (n)<-[:DEPENDS_ON*1..10]-(downstream)`) are O(hops) not O(nodes). No JOIN chains. Variable-length path queries are a core language feature.
**Not**:
- PostgreSQL with graph extension: ltree or recursive CTEs work but are 10–100× slower for multi-hop traversals
- DGraph: Less mature, smaller ecosystem, harder to self-host if needed
- Amazon Neptune: More expensive than AuraDB, less developer tooling
**Hard rule**: MERGE not CREATE. Current state only. No temporal versioning.

### PostgreSQL via Supabase
**Why**: History store for CloudTrail events, RCA outputs, alert history, user data, billing. Supabase adds Auth, Storage, Realtime, and Row Level Security out of the box.
**Not**: Separate Postgres + separate auth service + separate realtime service — Supabase bundles all of this.

### Upstash Redis (serverless Redis)
**Why**: Rate limit enforcement for AWS API calls (2 req/sec CloudTrail limit), short-lived caches (ENI→ResourceID mapping, 5-min TTL), BullMQ queue state.
**Not**: ElastiCache (always-on instance cost for a serverless scanner), self-hosted Redis (operational burden).

### S3 + DuckDB (Infrastructure DVR)
**Why**: Graph snapshots as Parquet files every 5 minutes. DuckDB runs SQL queries over Parquet for diff computation — "what changed between T-5min and T-0min?" without loading the full snapshot into memory.
**Not**: Neo4j temporal versioning (57,600 new nodes/day for 1,000-resource account — catastrophic), TimescaleDB (wrong data model for graph snapshots).

---

## Scanner / Worker Layer

### BullMQ (job queue)
**Why**: Redis-backed, TypeScript-native, supports job scheduling (cron), retry, priority queuing, and job progress tracking. The scheduled full-scan and event-driven partial-scan jobs both run as BullMQ workers.
**Not**: AWS SQS (additional AWS dependency, more latency), Bull v4 (BullMQ is the maintained successor), raw cron jobs (no retry, no observability).

### AWS SDK v3 (modular)
**Why**: Tree-shakeable — import only the clients you use. TypeScript-first. Smithy-generated types. Supports credential provider chain for assumed roles.
**Not**: AWS SDK v2 (deprecated, CommonJS only, 20MB+ bundle), boto3 (Python — adds a second language runtime).

### AWS Config SelectAggregateResourceConfig
**Why**: Single API call returns all resources across all regions. Avoids calling `ec2:DescribeInstances`, `rds:DescribeDBInstances`, etc. in every region. Eliminates regional API rate limiting.
**Supplement**: Direct SDK calls for relationships AWS Config doesn't model:
- Lambda event source mappings
- EventBridge rule targets
- Step Functions task ARNs
- API Gateway VPC Links
- RDS Proxy target groups

---

## Infrastructure / DevOps

### Vercel (frontend hosting)
**Why**: Zero-config Next.js deployment. Preview deployments per PR. Edge CDN. Instant rollback.

### Supabase (backend hosting)
**Why**: Managed PostgreSQL + Auth + Realtime + Storage. Avoids operating 4 separate services.

### Render.com or Railway (scanner workers)
**Why**: Persistent Node.js processes for BullMQ workers. Cheaper than ECS for low-medium traffic. Auto-deploys from GitHub.
**Alternative**: AWS ECS Fargate for Phase 2+ when worker fleet needs to scale.

### GitHub Actions (CI/CD)
**Why**: Free for public repos (MIT scanner), standard for Node.js projects, integrates with Vercel and Railway deployment hooks.

---

## Observability (for LiveInfra itself)

| Tool | Purpose |
|---|---|
| Sentry | Error tracking + performance monitoring |
| Upstash Redis | Queue depth monitoring via BullMQ metrics |
| Supabase Dashboard | PostgreSQL query performance, Realtime connection counts |
| Vercel Analytics | Core Web Vitals, page load times |
| Pino (structured logging) | JSON logs from Fastify + BullMQ workers |
