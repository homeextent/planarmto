import { CadNode, CadWall, RoomPolygon, Aperture, WallJustification } from '../types';

export interface Point2D {
  x: number;
  y: number;
}

/**
 * PHASE 2: Coordinate Translation
 * Converts user input (intended face/center) to underlying centerline nodes.
 * If 'interior_face', for a rectangle, we must expand the nodes outward by t/2.
 */
export function convertInputToCenterlineNodes(
  points: Point2D[],
  wallThickness: number,
  justification: WallJustification
): Point2D[] {
  if (justification === 'centerline') return points;

  // For a closed room box (4 points), we calculate the centroid to determine "outward"
  const centroid = calculatePolygonCentroid(points);
  
  const sign = justification === 'interior_face' ? 1 : -1;
  const effectiveThickness = getWallThickness({ thickness: wallThickness });
  const offset = (effectiveThickness / 2) * sign;

  return points.map((p) => {
    const dx = p.x - centroid.x;
    const dy = p.y - centroid.y;
    
    // Push away from centroid for interior_face (expanding), pull in for exterior_face (shrinking)
    // We use a small epsilon to handle axis-aligned points correctly
    const ox = Math.abs(dx) < 0.001 ? 0 : (dx > 0 ? offset : -offset);
    const oy = Math.abs(dy) < 0.001 ? 0 : (dy > 0 ? offset : -offset);

    // Bypass grid snapping for the expansion by using high precision
    // Return exact floating point coordinates to maintain precision
    return {
      x: p.x + ox,
      y: p.y + oy,
    };
  });
}

/**
 * PHASE 2: Inset Interior Polygon Derivation
 * Generates an inward parallel offset polygon (shrunken by t/2) from centerline cycle.
 */
export function getNetInteriorPolygon(
  cyclePoints: Point2D[],
  wallThicknesses: number | number[]
): Point2D[] {
  if (cyclePoints.length < 3) return cyclePoints;

  const result: Point2D[] = [];
  const n = cyclePoints.length;

  for (let i = 0; i < n; i++) {
    const prevIdx = (i - 1 + n) % n;
    const currIdx = i;

    const prevPt = cyclePoints[prevIdx];
    const currPt = cyclePoints[currIdx];
    const nextPt = cyclePoints[(i + 1) % n];

    // Edge vectors
    const v1 = { x: currPt.x - prevPt.x, y: currPt.y - prevPt.y };
    const v2 = { x: nextPt.x - currPt.x, y: nextPt.y - currPt.y };

    const l1 = Math.hypot(v1.x, v1.y);
    const l2 = Math.hypot(v2.x, v2.y);

    // Normals (pointing inward for CCW)
    const n1 = { x: -v1.y / l1, y: v1.x / l1 };
    const n2 = { x: -v2.y / l2, y: v2.x / l2 };

    const t1 = Array.isArray(wallThicknesses) ? wallThicknesses[prevIdx] : wallThicknesses;
    const t2 = Array.isArray(wallThicknesses) ? wallThicknesses[currIdx] : wallThicknesses;

    const offset1 = t1 / 2;
    const offset2 = t2 / 2;

    const det = n1.x * n2.y - n1.y * n2.x;

    if (Math.abs(det) < 0.0001) {
      // Parallel edges
      const d = (offset1 + offset2) / 2;
      result.push({ x: currPt.x + n1.x * d, y: currPt.y + n1.y * d });
    } else {
      // Intersection of two offset lines
      const dx = (offset1 * n2.y - offset2 * n1.y) / det;
      const dy = (n1.x * offset2 - n2.x * offset1) / det;
      
      result.push({ x: currPt.x + dx, y: currPt.y + dy });
    }
  }

  return result;
}

/**
 * PHASE 4: Variable Offset Polygon
 * Offsets each edge of a polygon by a specific distance.
 * Positive offset moves inward (for CCW polygon).
 */
