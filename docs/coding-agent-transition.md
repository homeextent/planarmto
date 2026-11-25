# PlanarMTO Coding Agent Transition and Completion Package
Date 2026-11-25. Owner approved transition to hybrid ChatGPT/Codex model, documentation and safe branch housekeeping. This is a repository-controlled handoff, not a release or authorization to merge.

## Immediate checkpoint
Repo homeextent/planarmto; local /media/jeremy/MEDIA/dev/repos/planarmto; active feature/c1c-foundation-measurement, draft PR #12 to staging. Pre-handoff HEAD e5e9748c6d8d4ad1ad362863e36f1dceba95ae65; staging a064baeeb13b3ede95faf04e9aad19a7ab413882; main 0423cb605d99d32b6a537f01e7115157388b9ccd; production 2.15.1; future 2.16.0 separately gated. Schema 3. CI #186 run 45670433567 job 139403930112 independently verified exact pre-handoff commit: 17 persistence +23 architecture +7 lifecycle +5 contracts +50 roof +110 foundation +76 Chromium = 288/288, all supplementary stages passed. New docs-only handoff HEAD must be verified independently; do not assume CI result. Local owner actual SHA not independently established. No merge approval.

## Read order
AGENTS.md, DEVELOPER.md, ROADMAP.md, SYSTEM_BIBLE.md, README.md, CHANGELOG.md; then docs/c1c-foundation-measurement.md (approved D01–D14 + R1–R4), docs/c1c-local-acceptance.md (technical L checks), docs/c1c-functional-findings.md (actual owner observations + outstanding checks), docs/c1c-r5-contractor-workflow.md (proposed R5). Earlier detailed specs in docs/pdf-blueprint-import.md, b1-typed-workspace-architecture.md, b2-workspace-management.md, c1a-measurement-architecture.md, c1b-roof-measurement.md and c1b-r4-specialist-usability.md. These and Git history are complete primary historical record; do not reconstruct architectural rules from this index alone.

## History and milestone evidence
Original browser-native CAD floor takeoff evolved from v1.0.0 (2026-08-12) through v1.1 apertures/decks, v1.2 inclusions/settings, v1.3 PDF output/project directory, v1.4 multipliers/assembly defaults, v1.5 tool presets, v1.6.1 foundation leakage/baseboards, v1.7 dual geometry, v1.8 floor foundation inputs, v1.9 image calibration, v2.0 WordPress endpoint, v2.1 tenant storage, v2.1.1 beta gate, v2.3 master rates, v2.4 ceiling profiles/marquee, v2.5 trade CSV/MEP, v2.6 drywall/ceiling, v2.7 water heaters/windows, v2.8 door rate/inclusions, v2.9 calibration snap bypass, v2.10 sticky snapping, v2.11 thermal/BF, v2.12 origin/underlay, v2.13 crossing walls, v2.14 Ontario rates, v2.14.1 scraper link, v2.14.3 WP sign-in. Exact historical changes/limitations in CHANGELOG. Those floor formulas are regression references, not current consolidated estimate authority.
A: PDF.js import PR #1, v2.15.0 release #2, live worker MIME issue fixed v2.15.1 #3/#4, #5 docs; owner 9/9 live checks, deployment headers/workflow not independently captured. B.1 #6 and B.2 #7 typed workspace lifecycle, v2 schema superseded; B.2 10/10 owner corrective checks, CI #32. C.1A #8 schema v3/explicit scope, owner 14 checks pass, cursor deferred and historical export waived; #9 docs. C.1B #10 independent roof, R4 precision/selection/derivation, exact fb60747 owner 10/10 CI #129 127/127; staging merge 3649f54, #11 roadmap docs staging a064bae. #134 independently verified 127/127, #135 owner reported.
C.1C #12 approved D01–D14; initial geometry through #158 214/214, audit F01–F09 and irregular mandatory. R1 #159–166 exact orthogonal ring, polygon drafting, assembly/junctions, top/base, signed isolated strips, references; #166 235. R2 #167–172 scope, layer stack, foam, irregular envelope/drainage, integration; #172 257. R3 #173–181 continuous/snap/focus, generation guard, source consistency, replacement, manifests, coordinated edit and persisted reference; #181 280. #178 TypeScript defects fixed; #179 incorrect extended T fixture corrected to 356 CF, not 360. R4 #183–185 bounded angled geometry, browser/persistence, residual tool/scope/legacy state; #185 288. #186 docs exact baseline. Owner basic rectangle/L and footings passed; other checks incomplete or blocked. Current UI not accepted for contractor workflow. See findings. R5 proposed; preserve baseline and clarify before implementing.

