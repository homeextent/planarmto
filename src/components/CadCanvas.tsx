import React, { useRef, useEffect, useState, useCallback } from 'react';
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
} from '../engine/cadMath';
import { getRoomCategory } from '../engine/roomCategories';
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

interface CadCanvasProps {
  state: FloorplanState;
  onChange: (newState: FloorplanState) => void;
  activeTool: ActiveTool;
  onToolChange: (tool: ActiveTool) => void;
  selection: SelectionState;
  onSelect: (selection: SelectionState) => void;
  onDeleteSelected: () => void;
  activeWallPreset: WallPreset;
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

export const CadCanvas: React.FC<CadCanvasProps> = ({
  state,
  onChange,
  activeTool,
  onToolChange,
  selection,
  onSelect,
  onDeleteSelected,
  activeWallPreset,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

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

  // Drafting wall sequence
  const [activeWallStartNodeId, setActiveWallStartNodeId] = useState<string | null>(null);
  const [draftMousePos, setDraftMousePos] = useState<Point2D | null>(null);
  const [snapCandidate, setSnapCandidate] = useState<{
    point: Point2D;
    type: 'node' | 'grid' | 'wall';
    nodeId?: string;
    wallId?: string;
  } | null>(null);

  // Dragging selected elements
  const [isDraggingElement, setIsDraggingElement] = useState(false);
  const [dragStartPoint, setDragStartPoint] = useState<Point2D>({ x: 0, y: 0 });

  // Rectangle room drafting
  const [roomBoxStart, setRoomBoxStart] = useState<Point2D | null>(null);

  // Measurement ruler drafting
  const [rulerStart, setRulerStart] = useState<Point2D | null>(null);
  const [rulerEnd, setRulerEnd] = useState<Point2D | null>(null);

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
      const totalInches = Math.round(feet * 12);
      const ft = Math.floor(totalInches / 12);
      const inches = totalInches % 12;
      return `${ft}'-${inches}"`;
    },
    [state.settings.unitSystem]
  );

