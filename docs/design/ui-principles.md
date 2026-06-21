# UI Principles & Spatial Design

## The Core Constraint

**The graph occupies 75–80% of the viewport at all times.** This is not a layout preference — it's the foundational product decision. Every other UI element must be designed to not replace, obscure, or minimize the graph.

This constraint drives every other design decision.

---

## Principle 1: Everything Is Spatial

RCA, blast radius, and incident context are all anchored to the graph. The user's mental model of their infrastructure is spatial — "the RDS is in the middle, the Lambdas connect from the left." LiveInfra reinforces that model rather than replacing it with a list or table.

**What this means in practice**:
- AI RCA panel slides in as an overlay, graph stays visible behind it
- Blast radius colors appear on the graph nodes themselves, not in a separate table
- When an incident is active, the camera animates to center on the failing node
- Clicking a resource in the RCA evidence list navigates to that node on the graph

**What this forbids**:
- No full-page modal that hides the graph
- No separate "topology view" tab — there is only the graph
- No list-based incident view that is disconnected from the graph

---

## Principle 2: Overlay, Don't Replace

Panels (Resource Detail, AI RCA, Incident Feed) are overlaid on the graph, not replacing it. The graph is always visible behind any open panel.

**Implementation**: Panels are positioned absolutely over the graph canvas with a semi-transparent dark backdrop effect. The Sigma.js canvas continues to render (and remains interactive) behind the panel. Clicking nodes behind an open panel navigates to that node and closes the current panel.

**Panel width**: Maximum 40% of viewport width. On viewports below 1200px, panels can go up to 50%. Never full-width.

---

## Principle 3: Dark Mode First (Not Dark Mode Optional)

SREs use LiveInfra during incidents, often at 2am in dark environments. Dark mode is the only mode. There is no light mode. This is not a missing feature — it's a product decision.

**Color system**:
```
Background:      #0a0e1a  (deep navy-black)
Surface 1:       #0d1117  (cards, panels)
Surface 2:       #111827  (elevated elements)
Border:          #1f2937  (subtle dividers)
Text primary:    #f1f5f9  (headings, important values)
Text secondary:  #94a3b8  (labels, metadata)
Text tertiary:   #64748b  (timestamps, placeholders)
```

**Semantic colors**:
```
Critical:        #ef4444  (node pulse, severity critical)
High:            #f59e0b  (warning, degraded)
At-Risk:         #eab308  (yellow, monitoring needed)
Healthy/AI:      #10b981  (healthy nodes, AI elements)
Accent:          #3b82f6  (primary interactive elements, DEPENDS_ON edges)
Purple:          #8b5cf6  (enterprise features, Phase 3)
```

---

## Principle 4: Latency is a Design Decision

Every interaction has a latency budget. Visual feedback must appear within 100ms even when the data isn't ready.

| Interaction | Data Latency | Visual Feedback Within |
|---|---|---|
| Node click | Instant (in-memory) | 0ms |
| Blast radius toggle | <100ms (Neo4j query) | 0ms (optimistic highlight) |
| AI RCA trigger | <8s (full pipeline) | 100ms (spinner + node pulse) |
| Graph initial load | <2s (tRPC + graph data) | 200ms (skeleton canvas) |
| Resource detail panel | Instant (in-memory) | 0ms |
| Search/filter | Instant (in-memory) | 0ms |

**Optimistic blast radius**: When the user clicks a node to trigger blast radius, apply a 20% opacity dim to all other nodes immediately (0ms). Then apply the severity color highlights as the Neo4j query returns (<100ms). This makes the interaction feel instant even though the severity data takes ~100ms.

---

## Principle 5: Information Density Without Clutter

The graph canvas is dense. Up to 500 nodes in the MVP. Visual noise kills usability.

**Node visual hierarchy**:
1. Node size = degree (number of direct connections). High-connectivity nodes (like RDS shared by many Lambdas) are visually larger — they are also highest-blast-radius targets.
2. Node color = type (EC2 blue, RDS purple, Lambda green, ALB orange, etc.)
3. Node label = name property from AWS tags (e.g., "prod-api-db"), truncated to 20 chars
4. Labels only visible at zoom level > 1.2× (not rendered at full-zoom-out to reduce clutter)
5. Edges only shown for direct dependencies (DEPENDS_ON), not VPC membership (PART_OF) at default zoom — membership edges toggled on demand

