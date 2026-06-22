'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { trpc } from '@/lib/trpc'

// ── Types ──────────────────────────────────────────────────────────────────────

interface OnboardingClientProps {
  clerkUserId: string
  email: string | undefined
}

type Step = 1 | 2 | 3 | 4

const AVAILABLE_REGIONS = [
  'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
  'eu-west-1', 'eu-central-1',
  'ap-southeast-1', 'ap-south-1', 'ap-northeast-1',
] as const

// Scan progress steps — ordered by wall-clock expectation
const SCAN_PHASES = [
  { key: 'connect',  label: 'Connecting to AWS' },
  { key: 'ec2',     label: 'Scanning EC2' },
  { key: 'rds',     label: 'Scanning RDS' },
  { key: 'lambda',  label: 'Scanning Lambda' },
  { key: 'elb',     label: 'Scanning Load Balancers' },
  { key: 'graph',   label: 'Building dependency graph' },
  { key: 'done',    label: 'Done' },
] as const

type PhaseKey = typeof SCAN_PHASES[number]['key']

const TRUST_POLICY = JSON.stringify(
  {
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Principal: { AWS: 'arn:aws:iam::975050024946:root' },
        Action: 'sts:AssumeRole',
        Condition: {
          StringEquals: { 'sts:ExternalId': 'liveinfra' },
        },
      },
    ],
  },
  null,
  2
)

// ── Helpers ────────────────────────────────────────────────────────────────────

function StepBubbles({ current }: { current: Step }) {
  const steps: { num: Step; label: string }[] = [
    { num: 1, label: 'AWS Account' },
    { num: 2, label: 'IAM Role' },
    { num: 3, label: 'First Scan' },
    { num: 4, label: 'Graph Ready' },
  ]
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0', marginBottom: '40px' }}>
      {steps.map(({ num, label }, i) => {
        const done   = num < current
        const active = num === current
        return (
          <div key={num} style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
              <div
                style={{
                  width: '32px', height: '32px', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '12px', fontWeight: 700, fontFamily: 'var(--font-mono)',
                  background: done ? 'var(--accent)' : active ? 'var(--accent-dim)' : 'var(--surface-3)',
                  color: done ? '#000' : active ? 'var(--accent)' : 'var(--ink-subtle)',
                  border: `1.5px solid ${done ? 'transparent' : active ? 'var(--accent)' : 'var(--hairline-strong)'}`,
                  transition: 'all 0.25s',
                  flexShrink: 0,
                }}
              >
                {done ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : num}
              </div>
              <span style={{
                fontSize: '10px', fontFamily: 'var(--font-sans)', fontWeight: active ? 600 : 400,
                color: active ? 'var(--ink)' : done ? 'var(--ink-muted)' : 'var(--ink-subtle)',
                whiteSpace: 'nowrap',
              }}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div style={{
                width: '60px', height: '1.5px', marginBottom: '20px',
                background: num < current ? 'var(--accent)' : 'var(--hairline-strong)',
                transition: 'background 0.3s',
              }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* ignore */ }
  }, [value])
  return (
    <button
      onClick={copy}
      style={{
        position: 'absolute', top: '8px', right: '8px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: '28px', height: '28px', borderRadius: '6px',
        border: '1px solid var(--hairline-strong)',
        background: copied ? 'rgba(0,196,180,0.15)' : 'var(--surface-2)',
        cursor: 'pointer', color: copied ? 'var(--accent)' : 'var(--ink-subtle)',
        transition: 'all 0.15s',
      }}
    >
      {copied ? (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" />
          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
        </svg>
      )}
    </button>
  )
}

function Field({
  label, id, value, onChange, placeholder, error, hint, mono, required,
}: {
  label: string; id: string; value: string; onChange: (v: string) => void
  placeholder?: string; error?: string | null | undefined; hint?: string; mono?: boolean; required?: boolean
}) {
  const [focused, setFocused] = useState(false)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <label htmlFor={id} style={{
        fontSize: '11px', fontWeight: 600, letterSpacing: '0.06em',
        textTransform: 'uppercase', color: 'var(--ink-muted)', fontFamily: 'var(--font-sans)',
      }}>
        {label}{required && <span style={{ color: 'var(--accent)', marginLeft: '3px' }}>*</span>}
      </label>
      <input
        id={id} type="text" value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{
          padding: '9px 12px', borderRadius: '7px',
          border: `1px solid ${error ? 'rgba(240,68,56,0.5)' : focused ? 'var(--accent)' : 'var(--hairline-strong)'}`,
          background: 'var(--surface-2)', color: 'var(--ink)',
          fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)',
          fontSize: mono ? '13px' : '14px', outline: 'none', transition: 'border-color 0.15s',
          boxShadow: focused ? `0 0 0 3px ${error ? 'rgba(240,68,56,0.12)' : 'rgba(0,196,180,0.12)'}` : 'none',
          width: '100%', boxSizing: 'border-box',
        }}
      />
      {hint && !error && <span style={{ fontSize: '11px', color: 'var(--ink-subtle)', fontFamily: 'var(--font-sans)' }}>{hint}</span>}
      {error && <span style={{ fontSize: '11px', color: 'var(--status-critical)', fontFamily: 'var(--font-sans)' }}>{error}</span>}
    </div>
  )
}