## Architecture navigation
React/TypeScript/Vite canvas, PHP WordPress plugin, Node 22, pinned Playwright. src/components/CadCanvas.tsx, FoundationWorkspace.tsx and src/App.tsx UI; src/engine/measurements/ specialist files (foundationGeometry, foundationPerimeterGeometry, foundationMeasurements, foundationDetails, foundationDerivation, foundationEnvelopeDerivation, foundationDrainageDerivation, foundationExteriorRoute, foundationLayers, foundationCoverage, foundationManualCoverage, foundationGeneration, foundationTopology, foundationAssembly, foundationApplicability, foundationSelection, foundationSnap, foundationDrafting, measurementTypes); src/engine/projectDocument.ts and workspaceController.ts persistence/history; src/utils/storage.ts guest/WP; existing floor estimator protected. Verify exact paths locally. Canonical feet, source geometry rather than authoritative cached totals; no implicit structural inputs. Separate floor/roof/foundation/site workspaces with shared rates, isolated calibration/history. Legacy retired/export-only, bounded v2 preview conversion, no deletion, separate recovery key. WP REST user-scoped, no guest fallback on auth failures. Existing rate sync/production infrastructure retained, not in scope.

## Agent workflow
Owner defines scope/acceptance; ChatGPT architecture/spec/independent review; Codex local implementation and tests; GitHub source/CI; owner final decision. Local-first debugging, no endless remote CI iterations. Read actual source and reproduce before changes. Stage intended files, inspect diff, logical commits; final exact HEAD CI, owner local preview acceptance, five root docs reconciliation, explicit staging merge, post-merge CI and local sync. Separate release authorization. No autonomous changes to main/staging. No production credentials, new spending or dependencies. If agent lacks a tool, report blocker and concrete safe fallback. Do not run parallel agents on same branch.

## Local launch and validation
```bash
cd /media/jeremy/MEDIA/dev/repos/planarmto
git status --short
git fetch origin
git switch feature/c1c-foundation-measurement
git pull --ff-only origin feature/c1c-foundation-measurement
git status --short
git log -1 --oneline
node --version
npm ci
npm run lint
npx --no-install tsx --test tests/persistence.test.ts tests/project-document.test.ts tests/workspace-controller.test.ts tests/measurement-contracts.test.ts tests/roof-measurements.test.ts tests/foundation-measurements.test.ts
npm run build
npm audit --audit-level=high
npx --no-install playwright install chromium
npx --no-install playwright test
php -l planar-mto.php
```
Stop on dirty tree or mismatch; use tracking branch if local missing. Node 22; npm ci when fresh/lock changed. Playwright starts its own preview at 4173, stop existing server first. Read actual .github/workflows/validate.yml for PDF worker byte/name/reference checks and bash tests/wordpress-integration.sh; run if local environment supports, report blockers. For manual preview after automated browser suite: npm run preview -- --host 127.0.0.1 --port 4173 --strictPort. Use disposable projects. Do not deploy. Use gh run list/view exact head, not old green badge.

