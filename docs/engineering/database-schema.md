# Database Schema

Two databases: Neo4j AuraDB (graph topology) + PostgreSQL via Supabase (everything else).

---

## Neo4j AuraDB — Graph Topology

See [architecture/graph-engine.md](../architecture/graph-engine.md) for full node/edge type reference.

### Constraints & Indexes

```cypher
-- Primary uniqueness constraint (acts as index too)
CREATE CONSTRAINT resource_unique_per_customer
  ON (r:Resource) ASSERT (r.id, r.customer_id) IS NODE KEY;

-- Customer-scoped queries
CREATE INDEX resource_by_customer FOR (r:Resource) ON (r.customer_id);

-- Region-scoped queries (used in filter panel)
CREATE INDEX resource_by_region FOR (r:Resource) ON (r.region, r.customer_id);

-- Stale node detection (pruning job)
CREATE INDEX resource_by_last_seen FOR (r:Resource) ON (r.customer_id, r.last_seen);

-- Name search
CREATE TEXT INDEX resource_name_search FOR (r:Resource) ON (r.name);
```

### Core Write Pattern

```cypher
MERGE (r:Resource {id: $id, customer_id: $customer_id})
SET r += {
  name: $name,
  type: $type,
  region: $region,
  account_id: $account_id,
  last_seen: datetime(),
  tags: $tags,
  properties: $properties
}
```

**Hard rule**: Only `SET r += {...}` (upsert), never `CREATE`. Neo4j stores current state only.

---

## PostgreSQL via Supabase

### Table: `customers`

```sql
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  name TEXT,
  tier TEXT NOT NULL DEFAULT 'starter' CHECK (tier IN ('starter', 'growth', 'enterprise')),
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT,
  rca_calls_this_month INT NOT NULL DEFAULT 0,
  rca_calls_limit INT NOT NULL DEFAULT 50,  -- 50 for starter, 500 for growth, -1 for enterprise (unlimited)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX customers_clerk_user_id ON customers(clerk_user_id);
```

### Table: `aws_accounts`

```sql
CREATE TABLE aws_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL,  -- AWS Account ID (12-digit number)
  account_alias TEXT,        -- Human-readable name
  role_arn TEXT NOT NULL,    -- arn:aws:iam::123456789:role/liveinfra-scanner
  external_id TEXT NOT NULL, -- UUID, unique per customer per account
  regions TEXT[] NOT NULL DEFAULT ARRAY['us-east-1'],  -- Regions to scan
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'error', 'disconnected')),
  last_scan_at TIMESTAMPTZ,
  last_scan_duration_sec INT,
  last_scan_resource_count INT,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(customer_id, account_id)
);

CREATE INDEX aws_accounts_customer_id ON aws_accounts(customer_id);
CREATE INDEX aws_accounts_status ON aws_accounts(status, customer_id);
```

### Table: `incidents`

```sql
CREATE TABLE incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('pagerduty', 'opsgenie', 'cloudwatch', 'manual')),
  source_incident_id TEXT,  -- PagerDuty incident ID, OpsGenie alert ID, etc.
  title TEXT NOT NULL,
  severity TEXT CHECK (severity IN ('critical', 'high', 'medium', 'low', 'info')),
  resource_arn TEXT,        -- Resolved ARN (nullable if not found)
  resource_id TEXT,         -- Neo4j node ID
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'analyzing', 'resolved', 'error')),
  raw_payload JSONB,        -- Full webhook payload for debugging
  triggered_at TIMESTAMPTZ NOT NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX incidents_customer_id ON incidents(customer_id, triggered_at DESC);
CREATE INDEX incidents_resource_arn ON incidents(customer_id, resource_arn);
CREATE INDEX incidents_status ON incidents(customer_id, status);
```

### Table: `rca_history`

```sql
CREATE TABLE rca_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  incident_id UUID REFERENCES incidents(id),
  resource_arn TEXT NOT NULL,
  
  -- RCA output fields (mirrors Claude output schema)
  root_cause TEXT,
  confidence FLOAT CHECK (confidence >= 0.0 AND confidence <= 1.0),
  severity TEXT CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  evidence JSONB,           -- Array of evidence items
  what_i_dont_know TEXT[],  -- Array of gap statements
  affected_services JSONB,  -- Array of {arn, impact, reason}
  remediation JSONB,        -- Array of {step, action, rationale, estimated_impact}
  
  -- Context used (for debugging and prompt improvement)
  graph_context_json JSONB,
  cloudtrail_events_count INT,
  flow_anomalies_count INT,
  input_tokens INT,
  output_tokens INT,
  latency_ms INT,
  
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'streaming', 'complete', 'error')),
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX rca_history_customer_id ON rca_history(customer_id, started_at DESC);
CREATE INDEX rca_history_incident_id ON rca_history(incident_id);
CREATE INDEX rca_history_resource_arn ON rca_history(customer_id, resource_arn);
```

