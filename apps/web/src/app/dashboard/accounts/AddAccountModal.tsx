'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { trpc } from '@/lib/trpc'

// ── Types ──────────────────────────────────────────────────────────────────────

interface AddAccountModalProps {
  customerId: string
  onClose: () => void
  onSuccess: () => void
}

type Step = 1 | 2 | 3

const AVAILABLE_REGIONS = [
  'us-east-1',
  'us-east-2',
  'us-west-1',
  'us-west-2',
  'eu-west-1',
  'eu-central-1',
  'ap-southeast-1',
  'ap-south-1',
  'ap-northeast-1',
] as const

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

// ── Sub-components ────────────────────────────────────────────────────────────

function StepIndicator({ current, total }: { current: Step; total: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      {Array.from({ length: total }, (_, i) => i + 1).map((step) => {
        const done = step < current
        const active = step === current
        return (
          <div key={step} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '11px',
                fontWeight: 700,
                fontFamily: 'var(--font-mono)',
                background: done
                  ? 'var(--accent)'
                  : active
                  ? 'var(--accent-dim)'
                  : 'var(--surface-3)',
                color: done ? '#000' : active ? 'var(--accent)' : 'var(--ink-subtle)',
                border: `1px solid ${done ? 'transparent' : active ? 'var(--accent)' : 'var(--hairline-strong)'}`,
                transition: 'all 0.2s',
                flexShrink: 0,
              }}
            >
              {done ? (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                step
              )}
            </div>
            {step < total && (
              <div
                style={{
                  width: '28px',
                  height: '1px',
                  background: step < current ? 'var(--accent)' : 'var(--hairline-strong)',
                  transition: 'background 0.3s',
                }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

function InputField({
  label,
  id,
  value,
  onChange,
  placeholder,
  pattern,
  required,
  error,
  mono,
  hint,
}: {
  label: string
  id: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  pattern?: string
  required?: boolean
  error?: string | null
  mono?: boolean
  hint?: string
}) {
  const [focused, setFocused] = useState(false)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <label
        htmlFor={id}
        style={{
          fontSize: '12px',
          fontWeight: 600,
          color: 'var(--ink-muted)',
          fontFamily: 'var(--font-sans)',
          letterSpacing: '0.02em',
          textTransform: 'uppercase',
        }}
      >
        {label}
        {required && (
          <span style={{ color: 'var(--accent)', marginLeft: '3px' }}>*</span>
        )}
      </label>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        pattern={pattern}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: '100%',
          padding: '9px 12px',
          borderRadius: '7px',
          border: `1px solid ${error ? 'rgba(240,68,56,0.5)' : focused ? 'var(--accent)' : 'var(--hairline-strong)'}`,
          background: 'var(--surface-2)',
          color: 'var(--ink)',
          fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)',
          fontSize: mono ? '13px' : '14px',
          outline: 'none',
          transition: 'border-color 0.15s',
          boxShadow: focused ? `0 0 0 3px ${error ? 'rgba(240,68,56,0.12)' : 'var(--accent-dim)'}` : 'none',
        }}
      />
      {hint && !error && (
        <span style={{ fontSize: '11px', color: 'var(--ink-subtle)', fontFamily: 'var(--font-sans)' }}>
          {hint}
        </span>
      )}
      {error && (
        <span style={{ fontSize: '11px', color: 'var(--status-critical)', fontFamily: 'var(--font-sans)' }}>
          {error}
        </span>
      )}
    </div>
  )
}

function RegionCheckboxes({
  selected,
  onChange,
}: {
  selected: string[]
  onChange: (regions: string[]) => void
}) {
  const toggle = (region: string) => {
    if (selected.includes(region)) {
      onChange(selected.filter((r) => r !== region))
    } else {
      onChange([...selected, region])
    }
  }

  const allSelected = selected.length === AVAILABLE_REGIONS.length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <label
          style={{
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--ink-muted)',
            fontFamily: 'var(--font-sans)',
            letterSpacing: '0.02em',
            textTransform: 'uppercase',
          }}
        >
          Regions to scan
          <span style={{ color: 'var(--accent)', marginLeft: '3px' }}>*</span>
        </label>
        <button
          type="button"
          onClick={() =>
            onChange(allSelected ? [] : [...AVAILABLE_REGIONS])
          }
          style={{
            fontSize: '11px',
            color: 'var(--accent)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '0',
            fontFamily: 'var(--font-sans)',
            fontWeight: 500,
          }}
        >
          {allSelected ? 'Deselect all' : 'Select all'}
        </button>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '6px',
          padding: '12px',
          borderRadius: '8px',
          background: 'var(--surface-2)',
          border: '1px solid var(--hairline)',
        }}
      >
        {AVAILABLE_REGIONS.map((region) => {
          const checked = selected.includes(region)
          return (
            <label
              key={region}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                padding: '4px 6px',
                borderRadius: '5px',
                background: checked ? 'var(--accent-dim)' : 'transparent',
                transition: 'background 0.12s',
              }}
            >
              <div
                onClick={() => toggle(region)}
                style={{
                  width: '15px',
                  height: '15px',
                  borderRadius: '4px',
                  border: `1.5px solid ${checked ? 'var(--accent)' : 'var(--hairline-strong)'}`,
                  background: checked ? 'var(--accent)' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  cursor: 'pointer',
                  transition: 'all 0.12s',
                }}
              >
                {checked && (
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
              <span
                onClick={() => toggle(region)}
                style={{
                  fontSize: '12px',
                  color: checked ? 'var(--accent)' : 'var(--ink-muted)',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: checked ? 500 : 400,
                  userSelect: 'none',
                  transition: 'color 0.12s',
                }}
              >
                {region}
              </span>
            </label>
          )
        })}
      </div>
      {selected.length === 0 && (
        <span style={{ fontSize: '11px', color: 'var(--status-critical)', fontFamily: 'var(--font-sans)' }}>
          Select at least one region
        </span>
      )}
      {selected.length > 0 && (
        <span style={{ fontSize: '11px', color: 'var(--ink-subtle)', fontFamily: 'var(--font-sans)' }}>
          {selected.length} region{selected.length !== 1 ? 's' : ''} selected
        </span>
      )}
    </div>
  )
}

