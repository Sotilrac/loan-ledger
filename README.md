# Loan Ledger

A local-first mortgage and loan dashboard. Open a human-readable `.loan.yaml` file in your browser and see equity, payment splits, projected payoff, and scenario comparisons. Nothing is uploaded. Parsing and math run entirely in your browser.

Live: [loanledger.asmat.ca](https://loanledger.asmat.ca/)

## Features

- **Fully offline after first load**, no account, no server, no sync.
- **No bloat, no ads.** The app is small, loads fast, and runs entirely on your machine.
- **Insight cards:** balance, monthly payment, rate, interest paid, principal paid, current valuation, appreciation, interest saved, and how far you are ahead of the lender's schedule.
- **Balance chart:** scheduled, actual, and "current pace" trajectories, plus overlays for each active scenario, with a sticky hover tooltip that also updates the amortization table selection.
- **Scenarios panel:** what-if and counterfactual mutations, including recurring or one-time extra principal, rate changes, term changes, refinances, and "what if I hadn't made these extras".
- **Amortization table:** full ledger with sticky year headers, a today marker, and an annotated "crossover" row (first month where scheduled principal ≥ scheduled interest).
- **Rate schedule** to support ARMs and refinances.
- **CSV import:** payment ingestion from bank exports, with a one-time per-bank column-mapping wizard saved in `localStorage`.
- **One YAML file per loan:** human-readable, git-friendly, hand-editable.
- **Save in place** when the browser supports the File System Access API; otherwise edits download as a new copy of the YAML.

## Using the app

1. Visit [loanledger.asmat.ca](https://loanledger.asmat.ca/). The demo loan loads immediately.
2. **Load loan** → open a `.loan.yaml` file from disk (or click **Use demo data** to explore the example).
3. **Edit** → change any field via the form (property details, loan terms, rate schedule, scheduled extras, scenarios).
4. **Import payments** → paste or upload a CSV from your bank; map columns once, reuse the mapping next time.
5. **Save to file** writes back to the file you opened (when the browser supports it); **Save** always downloads a copy. Both produce the same YAML.

## A minimal loan file

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

Full schema: [`packages/core/src/schemas/loan.schema.json`](packages/core/src/schemas/loan.schema.json).

Conventions: dates are date-only (`YYYY-MM-DD`). Currency is a per-loan
display hint, not converted across loans.

## Development

Requires Node 24 LTS and pnpm 10+ (both pinned via `.nvmrc` and
`packageManager`).

```bash
git clone https://gitlab.com/sotilrac/loan-ledger.git
cd loan-ledger
nvm use && corepack enable
pnpm install
make install-hooks
```

Daily targets:

```bash
make dev         # web app dev server (Vite HMR)
make build       # build all packages
make test        # run the full test suite
make lint        # ESLint + Prettier + Stylelint
make format      # auto-fix formatting and lint
make typecheck   # tsc + vue-tsc
make deploy      # build then deploy to Cloudflare Pages (wrangler)
```

The heart of the app is `@loan-ledger/core`: pure TypeScript, 100% line coverage on `LoanEngine` and `ScenarioEngine`, hand-verified amortization tables as fixtures. `@loan-ledger/web` is a thin Vue 3 + Vite shell over that core.

Pre-commit hooks run Prettier, ESLint, Stylelint, and editorconfig-checker on staged files (Lefthook). Pre-push runs typecheck and Vitest across the workspace.

## CI and releases

GitLab CI (`.gitlab-ci.yml`) runs install → lint/typecheck/test → build → deploy. The `deploy:cloudflare` job pushes the static bundle to Cloudflare Pages on every push to `main` (needs `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as masked variables).

## Contributing

Conventional Commits. Scope to one package where possible (`feat(core): ...`, `fix(web): ...`). Changes that affect computed output require fixture updates in `@loan-ledger/core`.

## License

MPL-2.0. See [`LICENSE`](LICENSE).
