'use client'

import GraphCanvas from '@/components/graph/GraphCanvas'
import ResourcePanel from '@/components/graph/ResourcePanel'
import { useGraphStore } from '@/components/graph/graphStore'
import { trpc } from '@/lib/trpc'

interface DashboardClientProps {
  customerId: string
  accountId: string
}

export default function DashboardClient({ customerId, accountId }: DashboardClientProps) {
  const { selectedNodeId } = useGraphStore()

  const { data: graphData, dataUpdatedAt } = trpc.graph.topology.useQuery(
    { customerId, accountId },
    { retry: 1, staleTime: 30_000 }
  )

  const lastSyncLabel = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Account context bar */}
      <div
        className="flex items-center justify-between px-5 shrink-0"
        style={{
          height: '44px',
          background: 'var(--surface-1)',
          borderBottom: '1px solid var(--hairline)',
        }}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ background: 'var(--status-healthy)' }}
            />
            <span className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
              {accountId}
            </span>
          </div>
          <span
            className="text-xs px-2 py-0.5 rounded-full font-mono"
            style={{
              background: 'var(--surface-3)',
              color: 'var(--ink-subtle)',
              border: '1px solid var(--hairline)',
            }}
          >
            us-east-1
          </span>
          {lastSyncLabel && (
            <span className="text-xs" style={{ color: 'var(--ink-subtle)' }}>
              Last synced {lastSyncLabel}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {graphData && (
            <span className="text-xs" style={{ color: 'var(--ink-subtle)' }}>
              {graphData.meta.nodeCount} resources · {graphData.meta.edgeCount} connections
            </span>
          )}
          <button
            className="text-xs px-3 py-1.5 rounded-md font-medium transition-all"
            style={{
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
            }}
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
