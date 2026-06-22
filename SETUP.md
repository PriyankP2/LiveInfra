# LiveInfra — Server Setup Guide

## Node.js equivalent of `pip install -r requirements.txt`

```bash
pnpm install
```

That single command at the monorepo root installs every dependency across all
workspaces (`apps/web`, `apps/api`, `packages/shared`, `packages/tsconfig`) at
the exact locked versions from `pnpm-lock.yaml`. It is the Node equivalent of
`pip install -r requirements.txt`.

For production (no devDependencies, frozen lockfile — never updates versions):
```bash
pnpm install --frozen-lockfile --prod
```

---

## Fresh server setup (step by step)

### 1. System prerequisites

```bash
# Node.js 20+ LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# pnpm
npm install -g pnpm

# Verify
node -v   # v20.x.x
pnpm -v   # 9.x.x
```

### 2. Clone and install

```bash
git clone https://github.com/PriyankP2/LiveInfra.git
cd LiveInfra
pnpm install          # installs all workspaces
```

### 3. Environment variables

Copy the example and fill in real values:
```bash
cp .env.example apps/api/.env
```

Required values in `apps/api/.env`:

| Variable | Where to get it |
|----------|----------------|
| `NEO4J_URI` | Neo4j AuraDB console → Connect |
| `NEO4J_USERNAME` | Neo4j AuraDB console |
| `NEO4J_PASSWORD` | Neo4j AuraDB console |
| `SUPABASE_URL` | Supabase dashboard → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase dashboard → Settings → API |
| `UPSTASH_REDIS_URL` | Upstash console → REST API |
| `UPSTASH_REDIS_TOKEN` | Upstash console → REST API |
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys |
| `ANTHROPIC_MODEL` | e.g. `claude-sonnet-4-6` |
| `GEMINI_API_KEY` | aistudio.google.com → Get API key |
| `GEMINI_MODEL` | e.g. `gemini-2.5-flash` |
| `CLERK_SECRET_KEY` | dashboard.clerk.com → API Keys |
| `CLERK_PUBLISHABLE_KEY` | dashboard.clerk.com → API Keys |

Required values in `apps/web/.env.local`:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Same as above |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000` (dev) or your Railway URL (prod) |

### 4. Run database migration

Open the Supabase SQL editor and run the contents of:
```
supabase/migrations/001_initial_schema.sql
```

### 5. Verify all service connections

```bash
pnpm --filter @liveinfra/api test:connections
```

All 4 active services (Supabase, Neo4j, Upstash Redis, Gemini) should show ✅.

### 6. Start development servers

```bash
# Terminal 1 — API (port 4000)
pnpm --filter @liveinfra/api dev

# Terminal 2 — Web (port 3000)
pnpm --filter @liveinfra/web dev
```

Open http://localhost:3000

---

## Production build

```bash
# Build API
pnpm --filter @liveinfra/api build

# Build web
pnpm --filter @liveinfra/web build

# Start API (after build)
pnpm --filter @liveinfra/api start

# Start web (after build)
pnpm --filter @liveinfra/web start
```

## External services required

| Service | Purpose | Free tier |
|---------|---------|-----------|
| Neo4j AuraDB | Graph database (nodes + edges) | ✅ Free |
| Supabase | PostgreSQL + Auth + Realtime | ✅ Free |
| Upstash Redis | Job queue / caching | ✅ Free |
| Clerk | Authentication | ✅ Free up to 10k MAU |
| Anthropic | AI RCA (primary) | Pay per token |
| Google Gemini | AI RCA (fallback) | ✅ Free tier |
| Vercel | Web hosting | ✅ Free |
| Railway | API hosting | $5/month |
