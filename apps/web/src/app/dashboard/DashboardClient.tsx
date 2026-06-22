'use client'

import GraphCanvas from '@/components/graph/GraphCanvas'
import ResourcePanel from '@/components/graph/ResourcePanel'
import RegionDropdown from '@/components/layout/RegionDropdown'
import { useGraphStore } from '@/components/graph/graphStore'
import { trpc } from '@/lib/trpc'
import { useMemo } from 'react'

interface DashboardClientProps {
  customerId: string
  accountId: string
}

export default function DashboardClient({ customerId, accountId }: DashboardClientProps) {
  const { selectedNodeId, activeRegions, toggleRegion, setActiveRegions } = useGraphStore()

  const { data: graphData, dataUpdatedAt } = trpc.graph.topology.useQuery(
    { customerId, accountId },
    { retry: 1, staleTime: 30_000 }
  )

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

  const lastSyncLabel = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null

  const visibleNodeCount = useMemo(() => {
    if (!graphData || activeRegions.length === 0) return 0
    return graphData.nodes.filter((n) => activeRegions.includes(n.region)).length
  }, [graphData, activeRegions])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Account context bar */}
      <div
        className="flex items-center gap-3 px-5 shrink-0"
        style={{
          height: '44px',
          background: 'var(--surface-1)',
          borderBottom: '1px solid var(--hairline)',
        }}
      >
        {/* Account identity */}
        <div className="flex items-center gap-2 shrink-0">
          <span
            className="w-2 h-2 rounded-full"
            style={{ background: 'var(--status-healthy)', boxShadow: '0 0 5px var(--status-healthy)' }}
          />
          <span className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
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
            <span className="text-xs shrink-0" style={{ color: 'var(--ink-subtle)' }}>
              Synced {lastSyncLabel}
            </span>
          </>
        )}

        {/* Right side */}
        <div className="flex items-center gap-3 ml-auto">
          {graphData && (
            <span className="text-xs" style={{ color: 'var(--ink-subtle)' }}>
              {activeRegions.length === 0 ? (
                <span>{graphData.meta.nodeCount} resources across {regions.length} regions</span>
              ) : (
                <>
                  <span style={{ color: 'var(--ink)' }}>{visibleNodeCount}</span> resources
                </>
              )}
            </span>
          )}
          <button
            className="text-xs px-3 py-1.5 rounded-md font-medium shrink-0"
            style={{ background: 'var(--accent)', color: '#fff' }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
          >
            Re-scan
          </button>
        </div>
      </div>

      {/* Graph + panel */}
      <main className="flex flex-row flex-1 overflow-hidden">
        <GraphCanvas customerId={customerId} accountId={accountId} />
        <ResourcePanel nodeId={selectedNodeId} graphData={graphData} />
      </main>
    </div>
  )
}
