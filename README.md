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

Live preview: [https://loan-ledger.pages.dev/](https://loan-ledger.pages.dev/)

Open or create a `.loan.yaml` file. Your data never leaves your machine.

Browser compatibility:

**Chrome, Edge, Opera**: best experience. File System Access API lets the app save back to the file you opened, and remember it across visits (with one-click permission on return).

**Firefox, Safari**: functional but rougher. You open the file each session, and edits download as a new file that you save back manually.

A minimal loan file:

```yaml
schema_version: 1
property:
  name: 'Primary residence'
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

Requires Node 24 LTS (pinned via `.nvmrc`) and pnpm 10+. The Nextcloud package additionally requires PHP 8.2+ and a local Nextcloud checkout to run against.

```bash
git clone https://gitlab.com/sotilrac/loan-ledger.git
cd loan-ledger
nvm use              # picks up Node 24 from .nvmrc
corepack enable      # activates the pinned pnpm version
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
git tag web-v0.1.0         # triggers the release-web pipeline
git tag nc-v0.1.0          # triggers the release-nextcloud pipeline
git push --tags
```

Release pipelines build `@loan-ledger/web` (static bundle to the configured host) and `@loan-ledger/nextcloud` (archive per `.nextcloudignore`, attached to the GitLab release and optionally pushed to the Nextcloud App Store).

Both targets pin `@loan-ledger/core` via `workspace:*`, so the lockfile captures the exact core version used in each build.

## CI

GitLab CI, defined in `.gitlab-ci.yml`. Phase 0 pipeline:

| Stage   | Job         | Runs                                                    |
| ------- | ----------- | ------------------------------------------------------- |
| install | `install`   | `pnpm install --frozen-lockfile` (cached by lockfile)   |
| check   | `lint`      | `pnpm lint` (ESLint, Prettier, Stylelint)               |
| check   | `typecheck` | `pnpm typecheck` (`tsc` + `vue-tsc`)                    |
| check   | `test`      | `pnpm test` (Vitest across all packages)                |
| build   | `build`     | `pnpm build` → uploads `packages/web/dist/` as artifact |

The pipeline runs on every branch push and tag. A Nextcloud PHP matrix (PHP 8.2–8.5 × Nextcloud 31/32/33) gets added in Phase 7.

## Git hooks

Using [Lefthook](https://lefthook.dev). Installed as a devDependency; activate the hooks once per clone:

```bash
make install-hooks
```

`pre-commit` runs Prettier, ESLint, Stylelint, and editorconfig-checker on staged files (parallel). `pre-push` runs typecheck and Vitest across the workspace.

```bash
pnpm exec lefthook run pre-commit   # run manually against the current index
git commit --no-verify              # emergency escape hatch
```

## Contributing

Follow the coding standards (`make format` does most of the work). Use Conventional Commits. Scope commits to one package where possible (`feat(core): ...`, `fix(web): ...`, `feat(nextcloud): ...`). Changes to `@loan-ledger/core` require corresponding fixture updates if they affect computed output.

## License

MIT. See [`LICENSE`](LICENSE).
