# C.1C R5.3 persistence and assembly-controller proposal

The revised design at `1be740b` passed independent review and received owner implementation authorization. This file records the approved proposal. See the [technical candidate register](c1c-r5-technical-evidence.md) for verification and implementation limits. Schema version stays 3.

## Storage and interfaces

Today `EstimatingWorkspace.measurements` is the specialist entity ledger. Foundation topology validates legacy source manifests, original perimeter references, material, datum, and physical relationships. `App.tsx` tracks workspace history separately from project settings. `workspaceController.replaceSpecialistEntities` and `restoreWorkspaceSnapshot` validate through `readProjectDocument`. A coordinated edit needs to pass the parent and child changes through that validation in the same operation.

Proposed additions to the existing types, with declarations collected in a new `src/engine/measurements/foundationAssemblyModel.ts`:

```ts
type MaterialCategory = 'concrete' | 'insulation' | 'waterproofing' | 'drainage' | 'granular';
type MaterialChoice =
  | { kind: 'catalogue'; category: MaterialCategory; id: string }
  | { kind: 'custom'; category: Exclude<MaterialCategory, 'concrete'>; id: string; description: string };
type Source = { kind: 'plan' | 'estimatingAssumption' | 'manualOverride'; reference: string };
type Confirmation =
  | Source
  | { kind: 'presetSnapshot'; presetId: string; version: number; reference: string };
type Confirmed<T> = { value: T; confirmation: Confirmation };
type DraftSpecification<T> = { [K in keyof T]?: Confirmed<NonNullable<T[K]>> };
type Scope<T> =
  | { status: 'pending' | 'excluded'; reason: string; retainedSpecification?: DraftSpecification<T> }
  | { status: 'included'; specification: DraftSpecification<T> };
type TraceSegment = { id: string; startVertexId: string; endVertexId: string };
type AssemblyTrace = {
  kind: 'rectangle' | 'orthogonal';
  reference: 'exterior' | 'centreline' | 'interior';
  vertices: { id: string; point: Point }[];
  segments: TraceSegment[];
  source: Source;
};
type WallSpec = {
  material: MaterialChoice;
  widthFt: number;
  heightFt: number;
  datum: { basis: 'base' | 'top'; elevationFt: number };
  openings: { sourceSegmentId: string; opening: WallOpening }[];
};
type FootingSpec = {
  material: MaterialChoice; widthFt: number; depthFt: number;
  alignment: { kind: 'centred' } | { kind: 'explicitOffset'; offsetFt: number };
  top: { kind: 'wallBase' } | { kind: 'explicit'; elevationFt: number };
};
type LayerSpec = {
  id: string; material: MaterialChoice;
  coverage:
    | { kind: 'specifiedHeight'; heightFt: number }
    | { kind: 'confirmedFullHeight' }
    | { kind: 'manualNetSegments'; segments: { id: string; start: Point; end: Point; heightFt: number }[] };
  thicknessFt?: number;
  attributes?: { productReference?: Confirmed<string> };
};
type PipeAttributes = {
  nominalDiameterFt?: Confirmed<number>;
  pipeMaterial?: Confirmed<string>;
  perforation?: Confirmed<'perforated' | 'solid'>;
};
type ManualDrainageRoute = {
  kind: 'manual';
  closed: boolean;
  vertices: { id: string; point: Point }[];
  segments: TraceSegment[];
};
type DrainageSpec = {
  material: MaterialChoice;
  attributes?: PipeAttributes;
  route:
    | { kind: 'footingEdgeOffset'; offsetFt: number }
    | { kind: 'wallFaceOffset'; offsetFt: number }
    | ManualDrainageRoute;
};
type SlabSpec = {
  material: MaterialChoice;
  extent: { kind: 'confirmedInterior' } | { kind: 'independent'; points: Point[] };
  thicknessFt: number; baseFt: number;
  footingRelation: Confirmation;
  openings: SlabOpening[]; thickenings: SlabThickening[];
};
type UnderSlabLayer = {
  id: string; material: MaterialChoice; thicknessFt: number;
  attributes?: { productReference?: Confirmed<string> };
};
type AssemblySpecifications = {
  walls: Scope<WallSpec>;
  footing: Scope<FootingSpec>;
  exteriorLayers: { id: string; scope: Scope<LayerSpec> }[];
  drainage: Scope<DrainageSpec>;
  slab: Scope<SlabSpec>;
  insulation: Scope<UnderSlabLayer>;
  granular: Scope<UnderSlabLayer>;
};
type PresetLayer = Omit<LayerSpec, 'coverage'> & {
  coverage: Exclude<LayerSpec['coverage'], { kind: 'manualNetSegments' }>;
};
type PresetSystems = {
  walls: Scope<Pick<WallSpec, 'material' | 'widthFt' | 'heightFt'>>;
  footing: Scope<Omit<FootingSpec, 'top'> & { top: { kind: 'wallBase' } }>;
  exteriorLayers: { id: string; scope: Scope<PresetLayer> }[];
  drainage: Scope<Omit<DrainageSpec, 'route'> & {
    route: Exclude<DrainageSpec['route'], { kind: 'manual' }>;
  }>;
  insulation: Scope<UnderSlabLayer>;
  granular: Scope<UnderSlabLayer>;
};
type PresetVersion = { version: number; name: string; systems: PresetSystems };
type PresetOrigin = { presetId: string; version: number };
type FoundationPreset = { version: 1; id: string; origin?: PresetOrigin; versions: PresetVersion[] };
type PresetSnapshot = { presetId: string; version: PresetVersion; confirmation: Source };
type ChildRole =
  | { system: 'wall' | 'footing' | 'drainage'; sourceId: string }
  | { system: 'exterior'; sourceId: string; layerId: string }
  | { system: 'slab' }
  | { system: 'insulation' | 'granular'; layerId: string };
type ChildBinding = { role: ChildRole; entityId: string; physicalId: string };
type ComponentScopeDecision = FoundationApplicability | { status: 'legacyAbsent' };
type ScopeSource = Source | { kind: 'historicalRecord'; entityId: string };
type ComponentScopeRecord = {
  entityId: string;
  decision: ComponentScopeDecision;
  source: ScopeSource;
  inheritedFromEntityIds: string[];
};
type PriorScopeDecision = {
  revisionId: string;
  previous: ComponentScopeRecord;
};
type RetainedIdentity =
  | { kind: 'child'; binding: ChildBinding }
  | { kind: 'routeVertex' | 'routeSegment'; id: string };
type Replacement = { retired: RetainedIdentity; successorIds: string[]; revisionId: string };
type DormantBinding = { child: ChildBinding; disabledAtRevisionId: string };
type AssemblyOverride =
  | { system: 'walls'; sourceSegmentId: string; patch: Partial<Pick<WallSpec, 'material' | 'widthFt' | 'heightFt' | 'datum'>>; source: Source }
  | { system: 'exterior'; layerId: string; coverage: LayerSpec['coverage']; source: Source }
  | { system: 'footing'; alignment: FootingSpec['alignment']; source: Source }
  | { system: 'drainage'; route: DrainageSpec['route']; source: Source };
type FoundationAssemblyRecord = {
  version: 1; id: string; revisionId: string;
  trace: AssemblyTrace;
  specifications: AssemblySpecifications;
  preset?: PresetSnapshot;
  overrides: AssemblyOverride[];
  children: ChildBinding[];
  dormantChildren: DormantBinding[];
  componentScope: ComponentScopeRecord[];
  priorScopeDecisions: PriorScopeDecision[];
  replacements: Replacement[];
  adoption?: { entityIds: string[]; source: Source };
};
```

