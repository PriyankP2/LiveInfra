'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

// ── Types ──────────────────────────────────────────────────────────────────────

type Tab = 'general' | 'notifications' | 'webhooks' | 'api-keys' | 'danger'

// ── Toast ──────────────────────────────────────────────────────────────────────

function Toast({ visible }: { visible: boolean }) {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: '28px',
        right: '28px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '10px 16px',
        borderRadius: '8px',
        background: 'var(--surface-3)',
        border: '1px solid var(--hairline-strong)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
        fontFamily: 'var(--font-sans)',
        fontSize: '13px',
        fontWeight: 500,
        color: 'var(--ink)',
        zIndex: 9999,
        transition: 'opacity 0.2s, transform 0.2s',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(8px)',
        pointerEvents: 'none',
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--status-healthy)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
      Saved
    </div>
  )
}

// ── Toggle switch ──────────────────────────────────────────────────────────────

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      style={{
        width: '36px',
        height: '20px',
        borderRadius: '9999px',
        border: 'none',
        cursor: 'pointer',
        padding: '2px',
        background: on ? 'var(--accent)' : 'var(--surface-3)',
        position: 'relative',
        flexShrink: 0,
        transition: 'background 0.18s',
        outline: 'none',
      }}
    >
      <span
        style={{
          display: 'block',
          width: '16px',
          height: '16px',
          borderRadius: '50%',
          background: '#fff',
          position: 'absolute',
          top: '2px',
          left: on ? '18px' : '2px',
          transition: 'left 0.18s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        }}
      />
    </button>
  )
}

// ── Select ─────────────────────────────────────────────────────────────────────

function Select({
  value,
  options,
  onChange,
}: {
  value: string
  options: { label: string; value: string }[]
  onChange: (v: string) => void
}) {
  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          appearance: 'none',
          WebkitAppearance: 'none',
          background: 'var(--surface-2)',
          border: '1px solid var(--hairline-strong)',
          borderRadius: '7px',
          padding: '6px 32px 6px 12px',
          fontSize: '13px',
          fontFamily: 'var(--font-sans)',
          fontWeight: 500,
          color: 'var(--ink)',
          cursor: 'pointer',
          outline: 'none',
          minWidth: '160px',
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {/* Chevron */}
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--ink-subtle)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ position: 'absolute', right: '10px', pointerEvents: 'none' }}
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </div>
  )
}

// ── Settings row ───────────────────────────────────────────────────────────────

function SettingsRow({
  label,
  children,
  last,
}: {
  label: string
  children: React.ReactNode
  last?: boolean
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        height: '48px',
        borderBottom: last ? 'none' : '1px solid var(--hairline)',
        paddingRight: '4px',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: '13px',
          fontWeight: 500,
          color: 'var(--ink)',
        }}
      >
        {label}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {children}
      </div>
    </div>
  )
}

// ── Toggle row (for Notifications) ────────────────────────────────────────────

function ToggleRow({
  label,
  description,
  on,
  onChange,
  last,
  extra,
}: {
  label: string
  description: string
  on: boolean
  onChange: (v: boolean) => void
  last?: boolean
  extra?: React.ReactNode
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: '16px',
        padding: '14px 0',
        borderBottom: last ? 'none' : '1px solid var(--hairline)',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: 1, minWidth: 0 }}>
        <span
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: '13px',
            fontWeight: 500,
            color: 'var(--ink)',
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: '12px',
            color: 'var(--ink-muted)',
            lineHeight: 1.5,
          }}
        >
          {description}
        </span>
        {extra && on && (
          <div style={{ marginTop: '8px' }}>{extra}</div>
        )}
      </div>
      <div style={{ paddingTop: '2px', flexShrink: 0 }}>
        <Toggle on={on} onChange={onChange} />
      </div>
    </div>
  )
}

// ── Section card ───────────────────────────────────────────────────────────────

