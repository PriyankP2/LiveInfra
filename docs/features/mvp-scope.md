# MVP Feature Scope

Target: 70 working days (~3.5 months at 2 hours/day). These are the only features that ship in MVP.

**Rule**: If it's not in this list, it does not ship in MVP, no matter how good the idea.

---

## In Scope (MVP)

### 1. AWS Account Onboarding
- IAM role creation wizard (step-by-step UI with CloudFormation template download)
- ExternalId generation and validation
- Single AWS account per customer
- Account health check: verify role works, verify Config is enabled, verify CloudTrail exists
- Onboarding completion in <5 minutes

### 2. Live Dependency Graph
- WebGL canvas via Sigma.js 3.x
- Node types: EC2, RDS, Lambda, ALB, SQS, SNS, S3, VPC, SecurityGroup, ECS, ElastiCache, EventBridge, StepFunctions, APIGateway, CloudFront
- Edge types: DEPENDS_ON, MEMBER_OF, PART_OF
- Layout: force-directed (Graphology ForceAtlas2)
- Zoom, pan, node selection
- Full-screen toggle
- Auto-refresh every 15 minutes (debounced, no disruptive re-layout)

### 3. Tag-Based App Isolation Filter

**The feature that makes one AWS account usable by multiple teams.** A single account can host a payment service, a data pipeline, and a batch processing system all tagged differently. Without isolation, the graph is an undifferentiated 500-node cloud.

- Filter panel (keyboard shortcut: `F`) opens above the graph canvas — does not replace graph
- **Tag filters**: `tag:app=payment-service`, `tag:env=prod`, `tag:team=platform` — any tag key/value pair on any AWS resource
- **Multi-filter stacking**: combine filters with AND logic — e.g., `tag:env=prod` + `tag:team=data` shows only the data team's production resources
- **Resource type filter**: checkboxes for EC2, RDS, Lambda, ALB, etc. — useful for "show me only the data tier"
- **Region filter**: scope to one or more AWS regions
- **VPC filter**: scope to one VPC — shows all resources in that network boundary
- All filtering is **in-memory on Zustand graph state** — no server round-trip, instant result
- Non-matching nodes are hidden (not dimmed) so the graph re-layouts to the filtered set
- Filter chip bar below topbar shows active filters — click chip to remove
- Clear all filters: single button restores full graph
- Active filter state persists for the browser session (not saved as a view — that's Phase 2)

### 4. Resource Detail Panel
- Slides in from right when node is selected
- Graph stays fully visible behind panel (panel overlays, does not push graph)
- Shows: ARN, instance type/class, state, tags, region, AZ, creation time
- Shows: direct dependencies (upstream + downstream, 1 hop only)
- Shows: security group membership
- **"Ask about this resource" button** — opens single-turn AI query pre-loaded with: node properties, direct neighbors, last 3 CloudTrail events. Returns plain-English explanation. Not a conversation — one question, one answer. Full chatbot is Phase 2.
- Close button returns to graph

### 5. Blast Radius Visualization
- Click any node → blast radius overlay activates
- Downstream nodes highlighted by severity color: red (critical), amber (degraded), yellow (at-risk), blue (monitoring)
- Severity score label on each highlighted node
- Hop count labels (Hop 1, Hop 2, Hop 3...)
- Non-affected nodes dimmed to 20% opacity
- Legend panel (bottom-left of graph)
- Toggle on/off
- Maximum 10 hops, minimum 1 hop

### 6. AI RCA Panel
- Triggered by: PagerDuty webhook, OpsGenie webhook, manual trigger from UI ("Run RCA" button on any node)
- Slides in from right, overlaid on graph
- Failing node highlighted with red pulse animation while analysis runs
- Token-by-token streaming display
- Fields rendered progressively: root_cause → confidence → evidence → remediation → what_i_dont_know
- Evidence items are clickable (opens raw CloudTrail event in side drawer)
- Confidence displayed as percentage + text label ("High confidence: 91%")
- what_i_dont_know section rendered prominently with warning styling
- RCA persisted to PostgreSQL (accessible in Incident History)

### 7. Incident Feed
- Real-time feed in sidebar (collapsible)
- Shows: incoming alert webhooks + manual RCA triggers
- Status: analyzing / complete / error
- Click incident → opens AI RCA panel for that incident
- Last 7 days of incidents visible
- Filter by resource type, severity

### 8. Authentication
- Clerk: email/password + Google OAuth
- MFA support (TOTP)
- Single tenant per account (no team seats in MVP — 1 login)
- Email verification required

### 9. Basic Dashboard
- Account summary: total resources scanned, last scan time, scanner health
- Top 5 highest blast-radius resources (sorted by max downstream severity)
- Recent incidents (last 24 hours)
- Quick-access links to graph, incident feed

### 10. Webhook Integration
- PagerDuty: V2 webhook listener
- OpsGenie: Alert action webhook
- CloudWatch Alarm: SNS → HTTPS endpoint
- Shared webhook secret per customer (HMAC validation)
- Webhook test button in settings

### 11. Settings
- AWS account connection management (add, validate, disconnect)
- Webhook endpoints (create, test, delete)
- AI RCA usage meter (calls used / monthly limit)
- Billing portal link (Stripe Customer Portal)

---

## Explicitly Out of Scope (MVP)

These are good ideas. They are not in MVP.

| Feature | Phase |
|---|---|
| Multiple AWS accounts per customer | Phase 2 |
| Saved views / named workspaces (persist a tag filter as "Payment Service") | Phase 2 |
| Graph-aware conversational chatbot (multi-turn, proactive exploration) | Phase 2 |
| Slack / GitHub notifications | Phase 2 |
| Infrastructure DVR (diff viewer) | Phase 2 |
| Drift detection alerts | Phase 2 |
| Multi-account IAM | Phase 2 |
| Kubernetes / EKS support | Phase 3 |
| CI/CD blast radius gate | Phase 3 |
| SOC 2 compliance report | Phase 3 |
| SSO / SAML | Phase 3 |
| RBAC (roles within a customer) | Phase 3 |
| Azure / GCP support | Phase 4 |
| eBPF network sensing | Phase 4 |
| Custom AI model fine-tuning | Phase 4 |
| API access for customers | Phase 3 |
| White-label / embedding | Phase 4 |

---

## MVP Success Criteria

At the end of 70 days, the MVP is complete when:

1. A new customer can connect their AWS account in <5 minutes
2. The dependency graph loads in <2 seconds for a 500-resource account
3. Blast radius query completes in <100ms for any selected node
4. An AI RCA completes in <8 seconds from alert webhook to first token in browser
5. 3 paying customers are using the product (even at reduced beta pricing)
6. Zero data leakage between customer accounts (isolation verified)
7. Scanner runs reliably for 7 consecutive days without manual intervention

---

## MVP Non-Goals

- **Not beautiful at first**: Graph functionality > visual polish. Tailwind + ShadCN components are fine. Custom illustrations and motion design come later.
- **Not scalable to 10,000 customers at launch**: Neo4j AuraDB Free tier, 5 scanner workers, single Vercel deployment. Scale when MRR justifies it.
- **Not self-serve**: Manual onboarding is fine for the first 3–5 customers. Self-serve billing comes in Phase 2.
