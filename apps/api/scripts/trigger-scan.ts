/**
 * One-off scan trigger script.
 * Usage: tsx --env-file .env scripts/trigger-scan.ts
 *
 * Fill in the four variables below before running.
 */

import { scanAccount } from '../src/scanner/index.js'

// ── Configure these ────────────────────────────────────────────────────────
const ROLE_ARN   = 'arn:aws:iam::975050024946:role/LiveInfraScanner'
const EXTERNAL_ID = 'liveinfra-dev-001'   // must match what you put in CloudFormation
const ACCOUNT_ID  = '975050024946'
const REGIONS     = ['us-east-1']         // add more regions if needed
// ──────────────────────────────────────────────────────────────────────────

if (ROLE_ARN.includes('YOUR_ACCOUNT_ID')) {
  console.error('❌  Fill in ROLE_ARN and ACCOUNT_ID before running this script.')
  process.exit(1)
}

console.log('\n🔍  LiveInfra — Manual Scan Trigger\n')
console.log(`   Account : ${ACCOUNT_ID}`)
console.log(`   Role    : ${ROLE_ARN}`)
console.log(`   Regions : ${REGIONS.join(', ')}`)
console.log('\nScanning… (this may take 30–60 seconds)\n')

const result = await scanAccount({
  customerId: 'demo',
  accountId: ACCOUNT_ID,
  roleArn: ROLE_ARN,
  externalId: EXTERNAL_ID,
  regions: REGIONS,
})

console.log(`\n✅  Scan complete — status: ${result.status}`)
console.log(`   Nodes   : ${result.totalNodes}`)
console.log(`   Edges   : ${result.totalEdges}`)
console.log(`   Duration: ${Math.round((new Date(result.completedAt).getTime() - new Date(result.startedAt).getTime()) / 1000)}s`)

if (result.regions.some(r => r.errors.length > 0)) {
  console.log('\nPer-region errors:')
  for (const r of result.regions) {
    if (r.errors.length > 0) {
      console.log(`   ${r.region}: ${r.errors.join(' | ')}`)
    }
  }
}

console.log('\nRefresh the dashboard at http://localhost:3000/dashboard to see the graph.\n')
