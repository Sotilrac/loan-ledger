# Loan Ledger

A local-first mortgage and loan dashboard. Open a human-readable `.loan.yaml` file in your browser and see equity, payment splits, projected payoff, and scenario comparisons. Nothing is uploaded. Parsing and math run entirely in your browser.

## Why

Most people interact with their mortgage through a bank statement that hides the things that actually matter: where each payment really splits between principal and interest, how the balance moves over the life of the loan, what an ARM rate-reset will do to next year's bill. Loan Ledger turns those numbers into something you can see at a glance, so you can build an intuition for your loan instead of taking the lender's word for it.

The bigger payoff is the scenarios panel. Want to know whether rounding up your payment by a hundred dollars saves more than dropping a windfall on the principal once a year, or whether a refinance at a lower rate beats accelerating the existing one? Drop in a few what-ifs side by side, watch the balance curves diverge, and read off the interest-saved and months-sooner deltas. The choices that look identical on a bank's calculator usually aren't, and you can find the cheaper move in your specific situation before you commit.

Because each loan is a plain YAML file, you can hand-edit it, version it in git, and (in the Nextcloud app) share the folder with a partner so you're both looking at the same numbers without anyone needing a separate account.

- **Standalone web app** at [loanledger.asmat.ca](https://loanledger.asmat.ca/), or self-hosted from `packages/web/dist`. Uses your browser's File System Access API to edit a local `.loan.yaml`.
- **Nextcloud app** (`@loan-ledger/nextcloud`) that reads `.loan.yaml` files from a configurable folder (default `/Ledgers/`) so a household can share loans across accounts using normal Nextcloud sharing. See [Testing with Nextcloud](#testing-with-nextcloud) below.

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

### Workspace layout

| Package                  | What it is                                                                                                                                                           |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@loan-ledger/core`      | Pure TypeScript engine: parsing, validation, `LoanEngine`, `ScenarioEngine`. No DOM, no network. 100% line coverage on the engines.                                  |
| `@loan-ledger/ui`        | Shared Vue 3 components (charts, amortization, scenarios, edit form, CSV import) and the `useLoanStore` / `useMappingsStore` Pinia stores. Consumed by both targets. |
| `@loan-ledger/web`       | Standalone browser app: file-picker, FSA/IndexedDB plumbing, `localStorage` mappings store, Cloudflare Pages bundle.                                                 |
| `@loan-ledger/nextcloud` | Nextcloud app: PHP `IRootFolder` adapter, OCS API, Vue SPA bound to OCS-backed sources, shared `.mappings.yaml` for cross-account sync.                              |

Bug fixes and features in `@core` and `@ui` land in both targets at once.

Pre-commit hooks run Prettier, ESLint, Stylelint, and editorconfig-checker on staged files (Lefthook). Pre-push runs typecheck and Vitest across the workspace.

## Testing with Nextcloud

The `make nc-dev` target spins up a local Nextcloud (33, SQLite, admin/admin) at `http://localhost:8080` with this repo bind-mounted as the `loanledger` app. You don't need a host PHP install; everything runs in containers.

```bash
make nc-install      # composer install (one-time, runs inside docker)
make nc-build        # build the Vue bundle into js/ and css/
make nc-dev          # docker compose up — Nextcloud boots in ~30s
make nc-dev-enable   # occ app:enable loanledger inside the container
```

Open `http://localhost:8080` (admin / admin), then **Apps menu → Loan Ledger**. The first time you visit, the configured folder (`/Ledgers/` by default) is empty — go to **Files**, create the `Ledgers` folder, and drop a `.loan.yaml` into it. Reload the app to see it in the list.

Useful cycle commands:

```bash
make nc-build        # rebuild Vue bundle after frontend edits — refresh the browser
make nc-dev-logs     # tail container logs
make nc-dev-down     # tear it all down (drops the volume; user data is lost)
```

PHP / Vue iteration is hot in the sense that bind-mounting picks up file changes immediately. The Vue bundle does need a rebuild after edits; the PHP side does not. To clear OCS / template caches inside the container after PHP changes:

```bash
docker compose -f packages/nextcloud/dev/docker-compose.yml exec --user www-data \
  nextcloud php occ maintenance:repair --include-expensive
```

### Verifying cross-account sharing

Cross-account sharing is the entire reason for the Nextcloud target — the goal is "drop a `.loan.yaml` somewhere shared and your partner sees the same numbers."

1. Create a second user in Nextcloud (top-right avatar → **Users**).
2. As `admin`, share the `Ledgers` folder with that user.
3. Log out, log in as the other user, accept the share. The folder lands at `/Ledgers/` on their side too.
4. Open **Loan Ledger** as the second user. Same loan, same chart, same numbers.
5. Edit a scenario or import a payment, save. Switch back to `admin` — the change is there.

If user A and user B edit the same loan at the same time, the second `Save` returns `412 Precondition Failed`; the UI shows a "file changed externally" banner so you don't silently clobber each other's changes. That's wired through the `If-Match: <mtime>` header on every PUT.

### Without docker

If you'd rather run against an existing Nextcloud install:

1. `make nc-install && make nc-build` to populate `vendor/`, `js/`, and `css/`.
2. Copy or symlink `packages/nextcloud/` into your Nextcloud's `apps/` (or `custom_apps/`) directory as `loanledger`.
3. `php occ app:enable loanledger`.
4. Visit the Loan Ledger entry in the apps sidebar and follow the same setup steps.

PHP unit tests work the same way — `make nc-test` runs against `nextcloud/ocp` interface stubs without booting a real Nextcloud.

## Publishing to the Nextcloud App Store

The App Store uses an internal CA: you generate a signing key, submit a CSR for the app id, and Nextcloud's security team issues you a certificate that the store uses to verify your release tarballs. The key never leaves your machine, the cert is public.

### One-time: get a signed certificate

**Step 1.** Generate the key and CSR (the `CN` must match the `<id>` in `appinfo/info.xml`):

```bash
mkdir -p ~/.nextcloud/certificates
openssl genrsa -out ~/.nextcloud/certificates/loanledger.key 4096
openssl req -new -key ~/.nextcloud/certificates/loanledger.key \
  -out ~/.nextcloud/certificates/loanledger.csr -subj "/CN=loanledger"
```

**Step 2.** Submit the CSR by opening a PR against [`nextcloud/app-certificate-requests`](https://github.com/nextcloud/app-certificate-requests) (preferred, leaves an audit trail), or by emailing the CSR to [security@nextcloud.com](mailto:security@nextcloud.com).

**Step 3.** They merge and publish the signed cert at `<appid>/<appid>.crt` in that repo. Save it next to the key (`~/.nextcloud/certificates/loanledger.crt`).

### Per release: build, validate, sign, submit

```bash
make nc-validate       # runs xmllint against the live App Store schema
NC_KEY=~/.nextcloud/certificates/loanledger.key make nc-package
```

`nc-package` runs `nc-install` and `nc-build`, copies the runtime files into `dist/loanledger/` (honoring `.nextcloudignore`), packs `dist/loanledger-<version>.tar.gz`, and writes a base64 signature to `dist/loanledger-<version>.tar.gz.sig`.

Push the tarball to a public HTTPS URL (a GitLab/GitHub release asset is canonical) and POST it to the App Store API:

```bash
curl -X POST -H "Content-Type: application/json" \
  -u "<your-account>:<your-app-store-token>" \
  https://apps.nextcloud.com/api/v1/apps/releases \
  -d "$(jq -n \
    --arg url 'https://gitlab.com/sotilrac/loan-ledger/-/releases/nc-v1.0.0/downloads/loanledger-1.0.0.tar.gz' \
    --arg sig "$(cat dist/loanledger-1.0.0.tar.gz.sig)" \
    '{download: $url, signature: $sig, nightly: false}')"
```

The store fetches the URL, verifies the signature against your registered cert, and validates `info.xml`. First-time submissions go to a manual review queue; subsequent releases on the same `<id>` auto-publish.

### `info.xml` checklist

Anything user-visible in the App Store listing comes from `appinfo/info.xml`. The validator (`make nc-validate`) catches structural issues, but a few content gates are worth eyeballing:

- `<licence>` must match an enum value (`MPL-2.0`, `AGPL-3.0-or-later`, `Apache-2.0`, `MIT`, ...). Lowercase variants are rejected.
- `<screenshot>` URLs must be publicly reachable HTTPS PNGs. The placeholder URL in this repo points at `packages/nextcloud/appinfo/screenshot.png`; drop a real screenshot there before the first publish.
- `<dependencies><nextcloud min-version=".." max-version=".."/></dependencies>` is what makes the app appear (or not) in each user's update list. Bump `max-version` when you've tested against a new NC release.

## CI and releases

GitLab CI (`.gitlab-ci.yml`) runs install → lint/typecheck/test → build → deploy on every push. The JS pipeline is always-on; the `ci-nextcloud-php-test` and `ci-nextcloud-php-lint` jobs run on a `php:8.2-cli` image and are gated by `changes: packages/nextcloud/**/*`, so JS-only commits don't pay the PHP install cost. The `deploy:cloudflare` job pushes the standalone web bundle to Cloudflare Pages on every push to `main` (needs `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as masked variables).

## Contributing

Conventional Commits. Scope to one package where possible (`feat(core): ...`, `fix(web): ...`). Changes that affect computed output require fixture updates in `@loan-ledger/core`.

## License

MPL-2.0. See [`LICENSE`](LICENSE).