**Canvas controls** (floating, bottom-left):
- Zoom in / Zoom out / Reset zoom
- Fit to screen
- Toggle edge labels
- Toggle VPC grouping
- Blast radius toggle
- Legend

---

## Principle 6: The AI Panel Must Show Uncertainty

The AI RCA panel has a specific visual contract:

1. **Root cause** appears first, large text, easy to scan
2. **Confidence meter** is displayed as a fill bar + percentage. Colors: green (>80%), amber (50–80%), red (<50%)
3. **Evidence list** is expandable — each item has a clickable link to raw data
4. **What I Don't Know** section uses amber/warning styling — it is never hidden, never collapsed by default, never rendered in smaller text than the root cause
5. **Remediation steps** are numbered, ordered, and copy-pasteable (the shell commands need to be copyable)

**The anti-pattern to avoid**: Showing only the root cause and hiding the gaps. Black-box confidence ("99% confidence") with no evidence trail. These are the failure modes of existing AI tools — LiveInfra explicitly rejects them.

---

## Principle 7: Zero Onboarding Friction

The first interaction with LiveInfra is the IAM role wizard. It must require:
- Zero AWS CLI commands (CloudFormation handles it)
- Zero JSON editing
- Zero contacting LiveInfra support
- <5 minutes from signup to first graph

**Wizard structure**:
1. Enter AWS Account ID → auto-generate ExternalId → show copy button
2. "Deploy IAM Role" button → opens AWS CloudFormation console with pre-populated template URL
3. Instructions: "Click 'Create stack', wait ~2 minutes, come back here"
4. "Verify Connection" button → tests STS AssumeRole → shows success/failure with specific error message
5. Success → first scan triggers automatically → progress bar shows scan completion
6. Graph loads → confetti animation → "Your infrastructure is live"

---

## Layout Specification

```
┌─────────────────────────────────────────────────────────────┐
│ TOPBAR: Logo | Account selector | Search bar         [User] │
├────────────┬────────────────────────────────────────────────┤
│            │                                                 │
│ SIDEBAR    │           GRAPH CANVAS (75–80%)                │
│ (collapsible│                                               │
│ 240px)     │    [Sigma.js WebGL canvas]                     │
│            │                                                 │
│ • Incidents │    Canvas controls: zoom/reset/legend         │
│   feed     │    (floating bottom-left)                      │
│            │                                                 │
│ • Nav:     │                                                 │
│   Dashboard│    ┌─────────────────────┐                     │
│   Graph    │    │ PANEL (overlay)     │  ← max 40% width    │
│   Settings │    │ Resource Detail     │                     │
│            │    │ OR AI RCA           │                     │
│            │    │ (graph visible      │                     │
│            │    │  behind panel)      │                     │
│            │    └─────────────────────┘                     │
└────────────┴────────────────────────────────────────────────┘
```

**Sidebar**: Collapses to icon-only mode (48px wide) when user wants more graph space. Keyboard shortcut: `Cmd+B` / `Ctrl+B`.

**Topbar**: 52px height. Minimal — only logo, account selector, global search, user avatar.

**Graph canvas**: Stretches to fill remaining space. No fixed width. No sidebar by default on screens < 1400px.

---

## Animation Principles

- **Node pulse**: Failing node → slow radial pulse (CSS animation, 1.5s loop, scale 1.0→1.15→1.0), red color
- **Blast radius reveal**: Staggered highlight, hop 1 first (50ms), hop 2 (150ms), hop 3 (250ms) — creates visual "ripple" effect of consequence
- **Panel slide**: 200ms ease-out from right edge. Not a fade — slides in so the user tracks where it came from
- **RCA streaming**: Text renders token-by-token, creating a "typing" effect. No artificial delay — tokens render as Claude generates them
- **Graph refresh**: New nodes fade in over 400ms. Changed nodes pulse once. Deleted nodes fade out over 600ms. Layout does not re-run.
- **No loading spinners on graph canvas**: If data is loading, show skeleton node placeholders at approximate positions from cached layout, not a blank canvas + spinner
