'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { trpc } from '@/lib/trpc'
import { useGraphStore } from '@/components/graph/graphStore'
import { supabase } from '@/lib/supabase'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const trpcAny = trpc as any

interface Incident {
  id:          string
  source:      string
  title:       string
  severity:    string
  status:      string
  resourceArn: string | null
  resourceId:  string | null
  triggeredAt: string
}

interface Toast {
  id:        string
  incident:  Incident
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#f04438',
  high:     '#ef6820',
  medium:   '#f79009',
  low:      '#17b26a',
  info:     '#0ba5ec',
}

const SOURCE_LABELS: Record<string, string> = {
  pagerduty:  'PagerDuty',
  opsgenie:   'OpsGenie',
  cloudwatch: 'CloudWatch',
  manual:     'Manual',
}

// ── Single toast card ─────────────────────────────────────────────────────────
function IncidentToast({ toast, onDismiss }: {
  toast:     Toast
  onDismiss: (id: string) => void
}) {
  const router        = useRouter()
  const pathname      = usePathname()
  const { setFocusNode, setSelectedNode } = useGraphStore()
  const { incident }  = toast
  const severityColor = SEVERITY_COLORS[incident.severity] ?? SEVERITY_COLORS.low
  const [visible, setVisible] = useState(false)

  useEffect(() => { requestAnimationFrame(() => setVisible(true)) }, [])

  // Poll for RCA completion while incident is open/analyzing
  const rcaQuery = trpcAny?.incidents?.getRca?.useQuery?.(
    { incidentId: incident.id },
    {
      enabled:         incident.status === 'analyzing' || incident.status === 'open',
      refetchInterval: 4000,
      staleTime:       0,
    }
  )
  const isAnalyzing = incident.status === 'analyzing' || incident.status === 'open'
  const rcaDone     = rcaQuery?.data?.status === 'complete'
  const rcaError    = rcaQuery?.data?.status === 'error'

  const handleViewGraph = useCallback(() => {
    const nodeId = incident.resourceId
    if (nodeId) {
      setSelectedNode(nodeId)
      setFocusNode(nodeId)
    }
    if (!pathname?.startsWith('/dashboard')) router.push('/dashboard')
    onDismiss(toast.id)
  }, [incident.resourceId, pathname, router, onDismiss, toast.id, setFocusNode, setSelectedNode])

  const handleDismiss = useCallback(() => {
    setVisible(false)
    setTimeout(() => onDismiss(toast.id), 250)
  }, [toast.id, onDismiss])

  return (
    <div
      style={{
        transform:     visible ? 'translateX(0)' : 'translateX(calc(100% + 24px))',
        opacity:       visible ? 1 : 0,
        transition:    'transform 0.28s cubic-bezier(0.16,1,0.3,1), opacity 0.2s ease',
        width:         '340px',
        background:    '#0d1117',
        border:        `1px solid ${severityColor}44`,
        borderLeft:    `3px solid ${severityColor}`,
        borderRadius:  '10px',
        boxShadow:     '0 8px 32px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04)',
        padding:       '14px 16px',
        display:       'flex',
        flexDirection: 'column',
        gap:           '8px',
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
        <span
          style={{
            width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0, marginTop: '4px',
            background: severityColor,
            boxShadow:  `0 0 6px ${severityColor}`,
            animation:  isAnalyzing && !rcaDone ? 'pulse 1.4s ease-in-out infinite' : 'none',
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: '10px', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase',
            color: severityColor, marginBottom: '3px',
          }}>
            {SOURCE_LABELS[incident.source] ?? incident.source} · {incident.severity.toUpperCase()}
          </div>
          <div style={{
            fontSize: '13px', fontWeight: 500, color: '#e6edf3',
            lineHeight: '1.35',
            overflow: 'hidden', textOverflow: 'ellipsis',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          }}>
            {incident.title}
          </div>
        </div>
        <button
          onClick={handleDismiss}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#484f58', padding: '0', lineHeight: 1, fontSize: '16px', flexShrink: 0,
          }}
        >
          ×
        </button>
      </div>

      {/* RCA status line */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#8b949e' }}>
        {rcaDone ? (
          <><span style={{ color: '#17b26a', fontWeight: 700 }}>✓</span><span style={{ color: '#17b26a' }}>AI RCA complete</span></>
        ) : rcaError ? (
          <><span style={{ color: '#f04438', fontWeight: 700 }}>✗</span><span style={{ color: '#f04438' }}>RCA failed</span></>
        ) : isAnalyzing ? (
          <><span style={{ animation: 'spin 1.2s linear infinite', display: 'inline-block', fontSize: '11px' }}>◌</span>Analyzing with AI…</>
        ) : (
          <span>Pending analysis</span>
        )}
        {incident.resourceId && (
          <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#30363d' }}>
            {incident.resourceId.length > 22 ? incident.resourceId.slice(0, 22) + '…' : incident.resourceId}
          </span>
        )}
      </div>

      {/* CTA buttons */}
      <div style={{ display: 'flex', gap: '6px' }}>
        {incident.resourceId ? (
          <button
            onClick={handleViewGraph}
            style={{
              flex: 1, padding: '5px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600,
              cursor: 'pointer', border: `1px solid ${severityColor}44`,
              background: `${severityColor}14`, color: severityColor,
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = `${severityColor}24` }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = `${severityColor}14` }}
          >
            View in graph →
          </button>
        ) : (
          <div style={{ flex: 1, fontSize: '11px', color: '#484f58', lineHeight: '1.4' }}>
            Add <code style={{ fontSize: '10px' }}>resource_arn</code> to PD custom_details for graph linking
          </div>
        )}
        {rcaDone && (
          <button
            onClick={handleViewGraph}
            style={{
              padding: '5px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
              background: 'rgba(0,196,180,0.12)', border: '1px solid rgba(0,196,180,0.3)', color: '#00c4b4',
            }}
          >
            View RCA
          </button>
        )}
      </div>
    </div>
  )
}

