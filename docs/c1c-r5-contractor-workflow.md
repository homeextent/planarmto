# C.1C-R5 — Contractor-focused foundation assembly workflow

Status: owner endorsed contractor-first direction and hybrid model; this is a proposed coordinated implementation specification for explicit review, not blanket authorization to implement. Preserve D01–D14, F01–F09 and measurement accuracy; amend only routine interaction/automation semantics. C.1C remains unmerged. No structural design, runtime dependencies, infrastructure, spending, schema bump or release.

## Product decisions (UX01–UX14)
| ID | Decision direction |
|---|---|
| UX01 | Contractor material takeoff, not architecture/design |
| UX02 | Import, calibrate, trace existing drawings as primary path |
| UX03 | No X/Y entry in standard UI; retain internal coordinates |
| UX04 | Click-click rectangle and closed orthogonal polygon with clear start snap, finish/cancel and exact optional input |
| UX05 | Imperial height/length feet-and-inches; wall/footing/slab/insulation/granular thickness/width/depth inches; metric equivalent explicitly labeled (propose mm for construction sections, m for lengths); canonical feet unchanged |
| UX06 | Controlled materials/assemblies, clear labels, no exact free-text token dependence |
| UX07 | Internal material/assembly/layer/group identities automatically assigned |
| UX08 | Unified trace → configure assembly → review/apply takeoff |
| UX09 | Automatically position conventional layers using explicit specifications |
| UX10 | Configurable, disclosed estimating defaults, overrides and provenance |
| UX11 | Automatically recalculate dependent geometry/quantities on accepted changes, no duplicate contributions |
| UX12 | Advanced manual tools for special cases, including independent tracing |
| UX13 | Reuse existing engine, validation, persistence and history |
| UX14 | Actual architectural-plan owner acceptance before staging |

## Proposed implementation sequence
R5.0 review baseline reproduction, approve detailed contracts and defaults. R5.1 trace rectangle/polygon directly on calibrated canvas; preview closure/first node, actionable error and recoverable draft, no silent snap distortion, undo, optional exact correction. R5.2 unit adapter and material catalogue, context-sensitive inspector; roundtrip imperial/metric without drift. R5.3 assembly controller (pure domain orchestration, separate UI), persist explicit traced reference + confirmed specs + versioned defaults/override provenance + stable ownership. R5.4 transactional regeneration/replacement and dependency reconciliation. R5.5 standard/advanced interface and selection feedback. R5.6 integrated local/CI regressions and owner practical acceptance. R5.1–6 require bounded approval after R5.0; no new branch required.

## Standard experience
Trace rectangle, irregular perimeter, individual wall; configure selected foundation (not select hidden child groups); clear external/internal/centre reference; preview with wall thickness, height, footing dimensions, exterior insulation, waterproofing, drainage, slab and associated layers. Yes/No choices; unset scope remains pending, explicit No excluded with auditable provenance. Show concise quantities and applied assumptions. Use context-specific controls and material selections. Keep independent slab/pad/earthworks tracing accessible. Advanced overrides: coverage limits, openings, steps, nonuniform widths, offsets, explicit datum, manual source components, complex layer extents, junctions. Do not imply support for arbitrary angled closed perimeter: current generator simple orthogonal 4–64, isolated angled straight wall only; curved and intersecting angled pending. Stepped/walkout geometry explicit; auto uniform envelope limited; retain manual alternatives.

## Inputs and decision boundaries
- Required from plans or explicit confirmed preset: wall material/height/thickness, footing width/depth, slab thickness, applicable components and selected materials/thickness, actual extent. No silent structural sizing. Missing is pending, never zero. Show source reference and which values are plan-specified vs preset vs estimated default vs override.
- Conventional geometry: centred strip, top at wall base; automatically determine exterior normal and complete source loop; derive slab interior footprint only after explicit confirmation, not gross exterior rectangle; allow independent traced slab, no auto slab for every perimeter. Automatically establish slab base and under-slab layer sequencing relative to confirmed assembly datum; no need to expose internal elevations for conventional case. If slab placement relative to footing is unknown, use explicit confirmed convention or pending; do not silently assume concrete overlap. Horizontal insulation directly below slab, granular below insulation or slab; detect overlap with footings/thickenings and refuse/pending where engine cannot reconcile. No inferred excavation/backfill.
- Exterior waterproofing and insulation coverage based on actual specified below-grade/coverage extent; full wall height is a proposed estimating option only, explicitly confirmed and visible, not automatically a factual below-grade height. Support independent overrides and net coverage; unsupported openings/steps use manual coverage.
- Drainage proposed default: 8 in from exterior footing edge to pipe centreline, NOT wall face; conversion for centred uniform footing = (footing width−wall thickness)/2 + 8/12 ft from exterior wall face. Require confirmed valid footing geometry; if no footing or nonuniform geometry, explicit route/override or pending. No inferred slope, fittings, outlets or code compliance.
- Material catalogue proposal: poured concrete (canonical token); rigid EPS/XPS/mineral wool/other specified; waterproofing membrane, tar + plastic, tar + plastic + drainage membrane; perforated pipe; clear crushed stone/Granular A/Granular B/other specified. Owner approves precise catalogue and terminology. Stable IDs separate display labels; preserve historical strings and unknown materials for review, no silent remap. Other permits explicit custom description/identity; distinguish supported measurement from deferred construction systems. A multi-material waterproofing assembly must emit separate traceable layers only if confirmed coverage/measurement basis, not three indistinguishable duplicate rows. No pricing/waste/packaging in C.1C.
- Rigid board insulation primary SF at thickness; BF retained as appropriate informational/volumetric measure, not additive price quantity. C.1E/C.2 must distinguish reference vs material contribution.

