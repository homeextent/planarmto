import type {RoofEntity,Point} from './measurementTypes';
import {validateRoofTopology} from './roofMeasurements';
/** Explicit assembly membership; legacy source labels never imply grouping. */
export function roofAssemblyMembers(entities:RoofEntity[],selectedId:string):string[]{
 const selected=entities.find(e=>e.id===selectedId);
 if(!selected)throw Error('Select an existing roof entity.');
 if((selected.kind!=='roofPlane'&&selected.kind!=='roofEdge')||!selected.roofGroupId)throw Error('No recorded roof assembly. Select the required geometry manually.');
 const groupId=selected.roofGroupId;
 return entities.filter(e=>(e.kind==='roofPlane'||e.kind==='roofEdge')&&e.roofGroupId===groupId).map(e=>e.id);
}
export type RoofDeletionPlan={selectedIds:string[];dependentIds:string[];removed:RoofEntity[];remaining:RoofEntity[]};
/** Pure deletion preview. Shared edges are removed, never their unselected parent planes. */
export function planRoofDeletion(entities:RoofEntity[],selectedIds:string[]):RoofDeletionPlan{
 validateRoofTopology(entities);
 const selected=new Set(selectedIds);
 if(!selected.size||selected.size!==selectedIds.length||selectedIds.some(id=>!entities.some(e=>e.id===id)))throw Error('Select distinct existing roof entities.');
 const removal=new Set(selected);
 for(const e of entities){
  if(e.kind==='roofEdge'&&e.planeIds.some(id=>selected.has(id)))removal.add(e.id);
  if(e.kind==='roofOpening'&&selected.has(e.planeId))removal.add(e.id);
 }
 const derivedGroups=new Set<string>();
 for(const e of entities)if(e.kind==='roofSurface'&&e.derivation&&(removal.has(e.id)||e.derivation.planeIds.some(id=>removal.has(id))||e.derivation.edgeIds.some(id=>removal.has(id))))derivedGroups.add(e.derivation.groupId);
 for(const e of entities)if(e.kind==='roofSurface'&&e.derivation&&derivedGroups.has(e.derivation.groupId))removal.add(e.id);
 const remaining=entities.filter(e=>!removal.has(e.id));
 validateRoofTopology(remaining);
 return {selectedIds:[...selected],dependentIds:entities.filter(e=>removal.has(e.id)&&!selected.has(e.id)).map(e=>e.id),removed:entities.filter(e=>removal.has(e.id)),remaining};
}
/** World-coordinate CAD window/crossing selection. Touching counts as crossing. */
export function roofWindowSelection(entities:RoofEntity[],start:Point,end:Point):string[]{
 if(![start.x,start.y,end.x,end.y].every(Number.isFinite))throw Error('Invalid selection rectangle.');
 const xmin=Math.min(start.x,end.x),xmax=Math.max(start.x,end.x),ymin=Math.min(start.y,end.y),ymax=Math.max(start.y,end.y);
 const contains=(p:Point)=>p.x>=xmin&&p.x<=xmax&&p.y>=ymin&&p.y<=ymax;
 const corners=[{x:xmin,y:ymin},{x:xmax,y:ymin},{x:xmax,y:ymax},{x:xmin,y:ymax}];
 // Liang-Barsky segment clipping, including boundary contact.
 const crosses=(a:Point,b:Point)=>{
  let lo=0,hi=1;
  for(const [p,q] of [[a.x-b.x,a.x-xmin],[b.x-a.x,xmax-a.x],[a.y-b.y,a.y-ymin],[b.y-a.y,ymax-a.y]]){
   if(p===0){if(q<0)return false;continue;}
   const t=q/p;if(p<0)lo=Math.max(lo,t);else hi=Math.min(hi,t);
   if(lo>hi)return false;
  }
  return true;
 };
 const insidePolygon=(p:Point,poly:Point[])=>{
  let inside=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){
   const a=poly[i],b=poly[j];
   if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;
  }
  return inside;
 };
 return entities.filter(e=>{
  const points='polygon' in e?e.polygon:[e.start,e.end];
  if(start.x<=end.x)return points.every(contains);
  if(points.some(contains))return true;
  if('polygon' in e)return points.some((p,i)=>crosses(p,points[(i+1)%points.length]))||corners.some(p=>insidePolygon(p,points));
  return crosses(e.start,e.end);
 }).map(e=>e.id);
}
