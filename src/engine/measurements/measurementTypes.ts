/** C.1A persisted specialist contracts; all dimensions in feet unless named otherwise. */
export type Point = { x: number; y: number };
export type SpecialistKind = 'roof' | 'foundation' | 'site';
export type MeasurementSource = { reference: string; note?: string };
type Identity = { id: string; physicalId: string; assemblyId: string; source: MeasurementSource };
export type RoofEntity = Identity & (
  | { kind: 'roofPlane'; polygon: Point[]; pitchRise: number | null; slopeDegrees: number | null; elevationFt: number | null }
  | { kind: 'roofEdge'; start: Point; end: Point; planeIds: string[]; edgeType: 'eave'|'rake'|'ridge'|'hip'|'valley'|'abutment'|'parapet'|'unclassified' }
  | { kind: 'roofOpening'; polygon: Point[]; planeId: string }
  | { kind: 'roofSurface'; polygon: Point[]; purpose: 'soffit'|'insulation'; pitchRise: number | null; depthFt?: number }
);
export type FoundationEntity = Identity & (
  | { kind: 'foundationWall'|'stripFooting'; start: Point; end: Point; widthFt: number | null; heightFt: number | null; elevationFt: number | null }
  | { kind: 'padFooting'|'slab'|'foundationRegion'; polygon: Point[]; depthFt: number | null; purpose: 'concrete'|'insulation'|'excavation'|'backfill'|'granular'; elevationFt: number | null }
  | { kind: 'foundationLine'; start: Point; end: Point; purpose: 'drainage'|'waterproofing'; heightFt?: number }
);
export type SiteEntity = Identity & (
  | { kind: 'siteRegion'; polygon: Point[]; purpose: 'hardscape'|'excavation'|'fill'|'deck'|'landscape'|'reference'; depthFt: number | null; elevationFt: number | null }
  | { kind: 'siteLine'; start: Point; end: Point; purpose: 'fence'|'curb'|'drainage'|'ledger'|'railing'|'open'|'retainingWall'; parentId?: string; heightFt?: number; widthFt?: number }
  | { kind: 'siteCount'; point: Point; purpose: 'post'|'bollard'|'catchBasin'; count: number }
);
export type SpecialistEntity = RoofEntity | FoundationEntity | SiteEntity;
export type QuantityUnit = 'SF'|'LF'|'CY'|'EA'|'SQ'|'BF';
export type QuantityContribution = {
  workspaceId: string; elementId: string; physicalId: string; assemblyId: string;
  code: string; unit: QuantityUnit; basis: string; source: MeasurementSource;
} & ({ status: 'measured'; quantity: number } | { status: 'unquantified'; reason: string });
export type ScopeAssignment = { status: 'unquantified' } | { status: 'excluded'; reason: string }
  | { status: 'assigned'; workspaceIds: string[] };
