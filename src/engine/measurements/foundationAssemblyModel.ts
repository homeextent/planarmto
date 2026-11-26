import type { ProjectDocument } from '../projectDocument';
import type {
  ElevationReference, FoundationApplicability, FoundationEntity, Point, QuantityContribution, SlabOpening, SlabThickening, WallOpening,
} from './measurementTypes';

export type MaterialCategory = 'concrete' | 'insulation' | 'waterproofing' | 'drainage' | 'granular';
export type MaterialChoice =
  | { kind: 'catalogue'; category: MaterialCategory; id: string }
  | { kind: 'custom'; category: Exclude<MaterialCategory, 'concrete'>; id: string; description: string };
export type Source = { kind: 'plan' | 'estimatingAssumption' | 'manualOverride'; reference: string };
export type Confirmation =
  | Source
  | { kind: 'presetSnapshot'; presetId: string; version: number; reference: string };
export type Confirmed<T> = { value: T; confirmation: Confirmation };
export type DraftSpecification<T> = { [K in keyof T]?: Confirmed<NonNullable<T[K]>> };
export type Scope<T> =
  | { status: 'pending' | 'excluded'; reason: string; retainedSpecification?: DraftSpecification<T> }
  | { status: 'included'; specification: DraftSpecification<T> };
export type TraceSegment = { id: string; startVertexId: string; endVertexId: string };
export type AssemblyTrace = {
  kind: 'rectangle' | 'orthogonal' | 'slab';
  reference: 'exterior' | 'centreline' | 'interior';
  vertices: { id: string; point: Point }[];
  segments: TraceSegment[];
  source: Source;
};
export type WallSpec = {
  material: MaterialChoice;
  widthFt: number;
  heightFt: number;
  datum: { basis: 'base' | 'top'; elevationFt: number; reference?: ElevationReference };
  openings: { sourceSegmentId: string; opening: WallOpening }[];
};
export type FootingSpec = {
  material: MaterialChoice; widthFt: number; depthFt: number;
  alignment: { kind: 'centred' } | { kind: 'explicitOffset'; offsetFt: number };
  top: { kind: 'wallBase' } | { kind: 'explicit'; elevationFt: number };
};
export type LayerSpec = {
  id: string; material: MaterialChoice;
  coverage:
    | { kind: 'specifiedHeight'; heightFt: number }
    | { kind: 'confirmedFullHeight' }
    | { kind: 'manualNetSegments'; segments: { id: string; start: Point; end: Point; heightFt: number }[] };
  thicknessFt?: number;
  attributes?: { productReference?: Confirmed<string> };
};
export type PipeAttributes = {
  nominalDiameterFt?: Confirmed<number>;
  pipeMaterial?: Confirmed<string>;
  perforation?: Confirmed<'perforated' | 'solid'>;
};
export type ManualDrainageRoute = {
  kind: 'manual';
  closed: boolean;
  vertices: { id: string; point: Point }[];
  segments: TraceSegment[];
};
export type DrainageSpec = {
  material: MaterialChoice;
  attributes?: PipeAttributes;
  route:
    | { kind: 'footingEdgeOffset'; offsetFt: number }
    | { kind: 'wallFaceOffset'; offsetFt: number }
    | ManualDrainageRoute;
};
export type SlabSpec = {
  material: MaterialChoice;
  extent: { kind: 'confirmedInterior' } | { kind: 'independent'; points: Point[] };
  thicknessFt: number; baseFt: number;
  footingRelation: Confirmation;
  bottomRelationship?: 'atWallBase';
  coverageBasis?: 'fullFootprintEstimate';
  elevationReference?: ElevationReference;
  openings: SlabOpening[]; thickenings: SlabThickening[];
};
export type UnderSlabLayer = {
  id: string; material: MaterialChoice; thicknessFt: number;
  attributes?: { productReference?: Confirmed<string> };
};
export type ExteriorSequence = {status:'confirmed';confirmation:Confirmation}|{status:'unresolved'};
export type AssemblySpecifications = {
  walls: Scope<WallSpec>;
  footing: Scope<FootingSpec>;
  exteriorSequence?: ExteriorSequence;
  exteriorLayers: { id: string; scope: Scope<LayerSpec> }[];
  drainage: Scope<DrainageSpec>;
  slab: Scope<SlabSpec>;
  insulation: Scope<UnderSlabLayer>;
  granular: Scope<UnderSlabLayer>;
};
export type PresetLayer = Omit<LayerSpec, 'coverage'> & {
  coverage: Exclude<LayerSpec['coverage'], { kind: 'manualNetSegments' }>;
};
export type PresetSystems = {
  walls: Scope<Pick<WallSpec, 'material' | 'widthFt' | 'heightFt'>>;
  footing: Scope<Omit<FootingSpec, 'top'> & { top: { kind: 'wallBase' } }>;
  exteriorSequence?: ExteriorSequence;
  exteriorLayers: { id: string; scope: Scope<PresetLayer> }[];
  drainage: Scope<Omit<DrainageSpec, 'route'> & {
    route: Exclude<DrainageSpec['route'], { kind: 'manual' }>;
  }>;
  insulation: Scope<UnderSlabLayer>;
  granular: Scope<UnderSlabLayer>;
};
export type PresetVersion = { version: number; name: string; systems: PresetSystems };
export type PresetOrigin = { presetId: string; version: number };
export type FoundationPreset = { version: 1; id: string; origin?: PresetOrigin; versions: PresetVersion[] };
export type PresetSnapshot = { presetId: string; version: PresetVersion; confirmation: Source };
export type ChildRole =
  | { system: 'wall' | 'footing' | 'drainage'; sourceId: string }
  | { system: 'exterior'; sourceId: string; layerId: string }
  | { system: 'slab' }
  | { system: 'insulation' | 'granular'; layerId: string };
