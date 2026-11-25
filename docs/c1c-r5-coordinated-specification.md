# PlanarMTO — C.1C-R5 Coordinated Technical Specification

**Status:** Five product specification packages approved by owner, 2026-11-25. R5.1–R5.2 implementation authorized through the accompanying instruction; R5.3 persistence design requires independent approval before implementation. R5.3–R5.6 product direction approved, execution remains gated as described below.

**Repository:** `homeextent/planarmto` · branch `feature/c1c-foundation-measurement` · draft PR #12 → `staging`.

**Baseline:** accepted application `cd782e7f1728d3e6377853677e29cc9611f08497`; documentation HEAD `18e73a9ada759241b0375a26f633f651408410c8`; staging `a064baeeb13b3ede95faf04e9aad19a7ab413882`. Local 289/289 (212 Node, 77 Chromium) and 5/5 targeted checks reported by Codex; independent source review and owner A–C acceptance complete. CI #188 run 45692683476 job 139481964301 and documentation CI #189 run 45695615469 job 139492110377 passed all required stages. Schema v3; production 2.15.1 unchanged.

## 1. Authority and scope

This consolidates owner-approved packages 01–05 and supersedes the corresponding proposed decisions in `docs/c1c-r5-contractor-workflow.md`; retain its historical context, UX01–UX14, CA01–CA12 and technical constraints. Preserve approved C.1C D01–D14, F01–F09 and R1–R4 mathematical, geometry, applicability, persistence and safety contracts except explicitly approved interaction changes. Read AGENTS.md first, then mandatory governing documents. Resolve substantive conflicts before editing. Product owner controls construction specifications, scope, acceptance, integration and release; ChatGPT architecture and independent review; Codex local implementation/testing. No new runtime dependencies, infrastructure, spending, schema version, structural design, code-compliance determination, consolidated pricing, production changes or unrelated work. C.1D remains deferred; C.1E, C.2 and release separately gated.

Objective: import → calibrate → trace the architect's drawings → configure confirmed construction specifications → review/apply material takeoff. Contractor-facing complexity should be minimized; internal coordinates, ownership and source validation retained. Missing specifications are pending, not zero. No silent inferred dimensions, earthworks or engineering. Existing engines remain quantity authority.

## 2. Package 01 — Graphical drafting and canvas interaction (R5.1)

Dedicated Rectangle foundation tool: click first corner, move pointer for live preview, click opposite corner, optionally type exact width/depth, configure and apply. No held mouse button or X/Y entry required. Preserve advanced coordinate-based capabilities where necessary. No assumption that all rectangles are axis-independent: use supported geometry/reference contract and refuse unsupported placement rather than distort.

Polygon foundation: retain/improve supported simple orthogonal outlines (4–64 vertices), including L/T/U and offsets. Visible vertices, live segment dimensions, highlighted first node and prospective closure, click-start closure, explicit finish/cancel, recoverable invalid draft. No silent snap distortion or bounding-box approximation. Curves and arbitrary intersecting angled walls remain unsupported; preserve supported isolated angled straight walls.

Independent walls: visible endpoint affordances during drafting, selectable compatible endpoint snaps, continue from existing wall, continuous mode starts next segment at previous endpoint, recognizable return-to-start feedback. Distinguish geometric connection, continuous drafting and assembly ownership. Complete foundation perimeter action validates newly traced continuous perimeter before assigning ownership. Never silently join unrelated assemblies or change existing lengths, thicknesses, elevations, reference geometry or specifications. Reproduce reported endpoint and closure issues before classifying defects.

Exact dimensions: keyboard entry without dragging cursor into form; live dimensions, rectangle width/depth, wall length, explicit Apply, context-appropriate Escape, coherent undo/redo, accessible zoom/pan. Suggested exterior-face tracing reference clearly displayed and selectable; retain centreline/interior face. Preserve original trace and calibrated scale.

