'use client'

import { useState, useMemo } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Severity = 'critical' | 'degraded' | 'at-risk' | 'resolved'
type AlertStatus = 'active' | 'resolved'
type TimeRange = '24h' | '7d' | '30d'

interface Alert {
  id: string
  severity: Severity
  title: string
  resource: string
  resourceType: string
  region: string
  accountId: string
  ts: string
  status: AlertStatus
  description: string
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK_ALERTS: Alert[] = [
  {
    id: 'a1',
    severity: 'critical',
    title: 'RDS multi-AZ failover detected',
    resource: 'prod-db-postgres',
    resourceType: 'RDS',
    region: 'us-east-1',
    accountId: '975050024946',
    ts: new Date(Date.now() - 3 * 60_000).toISOString(),
    status: 'active',
    description:
      'Primary RDS instance (db.r6g.xlarge) failed over to standby. 47 downstream Lambda functions affected.',
  },
  {
    id: 'a2',
    severity: 'critical',
    title: 'ALB target health degraded',
    resource: 'api-alb-prod',
    resourceType: 'ALB',
    region: 'us-east-1',
    accountId: '975050024946',
    ts: new Date(Date.now() - 12 * 60_000).toISOString(),
    status: 'active',
    description: '3 of 6 targets unhealthy. 503 error rate spiked to 34%.',
  },
  {
    id: 'a3',
    severity: 'degraded',
    title: 'Lambda cold start spike',
    resource: 'order-processor-fn',
    resourceType: 'Lambda',
    region: 'us-east-1',
    accountId: '975050024946',
    ts: new Date(Date.now() - 28 * 60_000).toISOString(),
    status: 'active',
    description: 'P99 init duration exceeded 4000ms for 15 consecutive invocations.',
  },
  {
    id: 'a4',
    severity: 'degraded',
    title: 'SQS queue depth elevated',
    resource: 'email-queue.fifo',
    resourceType: 'SQS',
    region: 'us-west-2',
    accountId: '975050024946',
    ts: new Date(Date.now() - 45 * 60_000).toISOString(),
    status: 'active',
    description: 'ApproximateNumberOfMessagesVisible reached 12,400 (threshold: 10,000).',
  },
  {
    id: 'a5',
    severity: 'at-risk',
    title: 'S3 bucket replication lag',
    resource: 'media-assets-prod',
    resourceType: 'S3',
    region: 'us-east-1',
    accountId: '975050024946',
    ts: new Date(Date.now() - 2 * 3600_000).toISOString(),
    status: 'active',
    description: 'Cross-region replication to eu-west-1 is 18 minutes behind.',
  },
  {
    id: 'a6',
    severity: 'at-risk',
    title: 'ElastiCache memory utilization high',
    resource: 'session-cache-cluster',
    resourceType: 'ElastiCache',
    region: 'us-east-1',
    accountId: '975050024946',
    ts: new Date(Date.now() - 4 * 3600_000).toISOString(),
    status: 'active',
    description: 'Memory utilization at 87%. Eviction rate increasing.',
  },
  {
    id: 'a7',
    severity: 'critical',
    title: 'EC2 instance terminated unexpectedly',
    resource: 'worker-i-0abc1234',
    resourceType: 'EC2',
    region: 'eu-west-1',
    accountId: '975050024946',
    ts: new Date(Date.now() - 6 * 3600_000).toISOString(),
    status: 'resolved',
    description: 'Spot instance reclaimed. Auto Scaling replaced it within 90s.',
  },
  {
    id: 'a8',
    severity: 'degraded',
    title: 'API Gateway 5xx error rate spike',
    resource: 'payments-api-v2',
    resourceType: 'APIGateway',
    region: 'us-east-1',
    accountId: '975050024946',
    ts: new Date(Date.now() - 8 * 3600_000).toISOString(),
    status: 'resolved',
    description: 'Error rate peaked at 2.4% over 8 minutes. Root cause: Lambda throttling.',
  },
]

// ---------------------------------------------------------------------------
// Severity config
// ---------------------------------------------------------------------------

const SEVERITY_CONFIG: Record<
  Severity,
  { color: string; bg: string; label: string }
> = {
  critical: {
    color: 'var(--status-critical)',
    bg: 'rgba(240,68,56,0.06)',
    label: 'Critical',
  },
  degraded: {
    color: 'var(--status-degraded)',
    bg: 'rgba(248,124,0,0.06)',
    label: 'Degraded',
  },
  'at-risk': {
    color: 'var(--status-at-risk)',
    bg: 'rgba(245,197,24,0.06)',
    label: 'At Risk',
  },
  resolved: {
    color: 'var(--status-healthy)',
    bg: 'transparent',
    label: 'Resolved',
  },
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function withinRange(iso: string, range: TimeRange): boolean {
  const diff = Date.now() - new Date(iso).getTime()
  if (range === '24h') return diff <= 86_400_000
  if (range === '7d') return diff <= 7 * 86_400_000
  return true
}

// ---------------------------------------------------------------------------
// SVG Icons
// ---------------------------------------------------------------------------

function BellIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--accent)"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}

function CriticalIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  )
}

function DegradedIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )
}

function AtRiskIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  )
}

function ResolvedIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function ShieldCheckIcon() {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--ink-ghost)"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  )
}

function getSeverityIcon(severity: Severity) {
  if (severity === 'critical') return <CriticalIcon />
  if (severity === 'degraded') return <DegradedIcon />
  if (severity === 'at-risk') return <AtRiskIcon />
  return <ResolvedIcon />
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  color,
  unit,
}: {
  label: string
  value: number | string
  color: string
  unit?: string
}) {
  return (
    <div
      style={{
        flex: '1 1 0',
        minWidth: 0,
        background: 'var(--surface-1)',
        border: '1px solid var(--hairline)',
        borderRadius: '10px',
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
      }}
    >
      <span
        style={{
          fontSize: '11px',
          fontFamily: 'var(--font-sans)',
          color: 'var(--ink-muted)',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: '28px',
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          color,
          lineHeight: 1,
        }}
      >
        {value}
        {unit && (
          <span style={{ fontSize: '14px', fontWeight: 400, color: 'var(--ink-muted)', marginLeft: '3px' }}>
            {unit}
          </span>
        )}
      </span>
    </div>
  )
}

function FilterPill({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '5px 12px',
        borderRadius: '99px',
        fontSize: '12px',
        fontFamily: 'var(--font-sans)',
        fontWeight: active ? 600 : 400,
        cursor: 'pointer',
        border: active ? '1px solid var(--accent)' : '1px solid var(--hairline)',
        background: active ? 'var(--accent-dim)' : 'transparent',
        color: active ? 'var(--accent)' : 'var(--ink-muted)',
        transition: 'all 0.15s ease',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  )
}

