import type {FoundationEntity,Point} from './measurementTypes';
import {foundationPoints,foundationFootprint} from './foundationDrafting';
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
