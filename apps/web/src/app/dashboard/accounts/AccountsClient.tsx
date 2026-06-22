'use client'

import { useState, useCallback } from 'react'
import { trpc } from '@/lib/trpc'
import AddAccountModal from './AddAccountModal'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Account {
  id: string
  accountId: string
  accountAlias: string | null
  status: 'active' | 'pending' | 'error' | 'disconnected'
  regions: string[]
  lastScanAt: string | null
  lastScanResourceCount: number
  lastError: string | null
}

interface AccountsClientProps {
  customerId: string
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function relativeTime(iso: string | null): string {
  if (!iso) return 'never'
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

// ── Status badge ───────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  active:       { label: 'Active',       color: 'var(--status-healthy)',  bg: 'rgba(18,183,106,0.12)'  },
  pending:      { label: 'Pending',      color: 'var(--status-degraded)', bg: 'rgba(248,124,0,0.12)'   },
  error:        { label: 'Error',        color: 'var(--status-critical)',  bg: 'rgba(240,68,56,0.12)'   },
  disconnected: { label: 'Disconnected', color: 'var(--ink-subtle)',       bg: 'rgba(70,92,120,0.15)'   },
} as const

function StatusBadge({ status }: { status: Account['status'] }) {
  const cfg = STATUS_CONFIG[status]
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding: '2px 8px',
        borderRadius: '9999px',
        fontSize: '11px',
        fontWeight: 600,
        letterSpacing: '0.02em',
        color: cfg.color,
        background: cfg.bg,
        border: `1px solid ${cfg.color}30`,
        fontFamily: 'var(--font-sans)',
      }}
    >
      <span
        style={{
          width: '5px',
          height: '5px',
          borderRadius: '50%',
          background: cfg.color,
          flexShrink: 0,
        }}
      />
      {cfg.label}
    </span>
  )
}

// ── Account card ───────────────────────────────────────────────────────────────

interface AccountCardProps {
  account: Account
  onRemove: (id: string) => void
  onScan: (accountId: string) => void
  scanning: boolean
}

