'use client'

import { useState } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { httpLink } from '@trpc/client'
import { trpc, makeQueryClient } from '@/lib/trpc'

interface ProvidersProps {
  children: React.ReactNode
}

export default function Providers({ children }: ProvidersProps) {
  // Create clients once per component instance (not at module level) so each
  // page gets its own cache — required for RSC + SSR compat.
  const [queryClient] = useState(() => makeQueryClient())
  const [trpcClientInstance] = useState(() =>
    trpc.createClient({
      links: [
        httpLink({
          url: `${process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000'}/trpc`,
        }),
      ],
    })
  )

  return (
    <trpc.Provider client={trpcClientInstance} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  )
}
