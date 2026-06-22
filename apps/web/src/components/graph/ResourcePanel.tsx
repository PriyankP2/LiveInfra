'use client'

import { useState, useEffect, useRef } from 'react'
import { useGraphStore } from './graphStore'
import { nodeColor } from './graphUtils'
import { trpc } from '@/lib/trpc'
import type { GraphData } from '@liveinfra/shared'

interface ResourcePanelProps {
  nodeId: string | null
  graphData: GraphData | undefined
  customerId: string
}

function relativeTime(iso: string): string {
  if (!iso) return 'Unknown'
  const delta = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(delta / 60_000)
  const hours   = Math.floor(delta / 3_600_000)
  const days    = Math.floor(delta / 86_400_000)
  if (days > 0)    return `${days}d ago`
  if (hours > 0)   return `${hours}h ago`
  if (minutes > 0) return `${minutes}m ago`
  return 'Just now'
}

const EDGE_COLORS: Record<string, string> = {
  DEPENDS_ON:  '#b06a28',
  MEMBER_OF:   '#2d5a8e',
  DEPLOYED_IN: '#1a6b45',
  PART_OF:     '#2a3a4f',
}

const SEVERITY_COLORS: Record<string, string> = {
  critical:   '#f04438',
  degraded:   '#f87c00',
  'at-risk':  '#f5c518',
  monitoring: '#12b76a',
}

// ── Markdown renderer (minimal: bold, inline code, headers, bullets) ──────────
function MiniMarkdown({ text }: { text: string }) {
  const lines = text.split('\n')
  return (
    <div style={{ fontSize: '12px', lineHeight: 1.7, color: 'var(--ink-muted)', fontFamily: 'var(--font-sans)' }}>
      {lines.map((line, i) => {
        // H2
        if (line.startsWith('## ')) {
          return <p key={i} style={{ fontWeight: 700, color: 'var(--ink)', fontSize: '12px', marginTop: '12px', marginBottom: '4px' }}>{renderInline(line.slice(3))}</p>
        }
        // H3 / bold header (** at line start)
        if (line.startsWith('**') && line.endsWith('**') && line.length > 4) {
          const inner = line.slice(2, -2)
          return <p key={i} style={{ fontWeight: 700, color: 'var(--ink)', fontSize: '11px', marginTop: '10px', marginBottom: '2px' }}>{inner}</p>
        }
        // Numbered list
        if (/^\d+\.\s/.test(line)) {
          return (
            <div key={i} style={{ display: 'flex', gap: '6px', marginTop: '3px' }}>
              <span style={{ color: 'var(--accent)', fontWeight: 600, fontSize: '11px', flexShrink: 0, fontFamily: 'var(--font-mono)' }}>
                {line.match(/^(\d+)\./)?.[1]}.
              </span>
              <span>{renderInline(line.replace(/^\d+\.\s/, ''))}</span>
            </div>
          )
        }
        // Bullet
        if (line.startsWith('- ') || line.startsWith('* ')) {
          return (
            <div key={i} style={{ display: 'flex', gap: '6px', marginTop: '3px' }}>
              <span style={{ color: 'var(--accent)', fontSize: '14px', lineHeight: 1.4, flexShrink: 0 }}>·</span>
              <span>{renderInline(line.slice(2))}</span>
            </div>
          )
        }
        // Empty line = spacer
        if (line.trim() === '') return <div key={i} style={{ height: '6px' }} />
        return <p key={i} style={{ marginTop: '2px' }}>{renderInline(line)}</p>
      })}
    </div>
  )
}

function renderInline(text: string): React.ReactNode {
  // Split on **bold** and `code`
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} style={{ color: 'var(--ink)', fontWeight: 600 }}>{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i} style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--accent)', background: 'var(--accent-dim)', padding: '1px 4px', borderRadius: '3px' }}>{part.slice(1, -1)}</code>
    }
    return part
  })
}