## Controller and safety contract
Reuse foundationPerimeterGeometry, foundationGeometry, foundationMeasurements, foundationDerivation, foundationEnvelopeDerivation, foundationDrainageDerivation, foundationGeneration, foundationTopology, foundationLayers, foundationApplicability, foundationAssembly, foundationDrafting, foundationSnap, precisionDrafting, projectDocument, workspaceController, CadCanvas. Do not duplicate formulas in UI. Inspect actual files before design; existing generated reference validation deliberately rejects direct thickness mutation, so regenerate from persisted original trace in one validated transaction. Define stable parent assembly identity, child source mapping, explicit role ownership, deterministic layer identity and versioned source/default snapshot; preserve identities where supported or explicit replacement lineage; no orphan or stale refs. Determine minimal additive v3 persistence contract with owner review; do not silently migrate historical groups or overwrite manual edits/scope decisions. Manual/legacy source adoption requires explicit review; conflict preview and preserve existing records. Atomic candidate includes all affected generated members and updates source references; use existing preview guard and validation, protect unrelated known quantities and independent geometry. On invalid change preserve old committed assembly and show actionable reason; no partial writes or silent fallback. Preview must not alter history; Apply one transaction; undo/redo restore all specs/geometry/quantities, save/reopen recomputes. Toggle off removes only owned generated children, retains independent/manual components and explicit applicability. Repeated equivalent edit idempotent; editing defaults never retroactively changes saved projects. Avoid stale previews. Default changes only after explicit reapply. New assembly scope semantics and backward compatibility reviewed before edits.

## R5.0 coordinated specification review

R5.0A stabilization is accepted at `cd782e7`. Carry the [six owner usability observations](c1c-functional-findings.md#owner-usability-observations-for-r5-planning) into the coordinated review. Endpoint discoverability, continuous closure, direct rectangles and tracing without X/Y entry belong in the canvas specification. Section units and inspector simplification belong in the units and standard workflow specification. Owner approval of the coordinated specification is required before R5.1 implementation.

### Required decisions
Confirm exact material list and multi-layer breakdown, metric unit convention, default 8 in drainage offset and fallback without footings, slab datum/extent confirmation, exterior coverage default, preset/default scope and source provenance, child identity and legacy adoption semantics, which advanced controls remain directly visible. Do not treat examples as approved defaults. Owner may approve bounded choices in one review; no repeated approval per commit after that.

## Contractor acceptance (CA01–CA12)
| ID | Operator action | Observable pass |
|---|---|---|
| CA01 | Import/calibrate actual plan | Known dimension reproduced; no scale drift on zoom/reopen |
| CA02 | Trace 40×30 rectangle by corners | Closed without coordinates; 8 in ×8 ft walls 27.127572 CY |
| CA03 | Trace L/T/U and offsets | Start snap, orthogonal closure, preview; L fixture 46.222222 CY; no bounding approximation |
| CA04 | Configure assembly | Familiar units, dropdowns, explicit unknowns/confirmed defaults, no manual IDs |
| CA05 | Enable footings/envelope/drainage | 24×6 in strip 5.086420 CY; 6 ft coverage 840 SF; drainage under proposed 8 in edge offset = 150.666667 LF for rectangle (140 + 8×(2/3+2/3)); see derivation below |
| CA06 | Footing depth 6→12→6 in | 5.09→10.17→5.09 CY, wall unchanged, no duplicates |
| CA07 | Wall thickness 8→10 in | Original exterior trace unchanged; exact ring and dependencies recalculated, no stale IDs |
| CA08 | Toggle systems off/on | Remove only generated owned children; reenable without duplication, no silent loss of manual scope |
| CA09 | Independent 40×30 slab 4 in, foam 3 in and stone 6 in | 14.81 CY, 1200 SF/3600 BF, 22.22 CY; sequencing automatic; clear confirmed extent |
| CA10 | Trace pad and earthworks | Existing independent fixture quantities retained |
| CA11 | Advanced override/step | Explicit override honored, unsupported geometry pending/refused; preserve unaffected quantities |
| CA12 | Save/reopen, undo/redo and invalid edit | Whole assembly transaction and provenance preserved; pricing gated |

CA05 derivation: for rectangle width 24 in, wall 8 in, footing projection 8 in and drainage gap 8 in, exterior-wall-to-centre offset 16 in = 4/3 ft. Route LF = 140 + 8×4/3 = 150.666667 LF. The existing baseline 156 LF uses 2 ft from wall face and remains a separate fixture. Use 150.666667 in R5 tests if proposed default approved. No construction adequacy claim. CA07 independently calculate new ring = 1200−(40−2×10/12)(30−2×10/12); multiply height/27. Final real plan owner review must include practical trace, corrections, material takeoff comparison, assumptions and time/usability findings. No owner PASS presumed.