// ── Step 1: AWS Account Details ────────────────────────────────────────────────

function Step1({
  accountId, setAccountId,
  accountAlias, setAccountAlias,
  regions, setRegions,
  onNext,
}: {
  accountId: string; setAccountId: (v: string) => void
  accountAlias: string; setAccountAlias: (v: string) => void
  regions: string[]; setRegions: (v: string[]) => void
  onNext: () => void
}) {
  const [errors, setErrors] = useState<{ accountId?: string | null; regions?: string | null }>({})

  const validate = () => {
    const next: typeof errors = {}
    if (!/^\d{12}$/.test(accountId.trim())) next.accountId = 'Must be exactly 12 digits'
    if (regions.length === 0) next.regions = 'Select at least one region'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const toggleRegion = (r: string) =>
    setRegions(regions.includes(r) ? regions.filter((x) => x !== r) : [...regions, r])

  const allSelected = regions.length === AVAILABLE_REGIONS.length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h2 style={{ margin: '0 0 6px', fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 700, color: 'var(--ink)' }}>
          Connect your AWS account
        </h2>
        <p style={{ margin: 0, fontSize: '14px', color: 'var(--ink-muted)', fontFamily: 'var(--font-sans)', lineHeight: 1.6 }}>
          Enter your 12-digit AWS Account ID and choose which regions to scan.
        </p>
      </div>

      <Field
        label="AWS Account ID" id="account-id" value={accountId}
        onChange={(v) => { setAccountId(v); setErrors((e) => ({ ...e, accountId: null })) }}
        placeholder="123456789012" error={errors.accountId} mono required
        hint="Found in the top-right of the AWS Console"
      />
      <Field
        label="Account Name (optional)" id="account-alias" value={accountAlias}
        onChange={setAccountAlias} placeholder="production, staging…"
        hint="Friendly label shown in the dashboard"
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <label style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-muted)' }}>
            Regions to scan<span style={{ color: 'var(--accent)', marginLeft: '3px' }}>*</span>
          </label>
          <button
            type="button"
            onClick={() => setRegions(allSelected ? [] : [...AVAILABLE_REGIONS])}
            style={{ fontSize: '11px', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontWeight: 500 }}
          >
            {allSelected ? 'Deselect all' : 'Select all'}
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', padding: '12px', borderRadius: '8px', background: 'var(--surface-2)', border: '1px solid var(--hairline)' }}>
          {AVAILABLE_REGIONS.map((region) => {
            const checked = regions.includes(region)
            return (
              <label key={region} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '4px 6px', borderRadius: '5px', background: checked ? 'var(--accent-dim)' : 'transparent', transition: 'background 0.12s' }}>
                <div
                  onClick={() => toggleRegion(region)}
                  style={{
                    width: '15px', height: '15px', borderRadius: '4px',
                    border: `1.5px solid ${checked ? 'var(--accent)' : 'var(--hairline-strong)'}`,
                    background: checked ? 'var(--accent)' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, cursor: 'pointer', transition: 'all 0.12s',
                  }}
                >
                  {checked && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
                </div>
                <span
                  onClick={() => toggleRegion(region)}
                  style={{ fontSize: '12px', color: checked ? 'var(--accent)' : 'var(--ink-muted)', fontFamily: 'var(--font-mono)', fontWeight: checked ? 500 : 400, userSelect: 'none' }}
                >
                  {region}
                </span>
              </label>
            )
          })}
        </div>
        {errors.regions && <span style={{ fontSize: '11px', color: 'var(--status-critical)' }}>{errors.regions}</span>}
        {regions.length > 0 && !errors.regions && (
          <span style={{ fontSize: '11px', color: 'var(--ink-subtle)' }}>{regions.length} region{regions.length !== 1 ? 's' : ''} selected</span>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '8px' }}>
        <Btn onClick={() => { if (validate()) onNext() }}>
          Next: Set up IAM Role
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
          </svg>
        </Btn>
      </div>
    </div>
  )
}

