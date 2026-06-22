import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts'
import { router, publicProcedure } from './init.js'
import { supabase } from '../lib/supabase.js'
import { assumeRole } from '../scanner/assume-role.js'

const ALL_REGIONS = [
  'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2', 'ca-central-1',
  'eu-west-1', 'eu-west-2', 'eu-central-1', 'eu-north-1',
  'ap-northeast-1', 'ap-northeast-2', 'ap-southeast-1', 'ap-southeast-2', 'ap-south-1',
  'sa-east-1',
]

// Resolve or create the Supabase customer row for a given Clerk user ID.
// Returns the customer's UUID primary key.
export async function resolveCustomerId(clerkUserId: string, email?: string): Promise<string> {
  const { data, error } = await supabase
    .from('customers')
    .select('id')
    .eq('clerk_user_id', clerkUserId)
    .single()

  if (data) return data.id as string

  if (error && error.code !== 'PGRST116') {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Customer lookup failed: ${error.message}` })
  }

  // Not found — create
  const { data: created, error: createErr } = await supabase
    .from('customers')
    .insert({ clerk_user_id: clerkUserId, email: email ?? `${clerkUserId}@unknown.local` })
    .select('id')
    .single()

  if (createErr || !created) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Failed to create customer: ${createErr?.message}` })
  }

  return created.id as string
}

