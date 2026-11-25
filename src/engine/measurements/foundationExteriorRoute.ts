import type {FoundationEntity,Point} from './measurementTypes';
import {orthogonalWallPerimeter,offsetOrthogonalPerimeter} from './foundationPerimeterGeometry';
const near=(a:number,b:number)=>Math.abs(a-b)<1e-8;
const same=(a:Point,b:Point)=>near(a.x,b.x)&&near(a.y,b.y);
/** Recover the exact simple orthogonal centreline loop from a complete, uniform wall assembly.
 * Each edge retains its source ID; repeated parallel faces cannot be matched by coordinate alone.
 */
export function orthogonalExteriorEdges(entities:FoundationEntity[],ids:string[],offsetFt=0){
 if(ids.length<4||ids.length>64||new Set(ids).size!==ids.length||!Number.isFinite(offsetFt)||offsetFt<0)throw Error('Select a complete orthogonal perimeter and nonnegative offset');
 const walls=ids.map(id=>{const e=entities.find(q=>q.id===id);if(!e||e.kind!=='foundationWall'||!e.foundation?.centrelineConfirmed||e.widthFt===null||e.foundation.material!=='poured concrete')throw Error('Confirm all source wall centrelines and widths');return e});
 const w=walls[0].widthFt!;
 if(walls.some(e=>e.assemblyId!==walls[0].assemblyId||!near(e.widthFt!,w)||!near(e.foundation!.joinStartFt??0,w/2)||!near(e.foundation!.joinEndFt??0,w/2)))throw Error('Require one complete uniform orthogonal wall assembly with reconciled corners');
 if(entities.filter(e=>e.kind==='foundationWall'&&e.assemblyId===walls[0].assemblyId).length!==walls.length)throw Error('Select complete wall assembly');
 // Deterministic start and orientation independent of selection order.
 const first=[...walls].sort((a,b)=>a.id.localeCompare(b.id))[0];
 const vertices:Point[]=[first.start],ordered=[first],remaining=walls.filter(e=>e!==first);
 let end=first.end;
 while(remaining.length){
  if(same(end,vertices[0]))throw Error('Source assembly contains multiple loops');
  const matches=remaining.filter(e=>same(e.start,end)||same(e.end,end));
  if(matches.length!==1)throw Error('Source assembly must be one unbranched closed perimeter');
  const e=matches[0];vertices.push(end);ordered.push(e);remaining.splice(remaining.indexOf(e),1);end=same(e.start,end)?e.end:e.start;
 }
 if(!same(end,vertices[0]))throw Error('Source perimeter is not closed');
 // The ring validator also refuses redundant, nonorthogonal, collapsed and self-intersecting paths.
 const ring=orthogonalWallPerimeter(vertices,w,'centreline');
 const p=offsetFt===0?ring.exterior:offsetOrthogonalPerimeter(ring.exterior,offsetFt);
 return p.map((start,i)=>({sourceId:ordered[i].id,start,end:p[(i+1)%p.length]}));
}
