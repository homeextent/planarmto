import { CompanyBranding, FloorplanState, ProjectSettings } from '../types';
import { calculateMTO, calculateEstimatedCost, DEFAULT_UNIT_COST_RATES } from '../engine/estimator';

const BRANDING_STORAGE_KEY = 'planarmto_company_branding_v1';
const PROJECTS_DIRECTORY_KEY = 'planarmto_saved_projects_v1';
const AUTOSAVE_STORAGE_KEY = 'planarmto_autosave_state_v1';

export interface SavedProjectEntry {
  id: string;
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
 * Persists company branding data into browser localStorage.
 * Retains company name, address, contact, logo Data URL, and lead estimator credentials.
 */
export function savePersistedBranding(branding: CompanyBranding): void {
  try {
    // We persist the firm details & logo, keeping projectNumber separate or included
    const dataToSave: CompanyBranding = {
      companyName: branding.companyName || '',
      address: branding.address || '',
      contact: branding.contact || '',
      logoUrl: branding.logoUrl || '',
      estimatorName: branding.estimatorName || '',
    };
    localStorage.setItem(BRANDING_STORAGE_KEY, JSON.stringify(dataToSave));
  } catch (err) {
    console.warn('Unable to persist company branding to localStorage:', err);
  }
}

/**
 * Retrieves persisted company branding from localStorage.
 */
export function getPersistedBranding(): CompanyBranding | null {
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
 * Applies persisted company branding onto project settings.
 * Generates or keeps the project-specific Job Reference / Spec code.
 */
export function hydrateSettingsWithBranding(
  settings: ProjectSettings,
  defaultProjectNumber?: string
): ProjectSettings {
  const persisted = getPersistedBranding();
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
 * Retrieves all saved projects in the in-app project directory.
 */
export function getSavedProjects(): SavedProjectEntry[] {
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
 * Saves or updates a project entry in the in-app directory.
 */
export function saveProjectToDirectory(
  name: string,
  state: FloorplanState,
  options?: {
    id?: string;
    description?: string;
    projectNumber?: string;
  }
): SavedProjectEntry {
  const projects = getSavedProjects();
  const now = Date.now();

  // Compute metrics for quick index listing
  const mto = calculateMTO(state);
  const cost = calculateEstimatedCost(
    mto,
    state.settings.costRates || DEFAULT_UNIT_COST_RATES,
    state.settings.categoryInclusions,
    state.settings.itemInclusions
  );

  // Search by ID first for robust overwriting
  const targetId = options?.id || state.activeProjectId;
  const existingIndex = targetId ? projects.findIndex((p) => p.id === targetId) : -1;

  const entryId = targetId || `proj_${now}_${Math.random().toString(36).substr(2, 6)}`;
  const entryCreatedAt = existingIndex >= 0 ? projects[existingIndex].createdAt : now;

  const newEntry: SavedProjectEntry = {
    id: entryId,
    name: name.trim() || 'Untitled Architectural Project',
    projectNumber: options?.projectNumber || state.settings.companyBranding?.projectNumber || `PRJ-${new Date().getFullYear()}-MTO`,
    description: options?.description || '',
    createdAt: entryCreatedAt,
    updatedAt: now,
    roomCount: mto.roomDetails.length,
    grossSf: mto.grossFootprintSf || mto.flooringPackageSf || 0,
    netSf: mto.netFloorAreaSf || mto.flooringPackageSf || 0,
    estimatedTotal: cost.totalCost,
    state,
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
 * Deletes a project from the in-app directory.
 */
export function deleteProjectFromDirectory(id: string): SavedProjectEntry[] {
  const projects = getSavedProjects().filter((p) => p.id !== id);
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
export function renameProjectInDirectory(id: string, newName: string): SavedProjectEntry[] {
  const projects = getSavedProjects();
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