### Table: `cloudtrail_events`

```sql
CREATE TABLE cloudtrail_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL,
  region TEXT NOT NULL,
  event_id TEXT NOT NULL,    -- CloudTrail EventId (globally unique)
  event_name TEXT NOT NULL,  -- e.g., ModifyDBInstance
  event_source TEXT NOT NULL, -- e.g., rds.amazonaws.com
  event_time TIMESTAMPTZ NOT NULL,
  resource_arn TEXT,          -- Primary resource affected
  resource_type TEXT,
  user_identity JSONB,        -- {type, principalId, arn, sessionContext}
  request_parameters JSONB,
  response_elements JSONB,
  error_code TEXT,            -- Null if successful
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(customer_id, event_id)
);

-- Query pattern: recent events for a resource
CREATE INDEX cloudtrail_resource_time ON cloudtrail_events(customer_id, resource_arn, event_time DESC);
-- Query pattern: events by type for pattern detection
CREATE INDEX cloudtrail_event_name ON cloudtrail_events(customer_id, event_name, event_time DESC);

-- Retention: delete events older than 90 days
-- (nightly cleanup job)
```

### Table: `webhook_configs`

```sql
CREATE TABLE webhook_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('pagerduty', 'opsgenie', 'cloudwatch')),
  name TEXT NOT NULL,
  endpoint_path TEXT NOT NULL UNIQUE,  -- e.g., /webhooks/abc123def456
  signing_secret TEXT NOT NULL,        -- HMAC secret for validation
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_received_at TIMESTAMPTZ,
  events_received_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX webhook_configs_customer_id ON webhook_configs(customer_id);
CREATE INDEX webhook_configs_endpoint_path ON webhook_configs(endpoint_path);
```

### Table: `graph_snapshots`

```sql
CREATE TABLE graph_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL,
  s3_key TEXT NOT NULL,           -- s3://liveinfra-snapshots/{customer_id}/{timestamp}.parquet
  node_count INT NOT NULL,
  edge_count INT NOT NULL,
  scan_duration_sec INT,
  snapshot_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX graph_snapshots_customer_account ON graph_snapshots(customer_id, account_id, snapshot_at DESC);
```

---

## Upstash Redis — Ephemeral State

All keys include `customer_id` prefix for isolation.

| Key Pattern | Type | TTL | Contents |
|---|---|---|---|
| `eni_cache:{cid}:{eni_id}` | String | 5 min | `{resourceId, resourceType}` JSON |
| `flow_anomalies:{cid}:{resource_id}:{window}` | String | 2 hours | `{reject_count, accept_count, unique_ips, bytes, timestamp}` JSON |
| `rate_limit:{cid}:cloudtrail` | String | 1 sec | Token count (token bucket) |
| `rca_usage:{cid}:{year_month}` | Counter | 45 days | Running count of RCA calls |
| `scan_lock:{cid}:{account_id}` | String | 20 min | Lock to prevent concurrent full scans |
| `blast_radius_cache:{cid}:{resource_id}` | String | 30 sec | Blast radius result JSON (short TTL — data changes) |

---

## Row Level Security (Supabase)

All tables use Supabase RLS policies. No direct table access without customer authentication.

```sql
-- Example: customers table RLS
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customer_own_data" ON customers
  FOR ALL USING (clerk_user_id = auth.jwt() ->> 'sub');

-- Example: incidents table RLS  
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "incidents_own_data" ON incidents
  FOR ALL USING (
    customer_id = (
      SELECT id FROM customers 
      WHERE clerk_user_id = auth.jwt() ->> 'sub'
    )
  );
```

All API queries go through the Fastify + tRPC layer which validates Clerk session → resolves `customer_id` → passes `customer_id` to all queries. Direct Supabase client calls from the frontend are limited to read-only operations with RLS enforced.
