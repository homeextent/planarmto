import type { FloorplanState } from '../types';
import { createBlankProject } from './samplePlans';
import { commitWorkspaceRenderView, readProjectDocument, replaceWorkspaceGeometry, serializeProjectDocument } from './projectDocument';
import type { ProjectDocument, WorkspaceType } from './projectDocument';

export const PROJECT_CHARACTER_BUDGET = 4_000_000;
export const UNDERLAY_CHARACTER_BUDGET = 850_000;
/** C.2 is the only future authoritative pricing path. */
export const canReportProjectEstimate = (_doc: ProjectDocument) => false;
export function normalizeProjectInput(input: unknown): ProjectDocument { return readProjectDocument(input); }

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
  const next: ProjectDocument = { ...doc, activeWorkspaceId: id, workspaces: [...doc.workspaces, { id, name: name.trim(), type, geometry, measurements: [] }] };
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
  if (Object.values(doc.scope.assignments).some(a => a.status === 'assigned' && a.workspaceIds.includes(id)))
    throw new Error('Remove assigned scope ownership before deleting this workspace.');
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

export function setScopeAssignment(doc: ProjectDocument, kind: import('./projectDocument').ScopeKind, assignment: import('./projectDocument').ScopeAssignment): ProjectDocument {
  return readProjectDocument({...doc,scope:{mode:'explicit',assignments:{...doc.scope.assignments,[kind]:assignment}}});
}
export function replaceSpecialistEntities(doc: ProjectDocument, id: string, measurements: import('./measurements/measurementTypes').SpecialistEntity[]): ProjectDocument {
  if(doc.activeWorkspaceId!==id) throw new Error('Inactive specialist workspace edit.');
  return readProjectDocument({...doc,workspaces:doc.workspaces.map(w=>w.id===id?{...w,measurements}:w)});
}

export type WorkspaceSnapshot={view:FloorplanState;measurements:import('./measurements/measurementTypes').SpecialistEntity[]};
export function restoreWorkspaceSnapshot(doc:ProjectDocument,id:string,snapshot:WorkspaceSnapshot):ProjectDocument {
 if(doc.activeWorkspaceId!==id)throw Error('Inactive workspace history edit');
 const updated=commitWorkspaceRenderView(doc,id,{...snapshot.view,settings:doc.settings,activeProjectId:doc.activeProjectId,activeProjectName:doc.activeProjectName});
 return replaceSpecialistEntities(updated,id,snapshot.measurements);
}