| ID | Acceptance |
|---|---|
| R51-01 | Graphical rectangle without X/Y inputs |
| R51-02 | Exact width/depth correction |
| R51-03 | Supported irregular perimeter tracing |
| R51-04 | Recognizable first-node snap |
| R51-05 | Continue from existing endpoint |
| R51-06 | Complete valid continuous perimeter |
| R51-07 | Invalid closure preserves draft |
| R51-08 | Exterior/interior/centreline references |
| R51-09 | Scale preserved through zoom/edit/reopen |
| R51-10 | Existing geometry and measurement regressions protected |

## 3. Package 02 — Construction units and material catalogue (R5.2)

Canonical feet and full calculation precision remain unchanged. Unit preference affects presentation/parsing only; switching units or no-op edit must not alter physical geometry. Validate finite, context-appropriate dimensions; reject ambiguous or malformed inputs; retain signed datum/offset semantics where supported.

| Input | Imperial | Metric |
|---|---|---|
| Perimeter dimensions, wall length/height | ft/in | m |
| Wall thickness, strip width/depth | in | mm |
| Pad length/width | ft/in | m |
| Pad/slab thickness | in | mm |
| Vertical/horizontal insulation and granular thickness | in | mm |
| Drainage diameter and offset | in | mm |
| Waterproofing coverage height | ft/in | m |
| Excavation/backfill depth | ft/in | m |
| Wall openings, elevation/datum | ft/in | m |

Accept bare values in the displayed unit, explicit `8"`, `8'`, `8' 6"`, `8.5 ft`, `7 1/2` in an inch field and `40' 6"`. Roundtrip imperial/metric without drift. Display rounding must not overwrite precision. Preserve existing exact input semantics where compatible.

Context-sensitive controlled materials; automatically manage IDs and classification. Approved catalogue:

| Category | Choices | Primary quantity |
|---|---|---|
| Walls, strip/pad footings, slabs, thickenings | Poured concrete | CY/m³ |
| Exterior and under-slab insulation | EPS; XPS; rigid mineral wool; polyisocyanurate (PIR); Other specified insulation | SF/m² at specified thickness |
| Exterior protection | Liquid-applied dampproofing; liquid-applied waterproofing; sheet waterproofing membrane; polyethylene protection sheet; dimpled drainage membrane; Other specified membrane | SF/m² |
| Drainage | Perforated corrugated drainage pipe; perforated rigid PVC drainage pipe; solid drainage pipe; Other specified drainage pipe | LF/m |
| Granular/fill | Clear crushed stone; Granular A; Granular B; sand; pea gravel; approved native backfill; imported fill; Other specified granular material | Installed CY/m³ |

Material availability is measurement classification, not installation suitability. Concrete block, ICF, precast and reinforcement measurement deferred; never alias to poured concrete. Mix strength/rebar calculations out of scope. Pipe diameter is a specification attribute; no inferred fittings, outlets, slope, cleanouts or stone. No compaction/density/tonnage/waste/packaging/pricing in C.1C.

Combined exterior systems may include coating + protection sheet + drainage membrane; each confirmed layer has its own identity, material, coverage and separately traceable contribution. No duplicated same-material quantity. Independent coverage permitted. Board feet only supplementary/non-additive where applicable; distinguish slab footprint references from concrete quantity.

Stable material IDs separate from labels; preserve historical strings, unknown materials and measurement diagnostics. Other — Specify requires description and validated supported classification; must not bypass engine eligibility. Catalogue label renaming does not change stored geometry or quantities. Do not silently remap historical materials. Future pricing can reference stable identity, not implemented now. If new persisted identity/attribute fields are required in R5.2, identify and defer those writes to R5.3 review rather than introduce unreviewed schema fields; deliver compatible unit adapters/catalogue/selection behavior and report any blocked functionality.

