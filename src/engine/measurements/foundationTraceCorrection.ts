import type { AssemblyTrace, TraceCorrectionAudit } from './foundationAssemblyModel';
import type { Point } from './measurementTypes';
import {simplePolygon} from './roofMeasurements';
import { offsetOrthogonalPerimeter } from './foundationPerimeterGeometry';

function validate(trace:AssemblyTrace){
  const points=trace.vertices.map(v=>v.point);
  if(trace.kind==='slab'){if(!simplePolygon(points))throw Error('The corrected slab must have a simple closed footprint.');}
  else offsetOrthogonalPerimeter(points,0);
  return trace;
}

/** Move a corner and its two incident axis-aligned edges; refuse any resulting topology change. */
export function moveFoundationTraceVertex(trace:AssemblyTrace,index:number,point:Point):AssemblyTrace {
  const n=trace.vertices.length;
  const vertex=trace.vertices[index];
  if(!vertex||!Number.isFinite(point.x)||!Number.isFinite(point.y))throw Error('Choose a valid trace vertex and position.');
  const vertices=trace.vertices.map(v=>({...v,point:{...v.point}}));
  const orthogonal=trace.vertices.every((v,i)=>{
    const next=trace.vertices[(i+1)%n].point;
    return (v.point.x===next.x)!==(v.point.y===next.y);
  });
  if(trace.kind==='slab'&&!orthogonal){
    vertices[index].point=point;
    return validate({...trace,vertices});
  }
  for(const near of [(index+n-1)%n,(index+1)%n]){
    const neighbour=vertices[near].point;
    if(neighbour.x===vertex.point.x)neighbour.x=point.x;
    else if(neighbour.y===vertex.point.y)neighbour.y=point.y;
    else throw Error('Only orthogonal perimeter edges can be corrected.');
  }
  vertices[index].point=point;
  return validate({...trace,vertices});
}

/** Replace one edge with a bounded orthogonal inset or projection. */
export function addFoundationTraceNotch(trace:AssemblyTrace,index:number,startFt:number,widthFt:number,depthFt:number,id:()=>string):
  {trace:AssemblyTrace;segments:TraceCorrectionAudit['segments']}{
  const edge=trace.segments[index],a=trace.vertices[index]?.point,b=trace.vertices[(index+1)%trace.vertices.length]?.point;
  if(!edge||!a||!b)throw Error('Select a trace edge.');
  const length=Math.hypot(b.x-a.x,b.y-a.y);
  if(![startFt,widthFt,depthFt].every(Number.isFinite)||startFt<=0||widthFt<=0||startFt+widthFt>=length||depthFt===0)
    throw Error('Place the correction within the selected edge with a positive width and signed nonzero depth.');
  const x=(b.x-a.x)/length,y=(b.y-a.y)/length;
  const point=(distance:number,offset:number)=>({x:a.x+x*distance-y*offset,y:a.y+y*distance+x*offset});
  const inserted=[point(startFt,0),point(startFt,depthFt),point(startFt+widthFt,depthFt),point(startFt+widthFt,0)]
    .map(point=>({id:id(),point}));
  const path=[edge.startVertexId,...inserted.map(v=>v.id),edge.endVertexId];
  const replacement=path.slice(0,-1).map((startVertexId,i)=>({id:id(),startVertexId,endVertexId:path[i+1]}));
  const corrected=validate({...trace,kind:'orthogonal',
    vertices:[...trace.vertices.slice(0,index+1),...inserted,...trace.vertices.slice(index+1)],
    segments:[...trace.segments.slice(0,index),...replacement,...trace.segments.slice(index+1)],
  });
  return {trace:corrected,segments:[{retiredId:edge.id,successorIds:replacement.map(s=>s.id)}]};
}
