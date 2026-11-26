import { createTracedAssembly, FoundationAssemblyPanel, type TracedAssembly } from './components/FoundationAssemblyPanel';
import { applyAssemblyPreview } from './engine/measurements/foundationAssemblyController';
import type { AssemblyPreview, AssemblyTrace, FoundationPreset } from './engine/measurements/foundationAssemblyModel';
import {planFoundationDeletion} from './engine/measurements/foundationDerivation';
import {planRoofDeletion} from './engine/measurements/roofSelection';
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
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
import { calculateMTO, DEFAULT_UNIT_COST_RATES, safeMergeRates } from './engine/estimator';
import { detectRoomFaces, isPointInPolygon } from './engine/cadMath';
import {
  hydrateSettingsWithBranding,
  saveAutoSaveState,
  getAutoSaveState,
  clearAutoSaveState,
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

import { FoundationToolbar, FoundationInspector } from './components/FoundationWorkspace';
import { RoofToolbar, RoofInspector } from './components/RoofWorkspace';
import type { RoofEntity, FoundationEntity, SpecialistEntity } from './engine/measurements/measurementTypes';
import { validateRoofTopology } from './engine/measurements/roofMeasurements';
import { replaceFoundationPresets, replaceSpecialistEntities, restoreWorkspaceSnapshot } from './engine/workspaceController';
import { WorkspaceBar } from './components/WorkspaceBar';
import { createProjectDocument, workspaceRenderView, commitWorkspaceRenderView, serializeProjectDocument } from './engine/projectDocument';
import type { ProjectDocument, WorkspaceType } from './engine/projectDocument';
import { normalizeProjectInput, selectWorkspace, addWorkspace, renameWorkspace, moveWorkspace, removeWorkspace, canReportProjectEstimate, validateBlueprintBudget } from './engine/workspaceController';
import { ProjectProvider, useProject } from './context/ProjectContext';

export default function App() {
  return (
    <ProjectProvider>
      <AppContent />
    </ProjectProvider>
  );
}

import type { WorkspaceSnapshot } from './engine/workspaceController';
function AppContent() {
  const { saveSnapSetting, previousSnapSetting, clearSnapSetting } = useProject();
  // Project State initialized with a clean blank canvas
  const [document, setDocument] = useState<ProjectDocument>(() => createProjectDocument(createBlankProject(), uuidv4()));
  const currentDocument = useRef(document);
  const generation = useRef(0);
  const initialDocument = useRef(document);
  const [workspaceEpoch, setWorkspaceEpoch] = useState(0);
  const state = useMemo(() => workspaceRenderView(document), [document]);
  const [recovery, setRecovery] = useState(() => getAutoSaveState());
  const activeWorkspace = document.workspaces.find(w => w.id === document.activeWorkspaceId)!;
  const foundationEntities = activeWorkspace.type === 'foundation' ? activeWorkspace.measurements as FoundationEntity[] : undefined;
  const [foundationGhost,setFoundationGhost]=useState<{workspaceId:string;source:FoundationEntity[];members:FoundationEntity[]}|null>(null);
  const [foundationFilter,setFoundationFilter]=useState<{workspaceId:string;kind:string}>({workspaceId:'',kind:'all'});
  const visibleFoundationKind=foundationFilter.workspaceId===activeWorkspace.id?foundationFilter.kind:'all';
  const roofEntities = activeWorkspace.type === 'roof' ? activeWorkspace.measurements as RoofEntity[] : undefined;
  const reportable = canReportProjectEstimate(document);
  // Internal CAD views use immutable shared references; persisted documents remain canonical.
  const setState = useCallback((change: FloorplanState | ((prev: FloorplanState) => FloorplanState)) => {
    const doc = currentDocument.current;
    const prev = workspaceRenderView(doc);
    const next = typeof change === 'function' ? change(prev) : change;
    try {
      const updated = commitWorkspaceRenderView(doc, doc.activeWorkspaceId, next);
      currentDocument.current = updated;
      setDocument(updated);
      setIsDirty(true);
    } catch (err) { setStorageWarning(err instanceof Error ? err.message : String(err)); }
  }, []);

  // Hydrate branding and master rates on mount
  useEffect(() => {
    async function init() {
      const [hydratedSettings, persistedMasterRates] = await Promise.all([
        hydrateSettingsWithBranding(state.settings),
        getPersistedRateProfile()
      ]);
      
      if (generation.current !== 0 || currentDocument.current !== initialDocument.current) return;
      {
        const prev = workspaceRenderView(currentDocument.current);
        const nextSettings = { ...hydratedSettings };
        
        // If it's a blank project without custom rates, we can apply master rates
        // Otherwise, we keep what's in the project state
        if (persistedMasterRates && !prev.settings.costRates) {
          nextSettings.costRates = safeMergeRates(persistedMasterRates);
        } else if (nextSettings.costRates) {
          nextSettings.costRates = safeMergeRates(nextSettings.costRates);
        }

        const updated = commitWorkspaceRenderView(currentDocument.current, currentDocument.current.activeWorkspaceId, { ...prev, settings: nextSettings });
        currentDocument.current = updated; setDocument(updated);
      }

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
  const [history, setHistory] = useState<WorkspaceSnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<WorkspaceSnapshot[]>([]);
  const histories = useRef(new Map<string, { history: WorkspaceSnapshot[]; redo: WorkspaceSnapshot[] }>());

  // Active drafting tool
  const [traceEdit,setTraceEdit]=useState<{document:typeof document;trace:AssemblyTrace;onMove:(index:number,point:{x:number;y:number})=>void}>();
  const [activeTool, setActiveTool] = useState<ActiveTool>('select');
  const [standardSlab,setStandardSlab]=useState(false);
  const [slabMode,setSlabMode]=useState<'rectangle'|'polygon'>('rectangle');

  // Active wall preset for drafting
  const [activeWallPreset, setActiveWallPreset] = useState<WallPreset>('interior_2x4');

  // Selection State
  const [selection, setSelection] = useState<SelectionState>({ type: 'none' });

  // Clipboard State
  const [clipboard, setClipboard] = useState<ClipboardState | null>(null);

  // Tracking unsaved changes
  const [isDirty, setIsDirty] = useState(false);
  const [storageWarning, setStorageWarning] = useState('');

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
    if (!isDirty || recovery) {
      return;
    }
    const timer = setTimeout(() => {
      try { saveAutoSaveState(document); setStorageWarning(''); }
      catch (err) { setStorageWarning(err instanceof Error ? err.message : 'Automatic recovery failed.'); }
    }, 1000);
    return () => clearTimeout(timer);
  }, [document, isDirty, recovery]);

  // The exact immutable document produced by placement is the correction lease.
  const placementRef = useRef<{ token: string; document: typeof document } | null>(null);
  const commitDraftPlacement = (token: string, next: FloorplanState | SpecialistEntity[], replace = false): boolean => {
    if(currentDocument.current!==document)return false;
    const prior=placementRef.current;
    if(replace&&(!prior||prior.token!==token||prior.document!==document))return false;
    try {
      let updated: typeof document;
      if(Array.isArray(next)){
        if(activeWorkspace.type!=='roof'&&activeWorkspace.type!=='foundation')return false;
        if(activeWorkspace.type==='roof')validateRoofTopology(next as RoofEntity[]);
        updated=replaceSpecialistEntities(document,activeWorkspace.id,next);
      }else{
        if(activeWorkspace.type!=='floor')return false;
        updated=commitWorkspaceRenderView(document,activeWorkspace.id,{...next,settings:document.settings},true);
      }
      if(!replace)setHistory(prev=>[...prev.slice(-30),{view:state,measurements:activeWorkspace.measurements,foundationAssemblies:activeWorkspace.foundationAssemblies}]);
      setRedoStack([]);
      currentDocument.current=updated;placementRef.current={token,document:updated};
      setDocument(updated);setIsDirty(true);setStorageWarning('');return true;
    }catch(err){setStorageWarning(err instanceof Error?err.message:String(err));return false;}
  };

  // Update State with Undo history tracking
  const handleStateChange = useCallback((newState: FloorplanState, pushHistory = true, historicalSnapshot?: FloorplanState) => {
    if (currentDocument.current.activeWorkspaceId !== document.activeWorkspaceId || currentDocument.current !== document) return;
    try {
      const updated = commitWorkspaceRenderView(document, document.activeWorkspaceId, newState, pushHistory);
      if (pushHistory) {
        const snap = {view: historicalSnapshot || state, measurements: activeWorkspace.measurements, foundationAssemblies: activeWorkspace.foundationAssemblies};
        setHistory(prev => [...prev.slice(-30), snap]);
        setRedoStack([]);
      }
      currentDocument.current = updated; setDocument(updated); setIsDirty(true);
    } catch (err) { setStorageWarning(err instanceof Error ? err.message : String(err)); }
  }, [state, document, setState, activeWorkspace.measurements]);

  const handleRoofChange = useCallback((entities: RoofEntity[]): boolean => {
    if(currentDocument.current!==document || activeWorkspace.type!=='roof')return false;
    try {
      validateRoofTopology(entities);
      const updated=replaceSpecialistEntities(document,activeWorkspace.id,entities);
      setHistory(prev=>[...prev.slice(-30),{view:state,measurements:activeWorkspace.measurements,foundationAssemblies:activeWorkspace.foundationAssemblies}]);setRedoStack([]);
      currentDocument.current=updated;setDocument(updated);setIsDirty(true);setStorageWarning('');return true;
    }catch(err){setStorageWarning(err instanceof Error?err.message:String(err));return false;}
  },[document,activeWorkspace,state]);
  const handleFoundationChange = useCallback((entities:FoundationEntity[]):boolean=>{
    if(currentDocument.current!==document||activeWorkspace.type!=='foundation')return false;
    try{const updated=replaceSpecialistEntities(document,activeWorkspace.id,entities);setHistory(prev=>[...prev.slice(-30),{view:state,measurements:activeWorkspace.measurements,foundationAssemblies:activeWorkspace.foundationAssemblies}]);setRedoStack([]);currentDocument.current=updated;setDocument(updated);setIsDirty(true);setStorageWarning('');return true;}catch(err){setStorageWarning(err instanceof Error?err.message:String(err));return false;}
  },[document,activeWorkspace,state]);
  const handleAssemblyApply = (preview:AssemblyPreview):boolean => {
    if(currentDocument.current!==document||activeWorkspace.type!=='foundation')return false;
    try{
      const updated=applyAssemblyPreview(document,preview);
      if(updated===document)return false;
      setHistory(prev=>[...prev.slice(-30),{view:state,measurements:activeWorkspace.measurements,foundationAssemblies:activeWorkspace.foundationAssemblies}]);
      setRedoStack([]);currentDocument.current=updated;setDocument(updated);setIsDirty(true);setStorageWarning('');
      const parent=updated.workspaces.find(w=>w.id===activeWorkspace.id)?.foundationAssemblies?.find(a=>a.id===preview.assemblyId);
      setSelection(parent?.children.length?{type:'foundation',ids:parent.children.map(c=>c.entityId)}:{type:'none'});
      return true;
    }catch(err){setStorageWarning(err instanceof Error?err.message:String(err));return false;}
  };
  const [pendingCorrectionOutline,setPendingCorrectionOutline]=useState<{workspaceId:string;points:AssemblyTrace['vertices'][number]['point'][]}>();
  const [tracedAssemblies,setTracedAssemblies]=useState<Record<string,TracedAssembly>>({});
  const activeTrace=tracedAssemblies[activeWorkspace.id];
  const handleTracedAssembly = (...args:Parameters<typeof createTracedAssembly>) => {
    if(activeTrace)throw Error('Apply or cancel the current construction draft first.');
    const draft=createTracedAssembly(...args);
    setTracedAssemblies(old=>({...old,[activeWorkspace.id]:draft}));
    setSelection({type:'none'});
  };
  function clearTracedAssembly(){
    setTracedAssemblies(old=>{
      const {[activeWorkspace.id]:_removed,...remaining}=old;
      return remaining;
    });
  }
  const handleFoundationPresets = (presets:FoundationPreset[]):boolean => {
    if(currentDocument.current!==document)return false;
    try{
      const updated=replaceFoundationPresets(document,presets);
      currentDocument.current=updated;setDocument(updated);setIsDirty(true);setStorageWarning('');return true;
    }catch(err){setStorageWarning(err instanceof Error?err.message:String(err));return false;}
  };
  const restoreSnapshot = (snapshot:WorkspaceSnapshot) => {
    const doc=currentDocument.current;
    const next=restoreWorkspaceSnapshot(doc,doc.activeWorkspaceId,snapshot);
    currentDocument.current=next;setDocument(next);setIsDirty(true);setSelection({type:'none'});
  };
  const handleUndo = useCallback(() => {
    if (!history.length || currentDocument.current!==document) return;
    try{
      restoreSnapshot(history[history.length-1]);
      setRedoStack(prev=>[{view:state,measurements:activeWorkspace.measurements,foundationAssemblies:activeWorkspace.foundationAssemblies},...prev]);setHistory(prev=>prev.slice(0,-1));
    }catch(err){setStorageWarning(err instanceof Error?err.message:String(err))}
  },[history,state,document,activeWorkspace]);
  const handleRedo = useCallback(() => {
    if (!redoStack.length || currentDocument.current!==document) return;
    try{
      restoreSnapshot(redoStack[0]);
      setHistory(prev=>[...prev.slice(-30),{view:state,measurements:activeWorkspace.measurements,foundationAssemblies:activeWorkspace.foundationAssemblies}]);setRedoStack(prev=>prev.slice(1));
    }catch(err){setStorageWarning(err instanceof Error?err.message:String(err))}
  },[redoStack,state,document,activeWorkspace]);

  // Handle Deleting Selected CAD Element
  const handleDeleteSelected = useCallback(() => {
    if(selection.type==='foundation'&&foundationEntities){
      const ids=selection.ids??(selection.id?[selection.id]:[]);
      if(!ids.length)return;
      const selected=new Set(ids);
      const plan=planFoundationDeletion(foundationEntities,ids);
      const affected=new Set(plan.removed.map(entity=>entity.id));
      const owners=activeWorkspace.foundationAssemblies??[];
      if(owners.some(parent=>parent.children.some(child=>selected.has(child.entityId)||affected.has(child.entityId)))){
        setStorageWarning('Use Delete assembly in Foundation properties. Select independent components separately.');
        return;
      }
      if(window.confirm('Delete '+ids.length+' selected foundation components and '+plan.dependentCount+' dependent components?')&&handleFoundationChange(plan.remaining))setSelection({type:'none'});
      return;
    }
    if(selection.type==='roof'&&roofEntities){
      if(selection.ids?.length){
        try{
          const plan=planRoofDeletion(roofEntities,selection.ids);
          const count=(kind:RoofEntity['kind'])=>plan.removed.filter(e=>e.kind===kind).length;
          const message=['Delete selected roof geometry?',plan.selectedIds.length+' selected entities; '+plan.dependentIds.length+' additional dependent entities.',count('roofPlane')+' roof planes, '+count('roofEdge')+' roof edges, '+count('roofOpening')+' openings, '+count('roofSurface')+' surfaces.','Unselected independent measurements are preserved. This operation can be undone.'].join('\n');
          if(window.confirm(message)&&handleRoofChange(plan.remaining))setSelection({type:'none'});
        }catch(err){setStorageWarning(err instanceof Error?err.message:String(err));}
        return;
      }
      if(roofEntities.some(e=>(e.kind==='roofEdge'&&e.planeIds.includes(selection.id||''))||(e.kind==='roofOpening'&&e.planeId===selection.id))){setStorageWarning('Remove dependent roof edges and openings before deleting the plane.');return;}
      if(handleRoofChange(roofEntities.filter(e=>e.id!==selection.id)))setSelection({type:'none'});return;
    }
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
      // Find all walls belonging to rooms that are NOT being deleted
      const otherRooms = state.rooms.filter(r => !idSet.has(r.id));
      const preservedWallIds = new Set<string>();
      otherRooms.forEach(or => or.wallIds.forEach(wid => preservedWallIds.add(wid)));

      selectedRoomIds.forEach(roomId => {
        const room = state.rooms.find(r => r.id === roomId);
        if (room) {
          const wallsToDelete = room.wallIds.filter(wid => !preservedWallIds.has(wid));
          const wallIdSet = new Set(wallsToDelete);
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
  }, [selection, state, handleStateChange, roofEntities, handleRoofChange, foundationEntities, handleFoundationChange]);

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

  const handlePaste = useCallback((position?: { x: number, y: number }, supplied?: ClipboardState) => {
    const source = supplied || clipboard;
    if (!source) return;

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
      source.nodes.forEach(n => { sumX += n.x; sumY += n.y; count++; });
      source.stamps.forEach(s => { sumX += s.x; sumY += s.y; count++; });
      source.annotations.forEach(a => { sumX += a.x; sumY += a.y; count++; });
      
      if (count > 0) {
        dx = position.x - (sumX / count);
        dy = position.y - (sumY / count);
      }
    }

    const newNodes = source.nodes.map(n => ({
      ...n,
      id: getNewId(n.id),
      x: n.x + dx,
      y: n.y + dy,
    }));

    const newWalls = source.walls.map(w => ({
      ...w,
      id: getNewId(w.id),
      startNodeId: getNewId(w.startNodeId),
      endNodeId: getNewId(w.endNodeId),
    }));

    const newApertures = source.apertures.map(a => ({
      ...a,
      id: getNewId(a.id),
      wallId: getNewId(a.wallId),
    }));

    const newStamps = source.stamps.map(s => ({
      ...s,
      id: getNewId(s.id),
      x: s.x + dx,
      y: s.y + dy,
      parentId: s.parentId ? getNewId(s.parentId) : undefined,
    }));

    const newAnnotations = source.annotations.map(a => ({
      ...a,
      id: getNewId(a.id),
      x: a.x + dx,
      y: a.y + dy,
    }));

    const newRooms = source.rooms.map(r => ({
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
    const ids = new Set(selection.type === 'multiple' ? selection.ids || [] : selection.id ? [selection.id] : []);
    if (!ids.size) return;
    const walls = state.walls.filter(w => ids.has(w.id));
    const nodeIds = new Set(walls.flatMap(w => [w.startNodeId, w.endNodeId]));
    handlePaste(undefined, { nodes: state.nodes.filter(n => ids.has(n.id) || nodeIds.has(n.id)), walls,
      apertures: state.apertures.filter(a => walls.some(w => w.id === a.wallId)),
      stamps: state.stamps.filter(s => ids.has(s.id)), annotations: (state.annotations || []).filter(a => ids.has(a.id)),
      rooms: state.rooms.filter(r => ids.has(r.id) && r.wallIds.every(id => walls.some(w => w.id === id))) });
  }, [selection, state, handlePaste]);

  function resetWorkspaceInteraction() {
    setPendingCorrectionOutline(undefined);
    setTraceEdit(undefined);
    generation.current++;
    setWorkspaceEpoch(n => n + 1);
    setSelection({ type: 'none' }); setContextMenu(null); setClipboard(null);
    setActiveTool('select'); clearSnapSetting();
    setIsPrintModalOpen(false); setIsSettingsModalOpen(false); setIsRateModalOpen(false);
  }
  function installDocument(next: ProjectDocument, dirty: boolean, reset = true) {
    if (reset) {
      setTracedAssemblies({});
      histories.current.clear(); setHistory([]); setRedoStack([]); resetWorkspaceInteraction();
    }
    currentDocument.current = next; setDocument(next); setIsDirty(dirty);
  }
  function changeWorkspace(operation: (doc: ProjectDocument) => ProjectDocument) {
    try {
      const before = currentDocument.current;
      let next = operation(before);
      if (next === before) return;
      if (next.activeWorkspaceId !== before.activeWorkspaceId) {
        histories.current.set(before.activeWorkspaceId, { history, redo: redoStack });
        const h = histories.current.get(next.activeWorkspaceId);
        setHistory(h?.history || []); setRedoStack(h?.redo || []);
        if (activeTool === 'calibrate_scale' && previousSnapSetting) {
          next = { ...next, settings: { ...next.settings, gridSnap: previousSnapSetting.enabled, gridSnapSize: previousSnapSetting.size } };
        }
        resetWorkspaceInteraction();
      }
      for (const id of histories.current.keys()) if (!next.workspaces.some(w => w.id === id)) histories.current.delete(id);
      installDocument(next, true, false);
    } catch (err) { alert(err instanceof Error ? err.message : String(err)); }
  }
  function loadDocument(value: unknown, dirty = true) {
    const next = normalizeProjectInput(value);
    if (isDirty && !window.confirm('Replace the current unsaved project? Save or export it first if needed.')) return;
    installDocument(next, dirty);
    setIsProjectDirectoryOpen(false);
  }
  const handleLoadProjectFromDirectory = (value: unknown, name?: string) => {
    try { loadDocument(value, name === 'Auto-saved Project'); } catch (err) { alert('Unable to open project: ' + (err instanceof Error ? err.message : String(err))); }
  };

  const saveSnapshot = async (name: string, id: string) => {
    const origin = currentDocument.current;
    const token = generation.current;
    const snapshot = { ...origin, activeProjectId: id, activeProjectName: name };
    try {
      await saveProjectToDirectory(name, snapshot, { id });
      if (generation.current === token && currentDocument.current === origin) { installDocument(snapshot, false, false); clearAutoSaveState(); setRecovery(null); }
      else setStorageWarning('A snapshot was saved, but the current project changed. Save again to persist newer edits.');
    } catch (err) { alert('Project not saved: ' + (err instanceof Error ? err.message : String(err))); }
  };
  const handleSaveProjectAs = async () => {
    const name = prompt('Enter project name:', currentDocument.current.activeProjectName);
    if (name?.trim()) await saveSnapshot(name.trim(), uuidv4());
  };
  const handleSaveProject = async () => {
    const doc = currentDocument.current;
    if (doc.activeProjectId) await saveSnapshot(doc.activeProjectName, doc.activeProjectId);
    else await handleSaveProjectAs();
  };

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (recovery) return;
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
  }, [handleSaveProject, handleSaveProjectAs, recovery]);

  // Global Clipboard Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (recovery) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement || (e.target instanceof HTMLElement && e.target.isContentEditable)) {
        return;
      }

      if (e.ctrlKey || e.metaKey) {
        if((roofEntities||foundationEntities) && ['c','x','v','d'].includes(e.key.toLowerCase()))return;
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
  }, [handleCopy, handleCut, handlePaste, handleDuplicate, handleDeleteSelected, handleUndo, handleRedo, recovery, roofEntities, foundationEntities]);

  const handleNewBlankProject = async () => {
    if (isDirty && !window.confirm('Replace the current unsaved project?')) return;
    const origin = currentDocument.current;
    const token = generation.current;
    const blank = createBlankProject();
    const [settings, rates] = await Promise.all([hydrateSettingsWithBranding(blank.settings), getPersistedRateProfile()]);
    if (token !== generation.current || currentDocument.current !== origin) return;
    if (rates) { settings.costRates = rates; setMasterRates(rates); }
    installDocument(createProjectDocument({ ...blank, settings }, uuidv4()), false);
    setIsProjectDirectoryOpen(false);
  };

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

  const draftBlocksDrawing=!!activeTrace||pendingCorrectionOutline?.workspaceId===activeWorkspace.id||!!traceEdit;
  const handleToolChange = useCallback((tool: ActiveTool) => {
    if(draftBlocksDrawing&&tool!=='select'){
      setStorageWarning('Review, apply or cancel the active construction draft before starting another drawing operation.');
      return;
    }
    setTraceEdit(undefined);
    if (tool === 'calibrate_scale' && activeTool !== 'calibrate_scale') {
      saveSnapSetting({ enabled: state.settings.gridSnap, size: state.settings.gridSnapSize });
      handleUpdateSettings({ ...state.settings, gridSnap: false }, false);
    } else if (activeTool === 'calibrate_scale' && tool !== 'calibrate_scale') {
      if (previousSnapSetting) {
        handleUpdateSettings({
          ...state.settings,
          gridSnap: previousSnapSetting.enabled,
          gridSnapSize: previousSnapSetting.size
        }, false);
        clearSnapSetting();
      }
    }
    setActiveTool(tool);
    if (tool !== 'select' && tool !== 'roof_opening' && tool !== 'roof_vertex' && tool !== 'roof_generate') {
      setSelection({ type: 'none' });
    }
  }, [activeTool, draftBlocksDrawing, state.settings, handleUpdateSettings, previousSnapSetting, saveSnapSetting, clearSnapSetting]);

  // Real-Time Material Take-Off calculation
  const emptyReport = useMemo(() => calculateMTO(createBlankProject()), []);
  const mtoReport = useMemo(() => reportable ? calculateMTO(state) : emptyReport, [state, reportable, emptyReport]);


  return (
    <div className="h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden font-sans select-none" onClick={() => setContextMenu(null)}>
      <div className="flex flex-col h-full w-full">
      {/* 1. TOP HEADER BAR */}
      {recovery && <div role="dialog" aria-modal="true" aria-label="Recover previous session" className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/75 p-4"><div className="max-w-md w-full bg-slate-900 border border-slate-600 rounded-xl p-5 space-y-4"><h2 className="text-lg font-semibold">Recover previous session?</h2><p className="text-sm text-slate-300">An automatically saved project was found from your previous session.</p><div className="bg-slate-800 rounded p-3"><strong>{recovery.state?.activeProjectName || 'Recovered project'}</strong><div className="text-xs text-slate-400">{new Date(recovery.timestamp).toLocaleString()}</div></div><div className="flex flex-wrap gap-2"><button className="bg-sky-700 rounded px-3 py-2 text-sm" onClick={() => { try { const restored = normalizeProjectInput(recovery.state); installDocument(restored, true); setRecovery(null); } catch (err) { alert('Recovery failed: ' + (err instanceof Error ? err.message : String(err))); } }}>Recover project</button><button className="bg-slate-700 rounded px-3 py-2 text-sm" onClick={() => { setRecovery(null); }}>Continue with blank project</button></div><p className="text-xs text-slate-400">Continuing leaves the previous recovery record available in the Project Directory until another draft is autosaved.</p></div></div>}
      {storageWarning && <div role="alert" className="bg-amber-950 text-amber-100 px-3 py-2 text-sm">{storageWarning}</div>}
      <div className="contents" inert={!!recovery}>
      <HeaderBar
        key={workspaceEpoch}
        state={state}
        projectJson={() => serializeProjectDocument(document)}
        onLoadDocument={value => { const normalized = normalizeProjectInput(value); loadDocument({ ...normalized, activeProjectId: null }); }}
        validateBlueprint={next => validateBlueprintBudget(document, document.activeWorkspaceId, next)}
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
        onOpenPrintModal={() => reportable ? setIsPrintModalOpen(true) : alert('Project estimate and print reporting are unavailable until Increment C.')}
        onOpenProjectDirectoryModal={() => setIsProjectDirectoryOpen(true)}
        onNewProject={handleNewBlankProject}
        onSelectUnderlay={() => setSelection({ type: 'underlay', id: 'underlay_main' })}
        selection={selection}
      />

      <WorkspaceBar document={document}
        onSelect={id => changeWorkspace(doc => selectWorkspace(doc, id))}
        onAdd={(name, type) => changeWorkspace(doc => addWorkspace(doc, uuidv4(), name, type))}
        onRename={(id, name) => changeWorkspace(doc => renameWorkspace(doc, id, name))}
        onMove={(id, direction) => changeWorkspace(doc => moveWorkspace(doc, id, direction))}
        onDelete={id => changeWorkspace(doc => removeWorkspace(doc, id))}/>
      {!reportable && <div role="status" className="bg-amber-950 text-amber-100 px-3 py-1.5 text-xs">{foundationEntities?'Foundation measurement preview — raw quantities only. Consolidated pricing and reporting unavailable until C.2.':roofEntities?'Roof measurement preview — raw quantities only. Consolidated pricing and reporting unavailable until C.2.':'Workspace editing preview — consolidated project quantities and costs unavailable until C.2.'}</div>}
      {/* 2. MAIN 3-PANEL WORKSPACE */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left CAD Tool Palette */}
        {foundationEntities ? <FoundationToolbar activeTool={activeTool} draftBlocksDrawing={draftBlocksDrawing} onSelectTool={tool=>{
          if(tool==='foundation_slab'){setSlabMode('rectangle');setStandardSlab(false);}
          handleToolChange(tool);
        }} onStandardSlab={mode=>{setStandardSlab(true);setSlabMode(mode);handleToolChange('foundation_slab')}}/> : roofEntities ? <RoofToolbar activeTool={activeTool} onSelectTool={handleToolChange}/> : <Toolbar
          activeTool={activeTool}
          onSelectTool={handleToolChange}
          activeWallPreset={activeWallPreset}
          onSelectWallPreset={setActiveWallPreset}
        />}

        {/* Center Interactive 2D CAD Canvas */}
        <CadCanvas
          key={workspaceEpoch}
          foundationEntities={foundationEntities}
          foundationPreview={foundationGhost?.workspaceId===activeWorkspace.id&&foundationGhost.source===foundationEntities?foundationGhost.members:undefined}
          foundationFilter={visibleFoundationKind}
          slabMode={slabMode}
          standardSlab={standardSlab}
          onFoundationChange={handleFoundationChange}
          onConfigureTracedAssembly={handleTracedAssembly}
          assemblyDraftOutline={activeTrace?.input.trace.vertices.map(v=>v.point)??(pendingCorrectionOutline?.workspaceId===activeWorkspace.id?pendingCorrectionOutline.points:undefined)}
          traceCorrection={traceEdit?.document===document?traceEdit:undefined}
          roofEntities={roofEntities}
          onRoofChange={handleRoofChange}
          commitDraftPlacement={commitDraftPlacement}
          state={state}
          onChange={handleStateChange}
          activeTool={activeTool}
          onToolChange={handleToolChange}
          selection={selection}
          onSelect={setSelection}
          onDeleteSelected={handleDeleteSelected}
          activeWallPreset={activeWallPreset}
          onContextMenu={roofEntities||foundationEntities ? undefined : (e, worldPos) => {
            setContextMenu({
              x: e.clientX,
              y: e.clientY,
              worldX: worldPos.x,
              worldY: worldPos.y
            });
          }}
        />

        {foundationEntities && <FoundationInspector assemblies={activeWorkspace.foundationAssemblies} activeConstructionDraft={!!activeTrace} ownedComponentIds={new Set(activeWorkspace.foundationAssemblies?.flatMap(parent=>parent.children.map(child=>child.entityId)))} assemblyControls={<FoundationAssemblyPanel project={document} workspaceId={activeWorkspace.id} traced={activeTrace} onCancelTrace={clearTracedAssembly}
          onDraftChange={draft=>setTracedAssemblies(old=>({...old,[activeWorkspace.id]:draft}))}
          selectedIds={selection.type==='foundation'?selection.ids:undefined} selectedId={selection.type==='foundation'?(selection.id??selection.ids?.[0]):undefined} metric={state.settings.unitSystem==='metric'}
          onTraceEdit={(trace,onMove)=>{
            setActiveTool('select');
            setTraceEdit(trace&&onMove?{document,trace,onMove:(index,point)=>{setTraceEdit(undefined);onMove(index,point)}}:undefined);
          }} onApply={handleAssemblyApply} onPresets={handleFoundationPresets} onPreview={(members,outline)=>{
            setPendingCorrectionOutline(outline?{workspaceId:activeWorkspace.id,points:outline}:undefined);
            setFoundationGhost(members?{workspaceId:activeWorkspace.id,source:foundationEntities,members}:null);
          }}
          onSelectChildren={ids=>setSelection(ids.length?{type:'foundation',ids}:{type:'none'})}/>} metric={state.settings.unitSystem==='metric'} key={activeWorkspace.id} onPreview={members=>setFoundationGhost(members?{workspaceId:activeWorkspace.id,source:foundationEntities,members}:null)} filter={visibleFoundationKind} onFilter={kind=>{setFoundationFilter({workspaceId:activeWorkspace.id,kind});setSelection({type:'none'})}} workspaceId={activeWorkspace.id} entities={foundationEntities} selection={selection} onChange={handleFoundationChange} onSelect={setSelection} onDelete={handleDeleteSelected}/>}
        {roofEntities && <RoofInspector workspaceId={activeWorkspace.id} entities={roofEntities} selection={selection} onChange={handleRoofChange} onSelect={setSelection} onDelete={handleDeleteSelected}/>}
        {/* Right Real-time MTO Take-Off Matrix */}
        {reportable && <MtoMatrixPanel
          state={state}
          mto={mtoReport}
          costRates={costRates}
          onOpenRateModal={() => setIsRateModalOpen(true)}
          onOpenPrintModal={() => setIsPrintModalOpen(true)}
          onOpenSettingsModal={() => setIsSettingsModalOpen(true)}
          onToggleCategoryInclusion={handleToggleCategoryInclusion}
          onToggleItemInclusion={handleToggleItemInclusion}
          onToggleCalculationMode={handleToggleCalculationMode}
        />}

        {/* Floating Context Inspector for selected item */}
          {selection.type!=='roof' && selection.type!=='foundation' && <InspectorPanel
            state={state}
            onChange={handleStateChange}
            selection={selection}
            onClose={() => setSelection({ type: 'none' })}
            onDelete={handleDeleteSelected}
            onToolChange={handleToolChange}
          />}
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
        isOpen={reportable && isPrintModalOpen}
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
        currentState={document}
        onLoadProject={handleLoadProjectFromDirectory}
        onNewBlankProject={handleNewBlankProject}
      />
      </div>
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
