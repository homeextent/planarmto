import React, { useState, useEffect } from 'react';
import { FloorplanState } from '../types';
import {
  SavedProjectEntry,
  getSavedProjects,
  saveProjectToDirectory,
  deleteProjectFromDirectory,
  renameProjectInDirectory,
  getAutoSaveState,
} from '../utils/storage';
import {
  FolderOpen,
  Plus,
  Trash2,
  Copy,
  Edit2,
  Check,
  X,
  Calendar,
  Layers,
  Ruler,
  DollarSign,
  Download,
  Upload,
  AlertCircle,
  FileCode,
  HardDrive,
  Save,
  Search,
  Sparkles,
  RefreshCw,
} from 'lucide-react';

interface ProjectDirectoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentState: FloorplanState;
  onLoadProject: (state: FloorplanState, projectName?: string) => void;
  onNewBlankProject: () => void;
}

export const ProjectDirectoryModal: React.FC<ProjectDirectoryModalProps> = ({
  isOpen,
  onClose,
  currentState,
  onLoadProject,
  onNewBlankProject,
}) => {
  const [projects, setProjects] = useState<SavedProjectEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [editingName, setEditingName] = useState('');
  const [saveAsModalOpen, setSaveAsModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectRef, setNewProjectRef] = useState('');
  const [autoSaveItem, setAutoSaveItem] = useState<{ timestamp: number; state: FloorplanState } | null>(null);

  // Reload projects list on open
  useEffect(() => {
    async function loadData() {
      if (isOpen) {
        setIsLoading(true);
        try {
          const loadedProjects = await getSavedProjects();
          setProjects(loadedProjects);
          setAutoSaveItem(getAutoSaveState());
          setNewProjectName(
            currentState.settings.companyBranding?.projectNumber
              ? `Project ${currentState.settings.companyBranding.projectNumber}`
              : 'Custom Architectural Project'
          );
          setNewProjectRef(currentState.settings.companyBranding?.projectNumber || `PRJ-${new Date().getFullYear()}-MTO`);
        } finally {
          setIsLoading(false);
        }
      }
    }
    loadData();
  }, [isOpen, currentState]);

  if (!isOpen) return null;

  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.projectNumber && p.projectNumber.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleSaveCurrent = async () => {
    setIsLoading(true);
    try {
      const defaultName = currentState.settings.companyBranding?.projectNumber
        ? `Project ${currentState.settings.companyBranding.projectNumber}`
        : 'Architectural Model';
      await saveProjectToDirectory(defaultName, currentState);
      const updated = await getSavedProjects();
      setProjects(updated);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveAsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;

    setIsLoading(true);
    try {
      const updatedState: FloorplanState = {
        ...currentState,
        settings: {
          ...currentState.settings,
          companyBranding: {
            ...currentState.settings.companyBranding,
            projectNumber: newProjectRef.trim() || currentState.settings.companyBranding?.projectNumber,
          },
        },
      };

      await saveProjectToDirectory(newProjectName.trim(), updatedState, {
        projectNumber: newProjectRef.trim(),
      });

      const updated = await getSavedProjects();
      setProjects(updated);
      setSaveAsModalOpen(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string | number) => {
    setIsLoading(true);
    try {
      const updated = await deleteProjectFromDirectory(id);
      setProjects(updated);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDuplicate = async (project: SavedProjectEntry) => {
    setIsLoading(true);
    try {
      await saveProjectToDirectory(`${project.name} (Copy)`, project.state);
      const updated = await getSavedProjects();
      setProjects(updated);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartRename = (project: SavedProjectEntry) => {
    setEditingId(project.id);
    setEditingName(project.name);
  };

  const handleSaveRename = async (id: string | number) => {
    if (editingName.trim()) {
      setIsLoading(true);
      try {
        const updated = await renameProjectInDirectory(id, editingName.trim());
        setProjects(updated);
      } finally {
        setIsLoading(false);
      }
    }
    setEditingId(null);
  };

  const handleExportSingleJson = (project: SavedProjectEntry) => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(project.state, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    const slug = project.name.replace(/[^a-zA-Z0-9]/g, '_');
    downloadAnchor.setAttribute('download', `${slug}_${project.projectNumber || 'PlanarMTO'}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleExportAllBackup = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(projects, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `PlanarMTO_Projects_Directory_Backup_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      setIsLoading(true);
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (item.name && item.state) {
              await saveProjectToDirectory(item.name, item.state, {
                id: item.id,
                projectNumber: item.projectNumber,
                description: item.description,
              });
            }
          }
          const updated = await getSavedProjects();
          setProjects(updated);
        } else if (parsed.nodes && parsed.walls) {
          // Single project file
          await saveProjectToDirectory('Imported Project', parsed);
          const updated = await getSavedProjects();
          setProjects(updated);
        }
      } catch (err) {
        console.error('Failed to import projects archive:', err);
      } finally {
        setIsLoading(false);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <FolderOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                Project Directory Manager
                <span className="text-xs font-mono font-normal px-2 py-0.5 bg-slate-800 text-sky-400 rounded-full border border-slate-700">
                  {projects.length} Saved
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Persistent in-app storage for multiple architectural projects & estimates
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSaveAsModalOpen(true)}
              className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-md shadow-sky-600/30 cursor-pointer transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Current As...</span>
            </button>
            <button
              onClick={() => {
                onNewBlankProject();
                onClose();
              }}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-slate-700 cursor-pointer transition-colors"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-400" />
              <span>New Canvas</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Loading Indicator */}
        {isLoading && (
          <div className="absolute inset-0 z-[60] bg-slate-950/40 backdrop-blur-[1px] flex items-center justify-center">
            <div className="flex flex-col items-center gap-3 p-4 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl">
              <RefreshCw className="w-8 h-8 text-sky-400 animate-spin" />
              <span className="text-xs font-bold text-slate-200 uppercase tracking-widest">Processing...</span>
            </div>
          </div>
        )}

        {/* Toolbar & Search */}
        <div className="p-3 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search saved projects by name or job reference..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportAllBackup}
              disabled={projects.length === 0}
              className="px-2.5 py-1.5 bg-slate-950 hover:bg-slate-800 disabled:opacity-50 text-slate-300 rounded-lg text-xs font-medium border border-slate-800 flex items-center gap-1.5 cursor-pointer transition-colors"
              title="Backup entire project directory as JSON"
            >
              <Download className="w-3.5 h-3.5 text-slate-400" />
              <span>Backup All</span>
            </button>
            <label className="px-2.5 py-1.5 bg-slate-950 hover:bg-slate-800 text-slate-300 rounded-lg text-xs font-medium border border-slate-800 flex items-center gap-1.5 cursor-pointer transition-colors">
              <Upload className="w-3.5 h-3.5 text-slate-400" />
              <span>Import Files</span>
              <input
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleImportBackup}
              />
            </label>
          </div>
        </div>

        {/* Auto-Save recovery notice if available */}
        {autoSaveItem && (
          <div className="bg-amber-950/20 border-b border-amber-500/20 px-4 py-2 flex items-center justify-between text-xs text-amber-300">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>
                Auto-saved session draft detected from{' '}
                {new Date(autoSaveItem.timestamp).toLocaleTimeString()} ({new Date(autoSaveItem.timestamp).toLocaleDateString()})
              </span>
            </div>
            <button
              onClick={() => {
                onLoadProject(autoSaveItem.state, 'Auto-saved Project');
                onClose();
              }}
              className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded text-[11px] cursor-pointer transition-colors"
            >
              Restore Draft
            </button>
          </div>
        )}

        {/* Projects List Container */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filteredProjects.length === 0 ? (
            <div className="py-16 text-center text-slate-500 space-y-3">
              <HardDrive className="w-12 h-12 mx-auto text-slate-600 stroke-[1.2]" />
              <div className="text-sm font-semibold text-slate-400">
                {searchQuery ? 'No matching projects found' : 'Your Project Directory is Empty'}
              </div>
              <p className="text-xs max-w-sm mx-auto text-slate-500">
                Save your active floorplans and estimates into the directory for instant access, duplication, and offline recovery.
              </p>
              <button
                onClick={handleSaveCurrent}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-md shadow-sky-600/30 transition-colors"
              >
                <Save className="w-4 h-4" />
                <span>Save Active Workspace</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredProjects.map((project) => {
                const isEditing = editingId === project.id;
                const formattedDate = new Date(project.updatedAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                });
                const formattedTime = new Date(project.updatedAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <div
                    key={project.id}
                    className="bg-slate-950/80 border border-slate-800 hover:border-sky-500/50 p-4 rounded-xl flex flex-col justify-between transition-all group"
                  >
                    <div>
                      {/* Top row: Title and Actions */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          {isEditing ? (
                            <div className="flex items-center gap-1.5">
                              <input
                                type="text"
                                value={editingName}
                                onChange={(e) => setEditingName(e.target.value)}
                                className="bg-slate-900 border border-sky-500 px-2 py-0.5 rounded text-xs text-white font-bold w-full focus:outline-none"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveRename(project.id);
                                  if (e.key === 'Escape') setEditingId(null);
                                }}
                              />
                              <button
                                onClick={() => handleSaveRename(project.id)}
                                className="p-1 text-emerald-400 hover:bg-slate-800 rounded"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="p-1 text-slate-400 hover:bg-slate-800 rounded"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <h3 className="text-sm font-bold text-slate-100 truncate group-hover:text-sky-300 transition-colors">
                                {project.name}
                              </h3>
                              <button
                                onClick={() => handleStartRename(project)}
                                className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-500 hover:text-slate-300 transition-opacity"
                                title="Rename project"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                          <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                            <span className="text-sky-400/90 font-mono font-semibold">
                              {project.projectNumber || 'PRJ-MTO'}
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {formattedDate} at {formattedTime}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleExportSingleJson(project)}
                            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
                            title="Export project JSON"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDuplicate(project)}
                            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
                            title="Duplicate project"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(project.id)}
                            className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
                            title="Delete project"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Project Metrics Summary Grid */}
                      <div className="grid grid-cols-3 gap-2 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/80 my-3 text-xs">
                        <div>
                          <div className="text-[10px] uppercase font-bold text-slate-500">Rooms</div>
                          <div className="font-mono font-bold text-slate-200 flex items-center gap-1 mt-0.5">
                            <Layers className="w-3 h-3 text-sky-400" />
                            {project.roomCount}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase font-bold text-slate-500">Area</div>
                          <div className="font-mono font-bold text-slate-200 flex items-center gap-1 mt-0.5">
                            <Ruler className="w-3 h-3 text-emerald-400" />
                            {project.grossSf} SF
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase font-bold text-slate-500">Total Est.</div>
                          <div className="font-mono font-bold text-emerald-400 truncate mt-0.5">
                            ${project.estimatedTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Open Button */}
                    <button
                      onClick={() => {
                        onLoadProject(project.state, project.name);
                        onClose();
                      }}
                      className="w-full py-2 bg-slate-800 hover:bg-sky-600 text-slate-200 hover:text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 border border-slate-700 hover:border-sky-500 cursor-pointer transition-all shadow-sm"
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                      <span>Open in CAD Canvas</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <HardDrive className="w-3.5 h-3.5 text-slate-400" />
            <span>Saved in browser client storage. Export backup JSON files for cross-device portability.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-lg cursor-pointer transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {/* Save As Modal Dialog */}
      {saveAsModalOpen && (
        <div className="fixed inset-0 z-60 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-xl p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Save className="w-4 h-4 text-sky-400" />
                Save Project to Directory
              </h3>
              <button
                onClick={() => setSaveAsModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAsSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Project Title / Name
                </label>
                <input
                  type="text"
                  required
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="e.g. Modern Two-Bedroom Rancher"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Job Reference / Specification Code
                </label>
                <input
                  type="text"
                  value={newProjectRef}
                  onChange={(e) => setNewProjectRef(e.target.value)}
                  placeholder="e.g. PRJ-2026-MTO-842"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setSaveAsModalOpen(false)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-md"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Project</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