function SectionCard({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        background: 'var(--surface-1)',
        border: '1px solid var(--hairline)',
        borderRadius: '12px',
        overflow: 'hidden',
        marginBottom: '24px',
      }}
    >
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--hairline)',
          background: 'var(--surface-2)',
        }}
      >
        <h3
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '14px',
            fontWeight: 600,
            color: 'var(--ink)',
            margin: 0,
            letterSpacing: '-0.01em',
          }}
        >
          {title}
        </h3>
        {description && (
          <p
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '12px',
              color: 'var(--ink-muted)',
              margin: '4px 0 0',
              lineHeight: 1.5,
            }}
          >
            {description}
          </p>
        )}
      </div>
      <div style={{ padding: '0 20px' }}>{children}</div>
    </div>
  )
}

// ── Left nav ───────────────────────────────────────────────────────────────────

const NAV_ITEMS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  {
    id: 'general',
    label: 'General',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
      </svg>
    ),
  },
  {
    id: 'notifications',
    label: 'Notifications',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 01-3.46 0" />
      </svg>
    ),
  },
  {
    id: 'webhooks',
    label: 'Webhooks',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
        <polyline points="15 3 21 3 21 9" />
        <line x1="10" y1="14" x2="21" y2="3" />
      </svg>
    ),
  },
  {
    id: 'api-keys',
    label: 'API Keys',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0110 0v4" />
      </svg>
    ),
  },
  {
    id: 'danger',
    label: 'Danger Zone',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  },
]

function NavItem({
  item,
  active,
  onClick,
}: {
  item: (typeof NAV_ITEMS)[number]
  active: boolean
  onClick: () => void
}) {
  const [hov, setHov] = useState(false)
  const isDanger = item.id === 'danger'

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '9px',
        width: '180px',
        height: '32px',
        padding: '0 10px',
        borderRadius: '6px',
        border: 'none',
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'var(--font-sans)',
        fontSize: '13px',
        fontWeight: active ? 600 : 500,
        background: active ? 'var(--surface-3)' : hov ? 'var(--surface-2)' : 'transparent',
        color: active
          ? isDanger
            ? 'var(--status-critical)'
            : 'var(--ink)'
          : isDanger
          ? 'rgba(240,68,56,0.7)'
          : hov
          ? 'var(--ink-muted)'
          : 'var(--ink-subtle)',
        borderLeft: active
          ? isDanger
            ? '2px solid var(--status-critical)'
            : '2px solid var(--accent)'
          : '2px solid transparent',
        transition: 'background 0.12s, color 0.12s',
        outline: 'none',
      }}
    >
      <span style={{ flexShrink: 0, opacity: active ? 1 : 0.7 }}>{item.icon}</span>
      {item.label}
    </button>
  )
}

// ── Section: General ───────────────────────────────────────────────────────────

function GeneralSection({ showToast }: { showToast: () => void }) {
  const [scanFreq, setScanFreq] = useState('manual')
  const [retention, setRetention] = useState('90d')
  const [layout, setLayout] = useState('force-atlas-2')

  const handle = useCallback(
    <T,>(setter: (v: T) => void) =>
      (v: T) => {
        setter(v)
        showToast()
      },
    [showToast]
  )

  return (
    <>
      <SectionCard title="Scan Settings">
        <SettingsRow label="Scan frequency">
          <Select
            value={scanFreq}
            onChange={handle(setScanFreq)}
            options={[
              { label: 'Manual only', value: 'manual' },
              { label: 'Every 6 hours', value: '6h' },
              { label: 'Every 24 hours', value: '24h' },
              { label: 'Every 7 days', value: '7d' },
            ]}
          />
        </SettingsRow>
        <SettingsRow label="Default regions">
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              color: 'var(--ink-subtle)',
              letterSpacing: '0.02em',
            }}
          >
            us-east-1, us-west-2, eu-west-1
          </span>
          <button
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--accent)',
              padding: '2px 0',
              outline: 'none',
            }}
          >
            Edit
          </button>
        </SettingsRow>
        <SettingsRow label="Data retention" last>
          <Select
            value={retention}
            onChange={handle(setRetention)}
            options={[
              { label: '30 days', value: '30d' },
              { label: '90 days', value: '90d' },
              { label: '1 year', value: '1y' },
            ]}
          />
        </SettingsRow>
      </SectionCard>

      <SectionCard title="Graph Rendering">
        <SettingsRow label="Graph layout" last>
          <Select
            value={layout}
            onChange={handle(setLayout)}
            options={[{ label: 'Force Atlas 2', value: 'force-atlas-2' }]}
          />
        </SettingsRow>
      </SectionCard>
    </>
  )
}

