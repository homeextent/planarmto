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

type ReplacementKind='strip'|'envelope'|'drainage';
/** Replacement is restricted to complete matching source groups; no partial or implicit removal.
 * Explicit scope decisions on old members must be resolved separately, not discarded.
 */
export function foundationReplacement(entities:FoundationEntity[],sourceIds:string[],kind:ReplacementKind,enabled:boolean,purpose?:string,layer?:string){
 const selected=new Set(sourceIds);
 const metadata=(e:FoundationEntity)=>kind==='strip'?e.foundation?.stripSource:kind==='envelope'?e.foundation?.envelopeSource:e.foundation?.drainageSource;
 const matches=entities.filter(e=>{
  const s=metadata(e);if(!s)return false;
  if('wallId' in s)return selected.has(s.wallId);
  if('wallIds' in s)return s.wallIds.some(id=>selected.has(id));
  return s.purpose===purpose&&s.layerId===layer&&selected.has(s.sourceId);
 });
 if(!enabled)return {base:entities,removedIds:[] as string[]};
 if(!matches.length)throw Error('No matching derived group to replace');
 const groups=new Set(matches.map(e=>metadata(e)!.groupId));
 const removed=entities.filter(e=>{const s=metadata(e);return !!s&&groups.has(s.groupId)});
 for(const e of removed){
  const s=metadata(e)!;
  const sources='wallId' in s?[s.wallId]:'wallIds' in s?s.wallIds:[s.sourceId,...(s.perimeterWallIds??[])];
  if(sources.some(id=>!selected.has(id)))throw Error('Select all source walls or regions of the existing derived group');
  if(e.scopeApplicability)throw Error('Replacement would discard an explicit applicability decision; resolve manually');
 }
 const removedIds=removed.map(e=>e.id),set=new Set(removedIds);
 return {base:entities.filter(e=>!set.has(e.id)),removedIds};
}
export function applyFoundationGeneration(entities:FoundationEntity[],members:FoundationEntity[],removedIds:string[]=[]):FoundationEntity[]{
 previewFoundationGeneration(entities,members,removedIds);
 return [...entities.filter(e=>!removedIds.includes(e.id)),...members];
}
