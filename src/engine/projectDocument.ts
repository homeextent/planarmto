import type { FloorplanState, ProjectSettings } from '../types';

/** Canonical persisted model; the existing CAD engine remains a level adapter. */
export type WorkspaceType = 'floor' | 'roof' | 'foundation' | 'site';
export type WorkspaceGeometry = Omit<FloorplanState, 'activeProjectId' | 'activeProjectName' | 'settings'>;
export type ScopeKind = 'roof' | 'foundation' | 'site';
export type ScopeAssignment =
  | { status: 'unquantified' | 'excluded' }
  | { status: 'measured'; workspaceIds: string[] };
export interface EstimatingWorkspace {
  id: string;
  name: string;
  type: WorkspaceType;
  geometry: WorkspaceGeometry;
}
export interface ProjectDocument {
  schemaVersion: 2;
  activeProjectId: string | null;
  activeProjectName: string;
  settings: ProjectSettings;
  activeWorkspaceId: string;
  workspaces: EstimatingWorkspace[];
  scope:
    | { mode: 'legacy'; workspaceId: string }
    | { mode: 'explicit'; assignments: Record<ScopeKind, ScopeAssignment> };
}

const geometryKeys = ['nodes', 'walls', 'apertures', 'stamps', 'rooms', 'decks', 'hardscapes'] as const;
const workspaceTypes = ['floor', 'roof', 'foundation', 'site'] as const;
const scopeKinds = ['roof', 'foundation', 'site'] as const;
const record = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const nonempty = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
function requireValue(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error('Invalid project: ' + message);
}
function clone<T>(value: T): T { return structuredClone(value); }