// ── Section: Notifications ─────────────────────────────────────────────────────

function ConnectSlackButton() {
  const [hov, setHov] = useState(false)
  return (
    <button
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 14px',
        borderRadius: '7px',
        border: '1px solid var(--hairline-strong)',
        background: hov ? 'var(--surface-3)' : 'var(--surface-2)',
        cursor: 'pointer',
        fontFamily: 'var(--font-sans)',
        fontSize: '12px',
        fontWeight: 600,
        color: 'var(--ink-muted)',
        transition: 'background 0.12s, color 0.12s',
        outline: 'none',
      }}
    >
      {/* Slack-like coloured icon */}
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="3" width="7" height="7" rx="2" fill="#e01e5a" opacity="0.9" />
        <rect x="14" y="3" width="7" height="7" rx="2" fill="#36c5f0" opacity="0.9" />
        <rect x="3" y="14" width="7" height="7" rx="2" fill="#2eb67d" opacity="0.9" />
        <rect x="14" y="14" width="7" height="7" rx="2" fill="#ecb22e" opacity="0.9" />
      </svg>
      Connect Slack
    </button>
  )
}

function NotificationsSection({ showToast }: { showToast: () => void }) {
  const [email, setEmail] = useState(true)
  const [slack, setSlack] = useState(false)
  const [pagerduty, setPagerduty] = useState(false)
  const [digest, setDigest] = useState(true)

  const handle = useCallback(
    (setter: (v: boolean) => void) => (v: boolean) => {
      setter(v)
      showToast()
    },
    [showToast]
  )

  return (
    <SectionCard title="Notification Channels" description="Control how and when LiveInfra notifies you about infrastructure events.">
      <ToggleRow
        label="Email alerts"
        description="Send email when critical alerts fire"
        on={email}
        onChange={handle(setEmail)}
      />
      <ToggleRow
        label="Slack integration"
        description="Post to #infra-alerts channel"
        on={slack}
        onChange={handle(setSlack)}
        extra={<ConnectSlackButton />}
      />
      <ToggleRow
        label="PagerDuty"
        description="Trigger incidents for critical severity"
        on={pagerduty}
        onChange={handle(setPagerduty)}
      />
      <ToggleRow
        label="Weekly digest"
        description="Summary of infrastructure changes, delivered Monday 9am"
        on={digest}
        onChange={handle(setDigest)}
        last
      />
    </SectionCard>
  )
}

// ── Section: Webhooks ──────────────────────────────────────────────────────────

const WEBHOOK_BASE_URL = 'https://your-api.liveinfra.io/webhooks'

type WebhookSource = 'pagerduty' | 'opsgenie' | 'cloudwatch'

