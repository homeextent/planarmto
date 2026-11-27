# PlanarMTO — Development roadmap

## Authority and vision

Owner-approved development direction. Deliver accurate drawing-driven material takeoff and practical residential construction estimating before expanding CAD breadth. This is the authoritative milestone sequence and status register; [SYSTEM_BIBLE.md](SYSTEM_BIBLE.md) governs [product design philosophy](SYSTEM_BIBLE.md#governing-product-design-philosophy), architecture and formulas, [DEVELOPER.md](DEVELOPER.md) governs development and validation, [README.md](README.md) describes current capabilities, [CHANGELOG.md](CHANGELOG.md) records changes, and milestone specifications in docs/ govern approved detailed scope. Conflicts must be reconciled before implementation. A roadmap entry is not authorization to implement a new milestone.

## Current baseline and evidence

C.1B staging integration: owner accepted `fb60747f83183016694f4c54ac2dbc609087f5e5` (10/10 local checks; CI #129, 127/127 tests). Documentation-only head `8d707902adbf7365ef6e78a64bdab90ce634732e` passed [CI #132](https://github.com/homeextent/planarmto/actions/runs/45544873706) (127/127, job 138971962757). [PR #10](https://github.com/homeextent/planarmto/pull/10) merged into staging at `3649f546cbf0a6e19b831753181cc8616330c22c`; owner confirmed clean synchronized local staging and successful post-merge CI #133. Merge and branch identity independently verified; CI #133 is owner-reported, with exact run ID/job logs not independently retrieved because the commit lookup omits push runs. No production promotion; main remains v2.15.1 at `0423cb6`.

R5.6C application candidate `5a6db24aaab462d4dda888a18be08515709df849` retains 322/322 reported local regressions. Independently verified [CI #196](https://github.com/homeextent/planarmto/actions/runs/45825822174) passed, including isolated WordPress integration. Draft PR #12 targets staging. Full R5 practical owner acceptance remains withheld. Schema v3 and production 2.15.1 remain current.

## Milestone register

| ID | Scope and dependency | Status |
|---|---|---|
| A | PDF blueprint import; production v2.15.1 compatibility fix | Production functionally accepted; see [record](docs/pdf-blueprint-import.md) for remaining evidence limitations |
| B | Independent typed workspaces, calibration, histories and persistence | Staging complete |
| C.1A | Canonical schema v3, explicit ownership and specialist contracts | Staging complete; [record](docs/c1a-measurement-architecture.md) |
| C.1B | Independent roof drafting, measurement and R4 usability | Staging integrated; owner-confirmed post-merge CI #133; [record](docs/c1b-roof-measurement.md), [R4](docs/c1b-r4-specialist-usability.md) |
| C.1C | Foundation drafting and measurement | Draft PR #12. R5.6C technical baseline 322/322 and CI #196. R5.7 technical baseline 324/324 and CI #198. R5.8 provided the 328-test baseline and CI #199. R5.9 provided 332 local regressions and CI #201. R5.10 provided 335 local regressions and CI #202. R5.11 passed owner Tests A–D and exact-head CI #203. [R5.12](docs/c1c-r5-12-construction-editor.md) closes the saved-editor consistency gap and awaits targeted acceptance. Full R5 and C.1C acceptance remain pending. |
| C.1D | Dedicated site drafting and measurement | Deferred beyond v2.16.0; separate future authorization |
| C.1E | Integrated quantity ownership, completeness and duplicate prevention | After C.1C; independent of C.1D |
| C.2 | Consolidated MTO, manual quantities, allowances, quotations, pricing and reporting | After C.1E; detailed contract and acceptance separately approved |
| v2.16.0 | Combined B/C production release (excluding C.1D engine) | Separately authorized following integrated acceptance |
| D | Drawing library and revisions | Planned future |
| E | Drawing overlays | Planned future |
| F | Optional 3D visualization | Future consideration only |

## Scope and architectural boundaries

Floor, roof, foundation and site remain optional typed workspaces with independently calibrated geometry and histories, shared project settings/rates, and explicit measurement ownership. Existing valid floor formulas remain protected. Roof quantities are independent of floor gross area. Foundation quantities must derive from explicit geometry and specified assembly inputs, not inferred structural design.

Owner approved deferral of C.1D specialist site drafting beyond v2.16.0; retain optional site schema, existing records and existing floor/deck functionality. Do not require a site workspace for completeness. C.1C includes building-specific excavation/backfill, granular materials, drainage and waterproofing where explicitly measured and specified; detailed design remains subject to scope approval. C.1E must reconcile ownership and completeness including non-drafted applicable site scope; C.2 must support explicitly sourced contractor-entered quantities, allowances and quotations alongside measured geometry, without treating allowances as measured quantities or double counting. Site UI visibility is a future release-design decision, not a current code change. See ROADMAP.md.

Geometry-derived quantities, contractor-entered quantities and monetary allowances/quotes are distinct sources. C.1E and C.2 specifications must define provenance, applicable scope, units, completeness, exclusions with reason, duplicate prevention and pricing/waste applied once. Missing inputs remain unquantified, not zero. Manual quantities must be explicit and auditable; cost allowances must not masquerade as material quantities. Applicable site work can be manually quantified, priced by allowance or quote, or explicitly excluded; deferring the site engine does not silently exclude site costs. C.1E should define completeness treatment of unresolved and provisional allowances. Consolidated project cost/print output remains gated until C.2.

## Deferred scope

General irregular automatic roof skeleton generation, complex thermal boundaries and unsupported soffit geometry remain manual; no new runtime dependency or approximate fallback. General site grading, cut/fill, hardscape and landscaping drafting are future C.1D work. Preserve source data and optional workspace contracts; no destructive migration or automatic deletion. No structural engineering design, automatic topographic model, procurement claims or new hosting commitments implied.

## Release and closure protocol

Use isolated feature/documentation branches and PRs to staging, exact-head CI, technical review and owner local production-preview acceptance for visible changes. Document-only changes require no visual acceptance. Before milestone closure review all five governing root files and applicable detailed specifications; record exact accepted source, CI run IDs, owner decisions, merge SHA, post-merge CI, limitations and waivers. Distinguish independently verified evidence from owner reports. Avoid endless documentation-only CI loops: record immutable evidence for the accepted implementation and milestone merge; subsequent housekeeping PR validation is tracked by its own PR. No main changes, deployment or version bump without separate release approval. Production v2.15.1 remains until explicitly approved v2.16.0 release and live verification.

## Next authorized work

R5.0A is accepted at `cd782e7` on the existing feature branch. The owner approved the [coordinated specification](docs/c1c-r5-coordinated-specification.md). The [R5.1–R5.2 candidate](docs/c1c-r5-1-r5-2-evidence.md) is for independent source review. The revised [R5.3 persistence design](docs/c1c-r5-3-persistence-design.md) was approved at `1be740b`. Review the [R5.3–R5.5 candidate and R5.6 evidence](docs/c1c-r5-technical-evidence.md) before actual-plan owner acceptance and any staging decision. C.1C remains unmerged pending owner contractor-workflow acceptance and explicit staging authorization. See [R5.0A evidence and owner checks](docs/c1c-functional-findings.md#r50a-formal-acceptance) and [proposed R5](docs/c1c-r5-contractor-workflow.md). C.1E and C.2 are separately gated.

R5.6A closeout covers the bounded detachment and trace correction amendment. See [technical evidence](docs/c1c-r5-technical-evidence.md) for the independent implementation and actual-plan acceptance gates.
