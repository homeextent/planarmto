import {previewFoundationGeneration} from '../engine/measurements/foundationGeneration';
import {nearestFoundationSnap} from '../engine/measurements/foundationSnap';
import {measureFoundation} from '../engine/measurements/foundationMeasurements';
import type {RectangleReference} from '../engine/measurements/foundationGeometry';
import {roofWindowSelection} from '../engine/measurements/roofSelection';
import { v4 as uuidv4 } from 'uuid';
import {foundationWindowSelection} from '../engine/measurements/foundationSelection';
import {foundationArea,foundationPoints,foundationFootprint,foundationDetailOutlines,createFoundationDraft,createReferencedWall,generateOrthogonalFoundationPerimeter,type WallDraftReference} from '../engine/measurements/foundationDrafting';
import type { RoofEntity, FoundationEntity, SpecialistEntity } from '../engine/measurements/measurementTypes';
import { generateRectangularRoof, type RoofConfig } from '../engine/measurements/roofGenerator';
import { validateRoofTopology, polygonDraftError } from '../engine/measurements/roofMeasurements';
import { parseDimension, exactEndpoint, exactRectangleCorner, rectanglePoints, orthoPoint, resizeRectangle } from '../engine/precisionDrafting';
import { roofPoints, roofSnap, type RoofSnap, boundaryAt, moveRoofVertex, segmentDistance } from '../engine/measurements/roofEditing';
import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import {
  FloorplanState,
  ActiveTool,
  SelectionState,
  CadNode,
  CadWall,
  Aperture,
  CadStamp,
  CadAnnotation,
  RoomPolygon,
  DeckArea,
  HardscapeArea,
  WallPreset,
} from '../types';
import {
  Point2D,
  distance,
  snapPointToGrid,
  snapAngle,
  projectPointOntoSegment,
  getWallGeometry,
  getApertureGeometry,
  detectRoomFaces,
  calculatePolygonCentroid,
  isPointInPolygon,
  convertInputToCenterlineNodes,
  getNetInteriorPolygon,
  calculateSignedPolygonArea,
  getWallThickness,
  calculateMultiCornerSnap,
  mergeCoincidentNodes,
  deduplicateWalls,
  partitionCrossingWalls,
  computeDeckLedger,
} from '../engine/cadMath';
import { getRoomCategory } from '../engine/roomCategories';
import { DEFAULT_WINDOW_WIDTH, DEFAULT_WINDOW_HEIGHT } from '../constants/stamps';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Grid,
  Magnet,
  Compass,
  RotateCw,
  Trash2,
  Pin,
  PinOff,
  Type,
  FileText,
} from 'lucide-react';

import { useProject } from '../context/ProjectContext';

interface CadCanvasProps {
  foundationEntities?: FoundationEntity[];
  foundationPreview?: FoundationEntity[];
  foundationFilter?: string;
  onFoundationChange?: (entities:FoundationEntity[])=>boolean;
  roofEntities?: RoofEntity[];
  commitDraftPlacement?: (token:string,next:FloorplanState|SpecialistEntity[],replace?:boolean)=>boolean;
  onRoofChange?: (entities: RoofEntity[]) => boolean;
  state: FloorplanState;
  onChange: (newState: FloorplanState, pushHistory?: boolean, historicalSnapshot?: FloorplanState) => void;
  activeTool: ActiveTool;
  onToolChange: (tool: ActiveTool) => void;
  selection: SelectionState;
  onSelect: (selection: SelectionState) => void;
  onDeleteSelected: () => void;
  activeWallPreset: WallPreset;
  onContextMenu?: (e: React.MouseEvent, worldPos: Point2D) => void;
}

// Map Wall Preset to default drafting properties
const getWallPropertiesFromPreset = (preset: WallPreset) => {
  switch (preset) {
    case 'interior_2x4':
      return {
        thickness: 3.5 / 12,
        wallType: 'interior_2x4' as const,
        finishExterior: 'none' as const,
      };
    case 'exterior_2x6':
      return {
        thickness: 6.5 / 12,
        wallType: 'exterior_2x6' as const,
        finishExterior: 'vinyl_siding' as const,
      };
    case 'foundation_10':
      return {
        thickness: 10 / 12,
        wallType: 'foundation_wall' as const,
        finishExterior: 'none' as const,
      };
    default:
      return {
        thickness: 4.5 / 12,
        wallType: 'interior_2x4' as const,
        finishExterior: 'none' as const,
      };
  }
};

