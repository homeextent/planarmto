import { CompanyBranding, FloorplanState, ProjectSettings } from '../types';
import { calculateMTO, calculateEstimatedCost, DEFAULT_UNIT_COST_RATES } from '../engine/estimator';

const BRANDING_STORAGE_KEY = 'planarmto_company_branding_v1';
const PROJECTS_DIRECTORY_KEY = 'planarmto_saved_projects_v1';
const AUTOSAVE_STORAGE_KEY = 'planarmto_autosave_state_v1';

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
  state: FloorplanState;
}

/**
 * Helper to check if we are in WordPress environment
 */
const isWP = () => typeof window !== 'undefined' && !!window.planarMTOConfig?.restUrl;

/**
 * Generic fetcher for WP REST API
 */
async function wpFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  if (!window.planarMTOConfig) throw new Error('WP Config missing');
  
  const url = `${window.planarMTOConfig.restUrl}/planarmto/v1${endpoint}`;
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
      await wpFetch('/branding', {
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
      return await wpFetch<CompanyBranding>('/branding');
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
 * Retrieves all saved projects.
 */
export async function getSavedProjects(): Promise<SavedProjectEntry[]> {
  if (isWP()) {
    try {
      const projects = await wpFetch<SavedProjectEntry[]>('/projects');
      return projects.sort((a, b) => (Number(b.updatedAt) || 0) - (Number(a.updatedAt) || 0));
    } catch (err) {
      console.warn('WP Projects fetch failed, falling back to local:', err);
    }
  }

  try {
    const raw = localStorage.getItem(PROJECTS_DIRECTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.sort((a, b) => b.updatedAt - a.updatedAt);
    }
    return [];
  } catch (err) {
    console.warn('Unable to read saved projects directory:', err);
    return [];
  }
}

/**
 * Saves or updates a project entry.
 */
export async function saveProjectToDirectory(
  name: string,
  state: FloorplanState,
  options?: {
    id?: string | number;
    description?: string;
    projectNumber?: string;
  }
): Promise<SavedProjectEntry> {
  // Compute metrics
  const mto = calculateMTO(state);
  const cost = calculateEstimatedCost(
    mto,
    state.settings.costRates || DEFAULT_UNIT_COST_RATES,
    state.settings.categoryInclusions,
    state.settings.itemInclusions
  );

  const payload = {
    id: options?.id || state.activeProjectId,
    name: name.trim() || 'Untitled Architectural Project',
    projectNumber: options?.projectNumber || state.settings.companyBranding?.projectNumber || `PRJ-${new Date().getFullYear()}-MTO`,
    description: options?.description || '',
    roomCount: mto.roomDetails.length,
    grossSf: mto.grossFootprintSf || mto.flooringPackageSf || 0,
    netSf: mto.netFloorAreaSf || mto.flooringPackageSf || 0,
    estimatedTotal: cost.totalCost,
    state,
  };

  if (isWP()) {
    try {
      return await wpFetch<SavedProjectEntry>('/projects', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.warn('WP Project save failed, falling back to local:', err);
    }
  }

  // Fallback to LocalStorage
  const projects = await getSavedProjects();
  const now = Date.now();
  const targetId = payload.id;
  const existingIndex = targetId ? projects.findIndex((p) => p.id === targetId) : -1;
  const entryId = targetId || `proj_${now}_${Math.random().toString(36).substr(2, 6)}`;
  const entryCreatedAt = existingIndex >= 0 ? projects[existingIndex].createdAt : now;

  const newEntry: SavedProjectEntry = {
    ...payload,
    id: entryId,
    createdAt: entryCreatedAt,
    updatedAt: now,
  };

  if (existingIndex >= 0) {
    projects[existingIndex] = newEntry;
  } else {
    projects.unshift(newEntry);
  }

  try {
    localStorage.setItem(PROJECTS_DIRECTORY_KEY, JSON.stringify(projects));
  } catch (err) {
    console.warn('Unable to write to project directory in localStorage:', err);
  }

  return newEntry;
}

/**
 * Deletes a project.
 */
export async function deleteProjectFromDirectory(id: string | number): Promise<SavedProjectEntry[]> {
  if (isWP() && typeof id === 'number') {
    try {
      await wpFetch(`/projects/${id}`, { method: 'DELETE' });
      return getSavedProjects();
    } catch (err) {
      console.warn('WP Project delete failed, falling back to local:', err);
    }
  }

  const projects = (await getSavedProjects()).filter((p) => p.id !== id);
  try {
    localStorage.setItem(PROJECTS_DIRECTORY_KEY, JSON.stringify(projects));
  } catch (err) {
    console.warn('Unable to update project directory after delete:', err);
  }
  return projects;
}

/**
 * Renames a project in the directory.
 */
export async function renameProjectInDirectory(id: string | number, newName: string): Promise<SavedProjectEntry[]> {
  // If WP, we can just use saveProjectToDirectory with the ID and new name
  // But for simplicity of this refactor, let's just update local for now or handle WP if ID is number
  if (isWP() && typeof id === 'number') {
    try {
      // Find the project to get its state
      const projects = await getSavedProjects();
      const project = projects.find(p => p.id === id);
      if (project) {
        await saveProjectToDirectory(newName, project.state, { id });
        return getSavedProjects();
      }
    } catch (err) {
      console.warn('WP Project rename failed, falling back to local:', err);
    }
  }

  const projects = await getSavedProjects();
  const index = projects.findIndex((p) => p.id === id);
  if (index >= 0) {
    projects[index].name = newName.trim() || 'Untitled Project';
    projects[index].updatedAt = Date.now();
    try {
      localStorage.setItem(PROJECTS_DIRECTORY_KEY, JSON.stringify(projects));
    } catch (err) {
      console.warn('Unable to update project name in localStorage:', err);
    }
  }
  return projects;
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
export function saveAutoSaveState(state: FloorplanState): void {
  try {
    const payload = {
      timestamp: Date.now(),
      state,
    };
    localStorage.setItem(AUTOSAVE_STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    // Quota or sandbox restrictions
  }
}

/**
 * Reads the last auto-saved state.
 */
export function getAutoSaveState(): { timestamp: number; state: FloorplanState } | null {
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
