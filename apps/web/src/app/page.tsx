import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { SignInButton, SignUpButton } from '@clerk/nextjs'

export default async function Home() {
  const { userId } = await auth()

  if (userId) {
    redirect('/dashboard')
  }

  return (
    <main
      className="flex flex-1 flex-col items-center justify-center px-4"
      style={{ background: 'var(--canvas)' }}
    >
      <div className="flex flex-col items-center gap-8 text-center max-w-lg">
        {/* Logo mark */}
        <div className="flex items-center gap-3">
          <div
            className="h-3 w-3 rounded-full shadow-lg"
            style={{
              background: 'var(--status-healthy)',
              boxShadow: '0 0 16px var(--status-healthy)',
            }}
          />
          <span
            className="text-3xl font-bold tracking-tight"
            style={{ color: 'var(--ink)' }}
          >
            LiveInfra
          </span>
        </div>

        {/* Tagline */}
        <div className="flex flex-col gap-2">
          <p className="text-lg font-medium" style={{ color: 'var(--ink-muted)' }}>
            AWS infrastructure dependency graph
          </p>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-subtle)' }}>
            Agentless. AI-native root cause analysis. Blast radius visualization.
            <br />
            Understand your infra before it fails.
          </p>
        </div>

        {/* Feature pills */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          {['Agentless', 'Real-time graph', 'RCA in seconds', 'Blast radius', 'Claude-powered'].map(
            (feat) => (
              <span
                key={feat}
                className="text-xs px-3 py-1 rounded-full"
                style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--hairline)',
                  color: 'var(--ink-muted)',
                }}
              >
                {feat}
              </span>
            )
          )}
        </div>

        {/* CTA buttons */}
        <div className="flex items-center gap-3">
          <SignUpButton mode="modal">
            <button
              className="px-5 py-2.5 rounded-md text-sm font-semibold transition-all duration-150 cursor-pointer"
              style={{
                background: 'var(--accent)',
                color: '#fff',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--accent-hover)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--accent)'
              }}
            >
              Get started free
            </button>
          </SignUpButton>

          <SignInButton mode="modal">
            <button
              className="px-5 py-2.5 rounded-md text-sm font-medium transition-all duration-150 cursor-pointer"
              style={{
                background: 'transparent',
                border: '1px solid var(--hairline)',
                color: 'var(--ink-muted)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--hairline-strong)'
                e.currentTarget.style.color = 'var(--ink)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--hairline)'
                e.currentTarget.style.color = 'var(--ink-muted)'
              }}
            >
              Sign in
            </button>
          </SignInButton>
        </div>

        {/* Social proof footer */}
        <p className="text-xs" style={{ color: 'var(--ink-subtle)' }}>
          Built in public &mdash; MIT-licensed scanner &mdash; No agents installed in your AWS account
        </p>
      </div>
    </main>
  )
}
