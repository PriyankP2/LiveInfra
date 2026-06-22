'use client'

import { useRef, useState, useEffect } from 'react'

interface RegionRow {
  name: string
  nodeCount: number
}

interface RegionDropdownProps {
  regions: RegionRow[]
  hiddenRegions: string[]
  onToggle: (region: string) => void
  onSetAll: (regions: string[]) => void  // [] = show all, [...all] = hide all
}

export default function RegionDropdown({
  regions,
  hiddenRegions,
  onToggle,
  onSetAll,
}: RegionDropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  if (regions.length === 0) {
    return (
      <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ color: 'var(--ink-subtle)' }}>
        No regions
      </span>
    )
  }

  const visibleCount = regions.length - hiddenRegions.length
  const allVisible = hiddenRegions.length === 0
  const maxNodes = Math.max(...regions.map((r) => r.nodeCount), 1)

  // Label shown on the trigger button
  const label =
    allVisible
      ? regions.length === 1
        ? regions[0]!.name
        : `All ${regions.length} regions`
      : visibleCount === 1
        ? regions.find((r) => !hiddenRegions.includes(r.name))?.name ?? '1 region'
        : `${visibleCount} / ${regions.length} regions`

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-xs font-mono px-2.5 py-1 rounded-md transition-all"
        style={{
          background: open ? 'var(--surface-3)' : 'var(--surface-2)',
          border: `1px solid ${open ? 'var(--accent)' : 'var(--hairline)'}`,
          color: allVisible ? 'var(--accent-hover)' : 'var(--ink-muted)',
        }}
      >
        {/* Status dot */}
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: allVisible ? 'var(--accent)' : 'var(--ink-subtle)' }}
        />
        {label}
        {/* Chevron */}
        <svg
          className="w-3 h-3 transition-transform"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', color: 'var(--ink-subtle)' }}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          className="absolute top-full mt-1 left-0 z-50 rounded-lg overflow-hidden shadow-xl"
          style={{
            background: 'var(--surface-2)',
            border: '1px solid var(--hairline)',
            minWidth: '240px',
          }}
        >
          {/* "All regions" toggle */}
          <div style={{ borderBottom: '1px solid var(--hairline)' }}>
            <button
              onClick={() => onSetAll(allVisible ? regions.map((r) => r.name) : [])}
              className="w-full flex items-center justify-between px-3 py-2.5 text-xs transition-colors"
              style={{ color: 'var(--ink-muted)' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-3)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <span className="font-medium" style={{ color: 'var(--ink)' }}>
                {allVisible ? 'Hide all' : 'Show all'}
              </span>
              <span style={{ color: 'var(--ink-subtle)' }}>
                {visibleCount} / {regions.length} visible
              </span>
            </button>
          </div>

          {/* Region rows */}
          <div className="py-1">
            {regions.map((r) => {
              const isVisible = !hiddenRegions.includes(r.name)
              const barWidth = r.nodeCount > 0 ? Math.max(4, Math.round((r.nodeCount / maxNodes) * 80)) : 0

              return (
                <button
                  key={r.name}
                  onClick={() => onToggle(r.name)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors group"
                  style={{ color: isVisible ? 'var(--ink)' : 'var(--ink-subtle)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-3)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  {/* Checkbox */}
                  <span
                    className="shrink-0 w-3.5 h-3.5 rounded flex items-center justify-center"
                    style={{
                      background: isVisible ? 'var(--accent)' : 'transparent',
                      border: `1px solid ${isVisible ? 'var(--accent)' : 'var(--hairline-strong)'}`,
                    }}
                  >
                    {isVisible && (
                      <svg className="w-2.5 h-2.5" fill="none" stroke="white" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </span>

                  {/* Region name */}
                  <span className="font-mono flex-1 text-left" style={{ opacity: isVisible ? 1 : 0.5 }}>
                    {r.name}
                  </span>

                  {/* Node count + bar */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {r.nodeCount > 0 ? (
                      <>
                        <div className="w-20 h-1 rounded-full overflow-hidden" style={{ background: 'var(--surface-3)' }}>
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${barWidth}%`,
                              background: isVisible ? 'var(--accent)' : 'var(--ink-subtle)',
                              opacity: isVisible ? 1 : 0.4,
                            }}
                          />
                        </div>
                        <span className="w-8 text-right tabular-nums" style={{ color: 'var(--ink-subtle)' }}>
                          {r.nodeCount}
                        </span>
                      </>
                    ) : (
                      <span className="text-[10px]" style={{ color: 'var(--ink-subtle)' }}>empty</span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