// ── Step 2: IAM Role Setup ─────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const trpcAny = trpc as any

function Step2({
  customerId, accountId, onBack, onNext,
}: {
  customerId: string; accountId: string; onBack: () => void; onNext: (roleArn: string) => void
}) {
  const [roleArn, setRoleArn]     = useState('')
  const [error, setError]         = useState<string | null>(null)
  const [validating, setValidating] = useState(false)

  const validateMutation = trpcAny?.accounts?.validate?.useMutation?.({
    onSuccess: (res: { valid: boolean; resolvedAccountId?: string; error?: string }) => {
      setValidating(false)
      if (res.valid) {
        onNext(roleArn)
      } else {
        setError(res.error ?? 'Validation failed — check the role ARN and trust policy.')
      }
    },
    onError: (err: Error) => {
      setValidating(false)
      if (String(err).includes('NOT_FOUND') || String(err).includes('not found')) {
        // Procedure exists but validation endpoint not wired; skip
        onNext(roleArn)
      } else {
        setError(err.message)
      }
    },
  })

  const handleValidate = () => {
    const arnPattern = /^arn:aws:iam::\d{12}:role\/.+$/
    if (!arnPattern.test(roleArn.trim())) {
      setError('Must be a valid IAM role ARN (e.g. arn:aws:iam::123456789012:role/LiveInfraScanner)')
      return
    }
    setError(null)
    setValidating(true)
    try {
      validateMutation?.mutate?.({ roleArn, externalId: 'liveinfra', accountId })
    } catch {
      setValidating(false)
      onNext(roleArn)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h2 style={{ margin: '0 0 6px', fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 700, color: 'var(--ink)' }}>
          Create an IAM role
        </h2>
        <p style={{ margin: 0, fontSize: '14px', color: 'var(--ink-muted)', fontFamily: 'var(--font-sans)', lineHeight: 1.6 }}>
          LiveInfra needs read-only access to scan your account. Follow these steps in your AWS Console.
        </p>
      </div>

      {/* Step list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {[
          {
            label: (
              <span>
                Open{' '}
                <a
                  href="https://console.aws.amazon.com/iam/home#/roles$new?step=type&roleType=crossAccount&accountID=975050024946"
                  target="_blank" rel="noopener noreferrer"
                  style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}
                >
                  IAM Console
                </a>{' '}
                in account <code style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--accent)', background: 'var(--accent-dim)', padding: '1px 5px', borderRadius: '3px' }}>{accountId || '············'}</code>
              </span>
            ),
          },
          {
            label: 'Create a cross-account role with this trust policy:',
            extra: (
              <div style={{ position: 'relative', borderRadius: '8px', background: 'var(--canvas)', border: '1px solid var(--hairline-strong)', overflow: 'hidden' }}>
                <pre style={{ margin: 0, padding: '14px 48px 14px 16px', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--ink-muted)', lineHeight: 1.6, overflowX: 'auto' }}>
                  {TRUST_POLICY}
                </pre>
                <CopyButton value={TRUST_POLICY} />
              </div>
            ),
          },
          {
            label: (
              <span>
                Attach the <code style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--ink)', background: 'var(--surface-3)', padding: '1px 5px', borderRadius: '3px' }}>ReadOnlyAccess</code> managed policy
              </span>
            ),
          },
          {
            label: (
              <span>
                Name the role <code style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--ink)', background: 'var(--surface-3)', padding: '1px 5px', borderRadius: '3px' }}>LiveInfraScanner</code>
              </span>
            ),
          },
        ].map((s, i) => (
          <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
            <div style={{
              width: '22px', height: '22px', borderRadius: '50%', flexShrink: 0, marginTop: '1px',
              background: 'var(--surface-3)', border: '1px solid var(--hairline-strong)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '11px', fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--font-mono)',
            }}>
              {i + 1}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: '13px', color: 'var(--ink-muted)', fontFamily: 'var(--font-sans)', lineHeight: 1.5 }}>{s.label}</span>
              {s.extra}
            </div>
          </div>
        ))}
      </div>

      {/* External ID chip */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '12px', color: 'var(--ink-subtle)', fontFamily: 'var(--font-sans)' }}>External ID:</span>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '6px', background: 'var(--surface-2)', border: '1px solid var(--hairline-strong)' }}>
          <code style={{ fontSize: '12px', color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>liveinfra</code>
          <CopyButton value="liveinfra" />
        </div>
        <span style={{ fontSize: '11px', color: 'var(--ink-ghost)', fontFamily: 'var(--font-sans)' }}>(required in trust policy)</span>
      </div>

      <div style={{ height: '1px', background: 'var(--hairline)' }} />

      <Field
        label="Role ARN" id="role-arn" value={roleArn}
        onChange={(v) => { setRoleArn(v); setError(null) }}
        placeholder="arn:aws:iam::123456789012:role/LiveInfraScanner"
        error={error} mono required
        hint="Paste the ARN of the role you just created"
      />

      {customerId /* just to reference it so TS doesn't warn — it's passed for add mutation */ && null}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '4px' }}>
        <GhostBtn onClick={onBack}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
          </svg>
          Back
        </GhostBtn>
        <Btn onClick={handleValidate} disabled={validating}>
          {validating ? (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
                <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Validating…
            </>
          ) : (
            <>
              Validate &amp; Continue
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
              </svg>
            </>
          )}
        </Btn>
      </div>
    </div>
  )
}

