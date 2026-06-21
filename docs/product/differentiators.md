# World-Class Differentiators

Five properties that make LiveInfra genuinely different — not marketing language, but structural decisions that are hard to copy.

---

## 1. The Graph IS the RCA Interface

**What it means**: When an alert fires, the RCA doesn't open in a separate tab, a side panel with its own scrollable list, or a modal overlay that hides the graph. The blast radius illuminates on the live graph. The AI panel slides in anchored to the failing node. You navigate the RCA by clicking nodes on the graph.

**Why competitors can't copy it easily**: This requires the graph renderer and the AI output schema to be designed together. Sigma.js 3.x WebGL + the RCA JSON schema (`evidence[]` mapped to graph node IDs) + the blast radius severity coloring system must be co-designed from day one. Bolting this onto an existing APM tool means redesigning the fundamental UI paradigm.

**User experience**: An SRE gets paged at 2am. They open LiveInfra. The failing node is already pulsing red. The blast radius shows three downstream services highlighted amber. The AI panel shows the root cause — `RDS connection pool exhaustion, 47 upstream Lambda functions affected` — with each Lambda highlighted on the graph. They click a Lambda node and see exactly which one is causing the pile-up. MTTR: 4 minutes.

---

## 2. Transparent AI Evidence (Auditable RCA)

**What it means**: Every AI RCA response must include:
- `root_cause` — the specific failure hypothesis
- `confidence` — 0.0–1.0 with honest uncertainty ranges
- `evidence[]` — list of specific data points used (CloudTrail event IDs, flow log anomaly timestamps, Neo4j relationship edges)
- `what_i_dont_know` — explicit statement of gaps in available data
- `remediation[]` — ordered remediation steps
- `severity` — enum with reasoning

**Why it matters**: SREs are trained to be skeptical. If they can't audit why the AI concluded what it concluded, they won't trust it. Black-box AI that's wrong at 2am is worse than no AI — it creates false confidence and delays the correct diagnosis.

**Structural commitment**: The AI prompt forces structured JSON output. The UI makes evidence items clickable, linking directly to the raw CloudTrail event or flow log anomaly. An SRE can always trace the AI's reasoning back to source data.

**Differentiation from Davis (Dynatrace) and Watchdog (Datadog)**: Both produce black-box verdicts — "Dynatrace detected an anomaly in service X." No evidence trail. No confidence range. No gaps acknowledged. LiveInfra's transparency is a structural property, not a feature toggle.

---

## 3. Agentless Architecture

**What it means**: Zero installation on customer infrastructure. LiveInfra connects via a read-only IAM role. No agents, sidecars, eBPF probes, or DaemonSets required.

**Technical implementation**:
- IAM role with `ReadOnlyAccess` + `CloudTrailReadOnly` + `VPCFlowLogsRead`
- ExternalId per customer prevents confused deputy attacks
- Multi-account via Organization master or individual role assumptions
- EKS: EKS Access Entry API (EKS 1.28+) — RBAC via IAM, no `aws-auth` ConfigMap editing

**Business impact**:
- Onboarding in <5 minutes vs. hours/days for OneAgent deployment
- No production risk from installation — a misconfigured agent can cause outages; a misconfigured IAM role cannot
- Enterprise security teams approve IAM roles easily; they require months of review for new agents in production

**Contrast**: Dynatrace OneAgent must be installed on every EC2 instance, EKS node, and Lambda layer. At 500 hosts, that's 500 installation events, 500 agent upgrade cycles, and 500 potential failure points. LiveInfra has zero.

---

## 4. Pre-Incident Blast Radius as Planning Tool

**What it means**: Blast radius isn't only for active incidents. Before any deployment, change, or maintenance window, engineers can select any node on the graph and see the full downstream impact — which services depend on it, what severity score each gets, how many hops away they are.

**Algorithm**:
```
score = (1.0 / hop_count) × resource_type_multiplier × traffic_volume_multiplier
→ clamp(0.0, 1.0)
```

Resource multipliers: RDS ×3.0, ALB ×2.5, EC2 ×2.0, Lambda ×1.5, SQS ×1.2, S3 ×0.8

**Use cases**:
- "If I take this RDS instance offline for maintenance tonight, what breaks?" → Blast radius shows 47 Lambdas, 3 EC2 services, 1 ALB
- "What's the safest order to drain these services?" → Sort by blast radius score descending
- "Which single resource, if it failed, would cause the most cascading damage?" → Max blast radius query across all nodes

**Contrast**: Competitors show blast radius only after an incident has started (reactive). LiveInfra makes it a proactive planning tool (pre-incident), which is where the real value is — preventing outages is worth more than reducing MTTR.

---

## 5. Open-Source Community Flywheel (MIT Scanner)

**What it means**: The core AWS scanner (CloudTrail reader, Config aggregator, relationship extractor) is published as an open-source MIT-licensed CLI tool. Anyone can install it, run it against their AWS account, and get a JSON graph output. The SaaS product is the hosted graph, AI RCA, real-time streaming, and team collaboration layer on top.

**Why open-core not freemium**:
- Freemium means every free user costs real Neo4j, scanner worker, and Claude API spend
- Enterprise SRE teams can't self-authorize a "free trial" — they need a PO and a security review
- Open-core means the scanner can be evaluated behind a firewall without any account creation
- The scanner being MIT creates GitHub stars, blog posts, developer awareness, and community PRs — all of which drive paid conversions

**Flywheel mechanics**:
1. SRE finds MIT scanner on GitHub while searching for AWS Config tooling
2. Runs it locally against their account, gets impressed by graph output quality
3. Shares it internally — "this is better than our homegrown Config parser"
4. Team wants the real-time hosted version + AI RCA → becomes a paid customer
5. Some engineers contribute edge case fixes to the scanner → improves the product for everyone

**Contrast**: Datadog and Dynatrace are entirely closed. Their scanners are black boxes. LiveInfra's open-source scanner creates an inspection and contribution surface that enterprise tools fundamentally cannot offer.