export const accountsRouter = router({
  // ── List all AWS accounts for a customer ────────────────────────────────────
  list: publicProcedure
    .input(z.object({ customerId: z.string() }))
    .query(async ({ input }) => {
      const { data, error } = await supabase
        .from('aws_accounts')
        .select('*')
        .eq('customer_id', input.customerId)
        .order('created_at', { ascending: false })

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })

      return {
        accounts: (data ?? []).map((row) => ({
          id:                   String(row['id'] ?? ''),
          accountId:            String(row['account_id'] ?? ''),
          accountAlias:         row['account_alias'] ? String(row['account_alias']) : undefined,
          roleArn:              String(row['role_arn'] ?? ''),
          externalId:           String(row['external_id'] ?? 'liveinfra'),
          regions:              (row['regions'] as string[]) ?? [],
          status:               String(row['status'] ?? 'pending') as 'pending' | 'active' | 'error' | 'disconnected',
          lastScanAt:           row['last_scan_at'] ? String(row['last_scan_at']) : null,
          lastScanDurationSec:  row['last_scan_duration_sec'] ? Number(row['last_scan_duration_sec']) : null,
          lastScanResourceCount: row['last_scan_resource_count'] ? Number(row['last_scan_resource_count']) : null,
          lastError:            row['last_error'] ? String(row['last_error']) : null,
          createdAt:            String(row['created_at'] ?? ''),
        })),
      }
    }),

  // ── Validate a Role ARN by attempting STS AssumeRole ────────────────────────
  validate: publicProcedure
    .input(z.object({
      roleArn:    z.string().min(20),
      externalId: z.string().default('liveinfra'),
      accountId:  z.string().optional(),  // expected account ID for cross-check
    }))
    .mutation(async ({ input }) => {
      try {
        const creds = await assumeRole(input.roleArn, input.externalId, 'LiveInfraValidate')

        // Confirm the resolved account ID via GetCallerIdentity
        const sts = new STSClient({
          region: 'us-east-1',
          credentials: {
            accessKeyId:     creds.accessKeyId,
            secretAccessKey: creds.secretAccessKey,
            sessionToken:    creds.sessionToken,
          },
        })
        const identity = await sts.send(new GetCallerIdentityCommand({}))
        const resolvedAccountId = identity.Account ?? ''

        // Account alias requires ListAccountAliases IAM permission — try, don't fail if missing
        const accountAlias: string | undefined = undefined

        // Cross-check account ID if the user told us what to expect
        if (input.accountId && resolvedAccountId && input.accountId !== resolvedAccountId) {
          return {
            valid: false,
            error: `Role ARN resolved to account ${resolvedAccountId} but you entered ${input.accountId}. Check the role ARN.`,
          }
        }

        return { valid: true, resolvedAccountId, accountAlias }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        return { valid: false, error: msg }
      }
    }),

  // ── Add a new AWS account ────────────────────────────────────────────────────
  add: publicProcedure
    .input(z.object({
      customerId:   z.string(),
      accountId:    z.string().regex(/^\d{12}$/, 'Must be a 12-digit AWS account ID'),
      accountAlias: z.string().optional(),
      roleArn:      z.string().min(20),
      externalId:   z.string().default('liveinfra'),
      regions:      z.array(z.string()).min(1).default(ALL_REGIONS),
    }))
    .mutation(async ({ input }) => {
      // Upsert — allow re-adding (update role ARN if already exists)
      const { data, error } = await supabase
        .from('aws_accounts')
        .upsert(
          {
            customer_id:   input.customerId,
            account_id:    input.accountId,
            account_alias: input.accountAlias ?? null,
            role_arn:      input.roleArn,
            external_id:   input.externalId,
            regions:       input.regions,
            status:        'pending',
          },
          { onConflict: 'customer_id,account_id' }
        )
        .select('id, account_id')
        .single()

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })

      return { id: String(data?.id ?? ''), accountId: String(data?.account_id ?? '') }
    }),

  // ── Delete an account ────────────────────────────────────────────────────────
  delete: publicProcedure
    .input(z.object({ customerId: z.string(), id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const { error } = await supabase
        .from('aws_accounts')
        .delete()
        .eq('id', input.id)
        .eq('customer_id', input.customerId)

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })

      return { deleted: true }
    }),

  // ── Update account status (used by scanner after completion) ─────────────────
  updateStatus: publicProcedure
    .input(z.object({
      customerId:    z.string(),
      accountId:     z.string(),
      status:        z.enum(['pending', 'active', 'error', 'disconnected']),
      resourceCount: z.number().optional(),
      durationSec:   z.number().optional(),
      errorMessage:  z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const update: Record<string, unknown> = {
        status:     input.status,
        updated_at: new Date().toISOString(),
      }
      if (input.status === 'active') {
        update['last_scan_at'] = new Date().toISOString()
        if (input.resourceCount !== undefined) update['last_scan_resource_count'] = input.resourceCount
        if (input.durationSec  !== undefined) update['last_scan_duration_sec']   = input.durationSec
        update['last_error'] = null
      }
      if (input.status === 'error' && input.errorMessage) {
        update['last_error'] = input.errorMessage
      }

      const { error } = await supabase
        .from('aws_accounts')
        .update(update)
        .eq('customer_id', input.customerId)
        .eq('account_id',  input.accountId)

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })

      return { updated: true }
    }),

  // ── Scan history (from graph_snapshots) ──────────────────────────────────────
  scanHistory: publicProcedure
    .input(z.object({ customerId: z.string(), limit: z.number().min(1).max(100).default(25) }))
    .query(async ({ input }) => {
      const { data, error } = await supabase
        .from('graph_snapshots')
        .select('*')
        .eq('customer_id', input.customerId)
        .order('snapshot_at', { ascending: false })
        .limit(input.limit)

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })

      // Also fetch account aliases for display
      const { data: accountRows } = await supabase
        .from('aws_accounts')
        .select('account_id, account_alias')
        .eq('customer_id', input.customerId)

      const aliasMap = new Map<string, string>()
      for (const row of accountRows ?? []) {
        if (row['account_alias']) aliasMap.set(String(row['account_id']), String(row['account_alias']))
      }

      return {
        scans: (data ?? []).map((row) => ({
          id:           String(row['id'] ?? ''),
          accountId:    String(row['account_id'] ?? ''),
          accountAlias: aliasMap.get(String(row['account_id'] ?? '')),
          snapshotAt:   String(row['snapshot_at'] ?? ''),
          nodeCount:    Number(row['node_count'] ?? 0),
          edgeCount:    Number(row['edge_count'] ?? 0),
          durationSec:  row['scan_duration_sec'] ? Number(row['scan_duration_sec']) : null,
          status:       'completed' as const,
        })),
      }
    }),
})
