-- ═══════════════════════════════════════════════════════════════════════════
-- WHĀNAKI — PostgreSQL Schema
-- ═══════════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- For full-text search on names

-- ── ENUMS ────────────────────────────────────────────────────────────────────

CREATE TYPE tenant_plan AS ENUM ('starter', 'professional', 'enterprise');
CREATE TYPE tenant_status AS ENUM ('active', 'suspended', 'cancelled');
CREATE TYPE user_role AS ENUM ('super_admin', 'tenant_admin', 'editor', 'viewer');
CREATE TYPE subscription_status AS ENUM ('active', 'past_due', 'cancelled', 'trialing');
CREATE TYPE document_status AS ENUM ('uploading', 'processing', 'ready', 'failed');
CREATE TYPE model_speed AS ENUM ('fast', 'balanced', 'thorough');

-- ── TENANTS ──────────────────────────────────────────────────────────────────

CREATE TABLE tenants (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            TEXT NOT NULL,
    slug            TEXT NOT NULL UNIQUE,          -- used in URLs: whanaki.kaurilabs.kiwi/t/{slug}
    plan            tenant_plan NOT NULL DEFAULT 'starter',
    status          tenant_status NOT NULL DEFAULT 'active',

    -- Stripe
    stripe_customer_id          TEXT UNIQUE,
    stripe_subscription_id      TEXT UNIQUE,
    subscription_status         subscription_status DEFAULT 'trialing',
    subscription_period_end     TIMESTAMPTZ,
    trial_ends_at               TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '14 days'),

    -- Usage limits (overridable per tenant)
    monthly_query_limit         INTEGER NOT NULL DEFAULT 200,   -- starter
    monthly_document_page_limit INTEGER NOT NULL DEFAULT 500,

    -- RAGFlow dataset ID for this tenant (set during onboarding)
    ragflow_dataset_id          TEXT,

    -- Branding (white-label)
    logo_url        TEXT,
    primary_color   TEXT DEFAULT '#0F6E56',        -- pounamu green

    -- Metadata
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tenants_slug ON tenants(slug);
CREATE INDEX idx_tenants_stripe_customer ON tenants(stripe_customer_id);

-- ── USERS ────────────────────────────────────────────────────────────────────

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clerk_id        TEXT NOT NULL UNIQUE,          -- Clerk user ID
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email           TEXT NOT NULL,
    full_name       TEXT,
    role            user_role NOT NULL DEFAULT 'viewer',
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    last_seen_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_clerk_id ON users(clerk_id);
CREATE INDEX idx_users_tenant_id ON users(tenant_id);
CREATE INDEX idx_users_email ON users(email);

-- ── DOCUMENTS ────────────────────────────────────────────────────────────────

