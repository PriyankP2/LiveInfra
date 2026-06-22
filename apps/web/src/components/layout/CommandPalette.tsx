'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useGraphStore } from '@/components/graph/graphStore'
import { nodeColor } from '@/components/graph/graphUtils'

const PAGES = [
  { label: 'Graph',    href: '/dashboard',          icon: '⬡', description: 'AWS dependency graph' },
  { label: 'Accounts', href: '/dashboard/accounts', icon: '⊞', description: 'Manage AWS accounts' },
  { label: 'Scans',   href: '/dashboard/scans',    icon: '↻', description: 'Scan history' },
  { label: 'Alerts',  href: '/dashboard/alerts',   icon: '⚠', description: 'Infrastructure alerts' },
  { label: 'Settings', href: '/dashboard/settings', icon: '⚙', description: 'Account preferences' },
]

const ACTIONS = [
  { label: 'Re-scan infrastructure', key: 'scan',    icon: '↺', description: 'Trigger a fresh scan' },
  { label: 'Fit graph to view',      key: 'fit',     icon: '⊡', description: 'Press F in the graph' },
  { label: 'Show keyboard shortcuts', key: 'keys',   icon: '⌨', description: 'Press ? in the graph' },
]

type ResultItem =
  | { kind: 'page';   label: string; href: string; icon: string; description: string }
  | { kind: 'node';   id: string; name: string; type: string; region: string; accountId: string }
  | { kind: 'action'; key: string; label: string; icon: string; description: string }

