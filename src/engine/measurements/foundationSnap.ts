import type {FoundationEntity,Point} from './measurementTypes';
import {foundationPoints,foundationFootprint} from './foundationDrafting';
import {orthogonalWallPerimeter} from "./foundationPerimeterGeometry";
export type FoundationSnap={point:Point;kind:'node'|'edge'};
/** Snap to the nearest visible node first, otherwise nearest segment projection.
 * Include canonical run endpoints and confirmed physical footprint vertices/edges.
 * Ties are resolved by stable coordinates, not array order. */
export function nearestFoundationSnap(raw:Point,entities:FoundationEntity[],tolerance:number):FoundationSnap|null{
 if(!Number.isFinite(tolerance)||tolerance<0)return null;
 let node:Point|null=null,edge:Point|null=null,nd=Infinity,ed=Infinity;
 const distance=(p:Point)=>Math.hypot(p.x-raw.x,p.y-raw.y);
 const preferred=(p:Point,q:Point|null)=>!q||p.x<q.x||p.x===q.x&&p.y<q.y;
 const considerNode=(p:Point)=>{const d=distance(p);if(d<=tolerance&&(d<nd-1e-9||Math.abs(d-nd)<=1e-9&&preferred(p,node))){node=p;nd=d}};
 const considerEdge=(a:Point,b:Point)=>{const dx=b.x-a.x,dy=b.y-a.y,l=dx*dx+dy*dy;if(l<=1e-16)return;const t=Math.max(0,Math.min(1,((raw.x-a.x)*dx+(raw.y-a.y)*dy)/l)),p={x:a.x+t*dx,y:a.y+t*dy},d=distance(p);if(d<=tolerance&&(d<ed-1e-9||Math.abs(d-ed)<=1e-9&&preferred(p,edge))){edge=p;ed=d}};
 for(const e of entities){
  const source=foundationPoints(e),foot=foundationFootprint(e);
  source.forEach(considerNode);
  if('start' in e)considerEdge(e.start,e.end);
  if(foot){foot.forEach(considerNode);foot.forEach((p,i)=>considerEdge(p,foot[(i+1)%foot.length]));}
 }
 return node?{point:node,kind:'node'}:edge?{point:edge,kind:'edge'}:null;
}

/** Find one projected alignment without requiring proximity along the guide. */
export function foundationAlignment(raw:Point,anchors:Point[],tolerance:number,axis?:'x'|'y'){
 let best:{point:Point;anchor:Point;distance:number}|undefined;
 for(const anchor of anchors){
  for(const coordinate of axis?[axis]:['x','y'] as const){
   const distance=Math.abs(raw[coordinate]-anchor[coordinate]);
   if(distance>tolerance)continue;
   const point={...raw,[coordinate]:anchor[coordinate]};
   if(!best||distance<best.distance||distance===best.distance&&(
    point.x<best.point.x||point.x===best.point.x&&(point.y<best.point.y||
     point.y===best.point.y&&(anchor.x<best.anchor.x||anchor.x===best.anchor.x&&anchor.y<best.anchor.y))
   ))best={point,anchor,distance};
  }
 }
 return best;
}

export function foundationInteriorCorners(entities:FoundationEntity[]):Point[]{
 const groups=new Map<string,FoundationEntity[]>();
 for(const entity of entities){
  if(entity.kind!=='foundationWall'||!entity.foundation?.perimeterReference)continue;
  const group=groups.get(entity.assemblyId)??[];
  group.push(entity);
  groups.set(entity.assemblyId,group);
 }
 return [...groups.values()].flatMap(group=>{
  const reference=group[0].foundation!.perimeterReference!;
  if(group.length!==reference.points.length||new Set(group.map(e=>e.foundation?.perimeterReference?.edge)).size!==group.length)return [];
  const signature=(p:typeof reference)=>JSON.stringify([p.points,p.widthFt,p.reference]);
  if(group.some(e=>e.scopeApplicability&&e.scopeApplicability.status!=='included'||signature(e.foundation!.perimeterReference!)!==signature(reference)))return [];
  try{return orthogonalWallPerimeter(reference.points,reference.widthFt,reference.reference).interior}
  catch{return []}
 });
}
