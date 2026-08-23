import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  FloorplanState,
  ActiveTool,
  SelectionState,
  WallPreset,
  UnitCostRates,
  CategoryInclusions,
  DEFAULT_CATEGORY_INCLUSIONS,
  ItemInclusions,
  DEFAULT_ITEM_INCLUSIONS,
  ProjectSettings,
  ClipboardState,
} from './types';
import { createModernTwoBedroomRancher, createBlankProject } from './engine/samplePlans';
import { calculateMTO, calculateEstimatedCost, DEFAULT_UNIT_COST_RATES, safeMergeRates } from './engine/estimator';
import { detectRoomFaces, isPointInPolygon } from './engine/cadMath';
import {
  hydrateSettingsWithBranding,
  saveAutoSaveState,
  saveProjectToDirectory,
  getPersistedRateProfile,
  savePersistedRateProfile,
} from './utils/storage';
import { HeaderBar } from './components/HeaderBar';
import { Toolbar } from './components/Toolbar';
import { CadCanvas } from './components/CadCanvas';
import { MtoMatrixPanel } from './components/MtoMatrixPanel';
import { InspectorPanel } from './components/InspectorPanel';
import { HelpModal } from './components/HelpModal';
import { PrintReportModal } from './components/PrintReportModal';
import { RateCustomizerModal } from './components/RateCustomizerModal';
import { GlobalProjectSettingsModal } from './components/GlobalProjectSettingsModal';
import { ProjectDirectoryModal } from './components/ProjectDirectoryModal';