function AlertCard({ alert }: { alert: Alert }) {
  const [hovered, setHovered] = useState(false)
  const cfg = SEVERITY_CONFIG[alert.severity]
  const isResolved = alert.status === 'resolved'

  const statusLabel = isResolved ? 'Resolved' : cfg.label
  const statusColor = isResolved ? 'var(--status-healthy)' : cfg.color

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0',
        borderRadius: '10px',
        border: '1px solid var(--hairline)',
        borderLeft: `4px solid ${cfg.color}`,
        background: hovered ? 'var(--surface-2)' : cfg.bg,
        cursor: 'pointer',
        transition: 'background 0.15s ease',
        overflow: 'hidden',
      }}
    >
      {/* Main row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
          padding: '14px 16px 10px 16px',
        }}
      >
        {/* Severity dot + icon */}
        <div
          style={{
            flexShrink: 0,
            marginTop: '2px',
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            background: `${cfg.color}18`,
            border: `1px solid ${cfg.color}40`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: cfg.color,
            position: 'relative',
          }}
        >
          {getSeverityIcon(alert.severity)}
          {/* 8px dot */}
          <span
            style={{
              position: 'absolute',
              top: '-2px',
              right: '-2px',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: cfg.color,
              boxShadow: `0 0 5px ${cfg.color}`,
              border: '1.5px solid var(--canvas)',
            }}
          />
        </div>

        {/* Title + subtitle */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: '14px',
              fontFamily: 'var(--font-sans)',
              fontWeight: 600,
              color: 'var(--ink)',
              lineHeight: '1.3',
              marginBottom: '3px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {alert.title}
          </div>
          <div
            style={{
              fontSize: '12px',
              fontFamily: 'var(--font-mono)',
              color: 'var(--ink-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>{alert.resourceType}</span>
            <span style={{ color: 'var(--ink-ghost)' }}>·</span>
            <span>{alert.region}</span>
          </div>
        </div>

        {/* Right side: timestamp + status + link */}
        <div
          style={{
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: '6px',
          }}
        >
          <span
            style={{
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              color: 'var(--ink-subtle)',
            }}
          >
            {timeAgo(alert.ts)}
          </span>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '2px 8px',
              borderRadius: '99px',
              fontSize: '11px',
              fontFamily: 'var(--font-sans)',
              fontWeight: 600,
              background: `${statusColor}18`,
              color: statusColor,
              border: `1px solid ${statusColor}40`,
            }}
          >
            {statusLabel}
          </span>
          <a
            href="/dashboard"
            style={{
              fontSize: '11px',
              fontFamily: 'var(--font-sans)',
              fontWeight: 600,
              color: 'var(--accent)',
              textDecoration: 'none',
              letterSpacing: '0.01em',
            }}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLAnchorElement).style.color = 'var(--accent-hover)'
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLAnchorElement).style.color = 'var(--accent)'
            }}
          >
            View Graph →
          </a>
        </div>
      </div>

      {/* Description row */}
      <div
        style={{
          padding: '0 16px 10px 56px',
          fontSize: '12px',
          fontFamily: 'var(--font-sans)',
          color: 'var(--ink-muted)',
          lineHeight: '1.5',
        }}
      >
        {alert.description}
      </div>

      {/* Tags row */}
      <div
        style={{
          padding: '8px 16px 10px 56px',
          borderTop: '1px solid var(--hairline)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flexWrap: 'wrap',
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '2px 8px',
            borderRadius: '6px',
            fontSize: '11px',
            fontFamily: 'var(--font-mono)',
            background: 'var(--surface-3)',
            color: 'var(--ink-muted)',
            border: '1px solid var(--hairline)',
            letterSpacing: '0.02em',
          }}
        >
          {alert.resource}
        </span>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '2px 8px',
            borderRadius: '6px',
            fontSize: '11px',
            fontFamily: 'var(--font-mono)',
            background: 'var(--surface-2)',
            color: 'var(--ink-subtle)',
            border: '1px solid var(--hairline)',
            letterSpacing: '0.02em',
          }}
        >
          acct:{alert.accountId}
        </span>
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '80px 24px',
        gap: '16px',
      }}
    >
      <ShieldCheckIcon />
      <div
        style={{
          fontSize: '16px',
          fontFamily: 'var(--font-display)',
          fontWeight: 600,
          color: 'var(--ink-muted)',
          marginTop: '4px',
        }}
      >
        No alerts
      </div>
      <div
        style={{
          fontSize: '13px',
          fontFamily: 'var(--font-sans)',
          color: 'var(--ink-subtle)',
        }}
      >
        Your infrastructure is operating normally
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

type SeverityFilter = 'all' | Severity