function WebhookCard({
  source,
  label,
  description,
  docs,
}: {
  source: WebhookSource
  label: string
  description: string
  docs: string
}) {
  const [copied, setCopied] = useState(false)
  const endpointUrl = `${WEBHOOK_BASE_URL}/${source}/<your-customer-id>`

  const copy = async () => {
    await navigator.clipboard.writeText(endpointUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <div
      style={{
        border:       '1px solid var(--hairline)',
        borderRadius: '10px',
        padding:      '18px 20px',
        background:   'var(--surface-1)',
        display:      'flex',
        flexDirection: 'column',
        gap:          '10px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)', marginBottom: '3px' }}>{label}</div>
          <div style={{ fontSize: '12px', color: 'var(--ink-muted)' }}>{description}</div>
        </div>
        <a
          href={docs}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: '11px', color: 'var(--accent)', textDecoration: 'none', whiteSpace: 'nowrap' }}
        >
          Docs ↗
        </a>
      </div>

      {/* Endpoint URL */}
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
        <code
          style={{
            flex: 1, padding: '7px 10px', borderRadius: '6px', fontSize: '11px',
            fontFamily: 'var(--font-mono)', color: 'var(--ink-muted)',
            background: 'var(--surface-0)', border: '1px solid var(--hairline)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}
        >
          {endpointUrl}
        </code>
        <button
          onClick={copy}
          style={{
            padding:    '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 500,
            cursor:     'pointer', border: '1px solid var(--hairline)',
            background: copied ? 'rgba(23,178,106,0.12)' : 'var(--surface-2)',
            color:      copied ? '#17b26a' : 'var(--ink-muted)',
            transition: 'all 0.15s', whiteSpace: 'nowrap',
          }}
        >
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>

      {/* PagerDuty-specific: signature note */}
      {source === 'pagerduty' && (
        <div
          style={{
            fontSize: '11px', color: 'var(--ink-subtle)', lineHeight: '1.5',
            padding: '8px 10px', borderRadius: '6px', background: 'rgba(0,196,180,0.06)',
            border: '1px solid rgba(0,196,180,0.15)',
          }}
        >
          <strong style={{ color: 'var(--ink-muted)' }}>Auto-RCA:</strong> When a PagerDuty alert fires,
          LiveInfra automatically runs an AI RCA on the affected resource and shows it as a toast notification
          in the graph. Add <code style={{ fontFamily: 'var(--font-mono)', fontSize: '10px' }}>resource_arn</code> to
          your alert&apos;s <code style={{ fontFamily: 'var(--font-mono)', fontSize: '10px' }}>custom_details</code> to
          enable one-click graph linking.
        </div>
      )}
    </div>
  )
}

function WebhooksSection() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--ink)', marginBottom: '6px' }}>Webhooks</h2>
        <p style={{ fontSize: '13px', color: 'var(--ink-muted)', lineHeight: '1.5' }}>
          Connect your alerting tools so LiveInfra can automatically trigger AI RCA when incidents fire.
          Replace <code style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>&lt;your-customer-id&gt;</code> with
          your UUID from Settings → API Keys.
        </p>
      </div>

      <WebhookCard
        source="pagerduty"
        label="PagerDuty"
        description="V2 webhooks — auto-RCA on incident.trigger events"
        docs="https://developer.pagerduty.com/docs/webhooks/v2-overview/"
      />
      <WebhookCard
        source="opsgenie"
        label="OpsGenie"
        description="Action-based webhooks via the Integration settings"
        docs="https://support.atlassian.com/opsgenie/docs/create-a-webhook-integration/"
      />
      <WebhookCard
        source="cloudwatch"
        label="CloudWatch Alarms (via SNS)"
        description="Subscribe an SNS topic to this endpoint for alarm notifications"
        docs="https://docs.aws.amazon.com/sns/latest/dg/sns-http-https-endpoint-as-subscriber.html"
      />

      {/* Setup guide */}
      <div
        style={{
          border:       '1px solid var(--hairline)',
          borderRadius: '10px',
          padding:      '18px 20px',
          background:   'var(--surface-1)',
        }}
      >
        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)', marginBottom: '10px' }}>
          PagerDuty quick-setup
        </div>
        {[
          'In PagerDuty: Services → your service → Integrations → Add Integration → Generic V2 Webhook',
          'Paste the endpoint URL above (with your customer ID)',
          'Copy the signing secret PagerDuty generates — contact support to store it in LiveInfra',
          'Trigger a test alert — you\'ll see a toast notification in the graph within seconds',
        ].map((step, i) => (
          <div key={i} style={{ display: 'flex', gap: '10px', marginBottom: '8px', fontSize: '12px', color: 'var(--ink-muted)' }}>
            <span
              style={{
                width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(0,196,180,0.12)', color: 'var(--accent)',
                fontSize: '10px', fontWeight: 700,
              }}
            >
              {i + 1}
            </span>
            <span style={{ lineHeight: '1.5', paddingTop: '2px' }}>{step}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Section: API Keys ──────────────────────────────────────────────────────────

function CopyIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  )
}

function ApiKeysSection() {
  const [showNewKeyForm, setShowNewKeyForm] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [createdKey, setCreatedKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [revokeHov, setRevokeHov] = useState(false)
  const [genHov, setGenHov] = useState(false)

  const handleCreate = () => {
    if (!newKeyName.trim()) return
    // Simulate a generated key
    const rand = Math.random().toString(36).slice(2, 18)
    setCreatedKey(`sk-live-${rand}`)
    setNewKeyName('')
    setShowNewKeyForm(false)
  }

  const handleCopy = () => {
    if (createdKey) {
      navigator.clipboard.writeText(createdKey).catch(() => {})
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <>
      <SectionCard
        title="API Keys"
        description="Use API keys to access LiveInfra data from your own tools and scripts."
      >
        {/* Existing key row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            padding: '14px 0',
            borderBottom: '1px solid var(--hairline)',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--ink)',
                }}
              >
                Production monitoring
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  color: 'var(--ink-subtle)',
                  letterSpacing: '0.05em',
                }}
              >
                sk-live-••••••••••••••••A3f9
              </span>
            </div>
            <span
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '11px',
                color: 'var(--ink-subtle)',
              }}
            >
              Created Jan 14, 2026 &nbsp;·&nbsp; Last used 2h ago
            </span>
          </div>
          <button
            onMouseEnter={() => setRevokeHov(true)}
            onMouseLeave={() => setRevokeHov(false)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
              fontSize: '12px',
              fontWeight: 600,
              color: revokeHov ? 'var(--status-critical)' : 'rgba(240,68,56,0.6)',
              padding: '4px 0',
              outline: 'none',
              transition: 'color 0.12s',
              flexShrink: 0,
            }}
          >
            Revoke
          </button>
        </div>

        {/* New key form (inline) */}
        {showNewKeyForm && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px 0',
              borderBottom: '1px solid var(--hairline)',
            }}
          >
            <input
              type="text"
              placeholder="Key name (e.g. CI Pipeline)"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              autoFocus
              style={{
                flex: 1,
                background: 'var(--surface-2)',
                border: '1px solid var(--hairline-strong)',
                borderRadius: '7px',
                padding: '7px 12px',
                fontFamily: 'var(--font-sans)',
                fontSize: '13px',
                color: 'var(--ink)',
                outline: 'none',
                minWidth: 0,
              }}
            />
            <button
              onClick={handleCreate}
              style={{
                padding: '7px 16px',
                borderRadius: '7px',
                border: 'none',
                background: 'var(--accent)',
                color: '#000',
                fontFamily: 'var(--font-sans)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                flexShrink: 0,
                outline: 'none',
              }}
            >
              Create
            </button>
            <button
              onClick={() => { setShowNewKeyForm(false); setNewKeyName('') }}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--ink-subtle)',
                fontFamily: 'var(--font-sans)',
                fontSize: '12px',
                outline: 'none',
              }}
            >
              Cancel
            </button>
          </div>
        )}

        {/* One-time key display */}
        {createdKey && (
          <div
            style={{
              margin: '14px 0',
              padding: '12px 14px',
              borderRadius: '8px',
              background: 'var(--accent-dim)',
              border: '1px solid rgba(0,196,180,0.25)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '13px',
                  color: 'var(--ink)',
                  flex: 1,
                  letterSpacing: '0.04em',
                  wordBreak: 'break-all',
                }}
              >
                {createdKey}
              </span>
              <button
                onClick={handleCopy}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '5px 10px',
                  borderRadius: '6px',
                  border: '1px solid rgba(0,196,180,0.3)',
                  background: copied ? 'rgba(0,196,180,0.15)' : 'transparent',
                  cursor: 'pointer',
                  color: 'var(--accent)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '11px',
                  fontWeight: 600,
                  outline: 'none',
                  flexShrink: 0,
                  transition: 'background 0.12s',
                }}
              >
                <CopyIcon />
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: '11px',
                  color: 'var(--accent)',
                  fontWeight: 500,
                }}
              >
                This key won&apos;t be shown again. Copy it now.
              </span>
            </div>
          </div>
        )}

        {/* Generate new key button */}
        {!showNewKeyForm && (
          <div style={{ padding: '16px 0 4px' }}>
            <button
              onClick={() => { setShowNewKeyForm(true); setCreatedKey(null) }}
              onMouseEnter={() => setGenHov(true)}
              onMouseLeave={() => setGenHov(false)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '7px',
                padding: '8px 16px',
                borderRadius: '7px',
                border: `1px solid ${genHov ? 'var(--accent)' : 'var(--hairline-strong)'}`,
                background: genHov ? 'var(--accent-dim)' : 'transparent',
                cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
                fontSize: '13px',
                fontWeight: 600,
                color: genHov ? 'var(--accent)' : 'var(--ink-muted)',
                transition: 'border-color 0.12s, background 0.12s, color 0.12s',
                outline: 'none',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Generate New Key
            </button>
          </div>
        )}
      </SectionCard>
    </>
  )
}

