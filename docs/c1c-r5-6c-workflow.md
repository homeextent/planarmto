# R5.6C contractor workflow completion

The owner authorized F01–F10 from R5.6B candidate `0ddba3c5b05d10a291d8523f104256a62e245445`, with 318 local regressions and independently verified CI #195. Full R5 acceptance remains withheld. The [product design philosophy](../SYSTEM_BIBLE.md#governing-product-design-philosophy) governs this increment.

| Requirement | Implementation and verification focus |
|---|---|
| F01–F02 | Workspace-local construction drafts keep the calibrated outline visible independently of the proposed children and component filter. Apply or Cancel clears the draft. Rejected preview retains the trace and input. Check repeated rectangle and irregular creation and switch workspaces during a slab draft. |
| F03 | Keep Preview, Apply and Cancel at the top when scrolling construction fields. Show the transaction state and link to quantity review and unresolved inputs. Apply requires a current validated preview. |
| F04–F05 | Corner selection shows a visible handle, adjacent lengths and a live corrected outline where supported. Keep a separate pending correction command. Repeated Preview revalidates that command. Complete or cancel specification edits before correcting the perimeter. Existing lineage and history apply. |
| F06 | A conventional interior slab defaults to the inside wall face and confirmed wall base. Choose Advanced for different supported coverage or elevation relationships. Explicit scopes govern under-slab positioning. The quantity basis identifies the full-footprint estimate. |
| F07 | Rectangle and polygon slab tools open the same coordinated construction editor with the independently traced footprint. The [additive v3 contract](c1c-r5-3-persistence-design.md#r56c-standalone-slab-and-estimating-coverage) reuses existing children, quantities, ownership, validation and atomic history. Legacy independent slab and specialist details remain available under Advanced. |
| F08 | Selecting an owned component leads to the existing assembly editor. Legacy property editors and generators remain available for independent work. |
| F09 | Validation describes the input in contractor terms. Recognized catalogue products populate unambiguous drainage attributes with confirmation provenance. Explicitly confirm pipe diameter and any material attributes the catalogue cannot establish. |
| F10 | Explicitly preview adoption of selected compatible centreline walls. The supported loop must be closed, orthogonal, consistently directed and dimensionally compatible, with confirmed corner extensions. The controller preserves identifiers, prior scope and source history. |

## Confirmed interaction causes

- The draft canvas owned the outline locally and cleared it when the editor opened. The inspector had no outline to render during specification.
- Preview, Apply and Cancel were below the form contents. The action bar now stays in the editor viewport during scrolling.
- Graphical correction preview used the corrected trace. The general Preview rebuilt a specification change from the last saved trace. Re-preview now uses the stored correction command until it is applied or cancelled.
- The coordinated slab form depended on manual extent and relationship fields, and the independent slab toolbar placed a legacy component directly. Standard slab drafting now supplies the selected footprint and proposed estimating relationship to the existing controller.
- Owned selections still displayed advanced legacy property editors and generators. Those controls could present blank inputs or attempt incompatible mutations. The saved assembly editor now owns that interaction.
- Validation capitalized internal field identifiers. Where the catalogue identified a pipe attribute, the earlier form still presented a separate field.
- Adoption used generated perimeter metadata as its entry condition. The selected-loop action explicitly validates independent wall geometry and refuses incompatible dimensions, direction, source grouping or corner extensions.

## Residential slab estimating conventions

A new conventional interior slab uses its confirmed wall base. A standalone slab uses a slab-local bottom reference. The review discloses these conventions where applied. Existing elevations and overlap protections continue to govern. An unresolved relationship remains unresolved where it affects measurement.

Insulation and granular base use the full confirmed slab footprint as an estimating basis. Their quantities use independently specified thickness. Footing projections can reduce net installed coverage. Specialist net coverage remains separately specified. Garage slab elevation implies no imported fill, excavation or backfill.

## Targeted owner acceptance

1. Trace and apply two separate foundations in one workspace, including an irregular loop. Switch away during a draft and return. Check visibility, persistent actions, cancel and rejected overlap.
2. Select a footing, edit the saved depth, and check the change is confined to footing concrete. Move a saved corner, Preview twice, and compare the corrected quantity review before applying. Undo and redo each transaction.
3. Configure a conventional interior slab and a standalone garage slab. Check the full-footprint basis, specified base thickness, and behavior when insulation is included, excluded and pending. Compare against the drawing and reopen the saved project.
4. Explicitly adopt a compatible selected wall loop. Verify a disconnected or incompatible selection is refused and the takeoff contributes once.

Stop at independent implementation review and targeted practical owner acceptance.
