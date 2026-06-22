'use client'

import { useGraphStore } from './graphStore'
import { nodeColor } from './graphUtils'
import type { GraphData } from '@liveinfra/shared'

interface ResourcePanelProps {
  nodeId: string | null
  graphData: GraphData | undefined
}

function relativeTime(iso: string): string {
  if (!iso) return 'Unknown'
  const delta = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(delta / 60_000)
  const hours = Math.floor(delta / 3_600_000)
  const days = Math.floor(delta / 86_400_000)
  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (minutes > 0) return `${minutes}m ago`
  return 'Just now'
}

const EDGE_COLORS: Record<string, string> = {
  DEPENDS_ON: '#f97316',
  MEMBER_OF: '#3b82f6',
  DEPLOYED_IN: '#22c55e',
  PART_OF: '#475569',
}

export default function ResourcePanel({ nodeId, graphData }: ResourcePanelProps) {
  const { setSelectedNode } = useGraphStore()

  if (!nodeId || !graphData) return null

  const node = graphData.nodes.find((n) => n.id === nodeId)
  if (!node) return null

  const color = nodeColor(node.type)
  const tagEntries = Object.entries(node.tags)
  const propEntries = Object.entries(node.properties).filter(([, v]) => v !== null)

  // Build connections list
  const connections = graphData.edges
    .filter((e) => e.source === nodeId || e.target === nodeId)
    .map((e) => {
      const isOutgoing = e.source === nodeId
      const neighborId = isOutgoing ? e.target : e.source
      const neighbor = graphData.nodes.find((n) => n.id === neighborId)
      return {
        direction: isOutgoing ? 'out' : 'in',
        edgeType: e.type,
        neighborId,
        neighborName: neighbor?.name || neighborId.split('/').pop() || neighborId,
        neighborType: neighbor?.type ?? 'Unknown',
        neighborColor: neighbor ? nodeColor(neighbor.type) : '#64748b',
      }
    })
    .sort((a, b) => a.edgeType.localeCompare(b.edgeType))

  return (
    <aside
      className="flex flex-col h-full overflow-hidden"
      style={{
        width: '360px',
        flexShrink: 0,
        background: 'var(--surface-1)',
        borderLeft: '1px solid var(--hairline)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-start justify-between px-4 pt-4 pb-3 shrink-0"
        style={{ borderBottom: '1px solid var(--hairline)' }}
      >
        <div className="flex flex-col gap-1.5 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="shrink-0 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
              style={{
                background: `${color}20`,
                color,
                border: `1px solid ${color}40`,
              }}
            >
              {node.type}
            </span>
            {connections.length > 0 && (
              <span className="text-[10px]" style={{ color: 'var(--ink-subtle)' }}>
                {connections.length} connection{connections.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <span
            className="text-sm font-semibold leading-tight"
            style={{ color: 'var(--ink)' }}
            title={node.name}
          >
            {node.name || node.id}
          </span>
        </div>
        <button
          onClick={() => setSelectedNode(null)}
          className="shrink-0 ml-2 mt-0.5 w-6 h-6 flex items-center justify-center rounded transition-colors"
          style={{ color: 'var(--ink-subtle)' }}
          aria-label="Close panel"
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

        {/* ARN */}
        <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--hairline)' }}>
          <p className="text-[10px] uppercase tracking-wider mb-1.5" style={{ color: 'var(--ink-subtle)' }}>ARN</p>
          <p className="font-mono text-[11px] break-all leading-relaxed" style={{ color: 'var(--ink-muted)' }}>
            {node.id}
          </p>
        </div>

        {/* Metadata */}
        <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--hairline)' }}>
          <p className="text-[10px] uppercase tracking-wider mb-2" style={{ color: 'var(--ink-subtle)' }}>Metadata</p>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5">
            <MetaItem label="Account" value={node.accountId} />
            <MetaItem label="Region" value={node.region} />
            <MetaItem label="Last seen" value={relativeTime(node.lastSeen)} />
            <MetaItem label="Customer" value={node.customerId} />
          </dl>
        </div>

        {/* Connections */}
        {connections.length > 0 && (
          <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--hairline)' }}>
            <p className="text-[10px] uppercase tracking-wider mb-2" style={{ color: 'var(--ink-subtle)' }}>
              Connections ({connections.length})
            </p>
            <div className="space-y-1.5">
              {connections.map((c, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedNode(c.neighborId)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors text-left group"
                  style={{ background: 'transparent' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-2)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  {/* Direction arrow */}
                  <span style={{ color: 'var(--ink-subtle)', fontSize: '10px', width: '12px', textAlign: 'center' }}>
                    {c.direction === 'out' ? '→' : '←'}
                  </span>
                  {/* Neighbor type dot */}
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: c.neighborColor }} />
                  {/* Neighbor name */}
                  <span className="flex-1 truncate font-medium" style={{ color: 'var(--ink-muted)' }}>
                    {c.neighborName}
                  </span>
                  {/* Edge type badge */}
                  <span
                    className="shrink-0 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                    style={{
                      background: `${EDGE_COLORS[c.edgeType] ?? '#475569'}18`,
                      color: EDGE_COLORS[c.edgeType] ?? '#475569',
                    }}
                  >
                    {c.edgeType}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Properties */}
        {propEntries.length > 0 && (
          <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--hairline)' }}>
            <p className="text-[10px] uppercase tracking-wider mb-2" style={{ color: 'var(--ink-subtle)' }}>
              Properties
            </p>
            <div className="space-y-2">
              {propEntries.map(([key, value]) => (
                <div key={key} className="flex items-start justify-between gap-3 text-xs">
                  <span className="shrink-0 font-mono" style={{ color: 'var(--ink-subtle)' }}>{key}</span>
                  <span
                    className="text-right font-mono truncate max-w-[180px]"
                    style={{ color: 'var(--ink-muted)' }}
                    title={String(value ?? '')}
                  >
                    {typeof value === 'boolean' ? (
                      <span style={{ color: value ? 'var(--status-healthy)' : 'var(--status-degraded)' }}>
                        {String(value)}
                      </span>
                    ) : (
                      String(value)
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tags */}
        {tagEntries.length > 0 && (
          <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--hairline)' }}>
            <p className="text-[10px] uppercase tracking-wider mb-2" style={{ color: 'var(--ink-subtle)' }}>
              Tags ({tagEntries.length})
            </p>
            <div className="space-y-1.5">
              {tagEntries.map(([key, value]) => (
                <div key={key} className="flex items-start gap-2 text-xs">
                  <span className="shrink-0 font-mono" style={{ color: 'var(--ink-subtle)' }}>{key}</span>
                  <span className="ml-auto text-right truncate max-w-[180px]" style={{ color: 'var(--ink-muted)' }}>
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Blast radius (placeholder for Milestone 3) */}
        <div className="px-4 py-3">
          <button
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all"
            style={{
              background: 'var(--surface-2)',
              border: '1px solid var(--hairline)',
              color: 'var(--ink-muted)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--accent)'
              e.currentTarget.style.color = 'var(--accent)'
              e.currentTarget.style.background = 'var(--accent-dim)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--hairline)'
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
        </div>
      </div>
    </aside>
  )
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: 'var(--ink-subtle)' }}>{label}</dt>
      <dd className="text-xs font-medium truncate" style={{ color: 'var(--ink-muted)' }}>{value || '—'}</dd>
    </div>
  )
}