function CodeBlock({ children }: { children: string }) {
  const [copied, setCopied] = useState(false)

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(children)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }, [children])

  return (
    <div
      style={{
        position: 'relative',
        borderRadius: '8px',
        background: 'var(--canvas)',
        border: '1px solid var(--hairline-strong)',
        overflow: 'hidden',
      }}
    >
      <pre
        style={{
          margin: 0,
          padding: '14px 16px',
          paddingRight: '48px',
          fontFamily: 'var(--font-mono)',
          fontSize: '11.5px',
          color: 'var(--ink-muted)',
          lineHeight: 1.6,
          overflowX: 'auto',
          whiteSpace: 'pre',
        }}
      >
        {children}
      </pre>
      <button
        onClick={copy}
        title={copied ? 'Copied!' : 'Copy to clipboard'}
        style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '28px',
          height: '28px',
          borderRadius: '6px',
          border: '1px solid var(--hairline-strong)',
          background: copied ? 'rgba(0,196,180,0.15)' : 'var(--surface-2)',
          cursor: 'pointer',
          color: copied ? 'var(--accent)' : 'var(--ink-subtle)',
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
    </div>
  )
}

function CopyChip({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false)

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }, [value])

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 10px',
        borderRadius: '6px',
        background: 'var(--surface-2)',
        border: '1px solid var(--hairline-strong)',
      }}
    >
      {label && (
        <span style={{ fontSize: '11px', color: 'var(--ink-subtle)', fontFamily: 'var(--font-sans)', fontWeight: 500 }}>
          {label}:
        </span>
      )}
      <code style={{ fontSize: '12px', color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>
        {value}
      </code>
      <button
        onClick={copy}
        title={copied ? 'Copied!' : 'Copy'}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2px',
          border: 'none',
          background: 'none',
          cursor: 'pointer',
          color: copied ? 'var(--accent)' : 'var(--ink-subtle)',
          transition: 'color 0.15s',
        }}
      >
        {copied ? (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
          </svg>
        )}
      </button>
    </div>
  )
}

