# R5.12 final construction editor consistency

Approved starting commit `130e5b70c1be38ec96aa2b81a5173491017a74a2`, 340 local regressions and exact-head CI #203. The owner accepted R5.11 Tests A–D, including assembly deletion, independent wall construction and supporting layers, both exterior coverage modes, and project save/reopen. The separate R5.12 finding concerns editing complete saved independent wall selections.

## Root cause and requirements

The inspector only resolved a standard independent wall editor when exactly one entity was selected and that entity was a wall. A window selection had no single selected record and fell through to legacy controls. Selecting a linked layer treated it as a standalone record. Existing committed records already contain the source and group IDs needed to route to the standard editor.

| Requirement | R5.12 contract |
| --- | --- |
| R512-01 | Creation and committed editing reuse the existing Construction, Geometry and Quantities inspector and validated transaction controls. |
| R512-02 | The single-wall editor accepts wall-only and unambiguous window selections containing that wall and its linked layers. |
| R512-03 | A singly selected source-linked footing, waterproofing or insulation opens its saved section in the wall editor. Owned components stay in the parent editor with their system in view. Slab and pad editing use standard construction transactions. |
| R512-04 | Editors initialize from saved fields and preserve source and ownership identity. Selecting construction has no measurement side effects. |
| R512-05–06 | Advanced operations remain accessible through collapsed controls. Shared or unrelated selections receive guidance. Explicit legacy geometry assignment remains available under Advanced. |
| R512-07 | Existing measurement, topology, dependency, schema v3 and history contracts remain authoritative. |
| R512-08 | System Bible establishes Trace → Specify → Preview → Apply → Select → Modify across measurement workspaces. |
| R512-09 | Routine foundation volumes, areas, lengths and informational board feet display at most two places. Discrete counts are whole. Subtotals use unrounded contributions. |
| R512-10 | Controlled selection, quantity, editing, history and export/reopen evidence accompany the candidate. |

## Targeted owner practical acceptance

1. With Node 22, start `npm run preview -- --host 127.0.0.1 --port 4173 --strictPort` and use a disposable browser profile.
2. Create the 25 ft wall with 8 in thickness, 8 ft height, a centred 24 in × 6 in footing, full-height waterproofing on one face, and 2 in XPS on one face. Verify 4.94 CY wall, 0.93 CY footing, 5.86 CY subtotal, 200.00 SF for each exterior layer, and 400.00 informational BF.
3. Select the wall, window-select the complete construction, then select each linked layer separately. Verify the same standard editor, saved material and dimension values, and unchanged quantities. Select an unrelated construction with the wall and confirm the guidance.
4. Change a linked layer, Preview and Cancel. Repeat and Apply, then test undo, redo and export/reopen. Verify a pad count displays as a whole number alongside concrete volume.

The owner formally accepted R5.12 and C.1C. The [closeout](c1c-local-acceptance.md#formal-owner-acceptance) records the accepted SHA and completed staging integration. The procedure above is retained as historical acceptance guidance.
