/** C.1A persisted specialist contracts; all dimensions in feet unless named otherwise. */
export type Point = { x: number; y: number };
export type SpecialistKind = 'roof' | 'foundation' | 'site';
export type MeasurementSource = { reference: string; note?: string };
type Identity = { id: string; physicalId: string; assemblyId: string; source: MeasurementSource };
export type Applicability = 'included'|'excluded'|'unspecified';
/** Additive v3 metadata. Group identity is independent of quantity identity. */
export type RoofDerivationBounds={xmin:number;ymin:number;xmax:number;ymax:number};
export type RoofDerivationMetadata={
 version:1;
 groupId:string;
 planeIds:string[];
 edgeIds:string[];
 depths:Record<'north'|'east'|'south'|'west',number>;
 purpose:'soffit'|'insulation';
 basis:'horizontal'|'sloped';
 exclusions:RoofDerivationBounds[];
 boundaryConfirmed:boolean;
 cornersConfirmed:boolean;
 material?:string;
 thicknessFt?:number;
 pieceKey:string;
 /** Omitted means included; unresolved soffit pieces retain geometry without measured quantity. */
 pendingApplicability?:true;
};
export type RoofEntity = Identity & (
  | { kind: 'roofPlane'; roofGroupId?: string; polygon: Point[]; pitchRise: number | null; slopeDegrees: number | null; elevationFt: number | null }
  | { kind: 'roofEdge'; roofGroupId?: string; start: Point; end: Point; planeIds: string[]; applicability?: { fascia?: Applicability; gutter?: Applicability; soffit?: Applicability }; edgeType: 'eave'|'rake'|'ridge'|'hip'|'valley'|'abutment'|'parapet'|'unclassified' }
  | { kind: 'roofOpening'; polygon: Point[]; planeId: string; deduction?: Applicability }
  | { kind: 'roofSurface'; derivation?: RoofDerivationMetadata; polygon: Point[]; purpose: 'soffit'|'insulation'; pitchRise: number | null; depthFt?: number; insulationType?: string; surfaceBasis?: 'horizontal'|'sloped' }
);
/** Explicit v3 foundation semantics; absent metadata on older records is not confirmation. */
export type WallOpening={id:string;offsetFt:number;widthFt:number;sillFt:number;heightFt:number};
export type SlabOpening={id:string;polygon:Point[]};
export type SlabThickening={id:string;polygon:Point[];depthFt:number;basis:'total'|'additional'};
export type FoundationCoverage = { layerId:string; confirmed:true; foam?:true; thicknessFt?:number; openingTreatment?:'none'|'alreadyDeducted' };
export type FoundationStripSource={version:1;wallId:string;groupId:string;offsetFt:number;widthFt:number;depthFt:number};
export type FoundationEnvelopeSource={offsetBelowSlabFt?:number;perimeterWallIds?:string[];version:1;sourceId:string;groupId:string;purpose:'waterproofing'|'verticalInsulation'|'horizontalInsulation'|'granular';side?:'left'|'right';heightFt?:number;depthFt?:number;material:string;layerId:string;foam?:true};
export type FoundationDrainageSource={version:1;wallIds:string[];groupId:string;edge:number;offsetFt:number;material:string;layerId:string};
export type FoundationMetadata = { granularLayerId?:string; drainageSource?:FoundationDrainageSource; envelopeSource?:FoundationEnvelopeSource; stripSource?:FoundationStripSource; coverage?:FoundationCoverage; wallOpenings?:WallOpening[]; slabOpenings?:SlabOpening[]; slabThickenings?:SlabThickening[]; version:1; material:string; baseElevationConfirmed?:true; centrelineConfirmed?:true; joinStartFt?:number; joinEndFt?:number };
export type FoundationApplicability={status:'included'}|{status:'excluded'|'pending';reason:string};
export type FoundationEntity = Identity & { foundation?:FoundationMetadata; scopeApplicability?:FoundationApplicability } & (
  | { kind: 'foundationWall'|'stripFooting'; start: Point; end: Point; widthFt: number | null; heightFt: number | null; elevationFt: number | null }
  | { kind: 'padFooting'|'slab'|'foundationRegion'; polygon: Point[]; depthFt: number | null; purpose: 'concrete'|'insulation'|'excavation'|'backfill'|'granular'; elevationFt: number | null }
  | { kind:'foundationTrench'; start:Point; end:Point; widthFt:number|null; heightFt:number|null; elevationFt:number|null }
  | { kind: 'foundationLine'; start: Point; end: Point; purpose: 'drainage'|'waterproofing'|'insulation'; heightFt?: number }
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
  foundation: ['foundationWall','stripFooting','padFooting','slab','foundationRegion','foundationLine','foundationTrench'],
  site: ['siteRegion','siteLine','siteCount']
};
const obj = (x: unknown): x is Record<string, any> => !!x && typeof x === 'object' && !Array.isArray(x);
const str = (x: unknown) => typeof x === 'string' && x.trim().length > 0;
const num = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const positiveOrMissing = (x: unknown) => x === null || (num(x) && x > 0);
const finiteOrMissing = (x: unknown) => x === null || num(x);
const applicability = (v: unknown) => v === undefined || ['included','excluded','unspecified'].includes(v as string);
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
  const physicalKeys=new Set<string>();
  for(const e of entities) {
    check(obj(e) && str(e.id) && str(e.physicalId) && str(e.assemblyId) && obj(e.source) && str(e.source.reference),'invalid identity/source');
    check(!ids.has(e.id),'duplicate entity ID'); ids.add(e.id);
    const key=JSON.stringify([e.physicalId,e.assemblyId,e.kind]);
    check(!physicalKeys.has(key),'duplicate specialist physical identity'); physicalKeys.add(key);
    check(e.source.note===undefined||typeof e.source.note==='string','invalid source note');
    check(allowed[type as SpecialistKind].includes(e.kind),'entity incompatible with workspace');
    if(e.scopeApplicability!==undefined){const a=e.scopeApplicability;check(type==='foundation'&&obj(a)&&(a.status==='included'?a.reason===undefined:['excluded','pending'].includes(a.status)&&str(a.reason)),'invalid foundation scope applicability');}
    if(e.roofGroupId!==undefined)check((e.kind==='roofPlane'||e.kind==='roofEdge')&&str(e.roofGroupId),'invalid roof group identity');
    if(e.derivation!==undefined){
      const d=e.derivation;
      const refs=(v:unknown)=>Array.isArray(v)&&v.length>0&&v.every(str)&&new Set(v).size===v.length;
      check(e.kind==='roofSurface'&&obj(d)&&d.version===1&&str(d.groupId)&&str(d.pieceKey)&&refs(d.planeIds)&&refs(d.edgeIds),'invalid roof derivation identity/references');
      check(obj(d.depths)&&Object.keys(d.depths).length===4&&['north','east','south','west'].every(k=>num(d.depths[k])&&d.depths[k]>=0),'invalid derivation depths');
      check(d.purpose===e.purpose&&d.basis===e.surfaceBasis&&['horizontal','sloped'].includes(d.basis)&&typeof d.boundaryConfirmed==='boolean'&&typeof d.cornersConfirmed==='boolean','invalid derivation purpose/basis');
      check(Array.isArray(d.exclusions)&&d.exclusions.every(b=>obj(b)&&[b.xmin,b.ymin,b.xmax,b.ymax].every(num)&&b.xmax>b.xmin&&b.ymax>b.ymin),'invalid derivation exclusions');
      check(d.pendingApplicability===undefined||(d.pendingApplicability===true&&d.purpose==='soffit'),'invalid derived pending applicability');
      check(d.material===e.insulationType&&d.thicknessFt===e.depthFt,'derived surface material/thickness mismatch');
      check(d.purpose==='soffit'?d.basis==='horizontal'&&d.exclusions.length===0&&d.material===undefined&&d.thicknessFt===undefined:d.boundaryConfirmed===true&&str(d.material),'invalid derivation confirmation');
    }
    if(e.foundation!==undefined){
      const f=e.foundation;
      check(type==='foundation'&&obj(f)&&f.version===1&&str(f.material),'invalid foundation metadata');
      check(f.baseElevationConfirmed===undefined||f.baseElevationConfirmed===true,'invalid foundation datum confirmation');
      check(f.centrelineConfirmed===undefined||((e.kind==='foundationWall'||e.kind==='stripFooting'||e.kind==='foundationTrench')&&f.centrelineConfirmed===true),'invalid foundation centreline confirmation');
      if(f.drainageSource!==undefined){const s=f.drainageSource;check(e.kind==='foundationLine'&&e.purpose==='drainage'&&obj(s)&&s.version===1&&Array.isArray(s.wallIds)&&s.wallIds.length===4&&s.wallIds.every(str)&&new Set(s.wallIds).size===4&&str(s.groupId)&&[0,1,2,3].includes(s.edge)&&num(s.offsetFt)&&s.offsetFt>=0&&str(s.material)&&str(s.layerId),'invalid rectangular drainage source');}
      if(f.granularLayerId!==undefined)check(e.kind==='foundationRegion'&&e.purpose==='granular'&&str(f.granularLayerId),'invalid granular layer identity');
      if(f.envelopeSource!==undefined){const s=f.envelopeSource;check(obj(s)&&s.version===1&&str(s.sourceId)&&str(s.groupId)&&str(s.material)&&str(s.layerId)&&['waterproofing','verticalInsulation','horizontalInsulation','granular'].includes(s.purpose),'invalid foundation envelope source');check(s.foam===undefined||s.foam===true&&['verticalInsulation','horizontalInsulation'].includes(s.purpose),'invalid derived foam');check(s.offsetBelowSlabFt===undefined||(['horizontalInsulation','granular'].includes(s.purpose)&&num(s.offsetBelowSlabFt)&&s.offsetBelowSlabFt>=0),'invalid below-slab offset');check(s.perimeterWallIds===undefined||(['waterproofing','verticalInsulation'].includes(s.purpose)&&Array.isArray(s.perimeterWallIds)&&s.perimeterWallIds.length>=4&&s.perimeterWallIds.length<=64&&s.perimeterWallIds.every(str)&&new Set(s.perimeterWallIds).size===s.perimeterWallIds.length&&s.perimeterWallIds.includes(s.sourceId)),'invalid envelope perimeter sources');check(['waterproofing','verticalInsulation'].includes(s.purpose)?e.kind==='foundationLine'&&e.purpose===(s.purpose==='waterproofing'?'waterproofing':'insulation')&&['left','right'].includes(s.side)&&num(s.heightFt)&&s.heightFt>0&&(s.depthFt===undefined||s.purpose==='verticalInsulation'&&num(s.depthFt)&&s.depthFt>0):e.kind==='foundationRegion'&&e.purpose===(s.purpose==='granular'?'granular':'insulation')&&s.side===undefined&&s.heightFt===undefined&&num(s.depthFt)&&s.depthFt>0,'invalid foundation envelope dimensions');}
      if(f.stripSource!==undefined){const s=f.stripSource;check(e.kind==='stripFooting'&&obj(s)&&s.version===1&&str(s.wallId)&&str(s.groupId)&&num(s.offsetFt)&&num(s.widthFt)&&s.widthFt>0&&num(s.depthFt)&&s.depthFt>0,'invalid strip footing derivation');}
      if(f.coverage!==undefined){
        const c=f.coverage;
        check((e.kind==='foundationLine'||e.kind==='foundationRegion'&&e.purpose==='insulation')&&obj(c)&&str(c.layerId)&&c.confirmed===true,'invalid foundation coverage');
        check(c.foam===undefined||c.foam===true&&e.purpose==='insulation','invalid foam coverage');
        check(c.thicknessFt===undefined||e.purpose==='insulation'&&num(c.thicknessFt)&&c.thicknessFt>0,'invalid coverage thickness');
        check(c.openingTreatment===undefined||e.kind==='foundationLine'&&e.purpose!=='drainage'&&['none','alreadyDeducted'].includes(c.openingTreatment),'invalid coverage opening treatment');
      }
      if(f.wallOpenings!==undefined)check(e.kind==='foundationWall'&&Array.isArray(f.wallOpenings)&&f.wallOpenings.every(o=>obj(o)&&str(o.id)&&num(o.offsetFt)&&o.offsetFt>=0&&num(o.widthFt)&&o.widthFt>0&&num(o.sillFt)&&o.sillFt>=0&&num(o.heightFt)&&o.heightFt>0),'invalid wall openings');
      if(f.slabOpenings!==undefined)check(e.kind==='slab'&&Array.isArray(f.slabOpenings)&&f.slabOpenings.every(o=>obj(o)&&str(o.id)&&polygon(o.polygon)),'invalid slab openings');
      if(f.slabThickenings!==undefined)check(e.kind==='slab'&&Array.isArray(f.slabThickenings)&&f.slabThickenings.every(o=>obj(o)&&str(o.id)&&polygon(o.polygon)&&num(o.depthFt)&&o.depthFt>0&&['total','additional'].includes(o.basis)),'invalid slab thickening');
      const detailIds=[...(f.wallOpenings??[]),...(f.slabOpenings??[]),...(f.slabThickenings??[])].map(o=>o.id);
      check(new Set(detailIds).size===detailIds.length,'duplicate foundation detail ID');
      for(const k of ['joinStartFt','joinEndFt'])check(f[k]===undefined||((e.kind==='foundationWall'||e.kind==='stripFooting'||e.kind==='foundationTrench')&&f.centrelineConfirmed===true&&num(f[k])&&f[k]>=0),'invalid foundation junction extension');
    }
    switch(e.kind) {
      case 'roofPlane': check(polygon(e.polygon)&&pitch(e.pitchRise)&&finiteOrMissing(e.elevationFt)&&(e.slopeDegrees===null||(num(e.slopeDegrees)&&e.slopeDegrees>=0&&e.slopeDegrees<360)),'roof plane'); break;
      case 'roofEdge': check(line(e)&&Array.isArray(e.planeIds)&&e.planeIds.length>0&&e.planeIds.length<=2&&new Set(e.planeIds).size===e.planeIds.length&&['eave','rake','ridge','hip','valley','abutment','parapet','unclassified'].includes(e.edgeType),'roof edge'); check(e.applicability===undefined||(obj(e.applicability)&&Object.keys(e.applicability).every(k=>['fascia','gutter','soffit'].includes(k))&&Object.values(e.applicability).every(applicability)),'edge applicability'); break;
      case 'roofOpening': check(polygon(e.polygon)&&str(e.planeId),'roof opening'); check(applicability(e.deduction),'opening deduction'); break;
      case 'roofSurface': check(polygon(e.polygon)&&['soffit','insulation'].includes(e.purpose)&&pitch(e.pitchRise)&&(e.depthFt===undefined||num(e.depthFt)&&e.depthFt>0),'roof surface'); check((e.insulationType===undefined||str(e.insulationType))&&(e.surfaceBasis===undefined||['horizontal','sloped'].includes(e.surfaceBasis))&&(e.surfaceBasis!=='horizontal'||e.pitchRise===0),'surface basis'); break;
      case 'foundationWall': case 'stripFooting': case 'foundationTrench': check(line(e)&&positiveOrMissing(e.widthFt)&&positiveOrMissing(e.heightFt)&&finiteOrMissing(e.elevationFt),'foundation line assembly'); break;
      case 'padFooting': case 'slab': case 'foundationRegion': check(polygon(e.polygon)&&positiveOrMissing(e.depthFt)&&finiteOrMissing(e.elevationFt)&&['concrete','insulation','excavation','backfill','granular'].includes(e.purpose)&&(!['padFooting','slab'].includes(e.kind)||e.purpose==='concrete'),'foundation region'); break;
      case 'foundationLine': check(line(e)&&['drainage','waterproofing','insulation'].includes(e.purpose)&&(e.heightFt===undefined||num(e.heightFt)&&e.heightFt>0),'foundation linear feature'); break;
      case 'siteRegion': check(polygon(e.polygon)&&positiveOrMissing(e.depthFt)&&finiteOrMissing(e.elevationFt)&&['hardscape','excavation','fill','deck','landscape','reference'].includes(e.purpose),'site region'); break;
      case 'siteLine': check(line(e)&&['fence','curb','drainage','ledger','railing','open','retainingWall'].includes(e.purpose)&&(e.heightFt===undefined||num(e.heightFt)&&e.heightFt>0)&&(e.widthFt===undefined||num(e.widthFt)&&e.widthFt>0),'site line'); break;
      case 'siteCount': check(point(e.point)&&Number.isSafeInteger(e.count)&&e.count>0&&['post','bollard','catchBasin'].includes(e.purpose),'site count'); break;
    }
  }
  const byId=new Map(entities.map(e=>[e.id,e]));
  const quantityIds=new Set(entities.flatMap(e=>[e.id,e.physicalId,e.assemblyId]));
  const roofGroups=new Set(entities.filter(e=>e.kind==='roofPlane'&&e.roofGroupId!==undefined).map(e=>e.roofGroupId));
  const derivationPieces=new Set<string>();
  const derivationSpecs=new Map<string,string>();
  for(const e of entities) {
    if(e.roofGroupId!==undefined){
      check(!quantityIds.has(e.roofGroupId),'roof group identity collides with quantity identity');
      check(roofGroups.has(e.roofGroupId),'roof group has no plane');
      if(e.kind==='roofEdge')check(e.planeIds.every((id:string)=>byId.get(id)?.roofGroupId===e.roofGroupId),'roof group edge crosses group ownership');
    }
    if(e.kind==='roofSurface'&&e.derivation!==undefined){
      const d=e.derivation;
      check(d.planeIds.every((id:string)=>byId.get(id)?.kind==='roofPlane')&&d.edgeIds.every((id:string)=>byId.get(id)?.kind==='roofEdge'&&byId.get(id).planeIds.every((p:string)=>d.planeIds.includes(p))),'missing derivation source reference');
      check(!quantityIds.has(d.groupId),'derivation group identity collides with quantity identity');
      check(!roofGroups.has(d.groupId),'roof and derivation group identities must be distinct');
      const key=JSON.stringify([d.groupId,d.pieceKey]);
      check(!derivationPieces.has(key),'duplicate derivation piece');derivationPieces.add(key);
      const {pieceKey,...spec}=d;
      const canonical=JSON.stringify([spec.version,spec.planeIds,spec.edgeIds,spec.depths.north,spec.depths.east,spec.depths.south,spec.depths.west,spec.purpose,spec.basis,spec.exclusions.map((b:RoofDerivationBounds)=>[b.xmin,b.ymin,b.xmax,b.ymax]),spec.boundaryConfirmed,spec.cornersConfirmed,spec.material,spec.thicknessFt]);
      check(!derivationSpecs.has(d.groupId)||derivationSpecs.get(d.groupId)===canonical,'inconsistent derivation group parameters');
      derivationSpecs.set(d.groupId,canonical);
    }
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
