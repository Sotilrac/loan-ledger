# Loan Ledger

A mortgage and loan dashboard that reads human-readable YAML files and renders equity, payment splits, projected payoff, and scenario comparisons.

Two ways to run it:

**Standalone browser app**. Open a YAML file in your browser. Everything runs locally. Nothing uploaded. Save your file back to disk to keep your changes.

**Nextcloud app**. Your YAML files live in your Nextcloud storage under `/Ledgers/`. Sharing a dashboard is just sharing the file.

Both targets share the same loan math, data model, and scenario engine via `@loan-ledger/core`.

## Features

One YAML file per loan as the source of truth. Human-readable, git-friendly, hand-editable.

CSV payment imports from bank exports, with a one-time mapping wizard per bank.

Scheduled vs. actual amortization reconciled automatically. Principal, interest, and escrow splits computed from loan terms; actual payments override the schedule.

Rate schedule as a first-class concept, so ARMs and refinances aren't a special case.

Equity and projected payoff, with the current property value configurable manually or via a pluggable valuation provider.

Scenario engine for what-if and what-if-not comparisons. Add extra payments, simulate a refinance, or visualize what your existing extra payments have saved you. Scenarios persist to the YAML file so you can share them.

## Repository layout

```
loan-ledger/
  packages/
    core/         # shared TypeScript: engines, types, schemas, parsing
    web/          # standalone browser app
    nextcloud/    # Nextcloud app (PHP + Vue, uses @core for all math)
```

## Using the browser app

Visit the deployed URL (e.g. `https://loanledger.asmat.ca`). Open or create a `.loan.yaml` file. Your data never leaves your machine.

Browser compatibility:

**Chrome, Edge, Opera**: best experience. File System Access API lets the app save back to the file you opened, and remember it across visits (with one-click permission on return).

**Firefox, Safari**: functional but rougher. You open the file each session, and edits download as a new file that you save back manually.

A minimal loan file:

```yaml
schema_version: 1
property:
  name: "Primary residence"
  purchase_date: 2020-06-15
  purchase_price: 500000
  currency: USD
valuation:
  current: { amount: 650000, as_of: 2026-04-01, source: manual }
loan:
  principal: 400000
  annual_rate: 0.0325
  term_months: 360
  start_date: 2020-07-01
  first_payment_date: 2020-08-01
  payment_day: 1
  escrow_monthly: 450
  rate_schedule:
    - { effective_date: 2020-07-01, annual_rate: 0.0325 }
```

See [`docs/loan-file-format.md`](docs/loan-file-format.md) for the full schema.

## Using the Nextcloud app

### Install

From the Nextcloud App Store: search for "Loan Ledger" in your Apps section.

From a release archive:

```bash
cd /path/to/nextcloud/custom_apps
tar xf ~/Downloads/loan_ledger-nc-vX.Y.Z.tar.gz
sudo -u www-data php /path/to/nextcloud/occ app:enable loan_ledger
```

### First use

Open the app from the Nextcloud top bar. On first run it offers to create `/Ledgers/` in your storage. Nothing gets created without your consent. Accept, then either click "New loan" to generate a starter YAML file, or drop a hand-written `*.loan.yaml` into `/Ledgers/` via any Nextcloud client.

### Sharing

The app has no sharing concept of its own. Share the YAML file (and its payment CSVs folder, if any) using Nextcloud's native share. The recipient enables the app, opens the file via the Files-app context menu, and sees the same dashboard. Read-only shares give a read-only dashboard.

## Shared conventions (both targets)

Currency is a per-loan display hint. Totals in aggregate views are shown per-currency; no conversion.

All dates are date-only. Times from CSV imports are dropped.

Files failing schema validation still appear with a warning banner and a diff view naming the invalid lines. Nothing silently disappears.

## Development

### Environment

Requires Node 20+ and pnpm 9+. The Nextcloud package additionally requires PHP 8.2+ and a local Nextcloud checkout to run against.

