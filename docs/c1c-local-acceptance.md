# C.1C — Local owner acceptance procedure and compliance traceability

## Gate and evidence
Automated candidate 537b03f9e0a3199e876857e064f0761a72c12480: CI #185, run 45669559089, job 139400816281, 288/288 (17+23+7+5+50+110+76). All validation stages passed. This document is an acceptance plan, not owner acceptance. Run exact feature HEAD CI after this documentation commit. No staging integration or release authorization. Production remains 2.15.1, schema 3.

Evidence paths: tests/foundation-measurements.test.ts (FM); tests/browser/foundation-interactions.spec.ts (FB); tests/project-document.test.ts (PD); docs/c1c-foundation-measurement.md (SPEC). CI #185 is the common verified baseline; earlier runs below identify incremental evidence, not separate acceptance gates.

## D01–D14 decision traceability
| Decision | Automated evidence and implemented boundary | Owner check |
|---|---|---|
| D01 poured concrete | FM isolated wall/strip, pad/slab, legacy pending; unsupported systems unquantified | L03–05 |
| D02 canonical centreline/reference | FM face orientation, all three rectangle references, irregular L/T/U; FB exact face placement, angled reference; PD stale reference rejection | L02–03 |
| D03 physical overlap | FM L/T/cross, variable-width stepped junction, disjoint datum, duplicates; angled intersecting runs pending | L03, L12 |
| D04 signed datum | FM top datum and reference conversion; FB elevation conversion and reference switching | L03 |
| D05 openings | FM containment, overlapping openings and junction refusal; FB wall opening and slab deduction | L05 |
| D06 stepped/walkout | FM variable-width stepped T, coordinated edit; FB coordinated history; no automatic step design | L03 |
| D07 thickening | FM total versus additional depth, overlap rejection; FB nonadditive breakdown | L05 |
| D08 excavation | FM trench/area intersection; PD integrated basement excavation; no inferred working space | L06 |
| D09 backfill | FM explicit volume; PD slab-on-grade explicit fill; no inferred subtraction | L06 |
| D10 granular | FM/FB/PD explicit layer intervals, conflicts pending, installed CY | L06–07 |
| D11 envelope/drainage | FM/FB actual face, foam, irregular exterior and drainage; PD integrated R2 | L07–08 |
| D12 optional generation | FB preview/cancel/apply/replacement; FM generation guard, complete source manifests | L04, L08, L10 |
| D13 deferred systems | SPEC manual/quote C.2; no structural sizing or unsupported material inference | L12 |
| D14 v3 and gates | PD roundtrip, legacy, recovery, pricing gate; 127 baseline preserved, CI #185 | L11–12 |

## F01–F09 corrective traceability
| Finding | Evidence | Status |
|---|---|---|
| F01 assembly/junctions | #162, #166, #180: manual assembly, variable thickness, stepped intersections, atomic coordinated edits | Automated verified; local pending |
| F02 datum | #162, #174: signed top/base conversion and preservation | Automated verified; local pending |
| F03 applicability | #167, #172, #185: included/excluded/pending reasons, dependencies, selection synchronization | Automated verified; local pending |
| F04 layers | #168, #172: explicit offsets and disjoint stack, conflict pending | Automated verified; local pending |
| F05 offset strips | #164, #165: signed isolated offset, bearing containment; joined offset refused | Automated verified; local pending |
| F06 coverage | #169–172: explicit opening treatment, foam, layer and exterior route | Automated verified; local pending |
| F07 precision | #173–174, #183–185: snapping, continuous correction, focus, angled and tool switching | Automated verified; local pending |
| F08 references | #165: nonadditive pad/slab footprint, net area and pending reasons | Automated verified; local pending |
| F09 integrity | #175–177, #180–181, #184–185: generation guard, replacement, manifests, stale geometry, persistence; legacy granular compatibility correction source-reviewed, no dedicated new regression | Automated evidence and source review; local pending |

