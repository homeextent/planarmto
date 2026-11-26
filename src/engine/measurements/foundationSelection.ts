import type {FoundationEntity,Point} from './measurementTypes';
import {foundationFootprint,foundationPoints} from './foundationDrafting';
export function foundationWindowSelection(entities:FoundationEntity[],start:Point,end:Point):string[]{
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
  const footprint=foundationFootprint(e),points=footprint??foundationPoints(e);
  if(start.x<=end.x)return points.every(contains);
  if(points.some(contains))return true;
  if(footprint)return points.some((p,i)=>crosses(p,points[(i+1)%points.length]))||corners.some(p=>insidePolygon(p,points));
  return crosses(points[0],points[1]);
 }).map(e=>e.id);
}

/** Canvas deletion may route to a parent only when the selection is exactly its live children. */
export function foundationDeletionTarget<T extends {id:string;children:{entityId:string}[]}>(parents:readonly T[], ids:readonly string[]){
 const selected=new Set(ids);
 const touched=parents.filter(parent=>parent.children.some(child=>selected.has(child.entityId)));
 if(!touched.length)return {kind:'independent'} as const;
 const parent=touched[0];
 if(touched.length>1||ids.some(id=>!parent.children.some(child=>child.entityId===id)))return {kind:'mixed'} as const;
 return selected.size===parent.children.length?{kind:'complete',parent} as const:{kind:'partial'} as const;
}