`FoundationApplicability`, `Point`, `WallOpening`, `SlabOpening`, and `SlabThickening` reuse `measurementTypes.ts`. Add optional `EstimatingWorkspace.foundationAssemblies?: FoundationAssemblyRecord[]` (foundation only) and optional `ProjectDocument.foundationPresets?: FoundationPreset[]` (project-local). Child entities remain in `measurements` with existing source links and engine material strings. The parent binding index is the ownership authority. Several existing dependent groups have different `assemblyId` values from their source group, so do not overload that field as a parent foreign key. Existing foundation entities without a binding remain independently owned. Presets never carry plan geometry, slab extent, or datum values from another project. The preset template structurally excludes site datum, openings and manual coverage geometry. Validate those exclusions at import. Retain the confirmed snapshot in the parent even if the user later removes the editable preset.

## Controller input and output

```ts
type AssemblyIntent = Pick<FoundationAssemblyRecord, 'trace' | 'specifications' | 'preset' | 'overrides'>;
type ScopeResolution = {
  successorEntityId: string;
  predecessorEntityIds: string[];
  decision: FoundationApplicability;
  confirmation: Source;
};
type IdentityReplacementIntent = Pick<Replacement, 'retired' | 'successorIds'>;
type AssemblyChange =
  | { kind: 'create'; input: AssemblyIntent }
  | { kind: 'replaceIntent'; input: AssemblyIntent; identityReplacements?: IdentityReplacementIntent[]; scopeResolutions?: ScopeResolution[] }
  | { kind: 'adopt'; input: AssemblyIntent; bindings: ChildBinding[]; source: Source }
  | { kind: 'setComponentScope'; entityIds: string[]; decision: FoundationApplicability; confirmation: Source }
  | { kind: 'detach'; roles: ChildRole[]; source: Source };
type SpecificationGap = {
  system: keyof AssemblySpecifications;
  role?: ChildRole;
  path: string;
  reason: string;
  blocks: ('quantity' | 'materialSpecification')[];
};
type AssemblyConflict = { code: string; message: string; entityIds: string[] };
type AssemblyPreview = {
  source: ProjectDocument;
  workspaceId: string;
  assemblyId: string;
  baseRevisionId: string | null;
  changes: null | {
    parents: FoundationAssemblyRecord[];
    measurements: FoundationEntity[];
    retained: ChildBinding[];
    retired: ChildBinding[];
    created: ChildBinding[];
  };
  quantities: { before: QuantityContribution[]; after: QuantityContribution[] };
  unresolvedSpecifications: SpecificationGap[];
  conflicts: AssemblyConflict[];
};
```

