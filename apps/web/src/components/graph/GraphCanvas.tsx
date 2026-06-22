'use client'

import { useEffect, useRef, useCallback, useMemo, useState } from 'react'
import { trpc } from '@/lib/trpc'
import { useGraphStore } from './graphStore'
import { graphDataToGraphology, nodeColor } from './graphUtils'
import type { ResourceType } from '@liveinfra/shared'

interface HoveredNodeData {
  name: string
  type: string
  region: string
  property?: string
  x: number
  y: number
}

interface GraphCanvasProps {
  customerId: string
  accountId: string
}

const FILTER_TYPES: { type: ResourceType; label: string }[] = [
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
]

export default function GraphCanvas({ customerId, accountId }: GraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<unknown>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const graphRef = useRef<any>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [hoveredNodeData, setHoveredNodeData] = useState<HoveredNodeData | null>(null)

  const {
    selectedNodeId,
    hoveredNodeId,
    searchQuery,
    hiddenTypes,
    activeRegions,
    blastRadiusAffectedIds,
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
  const blastRadiusAffectedRef = useRef(blastRadiusAffectedIds)
  selectedNodeIdRef.current = selectedNodeId
  hoveredNodeIdRef.current = hoveredNodeId
  searchQueryRef.current = searchQuery
  hiddenTypesRef.current = hiddenTypes
  activeRegionsRef.current = activeRegions
  blastRadiusAffectedRef.current = blastRadiusAffectedIds

  // Per-type node counts for filter chips.
  // Exclude connector-tier types that get orphan-dropped from the graph (SG, Subnet with no edges).
  // We approximate by checking if the node would have edges in the rendered graph.
  const typeCounts = useMemo(() => {
    if (!data) return {} as Record<string, number>
    // Build a quick edge presence lookup for connector nodes
    const connectorTypes = new Set(['SecurityGroup', 'Subnet'])
    const nodesWithEdges = new Set<string>()
    for (const e of data.edges) {
      if (e.type === 'PART_OF') continue  // PART_OF is filtered out in graphology
      nodesWithEdges.add(e.source)
      nodesWithEdges.add(e.target)
    }

    const counts: Record<string, number> = {}
    for (const n of data.nodes) {
      if (activeRegions.length > 0 && !activeRegions.includes(n.region)) continue
      // Skip connector-tier nodes that would be orphan-dropped
      if (connectorTypes.has(n.type) && !nodesWithEdges.has(n.id)) continue
      counts[n.type] = (counts[n.type] ?? 0) + 1
    }
    return counts
  }, [data, activeRegions])

  const killRenderer = useCallback(() => {
    if (rendererRef.current) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(rendererRef.current as any).kill()
      } catch { /* already dead */ }
      rendererRef.current = null
    }
    graphRef.current = null
    setHoveredNodeData(null)
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
      graphRef.current = graph

      if (graph.order > 1) {
        try {
          forceAtlas2.assign(graph, {
            iterations: graph.order > 500 ? 100 : graph.order > 200 ? 160 : graph.order > 50 ? 250 : 450,
            settings: {
              gravity:           graph.order < 30 ? 6 : graph.order < 100 ? 4 : 2,
              scalingRatio:      graph.order < 30 ? 0.8 : graph.order < 100 ? 1.2 : 1.8,
              strongGravityMode: true,
              linLogMode:        true,   // prevents hub dominance; gives ring-like cluster layout
              barnesHutOptimize: graph.order > 200,
              barnesHutTheta:    0.5,
              slowDown:          graph.order < 30 ? 4 : 8,
              outboundAttractionDistribution: true,  // tighter hub-spoke grouping
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
          defaultEdgeColor: '#162030',
          defaultNodeColor: '#3d5068',
          labelColor:       { color: '#8496b0' },  // --ink-muted
          labelSize:        11,
          labelWeight:      '500',
          labelDensity:     0.35,
          labelGridCellSize: 140,
          labelRenderedSizeThreshold: 10,  // 10px+ nodes show labels; SG 3px dots never do
          nodeReducer: (nodeId: string, attrs: Record<string, unknown>) => {
            const isSelected = selectedNodeIdRef.current === nodeId
            const isHovered  = hoveredNodeIdRef.current === nodeId
            const query      = searchQueryRef.current
            const hidden     = hiddenTypesRef.current
            const label      = String(attrs['label'] ?? '')
            const rType      = String(attrs['resourceType'] ?? '')
            const rRegion    = String(attrs['region'] ?? '')

            const matchesSearch = query.length === 0 || label.toLowerCase().includes(query.toLowerCase())
            const isHiddenType  = hidden.length > 0 && hidden.includes(rType)
            const active        = activeRegionsRef.current
            const isInactiveRegion = active.length === 0 || !active.includes(rRegion)

            const importantTypes = ['EC2','RDS','Lambda','ALB','NLB','ECS','ElastiCache','APIGateway','S3Bucket','SQS','SNS','CloudFront']
            const isImportant    = importantTypes.includes(rType)

            // Blast radius canvas overlay
            const blastIds    = blastRadiusAffectedRef.current
            const blastActive = blastIds.length > 0
            const inBlast     = blastActive && (blastIds.includes(nodeId) || selectedNodeIdRef.current === nodeId)
            const dimmedByBlast = blastActive && !inBlast

            const baseSize = Number(attrs['size']) || 10

            return {
              ...attrs,
              size:        isSelected ? baseSize * 1.45 : isHovered ? baseSize * 1.15 : dimmedByBlast ? baseSize * 0.7 : baseSize,
              highlighted: isSelected || isHovered || (blastActive && inBlast),
              hidden:      isInactiveRegion || isHiddenType || (query.length > 0 && !matchesSearch),
              forceLabel:  isSelected || isHovered || (blastActive && inBlast),
              // Blast: highlight affected (teal/severity), dim others; selected → teal
              color: isSelected
                ? '#00c4b4'
                : dimmedByBlast
                  ? '#1a2840'   // near-invisible background tone
                  : String(attrs['color'] ?? '#3d5068'),
              zIndex: isSelected ? 4 : inBlast ? 3 : isHovered ? 2 : isImportant ? 1 : 0,
            }
          },
          edgeReducer: (edgeId: string, attrs: Record<string, unknown>) => {
            const selected = selectedNodeIdRef.current
            let color = String(attrs['color'] ?? '#162030')
            const size  = Number(attrs['size']) || 1

            if (selected) {
              // Highlight edges connected to selected node; dim others
              const src = graph.source(edgeId)
              const tgt = graph.target(edgeId)
              if (src !== selected && tgt !== selected) {
                color = color + '33'  // 20% opacity for unrelated edges
              }
            }

            return { ...attrs, size, color }
          },
        })
      } catch (err) {
        console.error('[GraphCanvas] Sigma constructor failed:', err)
        return
      }

      renderer.on('clickNode',  ({ node }: { node: string }) => setSelectedNode(node))
      renderer.on('enterNode',  ({ node }: { node: string }) => {
        setHoveredNode(node)
        // Skip tooltip when node is already selected (ResourcePanel covers it)
        if (selectedNodeIdRef.current === node) return

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const g: any = graphRef.current
        if (!g || !g.hasNode(node)) return

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const attrs: Record<string, any> = g.getNodeAttributes(node)
        const rType   = String(attrs['resourceType'] ?? '')
        const label   = String(attrs['label'] ?? node)
        const region  = String(attrs['region'] ?? '')

        // Pick one key property per resource type from the properties bag
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const props: Record<string, any> = (attrs['properties'] as Record<string, any>) ?? {}
        let keyProp: string | undefined
        if (rType === 'EC2'        && props['state'])          keyProp = `state: ${String(props['state'])}`
        else if (rType === 'Lambda'     && props['runtime'])        keyProp = `runtime: ${String(props['runtime'])}`
        else if (rType === 'RDS'        && props['engine'])         keyProp = `engine: ${String(props['engine'])}`
        else if (rType === 'ECS'        && props['launchType'])     keyProp = `launch: ${String(props['launchType'])}`
        else if (rType === 'ALB'        && props['scheme'])         keyProp = `scheme: ${String(props['scheme'])}`
        else if (rType === 'NLB'        && props['scheme'])         keyProp = `scheme: ${String(props['scheme'])}`
        else if (rType === 'ElastiCache' && props['engine'])        keyProp = `engine: ${String(props['engine'])}`
        else if (rType === 'S3Bucket'   && props['region'])         keyProp = `region: ${String(props['region'])}`
        else if (rType === 'SQS'        && props['queueType'])      keyProp = `type: ${String(props['queueType'])}`
        else if (rType === 'SNS'        && props['protocol'])       keyProp = `proto: ${String(props['protocol'])}`
        else if (rType === 'VPC'        && props['cidrBlock'])      keyProp = `cidr: ${String(props['cidrBlock'])}`

        // Convert graph-space coords to viewport pixels
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const displayData = (renderer as any).getNodeDisplayData?.(node) as { x: number; y: number } | undefined
        if (!displayData) return

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const vp = (renderer as any).graphToViewport?.({ x: displayData.x, y: displayData.y }) as { x: number; y: number } | undefined
        if (!vp) return

        setHoveredNodeData({
          name:   label,
          type:   rType,
          region,
          x:      vp.x,
          y:      vp.y,
          ...(keyProp !== undefined ? { property: keyProp } : {}),
        })
      })
      renderer.on('leaveNode',  () => {
        setHoveredNode(null)
        setHoveredNodeData(null)
      })
      renderer.on('clickStage', ()                            => setSelectedNode(null))

      rendererRef.current = renderer

      // If a region was already selected before data loaded, auto-fit on init
      if (activeRegionsRef.current.length > 0) {
        fitToVisible()
      }
    }

    void init()
    return () => {
      cancelled = true
      killRenderer()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, killRenderer])

  // Refresh without full rebuild on interaction state changes
  useEffect(() => {
    if (rendererRef.current) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(rendererRef.current as any).refresh()
      } catch { /* renderer may have been killed */ }
    }
  }, [selectedNodeId, hoveredNodeId, searchQuery, hiddenTypes, activeRegions, blastRadiusAffectedIds])

  // ── Camera controls ───────────────────────────────────────────────────────────

  const zoomIn = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = rendererRef.current as any
    if (!r) return
    r.getCamera().animate({ ratio: r.getCamera().ratio * 0.65 }, { duration: 180 })
  }

  const zoomOut = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = rendererRef.current as any
    if (!r) return
    r.getCamera().animate({ ratio: r.getCamera().ratio * 1.55 }, { duration: 180 })
  }

  const fitView = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = rendererRef.current as any
    if (!r) return
    r.getCamera().animate({ x: 0.5, y: 0.5, ratio: 1 }, { duration: 300 })
  }

  // Fit the camera to only the currently-visible (active region) nodes.
  // Uses Sigma's getNodeDisplayData which returns pre-camera frame coords (0-1 space).
  // We wait 2 rAF cycles so Sigma's render pass (which populates the display cache) completes first.
  const fitToVisible = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = rendererRef.current as any
    if (!r) return

    requestAnimationFrame(() => requestAnimationFrame(() => {
      const active = activeRegionsRef.current
      if (active.length === 0) return

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const g = (r as any).getGraph?.()
      if (!g) return

      const coords: { x: number; y: number }[] = []

      g.forEachNode((id: string, attrs: Record<string, unknown>) => {
        if (!active.includes(String(attrs['region'] ?? ''))) return
        if (hiddenTypesRef.current.includes(String(attrs['resourceType'] ?? ''))) return
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const d = (r as any).getNodeDisplayData?.(id) as { x: number; y: number } | undefined
        if (d) coords.push({ x: d.x, y: d.y })
      })

      if (coords.length === 0) return

      const xs = coords.map(c => c.x)
      const ys = coords.map(c => c.y)
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2
      const cy = (Math.min(...ys) + Math.max(...ys)) / 2
      const spread = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys))

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const camera = (r as any).getCamera?.()
      if (!camera) return

      // ratio: 1 = full graph visible; 0.1 = 10× zoom. Pad the visible cluster by 50%.
      const ratio = coords.length === 1 ? 0.08 : Math.min(Math.max(spread * 1.5, 0.04), 0.95)
      camera.animate({ x: cx, y: cy, ratio }, { duration: 450 })
    }))
  }, [])

  // ── Keyboard shortcuts ────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        if (e.key === 'Escape') (e.target as HTMLInputElement).blur()
        return
      }
      switch (e.key) {
        case 'Escape':
          setShowShortcuts(false)
          setSelectedNode(null)
          setSearchQuery('')
          break
        case '?':
          e.preventDefault()
          setShowShortcuts(v => !v)
          break
        case '/':      e.preventDefault(); searchInputRef.current?.focus(); break
        case 'f':
        case 'F':
          if (activeRegionsRef.current.length > 0) fitToVisible()
          else fitView()
          break
        case '+':
        case '=':      zoomIn(); break
        case '-':      zoomOut(); break
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setSelectedNode, setSearchQuery])

  // Auto-fit to visible nodes whenever the active region changes
  useEffect(() => {
    if (activeRegions.length === 0) return
    fitToVisible()
  }, [activeRegions, fitToVisible])

  // ── Loading skeleton ──────────────────────────────────────────────────────────
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
        <div
          className="flex flex-col items-center gap-2 p-6 rounded-xl"
          style={{ border: `1px solid ${('var(--status-critical)')}22`, background: 'var(--surface-1)' }}
        >
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
          <p className="font-medium" style={{ color: 'var(--ink)', fontFamily: 'var(--font-display)' }}>No infrastructure scanned yet</p>
          <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>Trigger a scan to populate the dependency graph.</p>
        </div>
      </div>
    )
  }

  // ── Main canvas ───────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 relative" style={{ background: 'var(--canvas)' }}>
      {/* Canvas vignette — teal center glow gives depth */}
      <div className="graph-vignette" />

      {/* No region selected overlay */}
      {activeRegions.length === 0 && data && data.meta.nodeCount > 0 && (
        <div
          className="absolute inset-0 z-20 flex items-center justify-center"
          style={{ background: 'rgba(5,7,10,0.78)', backdropFilter: 'blur(4px)' }}
        >
          <div className="flex flex-col items-center gap-4 text-center">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{
                background: 'var(--surface-2)',
                border: '1px solid var(--hairline)',
                boxShadow: 'var(--shadow-md)',
              }}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--ink-subtle)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold mb-1" style={{ color: 'var(--ink)', fontFamily: 'var(--font-display)' }}>
                No region selected
              </p>
              <p className="text-xs" style={{ color: 'var(--ink-muted)' }}>
                Use the region picker above to explore your AWS infrastructure
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Sigma WebGL container */}
      <div ref={containerRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 2 }} />

      {/* Top toolbar */}
      <div className="absolute top-3 left-3 right-3 z-10 flex items-center gap-2 flex-wrap" style={{ zIndex: 10 }}>
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
            ref={searchInputRef}
            type="text"
            placeholder="Search…   /"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-xs rounded-lg outline-none w-44 transition-all"
            style={{
              background: 'rgba(8,10,15,0.88)',
              border: '1px solid var(--hairline)',
              color: 'var(--ink)',
              backdropFilter: 'blur(10px)',
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
            onBlur={(e)  => (e.currentTarget.style.borderColor = 'var(--hairline)')}
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

        <div className="w-px h-5 shrink-0" style={{ background: 'var(--hairline)' }} />

        {/* Resource type filter chips with live counts */}
        <div className="flex items-center gap-1 flex-wrap">
          {FILTER_TYPES.map(({ type, label }) => {
            const isHidden = hiddenTypes.includes(type)
            const color = nodeColor(type)
            const count = typeCounts[type] ?? 0
            return (
              <button
                key={type}
                onClick={() => toggleType(type)}
                title={isHidden ? `Show ${label}` : `Hide ${label}`}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-all"
                style={{
                  background:    isHidden ? 'rgba(8,10,15,0.6)' : `${color}15`,
                  border:        `1px solid ${isHidden ? 'var(--hairline)' : color + '35'}`,
                  color:         isHidden ? 'var(--ink-subtle)' : color,
                  backdropFilter: 'blur(10px)',
                  opacity:       isHidden ? 0.5 : 1,
                  textDecoration: isHidden ? 'line-through' : 'none',
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: isHidden ? 'var(--ink-subtle)' : color }}
                />
                {label}
                {count > 0 && (
                  <span
                    className="text-[9px] tabular-nums"
                    style={{ color: isHidden ? 'var(--ink-ghost)' : color + 'cc', marginLeft: '1px' }}
                  >
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Zoom controls — right side */}
      <div
        className="absolute right-3 top-1/2 -translate-y-1/2 z-10 flex flex-col gap-1 rounded-xl p-1"
        style={{
          background: 'rgba(7,9,13,0.9)',
          border: '1px solid var(--hairline)',
          backdropFilter: 'blur(10px)',
          zIndex: 10,
        }}
      >
        {[
          { onClick: zoomIn,  title: 'Zoom in  (+)',  icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg> },
          { onClick: zoomOut, title: 'Zoom out (−)',  icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4"/></svg> },
          { onClick: () => { if (activeRegionsRef.current.length > 0) fitToVisible(); else fitView() }, title: 'Fit view  (F)', icon: (
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          )},
        ].map(({ onClick, title, icon }) => (
          <button
            key={title}
            onClick={onClick}
            title={title}
            className="w-7 h-7 flex items-center justify-center rounded-lg transition-all"
            style={{ color: 'var(--ink-subtle)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--ink)'
              e.currentTarget.style.background = 'var(--surface-2)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--ink-subtle)'
              e.currentTarget.style.background = 'transparent'
            }}
          >
            {icon}
          </button>
        ))}
      </div>

      {/* Edge legend — bottom-left */}
      <div
        className="absolute bottom-3 left-3 z-10 flex items-center gap-3 px-3 py-2 rounded-xl text-xs"
        style={{
          background: 'rgba(5,7,10,0.9)',
          border: '1px solid var(--hairline)',
          backdropFilter: 'blur(10px)',
          color: 'var(--ink-subtle)',
          zIndex: 10,
        }}
      >
        {[
          { color: '#b06a28', label: 'depends on'  },
          { color: '#2d5a8e', label: 'member of'   },
          { color: '#1a6b45', label: 'deployed in' },
        ].map(({ color, label }) => (
          <span key={label} className="flex items-center gap-1.5">
            <span className="w-5 rounded-full" style={{ background: color, height: '2px' }} />
            <span className="text-[10px] uppercase tracking-wide">{label}</span>
          </span>
        ))}
        <div className="w-px h-3 shrink-0" style={{ background: 'var(--hairline)' }} />
        <button
          onClick={() => setShowShortcuts(v => !v)}
          className="text-[10px] transition-colors"
          style={{ color: showShortcuts ? 'var(--accent)' : 'var(--ink-ghost)', fontFamily: 'var(--font-mono)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          <kbd style={{ fontSize: '9px' }}>?</kbd> shortcuts
        </button>
      </div>

      {/* Keyboard shortcut cheatsheet overlay */}
      {showShortcuts && (
        <div
          className="absolute bottom-12 left-3 z-20 rounded-xl overflow-hidden"
          style={{
            background: 'rgba(5,7,10,0.97)',
            border: '1px solid var(--hairline-strong)',
            backdropFilter: 'blur(16px)',
            boxShadow: 'var(--shadow-lg)',
            width: '260px',
            zIndex: 20,
          }}
        >
          <div className="flex items-center justify-between px-3 py-2.5" style={{ borderBottom: '1px solid var(--hairline)' }}>
            <span className="text-[11px] font-semibold" style={{ color: 'var(--ink)', fontFamily: 'var(--font-display)' }}>
              Keyboard Shortcuts
            </span>
            <button
              onClick={() => setShowShortcuts(false)}
              className="w-4 h-4 flex items-center justify-center rounded"
              style={{ color: 'var(--ink-subtle)' }}
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="py-2">
            {[
              { keys: ['Esc'],        desc: 'Deselect · clear search' },
              { keys: ['/'],          desc: 'Focus search' },
              { keys: ['F'],          desc: 'Fit to region' },
              { keys: ['+', '='],     desc: 'Zoom in' },
              { keys: ['−'],          desc: 'Zoom out' },
              { keys: ['?'],          desc: 'Toggle shortcuts' },
            ].map(({ keys, desc }) => (
              <div key={desc} className="flex items-center justify-between px-3 py-1.5">
                <span className="text-[11px]" style={{ color: 'var(--ink-subtle)' }}>{desc}</span>
                <div className="flex items-center gap-1">
                  {keys.map((k) => (
                    <kbd
                      key={k}
                      className="px-1.5 py-0.5 rounded text-[10px]"
                      style={{
                        background: 'var(--surface-3)',
                        border: '1px solid var(--hairline-strong)',
                        color: 'var(--ink-muted)',
                        fontFamily: 'var(--font-mono)',
                        lineHeight: '1.4',
                      }}
                    >
                      {k}
                    </kbd>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Keyboard shortcuts hint — bottom-right */}
      <div
        className="absolute bottom-3 right-3 z-10 text-[10px]"
        style={{ color: 'var(--ink-ghost)', zIndex: 10, fontFamily: 'var(--font-mono)' }}
      >
        <span>Esc · / · F · ? · +/−</span>
      </div>

      {/* Node hover tooltip */}
      {hoveredNodeData && !selectedNodeId && (
        <div
          style={{
            position:       'absolute',
            left:           hoveredNodeData.x + 12,
            top:            hoveredNodeData.y - 8,
            zIndex:         30,
            pointerEvents:  'none',
            background:     'rgba(7,9,13,0.97)',
            border:         '1px solid var(--hairline-strong)',
            backdropFilter: 'blur(12px)',
            borderRadius:   '10px',
            padding:        '8px 10px',
            minWidth:       '140px',
            maxWidth:       '220px',
          }}
        >
          {/* Row 1: type badge + region */}
          <div className="flex items-center justify-between gap-2 mb-1">
            <span
              style={{
                fontFamily:  'var(--font-mono)',
                fontSize:    '10px',
                fontWeight:  600,
                color:       nodeColor(hoveredNodeData.type as ResourceType),
                background:  `${nodeColor(hoveredNodeData.type as ResourceType)}18`,
                border:      `1px solid ${nodeColor(hoveredNodeData.type as ResourceType)}30`,
                borderRadius: '4px',
                padding:     '1px 5px',
                letterSpacing: '0.04em',
                lineHeight:  '1.5',
              }}
            >
              {hoveredNodeData.type}
            </span>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize:   '9px',
                color:      'var(--ink-muted)',
                whiteSpace: 'nowrap',
              }}
            >
              {hoveredNodeData.region}
            </span>
          </div>
          {/* Row 2: resource name */}
          <div
            style={{
              fontFamily:   'var(--font-display)',
              fontSize:     '12px',
              fontWeight:   600,
              color:        'var(--ink)',
              lineHeight:   '1.35',
              overflow:     'hidden',
              textOverflow: 'ellipsis',
              whiteSpace:   'nowrap',
              marginBottom: hoveredNodeData.property ? '4px' : 0,
            }}
          >
            {hoveredNodeData.name}
          </div>
          {/* Row 3: key property (optional) */}
          {hoveredNodeData.property && (
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize:   '10px',
                color:      'var(--ink-muted)',
                lineHeight: '1.4',
              }}
            >
              {hoveredNodeData.property}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
