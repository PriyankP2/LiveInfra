import { ClerkProvider } from '@clerk/nextjs'
import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import Providers from './providers'
import Sidebar from '@/components/layout/Sidebar'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'LiveInfra — AWS Infrastructure Analyzer',
  description:
    'Agentless AWS dependency graph with AI-native root cause analysis and blast radius visualization.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="h-full flex" style={{ background: 'var(--canvas)', color: 'var(--ink)' }}>
        <ClerkProvider>
          <Providers>
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
              {children}
            </div>
          </Providers>
        </ClerkProvider>
      </body>
    </html>
  )
}
