# Competitive Landscape

See also: [diagrams/competitive-landscape.svg](../diagrams/competitive-landscape.svg)

## The Gap

The 2×2 matrix positions competitors on two axes:
- **X: Price / Budget Accessibility** — free OSS on the left, $150K+/yr enterprise on the right
- **Y: Intelligence / AI-Native Capability** — static diagrams at the bottom, AI-native RCA at the top

**The top-right-center quadrant is empty**: mid-market price ($299–$899/mo) + AI-native capability. That is where LiveInfra sits.

## Competitor Analysis

### Cloudcraft ($99/mo, acquired by Datadog)
- **What it does**: Drag-and-drop AWS architecture diagrams, auto-import from AWS
- **Fatal flaw**: Zero AI. Zero incident intelligence. "Useless at 2am" — accurate description from SRE communities
- **Acquisition note**: Datadog buying it signals they see the gap too, but integration will take years and will be bundled into Datadog pricing

### Hava.io ($79/mo)
- **What it does**: Automated AWS diagram generation, compliance views, network diagrams
- **Fatal flaw**: No incident integration, no AI, no blast radius. Diagrams drift from reality when infra changes between scans
- **SRE verdict**: "Looks nice, useless when things break"

### Lucidscale (enterprise priced)
- **What it does**: Multi-cloud visualization, syncs from Terraform/AWS, team collaboration
- **Fatal flaw**: Diagram tool only. No AI, no incident integration, not built for on-call use
- **Pricing**: Enterprise gate means no self-serve trial for mid-market

### Backstage (OSS, Spotify)
- **What it does**: Developer portal with service catalog, manual YAML configuration
- **Fatal flaw**: Catalog drifts from reality. Engineers must manually update YAML when infra changes. No live AWS scanning. Not built for incidents
- **Use case mismatch**: Backstage is for developer experience, not incident response

### Steampipe (free, OSS)
- **What it does**: SQL interface to cloud APIs, hundreds of plugins, policy-as-code
- **Fatal flaw**: SQL-only, no visualization, no AI RCA, requires engineering time to build queries
- **Positioning**: Complementary tool, not a competitor. SREs who use Steampipe would still need LiveInfra

### CloudMapper (free, abandoned)
- **What it does**: CLI-based AWS network diagram generator
- **Fatal flaw**: Last commit years ago. No AI. No real-time. Requires technical setup
- **Status**: Dead project. Still appears in search results, creating false "solution exists" impression

### AWS DevOps Agent (GA 2026)
- **What it does**: AI-powered DevOps assistant native to AWS Console, powered by Amazon Bedrock
- **Fatal flaws**:
  - Reactive only — responds to prompts, doesn't proactively surface blast radius
  - No dependency graph visualization
  - Black-box Bedrock model — no evidence trail, no auditability
  - AWS-only console lock-in — won't work for teams using GCP/Azure alongside AWS
  - No customization path for enterprise-specific runbooks
- **Threat level**: Medium. Will capture casual users. Won't satisfy teams who need auditable AI or graph-first UX

### Datadog ($15–23/host/month)
- **What it does**: Full observability — APM, logs, metrics, infrastructure maps, Watchdog AI
- **Fatal flaws**:
  - Watchdog AI covers only ~4 pre-defined RCA types (anomaly detection, OOTB correlations)
  - Infrastructure map is shallow — doesn't model cross-service AWS relationships (Lambda→RDS dependencies, SQS→Lambda event triggers)
  - Pricing becomes punishing at 500+ hosts
  - Graph and AI are separate surfaces — no unified spatial RCA
- **Threat level**: High. Most mid-market teams already use Datadog. LiveInfra must integrate with it (PagerDuty/OpsGenie webhook) not compete for mindshare

### New Relic (enterprise priced)
- **What it does**: Full observability platform with APM, logs, AI observability features
- **Fatal flaws**: Separate tabs for graph and AI; high price; AI features are still add-on rather than primary interface
- **Threat level**: Low. Overlaps with Datadog in positioning

### Dynatrace ($150K+/yr)
- **What it does**: The only true competitor — Smartscape dependency topology + Davis AI RCA + blast radius
- **Fatal flaws**:
  - OneAgent must be installed on every host (not agentless)
  - $150K+/yr minimum — inaccessible to mid-market
  - Davis AI is a black box — no evidence trail SREs can audit
  - 90-minute average problem closure time despite AI
  - Lock-in is severe — removing OneAgent requires significant migration effort
- **Key distinction**: Dynatrace PROVES the market exists. The gap is not "nobody does this" — it's "nobody does this agentlessly at $299–$899/mo with transparent AI"
- **Threat level**: Low for now (different buyer). High if they launch a SMB tier

## Precise Competitive Gap Statement

> "No agentless, mid-market-priced ($299–$899/mo), graph-first, AI-native RCA tool exists for AWS today. Dynatrace proves the market is real at enterprise pricing. The mid-market is underserved."

This framing is more defensible than "nobody does both" (which is incorrect — Dynatrace does both).

## Moats

1. **Graph-first UX** — patent-defensible interaction model where blast radius and RCA surface spatially on the graph, not in separate tabs
2. **Transparent AI** — `evidence[]` + `what_i_dont_know` fields are a structural commitment to auditability that black-box systems can't replicate
3. **Agentless architecture** — zero-friction onboarding (<5 min) versus hours for OneAgent deployment
4. **MIT scanner flywheel** — open-source scanner creates community contribution loop and awareness that paid SaaS can't replicate
5. **Mid-market price point** — structural commitment to $299–$899/mo makes it defensible against enterprise vendors moving downmarket (they'd cannibalize high-margin seats)
