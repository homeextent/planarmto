import { CompanyBranding, FloorplanState, ProjectSettings, UnitCostRates } from '../types';
import { calculateMTO, calculateEstimatedCost, safeMergeRates } from '../engine/estimator';
import { DEFAULT_UNIT_COST_RATES } from '../constants/rates';

const BRANDING_STORAGE_KEY = 'planarmto_company_branding_v1';
const PROJECTS_DIRECTORY_KEY = 'planarmto_saved_projects_v1';
const AUTOSAVE_STORAGE_KEY = 'planarmto_autosave_state_v1';
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
            
            // Rehydrate blueprint data for backward compatibility and completeness
            if (parsedState?.underlay) {
              const u = parsedState.underlay;
              u.src = u.src || u.blueprintUrl || '';
              u.url = u.src; // Ensure both src and url are present
              u.blueprintUrl = u.src;
              u.opacity = u.opacity !== undefined ? u.opacity : (u.blueprintOpacity !== undefined ? u.blueprintOpacity : 0.5);
              u.blueprintOpacity = u.opacity;
              u.scale = u.scale !== undefined ? u.scale : (u.blueprintScale !== undefined ? u.blueprintScale : 1.0);
              u.blueprintScale = u.scale;
              u.x = u.x !== undefined ? u.x : (u.blueprintOffsetX !== undefined ? u.blueprintOffsetX : 0);
              u.blueprintOffsetX = u.x;
              u.y = u.y !== undefined ? u.y : (u.blueprintOffsetY !== undefined ? u.blueprintOffsetY : 0);
              u.blueprintOffsetY = u.y;
              u.isVisible = u.isVisible !== undefined ? u.isVisible : (u.blueprintVisible !== undefined ? u.blueprintVisible : true);
              u.blueprintVisible = u.isVisible;
              u.isLocked = u.isLocked !== undefined ? u.isLocked : (u.blueprintLocked !== undefined ? u.blueprintLocked : false);
              u.blueprintLocked = u.isLocked;
              u.id = u.id || 'blueprint_main';
            }

            if (parsedState?.settings?.costRates) {
              parsedState.settings.costRates = safeMergeRates(parsedState.settings.costRates);
            }
            return parsedState;
          })(),
        }))
        .sort((a, b) => (Number(b.updatedAt) || 0) - (Number(a.updatedAt) || 0));
    } catch (err) {
      console.warn('WP Projects fetch failed, falling back to local:', err);
    }
  }

  try {
    const raw = localStorage.getItem(PROJECTS_DIRECTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map(p => {
        if (p.state?.settings?.costRates) {
          p.state.settings.costRates = safeMergeRates(p.state.settings.costRates);
        }
        return p;
      }).sort((a, b) => b.updatedAt - a.updatedAt);
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
    state: {
      ...state,
      underlay: state.underlay ? {
        ...state.underlay,
        // Sync properties before saving to ensure both naming conventions are preserved
        blueprintUrl: state.underlay.src,
        blueprintOpacity: state.underlay.opacity,
        blueprintScale: state.underlay.scale,
        blueprintOffsetX: state.underlay.x,
        blueprintOffsetY: state.underlay.y,
        blueprintVisible: state.underlay.isVisible,
        blueprintLocked: state.underlay.isLocked,
        url: state.underlay.src
      } : undefined,
      settings: {
        ...state.settings,
        costRates: state.settings.costRates ? {
          ...state.settings.costRates,
          // No longer using global lastUpdated
        } : undefined,
      },
    },
  };

  if (isWP()) {
    try {
      return await wpFetch<SavedProjectEntry>('projects', {
        method: 'POST',
        body: JSON.stringify({
          ...payload,
          uuid: payload.id,
          project_uuid: payload.id,
        }),
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
  if (isWP()) {
    try {
      await wpFetch(`projects/${id}`, { method: 'DELETE' });
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