## Browser acceptance traceability
The approved SPEC enumerates B01–B20 as a grouped list rather than individual definitions. The following mapping is the operational decomposition of that list; it does not claim all subcases have dedicated browser tests.
| ID | Check | Evidence / remaining local verification |
|---|---|---|
| B01 | Exact placement | FB exact rectangle, wall and angled correction |
| B02 | Repeated correction | FB rectangle and continuous history |
| B03 | Reference rectangles | FM all three references; FB rectangular preview and face placement; local all references |
| B04 | Polygon closure | FB closure and irregular preview |
| B05 | Inspector dimensions and elevation | FB wall, top/base and coordinated dimensions |
| B06 | Topology | FM L/T/cross, L/T/U, multi-offset; FB assembly/irregular; local junction visuals |
| B07 | Preview/cancel/apply/replacement | FB perimeter and strip replacement; FM envelope/drainage replacement; local all three |
| B08 | Slab openings/thickening | FB slab breakdown; FM validation |
| B09 | Earthworks | FM trench/area, PD basement and fill; local dedicated earthwork drafting |
| B10 | Surface systems | FB manual/derived insulation and waterproofing |
| B11 | Drainage | FB rectangular/irregular route |
| B12 | Direct/shift/window/crossing selection | FB window/crossing and assembly/filter; local direct/shift |
| B13 | Dependency deletion | FM and PD integrated cascade; local dialog confirm/cancel |
| B14 | History | FB correction, replacement, coordinated edit, undo/redo |
| B15 | Persistence | PD canonical roundtrip, corruption rejection; FB JSON export; local reopen |
| B16 | Workspace isolation | FB floor/foundation switching; PD isolation |
| B17 | Keyboard focus | FB Escape, failed placement and direct typing |
| B18 | Pending/excluded scope | FM/PD ownership; FB exclusion and scope inspector |
| B19 | Pricing gate | FB workspace status; PD canReportProjectEstimate false |
| B20 | Unsupported geometry | FM offset collapse, intersections pending, duplicate and invalid geometry; local diagnostic clarity |

## Local setup
Use clean working tree, disposable synthetic projects, no production credentials or deployment. Run from established local repository. Stop on mismatch or dirty working tree; do not reset or force.
```bash
cd /media/jeremy/MEDIA/dev/repos/planarmto
git status --short
git fetch origin
git switch feature/c1c-foundation-measurement
git pull --ff-only origin feature/c1c-foundation-measurement
git status --short
git log -1 --oneline
npm ci
npm run lint
npm run build
npm run preview -- --host 127.0.0.1 --port 4173 --strictPort
```
Open http://127.0.0.1:4173. Check exact HEAD against successful CI. No staging/main checkout or changes. If local branch does not exist, create tracking branch using git switch --track origin/feature/c1c-foundation-measurement.

## L01–L12 local owner acceptance
Record PASS / FAIL / NOT RUN per check; include screenshot or JSON where useful, exact steps, actual value, expected value, units and commit. For independent fixtures use separate foundation workspaces/projects or spatially separated geometry; do not accidentally overlap concrete.

| ID | Procedure | Expected |
|---|---|---|
| L01 calibration | Import a known-length drawing underlay, calibrate a known 40 ft segment, verify scale by tracing and switching workspaces | Correct scale; independent workspace settings/geometry preserved; no unintended recalibration |
| L02 precision and references | Draw 40 ft wall click-click, type correction 30 then 40, undo/redo; test metric/imperial input, Ortho, node/edge snap, live dimensions, continuous mode, exterior/interior faces with specified width, 42 ft angled wall with 1.25 ft width and 8 ft height | Exact dimensions; 15.56 CY angled wall; missing thickness refused; repeated correction one transaction; no silent changes |
| L03 concrete assemblies | Generate 40×30 exterior ring, 8 in thickness, 8 ft high, base 0. Draw L/T/U and multi-offset outlines; manually join compatible interior runs; coordinate stepped base/height; switch base/top | Rectangular ring 27.1276 CY; exact irregular ring; L fixture below 46.2222 CY; stepped fixture below 13.1852 CY; no duplicate intersections |
| L04 strip generation | Select entire perimeter, derive 2 ft ×1 ft strip, preview/cancel/apply; replace with explicit width; test isolated signed offset with wall bearing contained | 40 ft isolated centred strip 2.9630 CY; selected groups only, one undo transaction; invalid offset/join refused |
| L05 concrete details | Separate pad 4×4×1; slab 40×30×4/12; opening 6×10 inside slab; thickening 10×10 total depth 1.5; isolated wall 40×8×8/12, opening 4×3 with internal offset/sill | Pad .5926 CY, 1 EA, 16 SF reference; slab net 14.0741 CY before thickening, 18.3951 CY after; 1140 SF reference; wall 7.6049 CY net; invalid opening refused |
| L06 earthworks | Explicit 40×30 area excavation 8 ft depth; isolated trench 40×2×3; explicit backfill 20×10×6; granular 40×30×.5 with explicit material, layer identity and base | 355.5556 CY excavation, 8.8889 CY trench, 44.4444 CY fill, 22.2222 CY granular; no inferred excavation/backfill |
| L07 insulation and layers | Separate confirmed slab 40×30, base 0; derive horizontal foam .25 ft offset 0; granular .5 ft offset .25; manual vertical insulation 40 ft ×6 ft, .25 ft foam; test overlapping layers in disposable case | 1200 SF/3600 BF horizontal; 22.2222 CY granular; 240 SF/720 BF vertical; conflicting layers pending/refused |
| L08 waterproofing/drainage | Isolated 40 LF wall, coverage 8 ft; complete 40×30 exterior ring, waterproof height 6, drainage offset 2; repeat on irregular L fixture | 320 SF isolated; rectangle 840 SF and 156 LF; L 960 SF and 176 LF; no fittings/slope inference; incomplete loop refused |
| L09 selection/deletion | Direct and shift selection, window fully contains component, crossing intersects partial footprint, filter, select assembly; delete one source wall with dependents, inspect affected counts; cancel then confirm | Correct selection; visibility doesn't change quantities; full dependent groups deleted only on confirm; independent geometry remains |
| L10 history and previews | Cancel perimeter/footing/envelope/drainage; apply and replace each; undo/redo; change source after preview; test invalid exact entry recovery | No preview history; atomic replacement; stale previews rejected; source edits refused where derived geometry stale |
| L11 persistence/isolation | Save Project JSON, reopen disposable copy; compare geometry, scope reasons, quantities, source IDs and floor/roof workspace; test guest workflow and existing local auth workflow only if already available | v3 roundtrip, no data loss; no silent legacy conversion; existing workspace behavior preserved |
| L12 diagnostics/pricing | Missing dimensions, unsupported material, pending/excluded reasons, intersecting angled runs, invalid offsets; retain an independent measured run; inspect report/estimate controls | Pending not zero; known subtotal retained; excluded geometry not priced; consolidated pricing remains unavailable; curved/mitred angled geometry not inferred |