  // Find nearest snap point (node snap has highest priority, then grid snap)
  const getSmartSnapPoint = useCallback(
    (rawWorld: Point2D, excludeNodeId?: string | null) => {
      const snapRadius = 1.0; // 1 ft snap radius
      let nearestNode: CadNode | null = null;
      let minNodeDist = snapRadius;

      state.nodes.forEach((n) => {
        if (excludeNodeId && n.id === excludeNodeId) return;
        const d = distance(rawWorld, n);
        if (d < minNodeDist) {
          minNodeDist = d;
          nearestNode = n;
        }
      });

      if (nearestNode) {
        return {
          point: { x: nearestNode.x, y: nearestNode.y },
          type: 'node' as const,
          nodeId: nearestNode.id,
        };
      }

      // Check wall centerline snap
      const nodeMap = new Map<string, CadNode>();
      state.nodes.forEach((n) => nodeMap.set(n.id, n));

      let nearestWallProj: { point: Point2D; wallId: string } | null = null;
      let minWallDist = 0.5; // 6 inches

      state.walls.forEach((w) => {
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
        return {
          point: nearestWallProj.point,
          type: 'wall' as const,
          wallId: nearestWallProj.wallId,
        };
      }

      // Grid snap fallback
      const gridSnapped = snapPointToGrid(rawWorld, state.settings.gridSnapSize);
      return {
        point: gridSnapped,
        type: 'grid' as const,
      };
    },
    [state.nodes, state.walls, state.settings.gridSnapSize]
  );

  // Zoom controls
  const handleZoom = (factor: number, centerX?: number, centerY?: number) => {
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
  };

  const handleZoomFit = () => {
    const canvas = canvasRef.current;
    if (!canvas || state.nodes.length === 0) {
      setTransform({ scale: 24, x: 200, y: 150 });
      return;
    }

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    state.nodes.forEach((n) => {
      minX = Math.min(minX, n.x);
      maxX = Math.max(maxX, n.x);
      minY = Math.min(minY, n.y);
      maxY = Math.max(maxY, n.y);
    });

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

  // Keyboard shortcut listener (Delete, Escape, Space)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selection.type !== 'none') {
          e.preventDefault();
          onDeleteSelected();
        }
      } else if (e.key === 'Escape') {
        setActiveWallStartNodeId(null);
        setDraftMousePos(null);
        setRoomBoxStart(null);
        setRulerStart(null);
        setRulerEnd(null);
        onSelect({ type: 'none' });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selection, onDeleteSelected, onSelect]);

  // Main rendering loop
  useEffect(() => {
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

    // Draw Grid
    const { scale, x: panX, y: panY } = transform;
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

      // Origin (0,0) axis indicator
      const originScreen = worldToScreen(0, 0);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(originScreen.x - 20, originScreen.y);
      ctx.lineTo(originScreen.x + 20, originScreen.y);
      ctx.moveTo(originScreen.x, originScreen.y - 20);
      ctx.lineTo(originScreen.x, originScreen.y + 20);
      ctx.stroke();
    }

    const nodeMap = new Map<string, CadNode>();
    state.nodes.forEach((n) => nodeMap.set(n.id, n));

    // 1. Draw Decks & Hardscapes
    state.decks.forEach((deck) => {
      if (deck.points.length < 3) return;
      const isSelected = selection.type === 'deck' && selection.id === deck.id;
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
      const isSelected = selection.type === 'hardscape' && selection.id === h.id;
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
    state.rooms.forEach((room) => {
      if (room.points.length < 3) return;
      const isSelected = selection.type === 'room' && selection.id === room.id;

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
        const areaStr = state.settings.unitSystem === 'metric'
          ? `${(room.area * 0.092903).toFixed(1)} m²`
          : `${room.area} SF`;
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

      const isSelected = selection.type === 'wall' && selection.id === wall.id;
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
        ctx.fillText(formatLength(geom.length), 0, 0);
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

      const isSelected = selection.type === 'aperture' && selection.id === ap.id;
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
        ctx.fillText(`W ${ap.width}'×${ap.height}'`, sCenter.x + nx * 1.6, sCenter.y + ny * 1.6);
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
        const pocketEnd = {
          x: sEnd.x + geom.dir.x * apWidthPx,
          y: sEnd.y + geom.dir.y * apWidthPx,
        };
        ctx.moveTo(sEnd.x, sEnd.y);
        ctx.lineTo(pocketEnd.x, pocketEnd.y);
        ctx.stroke();
        ctx.setLineDash([]);
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
        ctx.fillText(`D ${ap.width}'`, sCenter.x, sCenter.y);
      }

      ctx.restore();
    });

    // 6. Draw MEP Stamps & Structural Elements
    if (state.settings.showMepIcons) {
      state.stamps.forEach((st) => {
        const sp = worldToScreen(st.x, st.y);
        const isSelected = selection.type === 'stamp' && selection.id === st.id;

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
          const sym = st.type === 'switch_dimmer' ? '$D' : st.type === 'switch_3way' ? '$3' : '$';
          ctx.fillText(sym, 0, 0);
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
      const isSelected = selection.type === 'annotation' && selection.id === ann.id;
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
      const isSelected = selection.type === 'node' && selection.id === n.id;
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
      const startNode = nodeMap.get(activeWallStartNodeId);
      if (startNode) {
        const sStart = worldToScreen(startNode.x, startNode.y);
        const sEnd = worldToScreen(draftMousePos.x, draftMousePos.y);

        ctx.save();
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(sStart.x, sStart.y);
        ctx.lineTo(sEnd.x, sEnd.y);
        ctx.stroke();
        ctx.setLineDash([]);

        // Live length & angle badge
        const dLen = distance(startNode, draftMousePos);
        const dx = draftMousePos.x - startNode.x;
        const dy = draftMousePos.y - startNode.y;
        const deg = Math.round((Math.atan2(dy, dx) * 180) / Math.PI);
        const midX = (sStart.x + sEnd.x) / 2;
        const midY = (sStart.y + sEnd.y) / 2;

        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(midX - 45, midY - 24, 90, 20, 4);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#38bdf8';
        ctx.font = '700 11px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${formatLength(dLen)} @ ${deg}°`, midX, midY - 14);
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
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
      ctx.beginPath();
      ctx.rect(
        Math.min(sp1.x, sp2.x),
        Math.min(sp1.y, sp2.y),
        Math.abs(sp2.x - sp1.x),
        Math.abs(sp2.y - sp1.y)
      );
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([]);

      const centX = (sp1.x + sp2.x) / 2;
      const centY = (sp1.y + sp2.y) / 2;
      ctx.fillStyle = '#38bdf8';
      ctx.font = '700 12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${formatLength(rW)} × ${formatLength(rH)} (${area} SF)`, centX, centY);
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

    // D. Magnetic Snap Indicator Ring & Dynamic Wall Offset Dimension Callouts
    if (snapCandidate) {
      const sp = worldToScreen(snapCandidate.point.x, snapCandidate.point.y);
      ctx.save();
      ctx.strokeStyle = snapCandidate.type === 'node' ? '#10b981' : snapCandidate.type === 'wall' ? '#f59e0b' : '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, 7, 0, Math.PI * 2);
      ctx.stroke();

      if (snapCandidate.type === 'node') {
        ctx.fillStyle = '#10b981';
        ctx.font = '600 10px system-ui, sans-serif';
        ctx.fillText('SNAP NODE', sp.x + 10, sp.y - 6);
      } else if (snapCandidate.type === 'wall' && snapCandidate.wallId) {
        // Dynamic linear offset dimension callouts from wall nodes
        const hostWall = state.walls.find((w) => w.id === snapCandidate.wallId);
        if (hostWall) {
          const n1 = nodeMap.get(hostWall.startNodeId);
          const n2 = nodeMap.get(hostWall.endNodeId);
          if (n1 && n2) {
            const sn1 = worldToScreen(n1.x, n1.y);
            const sn2 = worldToScreen(n2.x, n2.y);
            const d1 = distance(n1, snapCandidate.point);
            const d2 = distance(snapCandidate.point, n2);

            const dx = sn2.x - sn1.x;
            const dy = sn2.y - sn1.y;
            const len = Math.hypot(dx, dy);
            if (len > 0.001) {
              const nx = -dy / len;
              const ny = dx / len;
              const offsetPx = 22;

              const offStart1 = { x: sn1.x + nx * offsetPx, y: sn1.y + ny * offsetPx };
              const offSnap = { x: sp.x + nx * offsetPx, y: sp.y + ny * offsetPx };
              const offEnd2 = { x: sn2.x + nx * offsetPx, y: sn2.y + ny * offsetPx };

              ctx.strokeStyle = '#f59e0b';
              ctx.lineWidth = 1.5;
              ctx.setLineDash([2, 2]);
              // Witness lines
              ctx.beginPath();
              ctx.moveTo(sn1.x, sn1.y);
              ctx.lineTo(offStart1.x, offStart1.y);
              ctx.moveTo(sp.x, sp.y);
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

    ctx.restore();
  }, [
    state,
    transform,
    selection,
    activeTool,
    activeWallStartNodeId,
    draftMousePos,
    snapCandidate,
    roomBoxStart,
    rulerStart,
    rulerEnd,
    formatLength,
    worldToScreen,
  ]);

  // Handle Mouse Down
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;
    const rawWorld = screenToWorld(clientX, clientY);

    // Pan with Middle Click or Shift/Space drag
    if (e.button === 1 || e.shiftKey || e.altKey) {
      setIsPanning(true);
      setPanStart({ x: clientX, y: clientY });
      return;
    }

    if (e.button !== 0) return; // Only left click for drawing/selecting

    const snap = getSmartSnapPoint(rawWorld, activeWallStartNodeId);
    const worldPoint = snap.point;

    // --- TOOL: RULER MEASURE ---
    if (activeTool === 'ruler_measure') {
      if (!rulerStart) {
        setRulerStart(worldPoint);
        setRulerEnd(worldPoint);
      } else {
        setRulerEnd(worldPoint);
      }
      return;
    }

    // --- TOOL: ROOM BOX (4-wall rectangle) ---
    if (activeTool === 'wall_rect' || activeTool === 'room_box') {
      if (!roomBoxStart) {
        setRoomBoxStart(worldPoint);
      } else {
        // Complete box
        const x1 = roomBoxStart.x;
        const y1 = roomBoxStart.y;
        const x2 = worldPoint.x;
        const y2 = worldPoint.y;

        if (Math.abs(x2 - x1) > 1 && Math.abs(y2 - y1) > 1) {
          const idPrefix = Date.now();
          const n1: CadNode = { id: `n_${idPrefix}_1`, x: x1, y: y1 };
          const n2: CadNode = { id: `n_${idPrefix}_2`, x: x2, y: y1 };
          const n3: CadNode = { id: `n_${idPrefix}_3`, x: x2, y: y2 };
          const n4: CadNode = { id: `n_${idPrefix}_4`, x: x1, y: y2 };

          const presetProps = getWallPropertiesFromPreset(activeWallPreset);

          const w1: CadWall = {
            id: `w_${idPrefix}_1`,
            startNodeId: n1.id,
            endNodeId: n2.id,
            ...presetProps,
            height: state.settings.defaultWallHeight,
          };
          const w2: CadWall = {
            id: `w_${idPrefix}_2`,
            startNodeId: n2.id,
            endNodeId: n3.id,
            ...presetProps,
            height: state.settings.defaultWallHeight,
          };
          const w3: CadWall = {
            id: `w_${idPrefix}_3`,
            startNodeId: n3.id,
            endNodeId: n4.id,
            ...presetProps,
            height: state.settings.defaultWallHeight,
          };
          const w4: CadWall = {
            id: `w_${idPrefix}_4`,
            startNodeId: n4.id,
            endNodeId: n1.id,
            ...presetProps,
            height: state.settings.defaultWallHeight,
          };

          const newNodes = [...state.nodes, n1, n2, n3, n4];
          const newWalls = [...state.walls, w1, w2, w3, w4];
          const detectedRooms = detectRoomFaces(newNodes, newWalls, state.rooms);

          onChange({
            ...state,
            nodes: newNodes,
            walls: newWalls,
            rooms: detectedRooms,
          });
        }

        setRoomBoxStart(null);
        onToolChange('select');
      }
      return;
    }

    // --- TOOL: WALL PEN ---
    if (activeTool === 'wall_pen') {
      if (!activeWallStartNodeId) {
        // First node of the wall
        let startNodeId = snap.nodeId;
        let nextNodes = [...state.nodes];
        let nextWalls = [...state.walls];
        let nextApertures = [...state.apertures];

        if (snap.type === 'wall' && snap.wallId) {
          // Snap onto existing wall segment: split it to create a T-junction node
          const splitRes = splitWallAtPoint(snap.wallId, snap.point, nextNodes, nextWalls, nextApertures);
          nextNodes = splitRes.nodes;
          nextWalls = splitRes.walls;
          nextApertures = splitRes.apertures;
          startNodeId = splitRes.splitNodeId;
          const detectedRooms = detectRoomFaces(nextNodes, nextWalls, state.rooms);
          onChange({
            ...state,
            nodes: nextNodes,
            walls: nextWalls,
            apertures: nextApertures,
            rooms: detectedRooms,
          });
        } else if (!startNodeId) {
          const newNode: CadNode = {
            id: `node_${Date.now()}`,
            x: worldPoint.x,
            y: worldPoint.y,
          };
          nextNodes.push(newNode);
          startNodeId = newNode.id;
          onChange({ ...state, nodes: nextNodes });
        }

        setActiveWallStartNodeId(startNodeId);
      } else {
        // Second node of the wall segment
        let targetPoint = worldPoint;
        const startNode = state.nodes.find((n) => n.id === activeWallStartNodeId);

        if (startNode) {
          targetPoint = snapAngle(
            startNode,
            targetPoint,
            state.settings.angleSnapIncrement,
            state.settings.orthoMode
          );

          if (state.settings.orthoMode) {
            // Re-enforce exact orthogonal axis lock
            if (Math.abs(targetPoint.x - startNode.x) >= Math.abs(targetPoint.y - startNode.y)) {
              targetPoint.y = startNode.y;
            } else {
              targetPoint.x = startNode.x;
            }
          }
        }

        const angleSnapResult = getSmartSnapPoint(targetPoint, activeWallStartNodeId);
        if (state.settings.orthoMode && startNode && angleSnapResult.nodeId) {
          const candNode = state.nodes.find((n) => n.id === angleSnapResult.nodeId);
          if (candNode && (Math.abs(candNode.x - startNode.x) < 0.2 || Math.abs(candNode.y - startNode.y) < 0.2)) {
            targetPoint = angleSnapResult.point;
          }
        } else {
          targetPoint = angleSnapResult.point;
        }

        let endNodeId = angleSnapResult.nodeId;
        let updatedNodes = [...state.nodes];
        let updatedWalls = [...state.walls];
        let updatedApertures = [...state.apertures];

        if (angleSnapResult.type === 'wall' && angleSnapResult.wallId) {
          // Snap onto existing wall segment: split it for complete topological PSLG face subdivision!
          const splitRes = splitWallAtPoint(angleSnapResult.wallId, angleSnapResult.point, updatedNodes, updatedWalls, updatedApertures);
          updatedNodes = splitRes.nodes;
          updatedWalls = splitRes.walls;
          updatedApertures = splitRes.apertures;
          endNodeId = splitRes.splitNodeId;
        } else if (!endNodeId) {
          const newNode: CadNode = {
            id: `node_${Date.now()}`,
            x: targetPoint.x,
            y: targetPoint.y,
          };
          updatedNodes.push(newNode);
          endNodeId = newNode.id;
        }

        // Avoid zero-length walls
        if (endNodeId && endNodeId !== activeWallStartNodeId) {
          const presetProps = getWallPropertiesFromPreset(activeWallPreset);
          const newWall: CadWall = {
            id: `wall_${Date.now()}`,
            startNodeId: activeWallStartNodeId,
            endNodeId,
            ...presetProps,
            height: state.settings.defaultWallHeight,
          };

          const finalWalls = [...updatedWalls, newWall];
          const detectedRooms = detectRoomFaces(updatedNodes, finalWalls, state.rooms);

          onChange({
            ...state,
            nodes: updatedNodes,
            walls: finalWalls,
            apertures: updatedApertures,
            rooms: detectedRooms,
          });

          // Continue continuous wall chain from the new end node
          setActiveWallStartNodeId(endNodeId);
        }
      }
      return;
    }

    // --- TOOL: TEXT ANNOTATION ---
    if (activeTool === 'text_label') {
      const newAnnotation: CadAnnotation = {
        id: `ann_${Date.now()}`,
        x: Math.round(worldPoint.x * 10) / 10,
        y: Math.round(worldPoint.y * 10) / 10,
        text: 'Plan Note / Specification',
        fontSize: 14,
        color: '#38bdf8',
        rotation: 0,
      };

      onChange({
        ...state,
        annotations: [...(state.annotations || []), newAnnotation],
      });

      onSelect({ type: 'annotation', id: newAnnotation.id });
      if (!isStickyMode) {
        onToolChange('select');
      }
      return;
    }

    // --- TOOL: APERTURE PLACEMENT (Door/Window) ---
    if (activeTool.startsWith('aperture_')) {
      const nodeMap = new Map<string, CadNode>();
      state.nodes.forEach((n) => nodeMap.set(n.id, n));

      let hitWall: CadWall | null = null;
      let hitOffset = 0;

      state.walls.forEach((w) => {
        const n1 = nodeMap.get(w.startNodeId);
        const n2 = nodeMap.get(w.endNodeId);
        if (!n1 || !n2) return;
        const proj = projectPointOntoSegment(rawWorld, n1, n2);
        if (proj.distance < 1.2) {
          hitWall = w;
          const wallLen = distance(n1, n2);
          hitOffset = proj.t * wallLen;
        }
      });

      if (hitWall) {
        let apType: Aperture['type'] = 'door_passage';
        let width = 3.0;
        let height = 6.67;

        if (activeTool === 'aperture_window') {
          apType = 'window_standard';
          width = 4.0;
          height = 4.0;
        } else if (activeTool === 'aperture_pocket_door') {
          apType = 'door_pocket';
          width = 2.67;
        } else if (activeTool === 'aperture_exterior_door') {
          apType = 'door_exterior';
          width = 3.0;
        } else if (activeTool === 'aperture_garage') {
          apType = 'door_garage';
          width = 9.0;
          height = 8.0;
        } else if (activeTool === 'aperture_patio_slider') {
          apType = 'door_sliding_patio';
          width = 6.0;
        }

        const newAperture: Aperture = {
          id: `ap_${Date.now()}`,
          wallId: (hitWall as CadWall).id,
          offset: Math.round(hitOffset * 10) / 10,
          width,
          height,
          type: apType,
          swingSide: 'inward',
        };

        onChange({
          ...state,
          apertures: [...state.apertures, newAperture],
        });

        onSelect({ type: 'aperture', id: newAperture.id });
        if (!isStickyMode) {
          onToolChange('select');
        }
      }
      return;
    }

    // --- TOOL: MEP STAMPING ---
    const stampTypeMap: Record<string, CadStamp['type']> = {
      stamp_column: 'column_post',
      stamp_pier: 'helical_pier',
      stamp_beam: 'beam_segment',
      stamp_stair: 'stair_run',
      stamp_switch: 'switch_std',
      stamp_dimmer: 'switch_dimmer',
      stamp_3way: 'switch_3way',
      stamp_outlet: 'outlet_std',
      stamp_gfci: 'outlet_gfci',
      stamp_240v: 'outlet_240v',
      stamp_ev: 'outlet_ev',
      stamp_potlight: 'light_potlight',
      stamp_light_fixture: 'light_fixture',
      stamp_coach_light: 'light_coach',
      stamp_soffit_light: 'light_soffit',
      stamp_fan_ceiling: 'fan_ceiling',
      stamp_fan_exhaust: 'fan_exhaust',
      stamp_rangehood: 'fan_rangehood',
      alarm_smoke_co: 'alarm_smoke_co',
      stamp_plumbing_toilet: 'plumbing_toilet',
      stamp_plumbing_sink: 'plumbing_sink',
      stamp_plumbing_shower: 'plumbing_shower',
      stamp_plumbing_tub: 'plumbing_tub',
      stamp_plumbing_hose_bib: 'plumbing_hose_bib',
      stamp_plumbing_water_heater: 'plumbing_water_heater',
      stamp_plumbing_fixture: 'plumbing_fixture',
      stamp_utility_trench: 'utility_trench',
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
      };

      onChange({
        ...state,
        stamps: [...state.stamps, newStamp],
      });

      onSelect({ type: 'stamp', id: newStamp.id });
      if (!isStickyMode) {
        onToolChange('select');
      }
      return;
    }

    // --- TOOL: SELECT ---
    if (activeTool === 'select') {
      // 1. Check node hit
      const hitNode = state.nodes.find((n) => distance(rawWorld, n) < 0.8);
      if (hitNode) {
        onSelect({ type: 'node', id: hitNode.id });
        setIsDraggingElement(true);
        setDragStartPoint(worldPoint);
        return;
      }

      // 2. Check annotation hit
      const hitAnnotation = (state.annotations || []).find((ann) => {
        return distance(rawWorld, { x: ann.x, y: ann.y }) < 2.5;
      });
      if (hitAnnotation) {
        onSelect({ type: 'annotation', id: hitAnnotation.id });
        setIsDraggingElement(true);
        setDragStartPoint(worldPoint);
        return;
      }

      // 3. Check aperture hit
      const nodeMap = new Map<string, CadNode>();
      state.nodes.forEach((n) => nodeMap.set(n.id, n));

      const hitAperture = state.apertures.find((ap) => {
        const wall = state.walls.find((w) => w.id === ap.wallId);
        if (!wall) return false;
        const geom = getApertureGeometry(ap, wall, nodeMap);
        if (!geom) return false;
        return distance(rawWorld, geom.center) < geom.width / 2 + 0.5;
      });

      if (hitAperture) {
        onSelect({ type: 'aperture', id: hitAperture.id });
        setIsDraggingElement(true);
        setDragStartPoint(worldPoint);
        return;
      }

      // 4. Check stamp hit
      const hitStamp = state.stamps.find((st) => {
        // Linear elements (beam, utility trench)
        if (st.type === 'beam_segment' || st.type === 'utility_trench') {
          const len = st.length || (st.type === 'beam_segment' ? 12 : 25);
          const rad = ((st.rotation || 0) * Math.PI) / 180;
          const halfDx = (len / 2) * Math.cos(rad);
          const halfDy = (len / 2) * Math.sin(rad);
          const p1 = { x: st.x - halfDx, y: st.y - halfDy };
          const p2 = { x: st.x + halfDx, y: st.y + halfDy };
          const proj = projectPointOntoSegment(rawWorld, p1, p2);
          return proj.distance < 1.4;
        }

        // Rotated 2D bounding boxes for all architectural/MEP stamps
        const rad = -((st.rotation || 0) * Math.PI) / 180;
        const dx = rawWorld.x - st.x;
        const dy = rawWorld.y - st.y;
        const localX = Math.abs(dx * Math.cos(rad) - dy * Math.sin(rad));
        const localY = Math.abs(dx * Math.sin(rad) + dy * Math.cos(rad));

        let halfW = 1.0;
        let halfH = 1.0;

        if (st.type === 'plumbing_tub') {
          halfW = 2.7; // 5.4 ft length
          halfH = 1.6; // 3.2 ft width
        } else if (st.type === 'plumbing_shower') {
          halfW = 1.8;
          halfH = 1.8;
        } else if (st.type === 'stair_run') {
          halfW = 2.2;
          halfH = 3.5;
        } else if (st.type === 'plumbing_toilet') {
          halfW = 1.2;
          halfH = 1.6;
        } else if (st.type === 'plumbing_sink' || st.type === 'plumbing_water_heater') {
          halfW = 1.4;
          halfH = 1.4;
        } else if (st.type === 'fan_exhaust' || st.type === 'fan_rangehood') {
          halfW = 1.6;
          halfH = 1.4;
        } else if (st.type === 'column_post' || st.type === 'helical_pier') {
          halfW = 1.2;
          halfH = 1.2;
        } else if (st.type === 'fan_ceiling') {
          halfW = 1.8;
          halfH = 1.8;
        }

        return localX <= halfW + 0.4 && localY <= halfH + 0.4;
      });
      if (hitStamp) {
        onSelect({ type: 'stamp', id: hitStamp.id });
        setIsDraggingElement(true);
        setDragStartPoint(worldPoint);
        return;
      }

      // 5. Check wall hit
      const hitWall = state.walls.find((w) => {
        const n1 = nodeMap.get(w.startNodeId);
        const n2 = nodeMap.get(w.endNodeId);
        if (!n1 || !n2) return false;
        const proj = projectPointOntoSegment(rawWorld, n1, n2);
        return proj.distance < (w.thickness / 2) + 0.5;
      });

      if (hitWall) {
        onSelect({ type: 'wall', id: hitWall.id });
        setIsDraggingElement(true);
        setDragStartPoint(worldPoint);
        return;
      }

      // 6. Check room hit
      const hitRoom = state.rooms.find((room) => {
        return isPointInPolygon(rawWorld, room.points) || distance(rawWorld, room.centroid) < 4.0;
      });

      if (hitRoom) {
        onSelect({ type: 'room', id: hitRoom.id });
        setIsDraggingElement(true);
        setDragStartPoint(worldPoint);
        return;
      }

      // 7. Check deck hit
      const hitDeck = state.decks.find((d) => isPointInPolygon(rawWorld, d.points));
      if (hitDeck) {
        onSelect({ type: 'deck', id: hitDeck.id });
        setIsDraggingElement(true);
        setDragStartPoint(worldPoint);
        return;
      }

      // 8. Check hardscape hit
      const hitHardscape = state.hardscapes.find((h) => isPointInPolygon(rawWorld, h.points));
      if (hitHardscape) {
        onSelect({ type: 'hardscape', id: hitHardscape.id });
        setIsDraggingElement(true);
        setDragStartPoint(worldPoint);
        return;
      }

      // Deselect
      onSelect({ type: 'none' });
    }
  };

  // Handle Mouse Move
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    if (isPanning) {
      setTransform((prev) => ({
        ...prev,
        x: prev.x + (clientX - panStart.x),
        y: prev.y + (clientY - panStart.y),
      }));
      setPanStart({ x: clientX, y: clientY });
      return;
    }

    const rawWorld = screenToWorld(clientX, clientY);
    const snap = getSmartSnapPoint(rawWorld, activeWallStartNodeId);
    setSnapCandidate(snap);

    let currentPoint = snap.point;

    // Angle snapping for wall pen
    if (activeTool === 'wall_pen' && activeWallStartNodeId) {
      const startNode = state.nodes.find((n) => n.id === activeWallStartNodeId);
      if (startNode) {
        currentPoint = snapAngle(
          startNode,
          currentPoint,
          state.settings.angleSnapIncrement,
          state.settings.orthoMode
        );

        if (state.settings.orthoMode) {
          if (Math.abs(currentPoint.x - startNode.x) >= Math.abs(currentPoint.y - startNode.y)) {
            currentPoint.y = startNode.y;
          } else {
            currentPoint.x = startNode.x;
          }
        }
      }
    }

    setDraftMousePos(currentPoint);

    // Element Dragging & Push/Pull logic
    if (isDraggingElement && selection.type !== 'none' && selection.id) {
      const dx = currentPoint.x - dragStartPoint.x;
      const dy = currentPoint.y - dragStartPoint.y;

      if (Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001) {
        if (selection.type === 'node') {
          const updatedNodes = state.nodes.map((n) =>
            n.id === selection.id ? { ...n, x: currentPoint.x, y: currentPoint.y } : n
          );
          const updatedRooms = detectRoomFaces(updatedNodes, state.walls, state.rooms);
          onChange({ ...state, nodes: updatedNodes, rooms: updatedRooms });
        } else if (selection.type === 'wall') {
          const wall = state.walls.find((w) => w.id === selection.id);
          if (wall) {
            const startNode = state.nodes.find((n) => n.id === wall.startNodeId);
            const endNode = state.nodes.find((n) => n.id === wall.endNodeId);
            if (startNode && endNode) {
              const wallDx = endNode.x - startNode.x;
              const wallDy = endNode.y - startNode.y;
              const wallLen = Math.hypot(wallDx, wallDy);

              let effectiveDx = dx;
              let effectiveDy = dy;

              // Orthogonal Wall Drag Locking:
              // Lock translation perpendicular to the wall's orientation.
              // Attached perpendicular walls naturally stretch/shrink while preserving 90-degree corners.
              if (wallLen > 0.001) {
                const isHorizontal = Math.abs(wallDy) < 0.05;
                const isVertical = Math.abs(wallDx) < 0.05;

                if (isHorizontal) {
                  // Horizontal wall moves strictly along Y axis (perpendicular to wall)
                  effectiveDx = 0;
                  effectiveDy = dy;
                } else if (isVertical) {
                  // Vertical wall moves strictly along X axis (perpendicular to wall)
                  effectiveDx = dx;
                  effectiveDy = 0;
                } else {
                  // Angled wall: project displacement (dx, dy) onto wall normal vector
                  const nx = -wallDy / wallLen;
                  const ny = wallDx / wallLen;
                  const proj = dx * nx + dy * ny;
                  effectiveDx = proj * nx;
                  effectiveDy = proj * ny;
                }
              }

              if (Math.abs(effectiveDx) > 0.0001 || Math.abs(effectiveDy) > 0.0001) {
                const updatedNodes = state.nodes.map((n) => {
                  if (n.id === wall.startNodeId || n.id === wall.endNodeId) {
                    return {
                      ...n,
                      x: Math.round((n.x + effectiveDx) * 100) / 100,
                      y: Math.round((n.y + effectiveDy) * 100) / 100,
                    };
                  }
                  return n;
                });
                const updatedRooms = detectRoomFaces(updatedNodes, state.walls, state.rooms);
                onChange({ ...state, nodes: updatedNodes, rooms: updatedRooms });
              }
            }
          }
        } else if (selection.type === 'aperture') {
          const ap = state.apertures.find((a) => a.id === selection.id);
          if (ap) {
            const wall = state.walls.find((w) => w.id === ap.wallId);
            if (wall) {
              const n1 = state.nodes.find((n) => n.id === wall.startNodeId);
              const n2 = state.nodes.find((n) => n.id === wall.endNodeId);
              if (n1 && n2) {
                const wallLen = distance(n1, n2);
                const proj = projectPointOntoSegment(rawWorld, n1, n2);
                const snapInc = state.settings.gridSnapSize || 0.5;
                let newOffset = proj.t * wallLen - ap.width / 2;
                newOffset = Math.round(newOffset / snapInc) * snapInc;
                newOffset = Math.max(0, Math.min(Math.max(0, wallLen - ap.width), newOffset));
                const updatedApertures = state.apertures.map((a) =>
                  a.id === ap.id ? { ...a, offset: Math.round(newOffset * 100) / 100 } : a
                );
                onChange({ ...state, apertures: updatedApertures });
              }
            }
          }
        } else if (selection.type === 'room') {
          const room = state.rooms.find((r) => r.id === selection.id);
          if (room) {
            const roomNodeSet = new Set(room.nodeIds);
            const updatedNodes = state.nodes.map((n) => {
              if (roomNodeSet.has(n.id)) {
                return { ...n, x: Math.round((n.x + dx) * 100) / 100, y: Math.round((n.y + dy) * 100) / 100 };
              }
              return n;
            });
            const updatedStamps = state.stamps.map((st) => {
              if (isPointInPolygon({ x: st.x, y: st.y }, room.points)) {
                return { ...st, x: Math.round((st.x + dx) * 100) / 100, y: Math.round((st.y + dy) * 100) / 100 };
              }
              return st;
            });
            const updatedRooms = detectRoomFaces(updatedNodes, state.walls, state.rooms);
            onChange({ ...state, nodes: updatedNodes, stamps: updatedStamps, rooms: updatedRooms });
          }
        } else if (selection.type === 'stamp') {
          const updatedStamps = state.stamps.map((st) =>
            st.id === selection.id ? { ...st, x: currentPoint.x, y: currentPoint.y } : st
          );
          onChange({ ...state, stamps: updatedStamps });
        } else if (selection.type === 'annotation') {
          const updatedAnnotations = (state.annotations || []).map((ann) =>
            ann.id === selection.id
              ? { ...ann, x: Math.round(currentPoint.x * 10) / 10, y: Math.round(currentPoint.y * 10) / 10 }
              : ann
          );
          onChange({ ...state, annotations: updatedAnnotations });
        } else if (selection.type === 'deck') {
          const updatedDecks = state.decks.map((d) => {
            if (d.id === selection.id) {
              return {
                ...d,
                points: d.points.map((pt) => ({
                  x: Math.round((pt.x + dx) * 100) / 100,
                  y: Math.round((pt.y + dy) * 100) / 100,
                })),
              };
            }
            return d;
          });
          onChange({ ...state, decks: updatedDecks });
        } else if (selection.type === 'hardscape') {
          const updatedHardscapes = state.hardscapes.map((h) => {
            if (h.id === selection.id) {
              return {
                ...h,
                points: h.points.map((pt) => ({
                  x: Math.round((pt.x + dx) * 100) / 100,
                  y: Math.round((pt.y + dy) * 100) / 100,
                })),
              };
            }
            return h;
          });
          onChange({ ...state, hardscapes: updatedHardscapes });
        }

        setDragStartPoint(currentPoint);
      }
    }
  };

  // Handle Mouse Up
  const handleMouseUp = () => {
    setIsPanning(false);
    setIsDraggingElement(false);
  };

  // Handle Double Click to finish wall drawing chain
  const handleDoubleClick = () => {
    if (activeTool === 'wall_pen') {
      setActiveWallStartNodeId(null);
      setDraftMousePos(null);
      onToolChange('select');
    }
  };

  // Handle Wheel (Zoom)
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
    handleZoom(zoomFactor, clientX, clientY);
  };

  return (
    <div
      ref={containerRef}
      className="relative flex-1 w-full h-full bg-slate-950 overflow-hidden select-none cursor-crosshair"
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full block"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        onWheel={handleWheel}
        onContextMenu={(e) => e.preventDefault()}
      />

      {/* Floating Canvas Overlays & Controls */}
      {/* Top Center Tool Info Banner */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-slate-900/90 border border-slate-800 backdrop-blur-md px-4 py-1.5 rounded-full text-xs text-slate-300 shadow-xl flex items-center gap-3">
        <span className="flex items-center gap-1.5 font-medium text-sky-400">
          <Compass className="w-3.5 h-3.5" />
          {activeTool === 'wall_pen'
            ? activeWallStartNodeId
              ? 'Click to place next wall node (Double-click / ESC to finish)'
              : 'Click to drop start node for wall'
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
            : 'Select & Move (Click wall, node, room, stamp, or note)'}
        </span>
        <div className="w-[1px] h-3.5 bg-slate-700 mx-1" />
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
            title={state.settings.gridSnap ? 'Grid Snap: ON' : 'Grid Snap: OFF'}
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
      </div>

      {/* Bottom Right Floating Zoom / Grid Overlay */}
      <div className="absolute bottom-4 right-4 bg-slate-900/90 border border-slate-800 backdrop-blur-md p-1.5 rounded-xl shadow-2xl flex items-center gap-1">
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

      {/* Floating Selected Element Quick Toolbar */}
      {selection.type !== 'none' && selection.id && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-slate-900/95 border border-sky-500/30 backdrop-blur-md px-4 py-2 rounded-xl shadow-2xl flex items-center gap-3">
          <span className="text-xs font-semibold text-sky-400 uppercase tracking-wider">
            Selected: {selection.type} ({selection.id.slice(0, 8)})
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
