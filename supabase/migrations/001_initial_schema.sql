-- ============================================================
-- LiveInfra — Initial Database Schema
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- ─── Extensions ──────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── customers ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id         TEXT NOT NULL UNIQUE,
  email                 TEXT NOT NULL,
  name                  TEXT,
  tier                  TEXT NOT NULL DEFAULT 'starter'
                          CHECK (tier IN ('starter', 'growth', 'enterprise')),
  stripe_customer_id    TEXT UNIQUE,
  stripe_subscription_id TEXT,
  rca_calls_this_month  INT NOT NULL DEFAULT 0,
  rca_calls_limit       INT NOT NULL DEFAULT 50,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS customers_clerk_user_id ON customers(clerk_user_id);

-- ─── aws_accounts ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS aws_accounts (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id               UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  account_id                TEXT NOT NULL,
  account_alias             TEXT,
  role_arn                  TEXT NOT NULL,
  external_id               TEXT NOT NULL,
  regions                   TEXT[] NOT NULL DEFAULT ARRAY['us-east-1'],
  status                    TEXT NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'active', 'error', 'disconnected')),
  last_scan_at              TIMESTAMPTZ,
  last_scan_duration_sec    INT,
  last_scan_resource_count  INT,
  last_error                TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(customer_id, account_id)
);

CREATE INDEX IF NOT EXISTS aws_accounts_customer_id ON aws_accounts(customer_id);
CREATE INDEX IF NOT EXISTS aws_accounts_status ON aws_accounts(status, customer_id);

-- ─── incidents ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS incidents (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id         UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  source              TEXT NOT NULL
                        CHECK (source IN ('pagerduty', 'opsgenie', 'cloudwatch', 'manual')),
  source_incident_id  TEXT,
  title               TEXT NOT NULL,
  severity            TEXT CHECK (severity IN ('critical', 'high', 'medium', 'low', 'info')),
  resource_arn        TEXT,
  resource_id         TEXT,
  status              TEXT NOT NULL DEFAULT 'open'
                        CHECK (status IN ('open', 'analyzing', 'resolved', 'error')),
  raw_payload         JSONB,
  triggered_at        TIMESTAMPTZ NOT NULL,
  resolved_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS incidents_customer_time ON incidents(customer_id, triggered_at DESC);
CREATE INDEX IF NOT EXISTS incidents_resource_arn ON incidents(customer_id, resource_arn);
CREATE INDEX IF NOT EXISTS incidents_status ON incidents(customer_id, status);

-- ─── rca_history ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rca_history (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id             UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  incident_id             UUID REFERENCES incidents(id),
  resource_arn            TEXT NOT NULL,
  root_cause              TEXT,
  confidence              FLOAT CHECK (confidence >= 0.0 AND confidence <= 1.0),
  severity                TEXT CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  evidence                JSONB,
  what_i_dont_know        TEXT[],
  affected_services       JSONB,
  remediation             JSONB,
  graph_context_json      JSONB,
  cloudtrail_events_count INT,
  flow_anomalies_count    INT,
  input_tokens            INT,
  output_tokens           INT,
  latency_ms              INT,
  status                  TEXT NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'streaming', 'complete', 'error')),
  error_message           TEXT,
  started_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at            TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS rca_history_customer_time ON rca_history(customer_id, started_at DESC);
CREATE INDEX IF NOT EXISTS rca_history_incident ON rca_history(incident_id);
CREATE INDEX IF NOT EXISTS rca_history_resource ON rca_history(customer_id, resource_arn);

-- ─── cloudtrail_events ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS cloudtrail_events (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id         UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  account_id          TEXT NOT NULL,
  region              TEXT NOT NULL,
  event_id            TEXT NOT NULL,
  event_name          TEXT NOT NULL,
  event_source        TEXT NOT NULL,
  event_time          TIMESTAMPTZ NOT NULL,
  resource_arn        TEXT,
  resource_type       TEXT,
  user_identity       JSONB,
  request_parameters  JSONB,
  response_elements   JSONB,
  error_code          TEXT,
  error_message       TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(customer_id, event_id)
);

CREATE INDEX IF NOT EXISTS cloudtrail_resource_time
  ON cloudtrail_events(customer_id, resource_arn, event_time DESC);
CREATE INDEX IF NOT EXISTS cloudtrail_event_name
  ON cloudtrail_events(customer_id, event_name, event_time DESC);

-- ─── webhook_configs ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS webhook_configs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id           UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  type                  TEXT NOT NULL
                          CHECK (type IN ('pagerduty', 'opsgenie', 'cloudwatch')),
  name                  TEXT NOT NULL,
  endpoint_path         TEXT NOT NULL UNIQUE,
  signing_secret        TEXT NOT NULL,
  is_active             BOOLEAN NOT NULL DEFAULT true,
  last_received_at      TIMESTAMPTZ,
  events_received_count INT NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS webhook_configs_customer ON webhook_configs(customer_id);
CREATE INDEX IF NOT EXISTS webhook_configs_path ON webhook_configs(endpoint_path);

-- ─── graph_snapshots ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS graph_snapshots (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id       UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  account_id        TEXT NOT NULL,
  s3_key            TEXT NOT NULL,
  node_count        INT NOT NULL,
  edge_count        INT NOT NULL,
  scan_duration_sec INT,
  snapshot_at       TIMESTAMPTZ NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS graph_snapshots_customer_account
  ON graph_snapshots(customer_id, account_id, snapshot_at DESC);

-- ─── chat_history (Phase 2 — created now so schema is stable) ─
CREATE TABLE IF NOT EXISTS chat_history (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id   UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  session_id    UUID NOT NULL DEFAULT gen_random_uuid(),
  role          TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content       TEXT NOT NULL,
  graph_context JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS chat_history_customer_session
  ON chat_history(customer_id, session_id, created_at ASC);

-- ─── saved_views (Phase 2) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS saved_views (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id   UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  filter_state  JSONB NOT NULL DEFAULT '{}',
  is_default    BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(customer_id, name)
);

CREATE INDEX IF NOT EXISTS saved_views_customer ON saved_views(customer_id);

-- ─── updated_at trigger ──────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER aws_accounts_updated_at
  BEFORE UPDATE ON aws_accounts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER saved_views_updated_at
  BEFORE UPDATE ON saved_views
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── RLS Policies ────────────────────────────────────────────
-- The API uses service_role key so RLS doesn't apply server-side.
-- These policies protect direct browser access via the anon key.

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE aws_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE rca_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE cloudtrail_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE graph_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_views ENABLE ROW LEVEL SECURITY;

-- Service role bypasses all RLS (default Supabase behaviour — no policy needed)

-- ─── Cleanup job hint ────────────────────────────────────────
-- CloudTrail events older than 90 days can be pruned.
-- Run this manually or via pg_cron (Supabase Pro only):
--
-- DELETE FROM cloudtrail_events
-- WHERE created_at < NOW() - INTERVAL '90 days';