| ID | Acceptance |
|---|---|
| R52-01 | Appropriate displayed construction units |
| R52-02 | Imperial fractional inputs |
| R52-03 | Unit conversion preserves canonical geometry |
| R52-04 | Context-sensitive dropdowns |
| R52-05 | Separately traceable multi-material quantities |
| R52-06 | Validated custom material descriptions |
| R52-07 | Historical materials intact |
| R52-08 | Unsupported materials not silently quantified |
| R52-09 | No manual material/layer IDs in standard UI |
| R52-10 | Mathematical/persistence regressions protected |

R52-05 and any persistence-dependent acceptance may be completed in R5.3–R5.6; report partial status accurately rather than claim full implementation prematurely.

## 4. Package 03 — Foundation assembly specifications and defaults (R5.3–R5.4)

Walls: confirmed material, thickness, height, original traced reference and base/top datum. Explicit openings, step elevations and geometry; no structural sizing. Strip footing: Yes/No/Pending, poured concrete, confirmed width/depth. Suggested centred alignment and footing top at wall base require confirmation; advanced explicit offset or manual nonuniform geometry. Do not infer dimensions from wall thickness.

Exterior systems: confirmed material/layers, actual coverage, specified thickness where applicable, independent layer extents and opening deductions. Full wall height is an explicitly confirmed estimating option only, not inferred below-grade height. Unsupported step/opening cases use manual net coverage.

Drainage: suggested 8 inches beyond exterior footing edge to pipe centreline, confirmed or overridden. For valid uniform centred footing, wall-face offset = (footing width − wall thickness)/2 + 8/12 ft (dimensions in canonical ft). Recalculate from actual applicable geometry. Without reliable footing edge or with unsupported nonuniform geometry, require explicit route, confirmed alternative offset, or pending. No automatic engineering.

Slab: explicit applicability; confirm derived interior footprint or independently trace slab. Never use gross exterior area as interior slab or infer slab exists. Confirm datum and relation to footing; slab thickness explicit. Horizontal insulation directly below slab, granular below insulation or slab if insulation absent. Explicit materials/thicknesses/extents, openings/thickenings. Detect overlap with footing/thickening; refuse or pending where engine cannot reconcile. Do not silently assume valid elevation relationship.

Presets: contractor-created, editable, versioned confirmed snapshots; no factory structural dimension defaults. Apply only after explicit plan/assumption confirmation. Individual override retained with provenance. Editing preset never retroactively changes assembly; explicit reapply previews affected specs and quantities. Unknowns pending. Define preset storage/ownership/versioning at R5.3 gate.

Excavation, trench, backfill, drainage stone, fill remain independently measured using explicit extent/depth/width as applicable. No automatic excavation/backfill, soil inference or waste/disposal calculation. C.1D deferred.

| ID | Approved decision |
|---|---|
| R53-D01 | Coordinated assembly configuration |
| R53-D02 | Explicit wall material, thickness, height, datum |
| R53-D03 | Confirmed centred footing convention with override |
| R53-D04 | No inferred structural dimensions |
| R53-D05 | Independently measurable exterior material layers |
| R53-D06 | Actual coverage or confirmed full-height assumption |
| R53-D07 | Suggested 8-inch footing-edge drainage offset |
| R53-D08 | Drainage override/manual route/pending fallback |
| R53-D09 | Explicit slab applicability and extent |
| R53-D10 | Automatic positioning of confirmed under-slab layers |
| R53-D11 | Contractor-created explicitly confirmed presets |
| R53-D12 | No retrospective preset changes |
| R53-D13 | Independent excavation/backfill |
| R53-D14 | Missing specifications pending |
| R53-D15 | No engineering/code-compliance determination |

## 5. Package 04 — Assembly ownership, persistence and coordinated modification (R5.3–R5.4)

