# PlanarMTO — coding agent instructions

## Read first
Read the five governing root documents and the [formal acceptance and deferred-refinement register](docs/c1c-local-acceptance.md#formal-owner-acceptance). Review the coordinated C.1C specification, R5 technical evidence and coding agent transition record for applicable historical context. Do not infer authorization from roadmap entries.

## Product and authority
Apply the [governing product design philosophy](SYSTEM_BIBLE.md#governing-product-design-philosophy) to all measurement and estimating work. Owner decides construction inputs, defaults, scope, acceptance and releases. ChatGPT prepares specifications and independently reviews; Codex implements and validates locally. Existing engines are quantity authority. No silent structural assumptions, inferred excavation/backfill, duplicate scope, missing-as-zero, unapproved pricing or schema migration. Preserve source geometry, canonical feet, stable identities, explicit scope, full precision, history and persistence. Prefer existing modules to new dependencies.

Every measurement capability and interface change requires a product design review against the [governing System Bible contract](SYSTEM_BIBLE.md#governing-product-design-philosophy). Specify primary construction geometry, applicable dependent systems, standard contractor inputs, automatically established relationships, advanced exceptions, and measurement integrity and acceptance safeguards. Review stays within authorized scope.

## Git and safety
The integrated C.1C feature branch is retained for history. Use an isolated documentation branch for staging housekeeping. Confirm clean local state and exact remote head, fast-forward only. Preserve all user changes. No force push, reset, clean, destructive data migration, merge, deployment, secrets access, new infrastructure/spending, dependency or version changes without express authorization. No work directly on main/staging. Local commits in coherent increments; push only the active feature branch when authorized by owner/task and after local validation. Do not use GitHub CI as primary debugging. No parallel coding agents on same working tree. Historical branch cleanup only per exact-SHA guarded manifest in transition document; no unmerged work deletion. Never use live WordPress/project data for tests.

## Validation and evidence
Node 22; locked npm dependencies. Read .github/workflows/validate.yml as current test command authority. Run lint, all six node test suites, build, audit, Chromium Playwright, PHP lint and PDF worker checks; isolated WP integration when environment permits. Report missing environment capability rather than assume pass. Accepted baseline 289 tests (212 Node + 77 Chromium) at cd782e7, CI #188. R5.0A is accepted. The R5.1–R5.2 development baseline is 296 tests (213 Node + 83 Chromium) at 785edbc, CI #190. The validated R5 technical baseline is 307 tests at 7ac4dd9, CI #192. Do not remove, skip or weaken tests to obtain green; if product contract changes, document and replace superseded UI assertions with equivalent or stronger behavioral assertions, preserve mathematical regressions. Reproduce defects with synthetic data and traces; distinguish operator confusion, test fixture error and product defect. Save evidence locally with no private plans or secrets. No automatic retries to hide failures. Final exact HEAD CI mandatory, plus owner visual acceptance in production preview and explicit staging merge approval. Review five root docs at each milestone closure.

## Current authorization and stop gates
The owner accepted R5.12 and C.1C. Application development is frozen at the accepted candidate. C.1C is complete and integrated into staging through PR #12. The current authorization covers integration housekeeping. C.1E is next planned. C.1E requires its own reviewed specification and authorization. R5.13, C.2 and production release are outside this closeout.

## Development execution and resource efficiency

- Use repository documentation as the authoritative source of project context.
- Follow mandatory reading requirements, but avoid repeatedly reviewing unchanged documentation within the same session.
- Limit repository analysis to the approved implementation scope.
- Prefer targeted automated tests during iterative development. Run the complete required validation suite at milestone completion, integration gates and when shared architecture is affected.
- Summarize successful command output. Preserve complete diagnostic logs locally and inspect relevant excerpts when required.
- Avoid reinvestigating resolved issues unless new evidence warrants reconsideration.
- Prefer concise progress reports and consolidated implementation summaries.
- Avoid unnecessary parallel agents, duplicated analysis and redundant test execution.
- Resource efficiency must not supersede correctness, security, data integrity, regression coverage or existing authorization requirements.

### CI monitoring and resource efficiency

- Delegate CI monitoring to `gh run watch` with a 60-second polling interval.
- Avoid frequent model-driven CI status queries.
- Where terminal polling is necessary, use the longest practical wait interval.
- Retrieve concise CI conclusions on success.
- Retrieve relevant failed-step logs only when failures occur.
- Avoid importing complete successful CI logs into the model context.
- Do not repeatedly analyse unchanged CI status.
- Preserve exact-candidate CI verification at all required acceptance gates.