export default function CommandPalette() {
  const [open, setOpen]   = useState(false)
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const inputRef  = useRef<HTMLInputElement>(null)
  const listRef   = useRef<HTMLDivElement>(null)
  const router    = useRouter()
  const pathname  = usePathname()

  const { cachedNodes, setSelectedNode, setActiveRegions } = useGraphStore()

  // Open on Cmd+K / Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(prev => !prev)
        setQuery('')
        setCursor(0)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Focus input on open
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 30)
    }
  }, [open])

  const results = useMemo<ResultItem[]>(() => {
    const q = query.toLowerCase().trim()

    if (!q) {
      return [
        ...PAGES.map(p => ({ kind: 'page' as const, ...p })),
        ...ACTIONS.map(a => ({ kind: 'action' as const, ...a })),
      ]
    }

    const items: ResultItem[] = []

    // Pages
    for (const p of PAGES) {
      if (p.label.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)) {
        items.push({ kind: 'page', ...p })
      }
    }

    // Actions
    for (const a of ACTIONS) {
      if (a.label.toLowerCase().includes(q)) {
        items.push({ kind: 'action', ...a })
      }
    }

    // Nodes (up to 12 results)
    const nodeMatches = cachedNodes
      .filter(n => {
        const name = (n.name || n.id).toLowerCase()
        return name.includes(q) || n.type.toLowerCase().includes(q) || n.region.toLowerCase().includes(q)
      })
      .slice(0, 12)
      .map(n => ({ kind: 'node' as const, id: n.id, name: n.name || n.id, type: n.type, region: n.region, accountId: n.accountId }))

    items.push(...nodeMatches)
    return items
  }, [query, cachedNodes])

  // Reset cursor when results change
  useEffect(() => { setCursor(0) }, [results])

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${cursor}"]`) as HTMLElement | null
    el?.scrollIntoView({ block: 'nearest' })
  }, [cursor])

  const commit = useCallback((item: ResultItem) => {
    setOpen(false)
    setQuery('')
    if (item.kind === 'page') {
      router.push(item.href)
    } else if (item.kind === 'node') {
      // If not on the graph page, navigate there first
      if (!pathname.startsWith('/dashboard') || pathname !== '/dashboard') {
        router.push('/dashboard')
      }
      // Focus the node: set it selected + enable its region
      setSelectedNode(item.id)
      setActiveRegions([item.region])
    } else if (item.kind === 'action') {
      if (item.key === 'scan') {
        router.push('/dashboard')
      } else if (item.key === 'fit') {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'f' }))
      } else if (item.key === 'keys') {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: '?' }))
      }
    }
  }, [router, pathname, setSelectedNode, setActiveRegions])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setCursor(c => Math.min(c + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setCursor(c => Math.max(c - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (results[cursor]) commit(results[cursor])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '14vh',
        background: 'rgba(5,7,10,0.75)',
        backdropFilter: 'blur(8px)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) setOpen(false) }}
    >
      <div
        style={{
          width: '100%', maxWidth: '600px',
          background: 'var(--surface-1)',
          border: '1px solid var(--hairline-strong)',
          borderRadius: '16px',
          boxShadow: '0 32px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(0,196,180,0.08)',
          overflow: 'hidden',
        }}
      >
        {/* Search input */}
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '14px 18px',
            borderBottom: '1px solid var(--hairline)',
          }}
        >
          <svg width="16" height="16" fill="none" stroke="var(--ink-subtle)" viewBox="0 0 24 24" strokeWidth="2" style={{ flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8" />
            <path strokeLinecap="round" d="M21 21l-4.35-4.35" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search resources, pages, actions…"
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              fontSize: '15px', color: 'var(--ink)', fontFamily: 'var(--font-sans)',
              caretColor: 'var(--accent)',
            }}
          />
          <kbd
            style={{
              padding: '2px 7px', borderRadius: '5px', fontSize: '11px',
              fontFamily: 'var(--font-mono)', color: 'var(--ink-subtle)',
              background: 'var(--surface-3)', border: '1px solid var(--hairline-strong)',
            }}
          >
            esc
          </kbd>
        </div>

        {/* Results */}
        <div
          ref={listRef}
          style={{ maxHeight: '380px', overflowY: 'auto', padding: '6px' }}
        >
          {results.length === 0 && (
            <div style={{ padding: '24px', textAlign: 'center', fontSize: '13px', color: 'var(--ink-subtle)', fontFamily: 'var(--font-sans)' }}>
              No results for "{query}"
            </div>
          )}

          {!query && (
            <GroupLabel label="Pages" />
          )}

          {results.map((item, i) => {
            const isActive = cursor === i

            // Section labels
            const showNodeHeader = results[i - 1]?.kind !== 'node' && item.kind === 'node'
            const showActionHeader = results[i - 1]?.kind !== 'action' && item.kind === 'action' && query === ''

            return (
              <div key={`${item.kind}-${i}`}>
                {showNodeHeader && <GroupLabel label="Resources" />}
                {showActionHeader && <GroupLabel label="Actions" />}

                <div
                  data-idx={i}
                  onClick={() => commit(item)}
                  onMouseEnter={() => setCursor(i)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '8px 12px', borderRadius: '9px', cursor: 'pointer',
                    background: isActive ? 'var(--surface-3)' : 'transparent',
                    transition: 'background 0.1s',
                  }}
                >
                  {item.kind === 'page' && (
                    <>
                      <span style={{ fontSize: '16px', width: '20px', textAlign: 'center', flexShrink: 0, color: 'var(--ink-subtle)' }}>
                        {item.icon}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: isActive ? 'var(--ink)' : 'var(--ink-muted)', fontFamily: 'var(--font-sans)' }}>
                          {item.label}
                        </p>
                        <p style={{ margin: 0, fontSize: '11px', color: 'var(--ink-subtle)', fontFamily: 'var(--font-sans)' }}>
                          {item.description}
                        </p>
                      </div>
                      <span style={{ fontSize: '11px', color: 'var(--ink-ghost)', fontFamily: 'var(--font-mono)' }}>
                        {item.href}
                      </span>
                    </>
                  )}

                  {item.kind === 'action' && (
                    <>
                      <span style={{ fontSize: '16px', width: '20px', textAlign: 'center', flexShrink: 0, color: 'var(--accent)' }}>
                        {item.icon}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: isActive ? 'var(--ink)' : 'var(--ink-muted)', fontFamily: 'var(--font-sans)' }}>
                          {item.label}
                        </p>
                        <p style={{ margin: 0, fontSize: '11px', color: 'var(--ink-subtle)', fontFamily: 'var(--font-sans)' }}>
                          {item.description}
                        </p>
                      </div>
                      <ActionBadge isActive={isActive} />
                    </>
                  )}

                  {item.kind === 'node' && (
                    <>
                      <span
                        style={{
                          width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                          background: nodeColor(item.type as Parameters<typeof nodeColor>[0]),
                          boxShadow: `0 0 6px ${nodeColor(item.type as Parameters<typeof nodeColor>[0])}60`,
                        }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: '13px', fontWeight: 500, color: isActive ? 'var(--ink)' : 'var(--ink-muted)', fontFamily: 'var(--font-sans)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.name}
                        </p>
                        <p style={{ margin: 0, fontSize: '11px', color: 'var(--ink-subtle)', fontFamily: 'var(--font-mono)' }}>
                          {item.region}
                        </p>
                      </div>
                      <span
                        style={{
                          padding: '2px 7px', borderRadius: '5px', fontSize: '10px', fontWeight: 700,
                          fontFamily: 'var(--font-mono)', flexShrink: 0,
                          background: `${nodeColor(item.type as Parameters<typeof nodeColor>[0])}18`,
                          color: nodeColor(item.type as Parameters<typeof nodeColor>[0]),
                          border: `1px solid ${nodeColor(item.type as Parameters<typeof nodeColor>[0])}30`,
                        }}
                      >
                        {item.type}
                      </span>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            padding: '10px 18px',
            borderTop: '1px solid var(--hairline)',
          }}
        >
          {[
            { keys: ['↑', '↓'], label: 'navigate' },
            { keys: ['↵'], label: 'select' },
            { keys: ['esc'], label: 'close' },
          ].map(({ keys, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {keys.map(k => (
                <kbd
                  key={k}
                  style={{
                    padding: '1px 5px', borderRadius: '4px', fontSize: '11px',
                    fontFamily: 'var(--font-mono)', color: 'var(--ink-subtle)',
                    background: 'var(--surface-3)', border: '1px solid var(--hairline-strong)',
                  }}
                >
                  {k}
                </kbd>
              ))}
              <span style={{ fontSize: '11px', color: 'var(--ink-ghost)', fontFamily: 'var(--font-sans)' }}>
                {label}
              </span>
            </div>
          ))}

          <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--ink-ghost)', fontFamily: 'var(--font-mono)' }}>
            {cachedNodes.length > 0 ? `${cachedNodes.length} resources indexed` : 'No graph loaded'}
          </span>
        </div>
      </div>
    </div>
  )
}

function GroupLabel({ label }: { label: string }) {
  return (
    <p style={{
      margin: 0, padding: '8px 12px 4px',
      fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em',
      textTransform: 'uppercase', color: 'var(--ink-ghost)',
      fontFamily: 'var(--font-sans)',
    }}>
      {label}
    </p>
  )
}

function ActionBadge({ isActive }: { isActive: boolean }) {
  return (
    <div
      style={{
        padding: '2px 7px', borderRadius: '5px', fontSize: '10px',
        fontFamily: 'var(--font-mono)', color: isActive ? 'var(--accent)' : 'var(--ink-ghost)',
        background: isActive ? 'var(--accent-dim)' : 'var(--surface-3)',
        border: `1px solid ${isActive ? 'rgba(0,196,180,0.25)' : 'var(--hairline)'}`,
        flexShrink: 0,
      }}
    >
      action
    </div>
  )
}
