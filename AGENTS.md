# PlanarMTO — coding agent instructions

## Read first
Read DEVELOPER.md, ROADMAP.md, SYSTEM_BIBLE.md, README.md, CHANGELOG.md and docs/coding-agent-transition.md. Current task: C.1C functional reproduction then R5 scope review; read docs/c1c-foundation-measurement.md, docs/c1c-local-acceptance.md, docs/c1c-functional-findings.md and docs/c1c-r5-contractor-workflow.md. Do not infer authorization from roadmap entries or proposed decisions. Resolve contradictions with owner/ChatGPT review before consequential changes.

## Product and authority
Contractor-focused drawing-driven takeoff, not architectural/structural design. Trace calibrated plans; keep calculation complexity internal. Owner decides construction inputs, defaults, scope, acceptance and releases. ChatGPT prepares specifications and independently reviews; Codex implements and validates locally. Existing engines are quantity authority. No silent structural assumptions, inferred excavation/backfill, duplicate scope, missing-as-zero, unapproved pricing or schema migration. Preserve source geometry, canonical feet, stable identities, explicit scope, full precision, history and persistence. Prefer existing modules to new dependencies.

## Git and safety
Continue existing feature/c1c-foundation-measurement and draft PR #12; do not branch from staging again for C.1C. Confirm clean local state and exact remote head, fast-forward only. Preserve all user changes. No force push, reset, clean, destructive data migration, merge, deployment, secrets access, new infrastructure/spending, dependency or version changes without express authorization. No work directly on main/staging. Local commits in coherent increments; push only the active feature branch when authorized by owner/task and after local validation. Do not use GitHub CI as primary debugging. No parallel coding agents on same working tree. Historical branch cleanup only per exact-SHA guarded manifest in transition document; no unmerged work deletion. Never use live WordPress/project data for tests.

## Validation and evidence
Node 22; locked npm dependencies. Read .github/workflows/validate.yml as current test command authority. Run lint, all six node test suites, build, audit, Chromium Playwright, PHP lint and PDF worker checks; isolated WP integration when environment permits. Report missing environment capability rather than assume pass. Existing baseline 288 tests (212 node + 76 browser) at e5e9748, CI #186. Do not remove, skip or weaken tests to obtain green; if product contract changes, document and replace superseded UI assertions with equivalent or stronger behavioral assertions, preserve mathematical regressions. Reproduce defects with synthetic data and traces; distinguish operator confusion, test fixture error and product defect. Save evidence locally with no private plans or secrets. No automatic retries to hide failures. Final exact HEAD CI mandatory, plus owner visual acceptance in production preview and explicit staging merge approval. Review five root docs at each milestone closure.

## Current authorization and stop gates
Transition and documentation housekeeping authorized. First task is local read-only inspection and baseline/functional reproduction, safe branch cleanup per owner request, and R5 implementation plan. R5 product direction endorsed; exact defaults, material catalogue, persistence/ownership semantics and change policy require review/approval before implementation. Do not claim all local acceptance passed. Stop after baseline evidence and R5 decision proposal for owner/ChatGPT review; no R5 application edits until bounded scope approved. Once approved, implement locally in coherent increments without repeated approvals for already authorized scope; stop on material scope conflict or owner acceptance. C.1E, C.2 and release each separately gated.

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