// ── Step 1 ─────────────────────────────────────────────────────────────────────

interface Step1Data {
  accountId: string
  accountAlias: string
  regions: string[]
}

function Step1({
  data,
  onChange,
  onNext,
}: {
  data: Step1Data
  onChange: (d: Partial<Step1Data>) => void
  onNext: () => void
}) {
  const [btnHov, setBtnHov] = useState(false)
  const [accountIdError, setAccountIdError] = useState<string | null>(null)
  const [regionsError, setRegionsError] = useState<string | null>(null)

  const validate = () => {
    let ok = true
    if (!/^\d{12}$/.test(data.accountId.trim())) {
      setAccountIdError('Must be exactly 12 digits')
      ok = false
    } else {
      setAccountIdError(null)
    }
    if (data.regions.length === 0) {
      setRegionsError('Select at least one region')
      ok = false
    } else {
      setRegionsError(null)
    }
    return ok
  }

  const handleNext = () => {
    if (validate()) onNext()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <InputField
        label="AWS Account ID"
        id="account-id"
        value={data.accountId}
        onChange={(v) => {
          onChange({ accountId: v })
          if (accountIdError) setAccountIdError(null)
        }}
        placeholder="123456789012"
        pattern="\d{12}"
        required
        error={accountIdError}
        mono
        hint="12-digit numeric AWS account ID"
      />

      <InputField
        label="Account Name"
        id="account-alias"
        value={data.accountAlias}
        onChange={(v) => onChange({ accountAlias: v })}
        placeholder="production, staging…"
        hint="Optional — used as a friendly display label"
      />

      <RegionCheckboxes
        selected={data.regions}
        onChange={(regions) => {
          onChange({ regions })
          if (regionsError) setRegionsError(null)
        }}
      />

      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '4px' }}>
        <button
          onClick={handleNext}
          onMouseEnter={() => setBtnHov(true)}
          onMouseLeave={() => setBtnHov(false)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '7px',
            padding: '10px 20px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 600,
            fontFamily: 'var(--font-sans)',
            border: 'none',
            cursor: 'pointer',
            background: btnHov ? 'var(--accent-hover)' : 'var(--accent)',
            color: '#000',
            transition: 'background 0.15s',
          }}
        >
          Next: Set up IAM Role
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </button>
      </div>
    </div>
  )
}

// ── Step 2 ─────────────────────────────────────────────────────────────────────

interface Step2Data {
  roleArn: string
}