// ── Section: Danger Zone ───────────────────────────────────────────────────────

function DangerAction({
  title,
  description,
  buttonLabel,
  solid,
}: {
  title: string
  description: string
  buttonLabel: string
  solid?: boolean
}) {
  const [confirming, setConfirming] = useState(false)
  const [confirmInput, setConfirmInput] = useState('')
  const [btnHov, setBtnHov] = useState(false)
  const [confirmHov, setConfirmHov] = useState(false)
  const valid = confirmInput === 'DELETE'

  const handleConfirm = () => {
    if (!valid) return
    setConfirming(false)
    setConfirmInput('')
    // No actual API call — UI-only for now
  }

  return (
    <div
      style={{
        padding: '16px 0',
        borderBottom: '1px solid rgba(240,68,56,0.15)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--ink)',
              margin: '0 0 2px',
            }}
          >
            {title}
          </p>
          <p
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '12px',
              color: 'var(--ink-muted)',
              margin: 0,
            }}
          >
            {description}
          </p>
        </div>
        <button
          onClick={() => { setConfirming((c) => !c); setConfirmInput('') }}
          onMouseEnter={() => setBtnHov(true)}
          onMouseLeave={() => setBtnHov(false)}
          style={{
            padding: '7px 16px',
            borderRadius: '7px',
            border: solid
              ? 'none'
              : '1px solid rgba(240,68,56,0.4)',
            background: solid
              ? btnHov
                ? '#d73228'
                : 'var(--status-critical)'
              : btnHov
              ? 'rgba(240,68,56,0.12)'
              : 'transparent',
            cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
            fontSize: '12px',
            fontWeight: 600,
            color: solid ? '#fff' : 'var(--status-critical)',
            transition: 'background 0.12s',
            outline: 'none',
            flexShrink: 0,
          }}
        >
          {buttonLabel}
        </button>
      </div>

      {/* Inline confirmation */}
      {confirming && (
        <div
          style={{
            marginTop: '12px',
            padding: '12px 14px',
            borderRadius: '8px',
            background: 'rgba(240,68,56,0.06)',
            border: '1px solid rgba(240,68,56,0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            flexWrap: 'wrap',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '12px',
              color: 'var(--ink-muted)',
              flexShrink: 0,
            }}
          >
            Type <strong style={{ color: 'var(--status-critical)', fontFamily: 'var(--font-mono)' }}>DELETE</strong> to confirm:
          </span>
          <input
            type="text"
            value={confirmInput}
            onChange={(e) => setConfirmInput(e.target.value)}
            placeholder="DELETE"
            autoFocus
            style={{
              background: 'var(--surface-1)',
              border: `1px solid ${valid ? 'var(--status-critical)' : 'var(--hairline-strong)'}`,
              borderRadius: '6px',
              padding: '5px 10px',
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              color: 'var(--status-critical)',
              outline: 'none',
              width: '120px',
              letterSpacing: '0.04em',
            }}
          />
          <button
            onClick={handleConfirm}
            onMouseEnter={() => setConfirmHov(true)}
            onMouseLeave={() => setConfirmHov(false)}
            disabled={!valid}
            style={{
              padding: '5px 14px',
              borderRadius: '6px',
              border: 'none',
              background: valid
                ? confirmHov
                  ? '#d73228'
                  : 'var(--status-critical)'
                : 'var(--surface-3)',
              cursor: valid ? 'pointer' : 'not-allowed',
              fontFamily: 'var(--font-sans)',
              fontSize: '12px',
              fontWeight: 600,
              color: valid ? '#fff' : 'var(--ink-ghost)',
              transition: 'background 0.12s',
              outline: 'none',
              opacity: valid ? 1 : 0.5,
            }}
          >
            Confirm
          </button>
          <button
            onClick={() => { setConfirming(false); setConfirmInput('') }}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
              fontSize: '12px',
              color: 'var(--ink-subtle)',
              outline: 'none',
            }}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}