## Guarded branch cleanup manifest
Remote audit confirmed PR #12 only open; all other listed PRs merged and all ten historical branch tips are ancestors of staging AND pre-handoff feature. Connector has no branch-delete action; nothing deleted yet. Owner requested cleanup. Re-fetch and verify exact tip, merged PR, no open PR using branch and ancestor of staging before each deletion. Preserve main/staging/active branch. If any mismatch, skip and report. Use lease-protected deletion (git push --force-with-lease=refs/heads/<branch>:<expected-sha> origin :refs/heads/<branch>) ONLY for this explicitly audited deletion list; this is not permission to force-update any ref. If policy prohibits lease deletion or rejects, stop; no unguarded fallback. Keep local branches unless separately reviewed, no git branch -D. Fetch --prune after successful remote deletions. Merged commit history remains reachable via staging.

| Branch | Expected SHA | Merged PR |
|---|---|---|
| docs/c1a-system-synchronization | af94a161d4557284203eb78cffd5c3d299ceba8d | 9 |
| docs/c1b-closeout-roadmap | 4a44a3f3517c761258e4e3b6ce70a8bc4fd1773f | 11 |
| docs/increment-a-closeout | 1da4a0fe1a68a54be2e52683769e0435d6689ea4 | 5 |
| feature/b1-typed-workspace-architecture | 7377dd7b9287daed0b4c62d5f83d1252d50de8fa | 6 |
| feature/b2-workspace-management | 32c1569c55907f98141ab5788fc054bcf0fe800e | 7 |
| feature/c1a-measurement-architecture | 3d0830e224d1cf4f2b22596656cd3b54ca8b5fc5 | 8 |
| feature/c1b-roof-measurement | 8d707902adbf7365ef6e78a64bdab90ce634732e | 10 |
| feature/pdf-blueprint-import | 1a0f324ea9fbbf399efbafc678a520202f6c887a | 1 |
| hotfix/v2.15.1 | c9122dc62312d026c057a03267dfa909e0cfb137 | 3 |
| release/v2.15.0 | a2c36ec3ad9c58e728881ffc00c8e8b504a6604e | 2 |

## Remaining roadmap / stop gates
1. Baseline reproduction and R5.0A stabilization are complete. [R5.0A acceptance](c1c-functional-findings.md#r50a-formal-acceptance) records accepted application SHA `cd782e7`, CI #188 and owner findings. Obtain coordinated R5.0 specification approval before implementing R5.1–R5.6.
2. R5.1–6 contractor workflow on same feature branch; technical checks and new CA01–12, real plan owner acceptance. Reconcile five docs, explicitly authorized merge #12, postmerge CI.
3. C.1E separate specification: cross-workspace ownership/physical identity, completeness independent of assignment, included/excluded/pending, duplicate prevention, reference areas nonadditive, measured vs manual/allowance/quote provenance; optional site not required. No consolidated pricing until C.2. Owner approval then branch from validated staging.
4. C.2 separate specification: consolidated MTO, contractor manual quantities and allowances/quotes, pricing/rates, waste applied once, completeness/reporting gates, traceable unit and cost basis, existing floor costs protected but not automatically authoritative. No site cost exclusion just because site engine deferred.
5. Separate v2.16.0 release decision, PR staging→main, exact CI, deploy/live checks. C.1D dedicated site drafting deferred beyond release; D drawing library/revisions, E overlays, F optional 3D future only. No blanket authorization to complete future milestones autonomously.

## First Codex task (copyable)
Read AGENTS.md and the transition package plus linked governing documents. Inspect current repository, verify branch/cleanliness/exact head and CI. Complete safe merged branch housekeeping per manifest if permissions permit. Reproduce baseline functional tests using local build and Playwright, recording exact source, selected kinds, actual quantities, diagnostics and evidence. Do not change production application code yet. Return baseline results, confirmed defects vs usability findings, remaining gaps and a bounded R5.0 implementation plan with the unresolved default/material/ownership decisions for owner/ChatGPT review. Preserve draft PR #12, staging and main. Stop at review gate.