// ── Step 3: First Scan with live progress ──────────────────────────────────────

function Step3({
  customerId, accountId, roleArn, regions, onComplete,
}: {
  customerId: string; accountId: string; roleArn: string; regions: string[]; onComplete: (nodeCount: number) => void
}) {
  const [phase, setPhase]   = useState<PhaseKey>('connect')
  const [started, setStarted] = useState(false)
  const [error, setError]   = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startedAtRef = useRef<string | null>(null)
  const phaseIndexRef = useRef(0)

  const triggerMutation = trpcAny?.scanner?.trigger?.useMutation?.({
    onSuccess: (res: { queued: boolean; startedAt: string }) => {
      startedAtRef.current = res.startedAt
      setStarted(true)
      // Advance through phases on a timer to show realistic progress
      const phases: PhaseKey[] = ['connect', 'ec2', 'rds', 'lambda', 'elb', 'graph']
      phaseIndexRef.current = 0
      pollRef.current = setInterval(() => {
        phaseIndexRef.current += 1
        const next = phases[phaseIndexRef.current]
        if (next) setPhase(next)
        else if (pollRef.current) clearInterval(pollRef.current)
      }, 4_000)
    },
    onError: (err: Error) => {
      setError(err.message)
    },
  })

  const statusQuery = trpcAny?.scanner?.status?.useQuery?.(
    { customerId, accountId },
    { enabled: started, refetchInterval: 3_000, staleTime: 0 }
  )

  // Detect completion: a new lastScanAt appeared after we triggered
  useEffect(() => {
    if (!started || !startedAtRef.current || !statusQuery?.data?.lastScanAt) return
    if (new Date(statusQuery.data.lastScanAt) > new Date(startedAtRef.current)) {
      if (pollRef.current) clearInterval(pollRef.current)
      setPhase('done')
      const count = Number(statusQuery.data.nodeCount ?? 0)
      setTimeout(() => onComplete(count), 1200)
    }
  }, [started, statusQuery?.data?.lastScanAt, statusQuery?.data?.nodeCount, onComplete])

  // Auto-trigger on mount
  useEffect(() => {
    if (!triggerMutation?.mutate) return
    triggerMutation.mutate({ customerId, accountId, roleArn, externalId: 'liveinfra', regions })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Cleanup
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current) }, [])

  const currentIndex = SCAN_PHASES.findIndex((p) => p.key === phase)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      <div>
        <h2 style={{ margin: '0 0 6px', fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 700, color: 'var(--ink)' }}>
          Scanning your infrastructure
        </h2>
        <p style={{ margin: 0, fontSize: '14px', color: 'var(--ink-muted)', fontFamily: 'var(--font-sans)', lineHeight: 1.6 }}>
          This usually takes 1–3 minutes depending on the number of resources.
        </p>
      </div>

      {error ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '10px', padding: '14px 16px', borderRadius: '10px', background: 'rgba(240,68,56,0.08)', border: '1px solid rgba(240,68,56,0.25)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--status-critical)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '1px' }}>
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--status-critical)', fontFamily: 'var(--font-sans)', marginBottom: '4px' }}>Scan failed</div>
              <div style={{ fontSize: '12px', color: 'rgba(240,68,56,0.8)', fontFamily: 'var(--font-mono)', lineHeight: 1.5 }}>{error}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <GhostBtn onClick={() => { setError(null); setStarted(false); setPhase('connect') }}>Try again</GhostBtn>
            <GhostBtn onClick={() => onComplete(0)}>Skip and go to dashboard</GhostBtn>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {SCAN_PHASES.filter((p) => p.key !== 'done').map((p, i) => {
            const done    = i < currentIndex
            const active  = i === currentIndex
            const pending = i > currentIndex
            return (
              <div key={p.key} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', borderRadius: '8px', background: active ? 'var(--accent-dim)' : 'var(--surface-2)', border: `1px solid ${active ? 'var(--accent)30' : 'var(--hairline)'}`, transition: 'all 0.3s' }}>
                <div style={{ width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {done ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--status-healthy)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" fill="rgba(18,183,106,0.12)" stroke="rgba(18,183,106,0.4)" />
                      <polyline points="8 12 11 15 16 9" />
                    </svg>
                  ) : active ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
                      <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  ) : (
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: pending ? 'var(--surface-3)' : 'var(--accent)' }} />
                  )}
                </div>
                <span style={{
                  fontSize: '13px', fontFamily: 'var(--font-sans)',
                  color: done ? 'var(--ink-muted)' : active ? 'var(--ink)' : 'var(--ink-subtle)',
                  fontWeight: active ? 600 : 400, transition: 'all 0.2s',
                }}>
                  {p.label}
                </span>
                {active && (
                  <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--accent)', fontFamily: 'var(--font-mono)', animation: 'pulse 1.4s ease-in-out infinite' }}>
                    in progress
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div style={{ padding: '12px 16px', borderRadius: '8px', background: 'var(--surface-2)', border: '1px solid var(--hairline)', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--ink-subtle)' }}>{accountId}</span>
        <span style={{ fontSize: '11px', color: 'var(--hairline-strong)', margin: '0 2px' }}>·</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--ink-subtle)' }}>{regions.length} region{regions.length !== 1 ? 's' : ''}</span>
      </div>
    </div>
  )
}

