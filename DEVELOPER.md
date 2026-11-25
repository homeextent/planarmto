# PlanarMTO Developer & Repository Protocol

## Governing workflow

Applies to every developer and AI agent. Read README, SYSTEM_BIBLE, CHANGELOG and the active milestone specification before changing files. Confirm the exact staging baseline and a clean working tree. Never develop directly on staging or main. Staging is the integration branch; main is deployed production. Owner-approved scope, CI, technical review and acceptance are mandatory.

1. Define architecture, bounded scope and acceptance criteria. Do not expand dependencies, infrastructure, spending or release scope without authorization.
2. Branch from validated staging (feature/<increment>-<description> or docs/<description>). Verify branch and repository before editing.
3. Make logical commits on the isolated branch. Open draft PR targeting staging when substantially implemented. Intermediate feature commits need not trigger CI.
4. Review actual CI results for exact HEAD and resolve failures. Review safeguards, regression coverage and code; passing CI is not equivalent to browser acceptance.
5. Obtain owner local production-preview acceptance for visible/interactive changes. Documentation-only changes do not require visual acceptance.
6. Synchronize README, CHANGELOG, SYSTEM_BIBLE, milestone documents and DEVELOPER if workflow changes. Keep Unreleased entries until separately authorized production version bump; record exact commit/run IDs, waivers, limitations and pending gates.
7. Revalidate exact final HEAD, check staging baseline and mergeability, then merge PR into staging only with owner authorization. Verify post-merge push CI and synchronize local staging.
8. Production promotion requires separate explicit authorization, release PR to main, successful CI, approved version/tag as applicable, deployment verification and live smoke tests. Never bypass protections or push directly to main. Do not trigger deployment manually from feature or staging branches.

## Local commands

Repository: homeextent/planarmto. Local path: /media/jeremy/MEDIA/dev/repos/planarmto. Use Node 22 (CI parity). Stop previous dev/preview process with Ctrl+C before dependency installation or builds.

```bash
git status
git fetch origin
git switch staging
git pull --ff-only origin staging
git switch -c feature/example
```

For an existing remote feature branch, use git switch <branch> (or git switch --track origin/<branch> on first checkout), then git pull --ff-only origin <branch>. Check git log -1 --oneline against the validated candidate. Stage only intended paths and inspect git diff --cached before commit. Never use force push, hard reset, or git clean on user work without explicit authorization and preservation review.

Install locked dependencies with npm ci when needed (fresh checkout or dependency lock change); no reinstall required for unchanged dependencies in a working environment. Development server: npm run dev (port 3000, binds all interfaces). Acceptance uses the production bundle:

```bash
npm run lint && npm run build && npm run preview -- --host 127.0.0.1
```

Open http://127.0.0.1:4173 (or port shown by Vite). Local browser storage is distinct from production. Preserve real project data; use disposable fixtures/profiles for destructive or quota tests. Do not deliberately fill normal browser storage.

## CI and exact-commit verification

.github/workflows/validate.yml runs on PRs targeting staging/main, staging pushes, and manual dispatch. It uses Node 22, npm ci, TypeScript lint, persistence/project-document/workspace-controller/measurement-contracts tests, production build, npm audit --audit-level=high, PHP lint, PDF worker naming/reference/byte checks and isolated WordPress integration. Keep tests synchronized with the active milestone.

```bash
npx --no-install tsx --test tests/persistence.test.ts tests/project-document.test.ts tests/workspace-controller.test.ts tests/measurement-contracts.test.ts
npm run lint
npm run build
npm audit --audit-level=high
php -l planar-mto.php
```

The isolated WordPress integration is bash tests/wordpress-integration.sh in the configured CI environment. Do not claim actual SiteGround/browser acceptance from isolated tests.

GitHub connector commit lookup may omit push-triggered runs. Verify with GitHub CLI using the full staging merge SHA:

```bash
gh run list --repo homeextent/planarmto --branch staging --commit <merge-sha> --limit 5 --json databaseId,status,conclusion,event,url
```

Use the exact run ID to retrieve job details and logs. Do not merge against stale or queued CI. If CI discovery is blocked, report the limitation and obtain independent evidence rather than assume success.

## Architecture and storage

Current staging authority: schema v3; C.1A accepted and integrated at c1a0bf7. Four optional typed workspaces with independent geometry/calibration; shared project settings/rates. Specialist contracts are structural groundwork, not completed specialist engines. Preserve existing floor formula regression tests. Unquantified is not zero; assignment is not completeness. No consolidated estimates/print until C.2. Historical legacy/unversioned records are retired, retained without automatic deletion, and unsupported records are export-only. Explicit v2 preview migration is bounded. Separate v3 recovery key. Do not remove historical data as part of normal development.