export function getVariableOffsetPolygon(
  cyclePoints: Point2D[],
  edgeOffsets: number[]
): Point2D[] {
  if (cyclePoints.length < 3) return cyclePoints;

  const result: Point2D[] = [];
  const n = cyclePoints.length;

  for (let i = 0; i < n; i++) {
    const prevIdx = (i - 1 + n) % n;
    const currIdx = i;

    const prevPt = cyclePoints[prevIdx];
    const currPt = cyclePoints[currIdx];
    const nextPt = cyclePoints[(i + 1) % n];

    // Edge vectors
    const v1 = { x: currPt.x - prevPt.x, y: currPt.y - prevPt.y };
    const v2 = { x: nextPt.x - currPt.x, y: nextPt.y - currPt.y };

    const l1 = Math.hypot(v1.x, v1.y);
    const l2 = Math.hypot(v2.x, v2.y);

    // Inward normals
    const n1 = { x: -v1.y / l1, y: v1.x / l1 };
    const n2 = { x: -v2.y / l2, y: v2.x / l2 };

    const d1 = edgeOffsets[prevIdx];
    const d2 = edgeOffsets[currIdx];

    const det = n1.x * n2.y - n1.y * n2.x;

    if (Math.abs(det) < 0.0001) {
      const d = (d1 + d2) / 2;
      result.push({ x: currPt.x + n1.x * d, y: currPt.y + n1.y * d });
    } else {
      const dx = (d1 * n2.y - d2 * n1.y) / det;
      const dy = (n1.x * d2 - n2.x * d1) / det;
      result.push({ x: currPt.x + dx, y: currPt.y + dy });
    }
  }

  return result;
}

/**
 * PHASE 2: Wall Thickness Helper
 * Ensures unified thickness derivation for both centerline expansion and interior inset.
 * Standardizes 3.5" core vs 4.5" total assembly thickness.
 */
export function getWallThickness(wall: { thickness: number }): number {
  // If the thickness is exactly 3.5" (0.29167 ft), we treat it as a standard 2x4 wall 
  // that needs assembly thickness (4.5" = 0.375 ft) for interior face logic.
  // Otherwise we use the provided thickness.
  const CORE_2X4 = 3.5 / 12;
  const ASSEMBLY_2X4 = 4.5 / 12;
  
  if (Math.abs(wall.thickness - CORE_2X4) < 0.001) {
    return ASSEMBLY_2X4;
  }
  return wall.thickness;
}

export function getCoreThickness(wall: { thickness: number }): number {
  const CORE_2X4 = 3.5 / 12;
  const ASSEMBLY_2X4 = 4.5 / 12;
  const CORE_2X6 = 5.5 / 12;
  const ASSEMBLY_2X6 = 6.5 / 12;

  const t = wall.thickness;
  if (Math.abs(t - ASSEMBLY_2X4) < 0.001 || Math.abs(t - CORE_2X4) < 0.001) return CORE_2X4;
  if (Math.abs(t - ASSEMBLY_2X6) < 0.001 || Math.abs(t - CORE_2X6) < 0.001) return CORE_2X6;
  return t;
}

export function distance(p1: Point2D, p2: Point2D): number {
  return Math.round(Math.hypot(p2.x - p1.x, p2.y - p1.y) * 10000) / 10000;
}

export function snapToGrid(val: number, gridSize: number): number {
  if (gridSize <= 0) return val;
  return Math.round(val / gridSize) * gridSize;
}

export function snapPointToGrid(p: Point2D, gridSize: number): Point2D {
  return {
    x: snapToGrid(p.x, gridSize),
    y: snapToGrid(p.y, gridSize),
  };
}

export function snapAngle(
  start: Point2D,
  current: Point2D,
  incrementDeg = 15,
  ortho = false
): Point2D {
  const dx = current.x - start.x;
  const dy = current.y - start.y;
  const len = Math.hypot(dx, dy);
  if (len < 0.001) return current;

  if (ortho) {
    // 0, 90, 180, 270 degrees
    if (Math.abs(dx) >= Math.abs(dy)) {
      return { x: current.x, y: start.y };
    } else {
      return { x: start.x, y: current.y };
    }
  }

  const rad = Math.atan2(dy, dx);
  const deg = (rad * 180) / Math.PI;
  const snappedDeg = Math.round(deg / incrementDeg) * incrementDeg;
  const snappedRad = (snappedDeg * Math.PI) / 180;

  return {
    x: start.x + len * Math.cos(snappedRad),
    y: start.y + len * Math.sin(snappedRad),
  };
}