`ProjectDocument`, `FoundationEntity` and `QuantityContribution` reuse the existing types. The controller proposes a new `revisionId` only for a changed candidate. The caller injects a UUID factory for deterministic tests. Manual route segments have their own stable IDs and reference stable vertex IDs. Disabled roles keep a dormant binding so re-enabling the same physical role can recover both IDs. A changed role instead records lineage. Detachment preserves the independent measurement but removes the parent binding and records the affected parent scope and provenance.

## Validation and transactions

- `projectDocument.ts` validates optional fields before accepting the document. Add `foundationAssemblyValidation.ts` for structural and cross-record checks and continue calling `validateSpecialistEntities` and `validateFoundationTopology`. Validate unique IDs and roles, finite signed datum/offset versus positive thickness or length, category eligibility, stable material catalogue IDs, confirmed nonblank reasons/sources, supported trace and reference topology, exact source segment order, and unique active bindings. Only foundation workspaces may carry parents. Reject disallowed properties and malformed references. Use the existing geometry tolerances.
- The confirmed specifications and original trace generate the expected roles, geometry, bindings and existing metadata through the current perimeter, strip, envelope, drainage, validation and quantity engines. For each owned member require a same-workspace entity with matching ID, physical ID, role, material, applicability, and source relationship. Reconcile by parent and role before handing off to quantity calculation. For grandfathered unbound measurements, existing validation and diagnostics continue unchanged. Reject mismatched or partial manifests, orphaned bindings, ambiguous child ownership, invalid historical adoption and lineage targeting a different assembly. Undo/redo restores the complete graph, including lineage.
- Introduce a pure `foundationAssemblyController.ts`. Proposed entry points are `previewAssemblyChange(document, workspaceId, assemblyId, revisionId, command)` and `applyAssemblyPreview(document, preview)`. The preview carries the exact immutable source document reference, workspace ID, existing assembly revision or null, proposed parent and measurement list, retained/retired/new roles, measurement deltas, diagnostics, and unresolved conflicts. The runtime token is deliberately transient. Persisted `revisionId` is a unique ID per accepted material change, so edits after undo cannot reuse a previous version number. Reject document/workspace/revision mismatch on Apply and validate again. Equivalent proposals return an empty diff and create no history or revision. One candidate constructs the full affected graph before any write.
- In `workspaceController.ts` add `replaceFoundationAssemblyState(doc, id, measurements, foundationAssemblies)` and include the optional parent array in `WorkspaceSnapshot`. Validate a single document replacement. In `App.tsx`, capture and restore both records together using one existing workspace history slot, clear redo on successful change, and use the live document identity guard. Preset catalogue edits are project configuration changes, outside assembly undo. Applying a preset writes only the approved confirmed snapshot and affected assembly records. Reapplication has the full preview/confirmation flow.
- When the same role and source segment survive, preserve entity and physical IDs. Changed topology requires a new role identity and explicit lineage for retired roles. Disabling affects only bound roles, preserves parent exclusion and reason and never deletes unowned records. Re-enable by reconciling roles against dormant bindings and requiring complete validation. Overrides persist until explicitly removed or invalidated, with conflict shown before Apply. Never turn pending scope into a zero quantity.
- Explicit adoption requires a preview mapping all participating historical or manual records to eligible roles, identity preservation where geometrically valid and confirmation of any removals. Unsupported or unresolved records remain independent. Manual edits to owned children route through the parent command or an explicit validated detachment. No background migration or auto-adoption.
- The existing document flows in `projectDocument.ts`, `workspaceController.ts`, `src/utils/storage.ts` and project directory use the same validator and byte budgets for serialize, save, import and reopen. Absence of either new optional array means existing v3 input. Preserve original bytes for offer-to-export or recovery when a record is invalid. Fail before replacing an open valid document. Measurements are recomputed. No cached authoritative totals or REST schema change proposed.

