# C.1C R5 technical candidate and acceptance register

R5.6C application candidate `5a6db24aaab462d4dda888a18be08515709df849` retains 322/322 reported local regressions. Independently verified [CI #196](https://github.com/homeextent/planarmto/actions/runs/45825822174) passed, including isolated WordPress integration. Draft PR #12 targets staging. Full R5 practical owner acceptance remains withheld. Schema v3 and production 2.15.1 remain current. Earlier entries are preserved as milestone evidence.

R5.3–R5.5 implementation against the approved coordinated specification and the revised v3 persistence design at `1be740b`. The 296-test R5.1–R5.2 candidate remains the regression baseline. Review applies to draft PR #12. Actual-plan owner acceptance and staging approval remain separate.

The owner withheld full R5 acceptance after practical use of R5.6A candidate `eb5624c00a29ec3c91f325333f6743d6936e01a0` (CI #193 and 311/311 reported local checks). The [R5.6B usability plan](c1c-r5-6b-usability-plan.md) records the incomplete practical acceptance items, an unresolved owner-reported footing visibility concern that the synthetic Chromium check did not reproduce, and the proposed contractor workflow and relationship changes. Independent plan approval is complete. The owner authorized UX-01 through UX-21 and the bounded optional v3 contract. Independent implementation review and targeted practical acceptance are the next gates.

## Implementation and boundaries

- `foundationAssemblyModel.ts` implements the approved optional v3 records. `foundationAssemblyValidation.ts` validates structural fields, trace and route order, role ownership, generated child agreement, retained references, catalogue entries, snapshots and caps. `projectDocument.ts` validates optional additions at read and serialize boundaries. Existing documents without the fields remain on the existing path.
- `foundationAssemblyController.ts` previews from immutable project identity and a saved revision, preserves independent measured contributions, validates both parent and children, rejects stale or altered previews and applies in one workspace replacement. `workspaceController.ts` and `App.tsx` capture the graph as one undo/redo entry. Presets are project-local and an applied snapshot remains self-contained.
- `foundationAssemblyRegeneration.ts` orchestrates existing perimeter, strip, coverage, drainage, slab, under-slab and quantity engines. Role IDs follow source segments and layer IDs. Debug diagnostics distinguish incomplete specification from pending or excluded scope. Dormant and retired identities, explicit child-scope decisions and reasons remain persisted.
- `FoundationAssemblyPanel.tsx` implements direct parent selection, confirmation, scope and material editing, local preset versions, adoption previews, advanced independent slab and drainage adoption, and material quantities. Existing specialist tools remain available, grouped under advanced component controls for owned selections. Standard assembly fields support compound imperial and explicit metric entry. Metric quantities are presentation only. Board feet and footprint references remain informational.
- Explicit footing elevations other than confirmed wall base, nonzero offset strips on a connected perimeter, and derived coverage for steps or complex openings follow the existing engine limits. Use separately traced details when the coordinated engine cannot reconcile them. Offsets and nonstandard geometry are never approximated.
- R5.6A resolves the previous detachment conflict with a non-owning released-group audit. Complete active systems or exterior layers can be released when all affected dependencies remain valid. Owned and independent contributions are checked before Apply. The browser offers graphical corner correction and a bounded orthogonal inset or projection. Every correction records its previous trace and explicit replacement lineage where a source edge changes. Intersecting, ambiguous and unsupported transitions are refused.

## Approved requirement register

**Verified** means a named automated path or preserved regression directly checks the behavior. **Covered** means implementation is present and directly related contracts pass, with additional specific cases still useful. **Partial** and **Open** indicate an identified remaining requirement or acceptance gate.

| ID | Status and evidence |
|---|---|
| R51-01 | Verified. Graphical rectangle browser case uses two clicks without coordinates. |
| R51-02 | Verified. Graphical 40×30 correction checks exact quantity and one history entry. |
| R51-03 | Verified. Existing simple irregular L/T/U geometry and perimeter browser regressions retained. |
| R51-04 | Verified. Start-node snap and feedback exercised in continuous tracing. |
| R51-05 | Verified for independent centreline endpoints. Browser checks exact snap and separate ownership. |
| R51-06 | Verified. Continuous orthogonal perimeter uses validated preview and Apply. |
| R51-07 | Verified. Invalid closure remains editable and can be canceled without writes. |
| R51-08 | Verified. Existing exterior/centreline/interior numerical tests, exterior and interior browser cases. |
| R51-09 | Verified on synthetic calibrated drawing through an owned assembly and coordinated drain Apply, zoom and reopen. Actual plan open. |
| R51-10 | Verified. Existing accepted regressions retained. |
| R52-01 | Verified for displayed section dimensions, compound imperial and metric in the assembly editor. |
| R52-02 | Verified. Parser and browser fractional inputs. |
| R52-03 | Verified. Unit switching preserves canonical records. |
| R52-04 | Verified. Context-sensitive catalogue choices. |
| R52-05 | Verified by coordinated exterior layer test. Two distinct materials contribute; duplicate coverage remains unresolved. |
| R52-06 | Covered. Required custom input and category validation. Existing browser test checks historical and custom materials. |
| R52-07 | Verified. Old material records survive import and save. |
| R52-08 | Verified. Unsupported historical concrete remains unquantified. |
| R52-09 | Covered. Standard scope, material and layers avoid manual internal IDs, while specialist controls remain available. |
| R52-10 | Verified. Existing quantity and persisted field assertions remain. |
| R53-D01 | Verified. Browser adoption, coordinated preview, Apply, undo, redo and reopen. |
| R53-D02 | Verified. Confirmed wall material, width, height, original trace and datum determine owned walls. |
| R53-D03 | Covered. Confirmed centred footing and explicit nonstandard inputs. The strip engine refuses unsupported offsets on a connected perimeter. |
| R53-D04 | Verified. Included partial wall scope reports missing inputs while independent drainage remains measurable. |
| R53-D05 | Verified. Coordinated exterior layer test preserves source/material separation. |
| R53-D06 | Covered. Explicit, confirmed full height, or manually specified net coverage in the model. Unsupported derived opening or step coverage requires manual net coverage. |
| R53-D07 | Verified. Centred footing produces exact 150.66667 LF at a confirmed 8 in footing-edge offset. |
| R53-D08 | Covered. Explicit wall-face route or adopted manual route uses the existing engine, with pending diagnostics where footing edge is unavailable. |
| R53-D09 | Verified for independent slab extent by engine test. Interior polygon uses the existing perimeter engine and explicit confirmation. |
| R53-D10 | Verified. Independent slab-stack test checks values and actual elevations. |
| R53-D11 | Verified. Browser saves project-local preset versions and applies a confirmed snapshot. |
| R53-D12 | Verified. A new local preset version leaves the applied snapshot intact, including after removal and v3 round trip. |
| R53-D13 | Verified. Established independent excavation/backfill regressions retained. No coordinated inference. |
| R53-D14 | Verified. Included incomplete and pending are distinct with no generated placeholder quantity. |
| R53-D15 | Covered. Existing engine bounds and explicit configuration. No engineering determination. |
| R54-01 | Verified by the supplemental two-parent workspace probe. Ownership stays independent while one parent is revised. |
| R54-02 | Verified. Thickness change preserves the original trace. Separately confirmed graphical corner and segment corrections retain prior revision provenance. |
| R54-03 | Verified. CA05–07 fixture changes wall and strip quantities using current derivations. |
| R54-04 | Verified. Browser preview leaves exported measurement count unchanged. |
| R54-05 | Verified. Browser Apply creates eight measurements from four with one history transition. |
| R54-06 | Verified. Rejected stale, tampered and invalid previews leave the saved state intact. |
| R54-07 | Verified. Browser undo and redo restore exact workspace equality including parent graph. |
| R54-08 | Verified. Equivalent intent is idempotent. |
| R54-09 | Verified. Scope and IDs survive dormant reactivation, detachment and explicit re-adoption with the exact exclusion reason. |
| R54-10 | Verified. Detachment preserves known contributions and prevents coincident regeneration after independent changes or deletion. Linked dependants block release. |
| R54-11 | Verified. Manual drainage and bounded trace segment replacements record child lineage and prior trace through v3 round trip. |
| R54-12 | Verified for perimeter and independent slab adoption, plus explicit re-adoption of detached strips without duplicate quantities. |
| R54-13 | Verified for compatible stepped wall override preservation, complete-group detachment, and targeted corner and edge correction. Unsupported or ambiguous dependency changes are refused. |
| R54-14 | Verified. Stale and tampered preview tests. |
| R54-15 | Verified. Save/export/reopen of synthetic assembly and controller v3 round trips. |
| R54-16 | Verified. Accepted numerical and persistence regression suites retained. |
| R55-01 | Covered. Primary foundation tool list with advanced tools grouped. |
| R55-02 | Verified. Existing specialist browser tests exercise advanced tools. |
| R55-03 | Covered. Assembly panel adapts to selected parent or adoptable perimeter. Legacy specialist inspector remains for independent work. |
| R55-04 | Covered. Standard assembly and advanced sections are separate for owned selections. Legacy specialist tools remain accessible for independent work. |
| R55-05 | Verified. Parent selector and owned-component selection in graphical assembly flow. |
| R55-06 | Covered. Distinct included, excluded and pending states, system and component reasons. |
| R55-07 | Verified. Existing dashed preview and committed geometry with separate browser export assertions. |
| R55-08 | Covered. Validation errors are presented at Preview and Apply. |
| R55-09 | Covered. Material-tagged summary groups engine rows without changing canonical quantities. |
| R55-10 | Covered. Assembly summary labels board feet informational and slab areas reference only. Existing tests preserve non-additive footprint references. |
| R55-11 | Verified. Preview shows unresolved system and material information. Data-level tests separate quantity and material completeness. |
| R55-12 | Verified. Existing consolidated pricing gate retained. |
| R56-01 | Verified by the full local regression suite. |
| R56-02 | Verified for the bounded R5.6A scope. Controller and browser evidence covers detachment, override provenance, graphical corrections, presets and atomic history. Unrestricted topology editing and unsupported engine geometry remain outside the bounded workflow. |
| R56-03 | Open until exact-candidate CI is independently verified. |
| R56-04 | Open. Independent implementation review required. |
| R56-05 | Open. Actual architectural plan owner acceptance required. |
| R56-06 | Reconciled for candidate handoff. Final milestone closure remains gated. |

## Original CA register and measurements

| CA | Automated result or outstanding condition |
|---|---|
| CA01 | Synthetic calibrated drawing and owned assembly preview, Apply and reopen passed. Actual-plan equivalent remains for owner. |
| CA02 | 40×30 exterior rectangle, 8 in wall × 8 ft height = **27.12757201646 CY**. |
| CA03 | Accepted L fixture **46.222222 CY**, with existing orthogonal tests and source trace protection. |
| CA04 | Compound imperial, metric, scope, dimensions, material and confirmation exercised in targeted controls and the assembly browser case. |
| CA05 | Exact **5.08641975309 CY** footing, **840 SF** waterproofing and **150.66666666667 LF** for the approved 8 in footing-edge offset. |
| CA06 | Exact **5.08641975309 → 10.17283950617 → 5.08641975309 CY**, stable role IDs. |
| CA07 | Original external trace held. 10 in wall at 8 ft height = **33.744855967 CY**. |
| CA08 | Dormant child IDs and exclusions survive explicit system suspension and reactivation. |
| CA09 | Independent 40×30×4 in slab = **14.81481481481 CY**. Foam **1,200 SF / 3,600 BF**, granular **22.22222222222 CY**, with elevations **0 / −0.25 / −0.75 ft**. |
| CA10 | Established pad and earthworks fixtures retained. |
| CA11 | Existing angled and stepped guards and legacy fixtures retained. Review practical advanced override cases on an actual plan. |
| CA12 | Browser undo/redo, v3 round trip, stale Apply rejection and old-record validation. Owner practical reopen remains open. |

## Local validation evidence

Final Node 22.23.5 validation passed 307/307 (223 Node and 84 Chromium). TypeScript, build, dependency audit (zero findings), Chromium installation, PHP lint and PDF worker checks passed. The locked install was verified on the preceding shared-architecture run, with package manifests unchanged. The focused document/controller suite and four targeted browser cases passed. A separate synthetic calibrated-plan probe created an owned 40×30 rectangle, applied the confirmed footing and drainage, reported **150.67 LF**, and retained the underlay and all 12 child bindings on reopen. The isolated two-parent and storage/lineage probes also passed. Logs and traces are under `/tmp/planarmto-r536-final`. Docker is unavailable locally.

### R5.6A verification

The 307-test baseline at `7ac4dd9` passed [CI #192](https://github.com/homeextent/planarmto/actions/runs/45705520839/job/139526365639), including isolated WordPress. The bounded closeout passed **311/311** locally on Node 22.23.5 (226 Node and 85 Chromium). The locked install, TypeScript, production build, audit, PHP lint and PDF worker checks passed. Docker was unavailable locally. Targeted browser checks passed for calibrated drafting, assembly adoption, interactive correction, preset snapshots and reversible detachment. The complete browser run also checks metric display without mutating the persisted workspace. Logs and traces are under `/tmp/planarmto-r56a`.

The exact limitations are tied to the existing engine contracts. Detachment requires an entire system or exterior layer and refuses remaining linked dependencies. Trace editing supports corner moves that preserve orthogonality and bounded orthogonal insets or projections. Released groups and dormant or conflicting lineage require resolution before topology replacement. Legacy generated references retain their native independent-edit restrictions. Actual-plan acceptance remains open.

## Practical owner verification

1. Use a disposable local production-preview profile. Import an actual plan locally, calibrate against a labeled dimension and verify scale after zoom and reopen. Keep the plan and screenshots out of Git and CI.
2. Trace one rectangle and one irregular perimeter. Compare the quantities to independent takeoff and confirm each source convention and assumption. Preview the perimeter, apply it as a foundation assembly, and compare the original trace before and after a wall-thickness revision.
3. Confirm a footing, at least two differently specified exterior layers, and the approved drainage reference. Preview before Apply. Verify each material row and check how incomplete pipe attributes are reported while eligible route length remains known.
4. Confirm a slab extent and base. Compare the under-slab strata and their independent quantities. Verify a scope exclusion and its reason survive undo, redo and reopen. Exercise a stepped or nonstandard condition and check the documented refusal or independent workflow.
5. Move a saved trace vertex and preview a bounded inset where appropriate. Check that prior trace provenance remains. Detach a complete system without dependent sources, confirm its quantity appears once, revise an independent value, and verify explicit re-adoption or deletion, undo, redo and reopen.
6. Record actual quantities, operation count/time and usability findings. Submit exact candidate evidence for independent review before requesting staging approval.

## R5.6B implementation and practical acceptance

Node 22 local validation passed 318/318 regressions (231 Node and 87 Chromium). The four focused Chromium cases passed on the corrected build. Locked dependency installation, TypeScript, production build, high-severity dependency audit, Chromium installation, PHP syntax and bundled PDF worker checks passed. Isolated WordPress integration was unavailable locally because Docker was unavailable. Local logs are under `/tmp/planarmto-r56b/final/`. Exact published-head CI and owner practical tests remain independent gates.

The coordinated editor uses the existing assembly Preview/Apply transaction. The optional [v3 persistence amendment](c1c-r5-3-persistence-design.md#r56b-additive-v3-contract) preserves historical records and distinguishes local elevation frames from a shared project reference.

| Items | Evidence and review focus |
|---|---|
| UX-01–UX-03 | Chromium standard irregular trace, cancellation and atomic undo/redo. The rectangle correction, preset and detachment case now starts in the standard assembly workflow. Legacy explicit perimeter adoption remains covered separately. |
| UX-04–UX-06 | Contractor-facing labels, relative datum and advanced disclosures. Dimension suggestions come from project-confirmed values. The existing unit parser, unit-switch tests and fractional trace inputs cover manual entry. |
| UX-07–UX-08 | Engine tests cover distant axis projection and exact interior corners on a complete irregular wall ring. Owner review should check snap priority and pointer feel on the actual plan. |
| UX-09 | Component-specific canvas styling and labelled visibility options. The existing browser filter case checks persistence and quantities. The reported footing disappearance remains an unresolved owner observation. |
| UX-10–UX-13 | Standard irregular Chromium case exercises the derived slab and quantity review. Independent polygon slab has a direct toolbar test. Existing trace correction and replacement lineage contracts remain covered. |
| UX-14–UX-17 | Tests cover wall-base zero, centred footing, slab relationship, local-frame comparisons, and existing slab/insulation/granular stacking. Separate local zeros cannot resolve potentially overlapping concrete. |
| UX-18–UX-19 | Node coverage reverses confirmed exterior layers and verifies stable child IDs, quantities, explicit unresolved order and save/reopen. Exterior order does not move the approved measurement face. |
| UX-20–UX-21 | Node coverage persists local references across save, detachment and explicit re-adoption. Historical elevations, presets, advanced controls and undo/redo remain covered. |

For practical acceptance, calibrate an actual drawing and trace a rectangle and a supported irregular foundation. Choose the trace reference, specify the wall and footing, and verify the relative datum and quantity preview. Include a supported interior slab where shown and confirm the under-slab and exterior material sequences. Inspect the committed footing with All visible. Correct a perimeter node, compare quantities and identity changes, undo and redo, then save and reopen. Confirm independent slab drafting remains accessible. Record any screen state, active visibility filter and action sequence if footing visibility recurs.

Independent source review and actual-plan owner acceptance remain open.

## R5.6C owner diagnostics

On R5.6B the owner accepted the tested 24-inch footing modification from 6 to 8 inches. Footing concrete changed from 3.55 to 4.73 CY. Wall concrete remained 18.92 CY, waterproofing and exterior insulation each remained 590.80 SF, and drainage remained 109.13 LF. The review displayed 0 added, 20 retained and 4 revised. Apply completed.

Graphical correction preview changed wall concrete from 18.92 to 20.49 CY, footing concrete from 4.73 to 5.12 CY, exterior coverage from 590.80 to 638.42 SF per material, and drainage from 109.13 to 117.07 LF. The owner did not accept the interaction because the standard Preview could replace that correction. Source review confirmed the two preview commands could use different geometry.

The owner also reported that an eight-vertex draft disappeared entering construction specification. Source review confirmed the canvas cleared its local outline and the inspector did not supply a replacement. This established a visual discontinuity. Actual loss of committed project records remains unproven. See the [R5.6C specification and test paths](c1c-r5-6c-workflow.md).

R5.6C local validation passed 322/322 regressions (233 Node and 89 Chromium), retaining the 318-test baseline. The integrated browser run included six focused construction scenarios. The synthetic footing depth change produced 5.09 → 6.78 CY with wall concrete held at 27.13 CY, zero added, eight retained and four revised. The new coverage includes rejected overlapping drafts, workspace switching, repeated correction Preview, atomic independent slab construction, valid and invalid loop adoption, and a garage slab estimate with no inferred fill. Node 22 lint, locked installation, production build, audit, Chromium installation, PHP syntax and PDF worker checks passed. Local isolated WordPress integration was unavailable because Docker was unavailable. Logs are in `/tmp/planarmto-r56c/final/`. Independent exact-head CI #196 later passed. Owner practical acceptance remains pending.

## R5.7 owner diagnostics and closeout

The owner committed a 20 × 20 ft exterior foundation with 8 in poured-concrete walls, 8 ft wall height and the conventional reference. Wall concrete displayed 15.28 CY, as expected. A separate six-segment irregular foundation remained independent and raised combined wall concrete to 23.88 CY. The exact irregular dimensions were not independently reconciled.

Adding 24 × 6 in centred strip footings to the rectangle yielded 2.86 CY. Adding them to the irregular foundation raised the combined footing total to 4.48 CY. Combined wall concrete remained 23.88 CY.

An initial standalone slab displayed 3.34 CY despite the reported nominal dimensions. This discrepancy was not reproduced. A controlled 20 × 20 ft by 6 in slab gave 7.41 CY in Preview and after Apply. The controlled calculation passed.

The owner reported that a visually separate incomplete wall changed previously quantified concrete totals to Not quantified and produced common-reference messages. A synthetic baseline fixture reproduced the suppression. Incomplete width led to an unknown footprint, and the broad phase assumed potential overlap with unrelated solids. R5.7 retains contributions when the traced axial interval establishes disjointness and retains unresolved status where dimensions are still needed.

The owner could not delete a standalone slab after confirming component deletion. Ownership validation refused the child deletion and the editor provided no parent operation. R5.7 introduces a validated parent preview and confirmation. See the [requirements and practical acceptance procedure](c1c-r5-7-foundation-closeout.md).

R5.7 local validation passed 324/324 regressions (234 Node and 90 Chromium), retaining all 322 baseline tests. Six targeted Chromium scenarios passed. The refreshed build passed the full 90-test browser suite after the independent wall editor was moved to the top of the inspector. Foundation and project-document regressions also passed on the final wording and overlap behavior. Locked installation, TypeScript, production build, audit, PHP syntax and the bundled PDF worker checks passed. Docker was unavailable for isolated WordPress integration. Synthetic reproduction evidence is in `/tmp/planarmto-r57/baseline-exact.log`. Final validation logs are under `/tmp/planarmto-r57/final/`. Exact-head CI review and owner practical acceptance remain pending.

## R5.8 owner diagnostic evidence

The owner demonstrated R5.7 rectangular and irregular foundation creation, independent coexisting assemblies, addition of dependent layers, interior slab generation, independent rectangular and irregular slabs, independent wall editing, and retention of independently valid quantities.

The controlled standalone slab preview used 20 × 20 ft coverage, 6 in concrete at 7.41 CY, 2 in XPS at 400 SF and 800 informational BF, and 6 in pea gravel at 7.41 CY. This matches the full-footprint geometric basis. The earlier 3.34 CY observation remains unreproduced. The screenshots show a genuine independent-wall intersection, so applicable overlap diagnostics remain legitimate. Deletion, persistence and history were not reported as owner-accepted.

Remaining usability findings concerned open-wall dependent layers, lengthy forms, excessive visible optional inputs, exterior layer discovery, concrete proposals, irrelevant material thickness, drawing/specification separation and redundant confirmations. The [R5.8 specification](c1c-r5-8-contractor-interface.md) records the changes and remaining practical checks.

R5.8 local validation passed 328/328 regressions (234 Node and 94 Chromium), preserving the 324-test baseline. Eight focused Chromium scenarios also passed. The integrated browser runner stopped after 83 successful cases. The eleven unexecuted roof cases passed on the same build in a separate batch with an alternate localhost port. Locked installation, TypeScript, production build, audit, PHP syntax and the bundled PDF worker checks passed. Docker was unavailable for local isolated WordPress integration. Logs are under `/tmp/planarmto-r58/final/`. See the [rendered evidence](c1c-r5-8-contractor-interface.md#rendered-verification). Exact-head CI and targeted owner practical acceptance remain pending.

## R5.9 contractor interface and takeoff verification

The [R5.9 specification and evidence register](c1c-r5-9-contractor-takeoff.md) records the owner-reported R5.8 findings and controlled baseline overlap reproduction. Targeted Node coverage exercises material grouping and confirmed versus unresolved geometric separation. Chromium covers the independent wall layer lifecycle through export/reopen and workspace material categories at two viewports. Technical verification and owner acceptance are separate gates.

Implementation `8da8813e69bf97b12c4d3871b4f39db0988f22d8` passed 332/332 local regressions across validation batches. All 237 Node cases and 40 floor/roof Chromium cases passed. The final foundation batch passed 54 cases and found an inadvertently relabelled coordinated-assembly test selector. The original selector was restored and its complete adoption, export/reopen and quantity regression passed on the same application build. Chromium coverage totals 95 cases with zero skips. Logs are in `/tmp/planarmto-r59/final/`. The four corrected targeted Chromium scenarios also passed, with screenshots under `/tmp/planarmto-r59/rendered/`.

Node 22 locked installation, TypeScript, production build, dependency audit, Chromium install, PHP syntax and PDF worker checks passed. Docker was unavailable locally for isolated WordPress integration. Exact-head CI and targeted owner acceptance are required for closeout.