CREATE TABLE documents (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    uploaded_by         UUID NOT NULL REFERENCES users(id),
    filename            TEXT NOT NULL,
    original_filename   TEXT NOT NULL,
    content_type        TEXT NOT NULL,
    size_bytes          BIGINT NOT NULL,
    page_count          INTEGER,
    status              document_status NOT NULL DEFAULT 'uploading',
    error_message       TEXT,

    -- DO Spaces storage key
    storage_key         TEXT NOT NULL,

    -- RAGFlow document ID (set after successful ingest)
    ragflow_doc_id      TEXT,

    -- Tags for filtering in RAG queries
    tags                TEXT[] DEFAULT '{}',

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_documents_tenant_id ON documents(tenant_id);
CREATE INDEX idx_documents_status ON documents(status);
CREATE INDEX idx_documents_tags ON documents USING GIN(tags);

-- ── CONVERSATIONS ─────────────────────────────────────────────────────────────

CREATE TABLE conversations (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title           TEXT,                          -- Auto-generated from first message
    default_model   TEXT NOT NULL DEFAULT 'llama3.1:8b',
    document_filter UUID[],                        -- Restrict RAG to specific docs
    message_count   INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_conversations_tenant_id ON conversations(tenant_id);
CREATE INDEX idx_conversations_user_id ON conversations(user_id);

-- ── MESSAGES ─────────────────────────────────────────────────────────────────

CREATE TABLE messages (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id     UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    role                TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content             TEXT NOT NULL,
    model_used          TEXT,                      -- NULL for user messages
    citations           JSONB DEFAULT '[]',        -- [{doc_id, page, section, text}]
    input_tokens        INTEGER,
    output_tokens       INTEGER,
    generation_ms       INTEGER,                   -- Time to generate in ms
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_tenant_id ON messages(tenant_id);

-- ── USAGE LOGS ────────────────────────────────────────────────────────────────
-- Fine-grained usage tracking for billing aggregation

CREATE TABLE usage_logs (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
    message_id      UUID REFERENCES messages(id) ON DELETE SET NULL,
    model           TEXT NOT NULL,
    input_tokens    INTEGER NOT NULL DEFAULT 0,
    output_tokens   INTEGER NOT NULL DEFAULT 0,
    gpu_seconds     NUMERIC(10, 3),               -- Estimated GPU time
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_usage_logs_tenant_id ON usage_logs(tenant_id);
CREATE INDEX idx_usage_logs_created_at ON usage_logs(created_at);
-- Composite for monthly billing queries
CREATE INDEX idx_usage_logs_tenant_month ON usage_logs(tenant_id, date_trunc('month', created_at));

-- ── BILLING EVENTS ────────────────────────────────────────────────────────────

CREATE TABLE billing_events (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    stripe_event_id     TEXT UNIQUE,
    event_type          TEXT NOT NULL,             -- invoice.paid, subscription.updated etc.
    amount_cents        INTEGER,
    currency            TEXT DEFAULT 'nzd',
    metadata            JSONB DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_billing_events_tenant_id ON billing_events(tenant_id);

-- ── MODELS REGISTRY ───────────────────────────────────────────────────────────
-- Tracks which Ollama models are available and their config

CREATE TABLE ollama_models (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model_id            TEXT NOT NULL UNIQUE,      -- e.g. 'llama3.1:8b'
    display_name        TEXT NOT NULL,             -- e.g. 'Kahurangi (Balanced)'
    description         TEXT,
    speed               model_speed NOT NULL,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    is_default          BOOLEAN NOT NULL DEFAULT FALSE,
    parameter_count     TEXT,                      -- e.g. '8B'
    context_length      INTEGER,                   -- Max tokens
    sort_order          INTEGER NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default models
INSERT INTO ollama_models (model_id, display_name, description, speed, is_active, is_default, parameter_count, context_length, sort_order) VALUES
    ('llama3.2:3b',  'Pōtiki (Fast)',      'Lightweight and quick. Best for straightforward questions.', 'fast',      TRUE, FALSE, '3B',  4096,  1),
    ('llama3.1:8b',  'Kahurangi (Balanced)', 'Good balance of speed and reasoning. Recommended default.',  'balanced',  TRUE, TRUE,  '8B',  8192,  2),
    ('qwen2.5:14b',  'Tūī (Thorough)',     'Slower but thorough. Best for complex legal analysis.',      'thorough',  TRUE, FALSE, '14B', 32768, 3);

-- ── AUDIT LOG ─────────────────────────────────────────────────────────────────

CREATE TABLE audit_log (
    id          BIGSERIAL PRIMARY KEY,
    tenant_id   UUID REFERENCES tenants(id) ON DELETE SET NULL,
    user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
    action      TEXT NOT NULL,                     -- e.g. 'document.uploaded'
    resource    TEXT,                              -- e.g. 'document:uuid'
    metadata    JSONB DEFAULT '{}',
    ip_address  INET,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_log_tenant_id ON audit_log(tenant_id);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at);

-- ── UPDATED_AT TRIGGER ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tenants_updated_at    BEFORE UPDATE ON tenants    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_users_updated_at      BEFORE UPDATE ON users      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_documents_updated_at  BEFORE UPDATE ON documents  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_conversations_updated BEFORE UPDATE ON conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── MONTHLY USAGE SUMMARY VIEW ────────────────────────────────────────────────

CREATE VIEW monthly_usage_summary AS
SELECT
    tenant_id,
    date_trunc('month', created_at) AS month,
    COUNT(*)                        AS query_count,
    SUM(input_tokens)               AS total_input_tokens,
    SUM(output_tokens)              AS total_output_tokens,
    SUM(gpu_seconds)                AS total_gpu_seconds,
    model
FROM usage_logs
GROUP BY tenant_id, date_trunc('month', created_at), model;
