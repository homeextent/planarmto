/** Initial C.1C measurement adapter. Rectangular compatible systems only for overlap reconciliation.
 * Shared explicit topology validation at the persistence boundary; inspector integration pending.
 */
import {validateContributionSet,type FoundationEntity,type QuantityContribution} from './measurementTypes';
import {simplePolygon,projectedArea} from './roofMeasurements';
import {extendedStrip,reconcileRectangularPrisms,orthogonalPolygonPieces,polygonEnvelope,type Prism,type Bounds} from './foundationGeometry';
import {foundationDetails} from './foundationDetails';
import {foundationCoverage} from './foundationCoverage';
import {validateFoundationTopology} from './foundationTopology';
const intersects=(a:Bounds,b:Bounds)=>Math.min(a.xmax,b.xmax)>Math.max(a.xmin,b.xmin)&&Math.min(a.ymax,b.ymax)>Math.max(a.ymin,b.ymin);
type Solid={entity:FoundationEntity;code:string;material:string;bounds:Bounds|null;prism:Prism|null;pieces:Bounds[]|null;area:number|null;details:ReturnType<typeof foundationDetails>;reason?:string};
export type FoundationVolumeBreakdown={elementId:string;grossCY:number|null;deductionCY:number|null;additionalCY:number|null;netCY:number|null};
export function measureFoundation(workspaceId:string,entities:FoundationEntity[]):{rows:QuantityContribution[];warnings:string[];detailBreakdown:FoundationVolumeBreakdown[]} {
 validateFoundationTopology(entities);
 const rows:QuantityContribution[]=[],warnings:string[]=[],solids:Solid[]=[],detailBreakdown:FoundationVolumeBreakdown[]=[];
 const add=(e:FoundationEntity,code:string,unit:QuantityContribution['unit'],basis:string,value:number|null,reason='Missing or unconfirmed foundation input')=>{
  const base={workspaceId,elementId:e.id,physicalId:e.physicalId,assemblyId:e.assemblyId,source:e.source,code,unit,basis};
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
  let bounds:Bounds|null=null,prism:Prism|null=null,pieces:Bounds[]|null=null,area:number|null=null,reason:string|undefined;
  if(!e.foundation?.material)reason='Confirm material and foundation source semantics';
  else if(material==='concrete'&&e.foundation.material!=='poured concrete')reason='Unsupported concrete construction system';
  if(line){
   if(e.widthFt===null)reason='Missing width';
   else if(!e.foundation?.centrelineConfirmed)reason='Confirm centreline reference';
   else try{bounds=extendedStrip(e.start,e.end,e.widthFt,e.foundation.joinStartFt,e.foundation.joinEndFt);pieces=[bounds]}catch{reason='Unsupported strip footprint; reconcile explicitly'}
  }else if('polygon' in e&&simplePolygon(e.polygon)){bounds=polygonEnvelope(e.polygon);area=projectedArea(e.polygon);try{pieces=orthogonalPolygonPieces(e.polygon)}catch{/* Nonorthogonal polygon may be measured only without unresolved overlap. */}}
  const height='start' in e?e.heightFt:e.depthFt;
  if(height===null)reason='Missing thickness or height';
  if(bounds&&!reason)prism={id:e.id,bounds,bottomFt:e.foundation?.baseElevationConfirmed?e.elevationFt:null,heightFt:height};
  const details=foundationDetails(e);
  solids.push({entity:e,code,material,bounds,prism,pieces,area,details,reason});
 }
 // Unknown footprint can overlap any same-purpose solid. Envelopes are only broad-phase rejection, never quantity authority.
 const planOverlap=(a:Solid,b:Solid)=>!a.bounds||!b.bounds||intersects(a.bounds,b.bounds)&&(!a.pieces||!b.pieces||a.pieces.some(x=>b.pieces!.some(y=>intersects(x,y))));
 const verticalDisjoint=(a:Solid,b:Solid)=>{const p=a.prism,q=b.prism;return !!p&&!!q&&p.bottomFt!==null&&q.bottomFt!==null&&p.heightFt!==null&&q.heightFt!==null&&(p.bottomFt+p.heightFt<=q.bottomFt||q.bottomFt+q.heightFt<=p.bottomFt)};
 // Distinct concrete codes are not interchangeable for attribution: cross-code overlap is pending.
 for(const s of solids){
  if(!s.prism)continue;
  for(const q of solids){
   if(s===q||s.material!==q.material)continue;
   if(!planOverlap(s,q))continue;
   if(verticalDisjoint(s,q)&&!s.details.hasDetails&&!q.details.hasDetails)continue;
   if(q.prism&&s.pieces&&q.pieces&&s.prism.bottomFt!==null&&s.prism.bottomFt===q.prism.bottomFt&&s.prism.heightFt===q.prism.heightFt){
    const area=(p:Bounds)=>(p.xmax-p.xmin)*(p.ymax-p.ymin),a=s.pieces.reduce((n,p)=>n+area(p),0),b=q.pieces.reduce((n,p)=>n+area(p),0);
    const shared=s.pieces.reduce((n,p)=>n+q.pieces!.reduce((m,v)=>m+Math.max(0,Math.min(p.xmax,v.xmax)-Math.max(p.xmin,v.xmin))*Math.max(0,Math.min(p.ymax,v.ymax)-Math.max(p.ymin,v.ymin)),0),0);
    if(s.code===q.code&&s.entity.assemblyId===q.entity.assemblyId&&Math.abs(a-shared)<1e-8&&Math.abs(b-shared)<1e-8)throw Error('Duplicate physical solid: '+s.entity.id+' / '+q.entity.id);
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

  if(reason)warnings.push(s.entity.id+': '+reason);
 }
 for(const c of foundationCoverage(entities)){add(c.entity,c.code,c.unit,c.basis,c.value,c.reason);if(c.value===null)warnings.push(c.entity.id+': '+c.reason)}
 validateContributionSet(rows);return {rows,warnings,detailBreakdown};
}
