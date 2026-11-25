import type {FoundationEntity,FoundationStripSource} from './measurementTypes';
import {extendedStrip} from './foundationGeometry';
type Wall=FoundationEntity & {kind:'foundationWall';start:{x:number;y:number};end:{x:number;y:number};widthFt:number|null;heightFt:number|null;elevationFt:number|null};
const wall=(e:FoundationEntity):e is Wall=>e.kind==='foundationWall';
const near=(a:number,b:number)=>Math.abs(a-b)<=1e-8;
function expected(w:Wall,s:FoundationStripSource){
 if(!w.foundation?.centrelineConfirmed||!w.foundation.baseElevationConfirmed||w.elevationFt===null||w.widthFt===null||w.foundation.material!=='poured concrete')throw Error('Confirm source wall centreline, width, material and base elevation');
 const length=Math.hypot(w.end.x-w.start.x,w.end.y-w.start.y);
 if(!Number.isFinite(length)||length<=1e-8||!Number.isFinite(s.widthFt)||s.widthFt<=0||!Number.isFinite(s.depthFt)||s.depthFt<=0||!Number.isFinite(s.offsetFt))throw Error('Invalid footing dimensions');
 // Bounded centred strip. Nonzero offset and arbitrary junctions require manual drafting.
 if(s.offsetFt!==0)throw Error('Only centred strip derivation is supported; draft offset footings manually');
 const a=w.foundation.joinStartFt??0,b=w.foundation.joinEndFt??0;
 if([a,b].some(v=>v!==0&&!near(v,w.widthFt!/2)))throw Error('Unsupported source junction extension');
 const joinStartFt=a===0?0:s.widthFt/2,joinEndFt=b===0?0:s.widthFt/2;
 extendedStrip(w.start,w.end,s.widthFt,joinStartFt,joinEndFt);
 return {start:w.start,end:w.end,widthFt:s.widthFt,heightFt:s.depthFt,elevationFt:w.elevationFt-s.depthFt,joinStartFt,joinEndFt};
}
export function deriveStripFootings(entities:FoundationEntity[],selectedIds:string[],widthFt:number,depthFt:number,id:()=>string):FoundationEntity[]{
 const walls=entities.filter(e=>selectedIds.includes(e.id)&&wall(e)).filter(wall);
 if(!walls.length||walls.length!==new Set(selectedIds).size)throw Error('Select foundation walls only');
 if(entities.some(e=>e.foundation?.stripSource&&selectedIds.includes(e.foundation.stripSource.wallId)))throw Error('Remove existing derived strip group before regenerating');
 const groupId=id(),assemblyId=id();
 return walls.map(w=>{const s:FoundationStripSource={version:1,wallId:w.id,groupId,offsetFt:0,widthFt,depthFt},g=expected(w,s),entityId=id();return {id:entityId,physicalId:entityId,assemblyId,source:{reference:'Derived strip footing from '+w.id},kind:'stripFooting',start:g.start,end:g.end,widthFt:g.widthFt,heightFt:g.heightFt,elevationFt:g.elevationFt,foundation:{version:1,material:'poured concrete',centrelineConfirmed:true,baseElevationConfirmed:true,joinStartFt:g.joinStartFt,joinEndFt:g.joinEndFt,stripSource:s}}});
}
export function validateStripSources(entities:FoundationEntity[]):void{
 const seen=new Set<string>(),groups=new Map<string,string>();
 for(const e of entities){const s=e.foundation?.stripSource;if(!s)continue;
 const w=entities.find(q=>q.id===s.wallId);
 if(!w||!wall(w)||e.kind!=='stripFooting'||!('widthFt' in e))throw Error('Missing derived footing source wall');
 if(seen.has(s.wallId))throw Error('Duplicate derived footing source wall');seen.add(s.wallId);
 const groupSpec=JSON.stringify([e.assemblyId,s.widthFt,s.depthFt,s.offsetFt]);
 if(groups.has(s.groupId)&&groups.get(s.groupId)!==groupSpec)throw Error('Inconsistent derived footing group');groups.set(s.groupId,groupSpec);
 const g=expected(w,s);
 if(!e.foundation?.centrelineConfirmed||!e.foundation.baseElevationConfirmed||e.foundation.material!=='poured concrete'||e.widthFt!==g.widthFt||e.heightFt!==g.heightFt||e.elevationFt!==g.elevationFt||e.start.x!==g.start.x||e.start.y!==g.start.y||e.end.x!==g.end.x||e.end.y!==g.end.y||e.foundation.joinStartFt!==g.joinStartFt||e.foundation.joinEndFt!==g.joinEndFt)throw Error('Derived footing is stale; remove or regenerate the group before editing its source');
 }
}
export function foundationAssemblyIds(entities:FoundationEntity[],id:string):string[]{const e=entities.find(q=>q.id===id);return e?entities.filter(q=>q.assemblyId===e.assemblyId&&q.kind===e.kind).map(q=>q.id):[]}
export function planFoundationDeletion(entities:FoundationEntity[],selectedIds:string[]){
 const selected=new Set(selectedIds),groups=new Set(entities.filter(e=>e.foundation?.stripSource&&(selected.has(e.id)||selected.has(e.foundation.stripSource.wallId))).map(e=>e.foundation!.stripSource!.groupId));
 const envelopeGroups=new Set(entities.filter(e=>e.foundation?.envelopeSource&&(selected.has(e.id)||selected.has(e.foundation.envelopeSource.sourceId))).map(e=>e.foundation!.envelopeSource!.groupId));
 const removed=entities.filter(e=>selected.has(e.id)||!!e.foundation?.stripSource&&groups.has(e.foundation.stripSource.groupId)||!!e.foundation?.envelopeSource&&envelopeGroups.has(e.foundation.envelopeSource.groupId));
 const ids=new Set(removed.map(e=>e.id));return {removed,dependentCount:removed.filter(e=>!selected.has(e.id)).length,remaining:entities.filter(e=>!ids.has(e.id))};
}
