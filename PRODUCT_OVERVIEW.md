# Whānaki — End-to-End Product Overview

## 1. What is Whānaki?

Whānaki is a New Zealand-focused AI knowledge assistant. It lets organisations create a private workspace, upload documents (PDFs, Word docs, text files), and chat with an AI that answers strictly from those documents — with inline citations.

Built for NZ professionals, it uses NZ English spelling, respects Māori terminology with macrons, and includes specialist prompt modes for tenancy law and tax.

---

## 2. High-Level Architecture

```
┌─────────────────┐      HTTPS       ┌──────────────────┐
│   User Browser  │ ◄──────────────► │  Nginx (SSL)     │
│   (Next.js UI)  │                  │  Reverse Proxy   │
└─────────────────┘                  └────────┬─────────┘
                                              │
                    ┌─────────────────────────┼─────────────────────────┐
                    │                         │                         │
            ┌───────▼────────┐      ┌────────▼────────┐      ┌────────▼────────┐
            │   Frontend     │      │   Backend × 2   │      │    RAGFlow      │
            │   Next.js 15   │      │   FastAPI       │      │   (Retrieval)   │
            │   Port 3000    │      │   Port 8000     │      │   Port 9380     │
            └────────────────┘      └────────┬────────┘      └─────────────────┘
                                             │
                    ┌────────────────────────┼────────────────────────┐
                    │                        │                        │
            ┌───────▼────────┐      ┌────────▼────────┐      ┌───────▼─────────┐
            │   PostgreSQL   │      │   Valkey/Redis  │      │   Ollama        │
            │   (Users,      │      │   (Sessions,    │      │   (Local LLM)   │
            │   chats, docs) │      │   rate limits)  │      │   Port 11434    │
            └────────────────┘      └─────────────────┘      └─────────────────┘
```

### Infrastructure Stack
- **Server**: Ubuntu 22.04 on DigitalOcean (Sydney)
- **Domains**: `whanaki.kaurilabs.kiwi` (frontend) + `api.whanaki.kaurilabs.kiwi` (API)
- **SSL**: Let's Encrypt via Certbot
- **Container Orchestration**: Docker Compose (production)
- **Database**: DigitalOcean Managed PostgreSQL (`+asyncpg`)
- **Cache**: DigitalOcean Managed Valkey (Redis-compatible)
- **LLM Hosting**: Ollama running on the same droplet
- **Document Retrieval**: RAGFlow + Elasticsearch + Infinity

---

## 3. Core User Flow

### Step 1 — Authentication (Clerk)
1. User clicks **Sign In / Sign Up** on the Next.js frontend
2. Clerk handles OAuth (Google, etc.) and returns a JWT
3. Frontend sends the JWT to the FastAPI backend on every request
4. Backend verifies the JWT using `PyJWT` + Clerk's public key
5. If valid, the backend identifies the user by `clerk_id`

### Step 2 — Onboarding (Workspace Creation)
1. After first sign-in, user enters an **organisation name** and **slug**
2. Frontend calls `POST /api/v1/onboard`
3. Backend creates:
   - A **Tenant** (workspace) in PostgreSQL
   - A **User** record linked to that tenant with `role = tenant_admin`
4. **RAGFlow dataset** (knowledge base) is provisioned if RAGFlow is healthy
   - If RAGFlow is temporarily down, workspace creation **still succeeds**
   - The dataset will be created lazily later when RAGFlow recovers
5. User is redirected to their dashboard

### Step 3 — Chat (The Main Feature)
1. User types a question and clicks **Send**
2. Frontend opens an SSE (Server-Sent Events) stream to `POST /api/v1/chat`
3. Backend:
   - Validates the user belongs to the workspace
   - Checks monthly query quota
   - Retrieves relevant document chunks from **RAGFlow** (if available)
   - Builds a system prompt with NZ guidelines + retrieved context
   - Streams tokens from **Ollama** (`llama3.1:8b` or `llama3.2:3b`)
   - Extracts inline citations (`[Doc: filename, p.N]`)
   - Saves both user and assistant messages to PostgreSQL
   - Logs token usage for billing
4. Frontend renders tokens as they arrive, then shows citations at the end

### Step 4 — Document Upload
1. User drags/drops a PDF or Word doc
2. Frontend calls `POST /api/v1/documents/upload`
3. Backend:
   - Validates file type and size (max 50 MB)
   - If RAGFlow is healthy: uploads to the tenant's RAGFlow dataset
   - If RAGFlow is down: stores metadata locally and marks status as `failed`
   - Creates a **Document** record in PostgreSQL
   - Triggers background ingest (chunking + embedding) if RAGFlow accepted the file
4. User polls `GET /api/v1/documents/{id}` for ingest status

---

## 4. How the Backend Pipeline Works

### The Query Pipeline (`services/pipeline.py`)