// ── Step 4: Graph Ready ────────────────────────────────────────────────────────

function Step4({ nodeCount, onDashboard }: { nodeCount: number; onDashboard: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px', padding: '32px 0', textAlign: 'center' }}>
      {/* Animated graph illustration */}
      <div style={{ position: 'relative', width: '120px', height: '120px' }}>
        <svg width="120" height="120" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="55" fill="rgba(0,196,180,0.04)" stroke="rgba(0,196,180,0.15)" strokeWidth="1" />
          <line x1="60" y1="60" x2="30" y2="30" stroke="rgba(0,196,180,0.3)" strokeWidth="1.5" />
          <line x1="60" y1="60" x2="90" y2="30" stroke="rgba(0,196,180,0.3)" strokeWidth="1.5" />
          <line x1="60" y1="60" x2="25" y2="80" stroke="rgba(0,196,180,0.3)" strokeWidth="1.5" />
          <line x1="60" y1="60" x2="95" y2="80" stroke="rgba(0,196,180,0.3)" strokeWidth="1.5" />
          <line x1="60" y1="60" x2="60" y2="20" stroke="rgba(0,196,180,0.3)" strokeWidth="1.5" />
          <circle cx="60" cy="60" r="10" fill="rgba(0,196,180,0.2)" stroke="#00c4b4" strokeWidth="2" />
          <circle cx="30" cy="30" r="6" fill="#f9a825" opacity="0.9" />
          <circle cx="90" cy="30" r="6" fill="#c47aff" opacity="0.9" />
          <circle cx="25" cy="80" r="6" fill="#4d9fff" opacity="0.9" />
          <circle cx="95" cy="80" r="6" fill="#3ecf8e" opacity="0.9" />
          <circle cx="60" cy="20" r="6" fill="#ff7d54" opacity="0.9" />
        </svg>
        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', boxShadow: '0 0 40px rgba(0,196,180,0.25)' }} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 700, color: 'var(--ink)' }}>
          Your graph is ready
        </h2>
        {nodeCount > 0 && (
          <p style={{ margin: 0, fontSize: '15px', color: 'var(--ink-muted)', fontFamily: 'var(--font-sans)' }}>
            <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{nodeCount.toLocaleString()}</span> resources mapped and ready to explore.
          </p>
        )}
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--ink-subtle)', fontFamily: 'var(--font-sans)', lineHeight: 1.6, maxWidth: '340px' }}>
          Click any node to see its dependencies, blast radius, and AI root cause analysis.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center', width: '100%', maxWidth: '320px' }}>
        <Btn onClick={onDashboard} fullWidth>
          Open graph dashboard
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
          </svg>
        </Btn>
      </div>
    </div>
  )
}