### Independent integrated fixtures
Conventional basement: exterior rectangle 40×30, t=8/12, wall height 8, base 0. Strip width 2/depth 1 at top 0. Slab independent 36×26 (936 SF), depth 4/12, base 0; use actual coordinates inside ring. Slab granular .5 below base; excavation 44×34×9. Expected wall 27.1276 CY; footing ring 10.1728 CY (centre dimensions 40−t and 30−t; ring area 4×(70−2t)); slab 11.5556 CY; granular 17.3333 CY; excavation 498.6667 CY; waterproof 840 SF at 6 ft; vertical foam 2520 BF at 3 in; drainage 156 LF at 2 ft offset.

Irregular L exterior: (0,0),(40,0),(40,20),(20,20),(20,40),(0,40); width 1, height 8, base 0. Exact ring footprint 156 SF, wall 46.2222 CY; strip width 2/depth 1 = 11.5556 CY; waterproof 960 SF at 6 ft; drainage 176 LF at offset 2. Use local drawing coordinates/scale; exact absolute coordinates available in source fixture. T and U shapes must preserve concave corners, not bounding boxes.

Stepped T: horizontal (0,0)→(20,0), width 2, height 8, base 0. Vertical (10,0)→(10,10), width 1, height 4, base 2, start extension 1. Same explicit assembly. Net (320+44−8)/27=13.185185 CY. Use coordinated inspector for explicit dimensions; no automatic structural step geometry.

Slab-on-grade: isolated 40×30 slab with 60 SF exclusion and 100 SF thickening at total 18 in, separate 4×4×1 pad, 200 SF ×1 ft fill. Expected slab 18.3951 CY, pad .5926 CY, fill 7.4074 CY. No automatic strip/earthworks inference.

### Known boundaries / closeout
Only simple orthogonal generated perimeters (4–64 vertices); uniform complete exterior envelope/drainage loops, no openings or unequal elevation/height in that generator. Manually specify net coverage for complex walls; isolated angled butt-ended runs supported, intersecting angled junctions pending; curved walls deferred. Generated perimeter width/extension edits require regeneration; derived replacement matches original group and layer identity; explicit applicability decisions require manual resolution. Legacy records lacking manifests/reference metadata retain historical validation. Mixed scope selection presents an explicit proposed included action, not persisted status; Apply required. Continuous face-reference wall drafting not supported. All current measurement outputs are raw quantities, not engineering or estimate authorization.

At initial procedure preparation no owner checks had been run. Subsequent partial owner findings are recorded in [c1c-functional-findings.md](c1c-functional-findings.md); do not treat this historical checklist as the current status. Record findings individually; correct material defects and rerun exact HEAD CI. Reconcile governing docs only after owner acceptance, then obtain explicit staging merge approval; main remains untouched until separately authorized release.

### R5.0A acceptance boundary

The three bounded stabilization checks A–C passed on `cd782e7`. See [formal acceptance](c1c-functional-findings.md#r50a-formal-acceptance) for exact-SHA evidence and the exclusion quantity check. The broader C.1C contractor-workflow acceptance remains open.