// Project point P onto line segment AB, returning nearest point and t parameter [0, 1]
export function projectPointOntoSegment(
  p: Point2D,
  a: Point2D,
  b: Point2D
): { point: Point2D; t: number; distance: number } {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const abLenSq = abx * abx + aby * aby;

  if (abLenSq < 1e-8) {
    return { point: { ...a }, t: 0, distance: distance(p, a) };
  }

  const apx = p.x - a.x;
  const apy = p.y - a.y;
  let t = (apx * abx + apy * aby) / abLenSq;
  t = Math.max(0, Math.min(1, t));

  const proj = {
    x: a.x + t * abx,
    y: a.y + t * aby,
  };

  return {
    point: proj,
    t,
    distance: distance(p, proj),
  };
}

// Calculate signed polygon area (Shoelace formula).
// Positive for CCW, negative for CW.
export function calculateSignedPolygonArea(pts: Point2D[]): number {
  if (pts.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    area += pts[i].x * pts[j].y;
    area -= pts[j].x * pts[i].y;
  }
  return Math.round((area / 2) * 10000) / 10000;
}

export function calculatePolygonPerimeter(pts: Point2D[]): number {
  if (pts.length < 2) return 0;
  let perim = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    perim += distance(pts[i], pts[j]);
  }
  return Math.round(perim * 10000) / 10000;
}

export function calculatePolygonCentroid(pts: Point2D[]): Point2D {
  if (pts.length === 0) return { x: 0, y: 0 };
  if (pts.length < 3) {
    let sx = 0;
    let sy = 0;
    pts.forEach((p) => {
      sx += p.x;
      sy += p.y;
    });
    return { x: sx / pts.length, y: sy / pts.length };
  }

  let signedArea = 0;
  let cx = 0;
  let cy = 0;

  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    const a = pts[i].x * pts[j].y - pts[j].x * pts[i].y;
    signedArea += a;
    cx += (pts[i].x + pts[j].x) * a;
    cy += (pts[i].y + pts[j].y) * a;
  }

  signedArea *= 0.5;
  if (Math.abs(signedArea) < 1e-6) {
    let sx = 0;
    let sy = 0;
    pts.forEach((p) => {
      sx += p.x;
      sy += p.y;
    });
    return { x: sx / pts.length, y: sy / pts.length };
  }

  cx /= 6 * signedArea;
  cy /= 6 * signedArea;
  return { x: cx, y: cy };
}