export default function App() {
  // Project State initialized with a clean blank canvas
  const [state, setState] = useState<FloorplanState>(createBlankProject());

  // Hydrate branding and master rates on mount
  useEffect(() => {
    async function init() {
      const [hydratedSettings, persistedMasterRates] = await Promise.all([
        hydrateSettingsWithBranding(state.settings),
        getPersistedRateProfile()
      ]);
      
      setState(prev => {
        const nextSettings = { ...hydratedSettings };
        
        // If it's a blank project without custom rates, we can apply master rates
        // Otherwise, we keep what's in the project state
        if (persistedMasterRates && !prev.settings.costRates) {
          nextSettings.costRates = safeMergeRates(persistedMasterRates);
        } else if (nextSettings.costRates) {
          nextSettings.costRates = safeMergeRates(nextSettings.costRates);
        }

        return {
          ...prev,
          settings: nextSettings
        };
      });

      if (persistedMasterRates) {
        setMasterRates(safeMergeRates(persistedMasterRates));
      }
    }
    init();
  }, []);

  // Unit Cost Rates for dual material/labor estimating
  const [masterRates, setMasterRates] = useState<UnitCostRates | null>(null);

  // Use the rates from active project state for calculations
  const costRates = useMemo(() => {
    return state.settings.costRates || DEFAULT_UNIT_COST_RATES;
  }, [state.settings.costRates]);

  // History stack for Undo / Redo
  const [history, setHistory] = useState<FloorplanState[]>([]);
  const [redoStack, setRedoStack] = useState<FloorplanState[]>([]);

  // Active drafting tool
  const [activeTool, setActiveTool] = useState<ActiveTool>('select');

  // Active wall preset for drafting
  const [activeWallPreset, setActiveWallPreset] = useState<WallPreset>('interior_2x4');

  // Selection State
  const [selection, setSelection] = useState<SelectionState>({ type: 'none' });

  // Clipboard State
  const [clipboard, setClipboard] = useState<ClipboardState | null>(null);

  // Tracking unsaved changes
  const [isDirty, setIsDirty] = useState(false);

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, worldX: number, worldY: number } | null>(null);

  // Modal visibility states
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isRateModalOpen, setIsRateModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isProjectDirectoryOpen, setIsProjectDirectoryOpen] = useState(false);

  // Auto-save project state to localStorage on state changes
  useEffect(() => {
    const timer = setTimeout(() => {
      saveAutoSaveState(state);
    }, 1000);
    return () => clearTimeout(timer);
  }, [state]);

  // Update State with Undo history tracking
  const handleStateChange = useCallback((newState: FloorplanState, pushHistory = true) => {
    if (pushHistory) {
      setHistory((prev) => [...prev.slice(-30), state]);
      setRedoStack([]);
      setIsDirty(true);
    }
    setState(newState);
  }, [state]);

  const handleUndo = useCallback(() => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    setRedoStack((prev) => [state, ...prev]);
    setHistory((prev) => prev.slice(0, prev.length - 1));
    setState(previous);
    setSelection({ type: 'none' });
    setIsDirty(true);
  }, [history, state]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[0];
    setHistory((prev) => [...prev, state]);
    setRedoStack((prev) => prev.slice(1));
    setState(next);
    setSelection({ type: 'none' });
    setIsDirty(true);
  }, [redoStack, state]);

  // Handle Deleting Selected CAD Element
  const handleDeleteSelected = useCallback(() => {
    const idsToDelete = selection.type === 'multiple' && selection.ids ? selection.ids : (selection.id ? [selection.id] : []);
    if (idsToDelete.length === 0) return;

    const idSet = new Set(idsToDelete);
    let nextNodes = [...state.nodes];
    let nextWalls = [...state.walls];
    let nextApertures = [...state.apertures];
    let nextStamps = [...state.stamps];
    let nextAnnotations = [...(state.annotations || [])];
    let nextDecks = [...state.decks];
    let nextHardscapes = [...state.hardscapes];

    // Bulk deletion logic
    nextNodes = nextNodes.filter((n) => !idSet.has(n.id));
    
    // For walls, also check if connected nodes were deleted
    nextWalls = nextWalls.filter((w) => !idSet.has(w.id) && !idSet.has(w.startNodeId) && !idSet.has(w.endNodeId));
    
    // For apertures, check if they or their walls were deleted
    const remainingWallIds = new Set(nextWalls.map(w => w.id));
    nextApertures = nextApertures.filter((ap) => !idSet.has(ap.id) && remainingWallIds.has(ap.wallId));
    
    nextStamps = nextStamps.filter((st) => !idSet.has(st.id));
    nextAnnotations = nextAnnotations.filter((ann) => !idSet.has(ann.id));
    nextDecks = nextDecks.filter((d) => !idSet.has(d.id));
    nextHardscapes = nextHardscapes.filter((h) => !idSet.has(h.id));

    // Handle room deletion specifically if selected
    const selectedRoomIds = state.rooms.filter(r => idSet.has(r.id)).map(r => r.id);
    if (selectedRoomIds.length > 0) {
      selectedRoomIds.forEach(roomId => {
        const room = state.rooms.find(r => r.id === roomId);
        if (room) {
          const wallIdSet = new Set(room.wallIds);
          nextWalls = nextWalls.filter((w) => !wallIdSet.has(w.id));
          nextApertures = nextApertures.filter((ap) => !wallIdSet.has(ap.wallId));
          nextStamps = nextStamps.filter((st) => !isPointInPolygon({ x: st.x, y: st.y }, room.points));
        }
      });
    }

    // Clean up orphaned nodes
    const remainingWallNodeIds = new Set<string>();
    nextWalls.forEach((w) => {
      remainingWallNodeIds.add(w.startNodeId);
      remainingWallNodeIds.add(w.endNodeId);
    });
    nextNodes = nextNodes.filter((n) => remainingWallNodeIds.has(n.id));

    const detectedRooms = detectRoomFaces(nextNodes, nextWalls, state.rooms);

    handleStateChange({
      ...state,
      nodes: nextNodes,
      walls: nextWalls,
      apertures: nextApertures,
      stamps: nextStamps,
      annotations: nextAnnotations,
      rooms: detectedRooms,
      decks: nextDecks,
      hardscapes: nextHardscapes,
    });

    setSelection({ type: 'none' });
  }, [selection, state, handleStateChange]);

  // Clipboard Operations
  const handleCopy = useCallback(() => {
    const ids = selection.type === 'multiple' ? (selection.ids || []) : (selection.id ? [selection.id] : []);
    if (ids.length === 0) return;

    const idSet = new Set(ids);
    
    const nodes = state.nodes.filter(n => idSet.has(n.id));
    const walls = state.walls.filter(w => idSet.has(w.id));
    const apertures = state.apertures.filter(a => idSet.has(a.id));
    const stamps = state.stamps.filter(s => idSet.has(s.id));
    const annotations = (state.annotations || []).filter(a => idSet.has(a.id));
    const rooms = state.rooms.filter(r => idSet.has(r.id));

    setClipboard({
      nodes: JSON.parse(JSON.stringify(nodes)),
      walls: JSON.parse(JSON.stringify(walls)),
      apertures: JSON.parse(JSON.stringify(apertures)),
      stamps: JSON.parse(JSON.stringify(stamps)),
      annotations: JSON.parse(JSON.stringify(annotations)),
      rooms: JSON.parse(JSON.stringify(rooms)),
    });
  }, [selection, state]);

  const handleCut = useCallback(() => {
    handleCopy();
    handleDeleteSelected();
  }, [handleCopy, handleDeleteSelected]);

  const handlePaste = useCallback((position?: { x: number, y: number }) => {
    if (!clipboard) return;

    const idMap = new Map<string, string>();
    const getNewId = (oldId: string) => {
      if (!idMap.has(oldId)) {
        idMap.set(oldId, uuidv4());
      }
      return idMap.get(oldId)!;
    };

    let dx = 2; // default offset in feet
    let dy = 2;

    if (position) {
      let count = 0;
      let sumX = 0;
      let sumY = 0;
      clipboard.nodes.forEach(n => { sumX += n.x; sumY += n.y; count++; });
      clipboard.stamps.forEach(s => { sumX += s.x; sumY += s.y; count++; });
      clipboard.annotations.forEach(a => { sumX += a.x; sumY += a.y; count++; });
      
      if (count > 0) {
        dx = position.x - (sumX / count);
        dy = position.y - (sumY / count);
      }
    }

    const newNodes = clipboard.nodes.map(n => ({
      ...n,
      id: getNewId(n.id),
      x: n.x + dx,
      y: n.y + dy,
    }));

    const newWalls = clipboard.walls.map(w => ({
      ...w,
      id: getNewId(w.id),
      startNodeId: getNewId(w.startNodeId),
      endNodeId: getNewId(w.endNodeId),
    }));

    const newApertures = clipboard.apertures.map(a => ({
      ...a,
      id: getNewId(a.id),
      wallId: getNewId(a.wallId),
    }));

    const newStamps = clipboard.stamps.map(s => ({
      ...s,
      id: getNewId(s.id),
      x: s.x + dx,
      y: s.y + dy,
      parentId: s.parentId ? getNewId(s.parentId) : undefined,
    }));

    const newAnnotations = clipboard.annotations.map(a => ({
      ...a,
      id: getNewId(a.id),
      x: a.x + dx,
      y: a.y + dy,
    }));

    const newRooms = clipboard.rooms.map(r => ({
      ...r,
      id: getNewId(r.id),
      nodeIds: r.nodeIds.map(id => getNewId(id)),
      wallIds: r.wallIds.map(id => getNewId(id)),
      points: r.points.map(p => ({ x: p.x + dx, y: p.y + dy })),
      centroid: { x: r.centroid.x + dx, y: r.centroid.y + dy },
    }));

    const nextState = {
      ...state,
      nodes: [...state.nodes, ...newNodes],
      walls: [...state.walls, ...newWalls],
      apertures: [...state.apertures, ...newApertures],
      stamps: [...state.stamps, ...newStamps],
      annotations: [...(state.annotations || []), ...newAnnotations],
    };

    nextState.rooms = detectRoomFaces(nextState.nodes, nextState.walls, [...state.rooms, ...newRooms]);

    handleStateChange(nextState);

    const newIds = [
      ...newNodes.map(n => n.id),
      ...newWalls.map(w => w.id),
      ...newApertures.map(a => a.id),
      ...newStamps.map(s => s.id),
      ...newAnnotations.map(a => a.id),
      ...newRooms.map(r => r.id),
    ];

    if (newIds.length > 0) {
      setSelection({ type: 'multiple', ids: newIds });
    }
  }, [clipboard, state, handleStateChange]);

  const handleDuplicate = useCallback(() => {
    handleCopy();
    setTimeout(() => {
        handlePaste();
    }, 0);
  }, [handleCopy, handlePaste]);

  // Load project from directory
  const handleLoadProjectFromDirectory = useCallback(async (loadedState: FloorplanState) => {
    setHistory([]);
    setRedoStack([]);
    setSelection({ type: 'none' });
    setContextMenu(null);
    
    const hydratedSettings = await hydrateSettingsWithBranding(loadedState.settings);
    if (hydratedSettings.costRates) {
      hydratedSettings.costRates = safeMergeRates(hydratedSettings.costRates);
    }
    
    setState({
      ...loadedState,
      settings: hydratedSettings,
    });
    setIsDirty(false);
    setIsProjectDirectoryOpen(false);
  }, []);

  // Save/Overwrite active project
  const handleSaveProject = useCallback(async () => {
    const { activeProjectId, activeProjectName } = state;
    if (activeProjectId) {
      await saveProjectToDirectory(activeProjectName, state, { id: activeProjectId });
      setIsDirty(false);
    } else {
      handleSaveProjectAs();
    }
  }, [state]);

  const handleSaveProjectAs = useCallback(async () => {
    const newName = prompt('Enter project name:', state.activeProjectName || 'New Project');
    if (newName) {
      const newId = `proj_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const newState = {
        ...state,
        activeProjectId: newId,
        activeProjectName: newName,
      };
      await saveProjectToDirectory(newName, newState, { id: newId });
      setState(newState);
      setIsDirty(false);
    }
  }, [state]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (e.shiftKey) {
          handleSaveProjectAs();
        } else {
          handleSaveProject();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        setIsProjectDirectoryOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSaveProject, handleSaveProjectAs]);

  // Global Clipboard Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'c':
            e.preventDefault();
            handleCopy();
            break;
          case 'x':
            e.preventDefault();
            handleCut();
            break;
          case 'v':
            e.preventDefault();
            handlePaste();
            break;
          case 'd':
            e.preventDefault();
            handleDuplicate();
            break;
          case 'z':
            if (e.shiftKey) {
              e.preventDefault();
              handleRedo();
            } else {
              e.preventDefault();
              handleUndo();
            }
            break;
          case 'y':
            e.preventDefault();
            handleRedo();
            break;
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        handleDeleteSelected();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleCopy, handleCut, handlePaste, handleDuplicate, handleDeleteSelected, handleUndo, handleRedo]);

  // New Blank Project with persisted branding
  const handleNewBlankProject = useCallback(async () => {
    const blank = createBlankProject();
    setHistory([]);
    setRedoStack([]);
    setSelection({ type: 'none' });

    const [hydratedSettings, persistedMasterRates] = await Promise.all([
      hydrateSettingsWithBranding(
        blank.settings,
        `PRJ-${new Date().getFullYear()}-MTO-${Math.floor(100 + Math.random() * 900)}`
      ),
      getPersistedRateProfile()
    ]);

    const finalSettings = { ...hydratedSettings };
    if (persistedMasterRates) {
      finalSettings.costRates = persistedMasterRates;
      setMasterRates(persistedMasterRates);
    }

    setState({
      ...blank,
      settings: finalSettings,
    });
    setIsProjectDirectoryOpen(false);
  }, []);

  // Toggle single trade category inclusion in real-time
  const handleToggleCategoryInclusion = useCallback((key: keyof CategoryInclusions) => {
    setState((prev) => {
      const currentInclusions = prev.settings.categoryInclusions || { ...DEFAULT_CATEGORY_INCLUSIONS };
      return {
        ...prev,
        settings: {
          ...prev.settings,
          categoryInclusions: {
            ...currentInclusions,
            [key]: !currentInclusions[key],
          },
        },
      };
    });
  }, []);

  // Toggle single micro-item inclusion in real-time
  const handleToggleItemInclusion = useCallback((key: keyof ItemInclusions) => {
    setState((prev) => {
      const currentItemInclusions = prev.settings.itemInclusions || { ...DEFAULT_ITEM_INCLUSIONS };
      return {
        ...prev,
        settings: {
          ...prev.settings,
          itemInclusions: {
            ...currentItemInclusions,
            [key]: currentItemInclusions[key] === false ? true : false,
          },
        },
      };
    });
  }, []);

  // Toggle calculation engine mode (Interior Finish Mode vs Exterior Framing Mode)
  const handleToggleCalculationMode = useCallback(() => {
    setState((prev) => {
      const currentMode = prev.settings.calculationMode || 'interior_finish';
      const nextMode = currentMode === 'interior_finish' ? 'exterior_framing' : 'interior_finish';
      return {
        ...prev,
        settings: {
          ...prev.settings,
          calculationMode: nextMode,
        },
      };
    });
  }, []);

  // Update Global Settings (with optional wall height cascade)
  const handleUpdateSettings = useCallback((newSettings: ProjectSettings, cascadeWallHeight = true) => {
    setState((prev) => {
      let updatedWalls = prev.walls;
      if (cascadeWallHeight && newSettings.defaultWallHeight !== prev.settings.defaultWallHeight) {
        updatedWalls = prev.walls.map((w) => ({
          ...w,
          height: newSettings.defaultWallHeight,
        }));
      }

      return {
        ...prev,
        walls: updatedWalls,
        settings: newSettings,
      };
    });
  }, []);

  // Real-Time Material Take-Off calculation
  const mtoReport = useMemo(() => {
    return calculateMTO(state);
  }, [state]);

  const estimatedCost = useMemo(() => {
    return calculateEstimatedCost(
      mtoReport,
      costRates,
      state.settings.categoryInclusions,
      state.settings.itemInclusions,
      state.settings
    );
  }, [mtoReport, costRates, state.settings]);

  return (
    <div className="h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden font-sans select-none" onClick={() => setContextMenu(null)}>
      <div className="flex flex-col h-full w-full">
      {/* 1. TOP HEADER BAR */}
      <HeaderBar
        state={state}
        onChange={handleStateChange}
        canUndo={history.length > 0}
        canRedo={redoStack.length > 0}
        isDirty={isDirty}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onSave={handleSaveProject}
        onSaveAs={handleSaveProjectAs}
        onOpenSettingsModal={() => setIsSettingsModalOpen(true)}
        onOpenRateModal={() => setIsRateModalOpen(true)}
        onOpenHelpModal={() => setIsHelpOpen(true)}
        onOpenPrintModal={() => setIsPrintModalOpen(true)}
        onOpenProjectDirectoryModal={() => setIsProjectDirectoryOpen(true)}
        onNewProject={handleNewBlankProject}
        onSelectUnderlay={() => setSelection({ type: 'underlay', id: state.underlay?.id })}
        selection={selection}
      />

      {/* 2. MAIN 3-PANEL WORKSPACE */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left CAD Tool Palette */}
        <Toolbar
          activeTool={activeTool}
          onSelectTool={(tool) => {
            setActiveTool(tool);
            if (tool !== 'select') {
              setSelection({ type: 'none' });
            }
          }}
          activeWallPreset={activeWallPreset}
          onSelectWallPreset={setActiveWallPreset}
        />

        {/* Center Interactive 2D CAD Canvas */}
        <CadCanvas
          state={state}
          onChange={handleStateChange}
          activeTool={activeTool}
          onToolChange={setActiveTool}
          selection={selection}
          onSelect={setSelection}
          onDeleteSelected={handleDeleteSelected}
          activeWallPreset={activeWallPreset}
          onContextMenu={(e, worldPos) => {
            setContextMenu({
              x: e.clientX,
              y: e.clientY,
              worldX: worldPos.x,
              worldY: worldPos.y
            });
          }}
        />

        {/* Right Real-time MTO Take-Off Matrix */}
        <MtoMatrixPanel
          state={state}
          mto={mtoReport}
          costRates={costRates}
          onOpenRateModal={() => setIsRateModalOpen(true)}
          onOpenPrintModal={() => setIsPrintModalOpen(true)}
          onOpenSettingsModal={() => setIsSettingsModalOpen(true)}
          onToggleCategoryInclusion={handleToggleCategoryInclusion}
          onToggleItemInclusion={handleToggleItemInclusion}
          onToggleCalculationMode={handleToggleCalculationMode}
        />

        {/* Floating Context Inspector for selected item */}
          <InspectorPanel
            state={state}
            onChange={handleStateChange}
            selection={selection}
            onClose={() => setSelection({ type: 'none' })}
            onDelete={handleDeleteSelected}
            onToolChange={setActiveTool}
          />
      </div>

      {/* Global Project & Engine Settings Modal */}
      <GlobalProjectSettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        settings={state.settings}
        onUpdateSettings={handleUpdateSettings}
        totalWallsCount={state.walls.length}
      />

      {/* Help & Deduction Formulas Modal */}
      <HelpModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
      />

      {/* Formatted Print & Export Take-Off Report Modal */}
      <PrintReportModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        state={state}
        mto={mtoReport}
        costRates={costRates}
      />

      {/* Material & Labor Unit Cost Rates Customizer */}
      <RateCustomizerModal
        isOpen={isRateModalOpen}
        onClose={() => setIsRateModalOpen(false)}
        rates={costRates}
        masterRates={masterRates}
        onSaveMasterRates={(newMaster) => setMasterRates(newMaster)}
        onSaveRates={async (newRates) => {
          // Sync rates into state settings to ensure project consistency
          setState(prev => ({
            ...prev,
            settings: {
              ...prev.settings,
              costRates: newRates
            }
          }));
        }}
      />

      {/* In-App Project Directory & Local Storage Manager Modal */}
      <ProjectDirectoryModal
        isOpen={isProjectDirectoryOpen}
        onClose={() => setIsProjectDirectoryOpen(false)}
        currentState={state}
        onLoadProject={handleLoadProjectFromDirectory}
        onNewBlankProject={handleNewBlankProject}
      />
      </div>

      {/* Context Menu UI */}
      {contextMenu && (
        <div 
          className="fixed z-[9999] bg-slate-900 border border-slate-700 shadow-2xl rounded-md py-1 min-w-[180px] overflow-hidden"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button 
            className="w-full flex items-center justify-between px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-40"
            onClick={() => { handleCut(); setContextMenu(null); }}
          >
            <div className="flex items-center gap-2"><span>✂️</span> Cut</div>
            <span className="text-xs text-slate-500">Ctrl+X</span>
          </button>
          <button 
            className="w-full flex items-center justify-between px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-40"
            onClick={() => { handleCopy(); setContextMenu(null); }}
          >
            <div className="flex items-center gap-2"><span>📋</span> Copy</div>
            <span className="text-xs text-slate-500">Ctrl+C</span>
          </button>
          <button 
            className="w-full flex items-center justify-between px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-40"
            disabled={!clipboard}
            onClick={() => { handlePaste({ x: contextMenu.worldX, y: contextMenu.worldY }); setContextMenu(null); }}
          >
            <div className="flex items-center gap-2"><span>📥</span> Paste</div>
            <span className="text-xs text-slate-500">Ctrl+V</span>
          </button>
          <button 
            className="w-full flex items-center justify-between px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-40"
            onClick={() => { handleDuplicate(); setContextMenu(null); }}
          >
            <div className="flex items-center gap-2"><span>👯</span> Duplicate</div>
            <span className="text-xs text-slate-500">Ctrl+D</span>
          </button>
          <div className="h-px bg-slate-700 my-1" />
          <button 
            className="w-full flex items-center justify-between px-3 py-2 text-sm text-red-400 hover:bg-red-950/30 disabled:opacity-40"
            onClick={() => { handleDeleteSelected(); setContextMenu(null); }}
          >
            <div className="flex items-center gap-2"><span>🗑️</span> Delete</div>
            <span className="text-xs text-red-900">Del</span>
          </button>
        </div>
      )}
    </div>
  );
}