## Required regression work

- Document and persistence suites: old v3 equality, new guest and isolated WordPress round-trip, preset snapshots across version changes and deletion, explicit adoption, workspace isolation, malformed or cross-workspace bindings, corrupted parent/child specifications, invalid lineage, and preservation of raw recovery data.
- Foundation engine/controller: CA02/05/06/07/09 exact quantities, irregular original trace through edits, one measurable contribution per owned role, manual overlap conflict, independent-child protection, invalid geometry refusal, deterministic role retention, toggles and no-op idempotence, stale previews including undo branches, and retained override and pending/excluded provenance.
- Browser: preview/cancel modifies neither history nor saved records, one coordinated Apply, complete undo/redo, validation diagnostics, enable/disable/re-enable, unchanged legacy records, schema v3 export and reopen, and explicit preset reapply. Preserve existing mathematical and pricing-gate assertions.

## Clarified contracts

### 1. Project-local presets and reuse

Preset lookup and editing are project-local in R5.3. Use a globally generated stable preset ID and a strictly increasing positive integer version. Preset payloads include reusable specifications only. The optional origin pair records provenance and never creates a live dependency. A future explicit copy into another project can issue a new local preset ID and preserve the original ID/version as origin. Neither cross-project storage nor automatic synchronization is required by the schema. Validate that a referenced local version agrees with an embedded snapshot when both exist. An assembly remains valid solely from its confirmed snapshot if the local preset was removed.

