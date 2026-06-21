# SRE/DevOps Problem Inventory

47 failure scenarios mapped across 12 categories. For each: problem statement, how LiveInfra addresses it, and which phase delivers the solution.

---

## Category 1: Incident Response & RCA

| # | Problem | LiveInfra Solution | Phase |
|---|---|---|---|
| 1 | Can't identify root cause during active outage — teams spend 45–90 min correlating logs across tabs | AI RCA pipeline: graph context + CloudTrail + flow logs → structured root cause in <8 seconds | MVP |
| 2 | Cascading failures not predicted — fixing the wrong service first while dependents pile up | Blast radius visualization before any remediation action | MVP |
| 3 | No audit trail of AI recommendations — SREs can't validate what the AI concluded or why | `evidence[]` + `what_i_dont_know` fields in every RCA, clickable to raw source data | MVP |
| 4 | Alert fatigue — 200 alerts fire simultaneously, no way to identify the causal chain | Graph shows which node is the root vs. downstream symptom by hop distance | MVP |
| 5 | Different SREs reach different conclusions from same data — inconsistency across incidents | Shared graph + shared AI RCA visible to entire team simultaneously | MVP |
| 6 | On-call engineers don't have deep AWS knowledge — junior SREs struggle to interpret raw CloudTrail | AI RCA translates technical events into plain-English root cause with severity context | MVP |
| 7 | Post-incident reviews take days because no one documented what was checked | AI RCA + evidence trail auto-generates the incident timeline | Phase 2 |

---

## Category 2: Dependency Mapping & Topology

| # | Problem | LiveInfra Solution | Phase |
|---|---|---|---|
| 8 | No live map of what depends on what — architecture diagrams are stale from day 1 | Real-time graph rebuilt from AWS Config every 15 minutes, not maintained manually | MVP |
| 9 | Unknown cross-account dependencies — shared services break when assuming account-level isolation | Multi-account graph stitching — DEPENDS_ON edges span account boundaries | Phase 2 |
| 10 | Can't answer "what breaks if I take this service down for maintenance?" before doing it | Pre-incident blast radius query against any node | MVP |
| 11 | Lambda event source mappings not visible in standard AWS Console views | Direct SDK supplementation for Lambda event source mappings (beyond AWS Config) | MVP |
| 12 | EventBridge routing is a black box — which rules target which services? | EventBridge rule target extraction included in scanner | MVP |
| 13 | API Gateway → Lambda → RDS dependency chains invisible at VPC level | Full dependency chain modeled: API Gateway VPC Link → Lambda → RDS via DEPENDS_ON edges | MVP |
| 14 | Step Functions task ARNs not reported in Config inventory | Targeted SDK call for Step Functions to extract task ARNs | MVP |
| 15 | ECS container IPs churn constantly — traffic attribution to service is impossible | ENI→ResourceID cache with 5-min refresh, VPC Flow Log parser maps ENI to ECS task | MVP |

---

## Category 3: Change Impact Assessment

| # | Problem | LiveInfra Solution | Phase |
|---|---|---|---|
| 16 | Deployment blast radius unknown — engineers push to prod without knowing downstream impact | CI/CD blast radius gate: GitHub Actions step blocks deployment if blast radius score > threshold | Phase 3 |
| 17 | Database migrations affect unknown set of services | Blast radius from RDS node shows all services that have active connections | MVP |
| 18 | Security group changes have unpredictable connectivity impact | MEMBER_OF edges model SG membership; blast radius from SG node shows all affected resources | MVP |
| 19 | IAM policy changes affect services in ways not visible in IAM Console | Phase 3 — IAM graph layer beyond MVP scope | Phase 3 |
| 20 | Infrastructure drift between Terraform plan and actual deployed state | Drift detection: compare Neo4j current state vs. last snapshot, alert on topology changes | Phase 2 |

---

## Category 4: Capacity & Performance

| # | Problem | LiveInfra Solution | Phase |
|---|---|---|---|
| 21 | RDS connection pool exhaustion cascades to 100+ Lambda functions | Blast radius from RDS node + AI RCA identifies connection pool saturation via CloudWatch metrics | MVP |
| 22 | ALB target group health not correlated with downstream service impact | ALB node in graph with DEPENDS_ON edges to EC2/ECS targets — health propagates | MVP |
| 23 | Lambda cold start spikes correlate with upstream traffic surges — root cause unclear | Flow log anomaly detection flags traffic surge; CloudTrail shows Lambda invocation rate | MVP |
| 24 | SQS queue depth growing but unclear which Lambda consumer is lagging | DEPENDS_ON edges: SQS→Lambda event source mapping; queue depth in node metadata | MVP |
| 25 | ElastiCache eviction rate spiking but unclear which services are affected | Cache node in graph with DEPENDS_ON edges to all services that read from it | MVP |

---

## Category 5: Network & Connectivity