Persistent parent assembly owns original trace, confirmed specs, generated roles, applicable systems, provenance and overrides. Parent is non-additive; only eligible physical components contribute. Multiple independent assemblies per workspace, including adjacent assemblies, without automatic ownership merging. Existing geometry/measurement engines remain authoritative. Use pure domain orchestration separated from UI; inspect actual source before design. Reuse foundationPerimeterGeometry, foundationGeometry, foundationMeasurements, foundationDerivation, foundationEnvelopeDerivation, foundationDrainageDerivation, foundationGeneration, foundationTopology, foundationLayers, foundationApplicability, foundationAssembly, foundationDrafting, foundationSnap, precisionDrafting, projectDocument, workspaceController, CadCanvas and applicable existing modules. Do not duplicate formulas in UI.

Regenerate from original trace and confirmed specifications, not mutated derived geometry; retain original reference on thickness change. Calculate only actual dependencies. Wall height affects concrete and linked coverage, thickness affects wall, footing, interior-derived slab and applicable route; footing width affects footing and route, depth affects footing and any actual dependent datum; slab thickness affects slab and dependent elevations according to confirmed datum; insulation/granular thickness affects corresponding layer and actual dependencies. Validate complete candidate against existing engine and source revision. Preview differences in affected geometry, quantities, scope and conflicts. Preview/cancel do not write records or history. Apply once in existing workspace transaction, undo/redo entire state. Invalid or stale candidates cannot replace valid state; equivalent edits idempotent. No partial writes, orphan/stale refs or double count.

Included/excluded/pending are distinct. Unconfigured scope pending; no explicit decision is not an exclusion. On confirmed disabling, remove only owned generated children, retain exclusion and reason in parent; re-enable without duplicate records. Missing data not zero. Preserve independently drafted components, unrelated known quantities and explicit manual scope decisions. Resolve conflicts via keep independent (no unresolved overlap treated as measured), explicit validated adoption, or explicit previewed replacement. Never silently adopt/delete/replace historical/manual components. Unsupported adoption remains independent with diagnostic.

Stable parent/source identity, child IDs linked to source segment/system/layer role, retain surviving identities or explicit replacement lineage when topology changes. Preserve overrides compatible with regeneration, report conflicts requiring review. Direct generated-child edits route through parent validation or explicit detachment; no stale parent. Provenance distinguishes plan, confirmed preset snapshot, estimating assumption and manual override. No retroactive preset updates.

Minimal additive schema v3 proposal must specify exact TypeScript/serialized fields and location, compatibility with existing document validators and workspace history, material identities, presets and storage ownership, original trace, source reference, confirmed specs, scope, generated mapping, revision/stale preview token, override provenance, replacement lineage, import/export, corruption handling, no-op behavior, historical adoption and migration policy. Save/reopen recomputes quantities; no authoritative cached totals. Existing roof/floor/site workspaces unchanged. No destructive migration or silent legacy conversion. **Stop before implementing any new persistence contract; submit exact design for independent ChatGPT/owner review.**

| ID | Acceptance |
|---|---|
| R54-01 | Multiple independent assemblies |
| R54-02 | Original trace preserved |
| R54-03 | Actual dependencies recalculated |
| R54-04 | Preview leaves records/history unchanged |
| R54-05 | One coordinated apply transaction |
| R54-06 | Invalid edits preserve previous state |
| R54-07 | Full undo/redo restoration |
| R54-08 | Equivalent changes do not duplicate |
| R54-09 | Disable/re-enable preserves scope/ownership |
| R54-10 | Independent components protected |
| R54-11 | Stable IDs or explicit lineage |
| R54-12 | Explicit historical adoption/replacement |
| R54-13 | Compatible manual overrides preserved |
| R54-14 | Stale previews rejected |
| R54-15 | Save/export/import/reopen preserve relationships |
| R54-16 | Mathematical/persistence regressions protected |

## 6. Package 05 — Contractor interface and final acceptance (R5.5–R5.6)

Retain existing layout and components; concepts are not pixel-level mandates. Primary toolbar: Select, Rectangle foundation, Polygon foundation, Foundation wall, Slab, Pad footing. Drawing reference: import, calibrate, underlay visibility. Advanced tools retain independent strip footing, wall/slab openings, slab thickening, manual waterproofing/insulation/drainage, area/trench excavation, backfill and granular layers. No loss of supported functionality.

