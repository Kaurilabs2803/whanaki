# Whānaki — NZ Knowledge AI

> AI that actually knows New Zealand. Your data never leaves the country.

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, Clerk v6, Tailwind CSS |
| Backend | Python FastAPI, SQLAlchemy async |
| LLM | Ollama (local, self-hosted) |
| RAG | RAGFlow |
| Database | PostgreSQL 15 |
| Cache | Redis 7 |
| Auth | Clerk |
| Billing | Stripe |
| Hosting | DigitalOcean (Sydney region) |

---

## Production Deployment

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for the complete production setup guide.

**Quick summary:**
1. Run the one-command server setup script on a DigitalOcean droplet
2. Add 3 GitHub Secrets (`DO_PRODUCTION_IP`, `DO_SSH_USER`, `DO_SSH_KEY`)
3. Push to `main` — it deploys automatically to `https://whanaki.kaurilabs.kiwi`

---

## Local Development Setup

### 1. Prerequisites

- Docker Desktop
- Node.js 20+
- Python 3.12+
- A Clerk account (free) → https://clerk.com
- A Stripe account (test mode) → https://stripe.com

### 2. Clone and configure

```bash
git clone <repo>
cd whanaki
cp .env.example .env
```

Fill in `.env`:
- `CLERK_SECRET_KEY` and `CLERK_PUBLISHABLE_KEY` from Clerk dashboard
- `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` from Stripe dashboard
- Leave everything else as-is for local dev

### 3. Start all services

```bash
docker compose up -d
```

This starts:
- PostgreSQL (port 5432) — schema auto-applied from `infra/postgres/init.sql`
- Redis (port 6379)
- Ollama (port 11434)
- RAGFlow + Elasticsearch + Infinity
- FastAPI backend (port 8000)
- Next.js frontend (port 3000)
- Nginx reverse proxy (port 80)

### 4. Pull a model into Ollama

```bash
# Fast model for dev (small, runs on CPU)
docker exec whanaki-ollama-1 ollama pull llama3.2:3b

# Balanced model (requires 8GB+ RAM)
docker exec whanaki-ollama-1 ollama pull llama3.1:8b
```

Wait for the pull to complete before testing chat.

### 5. Verify everything is healthy

```bash
curl http://localhost:8000/health
```

Expected response:
```json
{
  "status": "ok",
  "services": {
    "postgres": {"status": "ok", "latency_ms": 1.2},
    "redis":    {"status": "ok", "latency_ms": 0.8},
    "ollama":   {"status": "ok", "detail": "Models: llama3.2:3b"},
    "ragflow":  {"status": "ok", "latency_ms": 45.0}
  }
}
```

### 6. Open the app

Visit http://localhost:3000

Sign up via Clerk → you'll be redirected to `/onboarding` → fill in org name → land on dashboard.

---

## Development

### Backend (FastAPI)

```bash
cd backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Run locally (outside Docker, against Docker services)
uvicorn app.main:app --reload --port 8000
```

API docs available at http://localhost:8000/docs (dev mode only)

### Frontend (Next.js)

```bash
cd frontend
npm install
npm run dev
```

### Database migrations

We use Alembic. To generate a new migration after changing models:

```bash
cd backend
alembic revision --autogenerate -m "describe your change"
alembic upgrade head
```

---

## Project structure

```
whanaki/
├── backend/
│   ├── app/
│   │   ├── api/routes/        # FastAPI route handlers
│   │   │   ├── health.py      # /health, /ping
│   │   │   ├── auth.py        # /v1/onboard, /v1/me
│   │   │   ├── billing.py     # /v1/billing/*
│   │   │   └── models.py      # /v1/models
│   │   ├── core/
│   │   │   ├── config.py      # Pydantic settings
│   │   │   └── auth.py        # Clerk JWT verification
│   │   ├── db/
│   │   │   └── session.py     # SQLAlchemy async engine
│   │   ├── models/            # SQLAlchemy ORM models
│   │   └── schemas/           # Pydantic request/response schemas
│   ├── requirements.txt
│   └── Dockerfile
│
├── frontend/
│   └── src/
│       ├── app/
│       │   ├── layout.tsx     # ClerkProvider root
│       │   ├── page.tsx       # Landing page
│       │   ├── onboarding/    # First-time setup
│       │   └── dashboard/     # Main app (Phase 2 expands this)
│       ├── middleware.ts      # Clerk route protection
│       └── globals.css        # Brand tokens + Tailwind
│
├── infra/
│   ├── cloud-init/ollama.sh   # GPU droplet bootstrap
│   ├── nginx/
│   │   ├── dev.conf           # Local reverse proxy
│   │   └── prod.conf          # Production nginx config (template)
│   ├── postgres/init.sql      # Full DB schema
│   ├── scripts/
│   │   └── setup-server.sh    # One-command server setup
│   └── vector/vector.toml     # Log aggregation config
│
├── docker-compose.yml
└── .env.example
```

---

## Phase 2 — what's next

- `OllamaClient` — streaming inference with GPU queue
- `RAGFlowClient` — document ingest + hybrid retrieval
- `RAGFlowOllamaPipeline` — full query pipeline
- Document upload API + DO Spaces storage
- Chat API with SSE streaming
- Citation extraction and linking
- Full chat UI with model selector and citation panel

## Phase 3 — Frontend

- Complete chat interface (streaming, citations, history)
- Document management UI
- Usage dashboard

## Phase 4 — Tenancy + billing

- Multi-tenant quota enforcement middleware
- Usage dashboard (per tenant)
- Stripe metered billing for overages

## Phase 5 — DigitalOcean deployment

- GPU droplet cloud-init script
- Terraform infra-as-code
- SSL + domain configuration
- Monitoring + alerting runbooks

---

## Stripe test webhooks (local)

```bash
# Install Stripe CLI
stripe listen --forward-to localhost:8000/v1/billing/webhook

# Test a subscription event
stripe trigger checkout.session.completed
```

---

## Key conventions (same as other Kauri Labs products)

- `await auth()` for all protected Clerk routes
- `middleware.ts` (not `middleware.js`) for route matching
- `await headers()` in Next.js 15 server components when needed
- `try/catch` on all Supabase/DB queries
- Stripe apiVersion `'2024-04-10'`
- `'use client'` on any component with event handlers
- Never commit `.env` — always use `.env.example`
