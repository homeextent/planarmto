# R5.11 construction interface consistency and lifecycle

Approved checkpoint `c8bf5ab469fa26bd415b781c6384a13cb72e24b2`, 335 local regressions and exact-head CI #202. Draft PR #12 targets staging.

## R5.11 owner acceptance

The owner reported Tests A, B, C and D passed at `130e5b70c1be38ec96aa2b81a5173491017a74a2`, including assembly deletion, coordinated independent wall layers, full-height and specified coverage, and project save/reopen. [CI #203](https://github.com/homeextent/planarmto/actions/runs/45911996359) passed. The saved-editor consistency finding is tracked in [R5.12](c1c-r5-12-construction-editor.md). Full R5 and C.1C acceptance remain separate.

## R5.10 owner evidence

The owner accepted independent wall creation and exact specifications, centred strip footing without numerical elevation, independent waterproofing, saved layer editing, rectangular and polygon pad creation, exact pad dimensions and depth edits, actual architectural plan tracing, coordinated foundation layers, material-specific quantities, Cancel, undo and redo, and concrete volume subtotals alongside supplementary counts. The owner demonstrated 8.10 CY alongside two pad footings. Practical save/reopen, discoverable assembly deletion, initial independent wall supporting construction and equivalent full-height coverage remained open. This does not constitute full R5 or C.1C acceptance.

## Requirements

| Requirement | Implementation |
| --- | --- |
| R511-01 | Canvas Delete formerly rejected every selection touching an owned child. A complete single-parent selection now opens the existing deletion transaction. |
| R511-02 | Construction and Geometry expose Delete assembly for an exact complete selection or a deliberately focused assembly with no canvas selection. Partial, mixed and multi-parent selections require selection refinement. |
| R511-03 | Existing controller previews affected layer removals and quantity changes, requires explicit confirmation, protects dependencies and retains unrelated or released identities. |
| R511-04 | Initial independent walls expose collapsed strip, waterproofing and insulation cards alongside primary wall and advanced controls. Unconfigured choices remain pending and create no measurement. |
| R511-05 | Configured layers and primary wall share a single validated Preview, Apply and Cancel transaction using existing generators and history. |
| R511-06 | Open and closed foundation editors show Full wall height or Specified coverage height and display the derived height when available. Open wall layers still require explicit exterior side. |
| R511-07 | An optional source marker in schema v3 records explicitly confirmed full-height coverage on single-wall derived layers. Legacy unmarked heights retain specified semantics. Height edits regenerate explicitly full-height dependents in the same transaction. Excess specified coverage blocks Preview with an actionable reason. |
| R511-08 | Construction, Geometry and Quantities retain common transaction controls and progressive disclosure. No independent parent assembly or automatic open-wall drainage is introduced. |
| R511-09 | System Bible and milestone documentation establish equivalent terminology, presentation, transactions and lifecycle across geometry sources. |

## Owner practical acceptance

1. Start the candidate production build in a disposable browser profile using Node 22 and `npm run preview -- --host 127.0.0.1 --port 4173 --strictPort`.
2. Select one complete assembly via a canvas window, choose Delete and inspect quantity removals. Cancel, then use the inspector to preview again and confirm. Check partial and mixed selections, unrelated measurements, undo, redo and project reopen.
3. Trace a 25 ft wall. Before Apply, input 8 in thickness, 8 ft height, a 24 in × 6 in centred strip, full-height waterproofing and 2 in XPS on explicitly selected faces. Check 4.938272 CY wall, 0.925926 CY strip, 5.864198 CY combined, 200 SF each layer and 400 informational BF.
4. Edit one layer to specified 6 ft and increase the wall to 10 ft. Check that full-height coverage becomes 250 SF and specified coverage remains 150 SF. Try reducing the wall below the specified coverage and verify the warning and blocked Apply.
5. Export and reopen the project, then verify the stored coverage choices and existing quantities. Full R5 and C.1C remain subject to explicit owner acceptance.
