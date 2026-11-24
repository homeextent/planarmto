import type { FloorplanState } from '../types';
import { createBlankProject, DEFAULT_SETTINGS } from './samplePlans';
import { readProjectDocument, workspaceFloorplan, replaceWorkspaceGeometry, serializeProjectDocument } from './projectDocument';
import type { ProjectDocument, WorkspaceType } from './projectDocument';

export const PROJECT_CHARACTER_BUDGET = 4_000_000;
export const UNDERLAY_CHARACTER_BUDGET = 850_000;
export const canReportLegacyEstimate = (doc: ProjectDocument) =>
  doc.scope.mode === 'legacy' && doc.workspaces.length === 1 && doc.workspaces[0].type === 'floor';

export function normalizeProjectInput(input: unknown): ProjectDocument {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid project document.');
  const raw = structuredClone(input) as any;
  if ('schemaVersion' in raw) return readProjectDocument(raw);
  // Legacy defaults only for absent fields; never replace present invalid geometry.
  if (raw.settings !== undefined && (!raw.settings || typeof raw.settings !== 'object' || Array.isArray(raw.settings))) throw new Error('Invalid legacy settings.');
  raw.settings = { ...DEFAULT_SETTINGS, ...raw.settings };
  if (raw.activeProjectId === undefined) raw.activeProjectId = null;
  if (raw.activeProjectName === undefined) raw.activeProjectName = 'Imported Project';
  for (const key of ['stamps','decks','hardscapes']) if (raw[key] === undefined) raw[key] = [];
  const u = raw.underlay;
  if (u && typeof u === 'object') {
    u.src = u.src || u.url || u.blueprintUrl;
    u.worldX ??= u.x ?? 0; u.worldY ??= u.y ?? 0;
    u.feetPerPixel ??= u.scaleFactor ?? (u.scale > 0 ? 1 / u.scale : .05);
    u.opacity ??= .5; u.isVisible ??= true; u.isLocked ??= false;
    if (u.url === u.src) delete u.url;
  }
  return readProjectDocument(raw);
}

export function updateWorkspaceView(doc: ProjectDocument, id: string, next: FloorplanState): ProjectDocument {
  const updated = replaceWorkspaceGeometry(doc, id, next);
  return readProjectDocument({ ...updated, settings: structuredClone(next.settings) });
}
export function selectWorkspace(doc: ProjectDocument, id: string): ProjectDocument {
  if (!doc.workspaces.some(w => w.id === id)) throw new Error('Unknown workspace.');
  return doc.activeWorkspaceId === id ? doc : { ...doc, activeWorkspaceId: id };
}
export function addWorkspace(doc: ProjectDocument, id: string, name: string, type: WorkspaceType): ProjectDocument {
  if (doc.workspaces.some(w => w.id === id)) throw new Error('Duplicate workspace ID.');
  const { activeProjectId, activeProjectName, settings, ...geometry } = createBlankProject();
  const next: ProjectDocument = { ...doc, activeWorkspaceId: id, workspaces: [...doc.workspaces, { id, name: name.trim(), type, geometry }] };
  // Adding a workspace does not silently discard legacy ownership; C.1 requires an explicit transition.
  return readProjectDocument(next);
}
export function renameWorkspace(doc: ProjectDocument, id: string, name: string): ProjectDocument {
  if (!doc.workspaces.some(w => w.id === id)) throw new Error('Unknown workspace.');
  return readProjectDocument({ ...doc, workspaces: doc.workspaces.map(w => w.id === id ? { ...w, name: name.trim() } : w) });
}
export function moveWorkspace(doc: ProjectDocument, id: string, direction: -1 | 1): ProjectDocument {
  const workspaces = [...doc.workspaces]; const i = workspaces.findIndex(w => w.id === id);
  if (i < 0) throw new Error('Unknown workspace.');
  const j = i + direction; if (j < 0 || j >= workspaces.length) return doc;
  [workspaces[i], workspaces[j]] = [workspaces[j], workspaces[i]];
  return { ...doc, workspaces };
}
export function removeWorkspace(doc: ProjectDocument, id: string): ProjectDocument {
  if (doc.workspaces.length <= 1) throw new Error('At least one workspace is required.');
  if (!doc.workspaces.some(w => w.id === id)) throw new Error('Unknown workspace.');
  if (doc.scope.mode === 'legacy' && doc.scope.workspaceId === id) throw new Error('Legacy calculation owner cannot be deleted before explicit scope transition.');
  if (doc.scope.mode === 'explicit' && Object.values(doc.scope.assignments).some(a => a.status === 'measured' && a.workspaceIds.includes(id)))
    throw new Error('Remove measured scope ownership before deleting this workspace.');
  const workspaces = doc.workspaces.filter(w => w.id !== id);
  return { ...doc, workspaces, activeWorkspaceId: doc.activeWorkspaceId === id ? workspaces[0].id : doc.activeWorkspaceId };
}
export function validateProjectBudget(doc: ProjectDocument): string {
  const encoded = serializeProjectDocument(doc);
  if (encoded.length > PROJECT_CHARACTER_BUDGET) throw new Error('Complete project exceeds the provisional 4 million character budget. Export a backup or reduce blueprint sizes.');
  return encoded;
}
export function validateBlueprintBudget(doc: ProjectDocument, id: string, next: FloorplanState): void {
  if ((next.underlay?.src.length || 0) > UNDERLAY_CHARACTER_BUDGET) throw new Error('Blueprint exceeds the 850,000 character budget. Use a smaller image.');
  validateProjectBudget(updateWorkspaceView(doc, id, next));
}