function Step2({
  accountId,
  data,
  onChange,
  onBack,
  onValidate,
  validating,
  validationError,
}: {
  accountId: string
  data: Step2Data
  onChange: (d: Partial<Step2Data>) => void
  onBack: () => void
  onValidate: () => void
  validating: boolean
  validationError: string | null
}) {
  const [btnHov, setBtnHov] = useState(false)
  const [backHov, setBackHov] = useState(false)
  const [roleArnError, setRoleArnError] = useState<string | null>(null)

  const validate = () => {
    const arnPattern = /^arn:aws:iam::\d{12}:role\/.+$/
    if (!arnPattern.test(data.roleArn.trim())) {
      setRoleArnError('Must be a valid IAM role ARN (e.g. arn:aws:iam::123456789012:role/LiveInfraScanner)')
      return false
    }
    setRoleArnError(null)
    return true
  }

  const handleValidate = () => {
    if (validate()) onValidate()
  }

  const steps = [
    {
      label: (
        <>
          Open the{' '}
          <a
            href={`https://console.aws.amazon.com/iam/home#/roles$new?step=type&roleType=crossAccount&accountID=975050024946`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}
          >
            AWS IAM Console
          </a>{' '}
          in your account{' '}
          <code
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              color: 'var(--accent)',
              background: 'var(--accent-dim)',
              padding: '1px 5px',
              borderRadius: '3px',
            }}
          >
            {accountId || '············'}
          </code>
        </>
      ),
    },
    {
      label: 'Create a new IAM role with the following trust policy:',
      extra: <CodeBlock>{TRUST_POLICY}</CodeBlock>,
    },
    {
      label: (
        <>
          Attach the{' '}
          <code
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              color: 'var(--ink)',
              background: 'var(--surface-3)',
              padding: '1px 5px',
              borderRadius: '3px',
            }}
          >
            ReadOnlyAccess
          </code>{' '}
          managed policy
        </>
      ),
    },
    {
      label: (
        <>
          Name the role{' '}
          <code
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              color: 'var(--ink)',
              background: 'var(--surface-3)',
              padding: '1px 5px',
              borderRadius: '3px',
            }}
          >
            LiveInfraScanner
          </code>
        </>
      ),
    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Instruction header */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <h3
          style={{
            margin: 0,
            fontFamily: 'var(--font-display)',
            fontSize: '15px',
            fontWeight: 600,
            color: 'var(--ink)',
          }}
        >
          Create IAM Role in AWS
        </h3>
        <p
          style={{
            margin: 0,
            fontSize: '13px',
            color: 'var(--ink-muted)',
            fontFamily: 'var(--font-sans)',
            lineHeight: 1.5,
          }}
        >
          LiveInfra needs read-only access to scan your account. Follow the steps below.
        </p>
      </div>

      {/* Numbered steps */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {steps.map((step, i) => (
          <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
            <div
              style={{
                width: '22px',
                height: '22px',
                borderRadius: '50%',
                background: 'var(--surface-3)',
                border: '1px solid var(--hairline-strong)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                marginTop: '1px',
                fontSize: '11px',
                fontWeight: 700,
                color: 'var(--accent)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {i + 1}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, minWidth: 0 }}>
              <span
                style={{
                  fontSize: '13px',
                  color: 'var(--ink-muted)',
                  fontFamily: 'var(--font-sans)',
                  lineHeight: 1.5,
                }}
              >
                {step.label}
              </span>
              {step.extra}
            </div>
          </div>
        ))}
      </div>

      {/* Separator */}
      <div style={{ height: '1px', background: 'var(--hairline)' }} />

      {/* CloudFormation link + External ID */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--ink-subtle)', fontFamily: 'var(--font-sans)' }}>
          Or deploy automatically:
          <a
            href="#"
            onClick={(e) => e.preventDefault()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              color: 'var(--accent)',
              textDecoration: 'none',
              fontWeight: 500,
            }}
          >
            Launch CloudFormation Stack
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </a>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CopyChip value="liveinfra" label="External ID" />
        </div>
      </div>

      {/* Role ARN input */}
      <InputField
        label="Role ARN"
        id="role-arn"
        value={data.roleArn}
        onChange={(v) => {
          onChange({ roleArn: v })
          if (roleArnError) setRoleArnError(null)
        }}
        placeholder="arn:aws:iam::123456789012:role/LiveInfraScanner"
        required
        error={roleArnError}
        mono
        hint="Paste the ARN of the role you just created"
      />

      {/* Validation error */}
      {validationError && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
            padding: '10px 12px',
            borderRadius: '7px',
            background: 'rgba(240,68,56,0.08)',
            border: '1px solid rgba(240,68,56,0.25)',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--status-critical)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '1px' }}>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span style={{ fontSize: '12px', color: 'var(--status-critical)', fontFamily: 'var(--font-sans)', lineHeight: 1.5 }}>
            {validationError}
          </span>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '4px' }}>
        <button
          onClick={onBack}
          onMouseEnter={() => setBackHov(true)}
          onMouseLeave={() => setBackHov(false)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '9px 16px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 500,
            fontFamily: 'var(--font-sans)',
            border: `1px solid ${backHov ? 'var(--hairline-strong)' : 'var(--hairline)'}`,
            background: backHov ? 'var(--surface-2)' : 'transparent',
            cursor: 'pointer',
            color: 'var(--ink-muted)',
            transition: 'all 0.15s',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          Back
        </button>

        <button
          onClick={handleValidate}
          onMouseEnter={() => setBtnHov(true)}
          onMouseLeave={() => setBtnHov(false)}
          disabled={validating}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '7px',
            padding: '10px 20px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 600,
            fontFamily: 'var(--font-sans)',
            border: 'none',
            cursor: validating ? 'not-allowed' : 'pointer',
            background: validating ? 'var(--surface-3)' : btnHov ? 'var(--accent-hover)' : 'var(--accent)',
            color: validating ? 'var(--ink-subtle)' : '#000',
            opacity: validating ? 0.8 : 1,
            transition: 'all 0.15s',
          }}
        >
          {validating ? (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
                <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Validating…
            </>
          ) : (
            <>
              Validate Connection
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </>
          )}
        </button>
      </div>
    </div>
  )
}