// ── Button primitives ──────────────────────────────────────────────────────────

function Btn({
  onClick, children, disabled, fullWidth,
}: {
  onClick: () => void; children: React.ReactNode; disabled?: boolean; fullWidth?: boolean
}) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick} disabled={disabled}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '7px',
        padding: '10px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
        fontFamily: 'var(--font-sans)', border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
        background: disabled ? 'var(--surface-3)' : hov ? 'var(--accent-hover)' : 'var(--accent)',
        color: disabled ? 'var(--ink-subtle)' : '#000', opacity: disabled ? 0.7 : 1,
        transition: 'all 0.15s', width: fullWidth ? '100%' : undefined,
        justifyContent: fullWidth ? 'center' : undefined,
      }}
    >
      {children}
    </button>
  )
}

function GhostBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        padding: '9px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 500,
        fontFamily: 'var(--font-sans)', cursor: 'pointer', transition: 'all 0.15s',
        border: `1px solid ${hov ? 'var(--hairline-strong)' : 'var(--hairline)'}`,
        background: hov ? 'var(--surface-2)' : 'transparent', color: 'var(--ink-muted)',
      }}
    >
      {children}
    </button>
  )
}

// ── Main onboarding client ─────────────────────────────────────────────────────

export default function OnboardingClient({ clerkUserId, email }: OnboardingClientProps) {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)

  // Account fields
  const [accountId, setAccountId]       = useState('')
  const [accountAlias, setAccountAlias] = useState('')
  const [regions, setRegions]           = useState<string[]>(['us-east-1', 'us-east-2', 'us-west-2'])
  const [roleArn, setRoleArn]           = useState('')
  const [customerId, setCustomerId]     = useState<string | null>(null)
  const [nodeCount, setNodeCount]       = useState(0)

  // Resolve customer UUID on mount
  const resolveCustomer = trpc.customer.resolve.useMutation()
  useEffect(() => {
    resolveCustomer.mutate(
      { clerkUserId, ...(email ? { email } : {}) },
      { onSuccess: (res) => { if (res.id) setCustomerId(res.id) } }
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clerkUserId])

  // Add account before starting scan
  const addMutation = trpcAny?.accounts?.add?.useMutation?.({
    onSuccess: () => { setStep(3) },
    onError: (err: Error) => {
      if (String(err).includes('NOT_FOUND')) setStep(3)
      // else ignore — scan step handles its own errors
    },
  })

  const handleStep2Done = (rn: string) => {
    setRoleArn(rn)
    if (!customerId || !addMutation?.mutate) { setStep(3); return }
    addMutation.mutate({
      customerId,
      accountId,
      ...(accountAlias ? { accountAlias } : {}),
      roleArn: rn,
      externalId: 'liveinfra',
      regions,
    })
  }

  const handleScanComplete = (count: number) => {
    setNodeCount(count)
    setStep(4)
  }

  return (
    <>
      <style>{`
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes pulse   { 0%,100% { opacity: 0.6; } 50% { opacity: 1; } }
      `}</style>

      <div style={{
        minHeight: '100vh', background: 'var(--canvas)', color: 'var(--ink)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '40px 24px',
      }}>
        <div style={{
          width: '100%', maxWidth: '560px',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
        }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '32px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg,#00c4b4,#00a89b)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 18px rgba(0,196,180,0.35)' }}>
              <svg viewBox="0 0 16 16" fill="white" width="18" height="18">
                <circle cx="8" cy="8" r="2.5" />
                <circle cx="2" cy="2" r="1.5" /><circle cx="14" cy="2" r="1.5" />
                <circle cx="2" cy="14" r="1.5" /><circle cx="14" cy="14" r="1.5" />
                <line x1="3.5" y1="2.5" x2="6" y2="5.5" stroke="white" strokeWidth="1.2" />
                <line x1="12.5" y1="2.5" x2="10" y2="5.5" stroke="white" strokeWidth="1.2" />
                <line x1="3.5" y1="13.5" x2="6" y2="10.5" stroke="white" strokeWidth="1.2" />
                <line x1="12.5" y1="13.5" x2="10" y2="10.5" stroke="white" strokeWidth="1.2" />
              </svg>
            </div>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '20px', color: 'var(--ink)', letterSpacing: '-0.02em' }}>LiveInfra</span>
          </div>

          <StepBubbles current={step} />

          {/* Card */}
          <div style={{
            width: '100%', background: 'var(--surface-1)',
            border: '1px solid var(--hairline-strong)', borderRadius: '16px',
            padding: '32px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          }}>
            {step === 1 && (
              <Step1
                accountId={accountId} setAccountId={setAccountId}
                accountAlias={accountAlias} setAccountAlias={setAccountAlias}
                regions={regions} setRegions={setRegions}
                onNext={() => setStep(2)}
              />
            )}
            {step === 2 && (
              <Step2
                customerId={customerId ?? ''}
                accountId={accountId}
                onBack={() => setStep(1)}
                onNext={handleStep2Done}
              />
            )}
            {step === 3 && customerId && (
              <Step3
                customerId={customerId}
                accountId={accountId}
                roleArn={roleArn}
                regions={regions}
                onComplete={handleScanComplete}
              />
            )}
            {step === 4 && (
              <Step4
                nodeCount={nodeCount}
                onDashboard={() => router.push('/dashboard')}
              />
            )}
          </div>
        </div>
      </div>
    </>
  )
}
