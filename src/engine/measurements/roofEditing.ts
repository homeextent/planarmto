import {resizeRectangle} from '../precisionDrafting';
import type {Point,RoofEntity} from './measurementTypes';
import {validateRoofTopology,boundaryIntervals,roofBoundaryOwners,verticalChange} from './roofMeasurements';
export const roofPoints=(e:RoofEntity):Point[]=>'polygon' in e?e.polygon:[e.start,e.end];
export const segmentDistance=(p:Point,a:Point,b:Point)=>{
 const dx=b.x-a.x,dy=b.y-a.y,l=dx*dx+dy*dy;
 const t=l?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/l)):0;
 const q={x:a.x+t*dx,y:a.y+t*dy};return {point:q,distance:Math.hypot(p.x-q.x,p.y-q.y)};
};
const segments=(p:Point[])=>p.map((a,i)=>[a,p[(i+1)%p.length]] as const);
export type RoofSnap={point:Point;type:'node'|'edge'|'grid'|'free'};
export function roofSnap(p:Point,entities:RoofEntity[],tolerance:number,grid:number|null,locked?:RoofSnap|null,breakout=tolerance*2,eligible:(q:Point)=>boolean=()=>true):RoofSnap {
 if(locked&&locked.type==='node'&&eligible(locked.point)&&Math.hypot(p.x-locked.point.x,p.y-locked.point.y)<=breakout)return locked;
 let best:Point|null=null,d=tolerance;
 for(const e of entities)for(const q of roofPoints(e)){const n=Math.hypot(p.x-q.x,p.y-q.y);if(eligible(q)&&n<=d){d=n;best=q}}
 if(best)return {point:{...best},type:'node'};
 for(const e of entities)for(const [a,b] of ('polygon' in e?segments(e.polygon):[[e.start,e.end]])){const q=segmentDistance(p,a,b);if(eligible(q.point)&&q.distance<=d){d=q.distance;best=q.point}}
 if(best)return {point:{...best},type:'edge'};
 return grid&&grid>0?{point:{x:Math.round(p.x/grid)*grid,y:Math.round(p.y/grid)*grid},type:'grid'}:{point:p,type:'free'};
}
export function snapRoofPoint(p:Point,entities:RoofEntity[],tolerance:number,grid:number|null):Point {
 return roofSnap(p,entities,tolerance,grid).point;
}
export function boundaryAt(p:Point,entities:RoofEntity[],tolerance:number){
 let best:{start:Point;end:Point;distance:number}|undefined;
 for(const e of entities)if(e.kind==='roofPlane')for(const [a,b] of segments(e.polygon)){
  const d=segmentDistance(p,a,b).distance;
  if(d<=tolerance&&(!best||d<best.distance))best={start:a,end:b,distance:d};
 }
 if(!best)return null;
 const {start,end}=best;
 const planes=entities.filter((e):e is Extract<RoofEntity,{kind:'roofPlane'}>=>e.kind==='roofPlane');
 const ts=boundaryIntervals(start,end,planes.map(e=>e.polygon));
 const dx=end.x-start.x,dy=end.y-start.y;
 const t=Math.max(0,Math.min(1,((p.x-start.x)*dx+(p.y-start.y)*dy)/(dx*dx+dy*dy)));
 const i=Math.max(0,Math.min(ts.length-2,ts.findIndex((v,j)=>j>0&&v>=t)-1));
 const point=(t:number)=>({x:start.x+dx*t,y:start.y+dy*t});
 const a=point(ts[i]),b=point(ts[i+1]);
 return {start:a,end:b,planeIds:roofBoundaryOwners(a,b,planes)};
}
export function moveRoofVertex(entities:RoofEntity[],id:string,index:number,next:Point):RoofEntity[]{
 const e=entities.find(e=>e.id===id);if(!e||!('polygon' in e)||!e.polygon[index])throw Error('Select a polygon vertex');
 if(e.kind==='roofSurface'&&e.derivation)throw Error('Derived surfaces must be revised through their complete derivation group.');
 const p=e.polygon[index],same=(q:Point)=>Math.hypot(p.x-q.x,p.y-q.y)<1e-6;
 const moved=entities.map(q=>{
  if(q.id===id&&'polygon' in q){const polygon=q.polygon.map((v,i)=>i===index?next:v);if(q.kind==='roofPlane'&&index===0&&q.elevationFt!==null){const dz=verticalChange(p,next,q.pitchRise,q.slopeDegrees);if(dz===null)throw Error('Specify slope before moving the elevation reference vertex.');return {...q,polygon,elevationFt:q.elevationFt+dz};}return {...q,polygon};}
  if(e.kind==='roofPlane'&&q.kind==='roofEdge'&&q.planeIds.includes(id))return {...q,start:same(q.start)?next:q.start,end:same(q.end)?next:q.end};
  return q;
 });
 validateRoofTopology(moved);return moved;
}

export function resizeRoofRectangle(entities:RoofEntity[],id:string,width:number,depth:number):RoofEntity[]{
 const e=entities.find(q=>q.id===id);
 if(!e||!('polygon' in e))throw Error('Select a rectangular roof area.');
 if(e.kind==='roofSurface'&&e.derivation)throw Error('Derived surfaces must be revised through their complete derivation group.');
 if(e.kind==='roofPlane'&&entities.some(q=>(q.kind==='roofEdge'&&q.planeIds.includes(id))||(q.kind==='roofOpening'&&q.planeId===id)))throw Error('Remove dependent edges/openings before resizing a roof plane.');
 const polygon=resizeRectangle(e.polygon,width,depth);
 const next=entities.map(q=>q.id===id?{...e,polygon}:q);
 validateRoofTopology(next);return next;
}