Context-sensitive inspector: no selection → workspace overview/assemblies; rectangle/polygon → instructions/reference/closure; assembly → confirmed specs; independent wall/slab → relevant properties; multiple selection → count/coordinated actions; preview → affected components/deltas/conflicts. Standard assembly controls show relevant dimensions, materials, explicit Yes/No/Pending systems and required confirmations. Advanced controls include reference, datum, alignment, offset, coverage, openings, steps, nonuniform geometry and manual overrides. Required confirmations must not be hidden solely in advanced controls. No manual IDs or source manifests. Expandable Measurement checks retains actionable technical diagnostics. Selecting generated wall gives access to parent assembly; independent selection remains available.

Distinguish unselected/selected/preview/pending/invalid using labels, line styles and color (not color alone). Preserve R5.0A pointer accessibility and clear warning behavior. Quantity summary: material identity, dimensions, units, measured/pending/excluded state, assumptions, known subtotals at full precision; no false completeness. Slab footprint and applicable BF supplementary/non-additive; no duplicate material totals. No consolidated pricing/reporting prior to C.2. Error messages identify cause and available action (e.g. existing strip → review revised specs; wrong source → select complete perimeter; invalid closure → review highlighted segments; stale preview → revalidate). Preserve actual validation conditions, not cosmetic masking.

| ID | Acceptance |
|---|---|
| R55-01 | Simplified primary toolbar |
| R55-02 | Supported specialist tools accessible |
| R55-03 | Context-sensitive inspector |
| R55-04 | Standard/advanced separation |
| R55-05 | Straightforward parent selection |
| R55-06 | Clear included/excluded/pending |
| R55-07 | Committed and preview geometry distinct |
| R55-08 | Actionable validation messages |
| R55-09 | Traceable quantity summary |
| R55-10 | Non-additive references distinct |
| R55-11 | Unresolved scope visible |
| R55-12 | No premature consolidated pricing |
| R56-01 | 289-test accepted baseline protected |
| R56-02 | Appropriate coverage of all approved R5 requirements |
| R56-03 | Exact-candidate CI passes |
| R56-04 | Independent implementation review |
| R56-05 | Actual architectural-plan owner acceptance |
| R56-06 | Governing docs reconciled before staging authorization |

Final validation layers: Codex local automated tests; ChatGPT independent source/architecture/safeguard/exact-head CI review; owner actual-plan practical acceptance. Owner scenarios: rectangular basement, irregular L/T/U trace, specification revision, independent garage/slab, stepped/nonstandard conditions and project reopen. Use at least one actual architectural drawing locally, compare measured quantities and assumptions, record time/operation count and usability without imposing arbitrary threshold. No customer plans/secrets in repo or CI artifacts.

## 7. Original CA01–CA12 acceptance register (retained)

| ID | Operator action | Observable pass |
|---|---|---|
| CA01 | Import/calibrate actual plan | Known dimension reproduced; no drift on zoom/reopen |
| CA02 | Trace 40×30 rectangle by corners | No coordinates; 8 in × 8 ft wall = 27.127572 CY |
| CA03 | Trace L/T/U and offsets | Start snap, orthogonal closure, preview; original L fixture 46.222222 CY; no approximation |
| CA04 | Configure assembly | Familiar units, dropdowns, explicit unknowns/confirmed defaults, no manual IDs |
| CA05 | Enable footing/exterior/drainage | 24×6 in strip 5.086420 CY; 6 ft coverage 840 SF; confirmed 8 in footing-edge offset 150.666667 LF |
| CA06 | Footing depth 6→12→6 in | 5.09→10.17→5.09 CY; unchanged wall; no duplicate |
| CA07 | Wall thickness 8→10 in | Original exterior trace unchanged; dependencies recalculated, no stale IDs; wall 33.744856 CY |
| CA08 | Toggle systems off/on | Only owned generated children removed; no duplicates or manual scope loss |
| CA09 | Independent 40×30 slab 4 in, foam 3 in, stone 6 in | 14.814815 CY; 1200 SF/3600 BF; 22.222222 CY; confirmed extent and sequencing |
| CA10 | Pad and earthworks | Existing independent fixture quantities retained |
| CA11 | Advanced override/step | Honor override; unsupported pending/refused; unaffected quantities preserved |
| CA12 | Save/reopen, undo/redo, invalid edit | Whole transaction and provenance preserved; pricing gated |

