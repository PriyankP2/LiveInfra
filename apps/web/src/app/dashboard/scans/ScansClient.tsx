'use client'

import { useState, useMemo } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ScanStatus = 'running' | 'completed' | 'error'

interface Scan {
  id: string
  accountId: string
  accountAlias?: string
  startedAt: string
  completedAt?: string
  status: ScanStatus
  resourceCount?: number
  edgeCount?: number
  durationSec?: number
  errorMessage?: string
  regions: string[]
}

// ---------------------------------------------------------------------------
// Mock data (replaces trpc.accounts.scanHistory.useQuery until endpoint exists)
// ---------------------------------------------------------------------------

const MOCK_SCANS: Scan[] = [
  {
    id: '1',
    accountId: '975050024946',
    accountAlias: 'prod-aws',
    startedAt: new Date(Date.now() - 3_600_000).toISOString(),
    completedAt: new Date(Date.now() - 3_540_000).toISOString(),
    status: 'completed',
    resourceCount: 1867,
    edgeCount: 4232,
    durationSec: 60,
    regions: ['us-east-1', 'us-west-2', 'eu-west-1', 'ap-south-1'],
  },
  {
    id: '2',
    accountId: '975050024946',
    accountAlias: 'prod-aws',
    startedAt: new Date(Date.now() - 86_400_000).toISOString(),
    completedAt: new Date(Date.now() - 86_340_000).toISOString(),
    status: 'completed',
    resourceCount: 1843,
    edgeCount: 4180,
    durationSec: 60,
    regions: ['us-east-1', 'us-west-2', 'eu-west-1', 'ap-south-1'],
  },
  {
    id: '3',
    accountId: '975050024946',
    accountAlias: 'prod-aws',
    startedAt: new Date(Date.now() - 172_800_000).toISOString(),
    completedAt: new Date(Date.now() - 172_720_000).toISOString(),
    status: 'error',
    errorMessage: 'STS AssumeRole failed: AccessDenied',
    durationSec: 80,
    regions: ['us-east-1', 'us-west-2'],
  },
  {
    id: '4',
    accountId: '975050024946',
    accountAlias: 'prod-aws',
    startedAt: new Date(Date.now() - 259_200_000).toISOString(),
    completedAt: new Date(Date.now() - 259_140_000).toISOString(),
    status: 'completed',
    resourceCount: 1720,
    edgeCount: 3980,
    durationSec: 60,
    regions: ['us-east-1', 'us-west-2', 'eu-west-1', 'ap-south-1'],
  },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDuration(sec: number): string {
  if (sec < 60) return `${sec}s`
  return `${Math.floor(sec / 60)}m ${sec % 60}s`
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function getStatusColor(status: ScanStatus): string {
  if (status === 'completed') return 'var(--status-healthy)'
  if (status === 'error') return 'var(--status-critical)'
  return 'var(--accent)'
}

function getStatusLabel(status: ScanStatus): string {
  if (status === 'completed') return 'Completed'
  if (status === 'error') return 'Failed'
  return 'Scanning…'
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusDot({ status }: { status: ScanStatus }) {
  const color = getStatusColor(status)
  const isRunning = status === 'running'

  return (
    <span
      style={{
        display: 'inline-block',
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        flexShrink: 0,
        background: color,
        boxShadow: `0 0 6px ${color}`,
        animation: isRunning ? 'scan-pulse 1.2s ease-in-out infinite' : 'none',
      }}
    />
  )
}

function RegionBadge({ label }: { label: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '1px 7px',
        borderRadius: '99px',
        fontSize: '10px',
        fontFamily: 'var(--font-mono)',
        letterSpacing: '0.02em',
        background: 'var(--surface-2)',
        color: 'var(--ink-subtle)',
        border: '1px solid var(--hairline)',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  )
}

function ScanCard({ scan }: { scan: Scan }) {
  const borderColor = getStatusColor(scan.status)
  const statusLabel = getStatusLabel(scan.status)
  const visibleRegions = scan.regions.slice(0, 3)
  const hiddenCount = scan.regions.length - visibleRegions.length

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        padding: '14px 18px 14px 16px',
        background: 'var(--surface-1)',
        borderRadius: '10px',
        borderLeft: `3px solid ${borderColor}`,
        border: `1px solid var(--hairline)`,
        borderLeftColor: borderColor,
        borderLeftWidth: '3px',
        position: 'relative',
        transition: 'background 0.15s ease',
      }}
      onMouseEnter={(e) => {
        ;(e.currentTarget as HTMLDivElement).style.background = 'var(--surface-2)'
      }}
      onMouseLeave={(e) => {
        ;(e.currentTarget as HTMLDivElement).style.background = 'var(--surface-1)'
      }}
    >
      {/* Top row: status + account + alias + time */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <StatusDot status={scan.status} />

        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '13px',
            color: 'var(--ink)',
            letterSpacing: '0.03em',
            fontWeight: 500,
          }}
        >
          {scan.accountId}
        </span>

        {scan.accountAlias && (
          <span
            style={{
              fontSize: '12px',
              color: 'var(--ink-muted)',
              borderLeft: '1px solid var(--hairline-strong)',
              paddingLeft: '10px',
            }}
          >
            {scan.accountAlias}
          </span>
        )}

        <span
          style={{
            marginLeft: 'auto',
            fontSize: '11px',
            color: 'var(--ink-subtle)',
            fontFamily: 'var(--font-mono)',
            whiteSpace: 'nowrap',
          }}
        >
          {timeAgo(scan.startedAt)}
        </span>

        {/* Status label chip */}
        <span
          style={{
            fontSize: '11px',
            fontWeight: 600,
            color: borderColor,
            padding: '2px 8px',
            borderRadius: '99px',
            background:
              scan.status === 'completed'
                ? 'rgba(18,183,106,0.10)'
                : scan.status === 'error'
                  ? 'rgba(240,68,56,0.10)'
                  : 'rgba(0,196,180,0.10)',
            border: `1px solid ${borderColor}22`,
            whiteSpace: 'nowrap',
          }}
        >
          {statusLabel}
        </span>
      </div>

      {/* Meta row: regions · resources · duration */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
          fontSize: '12px',
          color: 'var(--ink-muted)',
          fontFamily: 'var(--font-mono)',
          flexWrap: 'wrap',
        }}
      >
        <span>{scan.regions.length} region{scan.regions.length !== 1 ? 's' : ''}</span>

        {scan.resourceCount !== undefined && (
          <>
            <span style={{ color: 'var(--ink-ghost)' }}>·</span>
            <span>
              <span style={{ color: 'var(--ink)' }}>{scan.resourceCount.toLocaleString()}</span>
              {' '}resources
            </span>
          </>
        )}

        {scan.edgeCount !== undefined && (
          <>
            <span style={{ color: 'var(--ink-ghost)' }}>·</span>
            <span>{scan.edgeCount.toLocaleString()} edges</span>
          </>
        )}

        {scan.durationSec !== undefined && (
          <>
            <span style={{ color: 'var(--ink-ghost)' }}>·</span>
            <span>{formatDuration(scan.durationSec)}</span>
          </>
        )}
      </div>

      {/* Region badges */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
        {visibleRegions.map((r) => (
          <RegionBadge key={r} label={r} />
        ))}
        {hiddenCount > 0 && (
          <span
            style={{
              fontSize: '10px',
              color: 'var(--ink-ghost)',
              fontFamily: 'var(--font-mono)',
              padding: '1px 6px',
            }}
          >
            +{hiddenCount} more
          </span>
        )}
      </div>

      {/* Error message */}
      {scan.status === 'error' && scan.errorMessage && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            marginTop: '2px',
            fontSize: '11px',
            color: 'var(--status-critical)',
            fontFamily: 'var(--font-mono)',
            background: 'rgba(240,68,56,0.07)',
            borderRadius: '6px',
            padding: '5px 10px',
            border: '1px solid rgba(240,68,56,0.15)',
          }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            style={{ flexShrink: 0 }}
          >
            <circle cx="10" cy="10" r="8" />
            <path d="M10 6v4" strokeLinecap="round" />
            <circle cx="10" cy="14" r="0.5" fill="currentColor" />
          </svg>
          {scan.errorMessage}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Stats bar
// ---------------------------------------------------------------------------

function StatsBar({ scans }: { scans: Scan[] }) {
  const totalScans = scans.length

  const completedScans = scans.filter((s) => s.status === 'completed' && s.durationSec !== undefined)
  const avgDuration =
    completedScans.length > 0
      ? Math.round(
          completedScans.reduce((sum, s) => sum + (s.durationSec ?? 0), 0) / completedScans.length
        )
      : null

  // Latest scan per account for total resources
  const latestByAccount = new Map<string, Scan>()
  for (const scan of scans) {
    const existing = latestByAccount.get(scan.accountId)
    if (!existing || new Date(scan.startedAt) > new Date(existing.startedAt)) {
      latestByAccount.set(scan.accountId, scan)
    }
  }
  const totalResources = Array.from(latestByAccount.values()).reduce(
    (sum, s) => sum + (s.resourceCount ?? 0),
    0
  )

  const stats = [
    {
      label: 'Total Scans',
      value: totalScans.toString(),
    },
    {
      label: 'Avg Duration',
      value: avgDuration !== null ? formatDuration(avgDuration) : '—',
    },
    {
      label: 'Resources Discovered',
      value: totalResources > 0 ? totalResources.toLocaleString() : '—',
    },
  ]

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '12px',
        marginBottom: '20px',
      }}
    >
      {stats.map(({ label, value }) => (
        <div
          key={label}
          style={{
            background: 'var(--surface-1)',
            border: '1px solid var(--hairline)',
            borderRadius: '10px',
            padding: '14px 18px',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '24px',
              fontWeight: 700,
              color: 'var(--accent)',
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
            }}
          >
            {value}
          </div>
          <div
            style={{
              marginTop: '4px',
              fontSize: '12px',
              color: 'var(--ink-muted)',
              letterSpacing: '0.01em',
            }}
          >
            {label}
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Filter bar
// ---------------------------------------------------------------------------

type FilterValue = 'all' | 'completed' | 'error'

const FILTER_OPTIONS: { value: FilterValue; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'completed', label: 'Completed' },
  { value: 'error', label: 'Failed' },
]

// Derive distinct account aliases from scans for the dropdown
function getAccountOptions(scans: Scan[]): string[] {
  const seen = new Set<string>()
  for (const s of scans) {
    seen.add(s.accountAlias ?? s.accountId)
  }
  return Array.from(seen)
}

function FilterBar({
  active,
  onChange,
  accountOptions,
}: {
  active: FilterValue
  onChange: (v: FilterValue) => void
  accountOptions: string[]
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '16px',
        flexWrap: 'wrap',
      }}
    >
      {/* Status pill filters */}
      <div
        style={{
          display: 'flex',
          gap: '4px',
          background: 'var(--surface-1)',
          border: '1px solid var(--hairline)',
          borderRadius: '99px',
          padding: '3px',
        }}
      >
        {FILTER_OPTIONS.map(({ value, label }) => {
          const isActive = active === value
          return (
            <button
              key={value}
              onClick={() => onChange(value)}
              style={{
                padding: '4px 14px',
                borderRadius: '99px',
                fontSize: '12px',
                fontWeight: isActive ? 600 : 400,
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                background: isActive ? 'var(--surface-3)' : 'transparent',
                color: isActive ? 'var(--ink)' : 'var(--ink-subtle)',
                outline: 'none',
              }}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* Account dropdown */}
      <div style={{ marginLeft: 'auto' }}>
        <select
          defaultValue=""
          style={{
            background: 'var(--surface-1)',
            border: '1px solid var(--hairline)',
            borderRadius: '8px',
            color: 'var(--ink-muted)',
            fontSize: '12px',
            padding: '5px 10px',
            cursor: 'pointer',
            outline: 'none',
            fontFamily: 'var(--font-sans)',
            appearance: 'none',
            paddingRight: '28px',
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 20 20' fill='none' stroke='%23465c78' stroke-width='2'%3E%3Cpath d='M5 8l5 5 5-5'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 8px center',
          }}
        >
          <option value="">All accounts</option>
          {accountOptions.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        padding: '64px 24px',
        textAlign: 'center',
      }}
    >
      {/* Icon */}
      <div
        style={{
          width: '48px',
          height: '48px',
          borderRadius: '12px',
          background: 'var(--surface-2)',
          border: '1px solid var(--hairline)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '4px',
        }}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 20 20"
          fill="none"
          stroke="var(--ink-subtle)"
          strokeWidth={1.5}
        >
          <circle cx="10" cy="10" r="7.5" />
          <path d="M10 6v4.5l3 1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '16px',
          fontWeight: 600,
          color: 'var(--ink)',
        }}
      >
        No scans yet
      </div>

      <div style={{ fontSize: '13px', color: 'var(--ink-muted)', maxWidth: '280px' }}>
        Connect an AWS account to start scanning your infrastructure.
      </div>

      <a
        href="/dashboard/accounts"
        style={{
          marginTop: '8px',
          fontSize: '13px',
          fontWeight: 600,
          color: 'var(--accent)',
          textDecoration: 'none',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
        }}
        onMouseEnter={(e) => {
          ;(e.currentTarget as HTMLAnchorElement).style.color = 'var(--accent-hover)'
        }}
        onMouseLeave={(e) => {
          ;(e.currentTarget as HTMLAnchorElement).style.color = 'var(--accent)'
        }}
      >
        Connect Account
        <span aria-hidden>→</span>
      </a>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ScansClientProps {
  customerId: string
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ScansClient({ customerId: _customerId }: ScansClientProps) {
  const [activeFilter, setActiveFilter] = useState<FilterValue>('all')

  // In production this would be: trpc.accounts.scanHistory.useQuery({ customerId })
  const scans = MOCK_SCANS

  const accountOptions = useMemo(() => getAccountOptions(scans), [scans])

  const filtered = useMemo(() => {
    if (activeFilter === 'all') return scans
    if (activeFilter === 'error') return scans.filter((s) => s.status === 'error')
    return scans.filter((s) => s.status === activeFilter)
  }, [scans, activeFilter])

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        background: 'var(--canvas)',
      }}
    >
      {/* Page header bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '0 28px',
          height: '60px',
          flexShrink: 0,
          background: 'var(--surface-1)',
          borderBottom: '1px solid var(--hairline)',
          boxShadow: '0 1px 0 rgba(0,0,0,0.3)',
        }}
      >
        {/* Title + subtitle */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '17px',
              fontWeight: 700,
              color: 'var(--ink)',
              margin: 0,
              lineHeight: 1.2,
              letterSpacing: '-0.01em',
            }}
          >
            Scan History
          </h1>
          <p
            style={{
              fontSize: '11px',
              color: 'var(--ink-muted)',
              margin: 0,
              lineHeight: 1.4,
            }}
          >
            Automated infrastructure discovery runs
          </p>
        </div>

        {/* Auto-scan info chip (right-aligned) */}
        <div
          style={{
            marginLeft: 'auto',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 11px',
            borderRadius: '99px',
            background: 'var(--surface-2)',
            border: '1px solid var(--hairline)',
            fontSize: '11px',
            color: 'var(--ink-muted)',
            whiteSpace: 'nowrap',
          }}
        >
          {/* Clock icon */}
          <svg
            width="12"
            height="12"
            viewBox="0 0 20 20"
            fill="none"
            stroke="var(--accent)"
            strokeWidth={1.8}
          >
            <circle cx="10" cy="10" r="7.5" />
            <path d="M10 6v4.5l3 1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Auto-scans run daily
        </div>
      </div>

      {/* Page content */}
      <div
        style={{
          flex: 1,
          padding: '24px 28px',
          maxWidth: '860px',
          width: '100%',
          alignSelf: 'flex-start',
        }}
      >
        {/* Stats bar */}
        <StatsBar scans={scans} />

        {/* Filter bar */}
        <FilterBar
          active={activeFilter}
          onChange={setActiveFilter}
          accountOptions={accountOptions}
        />

        {/* Scan list */}
        {filtered.length === 0 ? (
          <EmptyState />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {filtered.map((scan) => (
              <ScanCard key={scan.id} scan={scan} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
