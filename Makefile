.PHONY: help install dev build test lint format typecheck install-hooks clean deploy \
	nc-install nc-build nc-test nc-lint nc-format nc-clean nc-shell

NC_DIR := packages/nextcloud
PHP_IMAGE ?= php:8.2-cli

help:
	@echo "Loan Ledger — developer commands"
	@echo ""
	@echo "  make install        Install all workspace dependencies (JS only)"
	@echo "  make dev            Start @loan-ledger/web dev server"
	@echo "  make build          Build all JS packages"
	@echo "  make test           Run all JS tests"
	@echo "  make lint           Run ESLint, Prettier check, Stylelint"
	@echo "  make format         Auto-fix formatting and lint"
	@echo "  make typecheck      Typecheck all packages"
	@echo "  make install-hooks  Install pre-commit hooks"
	@echo "  make clean          Remove build output and caches"
	@echo "  make deploy         Deploy @loan-ledger/web to Cloudflare Pages"
	@echo ""
	@echo "  Nextcloud app (PHP — runs natively if composer/php are available,"
	@echo "  otherwise use 'make nc-shell' to drop into a PHP 8.2 container):"
	@echo "  make nc-install     Composer install for $(NC_DIR)"
	@echo "  make nc-build       Build the Nextcloud frontend bundle (js/, css/)"
	@echo "  make nc-test        Run PHPUnit suite for the Nextcloud app"
	@echo "  make nc-lint        Run php-cs-fixer (dry-run) + Psalm"
	@echo "  make nc-format      Auto-fix PHP code style"
	@echo "  make nc-shell       Open a PHP 8.2 shell with $(NC_DIR) mounted"
	@echo "  make nc-clean       Remove PHP build caches and vendor dirs"

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

deploy: build
	pnpm run deploy:pages

nc-install:
	cd $(NC_DIR) && composer install --no-progress

nc-build:
	pnpm --filter @loan-ledger/nextcloud build

nc-test:
	cd $(NC_DIR) && composer test

nc-lint:
	cd $(NC_DIR) && composer cs:check && composer psalm

nc-format:
	cd $(NC_DIR) && composer cs:fix

nc-shell:
	docker run --rm -it \
		-v "$(CURDIR)/$(NC_DIR)":/app \
		-w /app \
		$(PHP_IMAGE) bash -lc 'apt-get update >/dev/null && apt-get install -y -q git unzip libzip-dev >/dev/null && docker-php-ext-install zip >/dev/null && curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer >/dev/null && exec bash'

nc-clean:
	rm -rf $(NC_DIR)/vendor $(NC_DIR)/vendor-bin/*/vendor \
		$(NC_DIR)/.phpunit.cache $(NC_DIR)/.psalm.cache $(NC_DIR)/.php-cs-fixer.cache
