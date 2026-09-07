# Snck AI

A production-ready, multi-provider AI chat platform. First registered user becomes Owner; everyone after is a Standard User. The Owner dashboard manages encrypted provider keys, models, users, and token limits.

## Features

- Streaming chat (SSE) with conversation history, regenerate, and markdown
- Modular adapters: OpenAI-compatible, Anthropic, Gemini, OpenRouter, Custom
- Owner-only encrypted API keys (AES-256-GCM) stored in PostgreSQL
- Per-user daily / monthly / total token limits (null = unlimited)
- Owner dashboard: users, providers, models, usage, platform settings
- JWT cookie auth (`snck_session`, 7 days); Owner routes are backend-protected
- GitHub-ready: README, MIT license, `.env.example`, Docker

## Stack

Next.js 14 (App Router) · TypeScript · Tailwind · PostgreSQL 15 · Prisma · Framer Motion · Zustand · SSE streaming

## Quick start (local)

### Requirements

- Node.js 20+
- PostgreSQL 15

### 1. Install

```bash
npm install
cp .env.example .env
```

### 2. Configure `.env`

```bash
# Generate secrets
openssl rand -base64 32
openssl rand -hex 32
```

Set at least:

- `DATABASE_URL` — PostgreSQL connection string
- `AUTH_SECRET` — session signing secret
- `ENCRYPTION_KEY` — 32-byte hex key for provider API keys
- `APP_URL` — public origin, e.g. `http://localhost:3000`

### 3. Database

```bash
npx prisma migrate deploy
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Register the first account — that user is the Owner.

### 4. Add a provider

1. Sign in as Owner → Admin → Providers
2. Add an OpenAI-compatible, Anthropic, Gemini, OpenRouter, or Custom endpoint
3. Test the connection, then enable models for Standard Users

### Local mock provider (no real API keys)

```bash
npm run mock:provider
```

Add a Custom provider with base URL `http://localhost:4500` and any API key.

## Docker

Compose reads `AUTH_SECRET`, `ENCRYPTION_KEY`, `DB_PASSWORD`, `PORT`,
`APP_URL`, and `RATE_LIMIT_MAX` from your environment or a `.env` file next to
`docker-compose.yml`.

```bash
# Set AUTH_SECRET and ENCRYPTION_KEY in the environment or a .env file
docker compose up --build
```

App: `http://localhost:3000` · Postgres: bound to `127.0.0.1:5432` (host only, not exposed publicly)

## One-command Ubuntu VPS install

Run this on a fresh Ubuntu VPS (root or sudo). It installs Docker + Compose,
clones the repo to `/opt/snck-ai`, generates random secrets, and starts the
full stack (Postgres + app).

```bash
curl -fsSL https://raw.githubusercontent.com/SnckBoy/snck-ai/main/install.sh | sudo bash
```

Optional overrides (prefix to the command):

| Variable | Default |
| --- | --- |
| `SNCK_DIR` | `/opt/snck-ai` |
| `SNCK_PORT` | `3000` |
| `SNCK_APP_URL` | `http://<public-ip>:<port>` |
| `SNCK_DB_PASSWORD` | random |
| `SNCK_AUTH_SECRET` | random |
| `SNCK_ENCRYPTION_KEY` | random |

Example with a custom port and URL:

```bash
SNCK_PORT=8080 SNCK_APP_URL=https://chat.example.com \
  curl -fsSL https://raw.githubusercontent.com/SnckBoy/snck-ai/main/install.sh | sudo bash
```

After it finishes, visit the printed URL and register the first account — that
user is the Owner. A **demo mock provider with three models** is seeded
automatically when the Owner registers, so you can start chatting immediately
with no API keys. Set `SEED_DEMO_PROVIDER=false` to disable seeding. Re-running
the same command updates Snck AI in place.

GitHub Actions CI validates the installer scripts, Compose file, TypeScript
build, and Docker image on every push to `main` (see `.github/workflows/ci.yml`).

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Next.js development server |
| `npm run build` | Prisma generate + production build |
| `npm start` | Production server |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:migrate` | Prisma migrate (dev) |
| `npm run db:migrate:deploy` | Prisma migrate (deploy) |
| `npm run mock:provider` | Local OpenAI-compatible mock on `:4500` |

## Auth model

- First registration creates the Owner
- Later registrations are Standard Users (`USER`)
- Owner APIs (`/api/admin/*`) require an Owner session on the server
- Standard Users cannot see or set provider keys

## Token limits

- `null` on a limit field means unlimited for that window
- Owner is unlimited by default
- Counters live on `User` plus per-request `UsageRecord`
- Exceeding a limit returns HTTP 429 from chat

## Security

- Provider API keys encrypted at rest with AES-256-GCM
- Passwords hashed with bcryptjs
- Sessions are signed JWTs in an HTTP-only cookie
- Never commit `.env`

## License

MIT — see `LICENSE`.
