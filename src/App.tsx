import React, { useState, useCallback, useMemo, useEffect } from 'react';
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
} from './types';
import { createModernTwoBedroomRancher, createBlankProject } from './engine/samplePlans';
import { calculateMTO, calculateEstimatedCost, DEFAULT_UNIT_COST_RATES } from './engine/estimator';
import { detectRoomFaces, isPointInPolygon } from './engine/cadMath';
import { hydrateSettingsWithBranding, saveAutoSaveState } from './utils/storage';
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
  // Project State initialized with realistic Modern 2-Bedroom Rancher template and persisted branding
  const [state, setState] = useState<FloorplanState>(() => {
    const base = createModernTwoBedroomRancher();
    return {
      ...base,
      settings: hydrateSettingsWithBranding(base.settings),
    };
  });

  // Unit Cost Rates for dual material/labor estimating
  const [costRates, setCostRates] = useState<UnitCostRates>(DEFAULT_UNIT_COST_RATES);

  // History stack for Undo / Redo
  const [history, setHistory] = useState<FloorplanState[]>([]);
  const [redoStack, setRedoStack] = useState<FloorplanState[]>([]);

  // Active drafting tool
  const [activeTool, setActiveTool] = useState<ActiveTool>('select');

  // Active wall preset for drafting
  const [activeWallPreset, setActiveWallPreset] = useState<WallPreset>('interior_2x4');

  // Currently selected element
  const [selection, setSelection] = useState<SelectionState>({ type: 'none' });

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

  // Global Keyboard Shortcuts (Ctrl+S / Cmd+S for Project Directory, Ctrl+Z / Ctrl+Y)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        setIsProjectDirectoryOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Update State with Undo history tracking
  const handleStateChange = useCallback((newState: FloorplanState, pushHistory = true) => {
    if (pushHistory) {
      setHistory((prev) => [...prev.slice(-30), state]);
      setRedoStack([]);
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
  }, [history, state]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[0];
    setHistory((prev) => [...prev, state]);
    setRedoStack((prev) => prev.slice(1));
    setState(next);
    setSelection({ type: 'none' });
  }, [redoStack, state]);

  // Load project from directory
  const handleLoadProjectFromDirectory = useCallback((loadedState: FloorplanState) => {
    setHistory([]);
    setRedoStack([]);
    setSelection({ type: 'none' });
    setState({
      ...loadedState,
      settings: hydrateSettingsWithBranding(loadedState.settings),
    });
  }, []);

  // New Blank Project with persisted branding
  const handleNewBlankProject = useCallback(() => {
    const blank = createBlankProject();
    setHistory([]);
    setRedoStack([]);
    setSelection({ type: 'none' });
    setState({
      ...blank,
      settings: hydrateSettingsWithBranding(
        blank.settings,
        `PRJ-${new Date().getFullYear()}-MTO-${Math.floor(100 + Math.random() * 900)}`
      ),
    });
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
      const currentMode = prev.settings.calculationMode || 'exterior_framing';
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

  // Handle Deleting Selected CAD Element
  const handleDeleteSelected = useCallback(() => {
    if (selection.type === 'none' || !selection.id) return;

    const id = selection.id;
    let nextNodes = [...state.nodes];
    let nextWalls = [...state.walls];
    let nextApertures = [...state.apertures];
    let nextStamps = [...state.stamps];
    let nextAnnotations = [...(state.annotations || [])];
    let nextDecks = [...state.decks];
    let nextHardscapes = [...state.hardscapes];

    if (selection.type === 'node') {
      // Remove node and any walls connected to it
      nextNodes = nextNodes.filter((n) => n.id !== id);
      const removedWallIds = nextWalls
        .filter((w) => w.startNodeId === id || w.endNodeId === id)
        .map((w) => w.id);
      nextWalls = nextWalls.filter((w) => !removedWallIds.includes(w.id));
      nextApertures = nextApertures.filter((ap) => !removedWallIds.includes(ap.wallId));
    } else if (selection.type === 'wall') {
      nextWalls = nextWalls.filter((w) => w.id !== id);
      nextApertures = nextApertures.filter((ap) => ap.wallId !== id);
    } else if (selection.type === 'aperture') {
      nextApertures = nextApertures.filter((ap) => ap.id !== id);
    } else if (selection.type === 'stamp') {
      nextStamps = nextStamps.filter((st) => st.id !== id);
    } else if (selection.type === 'annotation') {
      nextAnnotations = nextAnnotations.filter((ann) => ann.id !== id);
    } else if (selection.type === 'room') {
      const room = state.rooms.find((r) => r.id === id);
      if (room) {
        const wallIdSet = new Set(room.wallIds);
        // Remove walls forming this room
        nextWalls = nextWalls.filter((w) => !wallIdSet.has(w.id));
        // Remove apertures on those walls
        nextApertures = nextApertures.filter((ap) => !wallIdSet.has(ap.wallId));
        // Remove internal stamps inside room
        nextStamps = nextStamps.filter((st) => !isPointInPolygon({ x: st.x, y: st.y }, room.points));
        // Clean up orphaned nodes that no longer connect to any remaining wall
        const remainingWallNodeIds = new Set<string>();
        nextWalls.forEach((w) => {
          remainingWallNodeIds.add(w.startNodeId);
          remainingWallNodeIds.add(w.endNodeId);
        });
        nextNodes = nextNodes.filter((n) => remainingWallNodeIds.has(n.id));
      }
    } else if (selection.type === 'deck') {
      nextDecks = nextDecks.filter((d) => d.id !== id);
    } else if (selection.type === 'hardscape') {
      nextHardscapes = nextHardscapes.filter((h) => h.id !== id);
    }

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
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden font-sans select-none">
      {/* 1. TOP HEADER BAR */}
      <HeaderBar
        state={state}
        onChange={handleStateChange}
        canUndo={history.length > 0}
        canRedo={redoStack.length > 0}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onOpenSettingsModal={() => setIsSettingsModalOpen(true)}
        onOpenRateModal={() => setIsRateModalOpen(true)}
        onOpenHelpModal={() => setIsHelpOpen(true)}
        onOpenPrintModal={() => setIsPrintModalOpen(true)}
        onOpenProjectDirectoryModal={() => setIsProjectDirectoryOpen(true)}
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
        onSaveRates={setCostRates}
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
  );
}
