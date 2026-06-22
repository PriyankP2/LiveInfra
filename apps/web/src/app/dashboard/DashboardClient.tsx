'use client'

import GraphCanvas from '@/components/graph/GraphCanvas'
import ResourcePanel from '@/components/graph/ResourcePanel'
import RegionDropdown from '@/components/layout/RegionDropdown'
import { useGraphStore } from '@/components/graph/graphStore'
import { trpc } from '@/lib/trpc'
import { supabase } from '@/lib/supabase'
import { useMemo, useState, useEffect } from 'react'

interface DashboardClientProps {
  clerkUserId: string
  email: string | undefined
  defaultAccountId: string
}

export default function DashboardClient({ clerkUserId, email, defaultAccountId }: DashboardClientProps) {
  const { selectedNodeId, activeRegions, toggleRegion, setActiveRegions, setCachedNodes, setResolvedCustomerId } = useGraphStore()

  // Resolve real customer UUID; fall back to 'demo' while loading or on error.
  // We only switch away from 'demo' once the real UUID has actual Neo4j data —
  // i.e. after the first real scan completes. This preserves the seeded demo graph.
  const resolveCustomer = trpc.customer.resolve.useMutation()
  const [customerId, setCustomerId]   = useState('demo')
  const [resolvedId, setResolvedId]   = useState<string | null>(null)
  const [accountId] = useState(defaultAccountId)

  useEffect(() => {
    resolveCustomer.mutate(
      { clerkUserId, email },
      {
        onSuccess: (res) => {
          // Store the real UUID but don't switch yet — we'll check if Neo4j has data
          if (res.id) {
            setResolvedId(res.id)
            setResolvedCustomerId(res.id)
          }
        },
        onError: () => {},
      }
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clerkUserId])
  const utils = trpc.useUtils()

  // Check if the real customer UUID has any nodes in Neo4j yet.
  // Only runs once resolvedId is known; switches customerId when data exists.
  const { data: realGraphCheck } = trpc.graph.topology.useQuery(
    { customerId: resolvedId ?? '', accountId },
    { enabled: !!resolvedId && resolvedId !== 'demo', retry: false, staleTime: 60_000 }
  )
  useEffect(() => {
    if (resolvedId && (realGraphCheck?.meta.nodeCount ?? 0) > 0) {
      setCustomerId(resolvedId)
    }
  }, [resolvedId, realGraphCheck?.meta.nodeCount])

  const [scanning, setScanning] = useState(false)
  const [scanStartedAt, setScanStartedAt] = useState<string | null>(null)
  const [scanError, setScanError] = useState<string | null>(null)

  const { data: graphData, dataUpdatedAt } = trpc.graph.topology.useQuery(
    { customerId, accountId },
    { retry: 1, staleTime: 30_000 }
  )

  // Poll scan status when a scan is running
  const { data: scanStatus } = trpc.scanner.status.useQuery(
    { customerId, accountId },
    { refetchInterval: scanning ? 5_000 : false, enabled: scanning }
  )

  // Sync nodes to global store for command palette search
  useEffect(() => {
    if (graphData?.nodes) setCachedNodes(graphData.nodes)
  }, [graphData?.nodes, setCachedNodes])

  // Detect scan completion: lastScanAt moved past the point we triggered
  useEffect(() => {
    if (!scanning || !scanStartedAt || !scanStatus?.lastScanAt) return
    if (new Date(scanStatus.lastScanAt) > new Date(scanStartedAt)) {
      setScanning(false)
      setScanStartedAt(null)
      void utils.graph.topology.invalidate()
    }
  }, [scanning, scanStartedAt, scanStatus?.lastScanAt, utils])

  // Real-time: refresh graph when a new graph_snapshot row is inserted for this customer.
  // This means the scanner finished and Neo4j has been written — invalidate the tRPC cache.
  useEffect(() => {
    if (!resolvedId) return

    const channel = supabase
      .channel(`graph_snapshots:${resolvedId}`)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'graph_snapshots',
          filter: `customer_id=eq.${resolvedId}`,
        },
        () => {
          void utils.graph.topology.invalidate()
          void utils.scanner.status.invalidate()
          setScanning(false)
        }
      )
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
  }, [resolvedId, utils])

  const triggerScan = trpc.scanner.triggerDefault.useMutation({
    onSuccess: (res) => {
      setScanning(true)
      setScanStartedAt(res.startedAt)
      setScanError(null)
    },
    onError: (err) => {
      setScanError(err.message)
      setScanning(false)
    },
  })

  // Derive distinct regions with per-region node counts
  const regions = useMemo(() => {
    if (!graphData) return []
    const counts = new Map<string, number>()
    for (const n of graphData.nodes) {
      if (n.region) counts.set(n.region, (counts.get(n.region) ?? 0) + 1)
    }
    return Array.from(counts.entries())
      .map(([name, nodeCount]) => ({ name, nodeCount }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [graphData])

  // Data freshness: last sync relative time + staleness detection
  const lastSyncLabel = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null

  const isDataStale = dataUpdatedAt
    ? Date.now() - dataUpdatedAt > 15 * 60_000  // > 15 min = stale
    : false

  const visibleNodeCount = useMemo(() => {
    if (!graphData || activeRegions.length === 0) return 0
    return graphData.nodes.filter((n) => activeRegions.includes(n.region)).length
  }, [graphData, activeRegions])

  const handleRescan = () => {
    if (scanning) return
    setScanError(null)
    triggerScan.mutate({
      customerId,
      accountId,
      regions: regions.length > 0 ? regions.map((r) => r.name) : undefined,
    })
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Account context bar */}
      <div
        className="flex items-center gap-3 px-4 shrink-0"
        style={{
          height: '46px',
          background: 'var(--surface-1)',
          borderBottom: '1px solid var(--hairline)',
          boxShadow: '0 1px 0 rgba(0,0,0,0.3)',
        }}
      >
        {/* Account identity */}
        <div className="flex items-center gap-2 shrink-0">
          <div
            className="w-2 h-2 rounded-full shrink-0"
            style={{
              background: isDataStale ? 'var(--status-degraded)' : 'var(--status-healthy)',
              boxShadow: `0 0 6px ${isDataStale ? 'var(--status-degraded)' : 'var(--status-healthy)'}`,
              animation: scanning ? 'scan-pulse 1.2s ease-in-out infinite' : 'none',
            }}
          />
          <span
            className="text-sm font-semibold"
            style={{ color: 'var(--ink)', fontFamily: 'var(--font-mono)', fontSize: '12px' }}
          >
            {accountId}
          </span>
        </div>

        <div className="w-px h-4 shrink-0" style={{ background: 'var(--hairline)' }} />

        {/* Region dropdown */}
        <RegionDropdown
          regions={regions}
          activeRegions={activeRegions}
          onToggle={toggleRegion}
          onSetAll={setActiveRegions}
        />

        {lastSyncLabel && (
          <>
            <div className="w-px h-4 shrink-0" style={{ background: 'var(--hairline)' }} />
            <span className="text-xs shrink-0" style={{ color: 'var(--ink-subtle)', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
              {scanning ? (
                <span style={{ color: 'var(--accent)', animation: 'scan-pulse 1.2s ease-in-out infinite' }}>
                  scanning…
                </span>
              ) : (
                <>synced {lastSyncLabel}</>
              )}
            </span>
          </>
        )}

        {/* Error toast */}
        {scanError && (
          <div
            className="shrink-0 flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px]"
            style={{ background: 'var(--accent-secondary-dim)', border: '1px solid var(--accent-secondary)40', color: 'var(--accent-secondary)' }}
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
            </svg>
            {scanError}
          </div>
        )}

        {/* Right side */}
        <div className="flex items-center gap-3 ml-auto">
          {graphData && (
            <span className="text-[11px] tabular-nums" style={{ color: 'var(--ink-subtle)', fontFamily: 'var(--font-mono)' }}>
              {activeRegions.length === 0 ? (
                <span>
                  <span style={{ color: 'var(--ink-muted)' }}>{graphData.meta.nodeCount.toLocaleString()}</span>
                  {' '}resources · {regions.length} regions
                </span>
              ) : (
                <>
                  <span style={{ color: 'var(--ink-muted)' }}>{visibleNodeCount.toLocaleString()}</span>
                  {' '}resources · {graphData.meta.edgeCount.toLocaleString()} edges
                </>
              )}
            </span>
          )}

          {/* Re-scan button */}
          <button
            onClick={handleRescan}
            disabled={scanning}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-semibold shrink-0 transition-all"
            style={{
              background: scanning ? 'var(--surface-3)' : 'var(--accent)',
              color:      scanning ? 'var(--ink-subtle)' : '#000',
              opacity:    scanning ? 0.7 : 1,
              cursor:     scanning ? 'not-allowed' : 'pointer',
              border:     'none',
              fontFamily: 'var(--font-sans)',
            }}
            onMouseEnter={(e) => {
              if (!scanning) (e.currentTarget.style.background = 'var(--accent-hover)')
            }}
            onMouseLeave={(e) => {
              if (!scanning) (e.currentTarget.style.background = 'var(--accent)')
            }}
          >
            {scanning ? (
              <>
                <svg className="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Scanning…
              </>
            ) : (
              <>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Re-scan
              </>
            )}
          </button>
        </div>
      </div>

      {/* Graph + panel */}
      <main className="flex flex-row flex-1 overflow-hidden">
        <GraphCanvas customerId={customerId} accountId={accountId} />
        <ResourcePanel nodeId={selectedNodeId} graphData={graphData} customerId={customerId} />
      </main>
    </div>
  )
}