```
User Question
      │
      ▼
┌─────────────────┐
│  1. Retrieve    │ ◄── Query RAGFlow for top-k relevant chunks
│     from RAGFlow│     (falls back to empty context if RAGFlow down)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  2. Build Prompt│ ◄── Inject NZ system prompt + document context
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  3. Stream from │ ◄── Ollama generates tokens via async stream
│     Ollama      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  4. Extract     │ ◄── Parse [Doc: filename, p.N] citations
│     Citations   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  5. Store & Log │ ◄── Save messages + usage log atomically
└─────────────────┘
```

### Security Check: Document Filtering
- If the user selects specific documents to query, the backend **validates ownership** against the current tenant before passing UUIDs to RAGFlow
- This prevents cross-tenant data leakage

---

## 5. Database Schema (Core Tables)

| Table | Purpose |
|-------|---------|
| `tenants` | Workspaces (organisation name, slug, trial/quota) |
| `users` | Clerk-linked users with roles (super_admin, tenant_admin, editor, viewer) |
| `billing_events` | Stripe events for subscription tracking |
| `conversations` | Chat threads per user/tenant |
| `messages` | Individual chat messages (user + assistant) with citations |
| `documents` | Uploaded files with ingest status |
| `usage_logs` | Per-message token counts for quota enforcement |
| `ollama_models` | Available LLMs and their settings |

### Migrations
- Alembic manages schema changes
- The initial migration (`5ca49f4e115f`) creates all tables

---

## 6. Security Model

| Layer | Implementation |
|-------|----------------|
| **Auth** | Clerk JWT tokens, verified on every API call |
| **Role-based access** | `require_admin`, `require_editor`, `get_current_user` decorators |
| **Tenant isolation** | Every query is scoped to `current_user.tenant_id` |
| **Rate limiting** | Slowapi with Redis-backed per-endpoint limits |
| **Document ownership** | `_validate_doc_filter()` ensures cross-tenant document access is blocked |
| **Secrets** | All API keys, DB URLs, and passwords live in `.env` (never committed) |
| **SSL** | Nginx terminates HTTPS with Let's Encrypt certificates |

---

## 7. Resilience Design (RAGFlow Optional)

Because RAGFlow is a complex multi-service dependency (MySQL, Redis, Elasticsearch, Infinity), the backend is designed to **degrade gracefully**:

| Scenario | Behaviour |
|----------|-----------|
| RAGFlow down during onboarding | Workspace still created; dataset created later |
| RAGFlow down during chat | LLM answers from general knowledge; no crash |
| RAGFlow down during upload | File metadata stored locally; user can retry later |
| ES slow to start | Docker healthcheck ensures RAGFlow waits for ES |
| Ollama stream fails | `db.rollback()` prevents orphaned user messages |

This means **the app is always usable** even if the document retrieval stack is temporarily unavailable.

---

## 8. Deployment & Operations

### How code gets to production
1. Developer pushes to `main` on GitHub
2. GitHub Actions CI runs tests (35 passing)
3. GitHub Actions deploy workflow SSHs into the droplet
4. Pulls latest code, rebuilds backend/frontend, runs migrations, health-checks

### Running on the server
```bash
cd /opt/whanaki
docker compose -f docker-compose.prod.yml up -d --scale backend=2
```

### Useful commands
```bash
# Check all services
curl -s https://api.whanaki.kaurilabs.kiwi/health | python3 -m json.tool

# View backend logs
docker compose -f docker-compose.prod.yml logs backend --tail=50

# Run migrations
docker compose -f docker-compose.prod.yml exec backend alembic upgrade head

# Check Ollama models
ollama list
```

---

## 9. Current Status (As of latest deployment)

✅ **Frontend**: Live, SSL-secured, Clerk-integrated  
✅ **Backend**: 2 replicas, healthy, all critical bugs fixed  
✅ **Database**: Migrated, all tables created  
✅ **Auth**: Clerk JWT working, onboarding stable  
✅ **Chat**: Streaming works, citations extract correctly, atomic commits  
✅ **Documents**: Upload + status polling functional  
✅ **Ollama**: 3 models loaded (`llama3.1:8b`, `llama3.2:3b`, `nomic-embed-text`)  
✅ **RAGFlow**: Connected to Elasticsearch, knowledge base operational  

---

## 10. Technology Summary

| Layer | Tech |
|-------|------|
| Frontend | Next.js 15, React, TypeScript, Tailwind CSS, Clerk |
| Backend | Python 3.12, FastAPI, SQLAlchemy 2.x (async), Alembic, Pydantic v2 |
| AI/LLM | Ollama (local), RAGFlow (retrieval) |
| Database | PostgreSQL 15+ (managed) |
| Cache | Valkey/Redis (managed) |
| Infra | Docker, Docker Compose, Nginx, Ubuntu 22.04 |
| CI/CD | GitHub Actions |

---

*Document generated from live deployment session — reflects the actual production architecture of Whānaki.*
