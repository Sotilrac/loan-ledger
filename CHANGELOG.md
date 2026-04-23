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
