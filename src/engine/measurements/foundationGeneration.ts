import type {FoundationEntity} from './measurementTypes';
import {measureFoundation} from './foundationMeasurements';
export function previewFoundationGeneration(before:FoundationEntity[],members:FoundationEntity[],removedIds:string[]=[]){
 const removed=new Set(removedIds),base=before.filter(e=>!removed.has(e.id));
 const old=measureFoundation('preview',before),result=measureFoundation('preview',[...base,...members]);
 const rows=result.rows.filter(r=>members.some(e=>e.id===r.elementId));
 if(!rows.length||rows.some(r=>r.status!=='measured'))throw Error('Generated components have unresolved quantities or overlap');
 for(const r of old.rows)if(r.status==='measured'&&!removed.has(r.elementId)){
  const next=result.rows.find(q=>q.elementId===r.elementId&&q.code===r.code&&q.unit===r.unit);
  if(!next||next.status!=='measured'||Math.abs(next.quantity-r.quantity)>1e-8*Math.max(1,Math.abs(r.quantity)))throw Error('Generation would invalidate or change existing confirmed measurements');
 }
 return result;
}
