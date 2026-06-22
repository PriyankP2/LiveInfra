'use client'

import { useEffect, useRef, useCallback } from 'react'
import { trpc } from '@/lib/trpc'
import { useGraphStore } from './graphStore'
import { graphDataToGraphology, nodeColor } from './graphUtils'

interface GraphCanvasProps {
  customerId: string
  accountId: string
}

const FILTER_TYPES = [
  { type: 'EC2',           label: 'EC2' },
  { type: 'RDS',           label: 'RDS' },
  { type: 'Lambda',        label: 'Lambda' },
  { type: 'ALB',           label: 'ALB' },
  { type: 'NLB',           label: 'NLB' },
  { type: 'ECS',           label: 'ECS' },
  { type: 'VPC',           label: 'VPC' },
  { type: 'Subnet',        label: 'Subnet' },
  { type: 'SecurityGroup', label: 'SG' },
  { type: 'ElastiCache',   label: 'Cache' },
  { type: 'SQS',           label: 'SQS' },
  { type: 'SNS',           label: 'SNS' },
  { type: 'S3Bucket',      label: 'S3' },
] as const

export default function GraphCanvas({ customerId, accountId }: GraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<unknown>(null)

  const {
    selectedNodeId,
    hoveredNodeId,
    searchQuery,
    hiddenTypes,
    activeRegions,
    setSelectedNode,
    setHoveredNode,
    setSearchQuery,
    toggleType,
  } = useGraphStore()

  const { data, isLoading, isError } = trpc.graph.topology.useQuery(
    { customerId, accountId },
    { retry: 1, staleTime: 30_000 }
  )

  // Stable refs so Sigma event handlers see latest store values without re-creating
  const selectedNodeIdRef = useRef(selectedNodeId)
  const hoveredNodeIdRef = useRef(hoveredNodeId)
  const searchQueryRef = useRef(searchQuery)
  const hiddenTypesRef = useRef(hiddenTypes)
  const activeRegionsRef = useRef(activeRegions)
  selectedNodeIdRef.current = selectedNodeId
  hoveredNodeIdRef.current = hoveredNodeId
  searchQueryRef.current = searchQuery
  hiddenTypesRef.current = hiddenTypes
  activeRegionsRef.current = activeRegions

  const killRenderer = useCallback(() => {
    if (rendererRef.current) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(rendererRef.current as any).kill()
      } catch { /* already dead */ }
      rendererRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!data || !containerRef.current) return
    killRenderer()

    let cancelled = false

    const init = async () => {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      if (cancelled || !containerRef.current) return

      let Sigma: Awaited<typeof import('sigma')>['default']
      let forceAtlas2: Awaited<typeof import('graphology-layout-forceatlas2')>['default']
      try {
        const mods = await Promise.all([
          import('sigma'),
          import('graphology-layout-forceatlas2'),
        ])
        Sigma = mods[0].default
        forceAtlas2 = mods[1].default
      } catch (err) {
        console.error('[GraphCanvas] import failed:', err)
        return
      }

      if (cancelled || !containerRef.current) return

      const graph = graphDataToGraphology(data)

      if (graph.order > 1) {
        try {
          forceAtlas2.assign(graph, {
            iterations: graph.order > 300 ? 120 : graph.order > 100 ? 200 : 350,
            settings: {
              gravity: 2,
              scalingRatio: 2,
              strongGravityMode: true,  // logarithmic — outliers don't fly off
              linLogMode: true,         // prevents hub nodes from dominating layout
              barnesHutOptimize: true,
              barnesHutTheta: 0.5,
              slowDown: 8,
            },
          })
        } catch (err) {
          console.error('[GraphCanvas] ForceAtlas2 failed:', err)
        }
      }

      let renderer: InstanceType<typeof Sigma>
      try {
        renderer = new Sigma(graph, containerRef.current, {
          renderEdgeLabels: false,
          defaultEdgeColor: '#475569',
          defaultNodeColor: '#3b82f6',
          labelColor: { color: '#cbd5e1' },
          labelSize: 11,
          labelWeight: '500',
          labelDensity: 0.4,
          labelGridCellSize: 150,
          labelRenderedSizeThreshold: 12, // primary resources (≥12px) show labels; SG 3px dots never do
          nodeReducer: (nodeId: string, attrs: Record<string, unknown>) => {
            const isSelected = selectedNodeIdRef.current === nodeId
            const isHovered = hoveredNodeIdRef.current === nodeId
            const query = searchQueryRef.current
            const hidden = hiddenTypesRef.current
            const label = String(attrs['label'] ?? '')
            const rType = String(attrs['resourceType'] ?? '')
            const rRegion = String(attrs['region'] ?? '')
            const matchesSearch = query.length === 0 || label.toLowerCase().includes(query.toLowerCase())
            const isHiddenType = hidden.length > 0 && hidden.includes(rType)
            // hide node if its region is not in the active set (empty active = show nothing)
            const active = activeRegionsRef.current
            const isInactiveRegion = active.length === 0 || !active.includes(rRegion)

            // Visual tier: compute/data on top, network scaffolding below
            const importantTypes = ['EC2','RDS','Lambda','ALB','NLB','ECS','ElastiCache','APIGateway','S3Bucket','SQS','SNS']
            const isImportant = importantTypes.includes(rType)

            return {
              ...attrs,
              size: isSelected ? (Number(attrs['size']) || 10) * 1.5 : Number(attrs['size']) || 10,
              highlighted: isSelected || isHovered,
              hidden: isInactiveRegion || isHiddenType || (query.length > 0 && !matchesSearch),
              color: isSelected
                ? '#60a5fa'
                : isHovered
                  ? '#93c5fd'
                  : String(attrs['color'] ?? '#64748b'),
              zIndex: isSelected ? 3 : isHovered ? 2 : isImportant ? 1 : 0,
            }
          },
          edgeReducer: (_edgeId: string, attrs: Record<string, unknown>) => ({
            ...attrs,
            size: Number(attrs['size']) || 1,
          }),
        })
      } catch (err) {
        console.error('[GraphCanvas] Sigma constructor failed:', err)
        return
      }

      renderer.on('clickNode', ({ node }: { node: string }) => setSelectedNode(node))
      renderer.on('enterNode', ({ node }: { node: string }) => setHoveredNode(node))
      renderer.on('leaveNode', () => setHoveredNode(null))
      renderer.on('clickStage', () => setSelectedNode(null))

      rendererRef.current = renderer
    }

    void init()

    return () => {
      cancelled = true
      killRenderer()
    }
  }, [data, killRenderer])

  // Refresh without full rebuild on interaction state changes
  useEffect(() => {
    if (rendererRef.current) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(rendererRef.current as any).refresh()
      } catch { /* renderer may have been killed */ }
    }
  }, [selectedNodeId, hoveredNodeId, searchQuery, hiddenTypes, activeRegions])

  // ── Camera controls ──────────────────────────────────────────────────────────

  const zoomIn = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = rendererRef.current as any
    if (!r) return
    const cam = r.getCamera()
    cam.animate({ ratio: cam.ratio * 0.65 }, { duration: 200 })
  }

  const zoomOut = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = rendererRef.current as any
    if (!r) return
    const cam = r.getCamera()
    cam.animate({ ratio: cam.ratio * 1.55 }, { duration: 200 })
  }

  const fitView = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = rendererRef.current as any
    if (!r) return
    r.getCamera().animate({ x: 0.5, y: 0.5, ratio: 1 }, { duration: 300 })
  }

  // ── Loading skeleton ─────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex-1 relative flex items-center justify-center" style={{ background: 'var(--canvas)' }}>
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-10 h-10 rounded-full border-2 animate-spin"
            style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }}
          />
          <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>Loading infrastructure graph…</p>
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ background: 'var(--canvas)' }}>
        <div className="flex flex-col items-center gap-2 p-6 rounded-lg border" style={{ borderColor: 'var(--status-critical)', background: 'var(--surface-1)' }}>
          <span className="text-lg" style={{ color: 'var(--status-critical)' }}>Failed to load graph</span>
          <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>Could not reach API</p>
        </div>
      </div>
    )
  }

  if (data && data.meta.nodeCount === 0) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ background: 'var(--canvas)' }}>
        <div className="flex flex-col items-center gap-3 text-center max-w-xs">
          <p className="font-medium" style={{ color: 'var(--ink)' }}>No infrastructure scanned yet</p>
          <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>Trigger a scan to populate the dependency graph.</p>
        </div>
      </div>
    )
  }

  // ── Main canvas ──────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 relative" style={{ background: 'var(--canvas)' }}>
      {/* No region selected overlay */}
      {activeRegions.length === 0 && data && data.meta.nodeCount > 0 && (
        <div
          className="absolute inset-0 z-20 flex items-center justify-center"
          style={{ background: 'rgba(8,10,15,0.75)', backdropFilter: 'blur(4px)' }}
        >
          <div className="flex flex-col items-center gap-3 text-center">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--hairline)' }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--ink-subtle)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>No region selected</p>
              <p className="text-xs mt-1" style={{ color: 'var(--ink-muted)' }}>
                Use the region picker above to choose which AWS region to explore
              </p>
            </div>
          </div>
        </div>
      )}
      {/* Sigma WebGL container */}
      <div ref={containerRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />

      {/* Top toolbar */}
      <div className="absolute top-3 left-3 right-3 z-10 flex items-center gap-2 flex-wrap">
        {/* Search */}
        <div className="relative shrink-0">
          <svg
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
            style={{ color: 'var(--ink-subtle)' }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search resources…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-xs rounded-md outline-none w-48 transition-colors"
            style={{
              background: 'rgba(13,17,23,0.85)',
              border: '1px solid var(--hairline)',
              color: 'var(--ink)',
              backdropFilter: 'blur(8px)',
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
            onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--hairline)')}
          />
          {searchQuery.length > 0 && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--ink-subtle)' }}
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Divider */}
        <div className="w-px h-5 shrink-0" style={{ background: 'var(--hairline)' }} />

        {/* Resource type filter chips */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {FILTER_TYPES.map(({ type, label }) => {
            const isHidden = hiddenTypes.includes(type)
            const color = nodeColor(type as Parameters<typeof nodeColor>[0])
            return (
              <button
                key={type}
                onClick={() => toggleType(type)}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all"
                style={{
                  background: isHidden ? 'rgba(13,17,23,0.7)' : `${color}18`,
                  border: `1px solid ${isHidden ? 'var(--hairline)' : color + '40'}`,
                  color: isHidden ? 'var(--ink-subtle)' : color,
                  backdropFilter: 'blur(8px)',
                  textDecoration: isHidden ? 'line-through' : 'none',
                  opacity: isHidden ? 0.5 : 1,
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: isHidden ? 'var(--ink-subtle)' : color }}
                />
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Zoom controls — right side */}
      <div
        className="absolute right-3 top-1/2 -translate-y-1/2 z-10 flex flex-col gap-1 rounded-lg p-1"
        style={{
          background: 'rgba(13,17,23,0.85)',
          border: '1px solid var(--hairline)',
          backdropFilter: 'blur(8px)',
        }}
      >
        {[
          { onClick: zoomIn,  title: 'Zoom in',  icon: '+' },
          { onClick: zoomOut, title: 'Zoom out', icon: '−' },
          { onClick: fitView, title: 'Fit view',
            icon: (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            ),
          },
        ].map(({ onClick, title, icon }) => (
          <button
            key={title}
            onClick={onClick}
            title={title}
            className="w-7 h-7 flex items-center justify-center rounded-md text-sm font-medium transition-colors"
            style={{ color: 'var(--ink-muted)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--ink)'
              e.currentTarget.style.background = 'var(--surface-3)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--ink-muted)'
              e.currentTarget.style.background = 'transparent'
            }}
          >
            {icon}
          </button>
        ))}
      </div>

      {/* Edge legend — bottom-left */}
      <div
        className="absolute bottom-3 left-3 z-10 flex items-center gap-3 px-3 py-2 rounded-lg text-xs"
        style={{
          background: 'rgba(8,10,15,0.88)',
          border: '1px solid var(--hairline)',
          backdropFilter: 'blur(8px)',
          color: 'var(--ink-muted)',
        }}
      >
        {[
          { color: '#f97316', label: 'depends on',   dash: false },
          { color: '#2563eb', label: 'member of',    dash: false },
          { color: '#16a34a', label: 'deployed in',  dash: false },
        ].map(({ color, label }) => (
          <span key={label} className="flex items-center gap-1.5">
            <span className="w-5 h-px rounded-full" style={{ background: color, height: '2px' }} />
            <span className="text-[10px] uppercase tracking-wide">{label}</span>
          </span>
        ))}
      </div>
    </div>
  )
}
