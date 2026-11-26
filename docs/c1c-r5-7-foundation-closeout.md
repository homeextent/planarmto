# R5.7 layered construction and foundation closeout

The [governing product design contract](../SYSTEM_BIBLE.md#governing-product-design-philosophy) defines the standard, advanced and engine responsibilities. The application baseline is `5a6db24aaab462d4dda888a18be08515709df849`, CI #196 and 322/322 local regressions. The subsequent `9d48fe1c14885880f25d1b9b3e1a0fd9f20931ea` commit consolidated documentation. Full C.1C and R5 practical acceptance remains withheld.

| Requirement | Implementation and acceptance focus |
|---|---|
| R57-01–03 | Start with the primary walls or slab. Pending optional systems are collapsed, and included systems show their material and section dimensions where available. Explicit scope remains authoritative. Newly specified walls, footings, pads and slabs propose poured concrete using existing material fields. Standard perimeter Preview discloses the conventional local reference. |
| R57-04 | Independent walls keep the independent measurement contract. Drawing selects the wall and shows its construction properties, traced length and concrete proposal. The existing specialist dependent tools and explicit closed-loop adoption remain available. |
| R57-05 | Construction drafting tools are disabled during an active specification draft or pending correction. The toolbar directs the contractor to review, apply or cancel the draft. Intentional workspace switching retains the existing workspace-local construction drafts. |
| R57-06–07 | The baseline fixture reproduced a missing-width independent wall suppressing valid concrete quantities. The old broad phase returned potential overlap for every solid whenever either footprint was unknown. Elevation reference checks propagated the misleading common-reference warning. The new broad phase uses the finite wall-axis interval, including known end extensions, to rule out impossible intersections without guessing width. Unresolved intervals remain pending. Standard measurement checks group pending results by construction and cause, with raw detail available. |
| R57-08 | Delete assembly previews the owned active removals and their quantity changes, then requires explicit confirmation. Independent dependent geometry blocks deletion. Current owner identity, revision and project validation govern Apply. Detached and unrelated measurements remain independent. The parent history disappears with the parent in the committed state and is restored with it on undo. |
| R57-09 | Review rectangle dimensions before transferring the trace into the editor. Exact width and depth use the existing precision entry. Saved footprints expose actual dimensions. Supported slab corner correction keeps ordered edge identities, updates its independent extent and regenerates under-slab quantities through the existing correction transaction. |
| R57-10 | Existing measurement, geometry, layer, provenance, ownership, preset and transaction contracts remain authoritative. No schema-version change or new calculation architecture. |

## Compatibility and limits

Parent deletion is a new internal Preview command. It reuses current project validation and history and adds no serialized fields. Footprint correction uses the existing ordered trace, slab extent, correction audit and dependency graph. Orthogonal slab corrections move the incident edges. Other supported simple polygons move the selected vertex. Invalid or unsupported footprints and incompatible dependent details are rejected.

Disjointness with unknown width can only be established where the projected intervals exclude overlap. A wall that appears separate on screen can still have unresolved physical coverage where its width or geometry is missing. Different local zeros never establish a shared elevation. The initial owner-reported 3.34 CY slab result remains unconfirmed.

## Practical acceptance

1. Trace a 20 × 20 ft foundation, confirm an 8 in wall thickness and 8 ft wall height, and compare the walls-only total with 15.28 CY. Add a separate irregular perimeter and then centred footing layers without retracing. Confirm primary quantities remain valid while optional systems are pending.
2. Draw a spatially separate independent wall beyond the other components along its run direction. Confirm prior quantities remain visible and the new wall prompts for its inputs. Complete the wall and verify the resulting quantity. Compare with a deliberately unresolved situation.
3. Enter an exact 20 × 20 ft slab footprint and 6 in concrete thickness. Check 7.41 CY in preview and after Apply. Add supported layers and correct the footprint. Compare before and after quantities, undo and redo.
4. Select an owned component and verify the ordinary Delete shortcut identifies the assembly action. Cancel the parent deletion first, then confirm it and check unrelated construction. Undo, redo, save and reopen.

Stop at independent implementation review and targeted owner practical acceptance.
