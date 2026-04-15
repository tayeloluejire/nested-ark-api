.PHONY: help install setup dev build test lint clean docker-up docker-down db-migrate db-seed

# Colors for output
BLUE=\033[0;34m
GREEN=\033[0;32m
YELLOW=\033[0;33m
NC=\033[0m # No Color

help:
	@echo "$(BLUE)Infrastructure Platform - Available Commands$(NC)"
	@echo ""
	@echo "$(GREEN)Setup & Installation:$(NC)"
	@echo "  make install           - Install all dependencies"
	@echo "  make setup             - Complete setup (install + docker + db)"
	@echo ""
	@echo "$(GREEN)Development:$(NC)"
	@echo "  make dev               - Start all services in development"
	@echo "  make dev-backend       - Start backend only"
	@echo "  make dev-frontend      - Start frontend only"
	@echo ""
	@echo "$(GREEN)Building:$(NC)"
	@echo "  make build             - Build all services"
	@echo "  make build-backend     - Build backend only"
	@echo "  make build-frontend    - Build frontend only"
	@echo ""
	@echo "$(GREEN)Testing:$(NC)"
	@echo "  make test              - Run all tests"
	@echo "  make test-watch        - Run tests in watch mode"
	@echo "  make test-coverage     - Run tests with coverage"
	@echo ""
	@echo "$(GREEN)Linting & Formatting:$(NC)"
	@echo "  make lint              - Run linter"
	@echo "  make format            - Format code with prettier"
	@echo ""
	@echo "$(GREEN)Database:$(NC)"
	@echo "  make db-migrate        - Run database migrations"
	@echo "  make db-seed           - Seed database with test data"
	@echo "  make db-reset          - Reset database (migrate + seed)"
	@echo "  make db-status         - Check database status"
	@echo ""
	@echo "$(GREEN)Docker:$(NC)"
	@echo "  make docker-up         - Start Docker containers"
	@echo "  make docker-down       - Stop Docker containers"
	@echo "  make docker-clean      - Remove all Docker containers and volumes"
	@echo "  make docker-logs       - View Docker logs"
	@echo "  make docker-build      - Build Docker images"
	@echo ""
	@echo "$(GREEN)Utilities:$(NC)"
	@echo "  make health-check      - Check service health"
	@echo "  make clean             - Clean all build artifacts"
	@echo "  make type-check        - Run TypeScript type checking"
	@echo ""

# ============================================================================
# SETUP & INSTALLATION
# ============================================================================

install:
	@echo "$(BLUE)Installing dependencies...$(NC)"
	npm install

setup: install docker-up db-migrate db-seed
	@echo "$(GREEN)✓ Setup complete! Start development with: make dev$(NC)"

# ============================================================================
# DEVELOPMENT
# ============================================================================

dev:
	@echo "$(BLUE)Starting all services in development mode...$(NC)"
	npm run dev:all

dev-backend:
	@echo "$(BLUE)Starting backend service...$(NC)"
	npm run dev:backend

dev-frontend:
	@echo "$(BLUE)Starting frontend service...$(NC)"
	npm run dev:frontend

# ============================================================================
# BUILDING
# ============================================================================

build:
	@echo "$(BLUE)Building all services...$(NC)"
	npm run build

build-backend:
	@echo "$(BLUE)Building backend...$(NC)"
	npm run -w apps/backend build

build-frontend:
	@echo "$(BLUE)Building frontend...$(NC)"
	npm run -w apps/frontend build

# ============================================================================
# TESTING
# ============================================================================

test:
	@echo "$(BLUE)Running all tests...$(NC)"
	npm run test

test-watch:
	@echo "$(BLUE)Running tests in watch mode...$(NC)"
	npm run test:watch

test-coverage:
	@echo "$(BLUE)Running tests with coverage...$(NC)"
	npm run test:coverage

# ============================================================================
# LINTING & FORMATTING
# ============================================================================

lint:
	@echo "$(BLUE)Running linter...$(NC)"
	npm run lint

format:
	@echo "$(BLUE)Formatting code...$(NC)"
	npm run format

type-check:
	@echo "$(BLUE)Running TypeScript type check...$(NC)"
	npm run type-check

# ============================================================================
# DATABASE
# ============================================================================

db-migrate:
	@echo "$(BLUE)Running database migrations...$(NC)"
	npm run db:migrate

db-seed:
	@echo "$(BLUE)Seeding database...$(NC)"
	npm run db:seed

db-reset: db-migrate db-seed
	@echo "$(GREEN)✓ Database reset complete$(NC)"

db-status:
	@echo "$(BLUE)Checking database status...$(NC)"
	docker-compose ps postgres

# ============================================================================
# DOCKER
# ============================================================================

docker-up:
	@echo "$(BLUE)Starting Docker containers...$(NC)"
	docker-compose up -d
	@echo "$(GREEN)✓ Docker containers started$(NC)"
	@echo ""
	@echo "Service URLs:"
	@echo "  PostgreSQL:        localhost:5432"
	@echo "  Redis:             localhost:6379"
	@echo "  MinIO (S3):        localhost:9000"
	@echo "  MinIO Console:     localhost:9001"
	@echo "  MailHog:           localhost:8025"
	@echo "  Adminer:           localhost:8080"
	@echo "  Redis Commander:   localhost:8081"

docker-down:
	@echo "$(BLUE)Stopping Docker containers...$(NC)"
	docker-compose down

docker-clean:
	@echo "$(YELLOW)WARNING: This will remove all containers and volumes!$(NC)"
	@read -p "Continue? (y/N) " confirm; \
	if [ "$$confirm" = "y" ] || [ "$$confirm" = "Y" ]; then \
		docker-compose down -v; \
		echo "$(GREEN)✓ Docker containers and volumes cleaned$(NC)"; \
	fi

docker-logs:
	@echo "$(BLUE)Showing Docker logs...$(NC)"
	docker-compose logs -f

docker-build:
	@echo "$(BLUE)Building Docker images...$(NC)"
	npm run docker:build

docker-ps:
	@echo "$(BLUE)Docker containers:$(NC)"
	docker-compose ps

# ============================================================================
# UTILITIES
# ============================================================================

health-check:
	@echo "$(BLUE)Checking service health...$(NC)"
	npm run health-check

clean:
	@echo "$(BLUE)Cleaning build artifacts...$(NC)"
	npm run clean

# ============================================================================
# COMMON WORKFLOWS
# ============================================================================

init-project: help install setup
	@echo "$(GREEN)✓ Project initialized! Read the README.md for next steps.$(NC)"

fresh-start: docker-clean db-reset dev
	@echo "$(GREEN)✓ Fresh start complete$(NC)"

pre-commit: lint type-check test
	@echo "$(GREEN)✓ Pre-commit checks passed$(NC)"

# ============================================================================
# DEPLOYMENT
# ============================================================================

deploy-staging:
	@echo "$(BLUE)Deploying to staging...$(NC)"
	@echo "$(YELLOW)Run: docker push infrastructure-platform:backend$(NC)"
	@echo "$(YELLOW)Run: docker push infrastructure-platform:frontend$(NC)"
	@echo "$(YELLOW)Run: kubectl apply -f infrastructure/kubernetes/$(NC)"

deploy-production:
	@echo "$(BLUE)Deploying to production...$(NC)"
	@echo "$(YELLOW)Run: docker push infrastructure-platform:backend$(NC)"
	@echo "$(YELLOW)Run: docker push infrastructure-platform:frontend$(NC)"
	@echo "$(YELLOW)Run: kubectl apply -f infrastructure/kubernetes/ --context=production$(NC)"

# ============================================================================
# DEFAULT TARGET
# ============================================================================

.DEFAULT_GOAL := help