export default function AlertsClient({ customerId: _customerId }: { customerId: string }) {
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all')
  const [timeRange, setTimeRange] = useState<TimeRange>('24h')

  const filtered = useMemo(() => {
    return MOCK_ALERTS.filter((a) => {
      const matchesSeverity = severityFilter === 'all' || a.severity === severityFilter
      const matchesTime = withinRange(a.ts, timeRange)
      return matchesSeverity && matchesTime
    })
  }, [severityFilter, timeRange])

  const counts = useMemo(() => {
    const all = MOCK_ALERTS
    const critical = all.filter((a) => a.severity === 'critical' && a.status === 'active').length
    const degraded = all.filter((a) => a.severity === 'degraded' && a.status === 'active').length
    const resolved = all.filter((a) => a.status === 'resolved').length

    // MTTR: average minutes from alert ts to now for resolved alerts (mock: fixed 12m)
    const mttr = 12

    return { critical, degraded, resolved, mttr, total: all.length }
  }, [])

  const severityOptions: { value: SeverityFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'critical', label: 'Critical' },
    { value: 'degraded', label: 'Degraded' },
    { value: 'at-risk', label: 'At Risk' },
    { value: 'resolved', label: 'Resolved' },
  ]

  const timeOptions: { value: TimeRange; label: string }[] = [
    { value: '24h', label: 'Last 24h' },
    { value: '7d', label: '7d' },
    { value: '30d', label: '30d' },
  ]

  return (
    <>
      {/* Keyframe animations */}
      <style>{`
        @keyframes alerts-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          background: 'var(--canvas)',
          overflow: 'hidden',
        }}
      >
        {/* Page header */}
        <header
          style={{
            height: '60px',
            flexShrink: 0,
            background: 'var(--surface-1)',
            borderBottom: '1px solid var(--hairline)',
            boxShadow: '0 1px 0 rgba(0,0,0,0.3)',
            padding: '0 28px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          {/* Icon + title group */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
            <BellIcon />
            <div>
              <div
                style={{
                  fontSize: '15px',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 700,
                  color: 'var(--ink)',
                  lineHeight: 1.2,
                }}
              >
                Alerts
              </div>
              <div
                style={{
                  fontSize: '12px',
                  fontFamily: 'var(--font-sans)',
                  color: 'var(--ink-muted)',
                  lineHeight: 1.2,
                }}
              >
                Real-time infrastructure anomalies
              </div>
            </div>

            {/* Total count badge */}
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '2px 10px',
                borderRadius: '99px',
                fontSize: '12px',
                fontFamily: 'var(--font-sans)',
                fontWeight: 600,
                background: 'var(--surface-3)',
                color: 'var(--accent)',
                border: '1px solid var(--hairline-strong)',
                marginLeft: '4px',
              }}
            >
              {counts.total}
            </span>
          </div>

          {/* Right side: time range pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {timeOptions.map((opt) => (
              <FilterPill
                key={opt.value}
                label={opt.label}
                active={timeRange === opt.value}
                onClick={() => setTimeRange(opt.value)}
              />
            ))}
          </div>
        </header>

        {/* Scrollable body */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '24px 28px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
          }}
        >
          {/* Stats row */}
          <div style={{ display: 'flex', gap: '12px' }}>
            <StatCard
              label="Critical"
              value={counts.critical}
              color="var(--status-critical)"
            />
            <StatCard
              label="Degraded"
              value={counts.degraded}
              color="var(--status-degraded)"
            />
            <StatCard
              label="Resolved"
              value={counts.resolved}
              color="var(--status-healthy)"
            />
            <StatCard
              label="MTTR"
              value={counts.mttr}
              unit="min"
              color="var(--accent)"
            />
          </div>

          {/* Filter bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              flexWrap: 'wrap',
            }}
          >
            {severityOptions.map((opt) => (
              <FilterPill
                key={opt.value}
                label={opt.label}
                active={severityFilter === opt.value}
                onClick={() => setSeverityFilter(opt.value)}
              />
            ))}
          </div>

          {/* Alert timeline list */}
          {filtered.length === 0 ? (
            <EmptyState />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {filtered.map((alert) => (
                <AlertCard key={alert.id} alert={alert} />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