// Helper to split a wall at a given point (for T-junctions and perimeter subdivision)
function splitWallAtPoint(
  targetWallId: string,
  splitPoint: Point2D,
  currentNodes: CadNode[],
  currentWalls: CadWall[],
  currentApertures: Aperture[]
): {
  nodes: CadNode[];
  walls: CadWall[];
  apertures: Aperture[];
  splitNodeId: string;
} {
  const wall = currentWalls.find((w) => w.id === targetWallId);
  const n1 = wall ? currentNodes.find((n) => n.id === wall.startNodeId) : null;
  const n2 = wall ? currentNodes.find((n) => n.id === wall.endNodeId) : null;

  if (!wall || !n1 || !n2) {
    const fallbackNode: CadNode = {
      id: `node_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      x: splitPoint.x,
      y: splitPoint.y,
    };
    return {
      nodes: [...currentNodes, fallbackNode],
      walls: currentWalls,
      apertures: currentApertures,
      splitNodeId: fallbackNode.id,
    };
  }

  const splitNode: CadNode = {
    id: `node_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    x: Math.round(splitPoint.x * 100) / 100,
    y: Math.round(splitPoint.y * 100) / 100,
  };

  const w1: CadWall = {
    ...wall,
    id: `wall_${Date.now()}_1`,
    startNodeId: wall.startNodeId,
    endNodeId: splitNode.id,
  };

  const w2: CadWall = {
    ...wall,
    id: `wall_${Date.now()}_2`,
    startNodeId: splitNode.id,
    endNodeId: wall.endNodeId,
  };

  const splitDist = distance(n1, splitNode);

  const updatedApertures = currentApertures.map((ap) => {
    if (ap.wallId !== wall.id) return ap;
    if (ap.offset < splitDist) {
      return { ...ap, wallId: w1.id };
    } else {
      return { ...ap, wallId: w2.id, offset: Math.max(0.5, ap.offset - splitDist) };
    }
  });

  const updatedWalls = currentWalls.filter((w) => w.id !== wall.id).concat([w1, w2]);
  const updatedNodes = [...currentNodes, splitNode];

  return {
    nodes: updatedNodes,
    walls: updatedWalls,
    apertures: updatedApertures,
    splitNodeId: splitNode.id,
  };
}

// Define constants for sticky OSNAP hysteresis
const SNAP_CAPTURE_RADIUS_PX = 15;
const SNAP_BREAKOUT_RADIUS_PX = 30;

export const CadCanvas: React.FC<CadCanvasProps> = ({
  state,
  onChange,
  activeTool,
  onToolChange,
  selection,
  onSelect,
  onDeleteSelected,
  activeWallPreset,
  onContextMenu,
  foundationEntities,
  foundationPreview,
  foundationFilter='all',
  onFoundationChange,
  roofEntities,
  onRoofChange,
  commitDraftPlacement,
}) => {
  const placementHandler=useRef(commitDraftPlacement);placementHandler.current=commitDraftPlacement;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const visibleFoundation=useMemo(()=>foundationEntities?.filter(e=>foundationFilter==='all'||(e.kind==='foundationLine'||e.kind==='foundationRegion'?e.kind+':'+e.purpose:e.kind)===foundationFilter),[foundationEntities,foundationFilter]);
  const [wallReference,setWallReference]=useState<WallDraftReference>('centreline');
  const [wallReferenceWidth,setWallReferenceWidth]=useState('');
  const [foundationMode,setFoundationMode]=useState<'rectangle'|'polygon'>('rectangle');
  const [foundationVertices,setFoundationVertices]=useState<Point2D[]>([]);
  const [foundationStart,setFoundationStart]=useState<Point2D|null>(null);
  const [foundationContinuous,setFoundationContinuous]=useState(false);
  const [foundationCursor,setFoundationCursor]=useState<Point2D|null>(null);
  const [perimeterOutline,setPerimeterOutline]=useState<Point2D[]|null>(null);
  const [perimeterReference,setPerimeterReference]=useState<RectangleReference>('exterior');
  const [perimeterWidth,setPerimeterWidth]=useState('');
  const [perimeterHeight,setPerimeterHeight]=useState('');
  const [perimeterBase,setPerimeterBase]=useState('');
  const [perimeterCandidate,setPerimeterCandidate]=useState<{source:FoundationEntity[];members:FoundationEntity[];volume:number}|null>(null);
  const [perimeterError,setPerimeterError]=useState('');
  const validPerimeterCandidate=perimeterCandidate?.source===foundationEntities?perimeterCandidate:null;
  useEffect(()=>{setFoundationStart(null);setFoundationCursor(null);setFoundationVertices([]);setPerimeterOutline(null);setPerimeterCandidate(null);setPerimeterError('')},[activeTool,foundationMode]);
  useEffect(()=>{if(perimeterCandidate&&perimeterCandidate.source!==foundationEntities){setPerimeterCandidate(null);setPerimeterError('Foundation changed; preview again.')}},[foundationEntities,perimeterCandidate]);
  const [roofDraft, setRoofDraft] = useState<Point2D[]>([]);
  const [roofCursor, setRoofCursor] = useState<Point2D | null>(null);
  const [generationSource,setGenerationSource]=useState<RoofEntity|null>(null);
  const [polygonError,setPolygonError]=useState('');
  const [generationOutline,setGenerationOutline]=useState<Point2D[]|null>(null);
  const [generationConfig,setGenerationConfig]=useState<RoofConfig>({type:'hip',pitch:6,direction:90,ridge:'horizontal'});
  const [generationPreview,setGenerationPreview]=useState<RoofEntity[]|null>(null);
  const [generationError,setGenerationError]=useState('');
  const [roofMode,setRoofMode]=useState<'rectangle'|'polygon'>('rectangle');
  const [roofTarget,setRoofTarget]=useState<RoofSnap|null>(null);
  const roofLock=useRef<RoofSnap|null>(null);
  const [dimensionA,setDimensionA]=useState('');
  const [recent,setRecent]=useState<{token:string;start:Point2D;toward:Point2D;rectangle:boolean;correct:(end:Point2D)=>void}|null>(null);
  const recentRef=useRef<typeof recent>(null);
  const setCorrection=(next:typeof recent)=>{recentRef.current=next;setRecent(next);};
  const dimensionCommand=useRef<(value:string)=>void>(()=>{});
  const draftDirection=useRef<Point2D|null>(null);
  const [dimensionError,setDimensionError]=useState('');
  const [roofVertex, setRoofVertex] = useState<number | null>(null);
  useEffect(() => { setRoofDraft([]); setRoofCursor(null); setRoofVertex(null); setRoofTarget(null); roofLock.current=null; setDimensionA(''); draftDirection.current=null; setDimensionError(''); setGenerationOutline(null);setGenerationSource(null);setGenerationPreview(null);setGenerationError('');setPolygonError('');
    if(activeTool==='roof_generate'&&selection.type==='roof'){
      const selected=roofEntities?.find(e=>e.id===selection.id);
      if(selected){
        try{
          if(selected.kind!=='roofPlane')throw Error('Select a rectangular roof plane, or clear selection to draw a new outline.');
          const p=selected.polygon;
          try { resizeRectangle(p,Math.abs(p[2]?.x-p[0]?.x),Math.abs(p[2]?.y-p[0]?.y)); }
          catch { throw Error('Automatic roof skeleton generation requires a rectangular outline. For irregular roofs, draft individual roof planes and classify their boundaries manually.'); }
          if(roofEntities?.some(e=>(e.kind==='roofEdge'&&e.planeIds.includes(selected.id))||(e.kind==='roofOpening'&&e.planeId===selected.id)))throw Error('Selected roof plane has dependent edges or openings. Review those dependencies before replacement.');
          setGenerationOutline(p);setGenerationSource(selected);
          setGenerationConfig(c=>({...c,pitch:selected.pitchRise??0,type:selected.pitchRise===0?'flat':c.type==='flat'?'hip':c.type}));
        }catch(err){setGenerationError(err instanceof Error?err.message:String(err));}
      }
    }
  }, [activeTool, selection.id, roofMode]);
  // Sticky lock for OSNAP with hysteresis
  const lockedSnapNodeRef = useRef<{ id: string; x: number; y: number } | null>(null);

  // Viewport transformation: scale (pixels per foot) and offset (in pixels)
  const [transform, setTransform] = useState<{ scale: number; x: number; y: number }>({
    scale: 24, // 24px = 1ft by default
    x: 180,
    y: 140,
  });

  // Sticky Continuous Placement Mode (keeps tool active after drop for sequential stamping/placing)
  const [isStickyMode, setIsStickyMode] = useState<boolean>(true);

  // Interaction tracking state
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<Point2D>({ x: 0, y: 0 });
  const [hasMovedDuringDrag, setHasMovedDuringDrag] = useState(false);
  const [pendingSelectionOnMouseUp, setPendingSelectionOnMouseUp] = useState<SelectionState | null>(null);

  // Drafting wall sequence
  const [activeWallStartNodeId, setActiveWallStartNodeId] = useState<string | null>(null);
  const [pendingWallStart,setPendingWallStart]=useState<CadNode|null>(null);
  const pendingStartWall=useRef<string|undefined>(undefined);
  const pendingStartState=useRef<FloorplanState|null>(null);
  useEffect(()=>{
    if(activeTool!=='wall_pen'){setPendingWallStart(null);setActiveWallStartNodeId(null);pendingStartWall.current=undefined;pendingStartState.current=null;}
    if(activeTool!=='select'&&activeTool!=='wall_pen')setCorrection(null);
  },[activeTool]);
  const [draftMousePos, setDraftMousePos] = useState<Point2D | null>(null);
  const [snapCandidate, setSnapCandidate] = useState<{
    point: Point2D;
    type: 'node' | 'grid' | 'wall';
    nodeId?: string;
    wallId?: string;
  } | null>(null);

  // Dragging selected elements
  const [isDraggingElement, setIsDraggingElement] = useState(false);
  const dragInitialStateRef = useRef<FloorplanState | null>(null);
  const [dragStartPoint, setDragStartPoint] = useState<Point2D>({ x: 0, y: 0 });
  const [activeDragAnchorNodeId, setActiveDragAnchorNodeId] = useState<string | null>(null);
  const [roomSnapFeedback, setRoomSnapFeedback] = useState<{
    movingNode: Point2D;
    targetNode: Point2D;
    type: 'node' | 'wall';
  } | null>(null);

  // Rectangle room drafting
  const [roomBoxStart, setRoomBoxStart] = useState<Point2D | null>(null);

  // Marquee selection state
  const [marqueeStart, setMarqueeStart] = useState<Point2D | null>(null);
  const [marqueeEnd, setMarqueeEnd] = useState<Point2D | null>(null);
  const foundationDrag=useRef<{start:Point2D;screen:Point2D;hitId?:string;shift:boolean}|null>(null);
  const [foundationMarquee,setFoundationMarquee]=useState<{start:Point2D;end:Point2D}|null>(null);
  const clearFoundationDrag=()=>{foundationDrag.current=null;setFoundationMarquee(null);};
  useEffect(()=>{clearFoundationDrag()},[activeTool,foundationEntities,foundationFilter]);
  const roofDrag=useRef<{start:Point2D;screen:Point2D;hitId?:string;shift:boolean}|null>(null);
  const [roofMarquee,setRoofMarquee]=useState<{start:Point2D;end:Point2D}|null>(null);
  const clearRoofDrag=()=>{roofDrag.current=null;setRoofMarquee(null);};
  useEffect(()=>{clearRoofDrag();},[activeTool,roofEntities]);
  const selectRoofIds=(ids:string[])=>onSelect(ids.length===0?{type:'none'}:ids.length===1?{type:'roof',id:ids[0]}:{type:'roof',ids});
  const roofSelectionIds=():string[]=>selection.type==='roof'?(selection.ids??(selection.id?[selection.id]:[])):[];


  // Underlay interaction state
  const [isHoveringUnderlay, setIsHoveringUnderlay] = useState(false);

  // Calibration tool state
  const [calibrationPoints, setCalibrationPoints] = useState<Point2D[]>([]);

  // Track last project and underlay to detect "Load" or "Import" events
  const lastProjectId = useRef<string | undefined>(undefined);
  const lastUnderlayId = useRef<string | undefined>(state.underlay?.id);
  const lastUnderlayCenterTrigger = useRef<number | undefined>(state.underlay?.lastCenteredAt);

  // Underlay image cache ref
  const underlayImageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const imageSrc = state.underlay?.src || state.underlay?.url;
    if (!imageSrc) {
      underlayImageRef.current = null;
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageSrc;
    img.onload = () => {
      underlayImageRef.current = img;
      // Force canvas re-render frame
      requestAnimationFrame(renderCanvas);
    };
  }, [state.underlay?.src, state.underlay?.url]);

  // Measurement ruler drafting
  const [rulerPoints, setRulerPoints] = useState<Point2D[]>([]);
  const [rulerStart, setRulerStart] = useState<Point2D | null>(null);
  const [rulerEnd, setRulerEnd] = useState<Point2D | null>(null);
  
  // Expose ruler reset via state
  useEffect(() => {
    if (state.nodes.length === 0 && state.walls.length === 0 && state.stamps.length === 0 && (state.annotations || []).length === 0) {
      setRulerPoints([]);
      setRulerStart(null);
      setRulerEnd(null);
    }
  }, [state]);

  // Screen to World coordinates (world is in feet)
  const screenToWorld = useCallback(
    (screenX: number, screenY: number): Point2D => {
      return {
        x: (screenX - transform.x) / transform.scale,
        y: (screenY - transform.y) / transform.scale,
      };
    },
    [transform]
  );

  // World to Screen coordinates
  const worldToScreen = useCallback(
    (worldX: number, worldY: number): Point2D => {
      return {
        x: worldX * transform.scale + transform.x,
        y: worldY * transform.scale + transform.y,
      };
    },
    [transform]
  );

  // Format length according to unit system
  const formatLength = useCallback(
    (feet: number): string => {
      if (state.settings.unitSystem === 'metric') {
        const meters = feet * 0.3048;
        return `${meters.toFixed(2)} m`;
      }
      const totalInches = feet * 12;
      const ft = Math.floor(totalInches / 12);
      const inches = Math.round(totalInches % 12);
      
      // Handle rounding overflow (e.g. 11.6 inches -> 12 inches -> 1'-0")
      if (inches === 12) {
        return `${ft + 1}'-0"`;
      }
      return `${ft}'-${inches}"`;
    },
    [state.settings.unitSystem]
  );

  // Find nearest snap point (node snap has highest priority, then grid snap)
  const getSmartSnapPoint = useCallback(
    (rawWorld: Point2D, excludeNodeId?: string | null) => {
      // Step 3: Calibration Mode Override
      if (activeTool === 'calibrate_scale') {
        return {
          point: { x: rawWorld.x, y: rawWorld.y },
          type: 'grid' as const,
        };
      }

      const isSnapEnabled = state.settings.gridSnap;
      const isDrawingTool = activeTool === 'wall_pen' || activeTool === 'wall_rect' || activeTool === 'room_box' || activeTool.startsWith('aperture_') || activeTool.startsWith('stamp_') || activeTool === 'alarm_smoke_co' || activeTool === 'ruler_measure';
      
      // Step 1: Check Node / Endpoint Snap (OSNAP) with Sticky Hysteresis
      // Case A: Currently Locked to a Node
      if (lockedSnapNodeRef.current && isDrawingTool) {
        const locked = lockedSnapNodeRef.current;
        if (excludeNodeId && locked.id === excludeNodeId) {
          lockedSnapNodeRef.current = null;
        } else {
          const distPx = distance(rawWorld, locked) * transform.scale;
          if (distPx <= SNAP_BREAKOUT_RADIUS_PX) {
            return {
              point: { x: locked.x, y: locked.y },
              type: 'node' as const,
              nodeId: locked.id,
            };
          } else {
            // Break breakout lock
            lockedSnapNodeRef.current = null;
          }
        }
      }

      // Tolerance: SNAP_CAPTURE_RADIUS_PX converted to feet based on current zoom scale
      const snapRadius = SNAP_CAPTURE_RADIUS_PX / transform.scale;
      
      let nearestNode: CadNode | null = null;
      let minNodeDist = snapRadius;

      state.nodes.forEach((n: CadNode) => {
        if (excludeNodeId && n.id === excludeNodeId) return;
        const d = distance(rawWorld, n);
        if (d < minNodeDist) {
          minNodeDist = d;
          nearestNode = n;
        }
      });

      if (nearestNode) {
        const n = nearestNode as CadNode;
        // Case B: Not Currently Locked -> Capture
        if (isDrawingTool) {
          lockedSnapNodeRef.current = { id: n.id, x: n.x, y: n.y };
        }
        return {
          point: { x: n.x, y: n.y },
          type: 'node' as const,
          nodeId: n.id,
        };
      }

      // Check wall centerline snap (OSNAP variant)
      const nodeMap = new Map<string, CadNode>();
      state.nodes.forEach((n: CadNode) => nodeMap.set(n.id, n));

      let nearestWallProj: { point: Point2D; wallId: string } | null = null;
      let minWallDist = snapRadius * 0.75; 

      state.walls.forEach((w: CadWall) => {
        const n1 = nodeMap.get(w.startNodeId);
        const n2 = nodeMap.get(w.endNodeId);
        if (!n1 || !n2) return;
        const proj = projectPointOntoSegment(rawWorld, n1, n2);
        if (proj.distance < minWallDist && proj.t > 0.05 && proj.t < 0.95) {
          minWallDist = proj.distance;
          nearestWallProj = { point: proj.point, wallId: w.id };
        }
      });

      if (nearestWallProj) {
        const p = nearestWallProj as { point: Point2D; wallId: string };
        return {
          point: p.point,
          type: 'wall' as const,
          wallId: p.wallId,
        };
      }

      // Step 2: Check Grid Snap
      if (isSnapEnabled) {
        const gridSnapped = snapPointToGrid(rawWorld, state.settings.gridSnapSize);
        return {
          point: gridSnapped,
          type: 'grid' as const,
        };
      }

      // Fallback: No grid snap, and no OSNAP found
      return {
        point: { x: rawWorld.x, y: rawWorld.y },
        type: 'grid' as const,
      };
    },
    [state.nodes, state.walls, state.settings.gridSnapSize, state.settings.gridSnap, activeTool, transform.scale]
  );

  // Unified drafting point computation: harmonizes angle constraints and OSNAP for mousemove & mousedown
  const computeDraftPoint = useCallback(
    (rawWorld: Point2D, startNodeId: string | null) => {
      const startNode = startNodeId ? state.nodes.find((n) => n.id === startNodeId) || (pendingWallStart?.id===startNodeId?pendingWallStart:null) : null;
      let angleConstrained = rawWorld;
      if (startNode) {
        angleConstrained = snapAngle(startNode, rawWorld, state.settings.angleSnapIncrement, state.settings.orthoMode);
        if (state.settings.orthoMode) {
          if (Math.abs(angleConstrained.x - startNode.x) >= Math.abs(angleConstrained.y - startNode.y)) {
            angleConstrained.y = startNode.y;
          } else {
            angleConstrained.x = startNode.x;
          }
        }
      }

      const snapResult = getSmartSnapPoint(angleConstrained, startNodeId);
      if (snapResult.type === 'node') {
        return snapResult;
      }

      if (startNode && state.settings.orthoMode) {
        if (snapResult.type === 'wall') {
          return snapResult;
        }
        const snapInc = state.settings.gridSnapSize || 0.5;
        const isSnapEnabled = state.settings.gridSnap;
        let orthoPoint = { ...angleConstrained };
        if (isSnapEnabled) {
          if (Math.abs(orthoPoint.y - startNode.y) < 0.001) {
            orthoPoint.x = Math.round(orthoPoint.x / snapInc) * snapInc;
            orthoPoint.y = startNode.y;
          } else {
            orthoPoint.x = startNode.x;
            orthoPoint.y = Math.round(orthoPoint.y / snapInc) * snapInc;
          }
        }
        return {
          point: orthoPoint,
          type: isSnapEnabled ? ('grid' as const) : ('none' as const),
        };
      }

      return snapResult;
    },
    [state.nodes, pendingWallStart, state.settings.angleSnapIncrement, state.settings.orthoMode, state.settings.gridSnapSize, state.settings.gridSnap, getSmartSnapPoint]
  );

  // Zoom controls
  const handleZoom = useCallback((factor: number, centerX?: number, centerY?: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const cx = centerX ?? canvas.width / 2;
    const cy = centerY ?? canvas.height / 2;

    setTransform((prev) => {
      const newScale = Math.max(6, Math.min(120, prev.scale * factor));
      const newX = cx - (cx - prev.x) * (newScale / prev.scale);
      const newY = cy - (cy - prev.y) * (newScale / prev.scale);
      return { scale: newScale, x: newX, y: newY };
    });
  }, []);

  const handleZoomFit = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const entity of roofEntities || []) for (const p of roofPoints(entity)) {
      minX = Math.min(minX,p.x); maxX = Math.max(maxX,p.x); minY = Math.min(minY,p.y); maxY = Math.max(maxY,p.y);
    }
    for(const entity of visibleFoundation||[])for(const p of foundationFootprint(entity)??foundationPoints(entity)){minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);minY=Math.min(minY,p.y);maxY=Math.max(maxY,p.y);}
    // Include nodes in bounding box
    if (state.nodes.length > 0) {
      state.nodes.forEach((n) => {
        minX = Math.min(minX, n.x);
        maxX = Math.max(maxX, n.x);
        minY = Math.min(minY, n.y);
        maxY = Math.max(maxY, n.y);
      });
    }

    // Include underlay in bounding box if it exists and is visible
    if (state.underlay && state.underlay.isVisible && underlayImageRef.current) {
      const uw = underlayImageRef.current.naturalWidth * state.underlay.feetPerPixel;
      const uh = underlayImageRef.current.naturalHeight * state.underlay.feetPerPixel;
      minX = Math.min(minX, state.underlay.worldX);
      maxX = Math.max(maxX, state.underlay.worldX + uw);
      minY = Math.min(minY, state.underlay.worldY);
      maxY = Math.max(maxY, state.underlay.worldY + uh);
    }

    // If still nothing found, use default view
    if (minX === Infinity) {
      setTransform({ scale: 24, x: 200, y: 150 });
      return;
    }

    const pad = 6; // 6ft padding
    minX -= pad;
    maxX += pad;
    minY -= pad;
    maxY += pad;

    const widthFt = Math.max(10, maxX - minX);
    const heightFt = Math.max(10, maxY - minY);

    const scaleX = canvas.clientWidth / widthFt;
    const scaleY = canvas.clientHeight / heightFt;
    const newScale = Math.max(10, Math.min(60, Math.min(scaleX, scaleY) * 0.85));

    const centerFtX = (minX + maxX) / 2;
    const centerFtY = (minY + maxY) / 2;

    const newX = canvas.clientWidth / 2 - centerFtX * newScale;
    const newY = canvas.clientHeight / 2 - centerFtY * newScale;

    setTransform({ scale: newScale, x: newX, y: newY });
  };

  // 1. Auto-Fit Viewport on Project Load or Switch
  useEffect(() => {
    if (state.activeProjectId !== lastProjectId.current) {
      lastProjectId.current = state.activeProjectId;
      // Fit the committed workspace before the browser can accept drawing input.
      // A delayed fit can move an already placed transient vertex under the pointer.
      handleZoomFit();
    }
  }, [state.activeProjectId]);

  // 2. Auto-Zoom-Fit on new underlay import (WITHOUT overwriting feetPerPixel)
  useEffect(() => {
    const underlay = state.underlay;
    const source = underlay?.src || underlay?.url;
    if (source && source !== lastUnderlayId.current) {
      lastUnderlayId.current = source;
      setTimeout(handleZoomFit, 100);
    }
  }, [state.underlay?.src, state.underlay?.url]);

  // Prevent default for wheel and touchmove events (passive event listener fix)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const clientX = e.clientX - rect.left;
      const clientY = e.clientY - rect.top;

      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
      handleZoom(zoomFactor, clientX, clientY);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    };

    container.addEventListener('wheel', onWheel, { passive: false });
    container.addEventListener('touchmove', onTouchMove, { passive: false });

    return () => {
      container.removeEventListener('wheel', onWheel);
      container.removeEventListener('touchmove', onTouchMove);
    };
  }, [handleZoom]);

  // Keyboard shortcut listener (Delete, Escape, Space)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement || (e.target instanceof HTMLElement && e.target.isContentEditable)) return;
      if(e.defaultPrevented)return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (roofEntities||foundationEntities) return; // App owns specialist deletion.
        if (selection.type !== 'none') {
          e.preventDefault();
          onDeleteSelected();
        }
      } else if (e.key === 'Escape') {
        setCorrection(null);setPendingWallStart(null);pendingStartWall.current=undefined;pendingStartState.current=null;
        clearFoundationDrag();clearRoofDrag();setRoofDraft([]); setRoofCursor(null); setRoofVertex(null);
        setActiveWallStartNodeId(null);
        setDraftMousePos(null);
        setRoomBoxStart(null);
        setRulerStart(null);
        setRulerEnd(null);
        lockedSnapNodeRef.current = null;
        onSelect({ type: 'none' });
        onToolChange('select');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selection, onDeleteSelected, onSelect, onToolChange, roofEntities, foundationEntities]);

  // Main rendering function
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high DPI
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
    }

    ctx.save();
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;

    // Background & Theme styling
    const theme = state.settings.theme || 'dark';
    let bgCol = '#090d16';
    let minorGridCol = 'rgba(255, 255, 255, 0.04)';
    let majorGridCol = 'rgba(255, 255, 255, 0.09)';
    let wallOutlineCol = '#334155';
    let wallExtCol = '#475569';
    let textPrimaryCol = '#e2e8f0';
    let textDimCol = '#94a3b8';

    if (theme === 'light') {
      bgCol = '#f8fafc';
      minorGridCol = 'rgba(0, 0, 0, 0.06)';
      majorGridCol = 'rgba(0, 0, 0, 0.14)';
      wallOutlineCol = '#94a3b8';
      wallExtCol = '#64748b';
      textPrimaryCol = '#0f172a';
      textDimCol = '#475569';
    } else if (theme === 'blueprint') {
      bgCol = '#0b2545';
      minorGridCol = 'rgba(255, 255, 255, 0.08)';
      majorGridCol = 'rgba(255, 255, 255, 0.2)';
      wallOutlineCol = '#134074';
      wallExtCol = '#8da9c4';
      textPrimaryCol = '#ffffff';
      textDimCol = '#cbd5e1';
    }

    ctx.fillStyle = bgCol;
    ctx.fillRect(0, 0, width, height);

    const { scale, x: panX, y: panY } = transform;

    const isEntitySelected = (type: string, id: string) => {
      if (selection.type === type && selection.id === id) return true;
      if (selection.type === 'multiple' && selection.ids?.includes(id)) return true;
      return false;
    };

    // --- DRAW UNDERLAY IMAGE (BLUEPRINT) ---
    const underlay = state.underlay;
    const img = underlayImageRef.current;
    if (underlay && underlay.isVisible && img && img.complete && img.naturalWidth !== 0) {
      ctx.save();
      const feetPerPixel = underlay.feetPerPixel || 0.05;
      const screenPos = worldToScreen(underlay.worldX || 0, underlay.worldY || 0);
      const renderWidth = img.naturalWidth * feetPerPixel * scale;
      const renderHeight = img.naturalHeight * feetPerPixel * scale;

      // Draw Image
      ctx.globalAlpha = underlay.opacity ?? 0.7;
      ctx.drawImage(img, screenPos.x, screenPos.y, renderWidth, renderHeight);
      ctx.globalAlpha = 1.0;

      // Draw subtle bounding box when selected/unlocked so user can always see location
      if (!underlay.isLocked || isEntitySelected('underlay', 'underlay_main')) {
        ctx.strokeStyle = '#3b82f6';
        ctx.setLineDash([6, 4]);
        ctx.lineWidth = isEntitySelected('underlay', 'underlay_main') ? 3 : 1.5;
        ctx.strokeRect(screenPos.x, screenPos.y, renderWidth, renderHeight);
        ctx.setLineDash([]);
      }
      ctx.restore();
    }

    // Draw Grid
    const gridFt = state.settings.gridSnapSize || 1.0;
    const gridPixels = gridFt * scale;

    if (gridPixels >= 8) {
      const startWorldX = Math.floor(-panX / gridPixels) * gridFt;
      const endWorldX = Math.ceil((width - panX) / gridPixels) * gridFt;
      const startWorldY = Math.floor(-panY / gridPixels) * gridFt;
      const endWorldY = Math.ceil((height - panY) / gridPixels) * gridFt;

      // Minor grid lines
      ctx.lineWidth = 1;
      ctx.strokeStyle = minorGridCol;
      ctx.beginPath();
      for (let gx = startWorldX; gx <= endWorldX; gx += gridFt) {
        const sx = gx * scale + panX;
        ctx.moveTo(sx, 0);
        ctx.lineTo(sx, height);
      }
      for (let gy = startWorldY; gy <= endWorldY; gy += gridFt) {
        const sy = gy * scale + panY;
        ctx.moveTo(0, sy);
        ctx.lineTo(width, sy);
      }
      ctx.stroke();

      // Major grid lines (every 5ft or 10ft)
      const majorStep = gridFt < 1 ? 5 : 5;
      ctx.strokeStyle = majorGridCol;
      ctx.beginPath();
      for (let gx = Math.floor(startWorldX / majorStep) * majorStep; gx <= endWorldX; gx += majorStep) {
        const sx = gx * scale + panX;
        ctx.moveTo(sx, 0);
        ctx.lineTo(sx, height);
      }
      for (let gy = Math.floor(startWorldY / majorStep) * majorStep; gy <= endWorldY; gy += majorStep) {
        const sy = gy * scale + panY;
        ctx.moveTo(0, sy);
        ctx.lineTo(width, sy);
      }
      ctx.stroke();

      // CAD Origin Axes Rendering
      const originScreen = worldToScreen(0, 0);
      
      // X-Axis (Red horizontal line along Y=0)
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)'; // red-500 with opacity
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, originScreen.y);
      ctx.lineTo(width, originScreen.y);
      ctx.stroke();

      // Y-Axis (Green vertical line along X=0)
      ctx.strokeStyle = 'rgba(34, 197, 94, 0.5)'; // green-500 with opacity
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(originScreen.x, 0);
      ctx.lineTo(originScreen.x, height);
      ctx.stroke();

      // Label origin point cleanly as (0, 0)
      ctx.fillStyle = textDimCol;
      ctx.font = '600 10px font-mono';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('(0, 0)', originScreen.x + 4, originScreen.y + 4);
    }

    const nodeMap = new Map<string, CadNode>();
    state.nodes.forEach((n) => nodeMap.set(n.id, n));

    // 1. Draw Decks & Hardscapes
    state.decks.forEach((deck) => {
      if (deck.points.length < 3) return;
      const isSelected = isEntitySelected('deck', deck.id);
      ctx.beginPath();
      deck.points.forEach((p, idx) => {
        const sp = worldToScreen(p.x, p.y);
        if (idx === 0) ctx.moveTo(sp.x, sp.y);
        else ctx.lineTo(sp.x, sp.y);
      });
      ctx.closePath();
      ctx.fillStyle = isSelected ? 'rgba(245, 158, 11, 0.3)' : 'rgba(180, 83, 9, 0.16)';
      ctx.fill();
      ctx.strokeStyle = isSelected ? '#38bdf8' : '#b45309';
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.stroke();

      // Deck Label
      const cent = calculatePolygonCentroid(deck.points);
      const scent = worldToScreen(cent.x, cent.y);
      ctx.fillStyle = isSelected ? '#38bdf8' : '#f59e0b';
      ctx.font = '700 12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(deck.name, scent.x, scent.y - 6);
      ctx.fillStyle = isSelected ? '#e2e8f0' : '#d97706';
      ctx.font = '10px system-ui, sans-serif';
      ctx.fillText(`${deck.area} SF Timber Deck`, scent.x, scent.y + 8);
    });

    state.hardscapes.forEach((h) => {
      if (h.points.length < 3) return;
      const isSelected = isEntitySelected('hardscape', h.id);
      ctx.beginPath();
      h.points.forEach((p, idx) => {
        const sp = worldToScreen(p.x, p.y);
        if (idx === 0) ctx.moveTo(sp.x, sp.y);
        else ctx.lineTo(sp.x, sp.y);
      });
      ctx.closePath();
      ctx.fillStyle = isSelected ? 'rgba(56, 189, 248, 0.25)' : 'rgba(100, 116, 139, 0.2)';
      ctx.fill();
      ctx.strokeStyle = isSelected ? '#38bdf8' : '#64748b';
      ctx.lineWidth = isSelected ? 2.5 : 1.5;
      ctx.stroke();

      const cent = calculatePolygonCentroid(h.points);
      const scent = worldToScreen(cent.x, cent.y);
      ctx.fillStyle = isSelected ? '#38bdf8' : '#94a3b8';
      ctx.font = '600 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${h.name} (${h.area} SF)`, scent.x, scent.y);
    });

    // 2. Draw Detected Room Polygons (Faces)
    const roomFaces = state.rooms.map(room => {
      const wallThicknesses = room.wallIds.map(wid => {
        const wall = state.walls.find(w => w.id === wid);
        return wall ? getWallThickness(wall) : (state.settings.defaultWallThickness || 0.375);
      });
      return {
        ...room,
        netInteriorPoints: getNetInteriorPolygon(room.points, wallThicknesses)
      };
    });

    roomFaces.forEach((room) => {
      if (room.points.length < 3) return;
      const isSelected = isEntitySelected('room', room.id);

      ctx.beginPath();
      room.points.forEach((pt, idx) => {
        const sp = worldToScreen(pt.x, pt.y);
        if (idx === 0) ctx.moveTo(sp.x, sp.y);
        else ctx.lineTo(sp.x, sp.y);
      });
      ctx.closePath();

      // Color-coded room polygon tint by usage category
      const roomCat = getRoomCategory(room.name);
      let fillCol = state.settings.theme === 'light'
        ? roomCat.fillColorLight
        : state.settings.theme === 'blueprint'
        ? roomCat.fillColorBlueprint
        : roomCat.fillColorDark;

      if (isSelected) {
        fillCol = 'rgba(56, 189, 248, 0.32)';
      }

      ctx.fillStyle = fillCol;
      ctx.fill();

      // Category perimeter accent border
      ctx.strokeStyle = isSelected ? '#38bdf8' : roomCat.color + '55';
      ctx.lineWidth = isSelected ? 2.5 : 1;
      ctx.stroke();

      // Room Area & Name Callout Centroid
      if (state.settings.showRoomLabels) {
        const scent = worldToScreen(room.centroid.x, room.centroid.y);
        ctx.save();
        ctx.fillStyle = isSelected ? '#ffffff' : state.settings.theme === 'light' ? '#0f172a' : '#f8fafc';
        ctx.font = '700 13px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(room.name, scent.x, scent.y - 9);

        // Area badge & Finish tag
        ctx.font = '600 11px system-ui, sans-serif';
        ctx.fillStyle = isSelected ? '#38bdf8' : roomCat.color;
        
        // Fix: Use net interior area instead of centerline area to match MTO Matrix
        const wallThicknesses = room.wallIds.map(wid => {
          const wall = state.walls.find(w => w.id === wid);
          return wall ? getWallThickness(wall) : (state.settings.defaultWallThickness || 0.375);
        });
        const netInteriorPoints = getNetInteriorPolygon(room.points, wallThicknesses);
        const netArea = Math.abs(calculateSignedPolygonArea(netInteriorPoints));
        const displayArea = Math.round(netArea * 10) / 10;

        const areaStr = state.settings.unitSystem === 'metric'
          ? `${(displayArea * 0.092903).toFixed(1)} m²`
          : `${displayArea.toFixed(1)} SF`;
        const finishLabel = room.floorFinish.replace(/_/g, ' ');
        ctx.fillText(`${areaStr} • ${finishLabel}`, scent.x, scent.y + 8);
        ctx.restore();
      }
    });

    // 3. Draw Structural Beams & Utility Trenches
    state.stamps.forEach((st) => {
      if (st.type === 'beam_segment') {
        const sp = worldToScreen(st.x, st.y);
        const lenPx = (st.length || 10) * scale;
        ctx.save();
        ctx.strokeStyle = '#e11d48';
        ctx.lineWidth = 4;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.moveTo(sp.x, sp.y);
        ctx.lineTo(sp.x + lenPx, sp.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#f43f5e';
        ctx.font = '700 10px system-ui, sans-serif';
        ctx.fillText(`BEAM ${st.length || 10}'`, sp.x + 4, sp.y - 6);
        ctx.restore();
      } else if (st.type === 'utility_trench') {
        const sp = worldToScreen(st.x, st.y);
        const lenPx = (st.length || 20) * scale;
        ctx.save();
        ctx.strokeStyle = '#eab308';
        ctx.lineWidth = 3;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(sp.x, sp.y);
        ctx.lineTo(sp.x + lenPx, sp.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#facc15';
        ctx.font = '600 10px system-ui, sans-serif';
        ctx.fillText(`UTILITY TRENCH ${st.length || 20} LF`, sp.x + 4, sp.y - 5);
        ctx.restore();
      }
    });

    // 4. Draw Walls (Framing + Finish outline + Centerline)
    state.walls.forEach((wall) => {
      const geom = getWallGeometry(wall, nodeMap);
      if (!geom) return;

      const isSelected = isEntitySelected('wall', wall.id);
      const s1 = worldToScreen(geom.start.x, geom.start.y);
      const s2 = worldToScreen(geom.end.x, geom.end.y);

      const halfThickPx = (wall.thickness / 2) * scale;

      // Draw Wall Body (thick stroke or mitered polygon)
      ctx.save();
      ctx.lineCap = 'square';
      ctx.lineJoin = 'miter';

      // Outline fill
      ctx.lineWidth = Math.max(3, wall.thickness * scale);
      ctx.strokeStyle = isSelected
        ? '#38bdf8'
        : wall.wallType === 'exterior_2x6'
        ? '#475569'
        : '#334155';
      ctx.beginPath();
      ctx.moveTo(s1.x, s1.y);
      ctx.lineTo(s2.x, s2.y);
      ctx.stroke();

      // Exterior wall accent skin
      if (wall.wallType === 'exterior_2x6' || wall.isExteriorManualOverride) {
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#0284c7';
        ctx.beginPath();
        const nx = geom.normal.x * halfThickPx;
        const ny = geom.normal.y * halfThickPx;
        ctx.moveTo(s1.x + nx, s1.y + ny);
        ctx.lineTo(s2.x + nx, s2.y + ny);
        ctx.stroke();
      }

      // Centerline
      ctx.lineWidth = 1;
      ctx.strokeStyle = isSelected ? '#7dd3fc' : 'rgba(255, 255, 255, 0.2)';
      ctx.beginPath();
      ctx.moveTo(s1.x, s1.y);
      ctx.lineTo(s2.x, s2.y);
      ctx.stroke();

      // Wall Dimension Callout
      if (state.settings.showDimensions && geom.length >= 2.0) {
        const midX = (s1.x + s2.x) / 2;
        const midY = (s1.y + s2.y) / 2;
        const dimOffset = (halfThickPx + 14);
        const dimX = midX + geom.normal.x * dimOffset;
        const dimY = midY + geom.normal.y * dimOffset;

        ctx.save();
        ctx.translate(dimX, dimY);
        // Align text angle along wall
        let angle = geom.angleRad;
        if (angle > Math.PI / 2 || angle < -Math.PI / 2) {
          angle += Math.PI;
        }
        ctx.rotate(angle);

        ctx.fillStyle = isSelected ? '#38bdf8' : '#94a3b8';
        ctx.font = '600 11px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Calculate display length based on wall justification
        let displayLength = geom.length;
        const fullThickness = getWallThickness(wall);
        if (state.settings.wallJustification === 'interior_face') {
          const startWallCount = state.walls.filter(w => w.startNodeId === wall.startNodeId || w.endNodeId === wall.startNodeId).length;
          const endWallCount = state.walls.filter(w => w.startNodeId === wall.endNodeId || w.endNodeId === wall.endNodeId).length;
          const startDeduct = startWallCount >= 2 ? fullThickness / 2 : 0;
          const endDeduct = endWallCount >= 2 ? fullThickness / 2 : 0;
          displayLength = Math.max(0.5, geom.length - startDeduct - endDeduct);
        } else if (state.settings.wallJustification === 'exterior_face') {
          const startWallCount = state.walls.filter(w => w.startNodeId === wall.startNodeId || w.endNodeId === wall.startNodeId).length;
          const endWallCount = state.walls.filter(w => w.startNodeId === wall.endNodeId || w.endNodeId === wall.endNodeId).length;
          const startAdd = startWallCount >= 2 ? fullThickness / 2 : 0;
          const endAdd = endWallCount >= 2 ? fullThickness / 2 : 0;
          displayLength = geom.length + startAdd + endAdd;
        }

        ctx.fillText(formatLength(displayLength), 0, 0);
        ctx.restore();
      }

      ctx.restore();
    });

    // 5. Draw Apertures (Doors, Windows, Openings)
    state.apertures.forEach((ap) => {
      const parentWall = state.walls.find((w) => w.id === ap.wallId);
      if (!parentWall) return;

      const geom = getApertureGeometry(ap, parentWall, nodeMap);
      if (!geom) return;

      const isSelected = isEntitySelected('aperture', ap.id);
      const sStart = worldToScreen(geom.start.x, geom.start.y);
      const sEnd = worldToScreen(geom.end.x, geom.end.y);
      const sCenter = worldToScreen(geom.center.x, geom.center.y);
      const wallHalfThickPx = (parentWall.thickness / 2) * scale;
      const apWidthPx = geom.width * scale;

      ctx.save();

      // Clear wall opening slot
      ctx.strokeStyle = '#0b0f19';
      ctx.lineWidth = Math.max(4, parentWall.thickness * scale + 2);
      ctx.beginPath();
      ctx.moveTo(sStart.x, sStart.y);
      ctx.lineTo(sEnd.x, sEnd.y);
      ctx.stroke();

      // Frame jambs
      ctx.fillStyle = isSelected ? '#38bdf8' : '#cbd5e1';
      const jambSize = 3;
      ctx.fillRect(sStart.x - jambSize / 2, sStart.y - jambSize / 2, jambSize, jambSize);
      ctx.fillRect(sEnd.x - jambSize / 2, sEnd.y - jambSize / 2, jambSize, jambSize);

      if (ap.type.startsWith('window_')) {
        // Window architectural symbol: 3 parallel lines & sill
        const nx = geom.normal.x * wallHalfThickPx;
        const ny = geom.normal.y * wallHalfThickPx;

        ctx.strokeStyle = isSelected ? '#38bdf8' : '#38bdf8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        // Glass pane line
        ctx.moveTo(sStart.x, sStart.y);
        ctx.lineTo(sEnd.x, sEnd.y);
        ctx.stroke();

        // Exterior & Interior sill lines
        ctx.strokeStyle = isSelected ? '#7dd3fc' : '#94a3b8';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(sStart.x + nx * 0.8, sStart.y + ny * 0.8);
        ctx.lineTo(sEnd.x + nx * 0.8, sEnd.y + ny * 0.8);
        ctx.moveTo(sStart.x - nx * 0.8, sStart.y - ny * 0.8);
        ctx.lineTo(sEnd.x - nx * 0.8, sEnd.y - ny * 0.8);
        ctx.stroke();

        // Label
        ctx.fillStyle = '#38bdf8';
        ctx.font = '600 10px system-ui, sans-serif';
        ctx.textAlign = 'center';
        const wIn = Math.round(ap.width * 12);
        const hIn = Math.round(ap.height * 12);
        ctx.fillText(`W${wIn}"x${hIn}"`, sCenter.x + nx * 1.6, sCenter.y + ny * 1.6);
      } else if (ap.type === 'door_garage') {
        // Overhead garage door: segmented rolling panels
        ctx.strokeStyle = isSelected ? '#38bdf8' : '#f59e0b';
        ctx.lineWidth = 3;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(sStart.x, sStart.y);
        ctx.lineTo(sEnd.x, sEnd.y);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = '#f59e0b';
        ctx.font = '700 10px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`GARAGE ${ap.width}'`, sCenter.x, sCenter.y - 6);
      } else if (ap.type === 'door_pocket') {
        // Pocket door: opening + dashed wall pocket recess
        ctx.strokeStyle = isSelected ? '#38bdf8' : '#a855f7';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(sStart.x, sStart.y);
        ctx.lineTo(sEnd.x, sEnd.y);
        ctx.stroke();

        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = '#c084fc';
        ctx.beginPath();
        const isReversed = ap.pocketDirection === 'right';
        const pocketDir = isReversed ? { x: -geom.dir.x, y: -geom.dir.y } : geom.dir;
        const pocketStart = isReversed ? sStart : sEnd;
        const pocketEnd = {
          x: pocketStart.x + pocketDir.x * apWidthPx,
          y: pocketStart.y + pocketDir.y * apWidthPx,
        };
        ctx.moveTo(pocketStart.x, pocketStart.y);
        ctx.lineTo(pocketEnd.x, pocketEnd.y);
        ctx.stroke();
        ctx.setLineDash([]);

        // Direction arrow
        const arrowSize = 6;
        const arrowTip = {
          x: pocketStart.x + pocketDir.x * (apWidthPx * 0.8),
          y: pocketStart.y + pocketDir.y * (apWidthPx * 0.8),
        };
        const arrowAngle = Math.atan2(pocketDir.y, pocketDir.x);
        ctx.beginPath();
        ctx.moveTo(arrowTip.x, arrowTip.y);
        ctx.lineTo(
          arrowTip.x - arrowSize * Math.cos(arrowAngle - Math.PI / 6),
          arrowTip.y - arrowSize * Math.sin(arrowAngle - Math.PI / 6)
        );
        ctx.moveTo(arrowTip.x, arrowTip.y);
        ctx.lineTo(
          arrowTip.x - arrowSize * Math.cos(arrowAngle + Math.PI / 6),
          arrowTip.y - arrowSize * Math.sin(arrowAngle + Math.PI / 6)
        );
        ctx.stroke();
      } else if (ap.type === 'door_sliding_patio') {
        // Sliding patio door: two overlapping panels
        ctx.strokeStyle = isSelected ? '#38bdf8' : '#10b981';
        ctx.lineWidth = 2.5;
        const nx = geom.normal.x * (wallHalfThickPx * 0.5);
        const ny = geom.normal.y * (wallHalfThickPx * 0.5);

        ctx.beginPath();
        ctx.moveTo(sStart.x + nx, sStart.y + ny);
        ctx.lineTo(sCenter.x + nx, sCenter.y + ny);
        ctx.moveTo(sCenter.x - nx, sCenter.y - ny);
        ctx.lineTo(sEnd.x - nx, sEnd.y - ny);
        ctx.stroke();
      } else if (ap.type === 'door_bifold_single' || ap.type === 'door_bifold_double') {
        // Bifold door: chevron/accordion panels
        const isDouble = ap.type === 'door_bifold_double';
        const swingNormal = ap.swingSide === 'inward' ? -1 : 1;
        const panelColor = isSelected ? '#38bdf8' : '#34d399';
        ctx.strokeStyle = panelColor;
        ctx.lineWidth = 2.5;

        const drawBifoldPair = (start: Point2D, end: Point2D) => {
          const dx = end.x - start.x;
          const dy = end.y - start.y;
          const spanLen = Math.hypot(dx, dy);
          if (spanLen < 0.01) return;

          const ux = dx / spanLen;
          const uy = dy / spanLen;

          // Single, unified normal vector perpendicular to the segment
          const nx = -uy * swingNormal;
          const ny = ux * swingNormal;

          // Apex is at 1/4 of the span, projected out using the same normal
          const apexOffset = spanLen / 4;
          const apex = {
            x: start.x + (ux * spanLen) / 4 + nx * apexOffset,
            y: start.y + (uy * spanLen) / 4 + ny * apexOffset,
          };

          const mid = {
            x: start.x + (ux * spanLen) / 2,
            y: start.y + (uy * spanLen) / 2,
          };

          ctx.beginPath();
          ctx.moveTo(start.x, start.y);
          ctx.lineTo(apex.x, apex.y);
          ctx.lineTo(mid.x, mid.y);
          ctx.stroke();
        };

        if (isDouble) {
          // Parametric Vector Formula for Symmetric Double Bifold Doors
          const dx_ap = sEnd.x - sStart.x;
          const dy_ap = sEnd.y - sStart.y;
          const L = Math.hypot(dx_ap, dy_ap);
          const ux = dx_ap / L;
          const uy = dy_ap / L;
          const nx = -uy;
          const ny = ux;
          
          const d = ap.swingSide === 'inward' ? -0.2 * L : 0.2 * L;

          // 1. Left/Top Pair (Jamb sStart to Midpoint sCenter)
          const p1 = {
            x: sStart.x + 0.25 * dx_ap + d * nx,
            y: sStart.y + 0.25 * dy_ap + d * ny,
          };
          ctx.beginPath();
          ctx.moveTo(sStart.x, sStart.y);
          ctx.lineTo(p1.x, p1.y);
          ctx.lineTo(sCenter.x, sCenter.y);
          ctx.stroke();

          // 2. Right/Bottom Pair (Jamb sEnd to Midpoint sCenter)
          const p2 = {
            x: sEnd.x - 0.25 * dx_ap + d * nx,
            y: sEnd.y - 0.25 * dy_ap + d * ny,
          };
          ctx.beginPath();
          ctx.moveTo(sEnd.x, sEnd.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.lineTo(sCenter.x, sCenter.y);
          ctx.stroke();
        } else {
          const hinge = ap.hingeSide === 'right' ? sEnd : sStart;
          const moving = ap.hingeSide === 'right' ? sStart : sEnd;
          drawBifoldPair(hinge, moving);
        }

        ctx.fillStyle = panelColor;
        ctx.font = '600 10px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`BIFOLD ${ap.width}'`, sCenter.x, sCenter.y + 12 * swingNormal);

      } else if (ap.type === 'cased_opening') {
        // Cased Opening: Clean opening with dashed header line
        ctx.strokeStyle = isSelected ? '#38bdf8' : '#94a3b8';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(sStart.x, sStart.y);
        ctx.lineTo(sEnd.x, sEnd.y);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = isSelected ? '#38bdf8' : '#94a3b8';
        ctx.font = 'italic 600 10px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`OPENING ${ap.width}'`, sCenter.x, sCenter.y);
      } else {
        // Standard Passage / Exterior Door swing arc
        const swingNormal = ap.swingSide === 'inward' ? -1 : 1;
        const isRightHinge = ap.hingeSide === 'right';
        const hinge = isRightHinge ? sEnd : sStart;
        const leafEnd = {
          x: hinge.x + geom.normal.x * apWidthPx * swingNormal,
          y: hinge.y + geom.normal.y * apWidthPx * swingNormal,
        };

        // Door Leaf Panel Line
        ctx.strokeStyle = isSelected ? '#38bdf8' : '#f8fafc';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(hinge.x, hinge.y);
        ctx.lineTo(leafEnd.x, leafEnd.y);
        ctx.stroke();

        // Door 90-degree swing arc
        ctx.strokeStyle = isSelected ? '#7dd3fc' : 'rgba(248, 250, 252, 0.4)';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([4, 3]);

        const otherPoint = isRightHinge ? sStart : sEnd;
        const startAngle = Math.atan2(otherPoint.y - hinge.y, otherPoint.x - hinge.x);
        const endAngle = Math.atan2(leafEnd.y - hinge.y, leafEnd.x - hinge.x);

        ctx.beginPath();
        ctx.arc(hinge.x, hinge.y, apWidthPx, startAngle, endAngle, isRightHinge ? swingNormal > 0 : swingNormal < 0);
        ctx.stroke();
        ctx.setLineDash([]);

        // Label
        ctx.fillStyle = isSelected ? '#38bdf8' : '#cbd5e1';
        ctx.font = '600 10px system-ui, sans-serif';
        ctx.textAlign = 'center';
        const wIn = Math.round(ap.width * 12);
        const hIn = Math.round(ap.height * 12);
        ctx.fillText(`D${wIn}"x${hIn}"`, sCenter.x, sCenter.y);
      }

      ctx.restore();
    });

    // 6. Draw MEP Stamps & Structural Elements
    if (state.settings.showMepIcons) {
      state.stamps.forEach((st) => {
        const sp = worldToScreen(st.x, st.y);
        const isSelected = isEntitySelected('stamp', st.id);

        ctx.save();
        ctx.translate(sp.x, sp.y);

        if (st.rotation) {
          ctx.rotate((st.rotation * Math.PI) / 180);
        }

        // Structural Elements
        if (st.type === 'beam_segment') {
          const lenPx = (st.length || 12) * scale;
          const wPx = Math.max(8, 0.75 * scale);
          ctx.fillStyle = isSelected ? 'rgba(56, 189, 248, 0.2)' : 'rgba(226, 232, 240, 0.15)';
          ctx.fillRect(-lenPx / 2, -wPx / 2, lenPx, wPx);
          ctx.strokeStyle = isSelected ? '#38bdf8' : '#e2e8f0';
          ctx.lineWidth = 2;
          ctx.strokeRect(-lenPx / 2, -wPx / 2, lenPx, wPx);
          ctx.setLineDash([4, 3]);
          ctx.beginPath();
          ctx.moveTo(-lenPx / 2, 0);
          ctx.lineTo(lenPx / 2, 0);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = isSelected ? '#38bdf8' : '#e2e8f0';
          ctx.font = '700 10px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(`BEAM ${st.length || 12}'`, 0, -wPx / 2 - 2);
        } else if (st.type === 'utility_trench') {
          const lenPx = (st.length || 25) * scale;
          ctx.strokeStyle = isSelected ? '#38bdf8' : '#f59e0b';
          ctx.lineWidth = 3;
          ctx.setLineDash([8, 4]);
          ctx.beginPath();
          ctx.moveTo(-lenPx / 2, 0);
          ctx.lineTo(lenPx / 2, 0);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = isSelected ? '#38bdf8' : '#f59e0b';
          ctx.font = '700 10px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(`TRENCH ${st.length || 25}'`, 0, -4);
        } else if (st.type === 'column_post') {
          const sz = 14;
          ctx.fillStyle = isSelected ? '#38bdf8' : '#0f172a';
          ctx.fillRect(-sz / 2, -sz / 2, sz, sz);
          ctx.strokeStyle = isSelected ? '#7dd3fc' : '#e2e8f0';
          ctx.lineWidth = 2;
          ctx.strokeRect(-sz / 2, -sz / 2, sz, sz);
          ctx.beginPath();
          ctx.moveTo(-sz / 2, -sz / 2);
          ctx.lineTo(sz / 2, sz / 2);
          ctx.moveTo(-sz / 2, sz / 2);
          ctx.lineTo(sz / 2, -sz / 2);
          ctx.stroke();
        } else if (st.type === 'helical_pier') {
          ctx.strokeStyle = isSelected ? '#38bdf8' : '#f59e0b';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(0, 0, 9, 0, Math.PI * 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(-11, 0);
          ctx.lineTo(11, 0);
          ctx.moveTo(0, -11);
          ctx.lineTo(0, 11);
          ctx.stroke();
        } else if (st.type === 'stair_run') {
          // Stair Tread run
          const szW = 28;
          const szH = 48;
          ctx.fillStyle = isSelected ? 'rgba(56, 189, 248, 0.15)' : 'rgba(203, 213, 225, 0.1)';
          ctx.fillRect(-szW / 2, -szH / 2, szW, szH);
          ctx.strokeStyle = isSelected ? '#38bdf8' : '#cbd5e1';
          ctx.lineWidth = 2;
          ctx.strokeRect(-szW / 2, -szH / 2, szW, szH);
          ctx.beginPath();
          for (let sy = -szH / 2 + 6; sy < szH / 2; sy += 7) {
            ctx.moveTo(-szW / 2, sy);
            ctx.lineTo(szW / 2, sy);
          }
          ctx.stroke();
          // UP Arrow
          ctx.fillStyle = '#38bdf8';
          ctx.font = '700 9px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(`UP ↑ (${st.stairRisers || 14}R)`, 0, 0);
        } else if (st.type.startsWith('switch_')) {
          // Switch symbol
          ctx.fillStyle = isSelected ? '#38bdf8' : '#e2e8f0';
          ctx.font = '700 12px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const sym = st.type === 'switch_dimmer' ? '$D' : st.type === 'switch_3way' ? '$3W' : '$';
          ctx.fillText(sym, 0, 0);
        } else if (st.type === 'stamp_electrical_panel' || st.type === 'electrical_panel') {
          // Electrical Panel: Rectangular symbol with a diagonal line
          const pw = Math.max(12, 1.0 * scale);
          const ph = Math.max(20, 1.67 * scale);
          ctx.fillStyle = isSelected ? 'rgba(56, 189, 248, 0.2)' : 'rgba(100, 116, 139, 0.15)';
          ctx.fillRect(-pw / 2, -ph / 2, pw, ph);
          ctx.strokeStyle = isSelected ? '#38bdf8' : '#64748b';
          ctx.lineWidth = 2;
          ctx.strokeRect(-pw / 2, -ph / 2, pw, ph);
          // Diagonal line
          ctx.beginPath();
          ctx.moveTo(-pw / 2, -ph / 2);
          ctx.lineTo(pw / 2, ph / 2);
          ctx.stroke();
          // Panel Label
          ctx.fillStyle = isSelected ? '#38bdf8' : '#94a3b8';
          ctx.font = '700 8px system-ui, sans-serif';
          ctx.textAlign = 'center';
          const pType = st.panelType || 'main';
          const pAmp = st.panelAmperage || (pType === 'main' ? '200A' : '100A');
          ctx.fillText(`PANEL ${pType.toUpperCase()} ${pAmp}`, 0, ph / 2 + 10);
        } else if (st.type.startsWith('outlet_')) {
          // Duplex outlet circle with 2 prongs
          ctx.fillStyle = isSelected ? '#38bdf8' : '#0f172a';
          ctx.beginPath();
          ctx.arc(0, 0, 7, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = isSelected ? '#38bdf8' : '#38bdf8';
          ctx.lineWidth = 1.5;
          ctx.stroke();
          // 2 hash prongs
          ctx.beginPath();
          ctx.moveTo(-4, -8);
          ctx.lineTo(-4, -4);
          ctx.moveTo(4, -8);
          ctx.lineTo(4, -4);
          ctx.stroke();

          if (st.type === 'outlet_gfci') {
            ctx.fillStyle = '#38bdf8';
            ctx.font = '700 8px system-ui, sans-serif';
            ctx.fillText('GFI', 0, 14);
          } else if (st.type === 'outlet_240v') {
            ctx.fillStyle = '#f59e0b';
            ctx.font = '700 8px system-ui, sans-serif';
            ctx.fillText('240V', 0, 14);
          } else if (st.type === 'outlet_ev') {
            ctx.fillStyle = '#10b981';
            ctx.font = '700 8px system-ui, sans-serif';
            ctx.fillText('EV', 0, 14);
          }
        } else if (st.type === 'light_potlight') {
          // Potlight dashed circle with center cross
          ctx.strokeStyle = isSelected ? '#38bdf8' : '#facc15';
          ctx.lineWidth = 1.2;
          ctx.setLineDash([2, 2]);
          ctx.beginPath();
          ctx.arc(0, 0, 9, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = '#facc15';
          ctx.beginPath();
          ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
          ctx.fill();
        } else if (st.type === 'light_coach') {
          ctx.strokeStyle = isSelected ? '#38bdf8' : '#facc15';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(-6, -6, 12, 12);
          ctx.fillStyle = '#facc15';
          ctx.beginPath();
          ctx.arc(0, 0, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.font = '700 7px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('CL', 0, 14);
        } else if (st.type === 'light_soffit') {
          ctx.strokeStyle = isSelected ? '#38bdf8' : '#facc15';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(0, 0, 7, 0, Math.PI * 2);
          ctx.stroke();
          ctx.font = '700 7px system-ui, sans-serif';
          ctx.fillStyle = '#facc15';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('SL', 0, 0);
        } else if (st.type === 'light_fixture') {
          ctx.strokeStyle = isSelected ? '#38bdf8' : '#facc15';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(0, 0, 8, 0, Math.PI * 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(-6, 0); ctx.lineTo(6, 0);
          ctx.moveTo(0, -6); ctx.lineTo(0, 6);
          ctx.moveTo(-4, -4); ctx.lineTo(4, 4);
          ctx.moveTo(-4, 4); ctx.lineTo(4, -4);
          ctx.stroke();
        } else if (st.type === 'fan_ceiling') {
          // 4-blade fan
          ctx.strokeStyle = isSelected ? '#38bdf8' : '#60a5fa';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(0, 0, 11, 0, Math.PI * 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(-9, -9);
          ctx.lineTo(9, 9);
          ctx.moveTo(-9, 9);
          ctx.lineTo(9, -9);
          ctx.stroke();
        } else if (st.type === 'fan_exhaust') {
          const sz = 16;
          ctx.strokeStyle = isSelected ? '#38bdf8' : '#38bdf8';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(-sz / 2, -sz / 2, sz, sz);
          ctx.beginPath();
          ctx.arc(0, 0, 5, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = '#38bdf8';
          ctx.font = '700 8px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('EF', 0, 0);
        } else if (st.type === 'fan_rangehood') {
          const rw = Math.max(24, 2.5 * scale);
          const rd = Math.max(16, 1.67 * scale);
          ctx.strokeStyle = isSelected ? '#38bdf8' : '#94a3b8';
          ctx.lineWidth = 2;
          ctx.strokeRect(-rw / 2, -rd / 2, rw, rd);
          ctx.fillStyle = isSelected ? '#38bdf8' : '#cbd5e1';
          ctx.font = '700 8px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('HOOD', 0, 0);
        } else if (st.type === 'alarm_smoke_co') {
          // Octagonal safety detector
          ctx.fillStyle = '#ef4444';
          ctx.strokeStyle = '#f87171';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(0, 0, 7, 0, Math.PI * 2);
          ctx.stroke();
          ctx.font = '700 8px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('SD', 0, 0);
        } else if (st.type.startsWith('plumbing_')) {
          // Plumbing Architectural fixtures (proportional to scale)
          ctx.strokeStyle = isSelected ? '#38bdf8' : '#06b6d4';
          ctx.lineWidth = 1.6;
          if (st.type === 'plumbing_toilet') {
            const tw = Math.max(14, 1.5 * scale);
            const td = Math.max(22, 2.3 * scale);
            const tankD = td * 0.32;
            ctx.strokeRect(-tw / 2, -td / 2, tw, tankD);
            ctx.beginPath();
            ctx.ellipse(0, -td / 2 + tankD + (td - tankD) / 2, tw * 0.42, (td - tankD) / 2, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(-tw / 2 + 4, -td / 2 + 4, 1.5, 0, Math.PI * 2);
            ctx.stroke();
          } else if (st.type === 'plumbing_tub') {
            const tw = Math.max(26, 2.67 * scale);
            const tl = Math.max(48, 5.0 * scale);
            ctx.fillStyle = isSelected ? 'rgba(56, 189, 248, 0.15)' : 'rgba(6, 182, 212, 0.08)';
            ctx.fillRect(-tl / 2, -tw / 2, tl, tw);
            ctx.strokeRect(-tl / 2, -tw / 2, tl, tw);
            ctx.beginPath();
            ctx.roundRect(-tl / 2 + 3, -tw / 2 + 3, tl - 6, tw - 6, 6);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(-tl / 2 + 10, 0, 3, 0, Math.PI * 2);
            ctx.stroke();
          } else if (st.type === 'plumbing_shower') {
            const sz = Math.max(30, 3.0 * scale);
            ctx.fillStyle = isSelected ? 'rgba(56, 189, 248, 0.15)' : 'rgba(6, 182, 212, 0.08)';
            ctx.fillRect(-sz / 2, -sz / 2, sz, sz);
            ctx.strokeRect(-sz / 2, -sz / 2, sz, sz);
            ctx.beginPath();
            ctx.moveTo(-sz / 2, -sz / 2);
            ctx.lineTo(sz / 2, sz / 2);
            ctx.moveTo(-sz / 2, sz / 2);
            ctx.lineTo(sz / 2, -sz / 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(0, 0, 3, 0, Math.PI * 2);
            ctx.stroke();
          } else if (st.type === 'plumbing_water_heater') {
            const r = Math.max(14, 1.25 * scale);
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = isSelected ? '#38bdf8' : '#06b6d4';
            ctx.font = '700 9px system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('WH', 0, 0);
          } else if (st.type === 'plumbing_hose_bib') {
            ctx.fillStyle = '#06b6d4';
            ctx.font = '700 11px system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('HB 🚰', 0, 0);
          } else {
            // Sink / Lavatory
            const sw = Math.max(18, 2.0 * scale);
            const sd = Math.max(16, 1.75 * scale);
            ctx.strokeRect(-sw / 2, -sd / 2, sw, sd);
            ctx.beginPath();
            ctx.roundRect(-sw / 2 + 3, -sd / 2 + 3, sw - 6, sd - 6, 4);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
            ctx.stroke();
          }
        }

        ctx.restore();
      });
    }

    // 6.5 Draw Text Annotations / Notes
    (state.annotations || []).forEach((ann) => {
      const isSelected = isEntitySelected('annotation', ann.id);
      const sp = worldToScreen(ann.x, ann.y);
      const rad = ((ann.rotation || 0) * Math.PI) / 180;

      ctx.save();
      ctx.translate(sp.x, sp.y);
      ctx.rotate(rad);

      ctx.font = `600 ${ann.fontSize || 14}px system-ui, sans-serif`;
      const textMetrics = ctx.measureText(ann.text);
      const textWidth = textMetrics.width;
      const textHeight = (ann.fontSize || 14) * 1.3;

      // Draw pill background
      ctx.fillStyle = isSelected
        ? 'rgba(14, 165, 233, 0.25)'
        : 'rgba(15, 23, 42, 0.85)';
      ctx.strokeStyle = isSelected ? '#38bdf8' : 'rgba(148, 163, 184, 0.4)';
      ctx.lineWidth = isSelected ? 2 : 1;

      const padX = 8;
      const padY = 4;
      ctx.beginPath();
      ctx.roundRect(-padX, -textHeight + padY, textWidth + padX * 2, textHeight + padY, 4);
      ctx.fill();
      ctx.stroke();

      // Text
      ctx.fillStyle = ann.color || '#38bdf8';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(ann.text, 0, 0);

      ctx.restore();
    });

    // 7. Draw Nodes (Junction Handles)
    state.nodes.forEach((n) => {
      const isSelected = isEntitySelected('node', n.id);
      const sp = worldToScreen(n.x, n.y);

      ctx.save();
      ctx.fillStyle = isSelected ? '#38bdf8' : '#64748b';
      ctx.strokeStyle = isSelected ? '#ffffff' : '#0f172a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, isSelected ? 6 : 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    });

    // 8. Draw Active Drafting Feedback
    // A. Active wall drafting rubber band line
    if (activeTool === 'wall_pen' && activeWallStartNodeId && draftMousePos) {
      const startNode = nodeMap.get(activeWallStartNodeId) || pendingWallStart;
      if (startNode) {
        const sStart = worldToScreen(startNode.x, startNode.y);
        const sEnd = worldToScreen(draftMousePos.x, draftMousePos.y);

        ctx.save();
        ctx.strokeStyle = '#111827';
        ctx.lineWidth = 5;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(sStart.x, sStart.y);
        ctx.lineTo(sEnd.x, sEnd.y);
        ctx.stroke();
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([6, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Live length & angle badge
        const dLen = distance(startNode, draftMousePos);
        const dx = draftMousePos.x - startNode.x;
        const dy = draftMousePos.y - startNode.y;
        const deg = Math.round((Math.atan2(dy, dx) * 180) / Math.PI);
        const midX = (sStart.x + sEnd.x) / 2;
        const midY = (sStart.y + sEnd.y) / 2;

        const label = `${formatLength(dLen)} @ ${deg}°`;
        ctx.font = '700 12px system-ui, sans-serif';
        const labelWidth = Math.max(90, ctx.measureText(label).width + 16);
        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(midX - labelWidth / 2, midY - 25, labelWidth, 22, 4);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#fef3c7';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, midX, midY - 14);
        ctx.restore();
      }
    }

    // B. Rectangle Room Box preview
    if ((activeTool === 'wall_rect' || activeTool === 'room_box') && roomBoxStart && draftMousePos) {
      const sp1 = worldToScreen(roomBoxStart.x, roomBoxStart.y);
      const sp2 = worldToScreen(draftMousePos.x, draftMousePos.y);

      const rW = Math.abs(draftMousePos.x - roomBoxStart.x);
      const rH = Math.abs(draftMousePos.y - roomBoxStart.y);
      const area = Math.round(rW * rH);

      ctx.save();
      ctx.strokeStyle = '#111827';
      ctx.lineWidth = 4;
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(251, 191, 36, 0.08)';
      ctx.beginPath();
      ctx.rect(
        Math.min(sp1.x, sp2.x),
        Math.min(sp1.y, sp2.y),
        Math.abs(sp2.x - sp1.x),
        Math.abs(sp2.y - sp1.y)
      );
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      const centX = (sp1.x + sp2.x) / 2;
      const centY = (sp1.y + sp2.y) / 2;
      const label = `${formatLength(rW)} × ${formatLength(rH)} (${area} SF)`;
      ctx.font = '700 12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const labelWidth = ctx.measureText(label).width + 16;
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.roundRect(centX - labelWidth / 2, centY - 11, labelWidth, 22, 4);
      ctx.fill();
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = '#fef3c7';
      ctx.fillText(label, centX, centY);
      ctx.restore();
    }

    // C. Measurement ruler line
    if (activeTool === 'ruler_measure' && rulerStart && rulerEnd) {
      const sp1 = worldToScreen(rulerStart.x, rulerStart.y);
      const sp2 = worldToScreen(rulerEnd.x, rulerEnd.y);
      const d = distance(rulerStart, rulerEnd);

      ctx.save();
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sp1.x, sp1.y);
      ctx.lineTo(sp2.x, sp2.y);
      ctx.stroke();

      ctx.fillStyle = '#f59e0b';
      ctx.font = '700 12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`📏 ${formatLength(d)}`, (sp1.x + sp2.x) / 2, (sp1.y + sp2.y) / 2 - 10);
      ctx.restore();
    }

    // --- CALIBRATION PREVIEW ---
    if (activeTool === 'calibrate_scale' && calibrationPoints.length > 0 && draftMousePos) {
      const sp1 = worldToScreen(calibrationPoints[0].x, calibrationPoints[0].y);
      const sp2 = worldToScreen(draftMousePos.x, draftMousePos.y);
      
      ctx.save();
      ctx.lineWidth = 5;
      ctx.strokeStyle = '#111827';
      ctx.beginPath();
      ctx.moveTo(sp1.x, sp1.y);
      ctx.lineTo(sp2.x, sp2.y);
      ctx.stroke();
      ctx.strokeStyle = '#ffea00';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      for (const p of [sp1, sp2]) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
        ctx.moveTo(p.x - 11, p.y);
        ctx.lineTo(p.x + 11, p.y);
        ctx.moveTo(p.x, p.y - 11);
        ctx.lineTo(p.x, p.y + 11);
        ctx.strokeStyle = '#111827';
        ctx.lineWidth = 5;
        ctx.stroke();
        ctx.strokeStyle = '#ffea00';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.font = '700 12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const label = 'Select Second Point for Calibration';
      const lx = (sp1.x + sp2.x) / 2;
      const ly = (sp1.y + sp2.y) / 2 - 18;
      ctx.fillStyle = '#111827';
      const tw = ctx.measureText(label).width;
      ctx.fillRect(lx - tw / 2 - 5, ly - 9, tw + 10, 18);
      ctx.fillStyle = '#ffea00';
      ctx.fillText(label, lx, ly);
      ctx.restore();
    }

    // D. Magnetic Snap Indicator Ring & Dynamic Wall Offset Dimension Callouts
    // Draw Sticky Lock Indicator first if active
    if (lockedSnapNodeRef.current) {
      const locked = lockedSnapNodeRef.current;
      const sp = worldToScreen(locked.x, locked.y);
      ctx.save();
      // Glowing green ring
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, 10, 0, Math.PI * 2);
      ctx.stroke();
      // Green fill
      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, 4, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = '#22c55e';
      ctx.font = 'bold 10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('LOCKED', sp.x, sp.y - 14);
      ctx.restore();
    }

    // Calibration uses a high-contrast free-point cursor, not the normal snap ring.
    if (activeTool === 'calibrate_scale' && calibrationPoints.length === 0 && snapCandidate) {
      const sp = worldToScreen(snapCandidate.point.x, snapCandidate.point.y);
      ctx.save();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, 8, 0, Math.PI * 2);
      ctx.moveTo(sp.x - 11, sp.y);
      ctx.lineTo(sp.x + 11, sp.y);
      ctx.moveTo(sp.x, sp.y - 11);
      ctx.lineTo(sp.x, sp.y + 11);
      ctx.strokeStyle = '#111827';
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.strokeStyle = '#ffea00';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }

    if (snapCandidate && activeTool !== 'calibrate_scale') {
      const sp = worldToScreen(snapCandidate.point.x, snapCandidate.point.y);
      ctx.save();
      const drafting = activeTool === 'wall_pen' || activeTool === 'wall_rect' || activeTool === 'room_box';
      const snapColor = snapCandidate.type === 'node' ? '#10b981' : snapCandidate.type === 'wall' ? '#f59e0b' : drafting ? '#fbbf24' : '#38bdf8';
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, 7, 0, Math.PI * 2);
      if (drafting) {
        ctx.moveTo(sp.x - 10, sp.y);
        ctx.lineTo(sp.x + 10, sp.y);
        ctx.moveTo(sp.x, sp.y - 10);
        ctx.lineTo(sp.x, sp.y + 10);
        ctx.strokeStyle = '#111827';
        ctx.lineWidth = 5;
        ctx.stroke();
      }
      ctx.strokeStyle = snapColor;
      ctx.lineWidth = 2;
      ctx.stroke();

      if (snapCandidate.type === 'node') {
        ctx.fillStyle = '#10b981';
        ctx.font = '600 10px system-ui, sans-serif';
        ctx.fillText('SNAP NODE', sp.x + 10, sp.y - 6);
      } else if (snapCandidate.type === 'wall' && snapCandidate.wallId) {
        // Dynamic linear offset dimension callouts from wall nodes/interior corners
        const hostWall = state.walls.find((w) => w.id === snapCandidate.wallId);
        if (hostWall) {
          const n1 = nodeMap.get(hostWall.startNodeId);
          const n2 = nodeMap.get(hostWall.endNodeId);
          if (n1 && n2) {
            let p1 = { x: n1.x, y: n1.y };
            let p2 = { x: n2.x, y: n2.y };
            let snapPoint = snapCandidate.point;

            // Project onto interior face if in a room
            const hostRoom = roomFaces.find(r => r.wallIds.includes(hostWall.id));
            if (hostRoom) {
              const wallIdx = hostRoom.wallIds.indexOf(hostWall.id);
              const ip1 = hostRoom.netInteriorPoints[wallIdx];
              const ip2 = hostRoom.netInteriorPoints[(wallIdx + 1) % hostRoom.netInteriorPoints.length];
              
              const proj = projectPointOntoSegment(snapCandidate.point, ip1, ip2);
              p1 = ip1;
              p2 = ip2;
              snapPoint = proj.point;
            }

            const sn1 = worldToScreen(p1.x, p1.y);
            const sn2 = worldToScreen(p2.x, p2.y);
            const sSnap = worldToScreen(snapPoint.x, snapPoint.y);

            const d1 = distance(p1, snapPoint);
            const d2 = distance(snapPoint, p2);

            const dx = sn2.x - sn1.x;
            const dy = sn2.y - sn1.y;
            const len = Math.hypot(dx, dy);
            if (len > 0.001) {
              const nx = -dy / len;
              const ny = dx / len;
              const offsetPx = 22;

              const offStart1 = { x: sn1.x + nx * offsetPx, y: sn1.y + ny * offsetPx };
              const offSnap = { x: sSnap.x + nx * offsetPx, y: sSnap.y + ny * offsetPx };
              const offEnd2 = { x: sn2.x + nx * offsetPx, y: sn2.y + ny * offsetPx };

              ctx.strokeStyle = '#f59e0b';
              ctx.lineWidth = 1.5;
              ctx.setLineDash([2, 2]);
              // Witness lines
              ctx.beginPath();
              ctx.moveTo(sn1.x, sn1.y);
              ctx.lineTo(offStart1.x, offStart1.y);
              ctx.moveTo(sSnap.x, sSnap.y);
              ctx.lineTo(offSnap.x, offSnap.y);
              ctx.moveTo(sn2.x, sn2.y);
              ctx.lineTo(offEnd2.x, offEnd2.y);
              ctx.stroke();

              ctx.setLineDash([]);
              // Dimension lines
              ctx.beginPath();
              ctx.moveTo(offStart1.x, offStart1.y);
              ctx.lineTo(offSnap.x, offSnap.y);
              ctx.moveTo(offSnap.x, offSnap.y);
              ctx.lineTo(offEnd2.x, offEnd2.y);
              ctx.stroke();

              // Dimension Badges
              const mid1 = { x: (offStart1.x + offSnap.x) / 2, y: (offStart1.y + offSnap.y) / 2 };
              const mid2 = { x: (offSnap.x + offEnd2.x) / 2, y: (offSnap.y + offEnd2.y) / 2 };

              const text1 = `⟵ ${formatLength(d1)}`;
              const text2 = `${formatLength(d2)} ⟶`;

              ctx.font = '700 10px system-ui, sans-serif';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';

              const padX = 5;
              const padY = 3;

              if (d1 > 0.4) {
                const m1 = ctx.measureText(text1);
                ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
                ctx.beginPath();
                ctx.roundRect(mid1.x - m1.width / 2 - padX, mid1.y - 7 - padY, m1.width + padX * 2, 14 + padY * 2, 4);
                ctx.fill();
                ctx.strokeStyle = '#f59e0b';
                ctx.stroke();
                ctx.fillStyle = '#fbbf24';
                ctx.fillText(text1, mid1.x, mid1.y);
              }

              if (d2 > 0.4) {
                const m2 = ctx.measureText(text2);
                ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
                ctx.beginPath();
                ctx.roundRect(mid2.x - m2.width / 2 - padX, mid2.y - 7 - padY, m2.width + padX * 2, 14 + padY * 2, 4);
                ctx.fill();
                ctx.strokeStyle = '#f59e0b';
                ctx.stroke();
                ctx.fillStyle = '#fbbf24';
                ctx.fillText(text2, mid2.x, mid2.y);
              }
            }
          }
        }
      }
      ctx.restore();
    }

    // Dynamic offset indicators for selected aperture
    if (selection.type === 'aperture' && selection.id) {
      const ap = state.apertures.find((a) => a.id === selection.id);
      if (ap) {
        const hostWall = state.walls.find((w) => w.id === ap.wallId);
        if (hostWall) {
          const n1 = nodeMap.get(hostWall.startNodeId);
          const n2 = nodeMap.get(hostWall.endNodeId);
          const geom = getApertureGeometry(ap, hostWall, nodeMap);
          if (n1 && n2 && geom) {
            const sn1 = worldToScreen(n1.x, n1.y);
            const sn2 = worldToScreen(n2.x, n2.y);
            const sStart = worldToScreen(geom.start.x, geom.start.y);
            const sEnd = worldToScreen(geom.end.x, geom.end.y);

            const dx = sn2.x - sn1.x;
            const dy = sn2.y - sn1.y;
            const len = Math.hypot(dx, dy);
            if (len > 0.001) {
              const nx = -dy / len;
              const ny = dx / len;
              const offsetPx = 28;

              const offStartNode = { x: sn1.x + nx * offsetPx, y: sn1.y + ny * offsetPx };
              const offApStart = { x: sStart.x + nx * offsetPx, y: sStart.y + ny * offsetPx };
              const offApEnd = { x: sEnd.x + nx * offsetPx, y: sEnd.y + ny * offsetPx };
              const offEndNode = { x: sn2.x + nx * offsetPx, y: sn2.y + ny * offsetPx };

              const d1 = ap.offset;
              const hostLen = distance(n1, n2);
              const d2 = Math.max(0, hostLen - (ap.offset + ap.width));

              ctx.save();
              ctx.strokeStyle = '#38bdf8';
              ctx.lineWidth = 1.5;
              ctx.setLineDash([2, 2]);

              // Witness lines
              ctx.beginPath();
              ctx.moveTo(sn1.x, sn1.y);
              ctx.lineTo(offStartNode.x, offStartNode.y);
              ctx.moveTo(sStart.x, sStart.y);
              ctx.lineTo(offApStart.x, offApStart.y);
              ctx.moveTo(sEnd.x, sEnd.y);
              ctx.lineTo(offApEnd.x, offApEnd.y);
              ctx.moveTo(sn2.x, sn2.y);
              ctx.lineTo(offEndNode.x, offEndNode.y);
              ctx.stroke();

              ctx.setLineDash([]);
              // Dimension lines
              ctx.beginPath();
              ctx.moveTo(offStartNode.x, offStartNode.y);
              ctx.lineTo(offApStart.x, offApStart.y);
              ctx.moveTo(offApEnd.x, offApEnd.y);
              ctx.lineTo(offEndNode.x, offEndNode.y);
              ctx.stroke();

              // Labels
              ctx.font = '700 10px system-ui, sans-serif';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';

              const mid1 = { x: (offStartNode.x + offApStart.x) / 2, y: (offStartNode.y + offApStart.y) / 2 };
              const mid2 = { x: (offApEnd.x + offEndNode.x) / 2, y: (offApEnd.y + offEndNode.y) / 2 };

              const text1 = `⟵ ${formatLength(d1)}`;
              const text2 = `${formatLength(d2)} ⟶`;

              const padX = 5;
              const padY = 3;

              if (d1 > 0.4) {
                const m1 = ctx.measureText(text1);
                ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
                ctx.beginPath();
                ctx.roundRect(mid1.x - m1.width / 2 - padX, mid1.y - 7 - padY, m1.width + padX * 2, 14 + padY * 2, 4);
                ctx.fill();
                ctx.strokeStyle = '#38bdf8';
                ctx.stroke();
                ctx.fillStyle = '#7dd3fc';
                ctx.fillText(text1, mid1.x, mid1.y);
              }

              if (d2 > 0.4) {
                const m2 = ctx.measureText(text2);
                ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
                ctx.beginPath();
                ctx.roundRect(mid2.x - m2.width / 2 - padX, mid2.y - 7 - padY, m2.width + padX * 2, 14 + padY * 2, 4);
                ctx.fill();
                ctx.strokeStyle = '#38bdf8';
                ctx.stroke();
                ctx.fillStyle = '#7dd3fc';
                ctx.fillText(text2, mid2.x, mid2.y);
              }

              ctx.restore();
            }
          }
        }
      }
    }

    // E. Room Magnetic Snap Target Indicator
    if (roomSnapFeedback) {
      const sMoving = worldToScreen(roomSnapFeedback.movingNode.x, roomSnapFeedback.movingNode.y);
      const sTarget = worldToScreen(roomSnapFeedback.targetNode.x, roomSnapFeedback.targetNode.y);

      ctx.save();
      // Draw glowing target ring at the stationary target
      ctx.strokeStyle = '#22d3ee'; // Cyan-400
      ctx.lineWidth = 3;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.arc(sTarget.x, sTarget.y, 10, 0, Math.PI * 2);
      ctx.stroke();

      // Draw solid ring at the moving corner
      ctx.setLineDash([]);
      ctx.strokeStyle = '#10b981'; // Green-500
      ctx.beginPath();
      ctx.arc(sMoving.x, sMoving.y, 7, 0, Math.PI * 2);
      ctx.stroke();

      // Connection line
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.4)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(sMoving.x, sMoving.y);
      ctx.lineTo(sTarget.x, sTarget.y);
      ctx.stroke();
      
      ctx.restore();
    }

    // E. Active Tool Cursor Ghost Preview
    if (draftMousePos && (activeTool.startsWith('stamp_') || activeTool.startsWith('aperture_') || activeTool === 'alarm_smoke_co')) {
      const gp = worldToScreen(draftMousePos.x, draftMousePos.y);
      ctx.save();
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.7)';
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(gp.x, gp.y, 14, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#38bdf8';
      ctx.font = '600 10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      const label = activeTool.replace('stamp_', '').replace('aperture_', '').replace(/_/g, ' ').toUpperCase();
      ctx.fillText(`+ ${label}`, gp.x, gp.y - 18);
      ctx.restore();
    }

    if(visibleFoundation){ctx.save();for(const e of visibleFoundation){const footprint=foundationFootprint(e);const points=(footprint??foundationPoints(e)).map(p=>worldToScreen(p.x,p.y));const selected=selection.type==='foundation'&&(selection.id===e.id||selection.ids?.includes(e.id));ctx.strokeStyle=selected?'#ffffff':'#38bdf8';ctx.lineWidth=selected?3:2;ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));if(footprint){ctx.closePath();ctx.fillStyle='rgba(56,189,248,.13)';ctx.fill()}ctx.stroke();if(footprint&&'start' in e){const a=worldToScreen(e.start.x,e.start.y),b=worldToScreen(e.end.x,e.end.y);ctx.save();ctx.setLineDash([5,4]);ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.restore()}}for(const e of visibleFoundation)for(const detail of foundationDetailOutlines(e)){ctx.save();ctx.strokeStyle=detail.kind==='opening'?'#fbbf24':'#c084fc';ctx.fillStyle=detail.kind==='opening'?'rgba(251,191,36,.14)':'rgba(192,132,252,.18)';ctx.lineWidth=2;ctx.setLineDash(detail.kind==='opening'?[5,3]:[]);ctx.beginPath();detail.points.map(p=>worldToScreen(p.x,p.y)).forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();}for(const e of validPerimeterCandidate?.members??foundationPreview??[]){const footprint=foundationFootprint(e),pts=(footprint??foundationPoints(e)).map(p=>worldToScreen(p.x,p.y));ctx.save();ctx.strokeStyle='#4ade80';ctx.fillStyle='rgba(74,222,128,.13)';ctx.lineWidth=2;ctx.setLineDash([7,4]);ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));if(footprint){ctx.closePath();ctx.fill()}ctx.stroke();ctx.restore();}if(foundationMarquee){const a=worldToScreen(foundationMarquee.start.x,foundationMarquee.start.y),b=worldToScreen(foundationMarquee.end.x,foundationMarquee.end.y),crossing=foundationMarquee.start.x>foundationMarquee.end.x;ctx.save();ctx.strokeStyle=crossing?'#4ade80':'#38bdf8';ctx.fillStyle=crossing?'rgba(74,222,128,.10)':'rgba(56,189,248,.10)';ctx.lineWidth=1.5;ctx.setLineDash(crossing?[5,4]:[]);ctx.fillRect(a.x,a.y,b.x-a.x,b.y-a.y);ctx.strokeRect(a.x,a.y,b.x-a.x,b.y-a.y);ctx.restore();}if(perimeterOutline){ctx.save();ctx.strokeStyle='#fbbf24';ctx.setLineDash([5,3]);ctx.beginPath();perimeterOutline.map(p=>worldToScreen(p.x,p.y)).forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.stroke();ctx.restore();}if(foundationVertices.length){ctx.strokeStyle='#fbbf24';ctx.lineWidth=2;ctx.beginPath();[...foundationVertices,...(foundationCursor?[foundationCursor]:[])].map(p=>worldToScreen(p.x,p.y)).forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();for(const p of foundationVertices){const q=worldToScreen(p.x,p.y);ctx.fillStyle='#fbbf24';ctx.fillRect(q.x-3,q.y-3,6,6)}}else if(foundationStart&&foundationCursor){const pts=foundationArea(activeTool)&&foundationStart.x!==foundationCursor.x&&foundationStart.y!==foundationCursor.y?rectanglePoints(foundationStart,foundationCursor):[foundationStart,foundationCursor];ctx.strokeStyle='#fbbf24';ctx.lineWidth=2;ctx.beginPath();pts.map(p=>worldToScreen(p.x,p.y)).forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));if(pts.length===4)ctx.closePath();ctx.stroke();if(activeTool==='foundation_wall'&&wallReference!=='centreline'){try{const candidate=createReferencedWall(foundationStart,foundationCursor,'preview',wallReference,parseDimension(wallReferenceWidth,state.settings.unitSystem==='metric')),outline=foundationFootprint(candidate);if(outline){ctx.strokeStyle='#4ade80';ctx.fillStyle='rgba(74,222,128,.12)';ctx.beginPath();outline.map(p=>worldToScreen(p.x,p.y)).forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fill();ctx.stroke();}}catch{/* Invalid or incomplete reference remains uncommitted. */}}}ctx.restore();}
    // Specialist entities share the calibrated CAD world transform.
    if (roofEntities) {
      ctx.save();
      for (const e of [...roofEntities].sort((a,b)=>Number(a.kind==='roofEdge')-Number(b.kind==='roofEdge'))) {
        const points=roofPoints(e).map(p=>worldToScreen(p.x,p.y));
        const color=e.kind==='roofEdge'?({eave:'#4ade80',rake:'#a3e635',ridge:'#fbbf24',hip:'#38bdf8',valley:'#c084fc',abutment:'#fb923c',parapet:'#f472b6',unclassified:'#94a3b8'}[e.edgeType]):e.kind==='roofOpening'?'#f87171':e.kind==='roofSurface'?(e.purpose==='soffit'?'#2dd4bf':'#c084fc'):'#38bdf8';
        const selected=selection.type==='roof'&&(selection.id===e.id||selection.ids?.includes(e.id));
        ctx.strokeStyle=selected?'#ffffff':color;
        ctx.lineWidth=selected?3:1.8;
        ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));
        if ('polygon' in e) { ctx.closePath();ctx.globalAlpha=.13;ctx.fillStyle=color;ctx.fill();ctx.globalAlpha=1; }
        ctx.stroke();
        const center=points.reduce((a,p)=>({x:a.x+p.x/points.length,y:a.y+p.y/points.length}),{x:0,y:0});
        ctx.fillStyle=color;ctx.font='12px sans-serif';ctx.textAlign='center';
        ctx.fillText(e.kind==='roofPlane'?(e.pitchRise===null?'Pitch pending':e.pitchRise+':12'):e.kind==='roofEdge'?e.edgeType:e.kind==='roofOpening'?'Opening':e.purpose,center.x,center.y-5);
        if(e.kind==='roofPlane'&&e.slopeDegrees!==null&&e.pitchRise!==0){
          const t=e.slopeDegrees*Math.PI/180,dx=Math.cos(t),dy=Math.sin(t),x=center.x+dx*24,y=center.y+dy*24;
          ctx.beginPath();ctx.moveTo(center.x,center.y);ctx.lineTo(x,y);ctx.lineTo(x-dx*7-dy*5,y-dy*7+dx*5);ctx.moveTo(x,y);ctx.lineTo(x-dx*7+dy*5,y-dy*7-dx*5);ctx.stroke();
        }
        if((selected||activeTool.startsWith('roof_'))&&'polygon' in e)for(const [i,p] of points.entries()){ctx.fillStyle=roofVertex===i?'#fbbf24':'#fff';ctx.fillRect(p.x-3,p.y-3,6,6);}
      }
      if(roofMarquee){
        const a=worldToScreen(roofMarquee.start.x,roofMarquee.start.y),b=worldToScreen(roofMarquee.end.x,roofMarquee.end.y),crossing=roofMarquee.start.x>roofMarquee.end.x;
        ctx.save();ctx.strokeStyle=crossing?'#4ade80':'#38bdf8';ctx.fillStyle=crossing?'rgba(74,222,128,.10)':'rgba(56,189,248,.10)';ctx.lineWidth=1.5;ctx.setLineDash(crossing?[5,4]:[]);
        ctx.fillRect(a.x,a.y,b.x-a.x,b.y-a.y);ctx.strokeRect(a.x,a.y,b.x-a.x,b.y-a.y);ctx.restore();
      }
      if(generationOutline){ctx.save();ctx.strokeStyle='#fbbf24';ctx.lineWidth=2;ctx.setLineDash([5,4]);ctx.beginPath();generationOutline.map(p=>worldToScreen(p.x,p.y)).forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.stroke();ctx.setLineDash([]);for(const e of generationPreview||[]){if(e.kind==='roofPlane'){ctx.beginPath();e.polygon.map(p=>worldToScreen(p.x,p.y)).forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fillStyle='rgba(56,189,248,.15)';ctx.fill();}else if(e.kind==='roofEdge'){const a=worldToScreen(e.start.x,e.start.y),b=worldToScreen(e.end.x,e.end.y);ctx.strokeStyle=e.edgeType==='ridge'?'#fbbf24':e.edgeType==='hip'?'#38bdf8':'#4ade80';ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}}ctx.restore();}
      if(roofDraft.length){
        ctx.beginPath();ctx.strokeStyle='#fbbf24';ctx.lineWidth=2;
        const preview=(roofMode==='rectangle'||activeTool==='roof_generate')&&roofDraft.length===1&&roofCursor&&roofDraft[0].x!==roofCursor.x&&roofDraft[0].y!==roofCursor.y?rectanglePoints(roofDraft[0],roofCursor):[...roofDraft,...(roofCursor?[roofCursor]:[])];
        preview.map(p=>worldToScreen(p.x,p.y)).forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));if((roofMode==='rectangle'||activeTool==='roof_generate')&&preview.length===4)ctx.closePath();ctx.stroke();
        if(roofMode==='polygon'&&activeTool!=='roof_generate'){
          for(const [i,p] of roofDraft.entries()){const q=worldToScreen(p.x,p.y);ctx.fillStyle=i===0?'#4ade80':'#fbbf24';ctx.fillRect(q.x-3,q.y-3,6,6);}
          if(roofDraft.length>=3){const q=worldToScreen(roofDraft[0].x,roofDraft[0].y);ctx.strokeStyle='#4ade80';ctx.beginPath();ctx.arc(q.x,q.y,8,0,Math.PI*2);ctx.stroke();if(roofTarget?.type==='node'&&distance(roofTarget.point,roofDraft[0])<1e-6){ctx.fillStyle='#4ade80';ctx.fillText('CLOSE POLYGON',q.x+12,q.y-12);}}
        }
        if(roofCursor){const a=roofDraft[roofDraft.length-1],q=worldToScreen(roofCursor.x,roofCursor.y);ctx.fillStyle='#fef3c7';ctx.font='12px sans-serif';ctx.fillText(roofMode==='rectangle'?formatLength(Math.abs(a.x-roofCursor.x))+' × '+formatLength(Math.abs(a.y-roofCursor.y)):formatLength(distance(a,roofCursor)),q.x,q.y-18);}
      }
      if(roofTarget&&(roofTarget.type==='node'||roofTarget.type==='edge')){const q=worldToScreen(roofTarget.point.x,roofTarget.point.y);ctx.strokeStyle=roofTarget.type==='node'?'#4ade80':'#fbbf24';ctx.lineWidth=2;ctx.beginPath();ctx.arc(q.x,q.y,12,0,Math.PI*2);ctx.stroke();ctx.fillStyle=ctx.strokeStyle;ctx.fillText(roofTarget.type==='node'?'LOCKED':'EDGE',q.x,q.y+23);}
      ctx.restore();
    }
    // --- DRAW MARQUEE SELECTION BOX ---
    if (marqueeStart && marqueeEnd) {
      const sp1 = worldToScreen(marqueeStart.x, marqueeStart.y);
      const sp2 = worldToScreen(marqueeEnd.x, marqueeEnd.y);
      const mx = Math.min(sp1.x, sp2.x);
      const my = Math.min(sp1.y, sp2.y);
      const mw = Math.abs(sp2.x - sp1.x);
      const mh = Math.abs(sp2.y - sp1.y);

      ctx.save();
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
      ctx.strokeRect(mx, my, mw, mh);
      ctx.fillRect(mx, my, mw, mh);
      ctx.restore();
    }

    ctx.restore();
  }, [
    state,
    transform,
    selection,
    activeTool,
    activeWallStartNodeId, pendingWallStart,
    draftMousePos,
    snapCandidate,
    roomBoxStart,
    rulerStart,
    rulerEnd,
    formatLength,
    worldToScreen,
    isHoveringUnderlay,
    roomSnapFeedback,
    marqueeStart,
    marqueeEnd,
    foundationEntities,visibleFoundation,foundationPreview,validPerimeterCandidate,perimeterOutline,foundationStart,foundationCursor,foundationVertices,foundationMarquee,wallReference,wallReferenceWidth,
    roofEntities, roofDraft, roofCursor, roofVertex, roofMode, roofTarget, generationOutline, generationPreview, roofMarquee,
  ]);

  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  const finishRoofPolygon = (polygon=roofDraft) => {
    if (!roofEntities || !onRoofChange) return;
    const error=polygonDraftError(polygon);
    if(error){setPolygonError(error);return;}
    setPolygonError('');
    if(activeTool==='roof_generate'){if(polygon.length!==4)return;setCorrection({token:uuidv4(),start:polygon[0],toward:polygon[2],rectangle:true,correct:end=>{setGenerationOutline(rectanglePoints(polygon[0],end));setGenerationPreview(null);setGenerationError('');}});setGenerationOutline(polygon);setGenerationPreview(null);setGenerationError('');setRoofDraft([]);setRoofCursor(null);return;}
    const id=uuidv4(), base={id,physicalId:id,assemblyId:id,source:{reference:'Roof workspace drawing'}};
    let entity:RoofEntity;
    if(activeTool==='roof_plane')entity={...base,kind:'roofPlane',polygon,pitchRise:null,slopeDegrees:null,elevationFt:null};
    else if(activeTool==='roof_opening'){
      const parent=roofEntities.find(e=>e.id===selection.id&&e.kind==='roofPlane');
      if(!parent){alert('Select the parent roof plane before drafting an opening.');return;}
      entity={...base,kind:'roofOpening',polygon,planeId:parent.id,deduction:'unspecified'};
    }else if(activeTool==='roof_soffit'||activeTool==='roof_insulation')entity={...base,kind:'roofSurface',polygon,purpose:activeTool==='roof_soffit'?'soffit':'insulation',pitchRise:null};
    else return;
    try{validateRoofTopology([...roofEntities,entity]);}
    catch(err){setPolygonError((err instanceof Error?err.message:String(err)).replace(/: [\da-f-]{36}( \/ [\da-f-]{36})?/gi,''));return;}
    const token=uuidv4(),before=roofEntities;
    const commit=commitDraftPlacement?commitDraftPlacement(token,[...before,entity]):onRoofChange([...before,entity]);
    if(commit){
      if(roofMode==='rectangle'&&commitDraftPlacement){
        setCorrection({token,start:polygon[0],toward:polygon[2],rectangle:true,correct:end=>{
          const next=[...before,{...entity,polygon:rectanglePoints(polygon[0],end)}];
          validateRoofTopology(next);
          if(!placementHandler.current?.(token,next,true))throw Error('Correction is no longer available. Select the entity to edit it.');
        }});
      }
      setRoofDraft([]);setRoofCursor(null);onToolChange('select');onSelect({type:'roof',id});
    }
  };
  const getRoofSnap=(raw:Point2D)=>{
    const start=roofDraft[roofDraft.length-1];
    const constrained=!!start&&roofMode==='polygon'&&state.settings.orthoMode&&['roof_plane','roof_opening','roof_soffit','roof_insulation'].includes(activeTool);
    if(roofMode==='polygon'&&activeTool!=='roof_generate'&&roofDraft.length>=3){
      const first=roofDraft[0];
      const locked=roofLock.current?.type==='node'&&distance(roofLock.current.point,first)<1e-6;
      const gridTarget=state.settings.gridSnap?snapPointToGrid(raw,state.settings.gridSnapSize):raw;
      // A click on the same grid cell as the first vertex must close the draft,
      // even when grid spacing is larger than the screen-space capture radius.
      if(distance(raw,first)<=(locked?30:15)/transform.scale||distance(gridTarget,first)<=1e-6){
        const target:RoofSnap={point:first,type:'node'};roofLock.current=target;return target;
      }
    }
    if(roofMode==='polygon'&&activeTool!=='roof_generate'){
      const draftNode=roofDraft.find(q=>distance(raw,q)<=15/transform.scale&&(!constrained||Math.abs(q.x-start.x)<1e-6||Math.abs(q.y-start.y)<1e-6));
      if(draftNode){const target:RoofSnap={point:draftNode,type:'node'};roofLock.current=target;return target;}
    }
    const target=roofSnap(raw,roofEntities||[],15/transform.scale,state.settings.gridSnap?state.settings.gridSnapSize:null,roofLock.current,30/transform.scale,q=>!constrained||Math.abs(q.x-start.x)<1e-6||Math.abs(q.y-start.y)<1e-6);
    if(constrained&&(target.type==='grid'||target.type==='free'))target.point=orthoPoint(start,target.point);
    roofLock.current=target.type==='node'?target:null;return target;
  };
  const addRoofPoint=(point:Point2D)=>{
    if((roofMode==='rectangle'||activeTool==='roof_generate')&&roofDraft.length===1){try{finishRoofPolygon(rectanglePoints(roofDraft[0],point));}catch(err){setDimensionError(String(err));}return;}
    if(roofDraft.some(q=>distance(point,q)<=1e-6)){setPolygonError('This vertex already exists. Choose a different point or close at the first vertex.');return;}
    if(roofDraft.length&&roofMode==='polygon'){
      const before=roofDraft,anchor=before[before.length-1];
      setCorrection({token:uuidv4(),start:anchor,toward:point,rectangle:false,correct:end=>{
        if(before.some(q=>distance(q,end)<=1e-6))throw Error('Requested endpoint coincides with an existing draft vertex.');
        setRoofDraft([...before,end]);
      }});
    }
    setPolygonError('');setRoofDraft(prev=>[...prev,point]);
    roofLock.current=null;
  };
  const commitFloorRectangle=(start:Point2D,end:Point2D,exact=false)=>{
    const token=uuidv4(),idPrefix=uuidv4();
    const build=(end:Point2D,exact:boolean):FloorplanState=>{
      const x1=start.x,y1=start.y,x2=end.x,y2=end.y;
      if(Math.abs(x2-x1)<=1e-6||Math.abs(y2-y1)<=1e-6)throw Error('Rectangle requires nonzero width and depth.');
      {

          const presetProps = getWallPropertiesFromPreset(activeWallPreset);
          const rawPoints = [{ x: x1, y: y1 }, { x: x2, y: y1 }, { x: x2, y: y2 }, { x: x1, y: y2 }];
          const fullWallThickness = getWallThickness(presetProps);
          const centerlinePoints = convertInputToCenterlineNodes(rawPoints, fullWallThickness, state.settings.wallJustification);
          const n1: CadNode = { id: `n_${idPrefix}_1`, x: centerlinePoints[0].x, y: centerlinePoints[0].y };
          const n2: CadNode = { id: `n_${idPrefix}_2`, x: centerlinePoints[1].x, y: centerlinePoints[1].y };
          const n3: CadNode = { id: `n_${idPrefix}_3`, x: centerlinePoints[2].x, y: centerlinePoints[2].y };
          const n4: CadNode = { id: `n_${idPrefix}_4`, x: centerlinePoints[3].x, y: centerlinePoints[3].y };
          const w1: CadWall = { id: `w_${idPrefix}_1`, startNodeId: n1.id, endNodeId: n2.id, ...presetProps, height: state.settings.defaultWallHeight };
          const w2: CadWall = { id: `w_${idPrefix}_2`, startNodeId: n2.id, endNodeId: n3.id, ...presetProps, height: state.settings.defaultWallHeight };
          const w3: CadWall = { id: `w_${idPrefix}_3`, startNodeId: n3.id, endNodeId: n4.id, ...presetProps, height: state.settings.defaultWallHeight };
          const w4: CadWall = { id: `w_${idPrefix}_4`, startNodeId: n4.id, endNodeId: n1.id, ...presetProps, height: state.settings.defaultWallHeight };
          const newNodes = [n1, n2, n3, n4];
          const newWalls = [w1, w2, w3, w4];

          // Auto-merge with existing topology and deduplicate overlapping walls
          const { nodes: mergedNodes, walls: mergedWalls, rooms: mergedRooms } = mergeCoincidentNodes([...state.nodes, ...newNodes], [...state.walls, ...newWalls], state.rooms, exact?1e-7:0.4);
          const { walls: dedupWalls, rooms: dedupRooms, apertures: dedupApertures } = deduplicateWalls(mergedWalls, mergedRooms, state.apertures, mergedNodes);
          const partitioned = partitionCrossingWalls(mergedNodes, dedupWalls, dedupApertures);
          const detectedRooms = detectRoomFaces(partitioned.nodes, partitioned.walls, dedupRooms, state.settings.defaultWallHeight);
          if(exact&&(partitioned.walls.length!==state.walls.length+4||partitioned.nodes.length!==state.nodes.length+4||partitioned.apertures.length!==state.apertures.length))throw Error('Exact rectangle conflicts with existing connected geometry.');
          return { ...state, nodes: partitioned.nodes, walls: partitioned.walls, rooms: detectedRooms, apertures: partitioned.apertures };
        }
    };
    try{
      const next=build(end,exact);
      if(commitDraftPlacement){if(!commitDraftPlacement(token,next))throw Error('Placement rejected.');setCorrection({token,start,toward:end,rectangle:true,correct:q=>{if(!placementHandler.current?.(token,build(q,true),true))throw Error('Correction is no longer available or conflicts with geometry.');}});}
      else onChange(next);
      return true;
    }catch(err){setDimensionError(err instanceof Error?err.message:String(err));return false;}
  };
  const commitFloorSegment=(draftResult:{point:Point2D;type:string;nodeId?:string;wallId?:string})=>{
    if(!activeWallStartNodeId)return;
    const anchor=state.nodes.find(n=>n.id===activeWallStartNodeId)||pendingWallStart;
    if(!anchor)return;
    if(pendingWallStart&&pendingStartState.current!==state){setDimensionError('Drawing changed. Cancel and restart the wall.');return;}
    const token=uuidv4(),wallId=uuidv4(),freeEndId=uuidv4(),startWallId=pendingStartWall.current;
    const build=(result:typeof draftResult,correction=false)=>{
      let nodes=[...state.nodes],walls=[...state.walls],apertures=[...state.apertures];
      let startId=anchor.id;
      if(pendingWallStart){
        if(startWallId){const split=splitWallAtPoint(startWallId,anchor,nodes,walls,apertures);nodes=split.nodes;walls=split.walls;apertures=split.apertures;startId=split.splitNodeId;}
        else nodes.push(anchor);
      }
      let endId=result.nodeId;
      if(result.type==='wall'&&result.wallId){const split=splitWallAtPoint(result.wallId,result.point,nodes,walls,apertures);nodes=split.nodes;walls=split.walls;apertures=split.apertures;endId=split.splitNodeId;}
      else if(!endId){endId=freeEndId;nodes.push({id:endId,...result.point});}
      if(endId===startId||distance(anchor,result.point)<=1e-6)throw Error('Wall requires a nonzero length.');
      walls.push({id:wallId,startNodeId:startId,endNodeId:endId,...getWallPropertiesFromPreset(activeWallPreset),height:state.settings.defaultWallHeight});
      const partitioned=partitionCrossingWalls(nodes,walls,apertures);
      if(correction&&(partitioned.nodes.length!==nodes.length||partitioned.walls.length!==walls.length||partitioned.apertures.length!==apertures.length))throw Error('Exact length intersects existing geometry.');
      const rooms=detectRoomFaces(partitioned.nodes,partitioned.walls,state.rooms,state.settings.defaultWallHeight);
      const map=new Map(partitioned.nodes.map(n=>[n.id,n]));
      return {endId,next:{...state,nodes:partitioned.nodes,walls:partitioned.walls,apertures:partitioned.apertures,rooms,decks:state.decks.map(d=>({...d,ledgerLengthLf:computeDeckLedger(d.points,partitioned.walls,map)}))}};
    };
    try{
      const placed=build(draftResult);
      if(commitDraftPlacement){if(!commitDraftPlacement(token,placed.next))throw Error('Wall placement rejected.');}
      else onChange(placed.next);
      const connected=draftResult.type==='wall'||!!draftResult.nodeId;
      if(commitDraftPlacement)setCorrection({token,start:anchor,toward:draftResult.point,rectangle:false,correct:q=>{
        if(connected||startWallId)throw Error('Connected geometry requires coordinated editing.');
        if(state.nodes.some(n=>n.id!==anchor.id&&distance(n,q)<=1e-6))throw Error('Exact endpoint coincides with existing geometry.');
        const corrected=build({point:q,type:'none'},true);
        if(!placementHandler.current?.(token,corrected.next,true))throw Error('Correction is no longer available or conflicts with geometry.');
        setActiveWallStartNodeId(corrected.endId);
      }});
      setPendingWallStart(null);pendingStartWall.current=undefined;pendingStartState.current=null;
      lockedSnapNodeRef.current=null;
      if(connected){setActiveWallStartNodeId(null);setDraftMousePos(null);onToolChange('select');}
      else setActiveWallStartNodeId(placed.endId);
    }catch(err){setDimensionError(err instanceof Error?err.message:String(err));}
  };
  const foundationTool=!!foundationEntities&&activeTool.startsWith('foundation_');
  const perimeterTool=foundationTool&&activeTool==='foundation_perimeter';
  const foundationPolygon=foundationTool&&(perimeterTool||foundationArea(activeTool)&&foundationMode==='polygon');
  const foundationSnap=(raw:Point2D)=>{if(foundationPolygon&&foundationVertices.length>=3&&distance(raw,foundationVertices[0])<=12/transform.scale)return foundationVertices[0];const near=nearestFoundationSnap(raw,visibleFoundation??[],12/transform.scale);const q=near?.point??(state.settings.gridSnap?snapPointToGrid(raw,state.settings.gridSnapSize):raw);const last=foundationVertices[foundationVertices.length-1];return perimeterTool&&last?orthoPoint(last,q):foundationStart&&state.settings.orthoMode&&!foundationArea(activeTool)?orthoPoint(foundationStart,q):q;};
  const placeFoundation=(start:Point2D,end:Point2D):boolean=>{if(!foundationEntities||!commitDraftPlacement){setDimensionError('Foundation placement unavailable');return false;}const before=foundationEntities,id=uuidv4(),token=uuidv4(),tool=activeTool;const reference=wallReference,width=parseDimension(wallReferenceWidth,state.settings.unitSystem==='metric');const build=(p:Point2D)=>[...before,tool==='foundation_wall'&&reference!=='centreline'?createReferencedWall(start,p,id,reference,width):createFoundationDraft(tool,start,p,id)];try{if(!commitDraftPlacement(token,build(end)))throw Error('Foundation placement rejected');const continuous=foundationContinuous&&!foundationArea(tool)&&(tool!=='foundation_wall'||reference==='centreline');setFoundationStart(continuous?end:null);setFoundationCursor(null);onSelect({type:'foundation',id});setCorrection({token,start,toward:end,rectangle:foundationArea(tool),correct:q=>{if(!placementHandler.current?.(token,build(q),true))throw Error('Correction rejected or placement changed');if(continuous)setFoundationStart(q);}});setDimensionError('');return true;}catch(err){setDimensionError(err instanceof Error?err.message:String(err));return false;}};
  const finishFoundationPolygon=()=>{if(!foundationEntities||!onFoundationChange||foundationVertices.length<3)return;try{if(perimeterTool){if(foundationVertices.length<4)throw Error('Perimeter requires at least four vertices');const error=polygonDraftError(foundationVertices);if(error)throw Error(error);const outline=foundationVertices.map(p=>({...p}));if(outline.some((p,i)=>{const q=outline[(i+1)%outline.length];return (p.x===q.x)===(p.y===q.y)}))throw Error('Close perimeter with orthogonal edges');setPerimeterOutline(outline);setPerimeterCandidate(null);setPerimeterError('');setFoundationVertices([]);setFoundationCursor(null);setCorrection(null);setDimensionA('');setDimensionError('');return;}const id=uuidv4(),entity=createFoundationDraft(activeTool,foundationVertices[0],foundationVertices[1],id,foundationVertices);if(!onFoundationChange([...foundationEntities,entity]))throw Error('Foundation polygon rejected');setFoundationVertices([]);setFoundationCursor(null);setDimensionA('');draftDirection.current=null;setDimensionError('');onSelect({type:'foundation',id});}catch(err){setDimensionError(err instanceof Error?err.message:String(err));}};
  const addFoundationVertex=(p:Point2D):boolean=>{if(foundationVertices.length>=3&&distance(p,foundationVertices[0])<=1e-8){finishFoundationPolygon();return false}if(foundationVertices.some(v=>distance(v,p)<=1e-8)){setDimensionError('Choose a different polygon vertex');return false}setFoundationVertices(v=>[...v,p]);setDimensionError('');return true;};
  const roofAreaTool=['roof_plane','roof_opening','roof_soffit','roof_insulation','roof_generate'].includes(activeTool);
  const rectangularDraft=(foundationTool&&foundationArea(activeTool)&&!foundationPolygon)||activeTool==='roof_generate'||activeTool==='wall_rect'||activeTool==='room_box'||(roofAreaTool&&roofMode==='rectangle');
  const dimensionStart=foundationTool?(foundationPolygon?foundationVertices[foundationVertices.length-1]:foundationStart):roofAreaTool?roofDraft[roofDraft.length-1]:activeTool==='wall_pen'?(state.nodes.find(n=>n.id===activeWallStartNodeId)||pendingWallStart):rectangularDraft?roomBoxStart:null;
  const dimensionToward=foundationTool?foundationCursor:roofAreaTool?roofCursor:draftMousePos;
  const liveStart=recent?.start||dimensionStart;
  const liveEnd=recent?.toward||draftDirection.current||dimensionToward;
  const liveRect=recent?.rectangle??rectangularDraft;
  const liveUnit=state.settings.unitSystem==='metric'?'m':'ft';
  const liveFormat=(v:number)=>(v*(liveUnit==='m'?0.3048:1)).toFixed(2);
  const liveValue=liveStart&&liveEnd?(liveRect?liveFormat(Math.abs(liveEnd.x-liveStart.x))+' × '+liveFormat(Math.abs(liveEnd.y-liveStart.y)):liveFormat(Math.hypot(liveEnd.x-liveStart.x,liveEnd.y-liveStart.y)))+' '+liveUnit:null;
  const nextFoundationLength=foundationTool&&foundationContinuous&&recent&&foundationStart&&foundationCursor&&!foundationPolygon&&!foundationArea(activeTool)?liveFormat(Math.hypot(foundationCursor.x-foundationStart.x,foundationCursor.y-foundationStart.y))+' '+liveUnit:null;
  const commitDimensions=(value=dimensionA)=>{
    try{
      const last=recentRef.current;
      const start=last?.start||dimensionStart,toward=last?.toward||draftDirection.current||dimensionToward;
      const rectangle=last?.rectangle??rectangularDraft;
      if(!start||!toward)throw Error('Place geometry or indicate a drafting direction first.');
      const fields=value.split(',');const metric=state.settings.unitSystem==='metric';
      const a=parseDimension(fields[0]||'',metric),b=parseDimension(fields[1]||'',metric);
      if(a===null||(rectangle?(b===null||fields.length!==2):fields.length!==1))throw Error(rectangle?'Enter positive width,depth.':'Enter one positive length.');
      const end=rectangle?exactRectangleCorner(start,toward,a,b!):exactEndpoint(start,toward,a);
      if(last){
        last.correct(end);
        if(recentRef.current?.token===last.token)setCorrection({...last,toward:end});
      }
      else if(foundationPolygon){if(!addFoundationVertex(end))return;}
      else if(foundationTool&&start){if(!placeFoundation(start,end))return;}
      else if(roofAreaTool)addRoofPoint(end);
      else if(rectangle){if(!commitFloorRectangle(start,end,true))return;setRoomBoxStart(null);onToolChange('select');}
      else commitFloorSegment({point:end,type:'none'});
      setDimensionA('');setDimensionError('');draftDirection.current=null;
    }catch(err){setDimensionError(err instanceof Error?err.message:String(err));}
  };
  dimensionCommand.current=commitDimensions;
  useEffect(()=>{
    const handler=(e:KeyboardEvent)=>{
      const target=e.target;
      if(e.ctrlKey||e.metaKey||e.altKey||e.isComposing||e.defaultPrevented||document.querySelector('[aria-modal="true"]'))return;
      if(target instanceof HTMLElement&&(target.isContentEditable||target.closest('input,textarea,select,button,[role="dialog"]')))return;
      if(!recentRef.current&&!dimensionStart)return;
      if(e.key==='Escape'&&dimensionA){e.preventDefault();e.stopImmediatePropagation();setDimensionA('');setDimensionError('');draftDirection.current=null;return;}
      if(e.key==='Enter'&&dimensionA){e.preventDefault();e.stopImmediatePropagation();dimensionCommand.current(dimensionA);return;}
      if(e.key==='Backspace'&&dimensionA){e.preventDefault();e.stopImmediatePropagation();setDimensionA(v=>v.slice(0,-1));return;}
      if(/^[0-9.,'"/ mmcftine-]$/.test(e.key)&&(/^\d|^\./.test(e.key)||dimensionA)){
        e.preventDefault();e.stopImmediatePropagation();
        if(!dimensionA)draftDirection.current=dimensionToward?{...dimensionToward}:null;
        setDimensionA(v=>v+e.key);
      }
    };
    window.addEventListener('keydown',handler,true);return()=>window.removeEventListener('keydown',handler,true);
  },[dimensionA,dimensionStart,dimensionToward]);
  const generationBase=()=>{
    const entities=roofEntities||[];
    if(!generationSource)return entities;
    if(!entities.includes(generationSource))throw Error('Selected roof geometry changed. Cancel and reopen generation.');
    if(generationSource.kind==='roofPlane'&&generationSource.elevationFt!==null)throw Error('Selected plane has an established elevation datum. Manual reconciliation is required before replacing it with a relative-datum skeleton.');
    if(entities.some(e=>(e.kind==='roofEdge'&&e.planeIds.includes(generationSource.id))||(e.kind==='roofOpening'&&e.planeId===generationSource.id)))throw Error('Selected roof plane has dependent edges or openings. Review those dependencies before replacement.');
    return entities.filter(e=>e.id!==generationSource.id);
  };
  // Handle Mouse Down
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;
    const rawWorld = screenToWorld(clientX, clientY);

    if (e.button === 2) {
      // Right Click Context Menu
      if (onContextMenu) {
        onContextMenu(e, rawWorld);
      }
      return;
    }

    // Pan with Middle Click or Shift/Space drag
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      setIsPanning(true);
      setPanStart({ x: clientX, y: clientY });
      return;
    }

    if (e.button !== 0) return; // Only left click for drawing/selecting
    setCorrection(null);setDimensionA('');setDimensionError('');draftDirection.current=null;
    if(foundationTool&&document.activeElement instanceof HTMLElement)document.activeElement.blur();

    if(foundationEntities&&(foundationTool||activeTool==='select')){if(foundationTool){if(perimeterTool&&perimeterOutline)return;const p=foundationSnap(rawWorld);if(foundationPolygon)addFoundationVertex(p);else if(!foundationStart)setFoundationStart(p);else placeFoundation(foundationStart,p);}else{const hit=[...(visibleFoundation??[])].reverse().find(q=>{const footprint=foundationFootprint(q);return !!(footprint&&isPointInPolygon(rawWorld,footprint))||('start' in q&&segmentDistance(rawWorld,q.start,q.end).distance<=10/transform.scale)});foundationDrag.current={start:rawWorld,screen:{x:clientX,y:clientY},hitId:hit?.id,shift:e.shiftKey};}return;}
    if (roofEntities && onRoofChange && (activeTool.startsWith('roof_') || activeTool==='select')) {
      const tolerance=10/transform.scale;
      if(generationOutline||(activeTool==='roof_generate'&&selection.type==='roof'))return;
      const snapped=getRoofSnap(rawWorld).point;
      if(activeTool==='roof_edge'){
        const existing=roofEntities.find(q=>q.kind==='roofEdge'&&segmentDistance(rawWorld,q.start,q.end).distance<=tolerance);
        if(existing){onToolChange('select');onSelect({type:'roof',id:existing.id});return;}
        const boundary=boundaryAt(rawWorld,roofEntities,tolerance);
        if(!boundary){setPolygonError('Click a roof plane boundary to classify an edge.');return;}
        const id=uuidv4(),entity:RoofEntity={id,physicalId:id,assemblyId:id,source:{reference:'Roof workspace drawing'},kind:'roofEdge',...boundary,edgeType:'unclassified'};
        if(onRoofChange([...roofEntities,entity])){onToolChange('select');onSelect({type:'roof',id});}
        return;
      }
      if(activeTool==='roof_vertex'){
        const entity=roofEntities.find(q=>q.id===selection.id);
        if(!entity||!('polygon' in entity)){alert('Select a roof polygon first.');return;}
        if(roofVertex===null){const i=entity.polygon.findIndex(p=>distance(p,rawWorld)<=tolerance);if(i>=0)setRoofVertex(i);}
        else {try {const next=moveRoofVertex(roofEntities,entity.id,roofVertex,snapped);if(onRoofChange(next))setRoofVertex(null);}catch(err){alert(err instanceof Error?err.message:String(err));}}
        return;
      }
      if(activeTool==='select'){
        const hit=[...roofEntities].reverse().find(q=>q.kind==='roofEdge'&&segmentDistance(rawWorld,q.start,q.end).distance<=tolerance)
          ||[...roofEntities].reverse().find(q=>'polygon' in q&&isPointInPolygon(rawWorld,q.polygon));
        // Preserve ordinary annotation clicks; roof drags remain separate from floor marquee.
        const noteHit=!hit&&!e.shiftKey&&(state.annotations||[]).some(a=>distance(rawWorld,{x:a.x,y:a.y})<=tolerance);
        if(!noteHit){
          roofDrag.current={start:rawWorld,screen:{x:clientX,y:clientY},hitId:hit?.id,shift:e.shiftKey};
          return;
        }
      }else {
        if(activeTool==='roof_opening'&&!roofEntities.some(q=>q.id===selection.id&&q.kind==='roofPlane')){alert('Select the parent roof plane first.');return;}
        if(activeTool!=='roof_generate'&&roofMode==='polygon'&&roofDraft.length>=3&&distance(snapped,roofDraft[0])<=1e-6){
          const last=roofDraft[roofDraft.length-1],first=roofDraft[0];
          if(state.settings.orthoMode&&Math.abs(last.x-first.x)>1e-6&&Math.abs(last.y-first.y)>1e-6){setPolygonError('Closing edge is diagonal. Use Finish polygon to deliberately close it.');return;}
          finishRoofPolygon();return;
        }
        addRoofPoint(snapped);
        return;
      }
    }
    const snap = getSmartSnapPoint(rawWorld, activeWallStartNodeId);
    const isSnapEnabled = state.settings.gridSnap;
    const shouldSnap = isSnapEnabled && activeTool !== 'calibrate_scale';

    const toggleSelection = (type: SelectionState['type'], id: string, event: React.MouseEvent) => {
      const isShift = event.shiftKey;
      const isCtrl = event.ctrlKey || event.metaKey;
      
      let currentIds = selection.ids ? [...selection.ids] : (selection.id ? [selection.id] : []);
      let newIds = [...currentIds];

      if (isCtrl && isShift) {
        // Subtract Mode: Strictly remove
        newIds = newIds.filter(i => i !== id);
      } else if (isCtrl) {
        // Add Mode: Strictly add
        if (!newIds.includes(id)) newIds.push(id);
      } else if (isShift) {
        // Toggle Mode: Invert
        if (newIds.includes(id)) {
          newIds = newIds.filter(i => i !== id);
        } else {
          newIds.push(id);
        }
      } else {
        // No Modifier: Replace
        // If already part of a multi-selection, defer replacement to handle group drag
        if (currentIds.includes(id) && currentIds.length > 1) {
          setPendingSelectionOnMouseUp({ type, id, ids: [id] });
          return; 
        }
        newIds = [id];
      }

      if (newIds.length === 0) {
        onSelect({ type: 'none' });
      } else if (newIds.length === 1) {
        // If it's a single item, use its specific type to open the Inspector
        onSelect({ type, id: newIds[0], ids: newIds });
      } else {
        onSelect({ type: 'multiple', ids: newIds });
      }
    };
    
    // --- TOOL: CALIBRATE SCALE ---
    if (activeTool === 'calibrate_scale') {
      if (calibrationPoints.length === 0) {
        setCalibrationPoints([rawWorld]);
      } else {
        const p1 = calibrationPoints[0];
        let p2 = rawWorld;

        // Apply Ortho snapping if Shift is held
        if (e.shiftKey) {
          const dx = Math.abs(p2.x - p1.x);
          const dy = Math.abs(p2.y - p1.y);
          if (dx > dy) {
            p2 = { x: p2.x, y: p1.y };
          } else {
            p2 = { x: p1.x, y: p2.y };
          }
        }

        const distWorld = distance(p1, p2);
        
        const actualDist = prompt("Enter actual distance for this segment (e.g. 12' 6\" or 12.5):", "10");
        if (actualDist && state.underlay && underlayImageRef.current) {
          let feet = parseFloat(actualDist);
          if (actualDist.includes("'")) {
            const parts = actualDist.split("'");
            feet = parseFloat(parts[0]);
            if (parts[1] && parts[1].includes('"')) {
              feet += parseFloat(parts[1].replace('"', '')) / 12;
            } else if (parts[1] && parts[1].trim()) {
              feet += parseFloat(parts[1]) / 12;
            }
          }

          if (!isNaN(feet) && feet > 0) {
            // Convert canvas screen click coordinates to Image Native Pixels
            const imgX1 = (p1.x - state.underlay.worldX) / state.underlay.feetPerPixel;
            const imgY1 = (p1.y - state.underlay.worldY) / state.underlay.feetPerPixel;
            const imgX2 = (p2.x - state.underlay.worldX) / state.underlay.feetPerPixel;
            const imgY2 = (p2.y - state.underlay.worldY) / state.underlay.feetPerPixel;
            
            // Calculate raw native pixel distance
            const nativePixelDist = Math.hypot(imgX2 - imgX1, imgY2 - imgY1);
            
            // Calculate new scale (World Feet per native image pixel)
            const newFeetPerPixel = feet / nativePixelDist;
            
            const updatedUnderlay = {
              ...state.underlay,
              feetPerPixel: newFeetPerPixel,
            };
            
            onChange({ ...state, underlay: updatedUnderlay });
          }
        }
        setCalibrationPoints([]);
        onToolChange('select');
      }
      return;
    }

    const snapInc = state.settings.gridSnapSize || 0.5;
    let worldPoint = snap.point;

    if (activeTool === 'ruler_measure') {
      const rulerSnap = getSmartSnapPoint(rawWorld);
      if (!rulerStart) { setRulerStart(rulerSnap.point); setRulerEnd(rulerSnap.point); }
      else { setRulerEnd(rulerSnap.point); }
      return;
    }

    if (activeTool === 'wall_rect' || activeTool === 'room_box') {
      if (!roomBoxStart) { setRoomBoxStart(worldPoint); }
      else {
        if(!commitFloorRectangle(roomBoxStart,worldPoint))return;
        setRoomBoxStart(null);
        lockedSnapNodeRef.current = null;
        onToolChange('select');
      }
      return;
    }

    if (activeTool === 'wall_pen') {
      if (e.detail >= 2) {
        setActiveWallStartNodeId(null);
        setDraftMousePos(null);
        lockedSnapNodeRef.current = null;
        onToolChange('select');
        return;
      }

      if (!activeWallStartNodeId) {
        if(snap.nodeId){setActiveWallStartNodeId(snap.nodeId);setPendingWallStart(null);}
        else {const node={id:uuidv4(),...worldPoint};setPendingWallStart(node);pendingStartState.current=state;pendingStartWall.current=snap.type==='wall'?snap.wallId:undefined;setActiveWallStartNodeId(node.id);}
        lockedSnapNodeRef.current=null;
      } else {
        const draftResult = computeDraftPoint(rawWorld, activeWallStartNodeId);
        commitFloorSegment(draftResult);
      }
      return;
    }

    if (activeTool === 'text_label') {
      const newAnnotation: CadAnnotation = { id: `ann_${Date.now()}`, x: Math.round(worldPoint.x * 10) / 10, y: Math.round(worldPoint.y * 10) / 10, text: 'Plan Note / Specification', fontSize: 14, color: '#38bdf8', rotation: 0 };
      onChange({ ...state, annotations: [...(state.annotations || []), newAnnotation] });
      onSelect({ type: 'annotation', id: newAnnotation.id });
      if (!isStickyMode) { onToolChange('select'); }
      return;
    }

    if (activeTool.startsWith('aperture_')) {
      const nodeMap = new Map<string, CadNode>(); state.nodes.forEach((n) => nodeMap.set(n.id, n));
      let hitWall: CadWall | null = null; let hitOffset = 0;
      state.walls.forEach((w) => {
        const n1 = nodeMap.get(w.startNodeId), n2 = nodeMap.get(w.endNodeId);
        if (!n1 || !n2) return;
        const proj = projectPointOntoSegment(rawWorld, n1, n2);
        if (proj.distance < 1.2) { hitWall = w; hitOffset = proj.t * distance(n1, n2); }
      });
      if (hitWall) {
        let apType: Aperture['type'] = 'door_passage', width = 3.0, height = 6.67;
        if (activeTool === 'aperture_window') { 
          apType = 'window_standard'; 
          width = DEFAULT_WINDOW_WIDTH; 
          height = DEFAULT_WINDOW_HEIGHT; 
        }
        else if (activeTool === 'aperture_pocket_door') { apType = 'door_pocket'; width = 2.67; }
        else if (activeTool === 'aperture_exterior_door') { apType = 'door_exterior'; width = 3.0; }
        else if (activeTool === 'aperture_garage') { apType = 'door_garage'; width = 9.0; height = 8.0; }
        else if (activeTool === 'aperture_patio_slider') { apType = 'door_sliding_patio'; width = 6.0; }
        else if (activeTool === 'aperture_bifold_single') { apType = 'door_bifold_single'; width = 2.5; }
        else if (activeTool === 'aperture_bifold_double') { apType = 'door_bifold_double'; width = 5.0; }
        else if (activeTool === 'aperture_cased_opening') { apType = 'cased_opening'; width = 3.0; }

        // Boundary clamp: keep aperture fully within wall (min 1" jamb from each end)
        const wallGeom = getWallGeometry(hitWall, nodeMap);
        const wallLen = wallGeom ? wallGeom.length : width + 2;
        const minJamb = 1 / 12; // 1 inch minimum from wall end
        const halfW = width / 2;
        let clampedOffset = Math.max(minJamb, Math.min(wallLen - width - minJamb, hitOffset - halfW));

        // Overlap prevention: push new aperture away from existing apertures on this wall
        const existingOnWall = state.apertures.filter((a) => a.wallId === (hitWall as CadWall).id);
        existingOnWall.sort((a, b) => a.offset - b.offset);
        for (const existing of existingOnWall) {
          const existEnd = existing.offset + existing.width;
          const newEnd = clampedOffset + width;
          // Overlap: push right past existing
          if (clampedOffset < existEnd && newEnd > existing.offset) {
            if (clampedOffset + halfW < existing.offset + existing.width / 2) {
              // Cursor is left of existing center → push left
              clampedOffset = Math.max(minJamb, existing.offset - width - minJamb / 2);
            } else {
              // Cursor is right of existing center → push right
              clampedOffset = Math.min(wallLen - width - minJamb, existEnd + minJamb / 2);
            }
          }
        }

        // Final clamp after overlap resolution
        clampedOffset = Math.max(minJamb, Math.min(wallLen - width - minJamb, clampedOffset));

        const newAperture: Aperture = { id: `ap_${Date.now()}`, wallId: (hitWall as CadWall).id, offset: Math.round(clampedOffset * 100) / 100, width, height, type: apType, swingSide: 'inward' };
        onChange({ ...state, apertures: [...state.apertures, newAperture] });
        onSelect({ type: 'aperture', id: newAperture.id });
        if (!isStickyMode) { onToolChange('select'); }
      }
      return;
    }

    const stampTypeMap: Record<string, CadStamp['type']> = {
      stamp_column: 'column_post', stamp_pier: 'helical_pier', stamp_beam: 'beam_segment', stamp_stair: 'stair_run',
      stamp_switch: 'switch_std', stamp_dimmer: 'switch_dimmer', stamp_3way: 'switch_3way', stamp_electrical_panel: 'electrical_panel', stamp_outlet: 'outlet_std',
      stamp_gfci: 'outlet_gfci', stamp_240v: 'outlet_240v', stamp_ev: 'outlet_ev', stamp_potlight: 'light_potlight',
      stamp_light_fixture: 'light_fixture', stamp_coach_light: 'light_coach', stamp_soffit_light: 'light_soffit',
      stamp_sconce: 'light_fixture', // Mapping sconce to light_fixture
      stamp_fan_ceiling: 'fan_ceiling', stamp_fan_exhaust: 'fan_exhaust', stamp_rangehood: 'fan_rangehood',
      alarm_smoke_co: 'alarm_smoke_co', stamp_plumbing_toilet: 'plumbing_toilet', stamp_plumbing_sink: 'plumbing_sink',
      stamp_plumbing_shower: 'plumbing_shower', stamp_plumbing_tub: 'plumbing_tub', stamp_plumbing_hose_bib: 'plumbing_hose_bib',
      stamp_plumbing_water_heater: 'plumbing_water_heater', stamp_plumbing_fixture: 'plumbing_fixture', stamp_utility_trench: 'utility_trench',
    };

    if (activeTool in stampTypeMap || activeTool.startsWith('stamp_') || activeTool === 'alarm_smoke_co') {
      const stampType = stampTypeMap[activeTool] || (activeTool.replace('stamp_', '') as CadStamp['type']);
      const newStamp: CadStamp = {
        id: `st_${Date.now()}`,
        type: stampType,
        x: Math.round(worldPoint.x * 10) / 10,
        y: Math.round(worldPoint.y * 10) / 10,
        parentType: 'canvas',
        rotation: 0,
        length: stampType === 'beam_segment' ? 12.0 : stampType === 'utility_trench' ? 25.0 : undefined,
        panelType: (stampType === 'electrical_panel' || (stampType as string) === 'stamp_electrical_panel') ? 'main' : undefined,
        panelAmperage: (stampType === 'electrical_panel' || (stampType as string) === 'stamp_electrical_panel') ? '200A' : undefined
      };
      onChange({ ...state, stamps: [...state.stamps, newStamp] });
      onSelect({ type: 'stamp', id: newStamp.id });
      if (!isStickyMode) { onToolChange('select'); }
      return;
    }

    if (activeTool === 'select') {
      dragInitialStateRef.current = state;
      const hitNode = state.nodes.find((n) => distance(rawWorld, n) < 0.8);
      if (hitNode) { toggleSelection('node', hitNode.id, e); setIsDraggingElement(true); setDragStartPoint(worldPoint); setHasMovedDuringDrag(false); return; }
      const hitAnnotation = (state.annotations || []).find((ann) => distance(rawWorld, { x: ann.x, y: ann.y }) < 2.5);
      if (hitAnnotation) { toggleSelection('annotation', hitAnnotation.id, e); setIsDraggingElement(true); setDragStartPoint(worldPoint); setHasMovedDuringDrag(false); return; }
      const nodeMap = new Map<string, CadNode>(); state.nodes.forEach((n) => nodeMap.set(n.id, n));
      const hitAperture = state.apertures.find((ap) => {
        const wall = state.walls.find((w) => w.id === ap.wallId); if (!wall) return false;
        const geom = getApertureGeometry(ap, wall, nodeMap); if (!geom) return false;
        return distance(rawWorld, geom.center) < geom.width / 2 + 0.5;
      });
      if (hitAperture) { toggleSelection('aperture', hitAperture.id, e); setIsDraggingElement(true); setDragStartPoint(worldPoint); setHasMovedDuringDrag(false); return; }
      const hitStamp = state.stamps.find((st) => {
        if (st.type === 'beam_segment' || st.type === 'utility_trench') {
          const len = st.length || 12, rad = ((st.rotation || 0) * Math.PI) / 180;
          const p1 = { x: st.x - (len / 2) * Math.cos(rad), y: st.y - (len / 2) * Math.sin(rad) }, p2 = { x: st.x + (len / 2) * Math.cos(rad), y: st.y + (len / 2) * Math.sin(rad) };
          return projectPointOntoSegment(rawWorld, p1, p2).distance < 1.4;
        }
        const rad = -((st.rotation || 0) * Math.PI) / 180, dx = rawWorld.x - st.x, dy = rawWorld.y - st.y;
        const localX = Math.abs(dx * Math.cos(rad) - dy * Math.sin(rad)), localY = Math.abs(dx * Math.sin(rad) + dy * Math.cos(rad));
        let halfW = 1.0, halfH = 1.0;
        if (st.type === 'plumbing_tub') { halfW = 2.7; halfH = 1.6; } else if (st.type === 'plumbing_shower') { halfW = 1.8; halfH = 1.8; } else if (st.type === 'stair_run') { halfW = 2.2; halfH = 3.5; } else if (st.type === 'plumbing_toilet') { halfW = 1.2; halfH = 1.6; } else if (st.type === 'plumbing_sink' || st.type === 'plumbing_water_heater') { halfW = 1.4; halfH = 1.4; } else if (st.type === 'fan_exhaust' || st.type === 'fan_rangehood') { halfW = 1.6; halfH = 1.4; } else if (st.type === 'column_post' || st.type === 'helical_pier') { halfW = 1.2; halfH = 1.2; } else if (st.type === 'fan_ceiling') { halfW = 1.8; halfH = 1.8; }
        return localX <= halfW + 0.4 && localY <= halfH + 0.4;
      });
      if (hitStamp) { toggleSelection('stamp', hitStamp.id, e); setIsDraggingElement(true); setDragStartPoint(worldPoint); setHasMovedDuringDrag(false); return; }
      const hitWall = state.walls.find((w) => {
        const n1 = nodeMap.get(w.startNodeId), n2 = nodeMap.get(w.endNodeId); if (!n1 || !n2) return false;
        return projectPointOntoSegment(rawWorld, n1, n2).distance < (w.thickness / 2) + 0.5;
      });
      if (hitWall) { toggleSelection('wall', hitWall.id, e); setIsDraggingElement(true); setDragStartPoint(worldPoint); setHasMovedDuringDrag(false); return; }
      const hitRoom = state.rooms.find((room) => isPointInPolygon(rawWorld, room.points) || distance(rawWorld, room.centroid) < 4.0);
      if (hitRoom) {
        toggleSelection('room', hitRoom.id, e); setIsDraggingElement(true); setDragStartPoint(worldPoint); setHasMovedDuringDrag(false);
        const cornerNode = state.nodes.find(n => hitRoom.nodeIds.includes(n.id) && distance(rawWorld, n) < 0.8);
        if (cornerNode) setActiveDragAnchorNodeId(cornerNode.id); else setActiveDragAnchorNodeId(null);
        return;
      }
      const hitDeck = state.decks.find((d) => isPointInPolygon(rawWorld, d.points));
      if (hitDeck) { toggleSelection('deck', hitDeck.id, e); setIsDraggingElement(true); setDragStartPoint(worldPoint); setHasMovedDuringDrag(false); return; }
      const hitHardscape = state.hardscapes.find((h) => isPointInPolygon(rawWorld, h.points));
      if (hitHardscape) { toggleSelection('hardscape', hitHardscape.id, e); setIsDraggingElement(true); setDragStartPoint(worldPoint); setHasMovedDuringDrag(false); return; }
      if (state.underlay && state.underlay.isVisible && underlayImageRef.current) {
        const uw = underlayImageRef.current.naturalWidth * state.underlay.feetPerPixel;
        const uh = underlayImageRef.current.naturalHeight * state.underlay.feetPerPixel;
        if (rawWorld.x >= state.underlay.worldX && rawWorld.x <= state.underlay.worldX + uw && rawWorld.y >= state.underlay.worldY && rawWorld.y <= state.underlay.worldY + uh) {
          if (!state.underlay.isLocked) {
            toggleSelection('underlay', 'underlay_main', e); 
            setIsDraggingElement(true); 
            setDragStartPoint(rawWorld); 
            setHasMovedDuringDrag(false); 
            return;
          }
        }
      }
      if (!e.shiftKey && !(e.ctrlKey || e.metaKey)) onSelect({ type: 'none' });
      setMarqueeStart(rawWorld); setMarqueeEnd(rawWorld); setHasMovedDuringDrag(false);
    }
  };

  // Handle Mouse Move
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current; if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left, clientY = e.clientY - rect.top;
    if (isPanning) {
      setTransform((prev) => ({ ...prev, x: prev.x + (clientX - panStart.x), y: prev.y + (clientY - panStart.y) }));
      setPanStart({ x: clientX, y: clientY }); return;
    }
    const rawWorld = screenToWorld(clientX, clientY);
    
    if(foundationDrag.current){if(!(e.buttons&1)){clearFoundationDrag();return;}const drag=foundationDrag.current;if(distance(drag.screen,{x:clientX,y:clientY})>=4||foundationMarquee)setFoundationMarquee({start:drag.start,end:rawWorld});return;}
    if(roofDrag.current){
      if(!(e.buttons&1)){clearRoofDrag();return;}
      const drag=roofDrag.current;
      if(distance(drag.screen,{x:clientX,y:clientY})>=4||roofMarquee)setRoofMarquee({start:drag.start,end:rawWorld});
      return;
    }
    if(foundationTool){if(!perimeterOutline){const p=foundationSnap(rawWorld);setFoundationCursor(p);}return;}
    if(roofEntities&&activeTool.startsWith('roof_')) {const target=getRoofSnap(rawWorld);setRoofTarget(target);setRoofCursor(target.point);return;}
    // Check for underlay hover
    if (state.underlay && state.underlay.isVisible && !state.underlay.isLocked && underlayImageRef.current) {
      const uw = underlayImageRef.current.naturalWidth * state.underlay.feetPerPixel;
      const uh = underlayImageRef.current.naturalHeight * state.underlay.feetPerPixel;
      const isOver = rawWorld.x >= state.underlay.worldX && rawWorld.x <= state.underlay.worldX + uw &&
                     rawWorld.y >= state.underlay.worldY && rawWorld.y <= state.underlay.worldY + uh;
      setIsHoveringUnderlay(isOver);
    } else {
      setIsHoveringUnderlay(false);
    }

    const snap = getSmartSnapPoint(rawWorld, activeWallStartNodeId);
    setSnapCandidate(snap);
    let currentPoint = snap.point;
    
    // Ortho snapping for calibration tool
    if (activeTool === 'calibrate_scale' && calibrationPoints.length > 0) {
      if (e.shiftKey) {
        const p1 = calibrationPoints[0];
        const dx = Math.abs(rawWorld.x - p1.x);
        const dy = Math.abs(rawWorld.y - p1.y);
        if (dx > dy) {
          currentPoint = { x: rawWorld.x, y: p1.y };
        } else {
          currentPoint = { x: p1.x, y: rawWorld.y };
        }
      } else {
        currentPoint = rawWorld;
      }
    }

    if (activeTool === 'wall_pen' && activeWallStartNodeId) {
      const draftResult = computeDraftPoint(rawWorld, activeWallStartNodeId);
      currentPoint = draftResult.point;
      setSnapCandidate(draftResult);
    }
    setDraftMousePos(currentPoint);
    if (marqueeStart && !isDraggingElement) { setMarqueeEnd(rawWorld); return; }
    if (isDraggingElement && selection.type !== 'none') {
      const snapInc = state.settings.gridSnapSize || 0.5;
      const isSnapEnabled = state.settings.gridSnap;
      const currentPointSnapped = isSnapEnabled 
        ? { x: Math.round(currentPoint.x / snapInc) * snapInc, y: Math.round(currentPoint.y / snapInc) * snapInc }
        : currentPoint;
      
      const dx = currentPointSnapped.x - dragStartPoint.x, dy = currentPointSnapped.y - dragStartPoint.y;
      if (Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001) {
        setHasMovedDuringDrag(true);
        const selectionIds = selection.ids || (selection.id ? [selection.id] : []);
        if (selectionIds.length > 1 || (selectionIds.length === 1 && !['node', 'wall', 'room', 'aperture'].includes(selection.type))) {
          const allSelectedNodeIds = new Set<string>();
          state.walls.forEach(w => { if (selectionIds.includes(w.id)) { allSelectedNodeIds.add(w.startNodeId); allSelectedNodeIds.add(w.endNodeId); } });
          state.rooms.forEach(r => { if (selectionIds.includes(r.id)) r.nodeIds.forEach(nid => allSelectedNodeIds.add(nid)); });
          state.nodes.forEach(n => { if (selectionIds.includes(n.id)) allSelectedNodeIds.add(n.id); });
          const nextNodes = state.nodes.map(n => allSelectedNodeIds.has(n.id) ? { ...n, x: Math.round((n.x + dx) * 100) / 100, y: Math.round((n.y + dy) * 100) / 100 } : n);
          const nextStamps = state.stamps.map(st => {
            if (selectionIds.includes(st.id)) return { ...st, x: Math.round((st.x + dx) * 100) / 100, y: Math.round((st.y + dy) * 100) / 100 };
            const roomHit = state.rooms.find(r => selectionIds.includes(r.id) && isPointInPolygon({ x: st.x, y: st.y }, r.points));
            if (roomHit) return { ...st, x: Math.round((st.x + dx) * 100) / 100, y: Math.round((st.y + dy) * 100) / 100 };
            return st;
          });
          const nextAnnotations = (state.annotations || []).map(ann => selectionIds.includes(ann.id) ? { ...ann, x: Math.round((ann.x + dx) * 100) / 100, y: Math.round((ann.y + dy) * 100) / 100 } : ann);
          const nextDecks = state.decks.map(d => selectionIds.includes(d.id) ? { ...d, points: d.points.map(pt => ({ x: Math.round((pt.x + dx) * 100) / 100, y: Math.round((pt.y + dy) * 100) / 100 })) } : d);
          const nextHardscapes = state.hardscapes.map(h => selectionIds.includes(h.id) ? { ...h, points: h.points.map(pt => ({ x: Math.round((pt.x + dx) * 100) / 100, y: Math.round((pt.y + dy) * 100) / 100 })) } : h);
          let nextUnderlay = state.underlay; 
          if (state.underlay && (selectionIds.includes(state.underlay.url) || selectionIds.includes('underlay_main'))) {
            nextUnderlay = { 
              ...state.underlay, 
              worldX: (state.underlay.worldX || 0) + dx, 
              worldY: (state.underlay.worldY || 0) + dy,
            };
          }
          const nextRooms = detectRoomFaces(nextNodes, state.walls, state.rooms, state.settings.defaultWallHeight);
          onChange({ ...state, nodes: nextNodes, stamps: nextStamps, annotations: nextAnnotations, rooms: nextRooms, decks: nextDecks, hardscapes: nextHardscapes, underlay: nextUnderlay }, false);
          setDragStartPoint(currentPointSnapped); return;
        }
        if (selection.type === 'node' && selection.id) {
            const snappedPoint = currentPointSnapped;
            const parentRooms = state.rooms.filter(r => r.nodeIds.includes(selection.id!));
            const isOrthogonalRoom = parentRooms.length === 1 && parentRooms[0].nodeIds.length === 4;
            let updatedNodes = state.nodes.map((n) => n.id === selection.id ? { ...n, x: snappedPoint.x, y: snappedPoint.y } : n);
            if (isOrthogonalRoom) {
              const room = parentRooms[0], nodeIdx = room.nodeIds.indexOf(selection.id!), prevNodeId = room.nodeIds[(nodeIdx - 1 + 4) % 4], nextNodeId = room.nodeIds[(nodeIdx + 1) % 4];
              const nodeMap = new Map<string, CadNode>(); state.nodes.forEach(n => nodeMap.set(n.id, n));
              const currNode = nodeMap.get(selection.id!), prevNode = nodeMap.get(prevNodeId), nextNode = nodeMap.get(nextNodeId);
              if (currNode && prevNode && nextNode) {
                const isPrevHorizontal = Math.abs(currNode.y - prevNode.y) < 0.01, isNextVertical = Math.abs(currNode.x - nextNode.x) < 0.01;
                updatedNodes = updatedNodes.map(n => {
                  if (n.id === prevNodeId) return isPrevHorizontal ? { ...n, y: snappedPoint.y } : { ...n, x: snappedPoint.x };
                  if (n.id === nextNodeId) return isNextVertical ? { ...n, x: snappedPoint.x } : { ...n, y: snappedPoint.y };
                  return n;
                });
              }
            }
            const updatedRooms = detectRoomFaces(updatedNodes, state.walls, state.rooms, state.settings.defaultWallHeight);
            onChange({ ...state, nodes: updatedNodes, rooms: updatedRooms }, false);
          } else if (selection.type === 'wall') {
          const wall = state.walls.find((w) => w.id === selection.id);
          if (wall) {
            const startNode = state.nodes.find((n) => n.id === wall.startNodeId), endNode = state.nodes.find((n) => n.id === wall.endNodeId);
            if (startNode && endNode) {
              const wallDx = endNode.x - startNode.x, wallDy = endNode.y - startNode.y, wallLen = Math.hypot(wallDx, wallDy);
              let effectiveDx = dx, effectiveDy = dy;
              const isHorizontal = Math.abs(wallDy) < 0.05, isVertical = Math.abs(wallDx) < 0.05;
              if (wallLen > 0.001) {
                if (isHorizontal) { effectiveDx = 0; effectiveDy = dy; } else if (isVertical) { effectiveDx = dx; effectiveDy = 0; } else {
                  const nx = -wallDy / wallLen, ny = wallDx / wallLen, proj = dx * nx + dy * ny;
                  effectiveDx = proj * nx; effectiveDy = proj * ny;
                }
              }
              if (Math.abs(effectiveDx) > 0.0001 || Math.abs(effectiveDy) > 0.0001) {
                let snapDelta = { x: 0, y: 0 }; const projectedStart = { x: startNode.x + effectiveDx, y: startNode.y + effectiveDy }, snapRadius = state.settings.gridSnapSize || 0.5;
                let minSnapDist = snapRadius;
                state.nodes.forEach(n => {
                  if (n.id === wall.startNodeId || n.id === wall.endNodeId) return;
                  if (isHorizontal) { const distY = Math.abs(projectedStart.y - n.y); if (distY < minSnapDist) { minSnapDist = distY; snapDelta = { x: 0, y: n.y - projectedStart.y }; } }
                  else if (isVertical) { const distX = Math.abs(projectedStart.x - n.x); if (distX < minSnapDist) { minSnapDist = distX; snapDelta = { x: n.x - projectedStart.x, y: 0 }; } }
                });
                state.walls.forEach(sw => {
                  if (sw.id === wall.id) return;
                  const sn1 = state.nodes.find(n => n.id === sw.startNodeId), sn2 = state.nodes.find(n => n.id === sw.endNodeId); if (!sn1 || !sn2) return;
                  const swIsHorizontal = Math.abs(sn1.y - sn2.y) < 0.01, swIsVertical = Math.abs(sn1.x - sn2.x) < 0.01;
                  if (isHorizontal && swIsHorizontal) { const distY = Math.abs(projectedStart.y - sn1.y); if (distY < minSnapDist) { minSnapDist = distY; snapDelta = { x: 0, y: sn1.y - projectedStart.y }; } }
                  else if (isVertical && swIsVertical) { const distX = Math.abs(projectedStart.x - sn1.x); if (distX < minSnapDist) { minSnapDist = distX; snapDelta = { x: sn1.x - projectedStart.x, y: 0 }; } }
                });
                const finalDx = effectiveDx + snapDelta.x, finalDy = effectiveDy + snapDelta.y;
                const updatedNodes = state.nodes.map((n) => (n.id === wall.startNodeId || n.id === wall.endNodeId) ? { ...n, x: Math.round((n.x + finalDx) * 100) / 100, y: Math.round((n.y + finalDy) * 100) / 100 } : n);
                const updatedRooms = detectRoomFaces(updatedNodes, state.walls, state.rooms, state.settings.defaultWallHeight);
                onChange({ ...state, nodes: updatedNodes, rooms: updatedRooms }, false);
              }
            }
          }
        } else if (selection.type === 'aperture') {
          const ap = state.apertures.find((a) => a.id === selection.id);
          if (ap) {
            const wall = state.walls.find((w) => w.id === ap.wallId);
            if (wall) {
              const n1 = state.nodes.find((n) => n.id === wall.startNodeId), n2 = state.nodes.find((n) => n.id === wall.endNodeId);
              if (n1 && n2) {
                const wallLen = distance(n1, n2), proj = projectPointOntoSegment(rawWorld, n1, n2), snapInc = state.settings.gridSnapSize || 0.5;
                let newOffset = Math.round((proj.t * wallLen - ap.width / 2) / snapInc) * snapInc;
                newOffset = Math.max(0, Math.min(Math.max(0, wallLen - ap.width), newOffset));
                onChange({ ...state, apertures: state.apertures.map((a) => a.id === ap.id ? { ...a, offset: Math.round(newOffset * 100) / 100 } : a) }, false);
              }
            }
          }
        } else if (selection.type === 'room') {
          const room = state.rooms.find((r) => r.id === selection.id);
          if (room) {
            const roomNodeSet = new Set(room.nodeIds), nodeMap = new Map<string, CadNode>(); state.nodes.forEach((n) => nodeMap.set(n.id, n));
            const movingNodesActual = room.nodeIds.map((nid) => nodeMap.get(nid)).filter((n): n is CadNode => !!n).map((n) => ({ x: n.x + dx, y: n.y + dy }));
            const stationaryNodes = state.nodes.filter((n) => !roomNodeSet.has(n.id)), stationaryWalls = state.walls.filter((w) => !roomNodeSet.has(w.startNodeId) || !roomNodeSet.has(w.endNodeId));
            const anchorIdx = activeDragAnchorNodeId ? room.nodeIds.indexOf(activeDragAnchorNodeId) : -1;
            const nodesToCheck = anchorIdx !== -1 ? [movingNodesActual[anchorIdx], ...movingNodesActual.filter((_, i) => i !== anchorIdx)] : movingNodesActual;
            const snapResult = calculateMultiCornerSnap(nodesToCheck, stationaryNodes, stationaryWalls, nodeMap, 0.75);
            let finalDx = dx, finalDy = dy;
            if (snapResult.snapType !== 'none') {
              finalDx += snapResult.delta.x; finalDy += snapResult.delta.y;
              const originalIdx = anchorIdx !== -1 && snapResult.snappedNodeIndex === 0 ? anchorIdx : (anchorIdx !== -1 && snapResult.snappedNodeIndex > 0 ? (snapResult.snappedNodeIndex <= anchorIdx ? snapResult.snappedNodeIndex - 1 : snapResult.snappedNodeIndex) : snapResult.snappedNodeIndex);
              setRoomSnapFeedback({ movingNode: { x: movingNodesActual[originalIdx].x + snapResult.delta.x, y: movingNodesActual[originalIdx].y + snapResult.delta.y }, targetNode: snapResult.snapTarget, type: snapResult.snapType });
            } else setRoomSnapFeedback(null);
            const updatedNodes = state.nodes.map((n) => roomNodeSet.has(n.id) ? { ...n, x: Math.round((n.x + finalDx) * 1000) / 1000, y: Math.round((n.y + finalDy) * 1000) / 1000 } : n);
            const updatedStamps = state.stamps.map((st) => isPointInPolygon({ x: st.x, y: st.y }, room.points) ? { ...st, x: Math.round((st.x + finalDx) * 1000) / 1000, y: Math.round((st.y + finalDy) * 1000) / 1000 } : st);
            const updatedRooms = detectRoomFaces(updatedNodes, state.walls, state.rooms, state.settings.defaultWallHeight);
            onChange({ ...state, nodes: updatedNodes, stamps: updatedStamps, rooms: updatedRooms }, false);
          }
        }
        setDragStartPoint(currentPointSnapped);
      }
    }
  };

  // Handle Mouse Up
  const handleMouseUp = (e: React.MouseEvent) => {
    if(foundationDrag.current&&foundationEntities&&e.button===0){const drag=foundationDrag.current,rect=canvasRef.current?.getBoundingClientRect();clearFoundationDrag();if(!rect)return;const screen={x:e.clientX-rect.left,y:e.clientY-rect.top},end=screenToWorld(screen.x,screen.y);const hits=distance(drag.screen,screen)>=4?foundationWindowSelection(visibleFoundation??[],drag.start,end):drag.hitId?[drag.hitId]:[];const ids=new Set(drag.shift&&selection.type==='foundation'?(selection.ids??(selection.id?[selection.id]:[])):[]);for(const id of hits){if(drag.shift&&ids.has(id))ids.delete(id);else ids.add(id);}const list=[...ids];onSelect(list.length===0?{type:'none'}:list.length===1?{type:'foundation',id:list[0]}:{type:'foundation',ids:list});return;}
    if(roofDrag.current&&roofEntities&&e.button===0){
      const drag=roofDrag.current,rect=canvasRef.current?.getBoundingClientRect();
      clearRoofDrag();
      if(!rect)return;
      const screen={x:e.clientX-rect.left,y:e.clientY-rect.top};
      const end=screenToWorld(screen.x,screen.y);
      const hits=distance(drag.screen,screen)>=4?roofWindowSelection(roofEntities,drag.start,end):drag.hitId?[drag.hitId]:[];
      const selected=new Set<string>(drag.shift?roofSelectionIds():[]);
      for(const id of hits){if(drag.shift&&selected.has(id))selected.delete(id);else selected.add(id);}
      selectRoofIds([...selected]);return;
    }
    setIsPanning(false); setIsDraggingElement(false); setActiveDragAnchorNodeId(null); setRoomSnapFeedback(null);
    if (!hasMovedDuringDrag && pendingSelectionOnMouseUp) onSelect(pendingSelectionOnMouseUp);
    setPendingSelectionOnMouseUp(null); setHasMovedDuringDrag(false);
    lockedSnapNodeRef.current = null;

    if (marqueeStart && marqueeEnd && distance(marqueeStart, marqueeEnd) > 0.1) {
      const x1 = Math.min(marqueeStart.x, marqueeEnd.x), y1 = Math.min(marqueeStart.y, marqueeEnd.y), x2 = Math.max(marqueeStart.x, marqueeEnd.x), y2 = Math.max(marqueeStart.y, marqueeEnd.y);
      const isInside = (p: Point2D) => p.x >= x1 && p.x <= x2 && p.y >= y1 && p.y <= y2;
      const itemsInBox: string[] = [];
      state.nodes.forEach(n => { if (isInside(n)) itemsInBox.push(n.id); });
      state.walls.forEach(w => {
        const n1 = state.nodes.find(n => n.id === w.startNodeId), n2 = state.nodes.find(n => n.id === w.endNodeId);
        if (n1 && n2 && (isInside(n1) || isInside(n2) || isInside({ x: (n1.x + n2.x) / 2, y: (n1.y + n2.y) / 2 }))) itemsInBox.push(w.id);
      });
      state.apertures.forEach(ap => {
        const wall = state.walls.find(w => w.id === ap.wallId);
        if (wall) {
          const n1 = state.nodes.find(n => n.id === wall.startNodeId), n2 = state.nodes.find(n => n.id === wall.endNodeId);
          if (n1 && n2) {
            const wallLen = distance(n1, n2);
            const centerOffset = ap.offset + ap.width / 2;
            const t = centerOffset / wallLen;
            if (isInside({ x: n1.x + (n2.x - n1.x) * t, y: n1.y + (n2.y - n1.y) * t })) itemsInBox.push(ap.id);
          }
        }
      });
      state.stamps.forEach(st => { if (isInside({ x: st.x, y: st.y })) itemsInBox.push(st.id); });
      (state.annotations || []).forEach(ann => { if (isInside({ x: ann.x, y: ann.y })) itemsInBox.push(ann.id); });
      state.rooms.forEach(r => { if (isInside(r.centroid)) itemsInBox.push(r.id); });
      state.decks.forEach(d => { if (d.points.some(p => isInside(p))) itemsInBox.push(d.id); });
      state.hardscapes.forEach(h => { if (h.points.some(p => isInside(p))) itemsInBox.push(h.id); });

      const isShift = e.shiftKey, isCtrl = e.ctrlKey || e.metaKey;
      let currentIds = selection.ids ? [...selection.ids] : (selection.id ? [selection.id] : []);
      let newIds = [...currentIds];
      if (isCtrl && isShift) newIds = newIds.filter(id => !itemsInBox.includes(id));
      else if (isCtrl) itemsInBox.forEach(id => { if (!newIds.includes(id)) newIds.push(id); });
      else if (isShift) itemsInBox.forEach(id => { if (newIds.includes(id)) newIds = newIds.filter(i => i !== id); else newIds.push(id); });
      else newIds = itemsInBox;

      if (newIds.length === 0) onSelect({ type: 'none' });
      else if (newIds.length === 1) onSelect({ type: 'multiple', ids: newIds, id: newIds[0] });
      else onSelect({ type: 'multiple', ids: newIds });
      setMarqueeStart(null); setMarqueeEnd(null); return;
    }
    setMarqueeStart(null); setMarqueeEnd(null);

    if(activeTool==='wall_pen'||activeTool==='wall_rect'||activeTool==='room_box'||activeTool.startsWith('roof_')||recentRef.current)return;
    if (hasMovedDuringDrag && dragInitialStateRef.current) {
      const { nodes: mergedNodes, walls: mergedWalls, rooms: mergedRooms } = mergeCoincidentNodes(state.nodes, state.walls, state.rooms, 0.4);
      const { walls: finalWalls, rooms: finalRooms, apertures: finalApertures } = deduplicateWalls(mergedWalls, mergedRooms, state.apertures, mergedNodes);
      const partitioned = partitionCrossingWalls(mergedNodes, finalWalls, finalApertures);
      const reDetectedRooms = detectRoomFaces(partitioned.nodes, partitioned.walls, finalRooms, state.settings.defaultWallHeight);

      const nodeMap = new Map<string, CadNode>();
      partitioned.nodes.forEach((n) => nodeMap.set(n.id, n));
      const nextDecks = state.decks.map((deck) => ({
        ...deck,
        ledgerLengthLf: computeDeckLedger(deck.points, partitioned.walls, nodeMap),
      }));

      const finalState: FloorplanState = {
        ...state,
        nodes: partitioned.nodes,
        walls: partitioned.walls,
        rooms: reDetectedRooms,
        apertures: partitioned.apertures,
        decks: nextDecks,
      };

      onChange(finalState, true, dragInitialStateRef.current);
      dragInitialStateRef.current = null;
      setHasMovedDuringDrag(false);
      return;
    }

    const { nodes: mergedNodes, walls: mergedWalls, rooms: mergedRooms } = mergeCoincidentNodes(state.nodes, state.walls, state.rooms, 0.4);
    const { walls: finalWalls, rooms: finalRooms, apertures: finalApertures } = deduplicateWalls(mergedWalls, mergedRooms, state.apertures, mergedNodes);
    const partitioned = partitionCrossingWalls(mergedNodes, finalWalls, finalApertures);
    const reDetectedRooms = detectRoomFaces(partitioned.nodes, partitioned.walls, finalRooms, state.settings.defaultWallHeight);
    const nodeMap = new Map<string, CadNode>();
    partitioned.nodes.forEach((n) => nodeMap.set(n.id, n));
    const nextDecks = state.decks.map((deck) => ({
      ...deck,
      ledgerLengthLf: computeDeckLedger(deck.points, partitioned.walls, nodeMap),
    }));
    if (finalWalls.length !== state.walls.length || mergedNodes.length !== state.nodes.length || finalApertures.length !== state.apertures.length || reDetectedRooms.length !== state.rooms.length) {
      onChange({ ...state, nodes: partitioned.nodes, walls: partitioned.walls, rooms: reDetectedRooms, apertures: partitioned.apertures, decks: nextDecks });
    }
    dragInitialStateRef.current = null;
    setHasMovedDuringDrag(false);
  };

  // Handle Double Click to finish wall drawing chain
  const handleDoubleClick = () => {
    if(activeTool.startsWith('roof_'))return;
    if (activeTool === 'wall_pen') {
      setActiveWallStartNodeId(null);
      setDraftMousePos(null);
      lockedSnapNodeRef.current = null;
      onToolChange('select');
    }
  };

  const cursorClass = isPanning 
    ? 'cursor-grabbing' 
    : (isHoveringUnderlay && !state.underlay?.isLocked) 
      ? 'cursor-move' 
      : 'cursor-crosshair';

  return (
    <div
      ref={containerRef}
      className={`relative flex-1 w-full h-full bg-slate-950 overflow-hidden select-none ${cursorClass}`}
    >
      {(validPerimeterCandidate?.members??foundationPreview)?.length? <div role="status" aria-label="Foundation graphical preview" className="absolute top-12 left-3 z-10 pointer-events-none rounded bg-emerald-950 px-2 py-1 text-xs text-emerald-200">Preview — {(validPerimeterCandidate?.members??foundationPreview)?.length} uncommitted components</div>:null}
      <canvas
        ref={canvasRef}
        className="w-full h-full block"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={()=>{if(roofDrag.current)clearRoofDrag();if(foundationDrag.current)clearFoundationDrag();}}
        onDoubleClick={handleDoubleClick}
        onContextMenu={(e) => {
          e.preventDefault();
          const rect = canvasRef.current?.getBoundingClientRect();
          if (rect) {
            const clientX = e.clientX - rect.left;
            const clientY = e.clientY - rect.top;
            const rawWorld = screenToWorld(clientX, clientY);
            if (onContextMenu) {
              onContextMenu(e as any, rawWorld);
            }
          }
        }}
      />

      {perimeterOutline&&perimeterTool&&<section aria-label="Polygon perimeter configuration" className="absolute top-20 left-4 z-20 bg-slate-900 border border-sky-600 rounded-lg p-4 text-xs space-y-3 w-64 shadow-xl">
        <h3 className="font-semibold text-sky-300">Polygon foundation perimeter</h3><p>{perimeterOutline.length} vertices · explicit dimensions in feet</p>
        <label className="block">Polygon reference<select aria-label="Polygon reference" className="block w-full bg-slate-800 rounded p-2" value={perimeterReference} onChange={e=>{setPerimeterReference(e.target.value as RectangleReference);setPerimeterCandidate(null)}}><option value="exterior">Exterior face</option><option value="centreline">Centreline</option><option value="interior">Interior face</option></select></label>
        {([['Polygon wall thickness (ft)',perimeterWidth,setPerimeterWidth],['Polygon wall height (ft)',perimeterHeight,setPerimeterHeight],['Polygon wall base (ft)',perimeterBase,setPerimeterBase]] as const).map(([label,value,set])=><label key={label} className="block">{label}<input aria-label={label} className="block w-full bg-slate-800 rounded p-2" value={value} onChange={e=>{set(e.target.value);setPerimeterCandidate(null)}}/></label>)}
        {validPerimeterCandidate&&<p aria-label="Polygon perimeter quantity">{validPerimeterCandidate.members.length} walls · {validPerimeterCandidate.volume.toFixed(4)} CY</p>}
        {perimeterError&&<p role="alert" className="text-amber-300">{perimeterError}</p>}
        <div className="flex flex-wrap gap-2"><button className="bg-sky-700 rounded p-2" onClick={()=>{try{
          if(!foundationEntities)throw Error('Foundation workspace unavailable');
          const values=[perimeterWidth,perimeterHeight,perimeterBase];if(values.some(v=>!v.trim()||!Number.isFinite(Number(v))))throw Error('Specify finite wall thickness, height and base elevation');
          const members=generateOrthogonalFoundationPerimeter(perimeterOutline,perimeterReference,Number(perimeterWidth),Number(perimeterHeight),Number(perimeterBase),uuidv4);
          const result=previewFoundationGeneration(foundationEntities,members),rows=result.rows.filter(r=>members.some(m=>m.id===r.elementId));
          if(rows.length!==members.length||rows.some(r=>r.status!=='measured'))throw Error('Perimeter overlaps or requires unresolved reconciliation');
          const before=measureFoundation('preview',foundationEntities).rows.filter(r=>r.status==='measured');
          if(before.some(r=>result.rows.some(q=>q.elementId===r.elementId&&q.code===r.code&&q.status!=='measured')))throw Error('Perimeter would invalidate existing measurements');
          setPerimeterCandidate({source:foundationEntities,members,volume:rows.reduce((n,r)=>n+(r.status==='measured'?r.quantity:0),0)});setPerimeterError('');
        }catch(err){setPerimeterCandidate(null);setPerimeterError(err instanceof Error?err.message:String(err))}}}>Preview polygon perimeter</button>
        <button disabled={!validPerimeterCandidate} className="bg-emerald-700 disabled:opacity-40 rounded p-2" onClick={()=>{if(validPerimeterCandidate&&foundationEntities&&onFoundationChange?.([...foundationEntities,...validPerimeterCandidate.members])){setPerimeterCandidate(null);setPerimeterOutline(null);onToolChange('select');onSelect({type:'foundation',ids:validPerimeterCandidate.members.map(m=>m.id)})}else setPerimeterError('Preview is stale or placement rejected')}}>Apply polygon perimeter</button>
        <button className="bg-slate-700 rounded p-2" onClick={()=>{setPerimeterCandidate(null);setPerimeterOutline(null);setPerimeterError('');onToolChange('select')}}>Cancel polygon perimeter</button></div>
      </section>}
      {generationOutline&&<section className="absolute top-20 left-4 z-20 bg-slate-900 border border-sky-600 rounded-lg p-4 text-xs space-y-3 w-64 shadow-xl"><h3 className="font-semibold text-sky-300">Generate Roof Skeleton</h3><p>Rectangular roof perimeter · preview only</p><label className="block">Configuration<select className="block w-full bg-slate-800 p-2 rounded" value={generationConfig.type} onChange={e=>{setGenerationConfig(c=>({...c,type:e.target.value as RoofConfig['type']}));setGenerationPreview(null)}}>{['hip','gable','shed','flat'].map(t=><option key={t}>{t}</option>)}</select></label>{generationConfig.type!=='flat'&&<label className="block">Pitch rise per 12<input className="block w-full bg-slate-800 p-2 rounded" type="number" min="0.01" max="48" step="any" value={generationConfig.pitch} onChange={e=>{setGenerationConfig(c=>({...c,pitch:Number(e.target.value)}));setGenerationPreview(null)}}/></label>}{generationConfig.type==='gable'&&<label>Ridge orientation<select className="block w-full bg-slate-800 p-2 rounded" value={generationConfig.ridge} onChange={e=>{setGenerationConfig(c=>({...c,ridge:e.target.value as RoofConfig['ridge']}));setGenerationPreview(null)}}><option value="horizontal">Horizontal</option><option value="vertical">Vertical</option></select></label>}{generationConfig.type==='shed'&&<label>Downslope direction<select className="block w-full bg-slate-800 p-2 rounded" value={generationConfig.direction} onChange={e=>{setGenerationConfig(c=>({...c,direction:Number(e.target.value) as RoofConfig['direction']}));setGenerationPreview(null)}}>{[[0,'Right'],[90,'Down'],[180,'Left'],[270,'Up']].map(([v,n])=><option key={v} value={v}>{n}</option>)}</select></label>}<p className="text-slate-400">No automatic overhang or assembly allowances. Review against drawings.</p>{generationError&&<p role="alert" className="text-amber-300">{generationError}</p>}<div className="flex gap-2"><button className="bg-sky-700 rounded p-2" onClick={()=>{try{const next=generateRectangularRoof(generationOutline[0],generationOutline[2],generationConfig,uuidv4);validateRoofTopology([...generationBase(),...next]);setGenerationPreview(next);setGenerationError('');}catch(err){setGenerationPreview(null);setGenerationError(err instanceof Error?err.message:String(err));}}}>Preview</button><button disabled={!generationPreview} className="bg-emerald-700 disabled:opacity-40 rounded p-2" onClick={()=>{try{if(generationPreview){const next=[...generationBase(),...generationPreview];validateRoofTopology(next);if(onRoofChange?.(next)){setCorrection(null);onSelect({type:'none'});onToolChange('select');}}}catch(err){setGenerationError(err instanceof Error?err.message:String(err));}}}>Apply</button><button className="bg-slate-700 rounded p-2" onClick={()=>{setCorrection(null);onToolChange('select')}}>Cancel</button></div></section>}
      {/* Floating Canvas Overlays & Controls */}
      {/* Top Center Tool Info Banner */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-slate-900/90 border border-slate-800 backdrop-blur-md px-4 py-1.5 rounded-full text-xs text-slate-300 shadow-xl flex items-center gap-3">
        <span className={`flex items-center gap-1.5 font-medium ${activeTool === 'wall_pen' || activeTool === 'wall_rect' || activeTool === 'room_box' ? 'text-amber-200' : 'text-sky-400'}`}>
          <Compass className="w-3.5 h-3.5" />
          {foundationTool?(foundationPolygon?'Click vertices; close at first or Finish polygon':foundationStart?'Click endpoint or enter exact dimensions':'Click first foundation point'):activeTool.startsWith('roof_') ? (activeTool==='roof_generate'?(generationOutline?'Configure roof skeleton':selection.type==='roof'?'Selected roof outline':'Draw rectangular roof outline'):activeTool==='roof_edge'?'Click a roof boundary or existing edge':activeTool==='roof_vertex'?'Select vertex, then click new position':`${activeTool==='roof_soffit'?'Draw soffit surface':activeTool==='roof_insulation'?'Draw insulation surface':activeTool==='roof_opening'?'Draw opening in selected plane':'Draw roof plane'} · ${roofMode==='rectangle'?(roofDraft.length?'Click opposite corner or type width,depth':'Click first corner'):'Click vertices; close at first or Finish polygon'}`) : activeTool === 'wall_pen'
            ? activeWallStartNodeId
              ? 'Click to place next wall node (Double-click / ESC to finish)'
              : 'Click to drop start node for wall'
            : activeTool === 'calibrate_scale'
            ? "Scale Calibration Mode: Click start and end points of a known dimension (Hold Shift for straight 90° lines)"
            : activeTool === 'wall_rect' || activeTool === 'room_box'
            ? 'Click & drag or click 2 points to create 4-wall Room'
            : activeTool.startsWith('aperture_')
            ? 'Click on any wall to snap aperture'
            : activeTool.startsWith('stamp_')
            ? 'Click to drop stamp'
            : activeTool === 'text_label'
            ? 'Click anywhere on canvas to drop Text Note'
            : activeTool === 'ruler_measure'
            ? 'Click two points to measure distance'
            : foundationEntities?'Select foundation components · Shift-click toggles · drag left/right for window/crossing':roofEntities?'Select roof entities · Shift-click toggles · drag left/right for window/crossing':'Select & Move (Click wall, node, room, stamp, or note)'}
        </span>
        <div className="w-[1px] h-3.5 bg-slate-700 mx-1" />
        {foundationEntities&&activeTool==='foundation_wall'&&<select aria-label="Foundation wall reference" value={wallReference} onChange={e=>{setWallReference(e.target.value as WallDraftReference);setFoundationStart(null);setFoundationCursor(null);setCorrection(null);setDimensionA('');setDimensionError('')}} className="bg-slate-800 rounded px-2 py-1"><option value="centreline">Centreline</option><option value="exterior-left">Exterior face · concrete +normal</option><option value="exterior-right">Exterior face · concrete −normal</option><option value="interior-left">Interior face · concrete +normal</option><option value="interior-right">Interior face · concrete −normal</option></select>}
        {foundationEntities&&activeTool==='foundation_wall'&&wallReference!=='centreline'&&<div className="flex items-center gap-1"><input aria-label="Face reference wall thickness" className="w-24 bg-slate-800 rounded px-2 py-1" placeholder={state.settings.unitSystem==='metric'?'Thickness (m)':'Thickness (ft)'} value={wallReferenceWidth} onChange={e=>{setWallReferenceWidth(e.target.value);setCorrection(null)}}/><span title="+normal = (-dy, dx) in project XY; −normal is opposite">±normal</span></div>}
        {foundationTool&&!foundationPolygon&&!foundationArea(activeTool)&&(activeTool!=='foundation_wall'||wallReference==='centreline')&&<label className="flex items-center gap-1"><input type="checkbox" aria-label="Continuous foundation drafting" checked={foundationContinuous} onChange={e=>{setFoundationContinuous(e.target.checked);setFoundationStart(null);setFoundationCursor(null);setCorrection(null);setDimensionA('');setDimensionError('');draftDirection.current=null}}/> Continuous</label>}
        {foundationPolygon&&foundationVertices.length>=(perimeterTool?4:3)&&<button className="bg-sky-700 px-2 py-1 rounded" onClick={finishFoundationPolygon}>Finish foundation polygon</button>}
        {foundationTool&&foundationArea(activeTool)&&<select aria-label="Foundation drawing mode" value={foundationMode} onChange={e=>setFoundationMode(e.target.value as 'rectangle'|'polygon')} className="bg-slate-800 rounded px-2 py-1"><option value="rectangle">Rectangle</option><option value="polygon">Polygon</option></select>}
        {roofDraft.length>=3&&<button className="bg-sky-700 px-2 py-1 rounded" onClick={()=>finishRoofPolygon()}>Finish polygon</button>}
        {roofAreaTool&&activeTool!=='roof_generate'&&<select aria-label="Roof drawing mode" value={roofMode} onChange={e=>setRoofMode(e.target.value as 'rectangle'|'polygon')} className="bg-slate-800 rounded px-2 py-1"><option value="rectangle">Rectangle</option><option value="polygon">Polygon</option></select>}
        {/* Precision Grid Snapping Selector */}
        <div className="flex items-center gap-1 bg-slate-950/80 border border-slate-800 rounded-lg px-1.5 py-0.5">
          <button
            onClick={() => {
              onChange({
                ...state,
                settings: {
                  ...state.settings,
                  gridSnap: !state.settings.gridSnap,
                },
              });
            }}
            className={`p-1 rounded text-xs transition-colors cursor-pointer ${
              state.settings.gridSnap
                ? 'text-sky-400 bg-sky-500/20'
                : 'text-slate-500 hover:text-slate-300'
            }`}
            title={state.settings.gridSnap ? 'Grid Snap: ON (Node snap remains active)' : 'Grid Snap: OFF (Node snap remains active)'}
          >
            <Magnet className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] text-slate-400 font-bold uppercase">Snap:</span>
          {[
            { label: `1'`, value: 1.0, title: `1 Foot Snap (12")` },
            { label: `6"`, value: 0.5, title: `6 Inch Snap (0.5')` },
            { label: `1"`, value: 0.0833, title: `1 Inch Snap (1/12')` },
          ].map((item) => {
            const isActive =
              state.settings.gridSnap &&
              Math.abs(state.settings.gridSnapSize - item.value) < 0.01;
            return (
              <button
                key={item.label}
                onClick={() => {
                  onChange({
                    ...state,
                    settings: {
                      ...state.settings,
                      gridSnap: true,
                      gridSnapSize: item.value,
                    },
                  });
                }}
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-sky-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
                title={item.title}
              >
                {item.label}
              </button>
            );
          })}
        </div>
        <div className="w-[1px] h-3.5 bg-slate-700 mx-1" />
        <button
          onClick={() => setIsStickyMode(!isStickyMode)}
          className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
            isStickyMode
              ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-400'
          }`}
          title={isStickyMode ? 'Continuous (Sticky) placement is ON' : 'Continuous (Sticky) placement is OFF'}
        >
          {isStickyMode ? <Pin className="w-3 h-3 text-sky-400 fill-sky-400" /> : <PinOff className="w-3 h-3 text-slate-400" />}
          Sticky: {isStickyMode ? 'ON' : 'OFF'}
        </button>
        {activeWallStartNodeId && (
          <button
            onClick={() => {
              setActiveWallStartNodeId(null);
              setDraftMousePos(null);
            }}
            className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-[11px] text-amber-400 font-medium cursor-pointer"
          >
            End Sequence
          </button>
        )}
        {(polygonError || (!generationOutline && generationError)) && (
          <div role="alert" className="pointer-events-none absolute top-full mt-2 inset-x-0 z-20 bg-slate-900 border border-amber-600 text-amber-300 rounded p-3 text-xs">
            {polygonError || generationError}
          </div>
        )}
      </div>

      {/* Drafting dimensions and zoom controls */}
      <div className="absolute bottom-4 right-4 z-20 flex flex-col items-end gap-2">
        <form className="bg-slate-900 border border-slate-700 rounded p-2 text-xs shadow-xl" onSubmit={e=>{e.preventDefault();commitDimensions()}}>
          <label className="flex items-center gap-2">Dimensions ({state.settings.unitSystem==='metric'?'m':'ft'})
            <input aria-label="Dimensions" className="w-36 bg-slate-800 border rounded p-1" placeholder={(recent?.rectangle??rectangularDraft)?'Width,depth':'Length'} value={dimensionA} disabled={!recent&&!dimensionStart} onFocus={()=>{if(!draftDirection.current&&dimensionToward)draftDirection.current={...dimensionToward};}} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();setDimensionA('');setDimensionError('');draftDirection.current=null;e.currentTarget.blur();}}} onChange={e=>setDimensionA(e.target.value)}/>
            <button type="submit" disabled={!dimensionA} className="bg-sky-700 disabled:opacity-40 rounded px-2 py-1">Apply</button>
          </label>
          {liveValue&&<p aria-label="Live drafting dimensions" className="text-sky-300">{recent?'Placement reference':'Live'}: {liveValue}</p>}
          {nextFoundationLength&&<p aria-label="Next foundation segment dimensions" className="text-amber-300">Next segment: {nextFoundationLength} · click to place</p>}
          <p>{recent?'Type dimensions to correct last placement':dimensionStart?'Type dimensions or click endpoint':'Ready'}</p>
          {dimensionError&&<p role="alert" className="text-amber-300">{dimensionError}</p>}
        </form>
        <div className="bg-slate-900/90 border border-slate-800 backdrop-blur-md p-1.5 rounded-xl shadow-2xl flex items-center gap-1">
          <button
            onClick={() => handleZoom(1.2)}
            className="p-2 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleZoom(0.83)}
            className="p-2 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={handleZoomFit}
            className="p-2 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer"
            title="Zoom to Fit"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          <div className="w-[1px] h-5 bg-slate-800 mx-1" />
          <div className="px-2 text-[11px] font-mono text-slate-400">
            {Math.round((transform.scale / 24) * 100)}%
          </div>
        </div>
      </div>

      {/* Floating Selected Element Quick Toolbar */}
      {selection.type !== 'none' && (selection.id || (selection.ids && selection.ids.length > 0)) && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-slate-900/95 border border-sky-500/30 backdrop-blur-md px-4 py-2 rounded-xl shadow-2xl flex items-center gap-3">
          <span className="text-xs font-semibold text-sky-400 uppercase tracking-wider">
            {(selection.type === 'multiple' || (selection.ids?.length ?? 0) > 1)
              ? `Selected: ${selection.ids?.length || 0} Items`
              : `Selected: ${selection.type} (${(selection.id ?? selection.ids?.[0])?.slice(0, 8)})`}
          </span>

          {selection.type === 'aperture' && (
            <>
              <button
                onClick={() => {
                  const updated = state.apertures.map((ap) =>
                    ap.id === selection.id
                      ? { ...ap, swingSide: ap.swingSide === 'inward' ? ('outward' as const) : ('inward' as const) }
                      : ap
                  );
                  onChange({ ...state, apertures: updated });
                }}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                title="Flip Inward/Outward Swing"
              >
                <RotateCw className="w-3.5 h-3.5 text-sky-400" />
                Flip Swing
              </button>
              <button
                onClick={() => {
                  const updated = state.apertures.map((ap) =>
                    ap.id === selection.id
                      ? { ...ap, hingeSide: ap.hingeSide === 'right' ? ('left' as const) : ('right' as const) }
                      : ap
                  );
                  onChange({ ...state, apertures: updated });
                }}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                title="Flip Left/Right Hinge"
              >
                <RotateCw className="w-3.5 h-3.5 text-emerald-400" />
                Flip Hinge
              </button>
            </>
          )}

          {selection.type === 'stamp' && (
            <button
              onClick={() => {
                const updated = state.stamps.map((st) =>
                  st.id === selection.id
                    ? { ...st, rotation: ((st.rotation || 0) + 90) % 360 }
                    : st
                );
                onChange({ ...state, stamps: updated });
              }}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
            >
              <RotateCw className="w-3.5 h-3.5" />
              Rotate 90°
            </button>
          )}

          {selection.type === 'annotation' && (
            <button
              onClick={() => {
                const updated = (state.annotations || []).map((ann) =>
                  ann.id === selection.id
                    ? { ...ann, rotation: ((ann.rotation || 0) + 45) % 360 }
                    : ann
                );
                onChange({ ...state, annotations: updated });
              }}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
            >
              <RotateCw className="w-3.5 h-3.5" />
              Rotate 45°
            </button>
          )}

          <button
            onClick={onDeleteSelected}
            className="px-2.5 py-1 bg-red-950/60 hover:bg-red-900/80 border border-red-500/30 text-red-300 text-xs rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </button>
        </div>
      )}
    </div>
  );
};
