'use client'

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { QueryClientProvider } from '@tanstack/react-query'
import { httpLink } from '@trpc/client'
import { trpc, makeQueryClient } from '@/lib/trpc'

interface ProvidersProps {
  children: React.ReactNode
}

export default function Providers({ children }: ProvidersProps) {
  const { getToken } = useAuth()
  const [queryClient] = useState(() => makeQueryClient())

  // Keep a stable ref to getToken so the httpLink headers factory always
  // captures the latest value without recreating the tRPC client.
  const getTokenRef = useRef(getToken)
  useEffect(() => { getTokenRef.current = getToken }, [getToken])

  const [trpcClientInstance] = useState(() =>
    trpc.createClient({
      links: [
        httpLink({
          url: `${process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000'}/trpc`,
          async headers() {
            const token = await getTokenRef.current()
            return token ? { Authorization: `Bearer ${token}` } : {}
          },
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