// Point in polygon test
export function isPointInPolygon(point: Point2D, polygon: Point2D[]): boolean {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    const intersect =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

// Line segment intersection
export function lineIntersection(
  p1: Point2D,
  p2: Point2D,
  p3: Point2D,
  p4: Point2D
): Point2D | null {
  const d = (p2.x - p1.x) * (p4.y - p3.y) - (p2.y - p1.y) * (p4.x - p3.x);
  if (Math.abs(d) < 1e-8) return null; // parallel

  const u =
    ((p3.x - p1.x) * (p4.y - p3.y) - (p3.y - p1.y) * (p4.x - p3.x)) / d;
  const v =
    ((p3.x - p1.x) * (p2.y - p1.y) - (p3.y - p1.y) * (p2.x - p1.x)) / d;

  if (u >= 0 && u <= 1 && v >= 0 && v <= 1) {
    return {
      x: p1.x + u * (p2.x - p1.x),
      y: p1.y + u * (p2.y - p1.y),
    };
  }
  return null;
}

/* =========================================================================
   PLANAR STRAIGHT LINE GRAPH (PSLG) ROOM FACE CYCLE DETECTION
   ========================================================================= */

interface DirectedHalfEdge {
  id: string; // "u->v"
  fromNodeId: string;
  toNodeId: string;
  wallId: string;
  angle: number; // atan2 angle from fromNode to toNode
  twin?: DirectedHalfEdge;
  next?: DirectedHalfEdge;
  visited?: boolean;
}

export function detectRoomFaces(
  nodes: CadNode[],
  walls: CadWall[],
  existingRooms: RoomPolygon[] = [],
  defaultWallHeight = 9.0
): RoomPolygon[] {
  if (walls.length < 3 || nodes.length < 3) {
    return [];
  }

  const nodeMap = new Map<string, CadNode>();
  nodes.forEach((n) => nodeMap.set(n.id, n));

  // Build outgoing directed half-edges from each node
  const outgoing = new Map<string, DirectedHalfEdge[]>();
  nodes.forEach((n) => outgoing.set(n.id, []));

  const allHalfEdges: DirectedHalfEdge[] = [];

  walls.forEach((wall) => {
    const n1 = nodeMap.get(wall.startNodeId);
    const n2 = nodeMap.get(wall.endNodeId);
    if (!n1 || !n2 || wall.startNodeId === wall.endNodeId) return;

    // Edge 1: start -> end
    const angle1 = Math.atan2(n2.y - n1.y, n2.x - n1.x);
    const e1: DirectedHalfEdge = {
      id: `${wall.startNodeId}->${wall.endNodeId}`,
      fromNodeId: wall.startNodeId,
      toNodeId: wall.endNodeId,
      wallId: wall.id,
      angle: angle1,
      visited: false,
    };

    // Edge 2: end -> start
    const angle2 = Math.atan2(n1.y - n2.y, n1.x - n2.x);
    const e2: DirectedHalfEdge = {
      id: `${wall.endNodeId}->${wall.startNodeId}`,
      fromNodeId: wall.endNodeId,
      toNodeId: wall.startNodeId,
      wallId: wall.id,
      angle: angle2,
      visited: false,
    };

    e1.twin = e2;
    e2.twin = e1;

    outgoing.get(wall.startNodeId)?.push(e1);
    outgoing.get(wall.endNodeId)?.push(e2);
    allHalfEdges.push(e1, e2);
  });

  // Sort outgoing edges around each node in counter-clockwise order (ascending angle)
  outgoing.forEach((edges) => {
    edges.sort((a, b) => a.angle - b.angle);
  });

  // Wire up the .next pointer for each directed half-edge
  // In a planar embedding, the next edge in the face cycle after edge (u -> v)
  // is the edge immediately CLOCKWISE from the incoming vector (i.e. counter-clockwise before twin)
  allHalfEdges.forEach((edge) => {
    const destEdges = outgoing.get(edge.toNodeId);
    if (!destEdges || destEdges.length === 0) return;

    const twin = edge.twin;
    if (!twin) return;

    const twinIndex = destEdges.indexOf(twin);
    if (twinIndex === -1) return;

    // The next edge in the left-hand face is the one right before twin in CCW order (with wrap-around)
    const nextIndex = (twinIndex - 1 + destEdges.length) % destEdges.length;
    edge.next = destEdges[nextIndex];
  });

  // Traverse all face cycles
  const detectedCycles: Array<{
    nodeIds: string[];
    wallIds: string[];
    points: Point2D[];
    signedArea: number;
  }> = [];

  allHalfEdges.forEach((edge) => {
    if (edge.visited) return;

    const cycleEdges: DirectedHalfEdge[] = [];
    let curr: DirectedHalfEdge | undefined = edge;

    while (curr && !curr.visited) {
      curr.visited = true;
      cycleEdges.push(curr);
      curr = curr.next;
      if (curr === edge) break;
    }

    if (curr === edge && cycleEdges.length >= 3) {
      const nodeIds = cycleEdges.map((e) => e.fromNodeId);
      const wallIds = cycleEdges.map((e) => e.wallId);
      const points: Point2D[] = nodeIds
        .map((nid) => nodeMap.get(nid))
        .filter((n): n is CadNode => !!n)
        .map((n) => ({ x: n.x, y: n.y }));

      const signedArea = calculateSignedPolygonArea(points);
      // Positive signed area = Counter-Clockwise cycle = interior bounded face
      if (signedArea > 1.0) {
        detectedCycles.push({
          nodeIds,
          wallIds,
          points,
          signedArea,
        });
      }
    }
  });

  // Map existing room metadata (name, floorFinish, ceilingHeight) if available, or assign default smart room names
  const defaultRoomNames = [
    'Living Room',
    'Kitchen & Dining',
    'Primary Bedroom',
    'Bedroom 2',
    'Bathroom',
    'Home Office',
    'Hallway / Foyer',
    'Garage / Workshop',
    'Laundry & Utility',
    'Patio / Sunroom',
  ];

  const resultRooms: RoomPolygon[] = detectedCycles.map((cycle, idx) => {
    const area = Math.abs(cycle.signedArea);
    const perimeter = calculatePolygonPerimeter(cycle.points);
    const centroid = calculatePolygonCentroid(cycle.points);

    // Check if an existing room matches closely (by centroid distance < 3 ft)
    const existing = existingRooms.find(
      (r) => distance(r.centroid, centroid) < 3.0
    );

    // If no existing room found via centroid (maybe a merge), look for overlapping parents
    let inheritedCeilingHeight = defaultWallHeight;
    if (existing) {
      inheritedCeilingHeight = existing.ceilingHeight;
    } else {
      // Find all parents that overlap with this new room
      const overlappingParents = existingRooms.filter(parent => 
        isPointInPolygon(parent.centroid, cycle.points) || 
        cycle.points.some(pt => isPointInPolygon(pt, parent.points))
      );
      
      if (overlappingParents.length > 0) {
        inheritedCeilingHeight = Math.max(...overlappingParents.map(p => p.ceilingHeight), defaultWallHeight);
      }
    }

    // Check if it's a foundation room (bounded by foundation walls)
    let isFoundationRoom = false;
    cycle.wallIds.forEach(wid => {
      if (walls.find(w => w.id === wid)?.wallType === 'foundation_wall') isFoundationRoom = true;
    });

    let name = existing?.name;
    let floorFinish = existing?.floorFinish;

    if (!existing) {
      if (isFoundationRoom) {
        name = 'Basement / Foundation Space';
        floorFinish = 'polished_concrete';
      } else {
        name = defaultRoomNames[idx % defaultRoomNames.length];
        floorFinish = (idx === 1 ? 'porcelain_tile' : idx === 4 ? 'porcelain_tile' : 'hardwood');
      }
    }

    const ceilingHeight = inheritedCeilingHeight;

    return {
      id: existing?.id || `room_${idx + 1}_${Date.now() % 10000}`,
      name: name!,
      nodeIds: cycle.nodeIds,
      points: cycle.points,
      wallIds: cycle.wallIds,
      area: Math.round(area * 100) / 100,
      perimeter: Math.round(perimeter * 100) / 100,
      centroid,
      floorFinish: floorFinish!,
      ceilingHeight,
      hasCeilingDrywall: existing?.hasCeilingDrywall ?? !isFoundationRoom,
    };
  });

  // After detecting rooms and inheriting heights, sync all walls to match room ceiling heights
  // If a wall is shared between rooms with different heights, it should take the max height
  resultRooms.forEach(room => {
    room.wallIds.forEach(wid => {
      const wall = walls.find(w => w.id === wid);
      if (wall) {
        wall.height = Math.max(wall.height || 0, room.ceilingHeight);
      }
    });
  });

  return resultRooms;
}

// Classify walls dynamically based on room adjacency
export function classifyWalls(
  walls: CadWall[],
  rooms: RoomPolygon[]
): Map<string, { classification: 'exterior' | 'shared_interior' | 'partition'; adjacentRoomsCount: number }> {
  const map = new Map<
    string,
    { classification: 'exterior' | 'shared_interior' | 'partition'; adjacentRoomsCount: number }
  >();

  // Count how many rooms contain each wall
  walls.forEach((wall) => {
    let count = 0;
    rooms.forEach((room) => {
      if (room.wallIds.includes(wall.id)) {
        count++;
      }
    });

    let classification: 'exterior' | 'shared_interior' | 'partition' = 'partition';
    if (count === 1) {
      classification = 'exterior';
    } else if (count >= 2) {
      classification = 'shared_interior';
    } else {
      classification = 'partition';
    }

    if (wall.isExteriorManualOverride) {
      classification = 'exterior';
    }

    map.set(wall.id, { classification, adjacentRoomsCount: count });
  });

  return map;
}

// Compute wall geometry (length, angle, unit vectors, normal vectors)
export function getWallGeometry(
  wall: CadWall,
  nodeMap: Map<string, CadNode>
): {
  start: Point2D;
  end: Point2D;
  length: number;
  angleRad: number;
  angleDeg: number;
  dir: Point2D;
  normal: Point2D;
} | null {
  const n1 = nodeMap.get(wall.startNodeId);
  const n2 = nodeMap.get(wall.endNodeId);
  if (!n1 || !n2) return null;

  const dx = n2.x - n1.x;
  const dy = n2.y - n1.y;
  const len = Math.hypot(dx, dy);
  if (len < 0.001) return null;

  const dir = { x: dx / len, y: dy / len };
  const normal = { x: -dir.y, y: dir.x };
  const angleRad = Math.atan2(dy, dx);
  const angleDeg = (angleRad * 180) / Math.PI;

  return {
    start: { x: n1.x, y: n1.y },
    end: { x: n2.x, y: n2.y },
    length: len,
    angleRad,
    angleDeg,
    dir,
    normal,
  };
}

// Get Aperture absolute placement points along wall
export function getApertureGeometry(
  aperture: Aperture,
  wall: CadWall,
  nodeMap: Map<string, CadNode>
): {
  center: Point2D;
  start: Point2D;
  end: Point2D;
  dir: Point2D;
  normal: Point2D;
  width: number;
} | null {
  const geom = getWallGeometry(wall, nodeMap);
  if (!geom) return null;

  const halfWidth = aperture.width / 2;
  const offset = Math.max(halfWidth, Math.min(geom.length - halfWidth, aperture.offset));

  const centerX = geom.start.x + geom.dir.x * offset;
  const centerY = geom.start.y + geom.dir.y * offset;

  const startX = centerX - geom.dir.x * halfWidth;
  const startY = centerY - geom.dir.y * halfWidth;

  const endX = centerX + geom.dir.x * halfWidth;
  const endY = centerY + geom.dir.y * halfWidth;

  return {
    center: { x: centerX, y: centerY },
    start: { x: startX, y: startY },
    end: { x: endX, y: endY },
    dir: geom.dir,
    normal: geom.normal,
    width: aperture.width,
  };
}

/**
 * Calculates the shortest translation delta to snap any moving node onto a stationary node or wall.
 */
export function calculateMultiCornerSnap(
  movingNodes: Point2D[],
  stationaryNodes: CadNode[],
  stationaryWalls: CadWall[],
  allNodesMap: Map<string, CadNode> | CadNode[],
  snapRadius: number
): { delta: Point2D; snappedNodeIndex: number; snapTarget: Point2D; snapType: 'node' | 'wall' | 'none' } {
  const nodeMap = Array.isArray(allNodesMap)
    ? new Map(allNodesMap.map((n) => [n.id, n]))
    : allNodesMap;

  let minDistance = snapRadius;
  let bestDelta = { x: 0, y: 0 };
  let snappedNodeIndex = -1;
  let snapTarget = { x: 0, y: 0 };
  let snapType: 'node' | 'wall' | 'none' = 'none';

  movingNodes.forEach((movingPt, idx) => {
    // 1. Check node-to-node snapping
    stationaryNodes.forEach((statNode) => {
      const d = distance(movingPt, statNode);
      if (d < minDistance) {
        minDistance = d;
        bestDelta = { x: statNode.x - movingPt.x, y: statNode.y - movingPt.y };
        snappedNodeIndex = idx;
        snapTarget = { x: statNode.x, y: statNode.y };
        snapType = 'node';
      }
    });

    // 2. Check node-to-wall snapping
    stationaryWalls.forEach((wall) => {
      const n1 = nodeMap.get(wall.startNodeId);
      const n2 = nodeMap.get(wall.endNodeId);
      if (!n1 || !n2) return;

      const proj = projectPointOntoSegment(movingPt, n1, n2);
      if (proj.distance < minDistance) {
        minDistance = proj.distance;
        bestDelta = { x: proj.point.x - movingPt.x, y: proj.point.y - movingPt.y };
        snappedNodeIndex = idx;
        snapTarget = proj.point;
        snapType = 'wall';
      }
    });
  });

  return { delta: bestDelta, snappedNodeIndex, snapTarget, snapType };
}

/**
 * PHASE 1: Coincident Node Merging
 * Scans all nodes and merges those within a small threshold into a master node.
 * Remaps wall and room references accordingly.
 */
export function mergeCoincidentNodes(
  nodes: CadNode[],
  walls: CadWall[],
  rooms: RoomPolygon[],
  threshold = 0.01 // ~1/8 inch
): { nodes: CadNode[]; walls: CadWall[]; rooms: RoomPolygon[] } {
  const nodeMap = new Map<string, string>(); // oldNodeId -> masterNodeId
  const finalNodes: CadNode[] = [];

  nodes.forEach((node) => {
    const master = finalNodes.find((fn) => distance(node, fn) < threshold);
    if (master) {
      nodeMap.set(node.id, master.id);
    } else {
      finalNodes.push(node);
      nodeMap.set(node.id, node.id);
    }
  });

  const updatedWalls = walls.map((wall) => ({
    ...wall,
    startNodeId: nodeMap.get(wall.startNodeId) || wall.startNodeId,
    endNodeId: nodeMap.get(wall.endNodeId) || wall.endNodeId,
  })).filter(w => w.startNodeId !== w.endNodeId); // Remove any zero-length walls created by merging

  const updatedRooms = rooms.map((room) => ({
    ...room,
    nodeIds: room.nodeIds.map((nid) => nodeMap.get(nid) || nid),
  }));

  return { nodes: finalNodes, walls: updatedWalls, rooms: updatedRooms };
}

/**
 * Deduplicates coincident walls by merging them into shared segments.
 * Coincident walls share the same start and end nodes (order may be reversed).
 */
export function deduplicateWalls(
  walls: CadWall[],
  rooms: RoomPolygon[],
  apertures: Aperture[] = [],
  nodes: CadNode[] = []
): { walls: CadWall[]; rooms: RoomPolygon[]; apertures: Aperture[] } {
  const finalWalls: CadWall[] = [];
  const wallMap = new Map<string, { masterId: string; isFlipped: boolean }>();

  walls.forEach((wall) => {
    // Check if a wall with same nodes already exists
    const duplicate = finalWalls.find(
      (fw) =>
        (fw.startNodeId === wall.startNodeId && fw.endNodeId === wall.endNodeId) ||
        (fw.startNodeId === wall.endNodeId && fw.endNodeId === wall.startNodeId)
    );

    if (duplicate) {
      const isFlipped = duplicate.startNodeId !== wall.startNodeId;
      wallMap.set(wall.id, { masterId: duplicate.id, isFlipped });
    } else {
      finalWalls.push(wall);
    }
  });

  // Update room wall references
  const finalRooms = rooms.map((room) => ({
    ...room,
    wallIds: Array.from(new Set(room.wallIds.map((wid) => wallMap.get(wid)?.masterId || wid))),
  }));

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  // Update aperture wall references and handle coordinate flips for reversed walls
  const finalApertures = apertures.map((ap) => {
    const mapping = wallMap.get(ap.wallId);
    if (!mapping) return ap;

    if (!mapping.isFlipped) {
      return { ...ap, wallId: mapping.masterId };
    }

    // Wall is reversed, flip aperture offset
    const masterWall = finalWalls.find((w) => w.id === mapping.masterId);
    if (!masterWall) return { ...ap, wallId: mapping.masterId };

    const n1 = nodeMap.get(masterWall.startNodeId);
    const n2 = nodeMap.get(masterWall.endNodeId);
    if (n1 && n2) {
      const wallLen = distance(n1, n2);
      return {
        ...ap,
        wallId: mapping.masterId,
        offset: Math.round(Math.max(0, wallLen - ap.offset - ap.width) * 100) / 100,
      };
    }

    return { ...ap, wallId: mapping.masterId };
  });

  return { walls: finalWalls, rooms: finalRooms, apertures: finalApertures };
}
