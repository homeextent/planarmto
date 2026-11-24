# Increment B.1 — Typed estimating workspace architecture

Status: implementation candidate; staging acceptance pending. Baseline 0423cb605d99d32b6a537f01e7115157388b9ccd (v2.15.1). Target combined B/C production release v2.16.0; B.1 does not change application runtime, persistence or calculation formulas.

## Canonical ownership

- ProjectDocument schemaVersion 2 owns project ID/name, shared ProjectSettings (rates, branding, inclusions, financial markups), activeWorkspaceId, ordered workspaces and scope policy.
- Each workspace has stable ID, name and type (floor, roof, foundation, site); owns its independent existing CAD geometry collections and blueprint/calibration. Source sheets are not workspace identities.
- Existing FloorplanState is a detached compatibility view, not a second persisted authority. Geometry commits explicitly target a workspace and do not overwrite shared settings.
- New blank documents use explicit scope. Roof/foundation/site scope is either unquantified, excluded or measured with one or more matching typed workspace IDs. Multiple distinct roof workspaces are permitted. Assignment metadata is not proof of a measured quantity; actual measurement tools, overlap checks and calculation enforcement belong to C.1.
- Legacy documents retain a single designated legacy owner, with no simultaneous explicit scope assignment. Migration wraps the original geometry and settings in Level 1 without guessing the original storey or persisting any change. C.1 must enforce the transition from legacy inference to measured scope and block duplicate contributions.

## Boundary and test scope

The standalone projectDocument module validates schema version, required settings and geometry arrays, workspace and entity identifiers, active selection, selected geometric references, blueprint scale and scope ownership references. It rejects malformed structure and unsupported future versions. This is not exhaustive CAD entity validation, sanitization or repair. Existing historical alias normalization, incomplete historical records and JSON/WordPress ingress compatibility require B.2 integration testing. The compatibility adapter preserves complete valid v2.15.1 FloorplanState content. The current project storage schema and application runtime are untouched.

Regression tests exercise four existing sample factories (blank, rancher, studio, garage), PDF metadata and calibrated underlays, shared settings/rates, original state immutability, MTO/cost parity using identical engine inputs, isolated geometry and scope ownership, serialization, and rejection of invalid documents. Fixtures are synthetic, not actual customer records.

## Remaining gates

- B.2: workspace create/rename/reorder/delete/switch, workspace-scoped history/selection/asynchronous guards, project settings update path, complete JSON import/export/save/Save As/autosave, legacy underlay alias normalization, actual multi-image payload limits and local/WordPress recovery. Do not expose misleading consolidated quantities before C is complete.
- C.1: dedicated roof plane and edge measurements (roofing, soffit, fascia, eavestrough, insulation), explicit foundation/site ownership, scope transition and nonduplication, calculation authority and cost parity. No automatic roof geometry inferred from unrelated floor plates for explicit projects. Unmeasured is not zero or excluded.
- C.2: level/project reporting, directory totals and print/export integration; test combined B/C before separately authorized production release.
- No new dependencies, hosting services or database migration in B.1. Production main remains unchanged.

## Verification

Run `npm ci`, `npm run lint`, `npx --no-install tsx --test tests/project-document.test.ts`, and `npm run build`. Existing validation CI includes persistence regressions, security audit, PHP syntax, worker asset integrity and isolated WordPress integration. New project-document tests are added to the same pipeline. No local or CI pass is claimed until results are available.