```bash
git clone https://github.com/<user>/loan-ledger.git
cd loan-ledger
pnpm install
make install-hooks
```

### Daily workflow

```bash
pnpm -r build              # build all packages
pnpm -r test               # test all packages
pnpm --filter @loan-ledger/web dev            # web app, Vite HMR
pnpm --filter @loan-ledger/core test:watch    # engine TDD loop
pnpm --filter @loan-ledger/nextcloud dev      # Nextcloud frontend with HMR
```

Or via the Makefile:

```bash
make dev                   # web app dev server
make test                  # full test suite
make lint                  # all linters
make format                # auto-fix formatting
make build                 # all packages
make package               # Nextcloud release archive
```

### Testing

The heart of the app is `@loan-ledger/core`. 100% line coverage on `LoanEngine` and `ScenarioEngine`. Hand-verified amortization tables as fixtures.

```bash
pnpm --filter @loan-ledger/core test
pnpm --filter @loan-ledger/core test:coverage
```

Other packages have proportionally smaller test suites focused on their specific surface (file handling, UI components, Nextcloud adapters).

```bash
pnpm --filter @loan-ledger/web test
pnpm --filter @loan-ledger/nextcloud test           # Vitest (frontend)
cd packages/nextcloud && vendor/bin/phpunit          # PHPUnit (PHP adapter layer)
```

Fixture round-trip check (parses every committed `.loan.yaml` through the full pipeline, diffs against expected JSON):

```bash
pnpm --filter @loan-ledger/core test:fixtures
```

### Static analysis

```bash
pnpm -r typecheck
pnpm -r lint                # ESLint + Stylelint across all packages
cd packages/nextcloud && composer run psalm
cd packages/nextcloud && composer run cs:check
```

### Releases

The two targets version independently.

```bash
git tag web-v0.1.0         # triggers release-web workflow
git tag nc-v0.1.0          # triggers release-nextcloud workflow
git push --tags
```

The `release-web` workflow builds `@loan-ledger/web` and deploys to the configured static host. The `release-nextcloud` workflow builds `@loan-ledger/nextcloud`, packages it per `.nextcloudignore`, uploads the archive to the GitHub release, and (if configured) pushes to the Nextcloud App Store.

Both targets pin `@loan-ledger/core` via `workspace:*`, so the lockfile captures the exact core version used in each build.

## CI

GitHub Actions workflows:

| Workflow | Scope |
| --- | --- |
| `ci-core` | typecheck, test, build for `@core` |
| `ci-web` | typecheck, test, build for `@web`, PR preview deploys |
| `ci-nextcloud-php` | lint-php, psalm, phpunit matrix (PHP 8.2–8.5 × Nextcloud stable31/32/33/master) |
| `ci-nextcloud-js` | frontend checks for `@nextcloud` |
| `release-web` | tag `web-v*` → deploy static bundle |
| `release-nextcloud` | tag `nc-v*` → build archive + release + App Store push |

Branch protection on `main` requires `ci-core`, `ci-web`, `ci-nextcloud-php (stable33 / PHP 8.3)`, and `ci-nextcloud-js` to pass.

## Pre-commit hooks

Using [pre-commit.com](https://pre-commit.com). Install once:

```bash
pip install pre-commit      # or brew install pre-commit
make install-hooks
```

Pre-commit runs fast checks (formatting, YAML/JSON validity, EditorConfig, ESLint, Stylelint). Pre-push runs slower checks (Vitest, Psalm, PHPUnit).

```bash
pre-commit run --all-files   # run everything manually
git commit --no-verify       # emergency escape hatch
```

## Contributing

Open an issue before opening a PR for anything larger than a small fix. Follow the coding standards (`make format` does most of the work). Use Conventional Commits. Scope commits to one package where possible (`feat(core): ...`, `fix(web): ...`, `feat(nextcloud): ...`).

All PRs must pass CI and include tests for new behavior. Changes to `@loan-ledger/core` require corresponding fixture updates if they affect computed output.

## License

AGPL-3.0-or-later. See [`LICENSE`](LICENSE).