function validateSettings(value: unknown): asserts value is ProjectSettings {
  requireValue(record(value), 'settings missing');
  const enums = {
    unitSystem: ['imperial', 'metric'], theme: ['dark', 'light', 'blueprint'],
    calculationMode: ['interior_finish', 'exterior_framing'],
    wallJustification: ['interior_face', 'centerline', 'exterior_face'],
  };
  for (const [key, values] of Object.entries(enums))
    requireValue(values.includes(value[key] as string), 'invalid setting ' + key);
  for (const key of ['defaultWallHeight','defaultCeilingHeight','defaultWallThickness','slabThicknessInches',
    'roofPitchScale','roofOverhangInches','gridSnapSize','angleSnapIncrement','wasteFactorPercentage',
    'overheadPercentage','profitPercentage','projectContingencyPercentage','projectManagementPercentage'])
    requireValue(finite(value[key]), 'invalid setting ' + key);
  requireValue(value.studSpacingInches === 16 || value.studSpacingInches === 24, 'invalid stud spacing');
  for (const key of ['orthoMode','showDimensions','showRoomLabels','showMepIcons'])
    requireValue(typeof value[key] === 'boolean', 'invalid setting ' + key);
  for (const key of ['costRates','companyBranding','categoryInclusions','itemInclusions'])
    requireValue(value[key] === undefined || record(value[key]), 'invalid setting ' + key);
}
function validateIdentity(value: Record<string, unknown>) {
  requireValue(value.activeProjectId === null || nonempty(value.activeProjectId), 'invalid project ID');
  requireValue(nonempty(value.activeProjectName), 'invalid project name');
  validateSettings(value.settings);
}
/** Structural boundary validation, not a CAD geometry repair or engineering validator. */
function validateGeometry(value: unknown): asserts value is WorkspaceGeometry {
  requireValue(record(value), 'geometry missing');
  for (const key of [...geometryKeys, 'annotations'] as const) {
    const list = value[key];
    if (key === 'annotations' && list === undefined) continue;
    requireValue(Array.isArray(list), 'missing geometry array ' + key);
    const ids = new Set<string>();
    for (const item of list) {
      requireValue(record(item) && nonempty(item.id), 'invalid entity in ' + key);
      requireValue(!ids.has(item.id), 'duplicate entity ID in ' + key);
      ids.add(item.id);
    }
  }
  const nodes = value.nodes as FloorplanState['nodes'];
  for (const n of nodes) requireValue(finite(n.x) && finite(n.y), 'invalid node coordinates');
  const nodeIds = new Set(nodes.map(n => n.id));
  const walls = value.walls as FloorplanState['walls'];
  for (const w of walls) requireValue(nodeIds.has(w.startNodeId) && nodeIds.has(w.endNodeId)
    && finite(w.height) && finite(w.thickness), 'invalid wall references or dimensions');
  const wallIds = new Set(walls.map(w => w.id));
  for (const a of value.apertures as FloorplanState['apertures'])
    requireValue(wallIds.has(a.wallId) && finite(a.offset) && finite(a.width) && finite(a.height), 'invalid aperture');
  for (const r of value.rooms as FloorplanState['rooms'])
    requireValue(Array.isArray(r.nodeIds) && r.nodeIds.every(id => nodeIds.has(id))
      && Array.isArray(r.wallIds) && r.wallIds.every(id => wallIds.has(id))
      && Array.isArray(r.points) && r.points.every(p => record(p) && finite(p.x) && finite(p.y))
      && finite(r.area) && finite(r.perimeter), 'invalid room geometry');
  if (value.underlay !== undefined) {
    const u = value.underlay;
    requireValue(record(u) && (nonempty(u.src) || nonempty(u.url))
      && finite(u.worldX) && finite(u.worldY) && finite(u.feetPerPixel) && u.feetPerPixel > 0
      && finite(u.opacity) && u.opacity >= 0 && u.opacity <= 1
      && typeof u.isVisible === 'boolean' && typeof u.isLocked === 'boolean', 'invalid blueprint');
    if (u.pdfSource !== undefined) {
      const p = u.pdfSource;
      requireValue(record(p) && nonempty(p.filename) && finite(p.page) && Number.isInteger(p.page) && p.page > 0
        && finite(p.width) && p.width > 0 && finite(p.height) && p.height > 0, 'invalid PDF source');
    }
  }
}
function validateDocument(value: unknown): asserts value is ProjectDocument {
  requireValue(record(value) && value.schemaVersion === 2, 'unsupported schema version');
  validateIdentity(value);
  requireValue(Array.isArray(value.workspaces) && value.workspaces.length > 0, 'at least one workspace required');
  const ids = new Map<string, WorkspaceType>();
  for (const w of value.workspaces) {
    requireValue(record(w) && nonempty(w.id) && nonempty(w.name)
      && workspaceTypes.includes(w.type as WorkspaceType), 'invalid workspace');
    requireValue(!ids.has(w.id), 'duplicate workspace ID');
    ids.set(w.id, w.type as WorkspaceType);
    validateGeometry(w.geometry);
    requireValue(!('settings' in w.geometry) && !('activeProjectId' in w.geometry)
      && !('activeProjectName' in w.geometry), 'workspace contains project-owned fields');
  }
  requireValue(nonempty(value.activeWorkspaceId) && ids.has(value.activeWorkspaceId), 'invalid active workspace');
  const scope = value.scope;
  requireValue(record(scope), 'scope policy missing');
  if (scope.mode === 'legacy') {
    requireValue(nonempty(scope.workspaceId) && ids.get(scope.workspaceId) === 'floor', 'invalid legacy owner');
  } else {
    requireValue(scope.mode === 'explicit' && record(scope.assignments), 'invalid scope policy');
    for (const kind of scopeKinds) {
      const a = scope.assignments[kind];
      requireValue(record(a), 'missing scope assignment ' + kind);
      if (a.status === 'measured') {
        requireValue(Array.isArray(a.workspaceIds) && a.workspaceIds.length > 0
          && new Set(a.workspaceIds).size === a.workspaceIds.length
          && a.workspaceIds.every(id => typeof id === 'string' && ids.get(id) === kind), 'invalid measured scope owner ' + kind);
      } else {
        requireValue((a.status === 'unquantified' || a.status === 'excluded')
          && !('workspaceIds' in a), 'invalid scope status ' + kind);
      }
    }
  }
}
function geometryOf(state: FloorplanState): WorkspaceGeometry {
  const { activeProjectId, activeProjectName, settings, ...geometry } = state;
  return clone(geometry);
}
/** Pure in-memory migration. Never writes storage or guesses the original level name. */
export function readProjectDocument(value: unknown): ProjectDocument {
  requireValue(record(value), 'expected object');
  if ('schemaVersion' in value) {
    validateDocument(value);
    return clone(value);
  }
  validateIdentity(value);
  validateGeometry(value);
  const legacy = value as unknown as FloorplanState;
  const document: ProjectDocument = {
    schemaVersion: 2, activeProjectId: legacy.activeProjectId,
    activeProjectName: legacy.activeProjectName, settings: clone(legacy.settings),
    activeWorkspaceId: 'legacy-level-1',
    workspaces: [{ id: 'legacy-level-1', name: 'Level 1', type: 'floor', geometry: geometryOf(legacy) }],
    scope: { mode: 'legacy', workspaceId: 'legacy-level-1' },
  };
  validateDocument(document);
  return document;
}
/** New projects use explicit scope, with no implied measured quantities. */
export function createProjectDocument(blank: FloorplanState, workspaceId: string): ProjectDocument {
  validateGeometry(blank);
  requireValue(geometryKeys.every(key => blank[key].length === 0)
    && !(blank.annotations?.length) && !blank.underlay, 'new project must be blank');
  const document: ProjectDocument = {
    schemaVersion: 2, activeProjectId: blank.activeProjectId, activeProjectName: blank.activeProjectName,
    settings: clone(blank.settings), activeWorkspaceId: workspaceId,
    workspaces: [{ id: workspaceId, name: 'Level 1', type: 'floor', geometry: geometryOf(blank) }],
    scope: { mode: 'explicit', assignments: {
      roof: { status: 'unquantified' }, foundation: { status: 'unquantified' }, site: { status: 'unquantified' },
    } },
  };
  validateDocument(document);
  return document;
}
/** Detached compatibility view, not a second authoritative state. */
export function workspaceFloorplan(document: ProjectDocument, workspaceId = document.activeWorkspaceId): FloorplanState {
  const w = document.workspaces.find(w => w.id === workspaceId);
  requireValue(w, 'workspace not found');
  return { ...clone(w.geometry), activeProjectId: document.activeProjectId,
    activeProjectName: document.activeProjectName, settings: clone(document.settings) };
}
/** Explicit workspace target prevents accidentally committing an edit to the selected level. */
export function replaceWorkspaceGeometry(document: ProjectDocument, workspaceId: string, state: FloorplanState): ProjectDocument {
  requireValue(document.workspaces.some(w => w.id === workspaceId), 'workspace not found');
  requireValue(state.activeProjectId === document.activeProjectId && state.activeProjectName === document.activeProjectName,
    'workspace edit belongs to a different project');
  const next = { ...document, workspaces: document.workspaces.map(w =>
    w.id === workspaceId ? { ...w, geometry: geometryOf(state) } : w) };
  validateDocument(next);
  return next;
}
export function serializeProjectDocument(document: ProjectDocument): string {
  validateDocument(document);
  return JSON.stringify(document);
}
export function deserializeProjectDocument(json: string): ProjectDocument {
  return readProjectDocument(JSON.parse(json));
}

