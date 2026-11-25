# C.1C — actual owner functional findings (2026-11-25)

Evidence: owner screenshots and narrative in ChatGPT acceptance conversation, after docs-only e5e9748 candidate; exact local SHA was not independently captured. CI #186 on e5e9748 passed 288/288. Preserve the distinction between owner evidence and automated verification. No customer plans or screenshots committed. L01 owner PASS; other L checks not fully accepted. Local testing paused for contractor UX reassessment, subsequently agreed to complete technical checks with agent assistance before R5. No staging merge.

| Check | Actual result | Classification / next action |
|---|---|---|
| Calibration/underlay L01 | Owner PASS | Repeat on synthetic calibrated drawing and final actual plan |
| Rectangular perimeter 40×30 exterior, 8 in wall, 8 ft high | 27.13 CY displayed | Basic fixture PASS; coordinate generator not acceptable primary UX |
| Irregular L, 40×40 minus 20×20 notch, 12 in wall, 8 ft high | 46.22 CY displayed | Basic fixture PASS; initial closure confusion, verify trace closure usability |
| Rectangular 24×6 in strip | 5.09 CY displayed | Quantity PASS; prior instruction 10.17 CY was erroneous for 6 in depth |
| Irregular 24×6 in strip | 5.78 CY displayed | Quantity PASS |
| Footing modification | “Remove existing derived strip group before regenerating” after attempting dimension edit | Usability deficiency, explicit replacement checkbox exists; replacement 6→12→6 in NOT RUN locally |
| Envelope waterproofing | “Confirm all four source wall centrelines and widths”; replacement checked separately yielded “No matching derived group to replace” | BLOCKED, likely selected footing assembly instead of walls; not confirmed. Filter foundationWall and select complete wall assembly; test both paths |
| Vertical insulation | Same source warning | BLOCKED; material and layer IDs confusing, thickness decimal feet |
| Drainage | Same source warning | BLOCKED; verify actual selected kinds, then default proposal separately |
| Slab | Screenshot shows Pad footing selected, 1200 SF/14.81 CY and 1 EA | Geometry math verified, slab classification NOT RUN; operator confusion. Draw actual Slab; do not count pad as slab |
| Under-slab insulation | “Confirm an unexcluded, unthickened slab footprint...” while pad selected | Expected validation for pad; real slab test NOT RUN |
| Under-slab granular | NOT RUN | Verify after actual slab and insulation |
| Material text concrete/cement | Owner reports not accepted | Controlled material vocabulary UX finding; exact error not captured. Use canonical poured concrete in baseline |
| Selection labels | “Selected: Foundation (undefined)” for multi-selection, “legacy” for new generated geometry | UX defect; preserve true legacy semantics while fixing new record/status presentation |
| Remaining details, earthworks, stepped runs, history, persistence, diagnostics | NOT RUN locally | Agent technical reproduction; owner practical final acceptance still required |

## Baseline technical task register
Use existing docs/c1c-local-acceptance.md L01–L12 and tests as procedure; do not overwrite observed evidence. Run existing browser cases and supplement gaps with disposable fixtures (not screenshots of customer plans). Record actual status, exact SHA, selected kinds, expected vs actual, screenshot/trace/JSON path where useful. If no real UI interaction possible report NOT RUN, not PASS.

1. Confirm L01 and L02 using synthetic underlay, known 40 ft scale, trace rectangle and L, click closure and Finish, direct typing, snapping and undo. Reproduce initial closure confusion without guessing cause.
2. L04: select foundationWall filter, select one wall then entire assembly. Derive width 2 ft, depth .5 ft, offset 0. Explicit replacement checked: depth 1 then .5. Expect 5.08641975 → 10.17283951 → 5.08641975 CY (display 5.09/10.17/5.09), wall 27.13 unchanged; no duplicate records. Irregular 5.77777778 CY. Verify cancellation and history.
3. L07/L08: same wall filter and complete assembly, replacement unchecked; waterproofing height 6, material membrane, layer wp; vertical insulation height 6, thickness .25, foam enabled, distinct layer; drainage offset 2 ft from wall exterior, pipe layer. Rectangle 840 SF, 840 SF/2520 BF, 156 LF; L 960 SF, 960 SF/2880 BF, 176 LF. Reproduce wrong-kind selection warning separately. If correct wall selection fails, investigate actual metadata, not speculative fixes.
4. L05/L07: actual Slab tool, independent 40×30, poured concrete, depth 4/12, base 0. 14.81481481 CY, reference 1200 SF. Select slab, derive horizontal foam .25 ft offset 0, foam enabled; derive granular .5 ft offset .25; 1200 SF/3600 BF and 22.22222222 CY. Verify no overlap; wrong pad source refused. Test manual coverage and historical granular no-op edit.
5. L05: independent slab exclusion 60 SF then thickening 100 SF total 18 in; 14.07407407 then 18.39506173 CY, 1140 SF reference. Isolated 40 ft wall 8 in ×8 ft, 4×3 opening: 7.60493827 CY; invalid intersections refused. Pad 4×4×1: .59259259 CY/1 EA/16 SF.
6. L06: spatially separate 40×30×8 excavation 355.55555556 CY; 40×2×3 trench 8.88888889 CY; 20×10×6 backfill 44.44444444 CY; 40×30×.5 granular 22.22222222 CY. No inferred earthwork.
7. L03: stepped T fixture from local procedure, net 356/27 CY; test variable width, coordinated edit, base/top, exact reference; isolated 42 ft angled 15 in ×8 ft = 15.55555556 CY; angled intersections pending.
8. L09–L12: direct/shift/window/cross/filter, dependency delete preview cancel/confirm, history, save/reopen, workspace isolation, applicability, partial pending subtotal, pricing unavailable. Verify guest workflow and isolated WP only; no live writes.
9. Report remaining functional defects and test gaps separately from R5 UX requirements. Do not change production code before scope review unless separately authorized. Existing L01 owner pass remains; no agent substitute for owner CA acceptance.

