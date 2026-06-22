import { initTRPC, TRPCError } from '@trpc/server'
import type { CreateFastifyContextOptions } from '@trpc/server/adapters/fastify'
import { verifyToken } from '@clerk/backend'
import { env } from '../lib/env.js'

// ── Context ──────────────────────────────────────────────────────────────────

export interface TRPCContext {
  clerkUserId: string | null
}

/**
 * Extract and verify the Clerk session JWT from the Authorization header.
 * Returns { clerkUserId: null } for any missing or invalid token so that
 * publicProcedures continue to work — authedProcedure is responsible for
 * rejecting unauthenticated callers.
 */
export async function createContext({ req }: CreateFastifyContextOptions): Promise<TRPCContext> {
  const authHeader = req.headers['authorization']

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { clerkUserId: null }
  }

  const token = authHeader.slice(7) // strip "Bearer "

  try {
    const payload = await verifyToken(token, { secretKey: env.CLERK_SECRET_KEY })
    return { clerkUserId: payload.sub }
  } catch {
    // Invalid or expired token — treat as unauthenticated
    return { clerkUserId: null }
  }
}

// ── tRPC initialisation ───────────────────────────────────────────────────────

const t = initTRPC.context<TRPCContext>().create()

export const router = t.router

/** Unauthenticated procedure — accessible without a session token. */
export const publicProcedure = t.procedure

/** Authenticated procedure — throws UNAUTHORIZED when no valid Clerk session is present. */
export const authedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.clerkUserId) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'A valid Clerk session token is required.',
    })
  }
  return next({ ctx: { ...ctx, clerkUserId: ctx.clerkUserId } })
})
