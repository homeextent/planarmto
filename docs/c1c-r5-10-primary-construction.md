# R5.10 primary construction workflow closeout

Approved baseline `d1ffe4a96f1a7a51b010ca85b615bc2122060880`, 332 local regressions and exact-head CI #201. The owner demonstrated rectangular and irregular foundations, standalone slabs, independent wall concrete and exterior coverage, and material-specific and insulation-thickness reporting. The remaining feedback concerned centred strip footing eligibility, wall drawing confirmation, pad footing properties and the volume subtotal with supplementary counts. The reported pad screenshot showed 84.03 SF at 6 in depth, consistent with 1.56 CY. It provides no evidence of a pad volume defect.

| Requirement | R5.10 contract |
| --- | --- |
| R510-01 | The strip generator requires a confirmed centreline, width, poured concrete, and a confirmed non-null wall base. The isolated wall volume can be valid without its base. Conventional centred Preview uses the existing local elevation reference at the confirmed wall base, and applies the wall and footing together. Preserve known elevations and require explicit base review for a non-centred or ambiguous case. |
| R510-02–03 | A standard independent wall trace stays uncommitted during exact length correction and reference review. Specify wall construction opens the existing transaction. After Apply, edit the wall or add eligible footing, waterproofing and insulation on the same trace. Continuous segment drafting stays in Specialist drawing tools. |
| R510-04–05 | Standard rectangle and polygon pad tools retain an uncommitted footprint with area, exact rectangle correction, construction specification and cancellation. Geometry shows rectangular dimensions or polygon corner count. Construction proposes poured concrete and takes depth. Advanced elevation remains accessible. |
| R510-06–07 | Ledger concrete volume remains authoritative. The concrete category subtotal sums compatible volume rows at full precision. Pad count is supplementary and footprint is a reference. |
| R510-08 | Existing topology, overlap, dependency checks, atomic workspace history and schema v3 remain authoritative. A local wall/footing reference cannot establish separation from unrelated project or assembly frames. |
| R510-09 | System Bible establishes Trace → Confirm geometry → Specify construction → Preview → Apply as the interface standard. The governing and milestone documents reference this workflow. |

The local reference becomes committed only with the centred footing. Its zero is a comparison origin for that wall and footing. Advanced controls remain available for historical and nonstandard construction. The pad continues to use the existing pad geometry contract. Dedicated pad exclusions are not defined by that contract. Independent specialist geometry and existing supported slab exclusions remain available.

## Controlled unrounded benchmarks

| Construction | Expected quantity |
| --- | ---: |
| 25 ft wall, 8 in thick × 8 ft high | 4.938272 CY |
| 25 ft centred strip, 24 in × 6 in | 0.925926 CY |
| One wall face, 25 ft × 8 ft | 200 SF |
| One rectangular pad, 36 in × 36 in × 6 in | 0.166667 CY and 9 SF reference |
| Four identical rectangular pads | 0.666667 CY and 4 EA |
| Trapezoidal pad, parallel sides 4 ft and 3 ft, 3 ft apart, 6 in depth | 10.5 SF and 0.194444 CY |
| 20 ft × 20 ft exterior wall ring, 8 in × 8 ft | 15.275720 CY |
| Centred 24 in × 6 in strip under that ring | 2.864198 CY |
| 20 ft × 20 ft × 6 in slab | 7.407407 CY |
| 2 in XPS on 400 SF | 400 SF and 800 informational BF |
| 6 in granular base on 400 SF | 7.407407 CY |

## Targeted owner practical acceptance

1. Use Node 22 and launch the exact candidate production build with `npm run preview -- --host 127.0.0.1 --port 4210 --strictPort`. Open it in a disposable browser profile.
2. Draw a foundation wall, correct the length to 25 ft, and select **Specify wall construction**. Set 8 in thickness and 8 ft height. Preview and apply 4.94 CY. Add the 24 in × 6 in centred strip footing without entering an elevation. Verify 0.93 CY. Add or review existing exterior layers.
3. Trace a rectangular pad, set the footprint to 3 ft × 3 ft, select **Specify pad footing construction** and set a 6 in depth. Verify 0.17 CY, 1 EA and 9 SF reference. Edit depth and repeat preview. Confirm the volume subtotal persists alongside the count. Repeat with a separate polygon pad and review the actual traced footprint.
4. Exercise Cancel, undo, redo, export and reopen. Inspect imperial and metric quantity display. Record results before independent review and the owner acceptance gate.
