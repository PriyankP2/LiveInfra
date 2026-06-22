/**
 * One-off scan trigger script.
 * Usage: node --env-file .env --import tsx scripts/trigger-scan.ts
 *
 * Auto-discovers all enabled regions in the target account then scans them.
 * To restrict to specific regions, set REGIONS below to a non-empty array.
 */

import { EC2Client, DescribeRegionsCommand } from '@aws-sdk/client-ec2'
import { assumeRole } from '../src/scanner/assume-role.js'
import { scanAccount } from '../src/scanner/index.js'

// ── Configure these ────────────────────────────────────────────────────────
const ROLE_ARN    = 'arn:aws:iam::975050024946:role/LiveInfraScanner'
const EXTERNAL_ID = 'liveinfra-dev-001'
const ACCOUNT_ID  = '975050024946'

// Leave empty to auto-discover all enabled regions, or pin specific ones:
// const REGIONS = ['us-east-1', 'us-west-2']
const REGIONS: string[] = []
// ──────────────────────────────────────────────────────────────────────────

console.log('\n🔍  LiveInfra — Manual Scan Trigger\n')
console.log(`   Account : ${ACCOUNT_ID}`)
console.log(`   Role    : ${ROLE_ARN}`)

// Step 1: Assume the cross-account role to get temporary credentials
const credentials = await assumeRole(ROLE_ARN, EXTERNAL_ID, 'LiveInfraRegionDiscover')

// Common AWS regions — used as fallback when DescribeRegions is not permitted
const COMMON_REGIONS = [
  'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
  'ca-central-1',
  'eu-west-1', 'eu-west-2', 'eu-west-3', 'eu-central-1', 'eu-north-1', 'eu-south-1',
  'ap-northeast-1', 'ap-northeast-2', 'ap-northeast-3',
  'ap-southeast-1', 'ap-southeast-2',
  'ap-south-1', 'ap-east-1',
  'sa-east-1',
  'me-south-1', 'af-south-1',
]

// Step 2: Discover all regions enabled for this account (or use pinned list)
let regions: string[]
if (REGIONS.length > 0) {
  regions = REGIONS
  console.log(`   Regions : ${regions.join(', ')} (pinned)`)
} else {
  try {
    const ec2 = new EC2Client({
      region: 'us-east-1',
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
        sessionToken: credentials.sessionToken,
      },
    })
    const res = await ec2.send(new DescribeRegionsCommand({ AllRegions: false }))
    regions = (res.Regions ?? [])
      .map((r) => r.RegionName)
      .filter((r): r is string => !!r)
      .sort()
    console.log(`   Regions : ${regions.length} discovered — ${regions.join(', ')}`)
  } catch (err) {
    // ec2:DescribeRegions not in IAM policy — fall back to common region list
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('not authorized') || msg.includes('UnauthorizedOperation')) {
      regions = COMMON_REGIONS
      console.log(`   Regions : ${regions.length} (DescribeRegions not permitted — using common list)`)
      console.log(`            Add ec2:DescribeRegions to the LiveInfraScanner IAM role for auto-discovery`)
    } else {
      throw err
    }
  }
}

console.log('\nScanning… (this may take a minute for many regions)\n')

const start = Date.now()
const result = await scanAccount({
  customerId: 'demo',
  accountId: ACCOUNT_ID,
  roleArn: ROLE_ARN,
  externalId: EXTERNAL_ID,
  regions,
})
const durationMs = Date.now() - start

console.log(`\n✅  Scan complete — status: ${result.status}`)
console.log(`   Nodes    : ${result.totalNodes}`)
console.log(`   Edges    : ${result.totalEdges}`)
console.log(`   Duration : ${Math.round(durationMs / 1000)}s across ${regions.length} region(s)`)

// Per-region summary
const maxNodes = Math.max(...result.regions.map((r) => r.nodeCount), 1)
console.log('\n   Per-region breakdown:')
for (const r of result.regions) {
  const bar = '█'.repeat(Math.round((r.nodeCount / maxNodes) * 20)).padEnd(20)
  const status = r.errors.length > 0 ? '⚠' : r.nodeCount > 0 ? '✓' : '○'
  console.log(`   ${status} ${r.region.padEnd(20)} ${String(r.nodeCount).padStart(4)} nodes  ${bar}`)
  for (const e of r.errors) console.log(`       ↳ ${e}`)
}

console.log('\nRefresh the dashboard at http://localhost:3000/dashboard to see the graph.\n')
