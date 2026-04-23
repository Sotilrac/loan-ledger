.PHONY: help install dev build test lint format typecheck install-hooks clean

help:
	@echo "Loan Ledger — developer commands"
	@echo ""
	@echo "  make install        Install all workspace dependencies"
	@echo "  make dev            Start @loan-ledger/web dev server"
	@echo "  make build          Build all packages"
	@echo "  make test           Run all tests"
	@echo "  make lint           Run ESLint, Prettier check, Stylelint"
	@echo "  make format         Auto-fix formatting and lint"
	@echo "  make typecheck      Typecheck all packages"
	@echo "  make install-hooks  Install pre-commit hooks"
	@echo "  make clean          Remove build output and caches"

install:
	pnpm install

dev:
	pnpm dev

build:
	pnpm build

test:
	pnpm test

lint:
	pnpm lint

format:
	pnpm format

typecheck:
	pnpm typecheck

install-hooks:
	pnpm exec lefthook install

clean:
	pnpm -r exec rm -rf dist coverage .vite
