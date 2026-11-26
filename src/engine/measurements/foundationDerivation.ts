import type {FoundationEntity,FoundationStripSource} from './measurementTypes';
import {extendedStrip} from './foundationGeometry';
type Wall=FoundationEntity & {kind:'foundationWall';start:{x:number;y:number};end:{x:number;y:number};widthFt:number|null;heightFt:number|null;elevationFt:number|null};
const wall=(e:FoundationEntity):e is Wall=>e.kind==='foundationWall';
const near=(a:number,b:number)=>Math.abs(a-b)<=1e-8;
function expected(w:Wall,s:FoundationStripSource,entities:FoundationEntity[]){
 if(!w.foundation?.centrelineConfirmed||!w.foundation.baseElevationConfirmed||w.elevationFt===null||w.widthFt===null||w.foundation.material!=='poured concrete')throw Error('Confirm source wall centreline, width, material and base elevation');
 const length=Math.hypot(w.end.x-w.start.x,w.end.y-w.start.y);
 if(!Number.isFinite(length)||length<=1e-8||!Number.isFinite(s.widthFt)||s.widthFt<=0||!Number.isFinite(s.depthFt)||s.depthFt<=0||!Number.isFinite(s.offsetFt))throw Error('Invalid footing dimensions');
 // Offset is signed along the left normal of the directed source in project XY.
 // Bounded to isolated orthogonal walls, not arbitrary joined or unsupported bearing geometry.
 const a=w.foundation.joinStartFt??0,b=w.foundation.joinEndFt??0;
 // Offset-specific eligibility precedes general centred-junction validation.
 if(s.offsetFt!==0&&(a!==0||b!==0||entities.some(e=>e.id!==w.id&&wall(e)&&e.assemblyId===w.assemblyId)))throw Error('Offset footing requires an isolated unjoined wall');
 if([a,b].some(v=>v!==0&&!near(v,w.widthFt!/2)))throw Error('Unsupported source junction extension');
 const joinStartFt=a===0?0:s.widthFt/2,joinEndFt=b===0?0:s.widthFt/2;
 if(s.offsetFt!==0){
  if(Math.abs(s.offsetFt)+w.widthFt/2>s.widthFt/2+1e-8)throw Error('Offset footing must contain the source wall width; confirm bearing design separately');
  const source=extendedStrip(w.start,w.end,w.widthFt);
  for(const other of entities.filter(wall)){
   if(other.id===w.id)continue;
   if(other.widthFt===null||!other.foundation?.centrelineConfirmed)throw Error('Cannot verify isolation from unconfirmed wall geometry');
   const q=extendedStrip(other.start,other.end,other.widthFt,other.foundation.joinStartFt,other.foundation.joinEndFt);
   if(source.xmin<=q.xmax+1e-8&&source.xmax>=q.xmin-1e-8&&source.ymin<=q.ymax+1e-8&&source.ymax>=q.ymin-1e-8)throw Error('Offset footing requires an isolated unjoined wall');
  }
 }
 const dx=-(w.end.y-w.start.y)/length*s.offsetFt,dy=(w.end.x-w.start.x)/length*s.offsetFt;
 const start={x:w.start.x+dx,y:w.start.y+dy},end={x:w.end.x+dx,y:w.end.y+dy};
 extendedStrip(start,end,s.widthFt,joinStartFt,joinEndFt);
 return {start,end,widthFt:s.widthFt,heightFt:s.depthFt,elevationFt:w.elevationFt-s.depthFt,joinStartFt,joinEndFt};
}
export function deriveStripFootings(entities:FoundationEntity[],selectedIds:string[],widthFt:number,depthFt:number,id:()=>string,offsetFt=0):FoundationEntity[]{
 const walls=entities.filter(e=>selectedIds.includes(e.id)&&wall(e)).filter(wall);
 if(!walls.length||walls.length!==new Set(selectedIds).size)throw Error('Select foundation walls only');
 if(entities.some(e=>e.foundation?.stripSource&&selectedIds.includes(e.foundation.stripSource.wallId)))throw Error('Remove existing derived strip group before regenerating');
 if(offsetFt!==0&&walls.length!==1)throw Error('Select one isolated wall for offset footing');
 const groupId=id(),assemblyId=id();
 return walls.map(w=>{const s:FoundationStripSource={version:1,wallIds:walls.map(q=>q.id).sort(),wallId:w.id,groupId,offsetFt,widthFt,depthFt},g=expected(w,s,entities),entityId=id();return {id:entityId,physicalId:entityId,assemblyId,source:{reference:'Derived strip footing from '+w.id},kind:'stripFooting',start:g.start,end:g.end,widthFt:g.widthFt,heightFt:g.heightFt,elevationFt:g.elevationFt,foundation:{version:1,material:'poured concrete',centrelineConfirmed:true,baseElevationConfirmed:true,joinStartFt:g.joinStartFt,joinEndFt:g.joinEndFt,stripSource:s,...(w.foundation?.elevationReference?{elevationReference:w.foundation.elevationReference}:{})}}});
}
export function validateStripSources(entities:FoundationEntity[]):void{
 const seen=new Set<string>(),groups=new Map<string,string>(),members=new Map<string,FoundationStripSource[]>();
 for(const e of entities){const s=e.foundation?.stripSource;if(!s)continue;
 const w=entities.find(q=>q.id===s.wallId);
 if(!w||!wall(w)||e.kind!=='stripFooting'||!('widthFt' in e))throw Error('Missing derived footing source wall');
 if(seen.has(s.wallId))throw Error('Duplicate derived footing source wall');seen.add(s.wallId);
 const groupSpec=JSON.stringify([e.assemblyId,s.widthFt,s.depthFt,s.offsetFt,s.wallIds?[...s.wallIds].sort():null]);
 const list=members.get(s.groupId)??[];list.push(s);members.set(s.groupId,list);
 if(groups.has(s.groupId)&&groups.get(s.groupId)!==groupSpec)throw Error('Inconsistent derived footing group');groups.set(s.groupId,groupSpec);
 const g=expected(w,s,entities);
 const a=e.foundation?.elevationReference,b=w.foundation?.elevationReference;
 if((a?.kind??'historical')!==(b?.kind??'historical')||a?.kind==='assembly'&&b?.kind==='assembly'&&a.id!==b.id)throw Error('Derived footing elevation reference is stale');
 if(!e.foundation?.centrelineConfirmed||!e.foundation.baseElevationConfirmed||e.foundation.material!=='poured concrete'||e.widthFt!==g.widthFt||e.heightFt!==g.heightFt||e.elevationFt!==g.elevationFt||e.start.x!==g.start.x||e.start.y!==g.start.y||e.end.x!==g.end.x||e.end.y!==g.end.y||e.foundation.joinStartFt!==g.joinStartFt||e.foundation.joinEndFt!==g.joinEndFt)throw Error('Derived footing is stale; remove or regenerate the group before editing its source');
 }
 for(const group of members.values()){const ids=group[0].wallIds;if(ids&&(group.length!==ids.length||ids.some(id=>!group.some(s=>s.wallId===id))))throw Error('Incomplete derived strip group');}
}
export function foundationAssemblyIds(entities:FoundationEntity[],id:string):string[]{const e=entities.find(q=>q.id===id);return e?entities.filter(q=>q.assemblyId===e.assemblyId&&q.kind===e.kind&&(!('purpose' in e)||'purpose' in q&&q.purpose===e.purpose)).map(q=>q.id):[]}
export function planFoundationDeletion(entities:FoundationEntity[],selectedIds:string[]){
 const selected=new Set(selectedIds),groups=new Set(entities.filter(e=>e.foundation?.stripSource&&(selected.has(e.id)||selected.has(e.foundation.stripSource.wallId))).map(e=>e.foundation!.stripSource!.groupId));
 const envelopeGroups=new Set(entities.filter(e=>e.foundation?.envelopeSource&&(selected.has(e.id)||selected.has(e.foundation.envelopeSource.sourceId))).map(e=>e.foundation!.envelopeSource!.groupId));
 const drainageGroups=new Set(entities.filter(e=>e.foundation?.drainageSource&&(selected.has(e.id)||e.foundation.drainageSource.wallIds.some(id=>selected.has(id)))).map(e=>e.foundation!.drainageSource!.groupId));
 const removed=entities.filter(e=>selected.has(e.id)||!!e.foundation?.stripSource&&groups.has(e.foundation.stripSource.groupId)||!!e.foundation?.envelopeSource&&envelopeGroups.has(e.foundation.envelopeSource.groupId)||!!e.foundation?.drainageSource&&drainageGroups.has(e.foundation.drainageSource.groupId));
 const ids=new Set(removed.map(e=>e.id));return {removed,dependentCount:removed.filter(e=>!selected.has(e.id)).length,remaining:entities.filter(e=>!ids.has(e.id))};
}
