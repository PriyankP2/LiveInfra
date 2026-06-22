'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { UserButton } from '@clerk/nextjs'

const NAV = [
  {
    href: '/dashboard',
    label: 'Graph',
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
        <circle cx="10" cy="10" r="2.5" />
        <circle cx="3.5" cy="4" r="1.5" />
        <circle cx="16.5" cy="4" r="1.5" />
        <circle cx="3.5" cy="16" r="1.5" />
        <circle cx="16.5" cy="16" r="1.5" />
        <line x1="5" y1="4.5" x2="7.5" y2="8.5" />
        <line x1="15" y1="4.5" x2="12.5" y2="8.5" />
        <line x1="5" y1="15.5" x2="7.5" y2="11.5" />
        <line x1="15" y1="15.5" x2="12.5" y2="11.5" />
      </svg>
    ),
  },
  {
    href: '/accounts',
    label: 'Accounts',
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
        <rect x="2" y="5" width="16" height="12" rx="2" />
        <path d="M6 5V4a2 2 0 014 0v1" />
        <path d="M10 5V4a2 2 0 014 0v1" />
        <circle cx="10" cy="11" r="2" />
        <path d="M6 17c0-2.2 1.8-4 4-4s4 1.8 4 4" />
      </svg>
    ),
  },
  {
    href: '/alerts',
    label: 'Alerts',
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
        <path d="M10 2a6 6 0 016 6c0 3.5 1.5 5 2 6H2c.5-1 2-2.5 2-6a6 6 0 016-6z" />
        <path d="M8 16a2 2 0 004 0" />
      </svg>
    ),
  },
  {
    href: '/settings',
    label: 'Settings',
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
        <circle cx="10" cy="10" r="2.5" />
        <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.22 4.22l1.42 1.42M14.36 14.36l1.42 1.42M4.22 15.78l1.42-1.42M14.36 5.64l1.42-1.42" />
      </svg>
    ),
  },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside
      className="flex flex-col items-center py-3 shrink-0"
      style={{
        width: '60px',
        background: '#070a10',
        borderRight: '1px solid var(--hairline)',
      }}
    >
      {/* Logo mark */}
      <div className="mb-6 mt-1">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: 'var(--accent)', boxShadow: '0 0 12px rgba(59,130,246,0.4)' }}
        >
          <svg viewBox="0 0 16 16" fill="white" className="w-4 h-4">
            <circle cx="8" cy="8" r="2.5" />
            <circle cx="2" cy="2" r="1.5" />
            <circle cx="14" cy="2" r="1.5" />
            <circle cx="2" cy="14" r="1.5" />
            <circle cx="14" cy="14" r="1.5" />
            <line x1="3.5" y1="2.5" x2="6" y2="5.5" stroke="white" strokeWidth="1.2" />
            <line x1="12.5" y1="2.5" x2="10" y2="5.5" stroke="white" strokeWidth="1.2" />
            <line x1="3.5" y1="13.5" x2="6" y2="10.5" stroke="white" strokeWidth="1.2" />
            <line x1="12.5" y1="13.5" x2="10" y2="10.5" stroke="white" strokeWidth="1.2" />
          </svg>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex flex-col items-center gap-1 flex-1">
        {NAV.map(({ href, label, icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              title={label}
              className="relative w-10 h-10 flex items-center justify-center rounded-lg transition-all group"
              style={{
                color: active ? 'var(--accent)' : 'var(--ink-subtle)',
                background: active ? 'rgba(59,130,246,0.12)' : 'transparent',
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  e.currentTarget.style.color = 'var(--ink-muted)'
                  e.currentTarget.style.background = 'var(--surface-2)'
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  e.currentTarget.style.color = 'var(--ink-subtle)'
                  e.currentTarget.style.background = 'transparent'
                }
              }}
            >
              {active && (
                <span
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full"
                  style={{ background: 'var(--accent)' }}
                />
              )}
              {icon}
            </Link>
          )
        })}
      </nav>

      {/* User button */}
      <div className="mt-auto mb-1">
        <UserButton
          appearance={{
            elements: {
              avatarBox: 'w-8 h-8',
            },
          }}
        />
      </div>
    </aside>
  )
}
