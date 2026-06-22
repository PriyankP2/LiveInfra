'use client'

import { useRef, useState, useEffect } from 'react'

interface RegionRow {
  name: string
  nodeCount: number
}

interface RegionDropdownProps {
  regions: RegionRow[]
  activeRegions: string[]
  onToggle: (region: string) => void
  onSetAll: (regions: string[]) => void
}

export default function RegionDropdown({
  regions,
  activeRegions,
  onToggle,
  onSetAll,
}: RegionDropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const noneSelected = activeRegions.length === 0
  const allSelected = activeRegions.length === regions.length && regions.length > 0
  const maxNodes = Math.max(...regions.map((r) => r.nodeCount), 1)

  const label = noneSelected
    ? 'Select a region…'
    : activeRegions.length === 1
      ? activeRegions[0]!
      : `${activeRegions.length} regions`

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md transition-all"
        style={{
          fontFamily: noneSelected ? 'inherit' : 'var(--font-mono)',
          background: open ? 'var(--surface-3)' : 'var(--surface-2)',
          border: `1px solid ${open ? 'var(--accent)' : 'var(--hairline)'}`,
          color: noneSelected ? 'var(--ink-subtle)' : 'var(--accent-hover)',
        }}
      >
        {!noneSelected && (
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: 'var(--accent)' }}
          />
        )}
        {label}
        <svg
          className="w-3 h-3 transition-transform"
          style={{
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            color: 'var(--ink-subtle)',
          }}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute top-full mt-1 left-0 z-50 rounded-lg overflow-hidden shadow-xl"
          style={{
            background: 'var(--surface-2)',
            border: '1px solid var(--hairline)',
            minWidth: '260px',
          }}
        >
          {/* Header row */}
          <div
            className="flex items-center justify-between px-3 py-2"
            style={{ borderBottom: '1px solid var(--hairline)' }}
          >
            <span className="text-xs font-medium" style={{ color: 'var(--ink-muted)' }}>
              {noneSelected ? 'Choose regions to view' : `${activeRegions.length} of ${regions.length} selected`}
            </span>
            <button
              onClick={() => onSetAll(allSelected ? [] : regions.map((r) => r.name))}
              className="text-xs transition-colors"
              style={{ color: 'var(--accent)' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--accent)')}
            >
              {allSelected ? 'Clear all' : 'Select all'}
            </button>
          </div>

          {/* Region rows */}
          <div className="py-1 max-h-72 overflow-y-auto">
            {regions.map((r) => {
              const isActive = activeRegions.includes(r.name)
              const barWidth = r.nodeCount > 0 ? Math.max(4, Math.round((r.nodeCount / maxNodes) * 80)) : 0

              return (
                <button
                  key={r.name}
                  onClick={() => onToggle(r.name)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors"
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-3)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  {/* Checkbox */}
                  <span
                    className="shrink-0 w-3.5 h-3.5 rounded flex items-center justify-center"
                    style={{
                      background: isActive ? 'var(--accent)' : 'transparent',
                      border: `1px solid ${isActive ? 'var(--accent)' : 'var(--hairline-strong)'}`,
                    }}
                  >
                    {isActive && (
                      <svg className="w-2.5 h-2.5" fill="none" stroke="white" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </span>

                  {/* Region name */}
                  <span
                    className="font-mono flex-1 text-left"
                    style={{ color: isActive ? 'var(--ink)' : 'var(--ink-muted)' }}
                  >
                    {r.name}
                  </span>

                  {/* Bar + count */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {r.nodeCount > 0 ? (
                      <>
                        <div className="w-16 h-1 rounded-full overflow-hidden" style={{ background: 'var(--surface-3)' }}>
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${barWidth}%`,
                              background: isActive ? 'var(--accent)' : 'var(--ink-subtle)',
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
