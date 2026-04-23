# Loan Ledger: monorepo plan

Plan for Claude Code to build Loan Ledger as a pnpm monorepo with a shared TypeScript core consumed by two deployment targets: a standalone browser app and a Nextcloud app.

## Repository layout

```
loan-ledger/                      # monorepo root
  pnpm-workspace.yaml
  package.json                    # root scripts, shared dev deps
  tsconfig.base.json
  .editorconfig
  .gitignore
  .pre-commit-config.yaml
  .github/workflows/
  Makefile
  README.md
  LICENSE
  CHANGELOG.md
  packages/
    core/                         # pure TS: engines, types, schemas, parsing
    web/                          # standalone browser app (static bundle)
    nextcloud/                    # Nextcloud app (PHP + Vue thin shell)
```

`@loan-ledger/core` is the shared TS package. It has no DOM, no Nextcloud, no filesystem dependencies. Both deployment targets consume it as `"@loan-ledger/core": "workspace:*"`.

## `@loan-ledger/core`

Pure TypeScript. The single source of truth for loan math, data model, and validation. All business-logic tests live here.

### Responsibilities

- `LoanEngine` (amortization schedule, actual-vs-scheduled reconciliation, derived values)
- `ScenarioEngine` (applies mutations to a baseline `LoanState`)
- All `Mutation` implementations
- TypeScript types for the data model
- JSON Schemas for `.loan.yaml` and `.mappings.yaml`
- YAML parsing/serializing (`js-yaml`) and schema validation (`ajv`)
- CSV parsing with mapping application (`papaparse`)
- `IValuationProvider` interface, Manual and CustomUrl provider implementations

### Directory

```
packages/core/
  package.json
  tsconfig.json
  tsup.config.ts                  # builds ESM + CJS + .d.ts
  src/
    index.ts
    engine/
      loanEngine.ts
      scenarioEngine.ts
      types.ts                    # LoanState, Schedule, Payment, Currency, ...
    mutation/
      index.ts
      recurringExtraPrincipal.ts
      oneTimeExtra.ts
      changeRate.ts
      changeTerm.ts
      stopExtraPayments.ts
      changeEscrow.ts
      removePayment.ts
      removePaymentsWhere.ts
      replacePayment.ts
      setOriginalRate.ts
    io/
      yaml.ts                     # read/write .loan.yaml
      csv.ts                      # ingest CSV with a mapping
      validate.ts                 # JSON Schema against ajv
    valuation/
      provider.ts                 # IValuationProvider
      manual.ts
      customUrl.ts
    schemas/
      loan.schema.json
      mappings.schema.json
  test/
    loanEngine.test.ts
    scenarioEngine.test.ts
    mutations.test.ts
    yaml.test.ts
    csv.test.ts
    fixtures/
      loan-files/
      csv-samples/
      expected/                   # JSON snapshots of full computed state
```

### Package fields

`package.json`:
```
{
  "name": "@loan-ledger/core",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": { "import": "./dist/index.js", "require": "./dist/index.cjs", "types": "./dist/index.d.ts" },
    "./schemas/*.json": "./src/schemas/*.json"
  },
  "scripts": {
    "build": "tsup",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  }
}
```

Build via `tsup` (simple, Vite-aligned, emits both ESM and CJS with types). Vitest for tests.

### Purity rules

- No `window`, `document`, `fetch` references in `engine/` or `mutation/`.
- `io/` uses only Node/browser-universal APIs: `js-yaml`, `papaparse`, `ajv`.
- `valuation/customUrl.ts` uses the globally-available `fetch` (present in Node 20+ and all browsers), so the provider works in both targets.
- Dates are `YYYY-MM-DD` strings at the public API. Internal math uses a thin `Date` wrapper that always normalizes to UTC midnight. No time components, ever.

## `@loan-ledger/web`

Standalone browser app. Static bundle, deployable anywhere that serves files (S3+CloudFront, GitHub Pages, Netlify, or a subdirectory on asmat.ca).

### Directory