/** Internal React adapter. CAD callers must treat collections as immutable, just as in the
 * original single-canvas state. Detached public adapter remains available for external callers. */
export function workspaceRenderView(document: ProjectDocument): FloorplanState {
  const w = document.workspaces.find(w => w.id === document.activeWorkspaceId);
  requireValue(w, 'workspace not found');
  return { ...w.geometry, activeProjectId: document.activeProjectId,
    activeProjectName: document.activeProjectName, settings: document.settings };
}

/** Trusted immutable CAD updates: retain references for untouched collections and workspaces.
 * Full structural validation remains mandatory at import, committed edit and storage boundaries. */
export function commitWorkspaceRenderView(document: ProjectDocument, workspaceId: string,
    state: FloorplanState, validate = true): ProjectDocument {
  requireValue(document.activeWorkspaceId === workspaceId, 'inactive workspace edit');
  requireValue(state.activeProjectId === document.activeProjectId && state.activeProjectName === document.activeProjectName,
    'workspace edit belongs to a different project');
  const { activeProjectId, activeProjectName, settings, ...geometry } = state;
  if (validate) { validateGeometry(geometry); validateSettings(settings); }
  return { ...document, settings, workspaces: document.workspaces.map(w =>
    w.id === workspaceId ? { ...w, geometry } : w) };
}