function AccountCard({ account, onRemove, onScan, scanning }: AccountCardProps) {
  const [hovered, setHovered] = useState(false)
  const [removeHovered, setRemoveHovered] = useState(false)

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? 'var(--surface-2)' : 'var(--surface-1)',
        border: `1px solid ${hovered ? 'var(--hairline-strong)' : 'var(--hairline)'}`,
        borderRadius: '12px',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        transition: 'background 0.15s, border-color 0.15s',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Subtle teal glow on active accounts */}
      {account.status === 'active' && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '1px',
            background: 'linear-gradient(90deg, transparent, var(--accent) 40%, transparent)',
            opacity: 0.4,
          }}
        />
      )}

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0 }}>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '18px',
              fontWeight: 600,
              color: 'var(--ink)',
              letterSpacing: '0.04em',
            }}
          >
            {account.accountId}
          </span>
          {account.accountAlias && (
            <span
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '12px',
                color: 'var(--ink-muted)',
                fontWeight: 500,
              }}
            >
              {account.accountAlias}
            </span>
          )}
        </div>
        <StatusBadge status={account.status} />
      </div>

      {/* Metadata row */}
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '11px',
          color: 'var(--ink-subtle)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          flexWrap: 'wrap',
        }}
      >
        <span style={{ color: 'var(--ink-muted)' }}>{account.regions.length}</span>
        <span>regions</span>
        <span style={{ color: 'var(--hairline-strong)' }}>·</span>
        <span style={{ color: 'var(--ink-muted)' }}>{account.lastScanResourceCount.toLocaleString()}</span>
        <span>resources</span>
        <span style={{ color: 'var(--hairline-strong)' }}>·</span>
        <span>scanned {relativeTime(account.lastScanAt)}</span>
      </div>

      {/* Error message if any */}
      {account.status === 'error' && account.lastError && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '6px',
            padding: '8px 10px',
            borderRadius: '6px',
            background: 'rgba(240,68,56,0.08)',
            border: '1px solid rgba(240,68,56,0.2)',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--status-critical)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '1px' }}>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span
            style={{
              fontSize: '11px',
              color: 'var(--status-critical)',
              fontFamily: 'var(--font-mono)',
              lineHeight: 1.4,
            }}
          >
            {account.lastError}
          </span>
        </div>
      )}

      {/* Action row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: 'auto' }}>
        <ScanButton
          scanning={scanning}
          status={account.status}
          onClick={() => onScan(account.accountId)}
        />
        <div style={{ flex: 1 }} />
        <RemoveButton onClick={() => onRemove(account.id)} hovered={removeHovered} setHovered={setRemoveHovered} />
      </div>
    </div>
  )
}

function ScanButton({
  scanning,
  status,
  onClick,
}: {
  scanning: boolean
  status: Account['status']
  onClick: () => void
}) {
  const [hov, setHov] = useState(false)
  const disabled = scanning || status === 'disconnected' || status === 'pending'

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 14px',
        borderRadius: '7px',
        fontSize: '12px',
        fontWeight: 600,
        fontFamily: 'var(--font-sans)',
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background 0.15s, color 0.15s',
        background: disabled
          ? 'var(--surface-3)'
          : hov
          ? 'var(--accent-hover)'
          : 'var(--accent)',
        color: disabled ? 'var(--ink-subtle)' : '#000',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {scanning ? (
        <>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
            <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Scanning…
        </>
      ) : (
        <>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Scan Now
        </>
      )}
    </button>
  )
}

function RemoveButton({
  onClick,
  hovered,
  setHovered,
}: {
  onClick: () => void
  hovered: boolean
  setHovered: (v: boolean) => void
}) {
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title="Remove account"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '30px',
        height: '30px',
        borderRadius: '6px',
        border: `1px solid ${hovered ? 'rgba(240,68,56,0.4)' : 'var(--hairline)'}`,
        background: hovered ? 'rgba(240,68,56,0.08)' : 'transparent',
        cursor: 'pointer',
        transition: 'background 0.15s, border-color 0.15s',
        color: hovered ? 'var(--status-critical)' : 'var(--ink-subtle)',
      }}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
        <path d="M10 11v6M14 11v6" />
        <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
      </svg>
    </button>
  )
}

// ── Empty state ────────────────────────────────────────────────────────────────

function EmptyState({ onConnect }: { onConnect: () => void }) {
  const [hov, setHov] = useState(false)

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '20px',
        padding: '80px 24px',
        textAlign: 'center',
      }}
    >
      {/* Illustration */}
      <div
        style={{
          width: '80px',
          height: '80px',
          borderRadius: '20px',
          background: 'var(--surface-2)',
          border: '1px solid var(--hairline-strong)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          boxShadow: '0 0 32px rgba(0,196,180,0.06)',
        }}
      >
        {/* AWS-like cloud icon */}
        <svg width="40" height="40" viewBox="0 0 64 64" fill="none" style={{ opacity: 0.5 }}>
          <path
            d="M44 38c4.4 0 8-3.6 8-8 0-4.1-3.1-7.5-7.1-7.9C43.8 16.7 39.3 13 34 13c-4.4 0-8.3 2.2-10.7 5.6C21.9 17.6 20 16 17.7 16 14 16 11 19 11 22.7 11 23.8 11.3 24.9 11.8 25.8 8.5 26.9 6 30 6 34c0 4.4 3.6 8 8 8h30z"
            fill="var(--accent)"
            opacity="0.3"
          />
          <rect x="24" y="44" width="4" height="8" rx="1" fill="var(--ink-subtle)" />
          <rect x="30" y="46" width="4" height="6" rx="1" fill="var(--ink-subtle)" />
          <rect x="36" y="44" width="4" height="8" rx="1" fill="var(--ink-subtle)" />
          <line x1="20" y1="52" x2="44" y2="52" stroke="var(--ink-subtle)" strokeWidth="2" strokeLinecap="round" />
        </svg>

        {/* Corner accent */}
        <div
          style={{
            position: 'absolute',
            top: '-1px',
            right: '-1px',
            width: '18px',
            height: '18px',
            borderRadius: '0 20px 0 8px',
            background: 'var(--accent-dim)',
            border: '1px solid var(--accent)30',
          }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <h3
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '18px',
            fontWeight: 600,
            color: 'var(--ink)',
            margin: 0,
          }}
        >
          No AWS accounts connected
        </h3>
        <p
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: '13px',
            color: 'var(--ink-muted)',
            margin: 0,
            maxWidth: '340px',
            lineHeight: 1.6,
          }}
        >
          Connect your first AWS account to start scanning infrastructure and building your dependency graph.
        </p>
      </div>

      <button
        onClick={onConnect}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 22px',
          borderRadius: '8px',
          fontSize: '13px',
          fontWeight: 600,
          fontFamily: 'var(--font-sans)',
          border: 'none',
          cursor: 'pointer',
          background: hov ? 'var(--accent-hover)' : 'var(--accent)',
          color: '#000',
          transition: 'background 0.15s',
          boxShadow: '0 0 16px rgba(0,196,180,0.25)',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        Connect your first AWS account
      </button>
    </div>
  )
}

