# C.1C R5.3 persistence and assembly-controller proposal

Design for independent review. The coordinated specification authorizes this proposal. Implementation starts only after approval of this contract. Schema version stays 3.

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
type Scope<T> =
  | { status: 'pending'; reason: string }
  | { status: 'excluded'; reason: string }
  | { status: 'included'; specification: Confirmed<T> };
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
};
type DrainageSpec = {
  material: MaterialChoice;
  diameterFt?: number;
  route:
    | { kind: 'footingEdgeOffset'; offsetFt: number }
    | { kind: 'wallFaceOffset'; offsetFt: number }
    | { kind: 'manual'; vertices: { id: string; point: Point }[] };
};
type SlabSpec = {
  material: MaterialChoice;
  extent: { kind: 'confirmedInterior' } | { kind: 'independent'; points: Point[] };
  thicknessFt: number; baseFt: number;
  footingRelation: Confirmation;
  openings: SlabOpening[]; thickenings: SlabThickening[];
};
type UnderSlabLayer = { id: string; material: MaterialChoice; thicknessFt: number };
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
type FoundationPreset = { version: 1; id: string; versions: PresetVersion[] };
type PresetSnapshot = { presetId: string; version: PresetVersion; confirmation: Source };
type ChildRole =
  | { system: 'wall' | 'footing' | 'drainage'; sourceId: string }
  | { system: 'exterior'; sourceId: string; layerId: string }
  | { system: 'slab' }
  | { system: 'insulation' | 'granular'; layerId: string };
type ChildBinding = { role: ChildRole; entityId: string; physicalId: string };
type Replacement = { retired: ChildBinding; successorEntityIds: string[]; revisionId: string };
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
  replacements: Replacement[];
  adoption?: { entityIds: string[]; source: Source };
};
```

`Point`, `WallOpening`, `SlabOpening`, and `SlabThickening` reuse `measurementTypes.ts`. Add optional `EstimatingWorkspace.foundationAssemblies?: FoundationAssemblyRecord[]` (foundation only) and optional `ProjectDocument.foundationPresets?: FoundationPreset[]` (project-local). Child entities remain in `measurements` with existing source links and engine material strings. The parent binding index is the ownership authority. Several existing dependent groups have different `assemblyId` values from their source group, so do not overload that field as a parent foreign key. Existing foundation entities without a binding remain independently owned. Presets never carry plan geometry, slab extent, or datum values from another project. The preset template structurally excludes site datum, openings and manual coverage geometry. Validate those exclusions at import. Retain the confirmed snapshot in the parent even if the user later removes the editable preset.

## Controller input and output

```ts
type AssemblyIntent = Pick<FoundationAssemblyRecord, 'trace' | 'specifications' | 'preset' | 'overrides'>;
type AssemblyChange =
  | { kind: 'create'; input: AssemblyIntent }
  | { kind: 'replaceIntent'; input: AssemblyIntent }
  | { kind: 'adopt'; input: AssemblyIntent; bindings: ChildBinding[]; source: Source }
  | { kind: 'detach'; roles: ChildRole[]; source: Source };
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
  conflicts: AssemblyConflict[];
};
```

`ProjectDocument`, `FoundationEntity` and `QuantityContribution` reuse the existing types. The controller proposes a new `revisionId` only for a changed candidate. The caller injects a UUID factory for deterministic tests. Manual route edge identity is keyed from its stable endpoint IDs. Disabled roles keep a dormant binding so re-enabling the same physical role can recover both IDs. A changed role instead records lineage. Detachment preserves the independent measurement but removes the parent binding and records the affected parent scope and provenance.

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

## Independent design decisions

Confirm project-local presets and project configuration history behavior, the compact lineage representation and retention limit under the project byte budget, and route/source-role identity when manual edges are replaced. Decide if measurement categories suffice for all custom insulation and drainage attributes. Multiple material layers require separate confirmed coverage, identity and contributions. Review how child applicability and parent scope reconcile when an imported or historical group has explicit per-component exclusions. Continue to refuse geometry and dependencies outside the current engine contract until a reviewed extension exists.
