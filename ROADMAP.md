# PlanarMTO — Development roadmap

## Authority and vision

Owner-approved development direction. Deliver accurate drawing-driven material takeoff and practical residential material reporting before expanding CAD breadth. This is the authoritative milestone sequence and status register; [SYSTEM_BIBLE.md](SYSTEM_BIBLE.md) governs [product design philosophy](SYSTEM_BIBLE.md#governing-product-design-philosophy), architecture and formulas, [DEVELOPER.md](DEVELOPER.md) governs development and validation, [README.md](README.md) describes current capabilities, [CHANGELOG.md](CHANGELOG.md) records changes, and milestone specifications in docs/ govern approved detailed scope. Conflicts must be reconciled before implementation. A roadmap entry is not authorization to implement a new milestone.

## Current baseline and evidence

C.1B staging integration: owner accepted `fb60747f83183016694f4c54ac2dbc609087f5e5` (10/10 local checks; CI #129, 127/127 tests). Documentation-only head `8d707902adbf7365ef6e78a64bdab90ce634732e` passed [CI #132](https://github.com/homeextent/planarmto/actions/runs/45544873706) (127/127, job 138971962757). [PR #10](https://github.com/homeextent/planarmto/pull/10) merged into staging at `3649f546cbf0a6e19b831753181cc8616330c22c`; owner confirmed clean synchronized local staging and successful post-merge CI #133. Merge and branch identity independently verified; CI #133 is owner-reported, with exact run ID/job logs not independently retrieved because the commit lookup omits push runs. No production promotion; main remains v2.15.1 at `0423cb6`.

C.1C owner accepted R5.12 at `49deaa8d7b7801efd8bc0a89021e3fe4b41b7896`, with 342 reported local cases and [CI #204](https://github.com/homeextent/planarmto/actions/runs/45926069625). [formal acceptance and deferred-refinement register](docs/c1c-local-acceptance.md#formal-owner-acceptance).

## Milestone register

| ID | Scope and dependency | Status |
|---|---|---|
| A | PDF blueprint import | Production released in v2.15.1. [Evidence](docs/pdf-blueprint-import.md) |
| B | Workspace management | Owner accepted and staging integrated |
| C.1A | Measurement architecture | Established and staging integrated. [Record](docs/c1a-measurement-architecture.md) |
| C.1B | Roof drafting and measurement | Owner accepted and staging integrated. [Record](docs/c1b-roof-measurement.md) |
| C.1C | Foundation drafting and measurement | Complete. Owner accepted at R5.12 and integrated through PR #12. [staging CI #206](https://github.com/homeextent/planarmto/actions/runs/45928716470) passed |
| C.1D | Site drafting and measurement | Deferred |
| C.1S | Cross-workspace standardization | Next planned read-only Floor and Roof alignment assessment. Separately authorized |
| C.1E | Integrated material measurement coordination | Cross-workspace ownership, completeness, duplicate prevention and compatible material identities, specifications and units |
| C.2 | Dedicated material takeoff reporting and optional material pricing | Future workspace and consolidated Reporting, purchasing adjustments, CSV/PDF, Material Catalogue & Pricing and safe supplier synchronization adaptation |
| v2.16.0 | Standalone material takeoff production release, with C.1D deferred | Separately authorized following integrated acceptance |
| D | Drawing library and revisions | Planned future |
| E | Drawing overlays | Planned future |
| F | Optional 3D visualization | Future consideration only |

## Scope and architectural boundaries

Floor, roof, foundation and site remain optional typed workspaces with independently calibrated geometry and histories, shared project settings/rates, and explicit measurement ownership. Existing valid floor formulas remain protected. Roof quantities are independent of floor gross area. Foundation quantities must derive from explicit geometry and specified assembly inputs, not inferred structural design.

C.1D remains deferred beyond v2.16.0. Retain optional site schema and existing records. Applicable site materials may be manually quantified with provenance, left explicitly pending, or excluded with a reason. Missing site quantities never become zero.

The System Bible governs [material takeoff, reporting and pricing](SYSTEM_BIBLE.md#material-takeoff-reporting-and-pricing-boundaries). C.2 supersedes the earlier comprehensive estimating scope. Labour, equipment, subcontractor quotations, financial allowances, overhead, profit and budgeting remain deferred. The existing supplier sync and historical rate data are preserved. Potential TIG Estimating exchange is separately gated and carries no release dependency.

[Issue #14](https://github.com/homeextent/planarmto/issues/14) retains multi-page PDF workspace assignment and architectural scale presets as future work.

## Deferred scope

General irregular automatic roof skeleton generation, complex thermal boundaries and unsupported soffit geometry remain manual; no new runtime dependency or approximate fallback. General site grading, cut/fill, hardscape and landscaping drafting are future C.1D work. Preserve source data and optional workspace contracts; no destructive migration or automatic deletion. No structural engineering design, automatic topographic model, procurement claims or new hosting commitments implied.

## Release and closure protocol

Use isolated feature/documentation branches and PRs to staging, exact-head CI, technical review and owner local production-preview acceptance for visible changes. Document-only changes require no visual acceptance. Before milestone closure review all five governing root files and applicable detailed specifications; record exact accepted source, CI run IDs, owner decisions, merge SHA, post-merge CI, limitations and waivers. Distinguish independently verified evidence from owner reports. Avoid endless documentation-only CI loops: record immutable evidence for the accepted implementation and milestone merge; subsequent housekeeping PR validation is tracked by its own PR. No main changes, deployment or version bump without separate release approval. Production v2.15.1 remains until explicitly approved v2.16.0 release and live verification.

## Next authorization gates

C.1C is complete and frozen at R5.12 on staging `3be2cf482179a2a60bb232f7fbf07a26134b3145`. [CI #208](https://github.com/homeextent/planarmto/actions/runs/45930203888) passed.

After independent documentation review and explicit staging merge authorization, the next planned task is a separately authorized, bounded read-only C.1S assessment. Assess Floor and Roof conformance against Foundation R5.12, presentation-only changes, deficient measurement contracts, reusable interface components, legacy MTO and labour dependencies, supplier rate compatibility, and risk to validated quantities. Consider whether C.1S implementation should stand alone or be combined with the opening stages of C.1E. Preserve existing validated transactions and assess the old Live MTO Matrix independently of historical pricing. The assessment and implementation are separately gated.