src/utils/storage.ts selects authenticated WordPress REST or guest localStorage. REST namespace planarmto/v1 handles project CRUD, branding and rates; WordPress project data is user-scoped. Authenticated project failures surface without guest fallback. Full document validation and provisional per-image/project budgets apply. See SYSTEM_BIBLE for governing architecture.

## Production deployment and backups

Production remains v2.15.1 until separately authorized combined B/C release v2.16.0. .github/workflows/deploy.yml runs on main pushes or manual dispatch; it uses npm ci, lint and build, then rsyncs planar-mto.php and dist to SiteGround over SSH port 18765 and attempts cache flush. Manual dispatch is a production operation and must only use the authorized production ref. Do not expose secret values or change hosting configuration without authorization. Verify deployment result and live PDF import, authentication, persistence and release-specific features. Live URL: https://theinnovativegroup.ca/planarmto/.

npm run build:zip creates ../../builds/planar-mto.zip relative to the repository root (verified packaging script). This is an offline backup of the selected committed release when run from a clean checkout; it is not a deployment approval. Preserve prior artifacts separately if needed, because the script replaces the existing ZIP. For a tracked-source backup, git archive -o ../planarMTO.zip HEAD. Review uncommitted/untracked data before creating wider backups. If /planarmto returns 404, investigate deployment and WordPress routing; permalink refresh is a separate administrative operation.

## Current milestone evidence

PR #8 merged into staging at `c1a0bf7` after documentation-only candidate `3d0830e` passed CI #40 ([run 45462442984](https://github.com/homeextent/planarmto/actions/runs/45462442984)). Post-merge staging push [run 45462698052](https://github.com/homeextent/planarmto/actions/runs/45462698052), job 138689310248, completed successfully; owner CLI and job details verified. C.1A formally complete. Production `main` remains v2.15.1 at `0423cb6`.

Next: C.1B roof drafting and measurement after documentation synchronization. No production promotion or C.1B implementation as part of this housekeeping.

## Evidence-driven debugging and browser regression protocol

Owner-approved governing standard (C.1B-R3.8, 2026-11-24). Applies to all future increments and all developers/AI agents.

1. Reproduce reported interactive defects in a disposable browser context with synthetic project data where possible. Record exact source commit, workflow/run, browser and reproduction sequence.
2. Capture relevant evidence: Playwright trace, screenshot, validation messages, console/page errors, persisted source geometry and event sequence as applicable. Inspect evidence before selecting a functional correction. Distinguish a failing assertion from a confirmed product defect; document test-fixture defects separately.
3. State the evidence-supported cause and make a bounded correction. When evidence is insufficient, use a clearly identified diagnostic experiment rather than present a speculative change as a verified fix.
4. Preserve the original regression assertion. Never skip, weaken, retry away or artificially delay a test solely to obtain green CI. Legitimate fixture corrections require documented evidence and equivalent or stronger assertions.
5. Verify the original regression and broader suite on the exact final commit; record unresolved cases and limitations. Browser CI complements, not replaces, owner local acceptance and production-specific smoke tests.

Playwright is an exact-pinned development-only dependency. Chromium runs against a built Vite preview; use fresh contexts and synthetic data. Run locally with npm ci, npm run build, npx --no-install playwright install chromium (when needed), then npx --no-install playwright test. CI installs Chromium with OS dependencies and retains failure screenshots/traces for seven days. Do not capture customer drawings, production credentials or private project records in CI artifacts.

Reference baseline: feature commit f5d8bef9e0ce8f5e53444b87cfb13ce9f5d7b162, CI #78 / run 45515709731, nine browser tests passed, all validation stages passed. The trace-supported delayed auto-fit correction resolved the previously failing first-vertex closure test without relaxing its assertion. This is a feature baseline, not staging integration or owner acceptance. R3.8 coverage expansion remains pending validation.

### C.1B R4-E acceptance preparation

CI #124 (run 45541929342, job 138962262468) verified `73680daf5c7194bb57ba6e1e21493ec858b65f81` with 125/125 tests (87 non-browser, 38 Chromium) and all validation stages successful. R4-E source refinements and regression additions at `3e85cd7` target 127 tests; verify the final feature HEAD's own workflow, not an intermediate run. Use the R4 checklist in docs/c1b-r4-specialist-usability.md and retained R3.9 checklist in docs/c1b-roof-measurement.md. Start from clean exact green candidate SHA, npm ci, lint, build and local preview. Synthetic projects only. Do not interpret CI or checklist preparation as owner acceptance. Record failed, passed, deferred and untested checks separately; preserve staging and main, no merge until explicit renewed owner acceptance and authorization.
