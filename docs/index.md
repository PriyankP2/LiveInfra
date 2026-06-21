# LiveInfra Documentation

> The agentless AWS infrastructure analyzer with graph-first AI-native RCA. Built for mid-market SRE and Platform teams who need to cut MTTR to near-zero.

## Quick Reference

| What | Where |
|---|---|
| Product vision & market | [product/vision.md](product/vision.md) |
| Competitive landscape | [product/competitive-landscape.md](product/competitive-landscape.md) |
| 5 world-class differentiators | [product/differentiators.md](product/differentiators.md) |
| Pricing & monetization | [product/monetization.md](product/monetization.md) |
| 47 SRE failure scenarios | [product/problem-inventory.md](product/problem-inventory.md) |
| System architecture overview | [architecture/overview.md](architecture/overview.md) |
| Full tech stack decisions | [architecture/tech-stack.md](architecture/tech-stack.md) |
| Graph engine & Neo4j schema | [architecture/graph-engine.md](architecture/graph-engine.md) |
| AI RCA pipeline | [architecture/ai-rca-pipeline.md](architecture/ai-rca-pipeline.md) |
| AWS scanner design | [architecture/aws-scanner.md](architecture/aws-scanner.md) |
| MVP feature scope | [features/mvp-scope.md](features/mvp-scope.md) |
| Top 10 features deep-dive | [features/top-10-features.md](features/top-10-features.md) |
| Phase roadmap | [features/roadmap.md](features/roadmap.md) |
| UI principles & spatial design | [design/ui-principles.md](design/ui-principles.md) |
| 70-day MVP build plan | [engineering/build-plan.md](engineering/build-plan.md) |
| Database schema | [engineering/database-schema.md](engineering/database-schema.md) |

## Diagrams

| Diagram | File |
|---|---|
| System architecture (5-layer) | [diagrams/system-architecture.svg](diagrams/system-architecture.svg) |
| Data pipeline (AWS → UI) | [diagrams/data-pipeline.svg](diagrams/data-pipeline.svg) |
| Neo4j graph schema | [diagrams/graph-schema.svg](diagrams/graph-schema.svg) |
| Blast radius algorithm | [diagrams/blast-radius-algorithm.svg](diagrams/blast-radius-algorithm.svg) |
| AI RCA pipeline | [diagrams/ai-rca-pipeline.svg](diagrams/ai-rca-pipeline.svg) |
| Product roadmap (4 phases) | [diagrams/product-roadmap.svg](diagrams/product-roadmap.svg) |
| Competitive landscape | [diagrams/competitive-landscape.svg](diagrams/competitive-landscape.svg) |

## One-line Summary

LiveInfra connects to your AWS account via a read-only IAM role (agentless), builds a live dependency graph in Neo4j, and when something breaks, triggers an AI RCA pipeline (Claude claude-sonnet-4-6) that returns a structured root-cause analysis with evidence — all surfaced spatially on the same graph. No agents to install, no black-box output, no $150K/yr commitment.
