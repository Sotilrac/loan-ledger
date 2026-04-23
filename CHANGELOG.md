# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Targets are versioned independently:

- `@loan-ledger/web` via `web-vX.Y.Z` tags
- `@loan-ledger/nextcloud` via `nc-vX.Y.Z` tags

## [Unreleased]

### Added

- Monorepo scaffold: `@loan-ledger/core` and `@loan-ledger/web` workspace packages.
- CI pipeline: lint, typecheck, test, build on every branch push (GitLab CI).
- Lefthook pre-commit/pre-push hooks: prettier, eslint, stylelint, editorconfig-checker, typecheck, vitest.
- `@loan-ledger/core` Phase 1: data model types, JSON Schemas (`loan.schema.json`, `mappings.schema.json`), `parseLoanYaml` / `serializeLoanYaml`, `parseMappingsYaml` / `serializeMappingsYaml`, `validateLoan` / `validateMappings` (ajv), `ingestCsv` (papaparse) with bank-CSV column mapping.
- `@loan-ledger/core` Phase 2: `computeLoan` engine — pure function for scheduled amortization, rate-schedule / ARM re-amortization, actual-vs-scheduled reconciliation, derived summary (equity, projected payoff, months ahead). UTC-midnight date utilities. `buildDemoLoan` / `DEMO_LOAN` fallback data.
- `@loan-ledger/web`: renders demo loan with editorial design tokens (`:root { --ll-* }`) — hero equity number, summary blocks, loan-terms grid, recent-payments table with Marigold actual-row borders.
- `@loan-ledger/core` Phase 3: ScenarioEngine with 10 mutations (recurring_extra_principal, one_time_extra, change_rate, change_term, stop_extra_payments, change_escrow, remove_payment, remove_payments_where, replace_payment, set_original_rate). `evaluateScenario` / `evaluateAllScenarios` producing signed `interest_saved` / `months_sooner` deltas.
- `@loan-ledger/web` visualisations: hand-rolled SVG charts faithful to the style guide — `BalanceChart` (scheduled thin Ink Blue @ 0.7, actual thick Marigold, projected dashed, scenario overlays in muted ink), `CompositionChart` (stacked principal / interest @ 0.5 / escrow / Marigold extra), `EquityGauge` (3/4 arc, Marigold fill). Shared `palette.ts` is the single source of truth for the graphical language.
- `@loan-ledger/web` Phase 4: Pinia store (`stores/loan.ts`), file handling (`useFileHandle` composable with FSA API + `<input type=file>` fallback, IndexedDB handle persistence via `idb-keyval`). FilePicker component, AmortizationTable with selection/highlight linkage to BalanceChart via shared `selectedPeriod`, scroll-to-today on mount. Global "Edit loan" button toggles `LoanEditForm` (editable property, valuation, loan-term fields); derived values update live as you type. Save writes to the FSA handle when available, else triggers a download. Dirty-state indicator in the header.
