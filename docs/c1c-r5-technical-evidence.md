# C.1C R5 technical candidate and acceptance register

R5.3–R5.5 implementation against the approved coordinated specification and the revised v3 persistence design at `1be740b`. The 296-test R5.1–R5.2 candidate remains the regression baseline. Review applies to draft PR #12. Actual-plan owner acceptance and staging approval remain separate.

## Implementation and boundaries

- `foundationAssemblyModel.ts` implements the approved optional v3 records. `foundationAssemblyValidation.ts` validates structural fields, trace and route order, role ownership, generated child agreement, retained references, catalogue entries, snapshots and caps. `projectDocument.ts` validates optional additions at read and serialize boundaries. Existing documents without the fields remain on the existing path.
- `foundationAssemblyController.ts` previews from immutable project identity and a saved revision, preserves independent measured contributions, validates both parent and children, rejects stale or altered previews and applies in one workspace replacement. `workspaceController.ts` and `App.tsx` capture the graph as one undo/redo entry. Presets are project-local and an applied snapshot remains self-contained.
- `foundationAssemblyRegeneration.ts` orchestrates existing perimeter, strip, coverage, drainage, slab, under-slab and quantity engines. Role IDs follow source segments and layer IDs. Debug diagnostics distinguish incomplete specification from pending or excluded scope. Dormant and retired identities, explicit child-scope decisions and reasons remain persisted.
- `FoundationAssemblyPanel.tsx` implements direct parent selection, confirmation, scope and material editing, local preset versions, adoption previews, advanced independent slab and drainage adoption, and material quantities. Existing specialist tools remain available, grouped under advanced component controls for owned selections. Standard assembly fields support compound imperial and explicit metric entry. Metric quantities are presentation only. Board feet and footprint references remain informational.
- Explicit footing elevations other than confirmed wall base, nonzero offset strips on a connected perimeter, and derived coverage for steps or complex openings follow the existing engine limits. Use separately traced details when the coordinated engine cannot reconcile them. Offsets and nonstandard geometry are never approximated.
- The controller supports explicit lineage and per-successor scope resolution. There is no general graphical lineage editor or implemented detachment command in this candidate. The approved design requires a detached physical measurement to stay live and independent, while its inactive child identity must not remain live. Review a distinct non-owning detachment audit record before implementing that transition. Generic editing of an owned child is refused. Broader manual transition paths and the remaining tests marked partial below require review before claiming the whole R5 register is accepted.

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
| R53-D11 | Covered. UI saves project-local preset versions and applies a confirmed snapshot. Structure and round-trip tested. |
| R53-D12 | Verified. Confirmed snapshot survives local preset removal in a v3 round trip. |
| R53-D13 | Verified. Established independent excavation/backfill regressions retained. No coordinated inference. |
| R53-D14 | Verified. Included incomplete and pending are distinct with no generated placeholder quantity. |
| R53-D15 | Covered. Existing engine bounds and explicit configuration. No engineering determination. |
| R54-01 | Verified by the supplemental two-parent workspace probe. Ownership stays independent while one parent is revised. |
| R54-02 | Verified. Thickness change preserves the original trace. |
| R54-03 | Verified. CA05–07 fixture changes wall and strip quantities using current derivations. |
| R54-04 | Verified. Browser preview leaves exported measurement count unchanged. |
| R54-05 | Verified. Browser Apply creates eight measurements from four with one history transition. |
| R54-06 | Verified. Rejected stale, tampered and invalid previews leave the saved state intact. |
| R54-07 | Verified. Browser undo and redo restore exact workspace equality including parent graph. |
| R54-08 | Verified. Equivalent intent is idempotent. |
| R54-09 | Verified. Excluded child survives dormancy and reactivation with IDs and reason. |
| R54-10 | Covered. Controller invalidates previews that change independently measured quantities. Existing foundation protection regressions retained. |
| R54-11 | Verified. Manual segment split records explicit replacement lineage and retained scope with round-trip. |
| R54-12 | Verified for explicit perimeter adoption. Model/controller allow additional independent binding adoption after confirmation; no automatic adoption. |
| R54-13 | Partial. Compatible overrides are retained and validated. General graphical topology/override editing and detachment remain outside tested workflows. |
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
| R56-02 | Partial. This register identifies targeted coverage and remaining acceptance gaps, including manual editing and owner procedures. |
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

## Practical owner verification

1. Use a disposable local production-preview profile. Import an actual plan locally, calibrate against a labeled dimension and verify scale after zoom and reopen. Keep the plan and screenshots out of Git and CI.
2. Trace one rectangle and one irregular perimeter. Compare the quantities to independent takeoff and confirm each source convention and assumption. Preview the perimeter, apply it as a foundation assembly, and compare the original trace before and after a wall-thickness revision.
3. Confirm a footing, at least two differently specified exterior layers, and the approved drainage reference. Preview before Apply. Verify each material row and check how incomplete pipe attributes are reported while eligible route length remains known.
4. Confirm a slab extent and base. Compare the under-slab strata and their independent quantities. Verify a scope exclusion and its reason survive undo, redo and reopen. Exercise a stepped or nonstandard condition and check the documented refusal or independent workflow.
5. Record actual quantities, operation count/time and usability findings. Submit exact candidate evidence for independent review before requesting staging approval.