### 2. Bounded identity retention

Proposed limits per assembly are **256 dormant child bindings, 512 retired identities, 2,048 successor references, 512 prior scope decisions and 2,048 scope provenance references**. Active identities do not consume the retired count. The whole candidate also passes the existing 4,000,000-character project and 850,000-character underlay guards and the existing storage transport limits. Check the projected snapshot during Preview and again before Apply. Imports use the same retention and referential checks. These are proposed explicit caps for review, with no age-based pruning.

Store compact IDs and bindings, plus scope audit records where required. Full pre-edit geometry belongs in the existing workspace undo/redo snapshots and user exports. Replacement edges point from a retired identity to active, dormant or later-retired identities of the same kind and assembly. Empty successors denote an explicitly confirmed terminal retirement. Retired identities cannot become active again. Dormant bindings may be restored to the same role, with the same entity and physical IDs. Reject cycles, missing or foreign successors, ID reuse and dangling scope or provenance references. Every scope record must refer to an active, dormant or retained child identity in the same assembly. A pure no-op adds no retention entries.

At a cap, reject changes that would grow the bounded state and preserve the last valid revision. Show the limit and offer an ordinary export of the intact project. Never trim, rewrite or evict histories silently. A future archival or fork workflow needs separate approval and must preserve the original project and its referential integrity.

### 3. Manual drainage identity

A manual route stores ordered vertices and directed segments with independent IDs. Validate adjacency, order, uniqueness, open/closed endpoint rules, finite coordinates, nonzero lengths and the existing drainage geometry constraints. A move preserves the existing vertex ID and incident segment IDs. Reordering, changing connectivity or reversing the direction of an edge requires an explicit replacement mapping for each changed directed segment. Split creates a new vertex and distinct successor segments. Merge retires the removed vertex and prior segments, and records the merged successor for each retired segment. Deleting an edge with no successor is explicit retirement. A still-identical directed edge keeps its segment ID and its child role uses that ID as `sourceId`. Retain unaffected child IDs and rerun existing route and overlap validation before Apply.

### 4. Material specification and measurable quantities

Material IDs identify catalogue or custom choices. Persist attributes in typed fields with their own confirmation and canonical units. Keep labels or custom descriptions independent from these fields. Drainage nominal diameter, pipe material and perforation are proposed attributes. Validate positive finite diameter, supported category, nonblank values and consistency with catalogue restrictions. For protection and under-slab materials, keep thickness as an independent specification field and allow a separately confirmed product reference. Do not infer attributes from labels, descriptions, geometry or a category name. The adapter preserves historical material strings and provides only genuine existing engine inputs, with no synthetic placeholder material.

A known, eligible route can still report length while its pipe diameter is unresolved. The same principle applies to independently eligible coverage area and its unresolved product details. Report known quantities with explicit specification gaps. If a missing attribute actually gates a contribution under existing rules, that contribution remains unquantified.

### 5. Child scope and historical decisions

During adoption, copy each explicit child decision and its reason into `componentScope` verbatim. Record absence as `legacyAbsent` and leave the entity's existing field absent where the effective status has not changed. Store retained decisions even when a child is dormant or retired. For surviving roles, carry the scoped decision forward with its child IDs. Parent and child decisions are separate. Apply effective precedence **excluded → pending → included/legacy**: an included parent cannot reinstate an excluded or pending child. Parent suspension uses its existing effective gate and preserves the child decision. A scope change requires a separate confirmed command and an audit link to the earlier decision and reason. Persist an additional prior decision record per such change, keyed by entity and revision, subject to the same retention guard. Child-linked dependants must satisfy the current topology rules. An excluded source requires an excluded or absent dependent, and a pending source permits a pending or excluded dependent. A conflict blocks Apply or requires explicit compatible source/child decisions in the same transaction. Do not discard an existing independent contribution to satisfy a conflict automatically.

