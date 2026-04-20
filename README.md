<div align="center">

```
  ██╗     ██╗██╗   ██╗███████╗██╗███╗   ██╗███████╗██████╗  █████╗
  ██║     ██║██║   ██║██╔════╝██║████╗  ██║██╔════╝██╔══██╗██╔══██╗
  ██║     ██║██║   ██║█████╗  ██║██╔██╗ ██║█████╗  ██████╔╝███████║
  ██║     ██║╚██╗ ██╔╝██╔══╝  ██║██║╚██╗██║██╔══╝  ██╔══██╗██╔══██║
  ███████╗██║ ╚████╔╝ ███████╗██║██║ ╚████║██║     ██║  ██║██║  ██║
  ╚══════╝╚═╝  ╚═══╝  ╚══════╝╚═╝╚═╝  ╚═══╝╚═╝     ╚═╝  ╚═╝╚═╝  ╚═╝
```

**Your AWS infrastructure, finally explained.**

Live dependency graphs · Plain-English runbooks · Blast-radius calculator · Enriched incident alerts

[![Status](https://img.shields.io/badge/status-building_in_public-brightgreen)](#)
[![License](https://img.shields.io/badge/license-Apache-blue)](#)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-orange)](#contributing)

</div>

---

## The problem

You get paged at 2am. An alarm fires. Your Slack lights up.

And then you spend the next **40 minutes** answering questions that should take 40 seconds:

- *What is this resource?*
- *What depends on it?*
- *Who owns it?*
- *What breaks if it stays down?*

Architecture diagrams go stale the day they're drawn. Documentation is always out of date. Your team's tribal knowledge lives in Slack threads nobody can find.

**LiveInfra fixes this.** It continuously reads your AWS account, builds a live dependency graph, and generates plain-English explanations of every resource — so your team knows what connects to what *before* an incident, not during one.

---

## What it does

```
┌─────────────────────────────────────────────────────────────┐
│                     Your AWS Account                        │
│                                                             │
│   EC2 · RDS · Lambda · S3 · VPC · SG · ALB · ECS · more     │
└────────────────────┬────────────────────────────────────────┘
                     │  read-only IAM role (no write access, ever)
                     ▼
┌────────────────────────────────────────────────────────────┐
│                      LiveInfra                             │
│                                                            │
│  ① Live dependency graph   — what connects to what         │
│  ② Plain-English explainer — click any resource, get docs  │
│  ③ Blast-radius calculator — what breaks if X goes down    │
│  ④ Enriched Slack alerts   — raw alarms → actionable cards │
└────────────────────────────────────────────────────────────┘
```

### ① Live dependency graph

A zoomable, interactive map of your entire AWS account. Nodes are resources. Edges are actual traffic paths from VPC flow logs — not assumed connections. Updates every 5 minutes.

### ② Plain-English resource explainer

Click any resource and instantly see:

```
📦  prod-api-rds  (db.t3.medium · us-east-1)

What it is:    Your production PostgreSQL database hosting the
               TravelMemory application data.

Depends on:    prod-vpc (10.0.0.0/16)
               db-security-group (port 5432 from api-sg only)

Used by:       api-server-1 (EC2)
               api-server-2 (EC2)
               reporting-lambda (reads every 6hrs)

Monthly cost:  $47.20 / month
Last changed:  3 days ago by terraform-deploy

⚠️  If this goes down: API returns 503. All user-facing
    features break. Reporting pipeline halts.
```

### ③ Blast-radius calculator

Select any resource → LiveInfra walks the dependency graph downstream → renders the full impact list ranked by severity.

```
Blast radius for: prod-api-rds

CRITICAL    api-server-1, api-server-2        → all API traffic
CRITICAL    user-auth-service                 → login broken
HIGH        reporting-lambda                  → data pipeline halts
MEDIUM      admin-dashboard                   → read-only degraded
LOW         analytics-sync-job                → delayed, not broken

Estimated users affected:  ~12,000
Revenue impact:            ~$340 / minute of downtime
Fastest recovery path:     promote read-replica (rds-replica-1)
```

### ④ Enriched incident alerts

When CloudWatch fires an alarm, LiveInfra intercepts it and posts an enriched card to Slack — before anyone even opens their laptop.

```
🔴  ALERT: prod-api-rds CPU > 90%  (triggered 2 mins ago)

What it is:     Production PostgreSQL · TravelMemory app
Blast radius:   api-server-1, api-server-2, user-auth-service
Affected users: ~12,000
Owner:          @devops-team
Runbook:        Check slow query log → scale instance → failover

[ View in LiveInfra ]  [ Acknowledge ]  [ Escalate ]
```

---

## Tech stack

| Layer | Technology |
|---|---|
| Scanner | Node.js · TypeScript · AWS SDK v3 |
| Graph DB | Neo4j (dependency graph) |
| Metadata DB | PostgreSQL |
| Cache | Redis (live state) |
| AI layer | Claude API (explanation generation) |
| Frontend | React · TypeScript · D3.js · Cytoscape.js |
| Auth | Clerk.dev |
| Infra | AWS ECS · Terraform · GitHub Actions |
| Alerts | CloudWatch EventBridge · Slack API · PagerDuty |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        LiveInfra Platform                        │
│                                                                  │
│  ┌─────────────┐    ┌──────────────┐     ┌────────────────────┐  │
│  │   Scanner   │───▶│  Graph Store │───▶│   API Server       │  │
│  │  (AWS SDK)  │    │   (Neo4j)    │     │   (Node.js)        │  │
│  └─────────────┘    └──────────────┘     └────────┬───────────┘  │
│         │                                         │              │
│  ┌──────▼──────┐    ┌──────────────┐    ┌────────▼───────────┐   │
│  │  Flow Logs  │    │  Claude API  │    │   React Frontend   │   │
│  │  (VPC edges)│    │  (explainer) │    │   (D3 graph UI)    │   │
│  └─────────────┘    └──────────────┘    └────────────────────┘   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐     │
│  │  Alert Enrichment Pipeline                              │     │
│  │  CloudWatch → EventBridge → LiveInfra → Slack / PD      │     │
│  └─────────────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────────┘
```

---

## Getting started

> ⚠️ LiveInfra is in early development and being built in public. This section updates weekly as features ship.

### Prerequisites

- Node.js 18+
- An AWS account with permissions to create IAM roles
- Neo4j (local or cloud — [Neo4j Aura](https://neo4j.com/cloud/platform/aura-graph-database/) has a free tier)
- A Claude API key ([get one here](https://console.anthropic.com))

### Installation

```bash
git clone https://github.com/yourusername/liveinfra
cd liveinfra
npm install
cp .env.example .env
```

### Configuration

Edit `.env` with your values:

```env
# AWS
AWS_ROLE_ARN=arn:aws:iam::123456789012:role/LiveInfraReadOnly
AWS_REGION=us-east-1

# Database
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your-password
DATABASE_URL=postgresql://user:pass@localhost:5432/liveinfra

# AI
ANTHROPIC_API_KEY=sk-ant-...

# Alerts (optional)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
```

### AWS IAM setup

LiveInfra requires a **read-only** IAM role. It has zero write permissions and never modifies your account.

```bash
cd terraform/iam
terraform init
terraform apply
# Copy the output role ARN into your .env
```

The role grants `Describe*` and `List*` permissions only — on EC2, RDS, S3, Lambda, ELB, CloudWatch, and VPC flow logs.

### Run

```bash
# Populate the graph from your AWS account
npm run scan

# Start the API + UI
npm run dev

# Open the dashboard
open http://localhost:3000
```

---

## Project structure

```
liveinfra/
├── packages/
│   ├── scanner/          # AWS resource scanner (runs on cron)
│   │   ├── src/
│   │   │   ├── collectors/   # one file per AWS service
│   │   │   │   ├── ec2.ts
│   │   │   │   ├── rds.ts
│   │   │   │   ├── vpc.ts
│   │   │   │   ├── lambda.ts
│   │   │   │   └── security-groups.ts
│   │   │   ├── graph/        # Neo4j write layer
│   │   │   └── index.ts      # scan entrypoint
│   ├── api/              # Node.js REST + WebSocket server
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   ├── services/
│   │   │   │   ├── blast-radius.ts
│   │   │   │   ├── explainer.ts   # Claude API calls
│   │   │   │   └── alerts.ts
│   │   │   └── index.ts
│   └── web/              # React frontend
│       ├── src/
│       │   ├── components/
│       │   │   ├── Graph/         # D3 + Cytoscape graph
│       │   │   ├── ResourcePanel/ # click-to-explain side panel
│       │   │   └── BlastRadius/   # impact visualiser
│       │   └── App.tsx
├── terraform/
│   └── iam/              # read-only IAM role
└── README.md
```

---

## Roadmap

### MVP — months 1–3
- [x] Project setup and public repo
- [ ] AWS scanner: EC2, RDS, VPC, security groups, Lambda
- [ ] Neo4j graph storage
- [ ] React + D3 interactive graph UI
- [ ] Click-to-explain via Claude API
- [ ] Blast-radius calculator
- [ ] CloudWatch → Slack enriched alerts
- [ ] Auth + multi-tenant (Clerk.dev)
- [ ] Landing page + waitlist

### Phase 2 — months 4–9
- [ ] Multi-account support
- [ ] Historical graph snapshots
- [ ] Cost breakdown per resource
- [ ] Runbook export to Confluence / Notion
- [ ] Terraform state integration

### Phase 3 — months 10+
- [ ] Azure connector
- [ ] GCP connector
- [ ] SOC2 / HIPAA compliance evidence generation
- [ ] Anomaly detection on resource changes

---

## Building in public

This project is being built in public — 2 hours a day, while employed, from scratch.

The goal is to reach the first paying customer by month 7. Every week: one shipped feature, one post about what was learned.

Follow the build:
- Twitter / X: [@yourhandle](#)
- LinkedIn: [your name](#)
- Dev blog: [liveinfra.dev/blog](#) *(coming soon)*

If you're working on something similar, or just want to watch how this unfolds — star the repo and say hi.

---

## Contributing

Contributions are welcome. The project is early but moving fast.

```bash
# Fork → branch → PR
git checkout -b feature/your-feature
git commit -m "feat: your change"
git push origin feature/your-feature
```

Open an issue first for significant changes. Good first issues are tagged `good-first-issue`.

---

## Security

LiveInfra is **read-only by design.**

The IAM role has zero write, create, or delete permissions. The scanner never modifies any AWS resource. If you find a security issue, please email `security@liveinfra.dev` rather than opening a public issue.

---

## License

See [LICENSE](LICENSE) for details.

---

<div align="center">

*Built in public*

[Follow the build](#) · [Join the waitlist](#) · [Say hi](#)

</div>