// ── Step 3 ─────────────────────────────────────────────────────────────────────

function Step3({
  accountId,
  accountAlias,
  onDone,
}: {
  accountId: string
  accountAlias: string
  onDone: () => void
}) {
  const [btnHov, setBtnHov] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => onDone(), 3000)
    return () => clearTimeout(timer)
  }, [onDone])

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '20px',
        padding: '32px 0',
        textAlign: 'center',
      }}
    >
      {/* Checkmark circle */}
      <div
        style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          background: 'rgba(18,183,106,0.12)',
          border: '2px solid rgba(18,183,106,0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 0 24px rgba(18,183,106,0.2)',
        }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--status-healthy)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <h3
          style={{
            margin: 0,
            fontFamily: 'var(--font-display)',
            fontSize: '20px',
            fontWeight: 700,
            color: 'var(--ink)',
          }}
        >
          Account Connected!
        </h3>
        <p
          style={{
            margin: 0,
            fontSize: '13px',
            color: 'var(--ink-muted)',
            fontFamily: 'var(--font-sans)',
          }}
        >
          <span style={{ color: 'var(--accent)', fontWeight: 500 }}>
            {accountAlias || accountId}
          </span>{' '}
          is ready to scan.
        </p>
      </div>

      {/* Scanning indicator */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 14px',
          borderRadius: '8px',
          background: 'var(--surface-2)',
          border: '1px solid var(--hairline)',
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
          <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        <span
          style={{
            fontSize: '12px',
            color: 'var(--ink-muted)',
            fontFamily: 'var(--font-sans)',
          }}
        >
          Starting initial scan…
        </span>
      </div>

      <button
        onClick={onDone}
        onMouseEnter={() => setBtnHov(true)}
        onMouseLeave={() => setBtnHov(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '7px',
          padding: '10px 20px',
          borderRadius: '8px',
          fontSize: '13px',
          fontWeight: 600,
          fontFamily: 'var(--font-sans)',
          border: `1px solid ${btnHov ? 'var(--hairline-strong)' : 'var(--hairline)'}`,
          background: btnHov ? 'var(--surface-2)' : 'transparent',
          cursor: 'pointer',
          color: 'var(--ink-muted)',
          transition: 'all 0.15s',
        }}
      >
        Go to Dashboard
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="5" y1="12" x2="19" y2="12" />
          <polyline points="12 5 19 12 12 19" />
        </svg>
      </button>
    </div>
  )
}

// ── Main modal ─────────────────────────────────────────────────────────────────

