.PHONY: help install dev build test lint format typecheck install-hooks clean deploy \
	nc-install nc-build nc-test nc-lint nc-format nc-clean nc-shell nc-dev nc-dev-down \
	nc-dev-enable nc-dev-logs nc-validate nc-package

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
	@echo "  make nc-dev         Bring up a local Nextcloud at http://localhost:8080"
	@echo "  make nc-dev-enable  Enable the loanledger app inside the running NC"
	@echo "  make nc-dev-logs    Tail logs from the dev Nextcloud"
	@echo "  make nc-dev-down    Tear down the dev Nextcloud and discard its data"
	@echo "  make nc-validate    Validate appinfo/info.xml against the App Store schema"
	@echo "  make nc-package     Build a signed release tarball (needs NC_KEY env)"

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

nc-dev: nc-build
	docker compose -f $(NC_DIR)/dev/docker-compose.yml up -d
	@echo "Nextcloud booting at http://localhost:8080 (admin / admin)."
	@echo "First boot takes ~30s. Then run: make nc-dev-enable"

nc-dev-enable:
	@echo "Waiting for Nextcloud to finish installing (up to 3 minutes)..."
	@for i in $$(seq 1 36); do \
		if docker compose -f $(NC_DIR)/dev/docker-compose.yml exec --user www-data -T nextcloud \
			php occ status 2>/dev/null | grep -q "installed: true"; then \
			echo "✓ Nextcloud is up."; \
			break; \
		fi; \
		printf "."; \
		sleep 5; \
	done; echo
	docker compose -f $(NC_DIR)/dev/docker-compose.yml exec --user www-data nextcloud \
		php occ app:enable loanledger

nc-dev-logs:
	docker compose -f $(NC_DIR)/dev/docker-compose.yml logs -f

nc-dev-down:
	docker compose -f $(NC_DIR)/dev/docker-compose.yml down -v

# Validate appinfo/info.xml against the live App Store schema. Runs in a
# minimal debian container so the host doesn't need libxml2-utils.
nc-validate:
	docker run --rm -v "$(CURDIR)/$(NC_DIR)":/app -w /app debian:trixie-slim bash -lc '\
		apt-get update -q >/dev/null && \
		apt-get install -y -q libxml2-utils curl ca-certificates >/dev/null && \
		curl -s https://apps.nextcloud.com/schema/apps/info.xsd -o /tmp/info.xsd && \
		xmllint --schema /tmp/info.xsd appinfo/info.xml --noout'

# Build a signed release tarball ready for the App Store. Set NC_KEY to the
# path of the OpenPGP private key whose paired cert was issued via
# https://github.com/nextcloud/app-certificate-requests.
NC_VERSION ?= $(shell sed -n 's@.*<version>\(.*\)</version>.*@\1@p' $(NC_DIR)/appinfo/info.xml)
NC_OUT := dist/loanledger-$(NC_VERSION).tar.gz
NC_KEY ?= $(HOME)/.nextcloud/certificates/loanledger.key

nc-package: nc-validate nc-install nc-build
	rm -rf dist && mkdir -p dist/loanledger
	rsync -a --exclude-from=$(NC_DIR)/.nextcloudignore \
		--exclude=node_modules --exclude=tests --exclude=src \
		$(NC_DIR)/ dist/loanledger/
	tar -czf $(NC_OUT) -C dist loanledger
	@if [ -f "$(NC_KEY)" ]; then \
		openssl dgst -sha512 -sign "$(NC_KEY)" $(NC_OUT) | base64 -w0 > $(NC_OUT).sig; \
		echo "Signed → $(NC_OUT).sig"; \
	else \
		echo "NC_KEY not set or missing — tarball built unsigned at $(NC_OUT)"; \
	fi