// ── Container — real-time incidents subscription + toast queue ─────────────────
export default function AutoRcaToast() {
  const { resolvedCustomerId } = useGraphStore()
  const [toasts, setToasts]     = useState<Toast[]>([])
  const seenIds = useRef<Set<string>>(new Set())

  // Bootstrap: load recent incidents once on mount so we don't miss anything
  // that arrived before the real-time channel connected.
  const incidentsQuery = trpcAny?.incidents?.list?.useQuery?.(
    { customerId: resolvedCustomerId ?? '', limit: 5 },
    { enabled: !!resolvedCustomerId, staleTime: 0 }
  )

  const addIncident = useCallback((incident: Incident) => {
    if (seenIds.current.has(incident.id)) return
    const tenMinAgo = new Date(Date.now() - 10 * 60_000).toISOString()
    if (incident.triggeredAt < tenMinAgo) return
    seenIds.current.add(incident.id)
    setToasts(prev => [...[{ id: incident.id, incident }], ...prev].slice(0, 5))
  }, [])

  // Seed from the initial REST fetch (handles the page-load window)
  useEffect(() => {
    if (!incidentsQuery?.data) return
    for (const inc of incidentsQuery.data as Incident[]) {
      addIncident(inc)
    }
  }, [incidentsQuery?.data, addIncident])

  // Supabase real-time subscription — replaces the 30s polling interval
  useEffect(() => {
    if (!resolvedCustomerId) return

    const channel = supabase
      .channel(`incidents:${resolvedCustomerId}`)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'incidents',
          filter: `customer_id=eq.${resolvedCustomerId}`,
        },
        (payload) => {
          const row = payload.new as Record<string, unknown>
          const incident: Incident = {
            id:          String(row['id'] ?? ''),
            source:      String(row['source'] ?? ''),
            title:       String(row['title'] ?? ''),
            severity:    String(row['severity'] ?? 'low'),
            status:      String(row['status'] ?? 'open'),
            resourceArn: row['resource_arn'] ? String(row['resource_arn']) : null,
            resourceId:  row['resource_id']  ? String(row['resource_id'])  : null,
            triggeredAt: String(row['triggered_at'] ?? new Date().toISOString()),
          }
          addIncident(incident)
        }
      )
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
  }, [resolvedCustomerId, addIncident])

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  if (toasts.length === 0) return null

  return (
    <div style={{
      position:      'fixed',
      bottom:        '20px',
      right:         '20px',
      zIndex:        1000,
      display:       'flex',
      flexDirection: 'column',
      gap:           '10px',
      alignItems:    'flex-end',
      pointerEvents: 'none',
    }}>
      {toasts.map(toast => (
        <div key={toast.id} style={{ pointerEvents: 'auto' }}>
          <IncidentToast toast={toast} onDismiss={dismiss} />
        </div>
      ))}
    </div>
  )
}