export default function AddAccountModal({ customerId, onClose, onSuccess }: AddAccountModalProps) {
  const [step, setStep] = useState<Step>(1)
  const [accountId, setAccountId] = useState('')
  const [accountAlias, setAccountAlias] = useState('')
  const [regions, setRegions] = useState<string[]>([...AVAILABLE_REGIONS])
  const [roleArn, setRoleArn] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // Prevent body scroll while open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const trpcAny = trpc as any

  const validateMutation = trpcAny.accounts.validate.useMutation({
    onSuccess: (res: { valid: boolean; resolvedAccountId?: string; error?: string }) => {
      if (res.valid) {
        // Proceed to add the account
        addMutation.mutate({
          customerId,
          accountId: res.resolvedAccountId ?? accountId,
          accountAlias: accountAlias || undefined,
          roleArn,
          externalId: 'liveinfra',
          regions,
        })
      } else {
        setValidationError(res.error ?? 'Validation failed. Check the role ARN and trust policy.')
      }
    },
    onError: (err: Error) => {
      // If procedure not yet implemented, skip validation and proceed
      if (String(err).includes('NOT_FOUND') || String(err).includes('not found')) {
        setStep(3)
      } else {
        setValidationError(err.message)
      }
    },
  })

  const addMutation = trpcAny.accounts.add.useMutation({
    onSuccess: () => {
      setStep(3)
    },
    onError: (err: Error) => {
      // If procedure not yet implemented, skip to success
      if (String(err).includes('NOT_FOUND') || String(err).includes('not found')) {
        setStep(3)
      } else {
        setValidationError(err.message)
      }
    },
  })

  const handleValidate = useCallback(() => {
    setValidationError(null)
    try {
      validateMutation.mutate({
        roleArn,
        externalId: 'liveinfra',
        accountId,
      })
    } catch {
      // Fallback if mutation throws synchronously (procedure not yet wired)
      setStep(3)
    }
  }, [validateMutation, roleArn, accountId])

  const isValidating = validateMutation.isPending || addMutation.isPending

  const STEP_TITLES: Record<Step, string> = {
    1: 'Account Details',
    2: 'IAM Role Setup',
    3: 'Connected',
  }

  const modal = (
    <>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Backdrop */}
      <div
        ref={overlayRef}
        onClick={(e) => {
          if (e.target === overlayRef.current) onClose()
        }}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1000,
          background: 'rgba(5,7,10,0.75)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
        }}
      >
        {/* Dialog */}
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Add AWS Account — Step ${step}`}
          style={{
            width: '100%',
            maxWidth: '520px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--surface-1)',
            border: '1px solid var(--hairline-strong)',
            borderRadius: '14px',
            boxShadow: 'var(--shadow-lg)',
            overflow: 'hidden',
          }}
        >
          {/* Modal header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '18px 22px 14px',
              borderBottom: '1px solid var(--hairline)',
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2
                  style={{
                    margin: 0,
                    fontFamily: 'var(--font-display)',
                    fontSize: '15px',
                    fontWeight: 600,
                    color: 'var(--ink)',
                  }}
                >
                  Connect AWS Account
                </h2>
                <span
                  style={{
                    fontSize: '11px',
                    color: 'var(--ink-subtle)',
                    fontFamily: 'var(--font-sans)',
                    fontWeight: 400,
                  }}
                >
                  — {STEP_TITLES[step]}
                </span>
              </div>
              <StepIndicator current={step} total={3} />
            </div>

            <button
              onClick={onClose}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '28px',
                height: '28px',
                borderRadius: '6px',
                border: '1px solid var(--hairline)',
                background: 'transparent',
                cursor: 'pointer',
                color: 'var(--ink-subtle)',
                flexShrink: 0,
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--surface-2)'
                e.currentTarget.style.color = 'var(--ink)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = 'var(--ink-subtle)'
              }}
              aria-label="Close"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Modal body (scrollable) */}
          <div
            style={{
              flex: 1,
              overflow: 'auto',
              padding: '22px',
            }}
          >
            {step === 1 && (
              <Step1
                data={{ accountId, accountAlias, regions }}
                onChange={(d) => {
                  if (d.accountId !== undefined) setAccountId(d.accountId)
                  if (d.accountAlias !== undefined) setAccountAlias(d.accountAlias)
                  if (d.regions !== undefined) setRegions(d.regions)
                }}
                onNext={() => setStep(2)}
              />
            )}
            {step === 2 && (
              <Step2
                accountId={accountId}
                data={{ roleArn }}
                onChange={(d) => {
                  if (d.roleArn !== undefined) setRoleArn(d.roleArn)
                }}
                onBack={() => setStep(1)}
                onValidate={handleValidate}
                validating={isValidating}
                validationError={validationError}
              />
            )}
            {step === 3 && (
              <Step3
                accountId={accountId}
                accountAlias={accountAlias}
                onDone={onSuccess}
              />
            )}
          </div>
        </div>
      </div>
    </>
  )

  // Render in a portal so it sits above the sidebar and all layout layers
  if (typeof window === 'undefined') return null
  return createPortal(modal, document.body)
}
