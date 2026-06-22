import { ClerkProvider } from '@clerk/nextjs'
import type { Metadata } from 'next'
import { Geist, Geist_Mono, Space_Grotesk } from 'next/font/google'
import './globals.css'
import Providers from './providers'
import Sidebar from '@/components/layout/Sidebar'
import CommandPalette from '@/components/layout/CommandPalette'
import AutoRcaToast from '@/components/layout/AutoRcaToast'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'], display: 'swap' })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'], display: 'swap' })
const spaceGrotesk = Space_Grotesk({
  variable: '--font-space-grotesk',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'LiveInfra — AWS Infrastructure Analyzer',
  description:
    'Agentless AWS dependency graph with AI-native root cause analysis and blast radius visualization.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${spaceGrotesk.variable} h-full antialiased`}
    >
      <body className="h-full flex" style={{ background: 'var(--canvas)', color: 'var(--ink)' }}>
        <ClerkProvider>
          <Providers>
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
              {children}
            </div>
            <CommandPalette />
            <AutoRcaToast />
          </Providers>
        </ClerkProvider>
      </body>
    </html>
  )
}
