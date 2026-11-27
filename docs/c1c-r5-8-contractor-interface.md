# R5.8 contractor interface and independent walls

R5.8 starts from `61ee5f1d53845a54492d99b52fac24eac2533674`, reported 324/324 local regressions and independently verified CI #198. This increment applies the [governing product design contract](../SYSTEM_BIBLE.md#governing-product-design-philosophy) to foundation only. Full C.1C and R5 owner acceptance remains withheld. R5.8 provides the historical baseline for the [R5.9 independent wall transaction and material ledger corrections](c1c-r5-9-contractor-takeoff.md).

| Requirements | R5.8 implementation and review |
|---|---|
| R58-01 | Select an independent wall to see its saved wall inputs and source-linked dependent layers. Use the existing centred or advanced offset strip footing, single-wall waterproofing and vertical insulation generators. Choose the exterior side explicitly from the marked wall start and end. Review the highlighted coverage before Apply. |
| R58-02–05 | Construction shows the selected object's specification and related layers. Geometry shows dimensions, selection, visibility, correction and assembly lifecycle. Quantities distinguishes assembly review from workspace totals, scope and measurement checks. Hidden sections stay mounted during tab navigation. Mixed selections do not silently edit a parent. |
| R58-06–08 | The left toolbar contains primary and specialist drawing tools. The right side owns dependent layer generation and construction specification. Coordinated actions stay accessible during editing. Preview opens quantity review. A new centreline wall confirms the traced reference through Apply. Other physical ambiguities retain explicit controls. |
| R58-09–11 | Existing engines, dependency records, schema v3, revision validation and history remain authoritative. Standard walls, pads, strips and slabs carry poured concrete as the supported proposal. Newly included unconfigured coordinated concrete layers propose the same material. Saved or retained choices take precedence. |
| R58-12–15 | Exterior protection provides direct waterproofing and insulation actions. Area-based waterproofing omits routine thickness and retains historical thickness in Advanced. Rigid insulation exposes thickness. The wall-outward order is explicit and uses stable layer IDs and the approved wall-face basis. |
| R58-16–17 | Saved optional sections start collapsed and show scope, material and applicable dimensions or coverage. Current editing state stays open through navigation and preview. Shared canvas accents support recognition alongside written labels. |

## Open-wall boundaries

The existing independent strip and envelope generators validate the selected wall's source reference and dimensions and retain explicit dependencies. The perimeter drainage generator requires a supported closed wall loop. For an open wall, use the independent drainage drawing tool and explicitly trace the specified route. The independent drainage contract measures plan length and does not store the coordinated assembly's typed pipe diameter or automatic wall-side placement. Providing those semantics for an open wall requires a separate contract review. No open-wall parent assembly or interior slab derivation is introduced.

## Practical acceptance

1. Trace a 20 × 20 ft exterior perimeter and enter 8 in walls at 8 ft height. Review 15.28 CY, include a 24 × 6 in centred footing, and check 2.86 CY footing concrete. Reopen Construction and check the collapsed saved cards.
2. Use the direct exterior actions to add area-based waterproofing and XPS. Verify the different fields, confirm the actual order, and verify wall-face quantities. Switch tabs before applying and confirm the preview and draft remain current.
3. Trace an independent wall. Complete the standard wall inputs, add a footing, select an exterior side and add protection. Check the face shown in Preview. For an independently specified open-wall drain, trace the route from the left toolbar.
4. Create the controlled standalone slab and verify 7.41 CY concrete, 400 SF and 800 informational BF of XPS, and 7.41 CY pea gravel. Check Geometry, Quantities and Construction without losing edits. Verify correction, cancellation, deletion, undo, redo and save/reopen.

Independent source review and targeted practical owner acceptance remain open.

## Rendered verification

Synthetic desktop screenshots of initial construction, Geometry, active Preview, collapsed saved construction, workspace quantities and independent wall construction are under `/tmp/planarmto-r58/final/full-browser-artifacts/foundation-interactions-la-79802--material-rules-across-tabs/`. The independent wall was checked at 1600 × 1000 and 1366 × 900. The focused exterior editor screenshot is at `/tmp/planarmto-r58/exterior-evidence/artifacts/exterior-layered-inspector-fb40b--material-rules-across-tabs/exterior-protection.png`. These are development verification artifacts using synthetic geometry.