// ── Loading skeleton ───────────────────────────────────────────────────────────

function AccountCardSkeleton() {
  return (
    <div
      style={{
        background: 'var(--surface-1)',
        border: '1px solid var(--hairline)',
        borderRadius: '12px',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ width: '160px', height: '22px', borderRadius: '4px', background: 'var(--surface-3)', animation: 'pulse 1.5s ease-in-out infinite' }} />
          <div style={{ width: '90px', height: '13px', borderRadius: '4px', background: 'var(--surface-2)', animation: 'pulse 1.5s ease-in-out infinite' }} />
        </div>
        <div style={{ width: '64px', height: '20px', borderRadius: '9999px', background: 'var(--surface-3)', animation: 'pulse 1.5s ease-in-out infinite' }} />
      </div>
      <div style={{ width: '220px', height: '12px', borderRadius: '4px', background: 'var(--surface-2)', animation: 'pulse 1.5s ease-in-out infinite' }} />
      <div style={{ display: 'flex', gap: '8px' }}>
        <div style={{ width: '88px', height: '30px', borderRadius: '7px', background: 'var(--surface-3)', animation: 'pulse 1.5s ease-in-out infinite' }} />
        <div style={{ marginLeft: 'auto', width: '30px', height: '30px', borderRadius: '6px', background: 'var(--surface-2)', animation: 'pulse 1.5s ease-in-out infinite' }} />
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function AccountsClient({ customerId }: AccountsClientProps) {
  const [modalOpen, setModalOpen] = useState(false)
  const [connectBtnHov, setConnectBtnHov] = useState(false)
  const [scanningIds, setScanningIds] = useState<Set<string>>(new Set())

  // The accounts.list procedure doesn't exist on the router yet,
  // so we cast via any to avoid TS compile errors.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const trpcAny = trpc as any

  const {
    data,
    isLoading,
    error,
    refetch,
  } = trpcAny.accounts.list.useQuery(
    { customerId },
    {
      retry: false,
      // Gracefully suppress errors since the procedure is not yet implemented
      onError: () => {},
    }
  )

  const accounts: Account[] = data?.accounts ?? []

  const handleScanNow = useCallback((accountId: string) => {
    setScanningIds((prev) => new Set([...prev, accountId]))
    // Placeholder: scan would call triggerDefault with the account's roleArn.
    // For now, simulate a brief scan state and clear after 3s.
    setTimeout(() => {
      setScanningIds((prev) => {
        const next = new Set(prev)
        next.delete(accountId)
        return next
      })
      void refetch()
    }, 3000)
  }, [refetch])

  const handleRemove = useCallback((_id: string) => {
    // Will call trpc.accounts.remove.useMutation once the procedure exists.
    void refetch()
  }, [refetch])

  const handleAccountAdded = useCallback(() => {
    setModalOpen(false)
    void refetch()
  }, [refetch])

  return (
    <>
      {/* Inline spin keyframe (no new CSS file needed) */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
      `}</style>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflow: 'hidden',
          background: 'var(--canvas)',
        }}
      >
        {/* Page header */}
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 28px',
            height: '60px',
            flexShrink: 0,
            background: 'var(--surface-1)',
            borderBottom: '1px solid var(--hairline)',
            boxShadow: '0 1px 0 rgba(0,0,0,0.3)',
            gap: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* AWS icon */}
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '6px',
                background: 'var(--surface-3)',
                border: '1px solid var(--hairline-strong)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 7l9-4 9 4v10l-9 4-9-4V7z" />
                <path d="M12 3v18" />
                <path d="M3 7l9 4 9-4" />
              </svg>
            </div>
            <h1
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '16px',
                fontWeight: 600,
                color: 'var(--ink)',
                margin: 0,
                letterSpacing: '-0.01em',
              }}
            >
              AWS Accounts
            </h1>
            {!isLoading && accounts.length > 0 && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '1px 7px',
                  borderRadius: '9999px',
                  fontSize: '11px',
                  fontWeight: 600,
                  fontFamily: 'var(--font-mono)',
                  background: 'var(--surface-3)',
                  color: 'var(--ink-muted)',
                  border: '1px solid var(--hairline-strong)',
                }}
              >
                {accounts.length}
              </span>
            )}
          </div>

          <button
            onClick={() => setModalOpen(true)}
            onMouseEnter={() => setConnectBtnHov(true)}
            onMouseLeave={() => setConnectBtnHov(false)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '7px',
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              fontFamily: 'var(--font-sans)',
              border: 'none',
              cursor: 'pointer',
              background: connectBtnHov ? 'var(--accent-hover)' : 'var(--accent)',
              color: '#000',
              transition: 'background 0.15s',
              boxShadow: connectBtnHov ? '0 0 16px rgba(0,196,180,0.3)' : 'none',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Connect Account
          </button>
        </header>

        {/* Page body */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '28px',
          }}
        >
          {/* Error state (only show if not a "procedure not found" error, which is expected) */}
          {error && !(String(error).includes('NOT_FOUND') || String(error).includes('not found')) && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px 16px',
                borderRadius: '8px',
                background: 'rgba(240,68,56,0.08)',
                border: '1px solid rgba(240,68,56,0.2)',
                marginBottom: '24px',
                color: 'var(--status-critical)',
                fontSize: '13px',
                fontFamily: 'var(--font-sans)',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {String(error)}
            </div>
          )}

          {/* Loading skeletons */}
          {isLoading && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                gap: '16px',
              }}
            >
              {[1, 2, 3].map((n) => (
                <AccountCardSkeleton key={n} />
              ))}
            </div>
          )}

          {/* Empty state */}
          {!isLoading && accounts.length === 0 && (
            <EmptyState onConnect={() => setModalOpen(true)} />
          )}

          {/* Accounts grid */}
          {!isLoading && accounts.length > 0 && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                gap: '16px',
              }}
            >
              {accounts.map((account) => (
                <AccountCard
                  key={account.id}
                  account={account}
                  scanning={scanningIds.has(account.accountId)}
                  onScan={handleScanNow}
                  onRemove={handleRemove}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {modalOpen && (
        <AddAccountModal
          customerId={customerId}
          onClose={() => setModalOpen(false)}
          onSuccess={handleAccountAdded}
        />
      )}
    </>
  )
}
