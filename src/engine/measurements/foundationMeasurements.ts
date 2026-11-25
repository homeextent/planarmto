/** Initial C.1C measurement adapter. Rectangular compatible systems only for overlap reconciliation.
 * Not connected to the application inspector or persistence boundary until lifecycle contracts are complete.
 */
import {validateSpecialistEntities,validateContributionSet,type FoundationEntity,type QuantityContribution} from './measurementTypes';
import {simplePolygon} from './roofMeasurements';
import {rectangleBounds,extendedStrip,reconcileRectangularPrisms,type Prism,type Bounds} from './foundationGeometry';
const intersects=(a:Bounds,b:Bounds)=>Math.min(a.xmax,b.xmax)>Math.max(a.xmin,b.xmin)&&Math.min(a.ymax,b.ymax)>Math.max(a.ymin,b.ymin);
type Solid={entity:FoundationEntity;code:string;material:string;bounds:Bounds|null;prism:Prism|null;reason?:string};
export function measureFoundation(workspaceId:string,entities:FoundationEntity[]):{rows:QuantityContribution[];warnings:string[]} {
 validateSpecialistEntities('foundation',entities);
 const rows:QuantityContribution[]=[],warnings:string[]=[],solids:Solid[]=[];
 const add=(e:FoundationEntity,code:string,unit:QuantityContribution['unit'],basis:string,value:number|null,reason='Missing or unconfirmed foundation input')=>{
  const base={workspaceId,elementId:e.id,physicalId:e.physicalId,assemblyId:e.assemblyId,source:e.source,code,unit,basis};
  rows.push(value===null?{...base,status:'unquantified',reason}:{...base,status:'measured',quantity:value});
 };
 for(const e of entities){
  if('polygon' in e&&!simplePolygon(e.polygon))throw Error('Invalid foundation polygon: '+e.id);
  if(e.kind==='foundationLine'){
   // Line surface/route ownership not yet established; never certify duplicate routes.
   add(e,e.purpose==='drainage'?'foundation.drainage.length':'foundation.waterproofing.area',e.purpose==='drainage'?'LF':'SF','explicit line (ownership pending)',null,'Line ownership and coverage validation pending');continue;
  }
  if('polygon' in e&&e.purpose==='insulation'){
   add(e,'foundation.insulation.area','SF','explicit region (ownership pending)',null,'Insulation layer ownership validation pending');continue;
  }
  const line='start' in e;
  const code=e.kind==='foundationWall'?'foundation.wall.concrete':e.kind==='stripFooting'?'foundation.footing.strip.concrete':e.kind==='padFooting'?'foundation.footing.pad.concrete':e.kind==='slab'?'foundation.slab.concrete':'purpose' in e&&e.purpose==='concrete'?'foundation.region.concrete':'foundation.'+('purpose' in e?e.purpose:'unknown')+'.volume';
  const material=code.endsWith('.concrete')?'concrete':e.kind==='foundationRegion'?e.purpose:'concrete';
  let bounds:Bounds|null=null,prism:Prism|null=null,reason:string|undefined;
  if(!e.foundation?.material)reason='Confirm material and foundation source semantics';
  else if(material==='concrete'&&e.foundation.material!=='poured concrete')reason='Unsupported concrete construction system';
  if(line){
   if(e.widthFt===null)reason='Missing width';
   else if(!e.foundation?.centrelineConfirmed)reason='Confirm centreline reference';
   else try{bounds=extendedStrip(e.start,e.end,e.widthFt,e.foundation.joinStartFt,e.foundation.joinEndFt)}catch{reason='Unsupported strip footprint; reconcile explicitly'}
  }else if('polygon' in e)try{bounds=rectangleBounds(e.polygon)}catch{reason='Nonrectangular volume reconciliation not yet supported'}
  const height='start' in e?e.heightFt:e.depthFt;
  if(height===null)reason='Missing thickness or height';
  if(bounds&&!reason)prism={id:e.id,bounds,bottomFt:e.foundation?.baseElevationConfirmed?e.elevationFt:null,heightFt:height};
  solids.push({entity:e,code,material,bounds,prism,reason});
 }
 // Unknown footprint can overlap any same-purpose solid. Conservative until arbitrary polygon ownership is available.
 // Distinct concrete codes are not interchangeable for attribution: cross-code overlap is pending.
 for(const s of solids){
  if(!s.prism)continue;
  for(const q of solids){
   if(s===q||s.material!==q.material)continue;
   if(q.bounds&&!intersects(s.bounds!,q.bounds))continue;
   if(q.prism&&s.prism.bottomFt!==null&&q.prism.bottomFt!==null&&s.prism.heightFt!==null&&q.prism.heightFt!==null&&(s.prism.bottomFt+s.prism.heightFt<=q.prism.bottomFt||q.prism.bottomFt+q.prism.heightFt<=s.prism.bottomFt))continue;
   if(!q.prism||s.code!==q.code||s.entity.assemblyId!==q.entity.assemblyId||s.entity.foundation?.material!==q.entity.foundation?.material){
    s.reason='Unresolved overlapping physical material or assembly';break;
   }
  }
 }
 // Propagate blocked state through overlapping compatible components.
 let changed=true;while(changed){changed=false;for(const s of solids)if(s.prism&&!s.reason&&solids.some(q=>q!==s&&q.reason&&q.material===s.material&&(!q.bounds||intersects(s.bounds!,q.bounds)))){s.reason='Connected overlap requires reconciliation';changed=true}}
 const groups=new Map<string,Solid[]>();
 for(const s of solids)if(s.prism&&!s.reason){const key=JSON.stringify([s.code,s.entity.assemblyId,s.entity.foundation?.material]);const g=groups.get(key)||[];g.push(s);groups.set(key,g)}
 const results=new Map<string,{volumeCF:number|null;reason?:string}>();
 for(const group of groups.values())for(const v of reconcileRectangularPrisms(group.map(s=>s.prism!)))results.set(v.id,v);
 for(const s of solids){
  const result=results.get(s.entity.id),reason=s.reason||result?.reason;
  add(s.entity,s.code,'CY','reconciled rectangular solid, geometric installed volume',result?.volumeCF==null?null:result.volumeCF/27,reason);
  if(reason)warnings.push(s.entity.id+': '+reason);
 }
 validateContributionSet(rows);return {rows,warnings};
}
