# R5.9 contractor interface and material takeoff

Approved baseline `6f8252a25504ad6a832356e4b72f40e50fc092e7`, 328 local regressions and exact-head CI #199. The owner exercised rectangular and irregular foundations, standalone rectangular and polygon slabs, independent walls, construction layers and the tabbed inspector. The owner reported fragmented independent-wall editing, generic material totals and a potentially over-conservative overlap warning. Full R5 and C.1C acceptance remain withheld.

| Requirement | Implementation and evidence |
| --- | --- |
| R59-01–02 | Construction, Geometry and Quantities use the existing inspector. Primary wall specifications and saved layer cards use progressive disclosure. Explicit elevations, nonstandard alignment and specialist editors remain accessible. |
| R59-03–04 | Preview, Apply and Cancel share one transaction for independent wall properties or a selected linked layer. Preview leaves committed state intact. Editing or changing the source invalidates the reviewed candidate. Included, excluded and pending decisions retain their provenance. |
| R59-05–06 | Standard cards add, edit and preview removal of eligible footings and exterior layers. Saved dimensions, material and side reopen. Existing generators and validated history preserve ownership and quantity authority. Open walls require an explicit exterior side. Specialist drawing retains manual drainage. |
| R59-07–08 | Workspace and saved assembly summaries share ledger grouping by unit, construction application and material. Insulation retains thickness. Drainage uses available diameter and perforation attributes. Missing specifications remain explicit. |
| R59-09–10 | Collapsible, colour-coded material categories separate known and unresolved rows. Compatible category subtotals summarize their detail rows. Reference footprint and informational board feet stay separate. Rigid mineral wool is ineligible for foam board feet, including legacy records with a saved foam indicator. |
| R59-11 | The preserved R5.8 baseline reproduced a possible intersection under unknown wall width. Existing overlap validation remains authoritative. |
| R59-12–13 | Governing documents and the technical evidence register record the product contract and targeted tests. |

## Controlled R5.8 overlap reproduction

A 20 ft by 20 ft slab with 6 in depth occupies X 0–20 and Y 0–20. A 12 ft wall from (4, 25) to (16, 25) has a visible 5 ft centreline gap. Wall thickness, height and base elevation start unset. Because the wall's run lies across the slab's projection, its unknown width prevents ruling out intersection. The slab concrete row remains unresolved and reports “Confirm the dimensions of a nearby construction component before reconciling overlap”. Entering 8 in thickness restores 7.41 CY to the slab row. Moving the incomplete wall to X 25–35 preserves the same independently valid slab quantity because its run clears the slab. The fixture reproduces the observed behavior under controlled geometry. The exact owner geometry remains unavailable.

## Persistence and safeguards

Schema v3 continues to store the existing components, specs, scope and source relationships. Material totals derive from the authoritative ledger. Historical and detached drainage records may lack detailed specifications, which appear as unspecified. The standard layer editor requires unambiguous independent, single-wall source ownership. Advanced tools remain available for supported groups, distinct alignments, and explicit scope decisions. Removal with an explicit scope decision or dependent components requires separate review.

## Numerical verification and rendered evidence

| Controlled quantity | Expected display |
| --- | --- |
| 25 ft independent wall, 8 in by 8 ft | 4.94 CY |
| 25 ft centred strip footing, 24 in by 6 in | 0.93 CY |
| One 25 ft wall face, 8 ft coverage height | 200.00 SF |
| 20 ft by 20 ft exterior foundation, 8 in walls by 8 ft high | 15.28 CY walls |
| Centred 24 in by 6 in strip footing for the same perimeter | 2.86 CY |
| 20 ft by 20 ft independent slab, 6 in depth | 7.41 CY |
| 400 SF of 2 in eligible XPS | 400.00 SF and 800.00 informational BF |
| 400 SF of 6 in granular base | 7.41 CY |

Subtotals sum canonical quantities before rounding. The independent wall and footing subtotal is 5.86 CY even though separately rounded detail rows display 4.94 CY and 0.93 CY.

Rendered evidence is local under `/tmp/planarmto-r59/rendered/`. It includes the independent wall cards, active exterior-side Preview and saved footing editor at 1600 × 1000, along with collapsed and expanded category views and a metric view at 1366 × 900. The untouched R5.8 baseline case is logged in `/tmp/planarmto-r59/baseline.log`.

## Owner practical acceptance

1. Open the exact candidate in the local production preview with a disposable browser profile. Draw a 25 ft independent wall and confirm 8 in thickness and 8 ft height. Set the known wall base under Advanced. Preview 4.94 CY and Apply.
2. Add a centred 24 in by 6 in footing and verify 0.93 CY. Add 8 ft high waterproofing on the confirmed exterior face and verify 200.00 SF. Add 2 in XPS on the same confirmed face.
3. Edit the saved footing depth. Switch tabs with Preview active, then change the draft and confirm Apply is disabled. Exercise Cancel, Apply, undo, redo and export/reopen. Verify the edited layer remains singular.
4. Expand workspace material categories and compare distinct material and thickness rows in imperial and metric. Identify the subtotal, outstanding inputs and informational foam board feet. Verify saved assembly totals are available separately.
5. Verify prior rectangular and irregular assembly and standalone slab workflows on the owner's plan. Record any remaining discrepancies before the independent implementation and targeted practical acceptance gate.
