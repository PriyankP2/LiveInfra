# Product Vision

## The Problem

When an outage hits at 2am, SRE teams face three simultaneous failures:

1. **No live dependency map** — they can't see what depends on what right now, in production, at this moment
2. **No RCA intelligence** — they're grepping logs manually, checking dashboards in separate tabs, forming hypotheses in isolation
3. **Blast radius is unknown** — they don't know what else will break before they touch anything

The result: MTTR measured in hours. Cascading incidents. Engineers burned out from manual correlation work that a machine should do.

### Why existing tools fail

**Diagram tools** (Cloudcraft, Hava, Lucidscale) are static. They show you what your infra looked like when someone last updated the diagram. They have zero intelligence at incident time.

**APM platforms** (Datadog, New Relic) have some AI features, but their dependency maps are shallow, their AI RCA covers only 4–5 pre-defined failure types, and they cost $15–23/host/month — punishing at scale.

**Dynatrace** gets closest: real graph + AI RCA + blast radius. But it requires a OneAgent installed on every host, costs $150K+/year, and the AI is a black box. Mid-market teams ($299–$899/mo budget) have nowhere to go.

**AWS DevOps Agent** (GA 2026) is reactive, AWS-native only, no graph visualization, and a black-box Bedrock model with no customization path.

## The Solution

LiveInfra is an agentless AWS infrastructure analyzer that unifies three things no mid-market tool combines today:

1. **Live dependency graph** — built from AWS Config + targeted SDK calls, refreshed every 15 minutes, rendered at 60 FPS with Sigma.js WebGL
2. **AI-native RCA** — when an alert fires, Claude claude-sonnet-4-6 synthesizes graph topology + CloudTrail history + VPC flow log anomalies into a structured root-cause analysis with evidence you can audit
3. **Spatial blast radius** — before you touch anything, see every downstream dependency highlighted on the live graph with severity scores

The core insight: **the graph IS the RCA interface**. You don't switch tabs or open a side report. The blast radius illuminates on the graph. The AI panel slides in anchored to the failing node. Everything happens spatially, in context.

## Target Market

**Primary**: Mid-market SRE/Platform teams at companies with 50–500 engineers.

These teams have enough AWS complexity (multi-account, EKS, RDS, 100+ Lambda functions) that manual correlation is genuinely painful. They're willing to pay for a tool that actually reduces MTTR. But they can't justify $150K/yr for Dynatrace, and they've outgrown Cloudcraft-as-diagram-tool.

**Secondary**: Enterprise architects and compliance teams who need dependency mapping for audit trails, change-impact assessment before deployments, and drift detection.

**Approachable by**: DevOps engineers, middleware engineers, backend engineers who are on-call but don't self-identify as SREs. The graph is intuitive enough that non-specialists can use it. The AI output is structured enough that they don't need deep AWS expertise to act on it.

## Core Metric

**MTTR to near-zero.** Every product decision should be evaluated against: does this help an SRE close an incident faster?

## Constraints (MVP)

- AWS only (Azure, GCP in Phase 4)
- Solo founder, ~2 hours/day
- 70-day MVP build target
- Must be agentless — no installation on customer infrastructure
- Must be read-only — zero write access to customer AWS accounts

## The Name

LiveInfra — live (real-time, active) + infra (infrastructure). The graph is live. The RCA is live. The blast radius is live. Not a snapshot. Not a diagram. Live.
