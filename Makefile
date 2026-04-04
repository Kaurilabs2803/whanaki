# Whānaki — Makefile
# Run `make help` for available commands

.PHONY: help dev stop logs pull-models health migrate deploy update

help:
	@echo ""
	@echo "Whānaki development commands:"
	@echo "  make dev          Start all services locally"
	@echo "  make stop         Stop all services"
	@echo "  make logs         Tail all logs"
	@echo "  make logs-api     Tail backend logs only"
	@echo "  make pull-models  Pull default Ollama models"
	@echo "  make health       Check service health"
	@echo "  make migrate      Run DB migrations"
	@echo "  make shell-db     Open psql shell"
	@echo "  make deploy       Deploy to production"
	@echo "  make update       Pull latest + restart changed services"
	@echo ""

dev:
	docker compose up -d
	@echo ""
	@echo "Services starting. Visit http://localhost:3000"
	@echo "API docs at http://localhost:8000/docs"

stop:
	docker compose down

logs:
	docker compose logs -f

logs-api:
	docker compose logs -f backend

pull-models:
	docker compose exec ollama ollama pull nomic-embed-text
	docker compose exec ollama ollama pull llama3.2:3b
	docker compose exec ollama ollama pull llama3.1:8b
	@echo "Models ready. For the thorough model: make pull-thorough"

pull-thorough:
	docker compose exec ollama ollama pull qwen2.5:14b

health:
	@curl -s http://localhost:8000/health | python3 -m json.tool

migrate:
	docker compose exec backend alembic upgrade head

shell-db:
	docker compose exec postgres psql -U whanaki -d whanaki

shell-backend:
	docker compose exec backend bash

shell-ollama:
	docker compose exec ollama sh

# Production commands (run on the server)
deploy:
	docker compose -f docker-compose.prod.yml build
	docker compose -f docker-compose.prod.yml up -d --scale backend=2

update:
	git pull origin main
	docker compose -f docker-compose.prod.yml build backend frontend
	docker compose -f docker-compose.prod.yml up -d --scale backend=2 backend frontend

prod-logs:
	docker compose -f docker-compose.prod.yml logs -f

prod-logs-tail:
	@docker compose -f docker-compose.prod.yml exec vector \
		tail -f /var/log/whanaki/$$(date +%Y-%m-%d).ndjson 2>/dev/null \
		|| echo "No log file for today yet. Check: docker compose -f docker-compose.prod.yml exec vector ls /var/log/whanaki/"

prod-health:
	@curl -s https://api.whanaki.kaurilabs.kiwi/health | python3 -m json.tool

test:
	cd backend && python -m pytest tests/ -v

test-ci:
	cd backend && python -m pytest tests/ -v --tb=short --no-header
