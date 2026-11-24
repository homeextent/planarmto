import { CompanyBranding, FloorplanState, ProjectSettings, UnitCostRates } from '../types';
import { safeMergeRates } from '../engine/estimator';
import type { ProjectDocument } from '../engine/projectDocument';
import { normalizeProjectInput, validateProjectBudget } from '../engine/workspaceController';
export type StoredProjectState = FloorplanState | ProjectDocument;

const BRANDING_STORAGE_KEY = 'planarmto_company_branding_v1';
const PROJECTS_DIRECTORY_KEY = 'PLANAR_MTO_PROJECTS_LIST';
const PROJECT_PREFIX = 'PLANAR_MTO_PROJECT_';

/**
 * Persists an individual project payload.
 */
async function saveProjectPayload(id: string | number, entry: SavedProjectEntry): Promise<void> {
  if (isWP()) return; // WP handles its own persistence
  try {
    localStorage.setItem(`${PROJECT_PREFIX}${id}`, JSON.stringify(entry));
  } catch (err) {
    throw new Error('Unable to save project to browser storage. Storage may be full or unavailable. Export a JSON backup before leaving.');
  }
}

/**
 * Retrieves a single project payload.
 */
export async function getProjectPayload(id: string | number): Promise<SavedProjectEntry | null> {
  if (isWP()) return null; 
  try {
    const raw = localStorage.getItem(`${PROJECT_PREFIX}${id}`);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}
const AUTOSAVE_STORAGE_KEY = 'planarmto_autosave_state_v3';
const HISTORICAL_AUTOSAVE_KEY = 'planarmto_autosave_state_v1';
const GLOBAL_RATES_STORAGE_KEY = 'planarmto_global_rates';

export interface SavedProjectEntry {
  id: string | number; // WP IDs are numbers, local IDs are strings
  name: string;
  projectNumber?: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
  roomCount: number;
  grossSf: number;
  netSf: number;
  estimatedTotal: number;
  state: StoredProjectState;
}

/**
 * Helper to check if we are in WordPress environment
 */
const isWP = () => typeof window !== 'undefined' && !!window.planarMTOConfig?.restUrl && !!window.planarMTOConfig?.currentUserId;

/**
 * Generic fetcher for WP REST API
 */
async function wpFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  if (!window.planarMTOConfig) throw new Error('WP Config missing');
  
  const cleanEndpoint = endpoint.replace(/^\/?(planarmto\/v1\/)?/, '');
  const baseUrl = window.planarMTOConfig.restUrl.replace(/\/$/, '');
  const url = `${baseUrl}/${cleanEndpoint}`;

  const headers = {
    'Content-Type': 'application/json',
    'X-WP-Nonce': window.planarMTOConfig.nonce,
    ...options.headers,
  };

  const response = await fetch(url, { ...options, headers });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(error.message || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

/**
 * Persists company branding data.
 */
export async function savePersistedBranding(branding: CompanyBranding): Promise<void> {
  const dataToSave: CompanyBranding = {
    companyName: branding.companyName || '',
    address: branding.address || '',
    contact: branding.contact || '',
    logoUrl: branding.logoUrl || '',
    estimatorName: branding.estimatorName || '',
  };

  if (isWP()) {
    try {
      await wpFetch('branding', {
        method: 'POST',
        body: JSON.stringify(dataToSave),
      });
      return;
    } catch (err) {
      console.warn('WP Branding save failed, falling back to local:', err);
    }
  }

  try {
    localStorage.setItem(BRANDING_STORAGE_KEY, JSON.stringify(dataToSave));
  } catch (err) {
    console.warn('Unable to persist company branding to localStorage:', err);
  }
}

/**
 * Retrieves persisted company branding.
 */
export async function getPersistedBranding(): Promise<CompanyBranding | null> {
  if (isWP()) {
    try {
      return await wpFetch<CompanyBranding>('branding');
    } catch (err) {
      console.warn('WP Branding fetch failed, falling back to local:', err);
    }
  }

  try {
    const raw = localStorage.getItem(BRANDING_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CompanyBranding;
  } catch (err) {
    console.warn('Unable to read company branding from localStorage:', err);
    return null;
  }
}

/**
 * Persists global master rate presets.
 */
export async function savePersistedRateProfile(rates: UnitCostRates): Promise<void> {
  // Note: timestamps are now expected to be managed by the caller in categoryLastUpdated
  const ratesToSave = { ...rates };

  if (isWP()) {
    try {
      await wpFetch('rates', {
        method: 'POST',
        body: JSON.stringify(ratesToSave),
      });
      return;
    } catch (err) {
      console.warn('WP Rates save failed, falling back to local:', err);
    }
  }

  try {
    localStorage.setItem(GLOBAL_RATES_STORAGE_KEY, JSON.stringify(ratesToSave));
  } catch (err) {
    console.warn('Unable to persist global rates to localStorage:', err);
  }
}

/**
 * Retrieves persisted global master rate presets.
 */
export async function getPersistedRateProfile(): Promise<UnitCostRates | null> {
  let loadedRates: Partial<UnitCostRates> | null = null;

  if (isWP()) {
    try {
      const rates = await wpFetch<UnitCostRates | any[]>('rates');
      // If it returns an empty array, it means no meta found
      if (!(Array.isArray(rates) && rates.length === 0)) {
        loadedRates = rates as UnitCostRates;
      }
    } catch (err) {
      console.warn('WP Rates fetch failed, falling back to local:', err);
    }
  }

  if (!loadedRates) {
    try {
      const raw = localStorage.getItem(GLOBAL_RATES_STORAGE_KEY);
      if (raw) {
        loadedRates = JSON.parse(raw) as UnitCostRates;
      }
    } catch (err) {
      console.warn('Unable to read global rates from localStorage:', err);
    }
  }

  return loadedRates ? safeMergeRates(loadedRates) : null;
}

/**
 * Retrieves all saved projects.
 */
export async function getSavedProjects(): Promise<SavedProjectEntry[]> {
  if (isWP()) {
    try {
      const projects = await wpFetch<any[]>('projects');
      return projects
        .map((p) => ({
          ...p,
          id: p.id || p.project_uuid,
          name: p.name || p.project_name || 'Untitled Project',
          projectNumber: p.projectNumber || p.project_number || '',
          description: p.description || '',
          roomCount: Number(p.roomCount || p.room_count || 0),
          grossSf: Number(p.grossSf || p.gross_sf || 0),
          netSf: Number(p.netSf || p.net_sf || 0),
          estimatedTotal: Number(p.estimatedTotal || p.estimated_total || 0),
          createdAt: Number(p.createdAt || (p.created_at ? new Date(p.created_at).getTime() : Date.now())),
          updatedAt: Number(p.updatedAt || (p.updated_at ? new Date(p.updated_at).getTime() : Date.now())),
          state: (() => {
            const parsedState = typeof p.state === 'string' ? JSON.parse(p.state) : p.state || (p.project_state ? (typeof p.project_state === 'string' ? JSON.parse(p.project_state) : p.project_state) : {});
            
            return parsedState;
          })(),
        }))
        .sort((a, b) => (Number(b.updatedAt) || 0) - (Number(a.updatedAt) || 0));
    } catch (err) {
      throw new Error('Unable to read authenticated projects. ' + (err instanceof Error ? err.message : String(err)));
    }
  }

  try {
    const raw = localStorage.getItem(PROJECTS_DIRECTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const entries = await Promise.all(parsed.map(async (p) => {
        // If it's a lightweight index entry, try to fetch the full payload if needed
        // For the directory list, we usually don't need the full state, but getSavedProjects
        // currently returns SavedProjectEntry which includes state.
        if (!p.state) {
          const full = await getProjectPayload(p.id);
          if (full) return full;
          throw new Error('Missing project payload: ' + p.id);
        }

        return p;
      }));
      return entries.sort((a, b) => b.updatedAt - a.updatedAt);
    }
    throw new Error('Invalid directory index.');
  } catch (err) {
    throw new Error('Unable to read saved projects directory. Existing data has not been replaced.');
  }
}

/**
 * Saves or updates a project entry.
 */
export async function saveProjectToDirectory(
  name: string,
  state: StoredProjectState,
  options?: {
    id?: string | number;
    description?: string;
    projectNumber?: string;
  }
): Promise<SavedProjectEntry> {
  const doc = normalizeProjectInput(state);
  const id = options?.id || doc.activeProjectId || crypto.randomUUID();
  const nameToSave = name.trim() || 'Untitled Architectural Project';
  const persistedState = { ...doc, activeProjectId: String(id), activeProjectName: nameToSave };
  validateProjectBudget(persistedState);
  // Reject replacing a retired record, even if a caller supplied its ID explicitly.
  const projects = await getSavedProjects();
  const existing = projects.find(p => String(p.id) === String(id));
  if (existing) {
    try { normalizeProjectInput(existing.state); }
    catch { throw new Error('Historical project is retained for export only. Save as a new project.'); }
  }
  const payload = {
    id,
    name: name.trim() || 'Untitled Architectural Project',
    projectNumber: options?.projectNumber || doc.settings.companyBranding?.projectNumber || `PRJ-${new Date().getFullYear()}-MTO`,
    description: options?.description || '',
    roomCount: doc.workspaces.filter(w => w.type === 'floor').reduce((n,w) => n + w.geometry.rooms.length, 0),
    grossSf: 0,
    netSf: 0,
    estimatedTotal: 0,
    state: persistedState,
  };

  if (isWP()) {
    const result = await wpFetch<{ success: boolean }>('projects', {
      method: 'POST',
      body: JSON.stringify({
        ...payload,
        uuid: payload.id,
        project_uuid: payload.id,
      }),
    });
    if (result.success !== true) throw new Error('WordPress did not confirm the project save.');
    // Return the saved entry; the API acknowledges the write rather than returning a project.
    return { ...payload, id: payload.id, createdAt: Date.now(), updatedAt: Date.now() };
  }

  // Fallback to LocalStorage
  const originalIndex = JSON.parse(localStorage.getItem(PROJECTS_DIRECTORY_KEY) || '[]') as SavedProjectEntry[];
  const now = Date.now();
  const targetId = payload.id;
  const entryId = targetId || `proj_${now}_${Math.random().toString(36).substr(2, 6)}`;
  
  const existingIndex = projects.findIndex((p) => String(p.id) === String(entryId));
  const entryCreatedAt = existingIndex >= 0 ? projects[existingIndex].createdAt : now;

  const newEntry: SavedProjectEntry = {
    ...payload,
    id: entryId,
    createdAt: entryCreatedAt,
    updatedAt: now,
  };

  // 1. Save the full payload, retaining the previous value for rollback if the index write fails.
  const payloadKey = `${PROJECT_PREFIX}${entryId}`;
  const previousPayload = localStorage.getItem(payloadKey);
  await saveProjectPayload(entryId, newEntry);

  // 2. Update the master index (strip state for the index list to keep it light)
  const indexEntry = { ...newEntry };
  delete (indexEntry as any).state;

  if (existingIndex >= 0) {
    projects[existingIndex] = indexEntry as any;
  } else {
    projects.unshift(indexEntry as any);
  }

  try {
    localStorage.setItem(PROJECTS_DIRECTORY_KEY, JSON.stringify(projects.map(p => String(p.id) === String(entryId) ? indexEntry : originalIndex.find(old => String(old.id) === String(p.id)) ?? p)));
  } catch (err) {
    if (previousPayload === null) localStorage.removeItem(payloadKey);
    else localStorage.setItem(payloadKey, previousPayload);
    throw new Error('Unable to update the project directory. Browser storage may be full. Export a JSON backup.');
  }

  return newEntry;
}

/**
 * Deletes a project.
 */
export async function deleteProjectFromDirectory(id: string | number): Promise<SavedProjectEntry[]> {
  if (isWP()) {
    await wpFetch(`projects/${encodeURIComponent(String(id))}`, { method: 'DELETE' });
    return getSavedProjects();
  }

  await getSavedProjects(); // Validate directory before changing it.
  const index = JSON.parse(localStorage.getItem(PROJECTS_DIRECTORY_KEY) || '[]') as SavedProjectEntry[];
  localStorage.setItem(PROJECTS_DIRECTORY_KEY, JSON.stringify(index.filter(p => String(p.id) !== String(id))));
  localStorage.removeItem(`${PROJECT_PREFIX}${id}`);
  return getSavedProjects();
}

/**
 * Renames a project in the directory.
 */
export async function renameProjectInDirectory(id: string | number, newName: string): Promise<SavedProjectEntry[]> {
  const projects = await getSavedProjects();
  const project = projects.find(p => String(p.id) === String(id));
  if (!project) throw new Error('Project not found.');
  await saveProjectToDirectory(newName, project.state, { id: project.id, projectNumber: project.projectNumber, description: project.description });
  return getSavedProjects();
}

/**
 * Applies persisted company branding onto project settings.
 */
export async function hydrateSettingsWithBranding(
  settings: ProjectSettings,
  defaultProjectNumber?: string
): Promise<ProjectSettings> {
  const persisted = await getPersistedBranding();
  if (!persisted) {
    return settings;
  }

  return {
    ...settings,
    companyBranding: {
      ...persisted,
      projectNumber:
        settings.companyBranding?.projectNumber ||
        defaultProjectNumber ||
        `PRJ-${new Date().getFullYear()}-MTO-${Math.floor(100 + Math.random() * 900)}`,
    },
  };
}

/**
 * Saves current active draft for auto-recovery.
 */
export function saveAutoSaveState(state: StoredProjectState): void {
  try {
    const document = normalizeProjectInput(state);
    validateProjectBudget(document);
    const payload = {
      timestamp: Date.now(),
      state: document,
    };
    localStorage.setItem(AUTOSAVE_STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    throw new Error('Automatic recovery could not be saved. Browser storage may be full or unavailable. Save or export your project.');
  }
}

/**
 * Reads the last auto-saved state.
 */
export function getAutoSaveState(): { timestamp: number; state: StoredProjectState } | null {
  try {
    const raw = localStorage.getItem(AUTOSAVE_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

/**
 * Clears auto-save state.
 */
export function clearAutoSaveState(): void {
  try {
    localStorage.removeItem(AUTOSAVE_STORAGE_KEY);
  } catch (err) {
    // Ignore
  }
}

/** Historical recovery is deliberately separate from the new active recovery slot. */
export function getHistoricalAutoSaveRaw(): string | null {
  try { return localStorage.getItem(HISTORICAL_AUTOSAVE_KEY); } catch { return null; }
}
