import { createClient } from '@supabase/supabase-js'
import neo4j from 'neo4j-driver'
import Anthropic from '@anthropic-ai/sdk'

const env = {
  SUPABASE_URL: process.env['SUPABASE_URL'] ?? '',
  SUPABASE_SERVICE_ROLE_KEY: process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '',
  NEO4J_URI: process.env['NEO4J_URI'] ?? '',
  NEO4J_USERNAME: process.env['NEO4J_USERNAME'] ?? 'neo4j',
  NEO4J_PASSWORD: process.env['NEO4J_PASSWORD'] ?? '',
  UPSTASH_REDIS_URL: process.env['UPSTASH_REDIS_URL'] ?? '',
  UPSTASH_REDIS_TOKEN: process.env['UPSTASH_REDIS_TOKEN'] ?? '',
  ANTHROPIC_API_KEY: process.env['ANTHROPIC_API_KEY'] ?? '',
  ANTHROPIC_MODEL: process.env['ANTHROPIC_MODEL'] ?? 'claude-sonnet-4-6',
  GEMINI_API_KEY: process.env['GEMINI_API_KEY'] ?? '',
  GEMINI_MODEL: process.env['GEMINI_MODEL'] ?? 'gemini-2.5-flash',
}

async function testSupabase(): Promise<string> {
  const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })
  const { error } = await sb.from('customers').select('id').limit(0)
  if (!error) return 'connected — schema present ✓'
  if (error.code === '42P01') return 'connected ⚠️  run migration (customers table missing)'
  throw new Error(error.message)
}

async function testNeo4j(): Promise<string> {
  const driver = neo4j.driver(
    env.NEO4J_URI,
    neo4j.auth.basic(env.NEO4J_USERNAME, env.NEO4J_PASSWORD)
  )
  const session = driver.session()
  try {
    const result = await session.run('RETURN 1 AS n')
    const n = result.records[0]?.get('n')?.toNumber()
    if (n !== 1) throw new Error('unexpected response from AuraDB')
    return 'connected — AuraDB responding'
  } finally {
    await session.close()
    await driver.close()
  }
}

async function testRedis(): Promise<string> {
  const res = await fetch(`${env.UPSTASH_REDIS_URL}/ping`, {
    headers: { Authorization: `Bearer ${env.UPSTASH_REDIS_TOKEN}` },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} ${await res.text()}`)
  const body = await res.json() as { result: string }
  return `connected — PONG: ${body.result}`
}

async function testAnthropic(): Promise<string> {
  if (!env.ANTHROPIC_API_KEY) return '⏭️  skipped — no API key set'
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })
  const msg = await client.messages.create({
    model: env.ANTHROPIC_MODEL,
    max_tokens: 8,
    messages: [{ role: 'user', content: 'Reply with just: pong' }],
  })
  const text = msg.content[0]?.type === 'text' ? msg.content[0].text.trim() : '?'
  return `connected — response: "${text}" (${msg.usage.input_tokens}+${msg.usage.output_tokens} tokens)`
}

async function testGemini(): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: 'Reply with just: pong' }] }] }),
    }
  )
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`)
  const body = await res.json() as { candidates: { content: { parts: { text: string }[] } }[] }
  const text = body.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '?'
  return `connected — response: "${text.slice(0, 40)}"`
}

const TESTS = [
  { name: 'Supabase', fn: testSupabase },
  { name: 'Neo4j AuraDB', fn: testNeo4j },
  { name: 'Upstash Redis', fn: testRedis },
  { name: 'Anthropic', fn: testAnthropic },
  { name: 'Gemini', fn: testGemini },
]

console.log('\n🔌  LiveInfra — Service Connectivity Test\n')

let failed = 0
for (const { name, fn } of TESTS) {
  try {
    const detail = await fn()
    const warn = detail.includes('⚠️')
    console.log(`${warn ? '⚠️ ' : '✅'} ${name.padEnd(16)} ${detail}`)
    if (warn) failed++
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`❌ ${name.padEnd(16)} ${msg}`)
    failed++
  }
}

console.log(
  `\n${failed === 0 ? '🎉  All services connected and ready!' : `⚠️   ${failed} service(s) need attention`}\n`
)
process.exit(failed > 0 ? 1 : 0)
