import type {Point,RoofEntity} from './measurementTypes';
import {validateRoofTopology} from './roofMeasurements';
export const roofPoints=(e:RoofEntity):Point[]=>'polygon' in e?e.polygon:[e.start,e.end];
export const segmentDistance=(p:Point,a:Point,b:Point)=>{
 const dx=b.x-a.x,dy=b.y-a.y,l=dx*dx+dy*dy;
 const t=l?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/l)):0;
 const q={x:a.x+t*dx,y:a.y+t*dy};return {point:q,distance:Math.hypot(p.x-q.x,p.y-q.y)};
};
const segments=(p:Point[])=>p.map((a,i)=>[a,p[(i+1)%p.length]] as const);
export function snapRoofPoint(p:Point,entities:RoofEntity[],tolerance:number,grid:number|null):Point {
 let best:Point|null=null,d=tolerance;
 for(const e of entities)for(const q of roofPoints(e)){const n=Math.hypot(p.x-q.x,p.y-q.y);if(n<=d){d=n;best=q}}
 if(best)return {...best};
 for(const e of entities)for(const [a,b] of ('polygon' in e?segments(e.polygon):[[e.start,e.end]])){const q=segmentDistance(p,a,b);if(q.distance<=d){d=q.distance;best=q.point}}
 return best?{...best}:grid&&grid>0?{x:Math.round(p.x/grid)*grid,y:Math.round(p.y/grid)*grid}:p;
}
export function boundaryAt(p:Point,entities:RoofEntity[],tolerance:number){
 let best:{start:Point;end:Point;distance:number}|undefined;
 for(const e of entities)if(e.kind==='roofPlane')for(const [a,b] of segments(e.polygon)){
  const d=segmentDistance(p,a,b).distance;
  if(d<=tolerance&&(!best||d<best.distance))best={start:a,end:b,distance:d};
 }
 if(!best)return null;
 const {start,end}=best;
 const planeIds=entities.filter(e=>e.kind==='roofPlane'&&segments(e.polygon).some(([a,b])=>segmentDistance(start,a,b).distance<1e-6&&segmentDistance(end,a,b).distance<1e-6)).map(e=>e.id);
 return {start:{...start},end:{...end},planeIds};
}
export function moveRoofVertex(entities:RoofEntity[],id:string,index:number,next:Point):RoofEntity[]{
 const e=entities.find(e=>e.id===id);if(!e||!('polygon' in e)||!e.polygon[index])throw Error('Select a polygon vertex');
 const p=e.polygon[index],same=(q:Point)=>Math.hypot(p.x-q.x,p.y-q.y)<1e-6;
 const moved=entities.map(q=>{
  if(q.id===id&&'polygon' in q)return {...q,polygon:q.polygon.map((v,i)=>i===index?next:v)};
  if(e.kind==='roofPlane'&&q.kind==='roofEdge'&&q.planeIds.includes(id))return {...q,start:same(q.start)?next:q.start,end:same(q.end)?next:q.end};
  return q;
 });
 validateRoofTopology(moved);return moved;
}