For a split, propagate each predecessor's explicit decision and verbatim reason to all corresponding successors and link their provenance. For a merge or ambiguous mapping, require explicit preview resolution when predecessor decisions differ or extent mappings are unclear. Preserve every predecessor decision and reason even when a resolution supersedes it. An excluded predecessor's successor may become included only through explicit, successor-specific scope resolution. No successor defaults to included solely because the parent is included.

### 6. Applicability and completeness

Inclusion stores a potentially empty field-level specification. Omitted fields are unresolved. Pending and excluded scope each have a reason and retain previously confirmed answers for review. Store unresolved field definitions in controller rules, and recompute the gaps when reading or previewing. Completeness is derived per role and quantity, with separate `quantity` and `materialSpecification` blockers. It is neither a persisted total nor a surrogate scope flag.

Build only entities whose actual inputs satisfy existing geometry, source and topology contracts. Report missing inputs for roles without eligible entities outside the quantitative ledger, without manufacturing geometry or zero quantities. Keep independently valid, engine-measured rows and their provenance. Never convert an engine diagnostic into a measured quantity. A pending child remains governed by existing pending-scope overlap behavior. Removing a required input from an existing role previews its resulting quantity and identity transition for confirmation.

## Additional acceptance tests

| Clarification | Required coverage |
|---|---|
| 1 | Reopen a project-local version and a confirmed snapshot after editing or removing its preset. Validate a copied template with a new ID and explicit origin, without cross-project lookup. |
| 2 | Test each retention cap and overall budget on both Preview and Apply. Reject a cycle, dangling or cross-assembly reference, and attempted ID reuse. Verify valid dormant IDs survive save/reopen and undo/redo. Verify refused edits preserve the prior state and complete export. |
| 3 | Move a manual vertex, split a segment, merge adjacent segments, reverse a directed edge and remove a segment. Compare vertex, edge and child IDs, lineage, and unchanged independent roles across reopen. |
| 4 | A known route with no diameter retains its engine LF and an unresolved diameter. Confirm an explicit diameter and change the label without changing length or attribute value. Reject invalid diameter or incompatible attributes. Test eligible area separately from unresolved material details. |
| 5 | Adopt an assembly with included, pending, excluded and absent child decisions. Assert verbatim exclusion reasons across reopen, regeneration, toggles and split. Require explicit resolution for conflicting merge decisions. Verify excluded children remain noncontributing and source dependencies remain valid. |
| 6 | Included-empty, included-incomplete, pending and excluded systems produce distinct status and diagnostics. Retain independently valid known quantities, reject missing geometry where required, and verify no placeholder or zero result is inserted. |

## R5.6A bounded persistence amendment

Foundation parents accept optional `detachments` and `traceCorrections` arrays in v3. Missing arrays mean no audit entries. The child ledger remains the measurement authority.

- Each detachment entry stores `former: ChildBinding`, `revisionId`, the independently confirmed `reason` and `source`, and a role disposition of `released` or `readopted`. The latter requires a readoption revision. An audit entry is historical data and reserves no entity or physical ID as current ownership. Previously active or dormant scope remains in the historical scope register. Independent edits or deletion do not break the audit reference. Existing dormant and retired identity validation remains in force.
- A successful Detach releases a complete active system or exterior layer. It preserves the same live measurement, geometry, physical ID, material, quantity and scope. Existing derivation links are removed only from the released measurements. The controller rejects an external dependent source reference, an incomplete group, a changed quantitative ledger or an unsupported dependency transition before Apply. Released groups are suppressed during regeneration even if their parent specification remains included. Explicit validated re-adoption is required for the whole released role group. Adoption reads current child scope and preserves prior recorded child decisions.
- A separate confirmed Correct Trace command records the previous trace, previous and current revision IDs, source and explicit retired-to-successor segment relationships. A corner move preserves the compatible vertex and segment identities, and moves the adjoining orthogonal edges. The bounded orthogonal inset or projection creates new vertex and segment IDs for the replacement path. Child roles follow each segment and inherit predecessor scope. Conflicting, dormant or released role mappings and unsupported geometry require resolution. Construction specification changes cannot replace the saved trace.
- Audit caps are 256 detachment entries and 64 trace-correction entries per assembly. Existing ownership, lineage, character and transport limits remain. Reject a change beyond any limit with the previous committed revision intact. Preview, Apply, undo/redo and serialization treat the parent and children as one workspace transaction.

