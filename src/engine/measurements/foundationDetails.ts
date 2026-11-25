/** Bounded parent-owned foundation detail contracts. All lengths in feet.
 * Rectangular slab deductions and thickening contained by an orthogonal parent.
 */
import type {FoundationEntity} from './measurementTypes';
import {simplePolygon} from './roofMeasurements';
import {rectangleBounds,orthogonalPolygonPieces,type Bounds} from './foundationGeometry';
const area=(b:Bounds)=>(b.xmax-b.xmin)*(b.ymax-b.ymin);
const intersection=(a:Bounds,b:Bounds)=>Math.max(0,Math.min(a.xmax,b.xmax)-Math.max(a.xmin,b.xmin))*Math.max(0,Math.min(a.ymax,b.ymax)-Math.max(a.ymin,b.ymin));
export function foundationDetails(e:FoundationEntity):{deductionCF:number|null;additionalCF:number|null;hasDetails:boolean} {
 const f=e.foundation;
 const wall=f?.wallOpenings??[], openings=f?.slabOpenings??[], thick=f?.slabThickenings??[];
 const hasDetails=wall.length+openings.length+thick.length>0;
 if(!hasDetails)return {deductionCF:0,additionalCF:0,hasDetails};
 if('start' in e&&e.kind==='foundationWall'){
  const length=Math.hypot(e.end.x-e.start.x,e.end.y-e.start.y);
  for(const [i,o] of wall.entries()){
   if(o.offsetFt+o.widthFt>length||e.heightFt!==null&&o.sillFt+o.heightFt>e.heightFt)throw Error('Wall opening outside parent: '+o.id);
   // No corner-touching deductions: keep openings strictly inside the canonical run.
   if(o.offsetFt<=0||o.offsetFt+o.widthFt>=length)throw Error('Wall opening touches wall junction/end: '+o.id);
   for(const q of wall.slice(i+1))if(Math.min(o.offsetFt+o.widthFt,q.offsetFt+q.widthFt)>Math.max(o.offsetFt,q.offsetFt)&&Math.min(o.sillFt+o.heightFt,q.sillFt+q.heightFt)>Math.max(o.sillFt,q.sillFt))throw Error('Overlapping wall openings');
  }
  return {deductionCF:e.widthFt===null||e.heightFt===null?null:wall.reduce((n,o)=>n+o.widthFt*o.heightFt*e.widthFt!,0),additionalCF:0,hasDetails};
 }
 if('polygon' in e&&e.kind==='slab'){
  if(!simplePolygon(e.polygon))throw Error('Invalid slab polygon');
  const parent=orthogonalPolygonPieces(e.polygon);
  const zones=[...openings.map(o=>({id:o.id,b:rectangleBounds(o.polygon)})),...thick.map(o=>({id:o.id,b:rectangleBounds(o.polygon)}))];
  for(const [i,z] of zones.entries()){
   const a=area(z.b),inside=parent.reduce((n,p)=>n+intersection(p,z.b),0);
   if(Math.abs(inside-a)>1e-8*Math.max(1,a))throw Error('Slab detail outside parent: '+z.id);
   for(const q of zones.slice(i+1))if(intersection(z.b,q.b)>0)throw Error('Overlapping slab details');
  }
  if(openings.reduce((n,o)=>n+area(rectangleBounds(o.polygon)),0)>=parent.reduce((n,p)=>n+area(p),0))throw Error('Openings consume slab');
  if(e.depthFt!==null&&thick.some(o=>o.basis==='total'&&o.depthFt<=e.depthFt!))throw Error('Total thickening must exceed base slab depth');
  return {deductionCF:e.depthFt===null?null:openings.reduce((n,o)=>n+area(rectangleBounds(o.polygon))*e.depthFt!,0),additionalCF:e.depthFt===null?null:thick.reduce((n,o)=>n+area(rectangleBounds(o.polygon))*(o.basis==='total'?o.depthFt-e.depthFt!:o.depthFt),0),hasDetails};
 }
 throw Error('Unsupported foundation detail parent');
}