export default function ResourcePanel({ nodeId, graphData, customerId }: ResourcePanelProps) {
  const { setSelectedNode, setBlastRadiusNode, setBlastRadiusAffected } = useGraphStore()
  const [showBlast, setShowBlast] = useState(false)
  const [showRca, setShowRca]     = useState(false)
  const [rcaContext, setRcaContext] = useState('')
  const rcaTextareaRef = useRef<HTMLTextAreaElement>(null)

  const blastRadius = trpc.graph.blastRadius.useQuery(
    { customerId, resourceId: nodeId ?? '', maxHops: 10 },
    { enabled: !!nodeId && showBlast, staleTime: 60_000 }
  )

  // Sync blast radius hits into the graph store so GraphCanvas can dim non-affected nodes
  useEffect(() => {
    if (blastRadius.data) {
      setBlastRadiusAffected(blastRadius.data.affected.map((a) => a.nodeId))
    } else {
      setBlastRadiusAffected([])
    }
    return () => setBlastRadiusAffected([])
  }, [blastRadius.data, setBlastRadiusAffected])

  // Reset RCA state when node changes
  useEffect(() => {
    setShowRca(false)
    setRcaContext('')
  }, [nodeId])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rcaMutation = (trpc as any).rca?.analyze?.useMutation?.() ?? null

  if (!nodeId || !graphData) return null

  const node = graphData.nodes.find((n) => n.id === nodeId)
  if (!node) return null

  const color      = nodeColor(node.type)
  const tagEntries = Object.entries(node.tags)
  const propEntries = Object.entries(node.properties).filter(([, v]) => v !== null && v !== undefined && v !== '')

  const connections = graphData.edges
    .filter((e) => e.source === nodeId || e.target === nodeId)
    .map((e) => {
      const isOutgoing  = e.source === nodeId
      const neighborId  = isOutgoing ? e.target : e.source
      const neighbor    = graphData.nodes.find((n) => n.id === neighborId)
      return {
        direction:     isOutgoing ? 'out' : 'in',
        edgeType:      e.type,
        neighborId,
        neighborName:  neighbor?.name || neighborId.split('/').pop() || neighborId,
        neighborType:  neighbor?.type ?? 'Unknown',
        neighborColor: neighbor ? nodeColor(neighbor.type) : '#3d5068',
      }
    })
    .sort((a, b) => a.edgeType.localeCompare(b.edgeType))

  const handleBlastRadius = () => {
    setShowBlast(true)
    setBlastRadiusNode(nodeId)
  }

  return (
    <aside
      className="flex flex-col h-full"
      style={{
        width: '360px',
        flexShrink: 0,
        background: 'var(--surface-1)',
        borderLeft: '1px solid var(--hairline)',
        boxShadow: 'var(--shadow-panel)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-start justify-between px-4 pt-4 pb-3 shrink-0"
        style={{ borderBottom: '1px solid var(--hairline)' }}
      >
        <div className="flex flex-col gap-2 min-w-0">
          <div className="flex items-center gap-2">
            {/* Type badge */}
            <span
              className="shrink-0 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
              style={{
                background: `${color}18`,
                color,
                border: `1px solid ${color}35`,
                letterSpacing: '0.08em',
              }}
            >
              {node.type}
            </span>
            {/* Region chip */}
            <span
              className="shrink-0 text-[10px] px-1.5 py-0.5 rounded"
              style={{ background: 'var(--surface-3)', color: 'var(--ink-subtle)', fontFamily: 'var(--font-mono)' }}
            >
              {node.region}
            </span>
          </div>
          {/* Resource name — Space Grotesk display font */}
          <span
            className="text-[15px] font-semibold leading-tight truncate pr-2"
            style={{ color: 'var(--ink)', fontFamily: 'var(--font-display)' }}
            title={node.name || node.id}
          >
            {node.name || node.id}
          </span>
          {connections.length > 0 && (
            <span className="text-[11px]" style={{ color: 'var(--ink-subtle)' }}>
              {connections.length} connection{connections.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        <button
          onClick={() => { setSelectedNode(null); setShowBlast(false); setBlastRadiusNode(null); setBlastRadiusAffected([]); setShowRca(false); setRcaContext('') }}
          className="shrink-0 ml-2 mt-0.5 w-6 h-6 flex items-center justify-center rounded-md transition-all"
          style={{ color: 'var(--ink-subtle)' }}
          aria-label="Close"
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--ink)'
            e.currentTarget.style.background = 'var(--surface-3)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--ink-subtle)'
            e.currentTarget.style.background = 'transparent'
          }}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">

        {/* ARN / Resource ID */}
        <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--hairline)' }}>
          <SectionLabel>Resource ID</SectionLabel>
          <p
            className="text-[11px] break-all leading-relaxed mt-1.5 select-all"
            style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-mono)' }}
          >
            {node.id}
          </p>
        </div>

        {/* Metadata grid */}
        <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--hairline)' }}>
          <SectionLabel>Metadata</SectionLabel>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 mt-2">
            <MetaItem label="Account"   value={node.accountId} mono />
            <MetaItem label="Last seen" value={relativeTime(node.lastSeen)} />
          </dl>
        </div>

        {/* Connections */}
        {connections.length > 0 && (
          <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--hairline)' }}>
            <SectionLabel>Connections ({connections.length})</SectionLabel>
            <div className="space-y-1 mt-2">
              {connections.map((c, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedNode(c.neighborId)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-all text-left"
                  style={{ background: 'transparent' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-2)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <span style={{ color: 'var(--ink-subtle)', fontSize: '10px', width: '12px', textAlign: 'center', flexShrink: 0 }}>
                    {c.direction === 'out' ? '→' : '←'}
                  </span>
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: c.neighborColor }} />
                  <span className="flex-1 truncate" style={{ color: 'var(--ink-muted)', fontSize: '12px' }}>
                    {c.neighborName}
                  </span>
                  <span
                    className="shrink-0 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded"
                    style={{
                      background: `${EDGE_COLORS[c.edgeType] ?? '#2a3a4f'}18`,
                      color: EDGE_COLORS[c.edgeType] ?? '#3d5068',
                    }}
                  >
                    {c.edgeType.replace('_', ' ')}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Properties */}
        {propEntries.length > 0 && (
          <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--hairline)' }}>
            <SectionLabel>Properties</SectionLabel>
            <div className="space-y-2 mt-2">
              {propEntries.map(([key, value]) => (
                <div key={key} className="flex items-start justify-between gap-3 text-xs">
                  <span className="shrink-0" style={{ color: 'var(--ink-subtle)', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                    {key}
                  </span>
                  <span
                    className="text-right truncate max-w-[190px]"
                    style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: '500' }}
                    title={String(value ?? '')}
                  >
                    {typeof value === 'boolean' ? (
                      <span style={{ color: value ? 'var(--status-healthy)' : 'var(--status-degraded)' }}>
                        {String(value)}
                      </span>
                    ) : String(value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tags */}
        {tagEntries.length > 0 && (
          <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--hairline)' }}>
            <SectionLabel>Tags ({tagEntries.length})</SectionLabel>
            <div className="space-y-1.5 mt-2">
              {tagEntries.map(([key, value]) => (
                <div key={key} className="flex items-center gap-2 text-[11px]">
                  <span className="shrink-0" style={{ color: 'var(--ink-subtle)', fontFamily: 'var(--font-mono)' }}>{key}</span>
                  <span className="ml-auto text-right truncate max-w-[190px]" style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-mono)' }}>
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Blast Radius */}
        <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--hairline)' }}>
          {!showBlast ? (
            <button
              onClick={handleBlastRadius}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all"
              style={{
                background: 'var(--surface-2)',
                border: '1px solid var(--hairline-strong)',
                color: 'var(--ink-muted)',
                fontFamily: 'var(--font-sans)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent)'
                e.currentTarget.style.color = 'var(--accent)'
                e.currentTarget.style.background = 'var(--accent-dim)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--hairline-strong)'
                e.currentTarget.style.color = 'var(--ink-muted)'
                e.currentTarget.style.background = 'var(--surface-2)'
              }}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="3" />
                <path strokeLinecap="round" d="M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
              </svg>
              Analyze Blast Radius
            </button>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-2">
                <SectionLabel>Blast Radius</SectionLabel>
                <button
                  onClick={() => { setShowBlast(false); setBlastRadiusNode(null); setBlastRadiusAffected([]) }}
                  className="text-[10px] transition-colors"
                  style={{ color: 'var(--ink-subtle)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ink-muted)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ink-subtle)')}
                >
                  clear
                </button>
              </div>

              {blastRadius.isLoading && (
                <div className="flex items-center gap-2 text-xs py-2" style={{ color: 'var(--ink-subtle)' }}>
                  <div className="w-3 h-3 rounded-full border animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
                  Traversing dependency graph…
                </div>
              )}

              {blastRadius.data && (
                <div>
                  {blastRadius.data.affected.length === 0 ? (
                    <p className="text-xs py-2" style={{ color: 'var(--ink-subtle)' }}>
                      No downstream dependencies found.
                    </p>
                  ) : (
                    <>
                      <div
                        className="flex items-center gap-2 px-3 py-2 rounded-lg mb-2 text-xs"
                        style={{ background: 'rgba(255,90,77,0.08)', border: '1px solid rgba(255,90,77,0.2)' }}
                      >
                        <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--accent-secondary)' }}>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                        </svg>
                        <span style={{ color: 'var(--accent-secondary)', fontWeight: 600 }}>
                          {blastRadius.data.affected.length} resources at risk
                        </span>
                        <span style={{ color: 'var(--ink-subtle)', marginLeft: 'auto' }}>
                          {blastRadius.data.queryMs}ms
                        </span>
                      </div>

                      <div className="space-y-1 max-h-52 overflow-y-auto">
                        {blastRadius.data.affected.map((item) => {
                          const affectedNode = graphData.nodes.find((n) => n.id === item.nodeId)
                          const itemColor = affectedNode ? nodeColor(affectedNode.type) : '#3d5068'
                          return (
                            <button
                              key={item.nodeId}
                              onClick={() => setSelectedNode(item.nodeId)}
                              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-all text-left"
                              style={{ background: 'transparent' }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-2)')}
                              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                            >
                              <span
                                className="shrink-0 text-[9px] font-bold w-4 text-center tabular-nums"
                                style={{ color: 'var(--ink-ghost)' }}
                              >
                                +{item.hops}
                              </span>
                              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: itemColor }} />
                              <span className="flex-1 truncate" style={{ color: 'var(--ink-muted)', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
                                {affectedNode?.name || item.nodeId.split('/').pop() || item.nodeId}
                              </span>
                              <span
                                className="shrink-0 w-1.5 h-1.5 rounded-full"
                                style={{ background: SEVERITY_COLORS[item.severity] ?? '#3d5068' }}
                                title={item.severity}
                              />
                            </button>
                          )
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        {/* AI RCA */}
        <div className="px-4 py-3">
          {!showRca ? (
            <button
              onClick={() => setShowRca(true)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all"
              style={{
                background: 'var(--accent-dim)',
                border: '1px solid rgba(0,196,180,0.25)',
                color: 'var(--accent)',
                fontFamily: 'var(--font-sans)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(0,196,180,0.18)'
                e.currentTarget.style.borderColor = 'var(--accent)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--accent-dim)'
                e.currentTarget.style.borderColor = 'rgba(0,196,180,0.25)'
              }}
            >
              <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              Analyze with AI
            </button>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <svg width="11" height="11" fill="none" stroke="var(--accent)" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <SectionLabel>AI Root Cause Analysis</SectionLabel>
                </div>
                <button
                  onClick={() => { setShowRca(false); setRcaContext(''); rcaMutation?.reset?.() }}
                  className="text-[10px] transition-colors"
                  style={{ color: 'var(--ink-subtle)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ink-muted)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ink-subtle)')}
                >
                  close
                </button>
              </div>

              {/* Incident context input */}
              {!rcaMutation?.data && !rcaMutation?.isPending && (
                <div className="flex flex-col gap-2">
                  <textarea
                    ref={rcaTextareaRef}
                    value={rcaContext}
                    onChange={(e) => setRcaContext(e.target.value)}
                    placeholder="Optional: describe the incident or symptoms (e.g. '503 errors since 14:30 UTC')"
                    rows={2}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      background: 'var(--surface-0)',
                      border: '1px solid var(--hairline)',
                      borderRadius: '8px',
                      fontSize: '11px',
                      fontFamily: 'var(--font-sans)',
                      color: 'var(--ink-muted)',
                      resize: 'none',
                      outline: 'none',
                      lineHeight: 1.5,
                    }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
                    onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--hairline)')}
                  />
                  <button
                    onClick={() => {
                      if (!rcaMutation) return
                      rcaMutation.mutate({
                        customerId,
                        resourceId:   nodeId,
                        resourceType: node.type,
                        resourceName: node.name || nodeId,
                        region:       node.region,
                        accountId:    node.accountId,
                        connections:  connections.map(c => ({
                          direction:    c.direction as 'in' | 'out',
                          edgeType:     c.edgeType,
                          neighborType: c.neighborType,
                          neighborName: c.neighborName,
                        })),
                        blastAffectedCount: blastRadius.data?.affected.length ?? 0,
                        incidentContext: rcaContext || undefined,
                      })
                    }}
                    disabled={!rcaMutation}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all"
                    style={{
                      background: 'var(--accent)',
                      border: 'none',
                      color: '#000',
                      fontFamily: 'var(--font-sans)',
                      cursor: rcaMutation ? 'pointer' : 'not-allowed',
                      opacity: rcaMutation ? 1 : 0.5,
                    }}
                    onMouseEnter={(e) => { if (rcaMutation) e.currentTarget.style.background = 'var(--accent-hover)' }}
                    onMouseLeave={(e) => { if (rcaMutation) e.currentTarget.style.background = 'var(--accent)' }}
                  >
                    <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Run Analysis
                  </button>
                </div>
              )}

              {/* Loading state */}
              {rcaMutation?.isPending && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--accent)' }}>
                    <div
                      className="w-3 h-3 rounded-full border"
                      style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }}
                    />
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                      Analyzing {node.type} dependency graph…
                    </span>
                  </div>
                  {[...Array(4)].map((_, i) => (
                    <div
                      key={i}
                      style={{
                        height: '10px', borderRadius: '4px',
                        background: 'var(--surface-3)',
                        width: `${[85, 72, 90, 60][i]}%`,
                        opacity: 0.6,
                        animation: `pulse 1.4s ease-in-out ${i * 0.15}s infinite`,
                      }}
                    />
                  ))}
                </div>
              )}

              {/* Result */}
              {rcaMutation?.data && (
                <div className="flex flex-col gap-3">
                  <div
                    style={{
                      padding: '12px',
                      background: 'var(--surface-0)',
                      border: '1px solid var(--hairline)',
                      borderRadius: '8px',
                      maxHeight: '340px',
                      overflowY: 'auto',
                    }}
                  >
                    <MiniMarkdown text={rcaMutation.data.analysis} />
                  </div>
                  {/* Footer: model + tokens + re-run */}
                  <div className="flex items-center justify-between">
                    <span style={{ fontSize: '10px', color: 'var(--ink-ghost)', fontFamily: 'var(--font-mono)' }}>
                      {rcaMutation.data.model} · {rcaMutation.data.promptTokens + rcaMutation.data.completionTokens}t
                    </span>
                    <button
                      onClick={() => rcaMutation.mutate({
                        customerId,
                        resourceId:   nodeId,
                        resourceType: node.type,
                        resourceName: node.name || nodeId,
                        region:       node.region,
                        accountId:    node.accountId,
                        connections:  connections.map(c => ({
                          direction:    c.direction as 'in' | 'out',
                          edgeType:     c.edgeType,
                          neighborType: c.neighborType,
                          neighborName: c.neighborName,
                        })),
                        blastAffectedCount: blastRadius.data?.affected.length ?? 0,
                        incidentContext: rcaContext || undefined,
                      })}
                      style={{
                        fontSize: '10px', color: 'var(--ink-subtle)', background: 'none', border: 'none',
                        cursor: 'pointer', fontFamily: 'var(--font-mono)', textDecoration: 'underline',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent)')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ink-subtle)')}
                    >
                      re-analyze
                    </button>
                  </div>
                </div>
              )}

              {/* Error */}
              {rcaMutation?.error && (
                <p style={{ fontSize: '11px', color: 'var(--status-critical)', fontFamily: 'var(--font-sans)' }}>
                  {rcaMutation.error.message}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-medium uppercase tracking-[0.1em]" style={{ color: 'var(--ink-muted)' }}>
      {children}
    </p>
  )
}

function MetaItem({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[10px] font-medium uppercase tracking-[0.1em] mb-0.5" style={{ color: 'var(--ink-subtle)' }}>
        {label}
      </dt>
      <dd
        className="text-[12px] font-medium truncate"
        style={{ color: 'var(--ink-muted)', fontFamily: mono ? 'var(--font-mono)' : 'inherit' }}
      >
        {value || '—'}
      </dd>
    </div>
  )
}
