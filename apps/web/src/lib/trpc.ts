'use client'

import { createTRPCClient, httpLink } from '@trpc/client'
import { createTRPCReact, type CreateTRPCReact } from '@trpc/react-query'
import { QueryClient } from '@tanstack/react-query'
import type { AppRouter } from '../../../api/src/trpc/router'

// ── React-Query tRPC hooks (used in client components) ──────────────────────
// Explicit return type annotation avoids TS2742 (non-portable inferred type).
export const trpc: CreateTRPCReact<AppRouter, unknown> = createTRPCReact<AppRouter>()

// ── Vanilla tRPC client (used outside React, e.g. server actions) ───────────
export const trpcClient = createTRPCClient<AppRouter>({
  links: [
    httpLink({
      url: `${process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000'}/trpc`,
    }),
  ],
})

// ── QueryClient factory — one per request, never module-level ───────────────
// Avoids sharing cache between RSC renders.
export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // With SSR, data is fresh for 30s so we don't double-fetch on hydration
        staleTime: 30 * 1000,
        retry: 1,
      },
    },
  })
}