```
packages/web/
  package.json
  vite.config.ts
  vitest.config.ts
  tsconfig.json
  index.html
  public/
    favicon.svg
  src/
    main.ts
    App.vue
    router.ts
    stores/
      loans.ts                    # in-memory store of opened files
      fileHandles.ts              # File System Access API handles, persisted in IndexedDB
      scenarios.ts
    views/
      LoanList.vue
      LoanDetail.vue
      Onboarding.vue              # "Open a .loan.yaml or start from a template"
      Settings.vue
    components/
      EquityGauge.vue
      BalanceChart.vue
      CompositionChart.vue
      AmortizationTable.vue
      RateScheduleEditor.vue
      ScenariosPanel.vue
      ScenarioCard.vue
      QuickAddExtraDialog.vue
      QuickAddRefinanceDialog.vue
      CounterfactualReadout.vue
      CsvMappingWizard.vue
      FilePicker.vue              # FSA where available, <input type=file> fallback
    composables/
      useFileHandle.ts            # wraps File System Access API + IndexedDB
      useAutoSave.ts              # debounced save-back on edits
    style/
      main.css                    # Tailwind (or vanilla-extract)
  test/
    stores.test.ts
    composables.test.ts
```

### File handling

Two tiers:

**Tier 1: File System Access API** (Chromium browsers). User opens a `.loan.yaml` once; the handle is stored in IndexedDB. On next visit, the app asks for re-permission (one click) and edits save back to the original file. This is the intended happy path.

**Tier 2: `<input type="file">` + download** (Firefox, Safari). User opens a file every session. Edits are saved by downloading a new copy of the YAML, which the user has to drop back in place manually. Functional but rougher.

The app never uploads anything to a server. All parsing, math, and CSV ingestion run locally.

### CSV mappings

Stored in `localStorage` as `@loan-ledger/web:mappings` (JSON). Users can export the mapping set to `.mappings.yaml` and re-import on another machine. No user accounts, no sync.

### Onboarding