| # | Problem | LiveInfra Solution | Phase |
|---|---|---|---|
| 26 | Can't distinguish whether traffic is blocked by Security Group vs. NACL | VPC Flow Log parser captures REJECT decisions; graph shows both SG and NACL membership | MVP (partial) |
| 27 | Cross-VPC traffic failures — VPC Peering and Transit Gateway routing unclear | VPC, subnet, PART_OF edges model cross-VPC topology | MVP |
| 28 | PrivateLink endpoint connectivity failures — which services share the endpoint? | API Gateway VPC Link modeled in scanner | MVP |
| 29 | IPv6 dual-stack misconfiguration — services can't reach each other across stack versions | Phase 3 — network policy analysis beyond MVP | Phase 3 |
| 30 | VPN tunnel flapping causes intermittent connectivity — hard to correlate with application errors | CloudTrail events for VPN tunnel state changes modeled in temporal context | Phase 2 |

---

## Category 6: Security & Compliance

| # | Problem | LiveInfra Solution | Phase |
|---|---|---|---|
| 31 | Public S3 bucket exposed — blast radius of who reads from it is unknown | S3Bucket node with DEPENDS_ON edges; blast radius shows all services reading the bucket | MVP |
| 32 | Over-permissive Security Group allows port 0.0.0.0/0 — which services are exposed? | SG membership edges show all EC2/Lambda in the SG | MVP |
| 33 | CloudTrail disabled in a region — security team has no audit trail | Scanner flags missing CloudTrail coverage during account scan | MVP |
| 34 | IAM role with Admin permissions attached to public-facing Lambda | Phase 3 — IAM security graph layer | Phase 3 |
| 35 | Compliance audit requires evidence of all data flows between services | Graph export for compliance evidence; dependency edges show all data paths | Phase 3 |
| 36 | SOC 2 requires change management evidence — who changed what and when | CloudTrail temporal layer provides change history; AI RCA creates audit-ready timeline | Phase 3 |

---

## Category 7: Kubernetes & EKS

| # | Problem | LiveInfra Solution | Phase |
|---|---|---|---|
| 37 | EKS pod network policies block inter-pod communication — hard to debug | EKS Access Entry API for agentless RBAC; namespace/pod topology in graph | Phase 3 |
| 38 | EKS node group scaling causes ENI churn — VPC Flow Logs lose attribution | ENI→pod cache refresh every 5 min via EKS API + VPC Flow Logs cross-reference | MVP (ECS only in MVP, EKS in Phase 3) |
| 39 | Helm chart deployment breaks downstream services — blast radius unknown pre-deploy | Kubernetes resource graph + blast radius for namespace-level deployments | Phase 3 |
| 40 | EKS control plane API server throttling — hard to correlate with pod scheduling failures | CloudWatch + EKS API server logs in temporal context | Phase 3 |

---

## Category 8: Multi-Account & Organization

| # | Problem | LiveInfra Solution | Phase |
|---|---|---|---|
| 41 | Shared services account hosts RDS used by 5 product accounts — no unified view | Multi-account role assumption + cross-account DEPENDS_ON edges | Phase 2 |
| 42 | Organization-level Config aggregator requires master account trust — complex IAM setup | Built-in multi-account IAM onboarding wizard with ExternalId per customer | Phase 2 |
| 43 | CloudTrail events from cross-account calls require stitching across trails | Cross-account CloudTrail stitching in temporal context layer | Phase 2 |

---

## Category 9: Serverless & Event-Driven

| # | Problem | LiveInfra Solution | Phase |
|---|---|---|---|
| 44 | EventBridge rules fire into multiple targets — which Lambda failed? | EventBridge rule→target edges in graph; CloudTrail shows invocation failures | MVP |
| 45 | SNS fan-out to 50 SQS queues — one consumer failures affects unknown set | SNS→SQS DEPENDS_ON edges; blast radius from SNS node | MVP |
| 46 | Step Functions workflow failure — which state caused the failure? | Step Functions task ARN extraction; CloudTrail shows state machine history | MVP |

---

## Category 10: Observability Gaps

| # | Problem | LiveInfra Solution | Phase |
|---|---|---|---|
| 47 | CloudWatch metrics exist but no tool correlates them with dependency graph position | Neo4j nodes carry CloudWatch metric references; AI RCA fetches relevant metrics during context building | Phase 2 |

---

## Coverage Summary

| Category | MVP | Phase 2 | Phase 3 | Phase 4 |
|---|---|---|---|---|
| Incident Response & RCA | 6/7 | 1/7 | — | — |
| Dependency Mapping | 8/8 | 1/8 | — | — |
| Change Impact | 3/5 | 1/5 | 1/5 | — |
| Capacity & Performance | 5/5 | — | — | — |
| Network & Connectivity | 3/5 | 1/5 | 1/5 | — |
| Security & Compliance | 2/6 | — | 4/6 | — |
| Kubernetes/EKS | 0/4 | — | 4/4 | — |
| Multi-Account | 0/3 | 3/3 | — | — |
| Serverless/Event-Driven | 3/3 | — | — | — |
| Observability Gaps | 0/1 | 1/1 | — | — |

MVP covers ~65% of the highest-frequency SRE failure scenarios. The remaining 35% are addressable in Phase 2–3.
