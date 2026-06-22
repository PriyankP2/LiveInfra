import { ClerkProvider, SignInButton, SignUpButton, SignedIn, SignedOut, UserButton } from '@clerk/nextjs'
import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'LiveInfra — AWS Infrastructure Analyzer',
  description:
    'Agentless AWS dependency graph with AI-native root cause analysis and blast radius visualization.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-[#0a0e1a] text-[#f1f5f9]">
        <ClerkProvider>
          <header className="flex items-center justify-between px-6 py-3 border-b border-[#1e2a3a]">
            <span className="text-sm font-semibold tracking-wide text-[#38bdf8]">LiveInfra</span>
            <div className="flex items-center gap-3">
              <SignedOut>
                <SignInButton mode="modal">
                  <button className="text-sm px-3 py-1.5 rounded border border-[#1e2a3a] text-[#94a3b8] hover:text-[#f1f5f9] hover:border-[#38bdf8] transition-colors">
                    Sign in
                  </button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <button className="text-sm px-3 py-1.5 rounded bg-[#38bdf8] text-[#0a0e1a] font-medium hover:bg-[#7dd3fc] transition-colors">
                    Sign up
                  </button>
                </SignUpButton>
              </SignedOut>
              <SignedIn>
                <UserButton afterSignOutUrl="/" />
              </SignedIn>
            </div>
          </header>
          {children}
        </ClerkProvider>
      </body>
    </html>
  )
}