## R5.6B additive v3 contract

```ts
type ElevationReference =
  | { kind: 'assembly'; id: string }
  | { kind: 'project' }
  | { kind: 'unresolved' }
  | { kind: 'historical' };

type WallDatum = {
  basis: 'base' | 'top';
  elevationFt: number;
  reference?: ElevationReference;
};

// Optional fields on existing records:
// SlabSpec.bottomRelationship?: 'atWallBase'
// SlabSpec.elevationReference?: ElevationReference
// FoundationMetadata.elevationReference?: ElevationReference
// AssemblySpecifications.exteriorSequence?: ExteriorSequence
// PresetSystems.exteriorSequence?: ExteriorSequence
type ExteriorSequence =
  | { status: 'confirmed'; confirmation: Confirmation }
  | { status: 'unresolved' };
```

An absent elevation marker or explicit historical marker preserves the legacy comparison path with other historical measurements. A local reference uses the creating assembly ID as an opaque coordinate frame, including after detachment. Only identical local frames and shared project frames are comparable. Incomparable frames require reconciliation when same-material geometry can overlap in plan. Independently valid quantities stay measurable. The existing elevation numbers and confirmations continue to govern dimensions.

Exterior order is the existing array order from the wall outward. The absent field represents historical records. A newly changed or unconfirmed order persists an unresolved marker. Reordering invalidates confirmation until the contractor confirms the new order. Presets snapshot the confirmed order. The order leaves coverage and the approved measurement face unchanged.

Targeted cases include exact contact within a frame, different local frames with and without plan intersection, historical overlap behavior, retention through detachment and re-adoption, and reversed exterior sequences with unchanged coverage, quantities and stable layer IDs.

Recognized catalogue choices can populate unambiguous drainage attributes with field-level provenance. Preserve explicit diameter and other unresolved attributes. Arbitrary labels remain descriptive.

## R5.6C standalone slab and estimating coverage

`AssemblyTrace.kind` adds `'slab'` with `reference: 'interior'` and the existing ordered, closed trace vertices and segments. It validates the trace using the existing simple-polygon contract. Standalone slab assemblies permit the existing slab, under-slab insulation and granular roles. Their independent slab extent must equal the trace. Conventional standalone slabs use the same local elevation reference mechanism and an explicitly confirmed zero at slab bottom.

`SlabSpec.coverageBasis?: 'fullFootprintEstimate'` is a confirmed specification field. Generated layers use the existing optional source note and their quantity basis discloses the estimate. Historical records without the field retain their previous quantity presentation. The field leaves geometry, volume calculations, overlap reconciliation and project storage caps intact.

## R5.7 assembly lifecycle transactions

The internal `AssemblyChange` union adds `{kind: 'delete'}`. Preview resolves the current parent revision, plans removal of its active owned measurements, and refuses external dependents. The candidate graph runs through ordinary project validation. Apply requires the exact preview and commits the parent and owned removals as one history entry. The removed parent contains its own dormant bindings, archived trace revisions and lineage. Undo restores the complete parent with its owned geometry. Detached independent measurements and unrelated records remain in the committed project.

Standalone slab footprint correction uses the existing trace correction command and audit. The trace kind and ordered edges remain stable. The command updates the independent slab extent with correction provenance and regenerates applicable dependent layers. No new serialized fields or schema version are required.
