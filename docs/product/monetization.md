# Monetization Strategy

## Why Not Freemium

Every free user in a real infrastructure tool has non-trivial compute costs:
- Neo4j AuraDB: charged by memory tier, not by user count
- Scanner workers: BullMQ jobs run against real AWS accounts
- Claude API: $0.01–0.03 per RCA call at claude-sonnet-4-6 rates

With a 3–5% freemium-to-paid conversion rate, 95+ free users subsidize every paying customer. At infrastructure tool margins, this math doesn't work without significant VC backing.

The deeper problem: enterprise SRE teams don't self-authorize "free trials." Procurement requires a PO, a security review, and often a vendor questionnaire. A free tier doesn't shortcut this — it just adds support load from non-converting users.

## The Model: Open-Core + Usage-Based SaaS

**Open-core component (MIT license)**:
- `liveinfra-scanner` CLI — reads AWS Config, CloudTrail, VPC Flow Logs
- Outputs JSON graph: nodes (resources), edges (relationships), metadata
- Publishable on GitHub, npm, and Homebrew
- No cloud account required to evaluate

**SaaS tiers**:

### Starter — $299/month
- Up to 2 AWS accounts
- Up to 500 resources per account
- Graph visualization + real-time updates (15-minute refresh)
- Basic blast radius (3-hop limit)
- AI RCA: 50 calls/month included
- 1 team seat
- Email support

### Growth — $699/month
- Up to 10 AWS accounts
- Up to 5,000 resources per account
- Full blast radius (10-hop, traffic-volume-weighted)
- AI RCA: 500 calls/month included
- Drift detection (compare snapshots, alert on changes)
- PagerDuty + OpsGenie + Slack integration
- 5 team seats
- Slack support

### Enterprise — $1,499+/month (custom)
- Unlimited accounts
- Unlimited resources
- AI RCA: unlimited (flat rate)
- SOC 2 Type II report
- SSO/SAML (Okta, Azure AD)
- RBAC (read-only viewer, incident responder, admin)
- CI/CD blast radius gate (GitHub Actions integration)
- Dedicated Slack channel + SLA
- Custom onboarding

### AI RCA Overage
- $0.05 per RCA call beyond included quota
- Billed monthly, visible in dashboard
- Can set monthly cap to prevent surprise charges

## Annual Discount
- 20% discount for annual pre-payment
- Starter annual: $2,872/year (vs $3,588 monthly)
- Growth annual: $6,710/year (vs $8,388 monthly)

## Revenue Targets

| Phase | Target | Notes |
|---|---|---|
| MVP launch (M3) | 3 paying customers | Beta pricing, manual onboarding OK |
| Phase 2 (M6) | $10K MRR | ~14 Starter / 8 Growth customers |
| Phase 3 (M12) | $100K ARR | ~5 Enterprise + 20 Growth customers |
| Phase 4 (Year 2) | $500K ARR | Multi-cloud expansion |

## GTM Strategy

**Channel 1: Open-source scanner flywheel**
GitHub → HN/Reddit posts → Engineering blog → Demo video → SaaS trial request

**Channel 2: Build in public**
Twitter/X (@founder) + LinkedIn posts showing real-time graph screenshots, AI RCA demo clips, blast radius in action. Target: SRE, Platform Engineering, DevOps communities.

**Channel 3: Product Hunt launch**
At MVP completion. Target: #1 of the day in Developer Tools.

**Channel 4: Content**
Postmortems and RCA deep-dives that demonstrate how LiveInfra would have caught the issue faster. AWS incident case studies.

**Channel 5: Integrations**
PagerDuty Marketplace listing and OpsGenie App listing both drive inbound from teams already on those platforms.

## Unit Economics

| Metric | Target |
|---|---|
| CAC (blended) | <$500 |
| LTV (Growth customer) | $8,388/year avg × 3-year retention = $25K |
| LTV:CAC | >50:1 |
| Gross margin | ~80% (cloud costs ~$80/account/month) |
| Payback period | <2 months |

## What We Will Not Do

- No freemium tier — every user costs real money and doesn't convert
- No per-seat pricing — SRE teams share one login during incidents; per-seat punishes the right use case
- No usage-based billing for the core graph — unpredictable bills kill adoption
- No feature paywalling of security-critical features — if blast radius helps prevent an outage, it should be in every tier