function DangerZoneSection() {
  return (
    <div
      style={{
        border: '1px solid rgba(240,68,56,0.3)',
        background: 'rgba(240,68,56,0.04)',
        borderRadius: '12px',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '14px 20px',
          borderBottom: '1px solid rgba(240,68,56,0.2)',
          background: 'rgba(240,68,56,0.06)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--status-critical)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <h3
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '14px',
            fontWeight: 600,
            color: 'var(--status-critical)',
            margin: 0,
          }}
        >
          Danger Zone
        </h3>
      </div>
      <div style={{ padding: '0 20px' }}>
        <DangerAction
          title="Clear scan data"
          description="Permanently delete all scan history and graph snapshots."
          buttonLabel="Clear Data"
        />
        <div style={{ paddingBottom: '4px' }}>
          <DangerAction
            title="Delete account"
            description="Remove your account and all associated data."
            buttonLabel="Delete Account"
            solid
          />
        </div>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function SettingsClient() {
  const [activeTab, setActiveTab] = useState<Tab>('general')
  const [toastVisible, setToastVisible] = useState(false)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = useCallback(() => {
    setToastVisible(true)
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToastVisible(false), 2000)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      <style>{`
        select option { background: #111929; color: #e2e8f4; }
        input::placeholder { color: var(--ink-ghost); }
        input:focus { border-color: var(--accent) !important; box-shadow: 0 0 0 2px var(--accent-dim); }
        select:focus { border-color: var(--accent) !important; outline: none; }
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
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
            padding: '0 28px',
            height: '60px',
            flexShrink: 0,
            background: 'var(--surface-1)',
            borderBottom: '1px solid var(--hairline)',
            boxShadow: '0 1px 0 rgba(0,0,0,0.3)',
            gap: '10px',
          }}
        >
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
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
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
            Settings
          </h1>
        </header>

        {/* Body: sidebar + content */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            overflow: 'hidden',
          }}
        >
          {/* Left sidebar */}
          <aside
            style={{
              width: '220px',
              flexShrink: 0,
              borderRight: '1px solid var(--hairline)',
              background: 'var(--surface-1)',
              padding: '20px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '10px',
                fontWeight: 700,
                color: 'var(--ink-ghost)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                padding: '0 10px',
                marginBottom: '6px',
              }}
            >
              Settings
            </span>
            {NAV_ITEMS.map((item) => (
              <NavItem
                key={item.id}
                item={item}
                active={activeTab === item.id}
                onClick={() => setActiveTab(item.id)}
              />
            ))}
          </aside>

          {/* Right content */}
          <main
            style={{
              flex: 1,
              overflow: 'auto',
              padding: '28px',
              background: 'var(--canvas)',
            }}
          >
            <div
              key={activeTab}
              style={{
                maxWidth: '680px',
                animation: 'fade-in 0.15s ease',
              }}
            >
              {activeTab === 'general' && <GeneralSection showToast={showToast} />}
              {activeTab === 'notifications' && <NotificationsSection showToast={showToast} />}
              {activeTab === 'webhooks' && <WebhooksSection />}
              {activeTab === 'api-keys' && <ApiKeysSection />}
              {activeTab === 'danger' && <DangerZoneSection />}
            </div>
          </main>
        </div>
      </div>

      <Toast visible={toastVisible} />
    </>
  )
}