## Quantity corrections
Earlier conversational rectangular 24×6 in strip expectation 10.17 CY was wrong; 10.17 is for 12 in depth. Earlier integrated basement guide lists footing ring 20.3457 CY for 2×1 strip; formula 4×(70−2×8/12)/27 = 10.17283951 CY (not 20.3457). The latter typo must be corrected in the legacy local guide. No engine formula change implied.

## R5.0A baseline stabilization

The owner authorized four presentation and pointer fixes on draft PR #12. The assembly workflow in R5.1–R5.6 remains separately gated.

| Finding | Cause and correction |
|---|---|
| Roof Finish polygon was blocked after diagonal closure | The independently positioned alert overlapped the drafting toolbar and intercepted pointer input. The alert now appears below the toolbar, remains visible and announced, and allows pointer input through its text. |
| Foundation Zoom to Fit was blocked | The dimension form and zoom toolbar shared the same bottom-right anchor. They now stack in one container, with the zoom controls at the bottom and editable dimensions above. |
| Foundation multi-selection displayed an undefined ID | The toolbar counted roof selections and expected a single ID for foundation selections. It now uses the selection count for multi-selection and supports a singleton ID array. |
| Newly generated records displayed legacy scope | The inspector mapped absent applicability metadata directly to the legacy label. It now displays “No explicit decision” whenever the explicit field is absent. The engine continues to issue its existing legacy diagnostic. Stored applicability and reasons are preserved. |

Five targeted Chromium cases passed. The original roof regression verifies that the alert appears, the draft remains uncommitted, and a pointer click on Finish commits the intended 50 SF plane. Foundation coverage verifies pointer zoom with the dimension form active, Escape and keyboard correction, assembly selection count, the scope display and absent applicability metadata in exported records.

Full local validation under Node 22.23.5 passed 289/289 (212 Node and 77 Chromium). The locked install, TypeScript, production build, dependency audit (zero findings), PHP lint and PDF worker checks passed. Full output is under `/tmp/planarmto-r50a/validation.log`.

The prior traces are under `/tmp/planarmto-c1c-192cff3/baseline-artifacts` and `/tmp/planarmto-c1c-192cff3/calibration-artifacts`. Stabilized interaction traces and targeted results are under `/tmp/planarmto-r50a/after-targeted` and `/tmp/planarmto-r50a/targeted.log`. Isolated WordPress remains unavailable locally because Docker is absent. Exact candidate CI and owner preview verification remain pending.

### Owner production-preview checks

Use Node 22, run `npm run build`, then run `npm run preview -- --host 127.0.0.1 --port 4173 --strictPort`. Open the loopback preview in a disposable browser profile and create synthetic roof and foundation workspaces.

1. In the roof workspace, enable Ortho and draft a polygon with two perpendicular legs. Click its first vertex so the closing edge would be diagonal. Verify that the warning is visible and the draft is still uncommitted. Click **Finish polygon** and verify that the intended triangle is committed.
2. In the foundation workspace, zoom in, start a wall, enter a value in **Dimensions** and pointer-click **Zoom to Fit**. Verify that the view fits and the entered value remains. Focus the dimension field, press Escape, and finish or cancel the draft.
3. Generate an independent four-wall perimeter, select one wall and choose **Select entire foundation assembly**. Verify **Selected: 4 Items** and **No explicit decision**. Select an individual wall, apply an explicit exclusion with a reason, then reselect it and verify that both remain visible.
