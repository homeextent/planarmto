import {foundationLayerConflicts} from './foundationLayers';
/** Initial C.1C measurement adapter. Rectangular compatible systems only for overlap reconciliation.
 * Shared explicit topology validation at the persistence boundary; inspector integration pending.
 */
import {comparableFoundationElevations,foundationSlabFootprintEstimate,validateContributionSet,type FoundationEntity,type QuantityContribution,type Point} from './measurementTypes';
import {simplePolygon,projectedArea} from './roofMeasurements';
import {extendedStrip,reconcileRectangularPrisms,orthogonalPolygonPieces,polygonEnvelope,orientedStripFootprint,orientedFootprintsOverlap,type Prism,type Bounds} from './foundationGeometry';
import {foundationDetails} from './foundationDetails';
import {foundationCoverage} from './foundationCoverage';
import {validateFoundationTopology} from './foundationTopology';
const intersects=(a:Bounds,b:Bounds)=>Math.min(a.xmax,b.xmax)>Math.max(a.xmin,b.xmin)&&Math.min(a.ymax,b.ymax)>Math.max(a.ymin,b.ymin);
type Solid={entity:FoundationEntity;code:string;material:string;bounds:Bounds|null;prism:Prism|null;pieces:Bounds[]|null;oriented:Point[]|null;area:number|null;details:ReturnType<typeof foundationDetails>;reason?:string};
export type FoundationVolumeBreakdown={elementId:string;grossCY:number|null;deductionCY:number|null;additionalCY:number|null;netCY:number|null};
export type FoundationFootprintReference={elementId:string;code:'foundation.footing.pad.area'|'foundation.slab.area';unit:'SF';role:'reference';grossSF:number|null;exclusionSF:number|null;netSF:number|null;reason?:string};
export type FoundationScopeDiagnostic={elementId:string;physicalId:string;assemblyId:string;status:'included'|'excluded'|'pending'|'legacy';reason?:string};
export function measureFoundation(workspaceId:string,entities:FoundationEntity[]):{rows:QuantityContribution[];warnings:string[];detailBreakdown:FoundationVolumeBreakdown[];footprintReferences:FoundationFootprintReference[];scopeDiagnostics:FoundationScopeDiagnostic[]} {
 validateFoundationTopology(entities);
 const scopeDiagnostics:FoundationScopeDiagnostic[]=entities.map(e=>({elementId:e.id,physicalId:e.physicalId,assemblyId:e.assemblyId,status:e.scopeApplicability?.status??'legacy',...(e.scopeApplicability&&'reason' in e.scopeApplicability?{reason:e.scopeApplicability.reason}:{})}));
 // Excluded geometry is retained in the project but does not participate in quantity ownership.
 // Pending geometry remains in overlap checks; its own contributions cannot be measured.
 entities=entities.filter(e=>e.scopeApplicability?.status!=='excluded');
 const layerConflicts=foundationLayerConflicts(entities);
 const rows:QuantityContribution[]=[],warnings:string[]=[],solids:Solid[]=[],detailBreakdown:FoundationVolumeBreakdown[]=[],footprintReferences:FoundationFootprintReference[]=[];
 const add=(e:FoundationEntity,code:string,unit:QuantityContribution['unit'],basis:string,value:number|null,reason='Missing or unconfirmed foundation input')=>{
  const base={workspaceId,elementId:e.id,physicalId:e.physicalId,assemblyId:e.assemblyId,source:e.source,code,unit,basis:e.source.note===foundationSlabFootprintEstimate?foundationSlabFootprintEstimate:basis};
  if(layerConflicts.has(e.id)){value=null;reason=layerConflicts.get(e.id)!;}
  if(e.scopeApplicability?.status==='pending'){value=null;reason='Scope pending: '+e.scopeApplicability.reason;}
  rows.push(value===null?{...base,status:'unquantified',reason}:{...base,status:'measured',quantity:value});
 };
 for(const e of entities){
  if('polygon' in e&&!simplePolygon(e.polygon)){
   if(e.foundation)throw Error('Invalid foundation polygon: '+e.id);
   // Historical invalid geometry remains retained, but blocks potentially related quantities.
  }
  if(e.kind==='foundationLine'||'polygon' in e&&e.purpose==='insulation')continue;
  const line='start' in e;
  const code=e.kind==='foundationTrench'?'foundation.excavation.volume':e.kind==='foundationWall'?'foundation.wall.concrete':e.kind==='stripFooting'?'foundation.footing.strip.concrete':e.kind==='padFooting'?'foundation.footing.pad.concrete':e.kind==='slab'?'foundation.slab.concrete':'purpose' in e&&e.purpose==='concrete'?'foundation.region.concrete':'foundation.'+('purpose' in e?e.purpose:'unknown')+'.volume';
  const material=e.kind==='foundationTrench'?'excavation':code.endsWith('.concrete')?'concrete':e.kind==='foundationRegion'?e.purpose:'concrete';
  let bounds:Bounds|null=null,prism:Prism|null=null,pieces:Bounds[]|null=null,oriented:Point[]|null=null,area:number|null=null,reason:string|undefined;
  if(!e.foundation?.material)reason='Select the construction material';
  else if(material==='concrete'&&e.foundation.material!=='poured concrete')reason='Unsupported concrete construction system';
  if(line){
   if(e.widthFt===null)reason='Enter the component width to determine its footprint';
   else if(!e.foundation?.centrelineConfirmed)reason='Confirm centreline reference';
   else try{oriented=orientedStripFootprint(e.start,e.end,e.widthFt,e.foundation.joinStartFt,e.foundation.joinEndFt);bounds=polygonEnvelope(oriented);if(e.start.x===e.end.x||e.start.y===e.end.y){bounds=extendedStrip(e.start,e.end,e.widthFt,e.foundation.joinStartFt,e.foundation.joinEndFt);pieces=[bounds]}else{area=(Math.hypot(e.end.x-e.start.x,e.end.y-e.start.y)+(e.foundation.joinStartFt??0)+(e.foundation.joinEndFt??0))*e.widthFt;if((e.foundation.joinStartFt??0)!==0||(e.foundation.joinEndFt??0)!==0)reason='Angled junction extensions require explicit reconciliation';}}catch{reason='Unsupported strip footprint; reconcile explicitly'}
  }else if('polygon' in e&&simplePolygon(e.polygon)){bounds=polygonEnvelope(e.polygon);area=projectedArea(e.polygon);try{pieces=orthogonalPolygonPieces(e.polygon)}catch{/* Nonorthogonal polygon may be measured only without unresolved overlap. */}}
  const height='start' in e?e.heightFt:e.depthFt;
  if(height===null)reason='Missing thickness or height';
  if(bounds&&!reason)prism={id:e.id,bounds,bottomFt:e.foundation?.baseElevationConfirmed?e.elevationFt:null,heightFt:height};
  if(layerConflicts.has(e.id))reason=layerConflicts.get(e.id)!;
  if(e.scopeApplicability?.status==='pending')reason='Scope pending: '+e.scopeApplicability.reason;
  const details=foundationDetails(e);
  solids.push({entity:e,code,material,bounds,prism,pieces,oriented,area,details,reason});
 }
 // Unknown footprint can overlap any same-purpose solid. Envelopes are only broad-phase rejection, never quantity authority.
 const corners=(b:Bounds):Point[]=>[{x:b.xmin,y:b.ymin},{x:b.xmax,y:b.ymin},{x:b.xmax,y:b.ymax},{x:b.xmin,y:b.ymax}];
 const outsideIncompleteWallRun=(a:Solid,b:Solid)=>{
  const wall=a.entity;
  if(a.bounds||!b.bounds||wall.kind!=='foundationWall'||wall.source.reference!=='Manual foundation draft'||wall.widthFt!==null)return false;
  const dx=wall.end.x-wall.start.x,dy=wall.end.y-wall.start.y,length=Math.hypot(dx,dy);
  if(length<=1e-8)return false;
  // Any width extends perpendicular to the wall. Its axial interval still bounds the run.
  const ux=dx/length,uy=dy/length;
  const project=(p:Point)=>(p.x-wall.start.x)*ux+(p.y-wall.start.y)*uy;
  const values=corners(b.bounds).map(project);
  const start=-(wall.foundation?.joinStartFt??0),end=length+(wall.foundation?.joinEndFt??0);
  if(![...values,start,end].every(Number.isFinite))return false;
  const tolerance=1e-8+Number.EPSILON*16*Math.max(length,Math.abs(wall.start.x),Math.abs(wall.start.y),...values.map(Math.abs));
  return Math.max(...values)<start-tolerance||Math.min(...values)>end+tolerance;
 };
 const planOverlap=(a:Solid,b:Solid)=>{if(!a.bounds||!b.bounds)return !outsideIncompleteWallRun(a,b)&&!outsideIncompleteWallRun(b,a);if(!intersects(a.bounds,b.bounds))return false;if(a.oriented&&b.oriented)return orientedFootprintsOverlap(a.oriented,b.oriented);if(a.oriented&&b.pieces)return b.pieces.some(p=>orientedFootprintsOverlap(a.oriented!,corners(p)));if(b.oriented&&a.pieces)return a.pieces.some(p=>orientedFootprintsOverlap(b.oriented!,corners(p)));return !a.pieces||!b.pieces||a.pieces.some(x=>b.pieces!.some(y=>intersects(x,y)));};
 const verticalDisjoint=(a:Solid,b:Solid)=>{const p=a.prism,q=b.prism;return comparableFoundationElevations(a.entity,b.entity)&&!!p&&!!q&&p.bottomFt!==null&&q.bottomFt!==null&&p.heightFt!==null&&q.heightFt!==null&&(p.bottomFt+p.heightFt<=q.bottomFt||q.bottomFt+q.heightFt<=p.bottomFt)};
 // Distinct concrete codes are not interchangeable for attribution: cross-code overlap is pending.
 for(const s of solids){
  if(!s.prism)continue;
  for(const q of solids){
   if(s===q||s.material!==q.material)continue;
   if(!planOverlap(s,q))continue;
   if(verticalDisjoint(s,q)&&!s.details.hasDetails&&!q.details.hasDetails)continue;
   if(!q.bounds){s.reason='Confirm the dimensions of a nearby construction component before reconciling overlap';break;}
   if(!comparableFoundationElevations(s.entity,q.entity)){s.reason='Confirm a common elevation reference for potentially overlapping materials';break;}
   if(q.prism&&s.oriented&&q.oriented&&s.code===q.code&&s.entity.foundation?.material===q.entity.foundation?.material&&!s.details.hasDetails&&!q.details.hasDetails&&s.prism.bottomFt!==null&&s.prism.bottomFt===q.prism.bottomFt&&s.prism.heightFt===q.prism.heightFt&&s.oriented.every(p=>q.oriented!.some(v=>Math.hypot(p.x-v.x,p.y-v.y)<=1e-8)))throw Error('Duplicate physical solid: '+s.entity.id+' / '+q.entity.id);
   if(q.prism&&s.pieces&&q.pieces&&s.prism.bottomFt!==null&&s.prism.bottomFt===q.prism.bottomFt&&s.prism.heightFt===q.prism.heightFt){
    const area=(p:Bounds)=>(p.xmax-p.xmin)*(p.ymax-p.ymin),a=s.pieces.reduce((n,p)=>n+area(p),0),b=q.pieces.reduce((n,p)=>n+area(p),0);
    const shared=s.pieces.reduce((n,p)=>n+q.pieces!.reduce((m,v)=>m+Math.max(0,Math.min(p.xmax,v.xmax)-Math.max(p.xmin,v.xmin))*Math.max(0,Math.min(p.ymax,v.ymax)-Math.max(p.ymin,v.ymin)),0),0);
    if(s.code===q.code&&s.entity.foundation?.material===q.entity.foundation?.material&&!s.details.hasDetails&&!q.details.hasDetails&&Math.abs(a-shared)<1e-8&&Math.abs(b-shared)<1e-8)throw Error('Duplicate physical solid: '+s.entity.id+' / '+q.entity.id);
   }
   if(s.details.hasDetails||q.details.hasDetails||!q.prism||s.prism.bottomFt===null||q.prism.bottomFt===null||!s.pieces||!q.pieces||s.pieces.length>1||q.pieces.length>1||s.code!==q.code||s.entity.assemblyId!==q.entity.assemblyId||s.entity.foundation?.material!==q.entity.foundation?.material){
    s.reason='Unresolved overlapping physical material or assembly';break;
   }
  }
 }
 // Propagate blocked state through overlapping compatible components.
 let changed=true;while(changed){changed=false;for(const s of solids)if(s.prism&&!s.reason&&solids.some(q=>q!==s&&q.reason&&q.material===s.material&&planOverlap(s,q)&&(!verticalDisjoint(s,q)||s.details.hasDetails||q.details.hasDetails))){s.reason='Connected overlap requires reconciliation';changed=true}}
 const groups=new Map<string,Solid[]>();
 for(const s of solids)if(s.prism&&!s.reason){const key=JSON.stringify([s.code,s.entity.assemblyId,s.entity.foundation?.material]);const g=groups.get(key)||[];g.push(s);groups.set(key,g)}
 const results=new Map<string,{volumeCF:number|null;reason?:string}>();
 for(const group of groups.values()){
  const rects:Prism[]=[],owners=new Map<string,string>();
  for(const s of group){
   if(!s.pieces){results.set(s.entity.id,{volumeCF:s.area!*s.prism!.heightFt!});continue}
   // Prefix with original stable ID, encoded to avoid collision with piece suffix.
   s.pieces.forEach((bounds,i)=>{const id=JSON.stringify([s.entity.id,i]);owners.set(id,s.entity.id);rects.push({...s.prism!,id,bounds})});
  }
  for(const v of reconcileRectangularPrisms(rects)){
   const owner=owners.get(v.id)!,old=results.get(owner);
   results.set(owner,{volumeCF:v.volumeCF===null||old?.volumeCF===null?null:(old?.volumeCF??0)+v.volumeCF,reason:v.reason||old?.reason});
  }
 }
 for(const s of solids){
  const result=results.get(s.entity.id),reason=s.reason||result?.reason;
  const gross=result?.volumeCF??null,d=s.details;
  const net=gross===null||d.deductionCF===null||d.additionalCF===null?null:gross-d.deductionCF+d.additionalCF;
  detailBreakdown.push({elementId:s.entity.id,grossCY:gross===null?null:gross/27,deductionCY:gross===null||d.deductionCF===null?null:d.deductionCF/27,additionalCY:gross===null||d.additionalCF===null?null:d.additionalCF/27,netCY:net===null?null:net/27});
  if(net!==null&&net<0)throw Error('Negative net foundation volume');
  add(s.entity,s.code,'CY','net geometric installed volume',net===null?null:net/27,reason);
  if(s.entity.kind==='padFooting')add(s.entity,'foundation.footing.pad.count','EA','reference pad count',net===null?null:1,reason);

  if(s.entity.kind==='padFooting'||s.entity.kind==='slab'){
   // Geometry-only reference: do not feed the concrete material contribution ledger.
   // A valid, explicit poured-concrete outline may have known area before thickness is entered.
   // Other same-material potentially overlapping components with unresolved vertical or plan relationship
   // prevent a confirmed net footprint; no additive cross-component area total is implied.
   const e=s.entity,confirmed=e.foundation?.material==='poured concrete'&&s.area!==null;
   const conflict=solids.some(q=>q!==s&&q.material===s.material&&planOverlap(s,q)&&(!verticalDisjoint(s,q)||s.details.hasDetails||q.details.hasDetails));
   const gross=confirmed?s.area:null,exclusion=confirmed?(e.foundation?.slabOpenings??[]).reduce((n,o)=>n+projectedArea(o.polygon),0):null;
   const net=gross===null||exclusion===null||conflict||e.scopeApplicability?.status==='pending'?null:gross-exclusion;
   footprintReferences.push({elementId:e.id,code:e.kind==='slab'?'foundation.slab.area':'foundation.footing.pad.area',unit:'SF',role:'reference',grossSF:gross,exclusionSF:exclusion,netSF:net,...(net===null?{reason:e.scopeApplicability?.status==='pending'?e.scopeApplicability.reason:conflict?'Potential overlapping concrete; resolve physical relationship':'Confirm material and valid footprint'}:{})});
  }
  if(reason)warnings.push(s.entity.id+': '+reason);
 }
 for(const c of foundationCoverage(entities)){add(c.entity,c.code,c.unit,c.basis,c.value,c.reason);if(c.value===null)warnings.push(c.entity.id+': '+c.reason)}
 for(const [id,reason] of layerConflicts)if(!warnings.includes(id+': '+reason))warnings.push(id+': '+reason);
 validateContributionSet(rows);return {rows,warnings,detailBreakdown,footprintReferences,scopeDiagnostics};
}