First visit shows three options: open an existing file, start from a template, or paste a YAML string. The template generator is the same form that the Nextcloud app uses for "New loan"; it's a shared Vue component sourced from `@loan-ledger/core`'s type definitions (or a sibling `@loan-ledger/ui` package if that's worth breaking out later).

### Dependencies

```
dependencies:
  vue: ^3.5
  pinia: ^3
  chart.js: ^4
  vue-chartjs: ^5
  reka-ui: ^2                     # headless primitives
  tailwindcss: ^4
  @loan-ledger/core: workspace:*

devDependencies:
  vite: ^7
  vitest: ^4
  @vitejs/plugin-vue: ^6
  @vue/test-utils: ^2
  typescript: ^5.5
  vue-tsc: ^2
  jsdom: ^25
  eslint: ^9
  stylelint: ^16
```

Build output is a single-page app in `packages/web/dist/`. Works offline after first load via a service worker (v2 concern; skip in v1).

## `@loan-ledger/nextcloud`

Nextcloud app. PHP skeleton that hosts a Vue frontend importing `@loan-ledger/core` for all math and parsing.

### Directory

```
packages/nextcloud/
  appinfo/
    info.xml
    routes.php
  composer.json
  composer.lock
  psalm.xml
  phpunit.xml
  .nextcloudignore
  .php-cs-fixer.dist.php
  package.json                    # consumes @loan-ledger/core
  vite.config.ts                  # outputs to js/ for Nextcloud to serve
  tsconfig.json
  lib/
    AppInfo/Application.php
    Controller/
      LoanController.php
      MappingController.php
      ValuationController.php
    Service/
      FileScanner.php             # walks /Ledgers/, reads raw bytes
      FileWriter.php              # writes YAML back via IRootFolder
    Dashboard/MortgageWidget.php
  src/
    main.ts
    App.vue
    router.ts
    stores/
      loans.ts                    # fetches raw YAML strings from OCS, parses via @core
      scenarios.ts
    views/
      LoanList.vue
      LoanDetail.vue
      MappingsManager.vue
      Settings.vue
    components/
      # same components as web, but Nextcloud-styled
  css/app.scss
  l10n/
  tests/
    unit/
      FileScannerTest.php
      FileWriterTest.php
```

### PHP responsibilities

The PHP side stays minimal. It does exactly what Nextcloud needs it to do and nothing else:

- Walk `/Ledgers/` (or the configured root) and return a list of file paths plus raw YAML bytes.
- Read and write files via `IRootFolder`, so permission checks and share semantics are respected.
- Register the dashboard widget and the Files-app context-menu action.
- Nothing else. All loan math, validation, parsing, and mutation happen in TypeScript via `@loan-ledger/core`, running in the browser.

This inversion is the point of the monorepo: the Nextcloud app becomes a thin adapter around the same engine the web app uses. Bug fixes and new features in the engine land in both targets simultaneously.

### Endpoints (OCS)

```
GET    /api/v1/loans              # list of { path, content_yaml, mtime }
GET    /api/v1/loans/{id}/raw     # raw YAML string
PUT    /api/v1/loans/{id}/raw     # write raw YAML string
GET    /api/v1/mappings/raw       # raw .mappings.yaml
PUT    /api/v1/mappings/raw       # write .mappings.yaml
POST   /api/v1/valuation/fetch    # proxy valuation provider calls if CORS blocks direct
```

The API traffics in raw YAML strings, not parsed objects. Parsing is the frontend's job via `@core`. This keeps PHP dumb and the engine authoritative.

### Shared vs. duplicated

Shared (via `@loan-ledger/core`): engine logic, data model, validation, YAML/CSV parsing, scenario mutations.

Duplicated necessarily: Vue components (styled differently for each target), routers, stores (different data sources). This is fine — the components are thin layers over `@core` calls, and neither target is so polished that shared components would repay the abstraction cost in v1. A `@loan-ledger/ui` package can be extracted later if the duplication becomes painful.

## Target platform and versions

| Thing | Version |
| --- | --- |
| Node | 20 or 22 |
| pnpm | ^9 |
| TypeScript | ^5.5 |
| Vue | ^3.5 |
| Vite | ^7 |
| Vitest | ^4 |
| tsup | ^8 (core build) |
| Nextcloud | 31, 32, 33 |
| PHP | 8.2 – 8.5 |
| PHPUnit / Psalm | pick the pair with currently-working `psalm/plugin-phpunit`, pin once chosen |

## Data model

Unchanged from the previous plan. One `.loan.yaml` per loan, shared `.mappings.yaml` at the Ledgers root. `rate_schedule` always present (first-class). Scenarios persist in the file. Currency is per-loan, display-only. Dates are date-only. See the core `src/schemas/loan.schema.json` for the authoritative definition.

Default folder: `/Ledgers/` (Nextcloud) or user-chosen file location (web). Never auto-created on either target.

## LoanEngine and ScenarioEngine

Behavior identical to the previous plan, now in TypeScript. Pure functions. 100% line coverage.

Forward mutations: `recurring_extra_principal`, `one_time_extra`, `change_rate`, `change_term`, `stop_extra_payments`, `change_escrow`.

Counterfactual mutations: `remove_payment`, `remove_payments_where`, `replace_payment`, `set_original_rate`.

Target: full scenario evaluation for a 30-year loan with a dozen mutations in under 10 ms (browser-side, no HTTP roundtrip).

## UI behavior

Both targets render the same five sections on the loan detail page: summary header, balance-over-time chart, payment composition chart, scenarios panel, rate-schedule editor, amortization table.

Both show a warning banner on files that fail schema validation, with a diff view naming the invalid lines.

Web-only: onboarding view for first-time users, file picker with FSA / fallback.

Nextcloud-only: dashboard widget, Files-app context-menu action, shared-file indicator.

## Phases

### Phase 0: monorepo tooling

Init repo. `pnpm-workspace.yaml` listing `packages/*`. Root `package.json` with shared scripts. `tsconfig.base.json`. `.pre-commit-config.yaml`. `.github/workflows/`. Root `Makefile` delegating to pnpm filters.

Deliverable: `pnpm install && pnpm -r build && pnpm -r test` all green on empty packages.

### Phase 1: `@loan-ledger/core` foundations

Types, JSON schemas, YAML read/validate, CSV parse with mapping application. No engine yet.

Deliverable: `import { parseLoanYaml, validateLoan, ingestCsv } from '@loan-ledger/core'` works. Vitest covers the happy path and at least one failure mode per function.

### Phase 2: `LoanEngine`

Scheduled amortization, actual-payment reconciliation, rate schedule handling, derived values. Fixtures + expected-output snapshots committed.

Deliverable: `LoanEngine` at 100% line coverage, matching hand-verified amortization tables to the cent.

### Phase 3: `ScenarioEngine`

Every mutation implemented and tested individually plus in combinations. Counterfactual preset for "what have my extra payments been worth."

Deliverable: `ScenarioEngine` at 100% line coverage. Benchmark under 10 ms for a 30-year loan with a dozen mutations.

### Phase 4: `@loan-ledger/web` shell

Vite app, routing, onboarding view, FilePicker component (FSA + fallback). Pinia stores. Read a `.loan.yaml` and display its parsed content (no charts yet).

Deliverable: user opens a file, sees its parsed data in a debug view.

### Phase 5: `@loan-ledger/web` loan detail

All five detail sections rendered against real data from `@core`. Edits in the rate schedule and scenarios persist back to the file via the FSA handle (or download fallback).

Deliverable: end-to-end standalone browser app. Usable today by anyone with a YAML file.

### Phase 6: `@loan-ledger/web` CSV import + mappings + valuation

Upload wizard, mapping editor, imports manager. Manual and CustomUrl valuation providers. Mappings persisted to `localStorage` with export/import.

Deliverable: feature parity with what the Nextcloud plan promises, in the browser.

### Phase 7: `@loan-ledger/nextcloud` scaffold + `@core` wiring

Nextcloud app skeleton. `FileScanner` walks `/Ledgers/`, returns raw YAML. Vue frontend imports `@core` and parses the YAML client-side. Minimal detail view to prove the pipe.

Deliverable: a YAML file in `/Ledgers/` renders a computed summary in the Nextcloud app.

### Phase 8: `@loan-ledger/nextcloud` feature parity

Port the same Vue views from `@web` into `@nextcloud`, wiring them to OCS endpoints instead of FSA handles. Rate schedule editor, scenarios, imports, valuation. The components differ in styling (Nextcloud look via `@nextcloud/vue` elements where it makes sense) but behavior is identical because both talk to `@core`.

Deliverable: Nextcloud app reaches parity with the browser app.

### Phase 9: Nextcloud-only features

Dashboard widget. Files-app context-menu action. Sharing verification (read-only and read-write flows).

Deliverable: Nextcloud app exploits what Nextcloud uniquely offers.

### Phase 10: polish and release

PDF export from both targets. `l10n/` scaffolds. Service worker in `@web` for offline. Psalm baseline cleared. Performance pass. Version bumps, changelogs, release artifacts.

Deliverable: both targets at v0.1.0. Browser app deployed to a public URL. Nextcloud app submitted to the app store.

## Testing strategy

`@loan-ledger/core`: exhaustive Vitest coverage. Pure functions, fast, the trusted heart of both apps. Fixture round-trip tests compare full computed state against committed JSON snapshots.

`@loan-ledger/web`: Vitest for stores and composables. Manual smoke test of the FSA flow in Chrome; fallback flow tested in Firefox. No Playwright in v1.

`@loan-ledger/nextcloud`: PHPUnit for `FileScanner` and `FileWriter` only (the thin adapter layer). Vitest for the Vue frontend stores. Manual share-flow verification before release.

Aggregate: `pnpm -r test` runs everything. Coverage floor: 100% on `@core` engines, 80% elsewhere.

## CI

GitHub Actions, organized per-package where it matters.

| Workflow | Packages | Runs |
| --- | --- | --- |
| `ci-core` | core | typecheck, test, build |
| `ci-web` | web | typecheck, test, build, preview-deploy on PRs |
| `ci-nextcloud-php` | nextcloud | lint-php, psalm, phpunit matrix (PHP 8.2–8.5 × stable31/32/33/master) |
| `ci-nextcloud-js` | nextcloud | typecheck, eslint, stylelint, test, build |
| `release-web` | web | on tag `web-v*`, build + deploy to static host |
| `release-nextcloud` | nextcloud | on tag `nc-v*`, build archive + upload to release + App Store push |

Using tag prefixes (`web-v0.1.0`, `nc-v0.1.0`) lets the two targets version independently even though the core is shared. Both targets pin `@loan-ledger/core` via `workspace:*` and the lockfile captures the exact version.

Action versions: `actions/checkout@v6`, `pnpm/action-setup@v4`, `actions/setup-node@v5`, `shivammathur/setup-php@v2`, `actions/cache@v5`.

Dependabot: npm (grouped across all packages), composer, github-actions. Weekly.

Branch protection on `main`: `ci-core`, `ci-web`, `ci-nextcloud-php (stable33 / PHP 8.3)`, `ci-nextcloud-js` must pass.

## Pre-commit

Same framework (pre-commit.com) as the previous plan. Config simplified since there's less PHP surface:

```yaml
repos:
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v5.0.0
    hooks:
      - id: trailing-whitespace
      - id: end-of-file-fixer
      - id: check-yaml
      - id: check-json
      - id: check-added-large-files
      - id: mixed-line-ending

  - repo: https://github.com/editorconfig-checker/editorconfig-checker.python
    rev: 3.0.3
    hooks:
      - id: editorconfig-checker

  - repo: local
    hooks:
      - id: eslint
        name: ESLint
        language: system
        entry: pnpm -r exec eslint
        files: \.(ts|vue|js)$

      - id: stylelint
        name: Stylelint
        language: system
        entry: pnpm -r exec stylelint
        files: \.(vue|scss|css)$

      - id: vitest
        name: Vitest
        language: system
        entry: pnpm -r test
        pass_filenames: false
        stages: [pre-push]

      - id: php-cs-fixer
        name: PHP-CS-Fixer
        language: system
        entry: packages/nextcloud/vendor-bin/php-cs-fixer/vendor/bin/php-cs-fixer fix
        files: ^packages/nextcloud/.*\.php$

      - id: psalm
        name: Psalm
        language: system
        entry: packages/nextcloud/vendor-bin/psalm/vendor/bin/psalm --root=packages/nextcloud --no-progress
        files: ^packages/nextcloud/.*\.php$
        pass_filenames: false
        stages: [pre-push]

      - id: phpunit
        name: PHPUnit
        language: system
        entry: bash -c 'cd packages/nextcloud && vendor/bin/phpunit --testsuite unit'
        files: ^packages/nextcloud/.*\.php$
        pass_filenames: false
        stages: [pre-push]
```

## Dependencies (root)

```
devDependencies:
  typescript: ^5.5
  vitest: ^4
  eslint: ^9
  @typescript-eslint/parser: ^8
  @typescript-eslint/eslint-plugin: ^8
  prettier: ^3
  stylelint: ^16
  pnpm: ^9
```

Shared configs live at the root (`eslint.config.js`, `.stylelintrc.cjs`, `tsconfig.base.json`) and each package extends them.

## What each target gives up

**`@loan-ledger/web`** gives up: live sharing (users email the YAML instead), cross-device sync (no server), multi-file folder scanning on Firefox/Safari (user opens each file), automatic backup (user's responsibility).

**`@loan-ledger/nextcloud`** gives up: nothing. Same features as the previous single-target plan, plus everything it inherits from `@core` improvements.

## Out of scope for v1

Automated valuation providers beyond Manual and CustomUrl.

PMI tracking. Tax tracking. Multi-user annotations. Direct bank-API imports. Mobile-first layout. ARM Monte Carlo simulation.

Service worker / offline mode in `@web` (Phase 11 candidate, not v1).

A separate `@loan-ledger/ui` shared-components package (extract if duplication becomes painful).
