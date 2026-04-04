from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # App
    environment: str = "development"
    log_level: str = "debug"
    secret_key: str = "change-me-in-production"

    # Database
    database_url: str = "postgresql+asyncpg://whanaki:whanaki@localhost:5432/whanaki"
    redis_url: str = "redis://localhost:6379/0"

    # Clerk
    clerk_secret_key: str = ""
    clerk_publishable_key: str = ""

    # Stripe
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_price_starter: str = ""
    stripe_price_professional: str = ""
    stripe_price_enterprise: str = ""

    # Ollama
    ollama_host: str = "http://localhost:11434"
    ollama_default_model: str = "llama3.1:8b"
    ollama_max_concurrent: int = 3       # GPU semaphore limit
    ollama_timeout: int = 120            # Seconds before giving up

    # RAGFlow
    ragflow_host: str = "http://localhost:9380"
    ragflow_api_key: str = "ragflow-dev-key"
    ragflow_top_k: int = 5              # Chunks retrieved per query

    # App URL (used in Stripe redirect URLs)
    app_url: str = "http://localhost:3000"

    # CORS — comma-separated list of allowed origins.
    # Production: set to your exact domain(s), e.g. "https://whanaki.kaurilabs.kiwi"
    # Never use wildcards in production.
    allowed_origins: str = "http://localhost:3000,http://localhost:80"

    # Plan limits
    plan_limits: dict = {
        "starter":      {"queries": 200,  "pages": 500},
        "professional": {"queries": 1000, "pages": 2000},
        "enterprise":   {"queries": -1,   "pages": -1},   # -1 = unlimited
    }

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    return Settings()