export type ChildBinding = { role: ChildRole; entityId: string; physicalId: string };
export type ComponentScopeDecision = FoundationApplicability | { status: 'legacyAbsent' };
export type ScopeSource = Source | { kind: 'historicalRecord'; entityId: string };
export type ComponentScopeRecord = {
  entityId: string;
  decision: ComponentScopeDecision;
  source: ScopeSource;
  inheritedFromEntityIds: string[];
};
export type PriorScopeDecision = {
  revisionId: string;
  previous: ComponentScopeRecord;
};
export type RetainedIdentity =
  | { kind: 'child'; binding: ChildBinding }
  | { kind: 'routeVertex' | 'routeSegment'; id: string };
export type Replacement = { retired: RetainedIdentity; successorIds: string[]; revisionId: string };
export type DormantBinding = { child: ChildBinding; disabledAtRevisionId: string };
export type AssemblyOverride =
  | { system: 'walls'; sourceSegmentId: string; patch: Partial<Pick<WallSpec, 'material' | 'widthFt' | 'heightFt' | 'datum'>>; source: Source }
  | { system: 'exterior'; layerId: string; coverage: LayerSpec['coverage']; source: Source }
  | { system: 'footing'; alignment: FootingSpec['alignment']; source: Source }
  | { system: 'drainage'; route: DrainageSpec['route']; source: Source };
export type DetachmentAudit = {
  former: ChildBinding;
  revisionId: string;
  reason: string;
  source: Source;
  disposition: 'released' | 'readopted';
  readoptedAtRevisionId?: string;
};
export type TraceCorrectionAudit = {
  previousRevisionId: string;
  revisionId: string;
  previousTrace: AssemblyTrace;
  source: Source;
  segments: { retiredId: string; successorIds: string[] }[];
};
export type FoundationAssemblyRecord = {
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
  detachments?: DetachmentAudit[];
  traceCorrections?: TraceCorrectionAudit[];
  adoption?: { entityIds: string[]; source: Source };
};

export type AssemblyIntent = Pick<FoundationAssemblyRecord, 'trace' | 'specifications' | 'preset' | 'overrides'>;
export type ScopeResolution = {
  successorEntityId: string;
  predecessorEntityIds: string[];
  decision: FoundationApplicability;
  confirmation: Source;
};
export type IdentityReplacementIntent = Pick<Replacement, 'retired' | 'successorIds'>;
export type AssemblyChange =
  | { kind: 'create'; input: AssemblyIntent }
  | { kind: 'replaceIntent'; input: AssemblyIntent; adoption?: { bindings: ChildBinding[]; source: Source }; identityReplacements?: IdentityReplacementIntent[]; scopeResolutions?: ScopeResolution[] }
  | { kind: 'adopt'; input: AssemblyIntent; bindings: ChildBinding[]; source: Source }
  | { kind: 'setComponentScope'; entityIds: string[]; decision: FoundationApplicability; confirmation: Source }
  | { kind: 'detach'; roles: ChildRole[]; reason: string; source: Source }
  | { kind: 'correctTrace'; trace: AssemblyTrace; segments: TraceCorrectionAudit['segments']; source: Source };
export type SpecificationGap = {
  system: keyof AssemblySpecifications;
  role?: ChildRole;
  path: string;
  reason: string;
  blocks: ('quantity' | 'materialSpecification')[];
};
export type AssemblyConflict = { code: string; message: string; entityIds: string[] };
export type AssemblyPreview = {
  source: ProjectDocument;
  workspaceId: string;
  assemblyId: string;
  baseRevisionId: string | null;
  changes: null | {
    parents: FoundationAssemblyRecord[];
    measurements: FoundationEntity[];
    retained: ChildBinding[];
    retired: ChildBinding[];
    detached: ChildBinding[];
    created: ChildBinding[];
  };
  quantities: { before: QuantityContribution[]; after: QuantityContribution[] };
  unresolvedSpecifications: SpecificationGap[];
  conflicts: AssemblyConflict[];
};
