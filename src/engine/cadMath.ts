import { CadNode, CadWall, RoomPolygon, Aperture } from '../types';

export interface Point2D {
  x: number;
  y: number;
}

export function distance(p1: Point2D, p2: Point2D): number {
  return Math.hypot(p2.x - p1.x, p2.y - p1.y);
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
  return area / 2;
}

export function calculatePolygonPerimeter(pts: Point2D[]): number {
  if (pts.length < 2) return 0;
  let perim = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    perim += distance(pts[i], pts[j]);
  }
  return perim;
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
  existingRooms: RoomPolygon[] = []
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

    const name = existing?.name || defaultRoomNames[idx % defaultRoomNames.length];
    const floorFinish = existing?.floorFinish || (idx === 1 ? 'porcelain_tile' : idx === 4 ? 'porcelain_tile' : 'hardwood');
    const ceilingHeight = existing?.ceilingHeight || 9.0;

    return {
      id: existing?.id || `room_${idx + 1}_${Date.now() % 10000}`,
      name,
      nodeIds: cycle.nodeIds,
      points: cycle.points,
      wallIds: cycle.wallIds,
      area: Math.round(area * 100) / 100,
      perimeter: Math.round(perimeter * 100) / 100,
      centroid,
      floorFinish,
      ceilingHeight,
      hasCeilingDrywall: existing?.hasCeilingDrywall ?? true,
    };
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
