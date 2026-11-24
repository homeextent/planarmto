# B.2 — Typed workspace management and persistence

Status: owner accepted for staging integration; final documentation candidate CI pending. Based on accepted B.1 staging commit 0c19c0874350292f6f633ab72f5ae60589f0c758. Production v2.15.1 remains unchanged. B and C are jointly gated for v2.16.0.

## Implemented candidate

- Canonical ProjectDocument schema v2 controls the active workspace. Floor, roof, foundation and site workspaces may be added, named, selected, reordered or deleted. Final workspace and assigned scope owners are protected. Deletion requires confirmation.
- Existing CAD engine receives an active-workspace view. Workspace switching remounts canvas/header, clears selection, clipboard and transient tool state and restores per-workspace history. Shared settings are centrally stored. Undo/redo restores geometry while retaining current shared settings.
- Blueprint imports retain per-workspace calibration and source metadata; stale async imports are invalidated by remount/request token and state identity checks. The provisional per-image cap is 850,000 characters; complete project cap is 4,000,000 serialized characters. These caps are not actual browser or SiteGround capacity guarantees.
- Full typed documents are used for named saves, Save As, directory backup/import, duplication and autosave. Imported JSON opens as an independent unsaved copy. Directory imports and duplication use new identities. Authenticated read failures surface rather than falling back to guest records; unreadable local directory cannot silently become an empty index. Legacy single-workspace compatibility remains.
- New explicit projects and expanded legacy projects do not display authoritative cost/MTO or print reports until C. Existing single-workspace legacy estimator remains available. Directory placeholders are explicitly labelled pending/not quantified; stored numeric summary placeholders are not measured zero quantities.
- Roof/foundation/site tool specialization, explicit scope transitions, measurement ownership enforcement and consolidated pricing remain C.1/C.2 tasks. No production deployment or version bump.

## Validation

CI runs existing eight B.1 architecture cases, expanded persistence cases, workspace lifecycle/budget cases, TypeScript, production build, audit, PHP syntax, PDF worker delivery and disposable WordPress/MariaDB integration. The added real HTTP fixture contains three independent approximately 800 KB synthetic rasters; verifies complete typed document round trip. Synthetic bytes are not proof of browser image decoding or actual SiteGround capacity.

Local acceptance must test:
1. Create all four workspace types; rename, reorder and switch; confirm populated deletion and last/assigned owner protection.
2. Import distinct PDFs/images; calibrate each differently; switch repeatedly and verify geometry, image, opacity, position and scale.
3. Draw and edit on two floors; undo/redo each independently; test selection, clipboard, calibration and delayed import cancellation across switches.
4. Save, reload, Save As, duplicate, export/import complete document; restore autosave; verify names/IDs and all workspaces; no original overwrite.
5. Open representative historical projects, including alias underlays, and verify single-workspace quantity parity and explicit incomplete-estimate gating when adding a workspace.
6. Exercise at least three realistic images and storage exhaustion; rejected imports and saves must preserve previous document and saved data. Verify guest and authenticated paths separately where available.
7. Confirm existing PDF import, drafting and legacy reports remain usable. No specialist takeoff or consolidated MTO is expected in B.2.

## Known limits and next gates

Automated controller tests are not browser-level tests of React event ordering or drag history. Storage limits, async interactions, historical records, and actual browser recovery need local testing. Undo/redo does not undo global settings or workspace management operations. Specialist workspaces currently expose the existing generic CAD tools only. SiteGround production smoke testing remains gated until combined B/C release. No new infrastructure or dependencies.

## Corrective acceptance increment (B.2-R1–R7)

Owner initial local review: 13 of 17 checks passed; shared settings/rates, recovery, quota failure and incomplete-estimate check pending. Reported false dirty warning after refresh and cursor lag in production-bundle preview. Corrective scope approved. Startup hydration no longer dirties blank projects; recovery dialog offers restore or blank start and retains previous draft until replaced. Successful matching manual save clears recovery; autosave validates document and aggregate budget before replacement. Internal render adapter structurally shares immutable geometry/settings; transient updates defer validation, committed edits validate active geometry/settings and persistence validates the full document. Removed unused cost computation and repeated blank MTO calculation. Public detached adapter remains unchanged. Added five regression cases (29 total). Initial CI #25 passed before these additional changes; final corrective CI and local performance comparison are required. No claim of measured browser speedup. Retest recovery, clean startup, shared rates/settings, undo/redo and workspace isolation, incomplete report notice, and responsive drafting against v2.15.1. Browser quota test should use disposable origin/profile, not existing client data. Production and staging remain gated.

## Owner acceptance and staging authorization — 2026-11-24

Corrective candidate 5d821f706b7e8d0818f19ea0bc512b30b6086aab passed Validate PlanarMTO #29, run 45447983433, job 138636973645: 14 persistence, eight architecture and seven workspace lifecycle tests (29 total); zero audit findings; build, PHP, worker delivery and three-workspace WordPress/database round trip passed. Owner confirmed all ten non-performance corrective checks passed, including storage safeguards, without an independently witnessed browser quota exhaustion test. Cursor responsiveness initially pending. System sampling showed 77–95% CPU idle and 9.8 GiB available RAM, NVIDIA GTX 1060 3GB sampled at 93% GPU use, Chrome hardware-accelerated Canvas/compositing and mixed display refresh rates. Owner reported no cursor lag after changing display settings near 60 Hz. Environmental contribution suspected, not conclusively isolated; no sustained or controlled v2.15.1 comparison independently recorded. Owner subsequently authorized proceeding. Accept functional B.2 for staging, retain performance observation for regression monitoring. No further source changes in documentation closeout. C.1/C.2 and production promotion remain separately gated.