export const specialistKinds = ['roof','foundation','site'] as const;
const allowed = {
  roof: ['roofPlane','roofEdge','roofOpening','roofSurface'],
  foundation: ['foundationWall','stripFooting','padFooting','slab','foundationRegion','foundationLine'],
  site: ['siteRegion','siteLine','siteCount']
};
const obj = (x: unknown): x is Record<string, any> => !!x && typeof x === 'object' && !Array.isArray(x);
const str = (x: unknown) => typeof x === 'string' && x.trim().length > 0;
const num = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const positiveOrMissing = (x: unknown) => x === null || (num(x) && x > 0);
const finiteOrMissing = (x: unknown) => x === null || num(x);
const pitch = (x: unknown) => x === null || (num(x) && x >= 0);
const point = (x: unknown): x is Point => obj(x) && num(x.x) && num(x.y);
function check(ok: unknown, msg: string): asserts ok { if (!ok) throw new Error('Invalid measurement: '+msg); }
function polygon(p: unknown): p is Point[] {
  if (!Array.isArray(p) || p.length < 3 || !p.every(point)) return false;
  if(new Set(p.map(q=>JSON.stringify([q.x,q.y]))).size!==p.length) return false;
  const area = p.reduce((a,q,i)=>a+q.x*p[(i+1)%p.length].y-q.y*p[(i+1)%p.length].x,0);
  return Number.isFinite(area) && Math.abs(area)>1e-9;
}
const line = (e: Record<string,any>) => point(e.start) && point(e.end) && (e.start.x!==e.end.x || e.start.y!==e.end.y);
export function validateSpecialistEntities(type: string, entities: unknown): asserts entities is SpecialistEntity[] {
  check(Array.isArray(entities),'entities missing');
  if(type==='floor') { check(entities.length===0,'floor cannot own specialist entities'); return; }
  check(specialistKinds.includes(type as SpecialistKind),'unknown workspace type');
  const ids=new Set<string>();
  for(const e of entities) {
    check(obj(e) && str(e.id) && str(e.physicalId) && str(e.assemblyId) && obj(e.source) && str(e.source.reference),'invalid identity/source');
    check(!ids.has(e.id),'duplicate entity ID'); ids.add(e.id);
    check(allowed[type as SpecialistKind].includes(e.kind),'entity incompatible with workspace');
    switch(e.kind) {
      case 'roofPlane': check(polygon(e.polygon)&&pitch(e.pitchRise)&&finiteOrMissing(e.elevationFt)&&(e.slopeDegrees===null||(num(e.slopeDegrees)&&e.slopeDegrees>=0&&e.slopeDegrees<360)),'roof plane'); break;
      case 'roofEdge': check(line(e)&&Array.isArray(e.planeIds)&&e.planeIds.length>0&&e.planeIds.length<=2&&new Set(e.planeIds).size===e.planeIds.length&&['eave','rake','ridge','hip','valley','abutment','parapet','unclassified'].includes(e.edgeType),'roof edge'); break;
      case 'roofOpening': check(polygon(e.polygon)&&str(e.planeId),'roof opening'); break;
      case 'roofSurface': check(polygon(e.polygon)&&['soffit','insulation'].includes(e.purpose)&&pitch(e.pitchRise)&&(e.depthFt===undefined||num(e.depthFt)&&e.depthFt>0),'roof surface'); break;
      case 'foundationWall': case 'stripFooting': check(line(e)&&positiveOrMissing(e.widthFt)&&positiveOrMissing(e.heightFt)&&finiteOrMissing(e.elevationFt),'foundation line assembly'); break;
      case 'padFooting': case 'slab': case 'foundationRegion': check(polygon(e.polygon)&&positiveOrMissing(e.depthFt)&&finiteOrMissing(e.elevationFt)&&['concrete','insulation','excavation','backfill','granular'].includes(e.purpose)&&(!['padFooting','slab'].includes(e.kind)||e.purpose==='concrete'),'foundation region'); break;
      case 'foundationLine': check(line(e)&&['drainage','waterproofing'].includes(e.purpose)&&(e.heightFt===undefined||num(e.heightFt)&&e.heightFt>0),'foundation linear feature'); break;
      case 'siteRegion': check(polygon(e.polygon)&&positiveOrMissing(e.depthFt)&&finiteOrMissing(e.elevationFt)&&['hardscape','excavation','fill','deck','landscape','reference'].includes(e.purpose),'site region'); break;
      case 'siteLine': check(line(e)&&['fence','curb','drainage','ledger','railing','open','retainingWall'].includes(e.purpose)&&(e.heightFt===undefined||num(e.heightFt)&&e.heightFt>0)&&(e.widthFt===undefined||num(e.widthFt)&&e.widthFt>0),'site line'); break;
      case 'siteCount': check(point(e.point)&&Number.isSafeInteger(e.count)&&e.count>0&&['post','bollard','catchBasin'].includes(e.purpose),'site count'); break;
    }
  }
  const byId=new Map(entities.map(e=>[e.id,e]));
  for(const e of entities) {
    if(e.kind==='roofEdge') check(e.planeIds.every((id:string)=>byId.get(id)?.kind==='roofPlane'),'missing roof plane reference');
    if(e.kind==='roofOpening') check(byId.get(e.planeId)?.kind==='roofPlane','missing opening plane');
    if(e.kind==='siteLine'&&['ledger','railing','open'].includes(e.purpose)) {
      const parent=byId.get(e.parentId); check(parent?.kind==='siteRegion'&&parent.purpose==='deck','missing deck parent');
    }
  }
}
/** Structural validation only. Topology, intersections and completeness belong to specialist engines. */
export function validateContributionSet(rows: readonly QuantityContribution[]): void {
  const keys=new Set<string>();
  for(const r of rows) {
    check(str(r.workspaceId)&&str(r.elementId)&&str(r.physicalId)&&str(r.assemblyId)&&str(r.code)&&str(r.basis)&&obj(r.source)&&str(r.source.reference),'contribution identity');
    check(['SF','LF','CY','EA','SQ','BF'].includes(r.unit),'unit');
    check(r.status==='measured'?num(r.quantity)&&r.quantity>=0:r.status==='unquantified'&&str(r.reason)&&!('quantity' in r),'invalid contribution status');
    const key=JSON.stringify([r.physicalId,r.assemblyId,r.code]);
    check(!keys.has(key),'duplicate physical quantity contribution'); keys.add(key);
  }
}
