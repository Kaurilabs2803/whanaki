"""
Structured logging configuration for Whānaki.

Development  — human-readable ColourRenderer output to stdout.
Production   — JSON output to stdout so Vector/Docker can collect and
               forward logs to any sink (file, Loki, Datadog, etc.).

Call configure_logging() once at application startup (lifespan).
"""
import logging
import sys

import structlog


def configure_logging(environment: str, log_level: str) -> None:
    """
    Configure structlog and stdlib logging for the application.

    Args:
        environment: "development" | "production" | "test"
        log_level:   "debug" | "info" | "warning" | "error"
    """
    level = getattr(logging, log_level.upper(), logging.INFO)

    # Processors applied to every log record regardless of environment
    shared_processors: list = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso", utc=True),
        structlog.processors.StackInfoRenderer(),
    ]

    if environment == "production":
        # JSON lines — one record per line, easy for Vector/Loki to ingest
        processors = shared_processors + [
            structlog.stdlib.PositionalArgumentsFormatter(),
            structlog.processors.dict_tracebacks,
            structlog.processors.JSONRenderer(),
        ]
        # Stdlib handler: plain message (structlog already serialises to JSON)
        logging.basicConfig(
            stream=sys.stdout,
            format="%(message)s",
            level=level,
        )
    else:
        # Coloured human-readable output for local development
        processors = shared_processors + [
            structlog.stdlib.PositionalArgumentsFormatter(),
            structlog.dev.ConsoleRenderer(colors=True),
        ]
        logging.basicConfig(
            stream=sys.stdout,
            format="%(message)s",
            level=level,
        )

    structlog.configure(
        processors=processors,
        wrapper_class=structlog.make_filtering_bound_logger(level),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )

    # Silence noisy third-party loggers in production
    if environment == "production":
        for noisy in ("uvicorn.access", "sqlalchemy.engine", "httpx"):
            logging.getLogger(noisy).setLevel(logging.WARNING)