Fixture clarifications: CA02 exterior ring area = 1200 − (40−2t)(30−2t), t=8/12 ft, times height/27. CA07 t=10/12 ft. CA05 centred uniform strip volume = width × 2[(40−t)+(30−t)] × depth /27; exterior coverage 140×6; drainage offset from wall face = (24−8)/2+8=16 in; route 140+8×16/12=150.666667 LF. Retain historical 156 LF fixture for 2 ft wall-face offset; do not change baseline to match new convention. CA03 L fixture 40×40 minus 20×20 notch, 12 in wall ×8 ft. CA09 independent slab is not an automatically derived interior slab. All dimensions are synthetic verification data, not factory presets or structural recommendations.

## 8. Implementation sequence and authorization

| Increment | Scope | Gate |
|---|---|---|
| R5.0A | Accepted stabilization | Complete |
| R5.0 | Approved product specification | This record and authorization |
| R5.1 | Graphical drafting, reference/closure/endpoint interaction | Authorized |
| R5.2 | Unit adapter, controlled catalogue, compatible inspector changes | Authorized within existing persisted contract |
| R5.3 design | Exact additive v3 proposal, owner/identity/validation/compatibility review | Design only authorized; stop before implementation |
| R5.3 implementation | Controller and persistence | Explicit independent design approval required |
| R5.4 | Atomic regeneration and dependency reconciliation | After R5.3 approval, within product scope |
| R5.5 | Standard/advanced contractor UI | After R5.3 approval, within product scope |
| R5.6 | Integrated validation, independent and owner acceptance | Required; no automatic staging merge |

Use existing feature branch only. Preserve user edits; fetch/verify exact expected HEAD, clean tree, normal fast-forward pushes only. Initial documentation commit reconciles AGENTS.md (baseline 289 and stop gates, preserve efficiency policy), original R5 proposal (link approved successor and clarify superseded decisions), roadmap and governing docs as appropriate. No application work mixed with specification commit. Use targeted iterative tests, full suite at milestone/integration/shared-architecture gates. Node 22, locked dependencies, `.github/workflows/validate.yml` authority: lint, six Node suites, build, audit, Chromium, PHP lint, worker checks, isolated WP if available. No skip/weaken/retry-away; approved UI changes require equivalent or stronger behavioral assertions. Preserve all mathematical assertions. Report environment gaps explicitly. Local logs/evidence synthetic only. Publish locally validated coherent candidate on active feature branch for independent review/CI; no force, merge, staging/main, deployment, version or schema bump. No repetitive approval for settled scope; stop on substantive conflicts or R5.3 gate. Final exact-head CI and owner acceptance required. Review five root documents at milestone closure. C.1E/C.2 and production separately gated.

## 9. Reconciliation and reporting

The 69 approved identifiers (10+10+15+16+12+6) supplement original UX01–UX14 and CA01–CA12, not replace them. Preserve R5.0A A–C acceptance and six owner observations as historical evidence; new endpoint/closure observations are reported usability findings until reproduced. Preserve R1–R4 contracts. If approved product behavior conflicts with current technical implementation, report exact source and proposed resolution; do not silently alter measurement authority. Track each requirement implemented/tested/deferred with file/test references, actual results, exact SHA and limitations. At R5.3 gate return exact design, R5.1–2 candidate SHA, changed files, regression results, CI identifiers/status, remaining acceptance gaps and any requested decisions. Do not claim final owner acceptance until actually performed.
