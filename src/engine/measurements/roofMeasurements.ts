import {validateDerivedRoofSurfaces} from './roofDerivation';
import type {Point,RoofEntity,QuantityContribution,Applicability} from './measurementTypes';
import {validateSpecialistEntities,validateContributionSet} from './measurementTypes';
type Plane=Extract<RoofEntity,{kind:'roofPlane'}>;
type Edge=Extract<RoofEntity,{kind:'roofEdge'}>;
const EPS=1e-6;
const dist=(a:Point,b:Point)=>Math.hypot(b.x-a.x,b.y-a.y);
const cross=(a:Point,b:Point,c:Point)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
const on=(p:Point,a:Point,b:Point)=>Math.abs(cross(a,b,p))<=EPS*Math.max(1,dist(a,b))&&p.x>=Math.min(a.x,b.x)-EPS&&p.x<=Math.max(a.x,b.x)+EPS&&p.y>=Math.min(a.y,b.y)-EPS&&p.y<=Math.max(a.y,b.y)+EPS;
const segments=(p:Point[])=>p.map((a,i)=>[a,p[(i+1)%p.length]] as [Point,Point]);
const proper=(a:Point,b:Point,c:Point,d:Point)=>cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0&&![on(a,c,d),on(b,c,d),on(c,a,b),on(d,a,b)].some(Boolean);
const intersects=(a:Point,b:Point,c:Point,d:Point)=>proper(a,b,c,d)||on(a,c,d)||on(b,c,d)||on(c,a,b)||on(d,a,b);
export function projectedArea(p:Point[]):number {
 if(p.length<3)return 0;
 const o=p[0];return Math.abs(p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+(a.x-o.x)*(b.y-o.y)-(a.y-o.y)*(b.x-o.x)},0))/2;
}
export const slopeFactor=(pitch:number)=>Math.hypot(1,pitch/12);
export function simplePolygon(p:Point[]):boolean {
 if(p.length<3||new Set(p.map(q=>JSON.stringify([q.x,q.y]))).size!==p.length||p.some(a=>!Number.isFinite(a.x)||!Number.isFinite(a.y))||projectedArea(p)<=EPS)return false;
 const e=segments(p);
 if(e.some(([a,b],i)=>{const c=p[(i+2)%p.length];return on(c,a,b)||on(a,b,c)}))return false;
 return e.every(([a,b],i)=>dist(a,b)>EPS&&e.every(([c,d],j)=>i===j||Math.abs(i-j)===1||Math.abs(i-j)===e.length-1||!intersects(a,b,c,d)));
}
/** Draft diagnostics use the same predicates as committed topology validation. */
export function polygonDraftError(p:Point[]):string|null {
 if(p.length<3)return 'Add at least three distinct vertices.';
 if(p.some(q=>!Number.isFinite(q.x)||!Number.isFinite(q.y)))return 'Polygon contains an invalid coordinate.';
 for(let i=0;i<p.length;i++)for(let j=i+1;j<p.length;j++)if(dist(p[i],p[j])<=EPS)return 'Vertices '+(i+1)+' and '+(j+1)+' coincide. Remove the repeated point.';
 const e=segments(p);
 for(let i=0;i<e.length;i++){
  const [a,b]=e[i],c=p[(i+2)%p.length];
  if(on(c,a,b)||on(a,b,c))return 'Edge '+(i+1)+' backtracks over an adjacent edge.';
  for(let j=i+1;j<e.length;j++)if(j!==i+1&&!(i===0&&j===e.length-1)&&intersects(a,b,e[j][0],e[j][1]))return (j===e.length-1?'Closing edge':'Edge '+(j+1))+' crosses or touches edge '+(i+1)+'. Adjust the draft.';
 }
 if(projectedArea(p)<=EPS)return 'Polygon has no measurable enclosed area.';
 return simplePolygon(p)?null:'Polygon is not a valid simple enclosed area.';
}
function inside(p:Point,poly:Point[],boundary=true):boolean {
 if(segments(poly).some(([a,b])=>on(p,a,b)))return boundary;
 let hit=false;for(const [a,b] of segments(poly))if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)hit=!hit;return hit;
}
// Partition a segment at every boundary intersection, including collinear endpoints.
// Test every open interval rather than a single midpoint (concave boundaries can cross repeatedly).
export function boundaryIntervals(a:Point,b:Point,polygons:Point[][]):number[]{
 const dx=b.x-a.x,dy=b.y-a.y,l=dx*dx+dy*dy;
 if(l<=EPS*EPS)return [0,1];
 const values=[0,1],add=(t:number)=>{if(t>0&&t<1)values.push(t)};
 for(const poly of polygons)for(const [c,d] of segments(poly)){
  const ux=d.x-c.x,uy=d.y-c.y,det=dx*uy-dy*ux;
  if(Math.abs(det)>EPS*Math.sqrt(l)*Math.hypot(ux,uy)){
   const t=((c.x-a.x)*uy-(c.y-a.y)*ux)/det;
   const u=((c.x-a.x)*dy-(c.y-a.y)*dx)/det;
   if(u>=-EPS&&u<=1+EPS)add(t);
  }else for(const p of [c,d])if(on(p,a,b))add(((p.x-a.x)*dx+(p.y-a.y)*dy)/l);
 }
 return values.sort((a,b)=>a-b).filter((t,i,v)=>!i||t-v[i-1]>1e-10);
}
const interpolate=(a:Point,b:Point,t:number)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
function samples(a:Point,b:Point,polys:Point[][]):Point[]{
 const t=boundaryIntervals(a,b,polys);return t.slice(1).map((x,i)=>interpolate(a,b,(x+t[i])/2));
}
function contained(inner:Point[],outer:Point[]):boolean {
 return inner.every(p=>inside(p,outer))&&segments(inner).every(([a,b])=>samples(a,b,[outer]).every(p=>inside(p,outer)));
}
function overlap(a:Point[],b:Point[]):boolean {
 return contained(a,b)||contained(b,a)||a.some(p=>inside(p,b,false))||b.some(p=>inside(p,a,false))||segments(a).some(([p,q])=>samples(p,q,[b]).some(r=>inside(r,b,false)))||segments(b).some(([p,q])=>samples(p,q,[a]).some(r=>inside(r,a,false)));
}
export function roofBoundaryOwners(a:Point,b:Point,planes:Plane[]):string[]{
 return planes.filter(p=>segments(p.polygon).some(([c,d])=>on(a,c,d)&&on(b,c,d))).map(p=>p.id);
}
function sameRun(a:Edge,b:Edge):boolean {
 if(Math.abs(cross(a.start,a.end,b.start))>EPS*dist(a.start,a.end)||Math.abs(cross(a.start,a.end,b.end))>EPS*dist(a.start,a.end))return false;
 const dx=a.end.x-a.start.x,dy=a.end.y-a.start.y,L=dist(a.start,a.end);
 const t=(p:Point)=>((p.x-a.start.x)*dx+(p.y-a.start.y)*dy)/L;
 return Math.min(L,Math.max(t(b.start),t(b.end)))-Math.max(0,Math.min(t(b.start),t(b.end)))>EPS;
}
export function verticalChange(a:Point,b:Point,pitch:number|null,direction:number|null):number|null {
 if(pitch===null)return null;if(pitch===0)return 0;if(direction===null)return null;
 const t=direction*Math.PI/180;return -pitch/12*((b.x-a.x)*Math.cos(t)+(b.y-a.y)*Math.sin(t));
}
export function edgeLength(a:Point,b:Point,pitch:number|null,direction:number|null):number|null {
 const dz=verticalChange(a,b,pitch,direction);return dz===null?null:Math.hypot(dist(a,b),dz);
}
export function validateRoofTopology(entities:RoofEntity[]):void {
 validateSpecialistEntities('roof',entities);
 const planes=entities.filter((e):e is Plane=>e.kind==='roofPlane');
 const edges=entities.filter((e):e is Edge=>e.kind==='roofEdge');
 const openings=entities.filter(e=>e.kind==='roofOpening');
 const surfaces=entities.filter(e=>e.kind==='roofSurface');
 for(const [i,p] of surfaces.entries())for(const q of surfaces.slice(i+1))if(p.purpose===q.purpose&&overlap(p.polygon,q.polygon))throw Error('Overlapping same-purpose roof surfaces require reconciliation');
 for(const e of entities)if('polygon' in e&&!simplePolygon(e.polygon))throw Error('Invalid roof polygon: '+e.id);
 for(const [i,p] of planes.entries())for(const q of planes.slice(i+1))if(overlap(p.polygon,q.polygon))throw Error('Overlapping roof planes require reconciliation: '+p.id+' / '+q.id);
 for(const [i,o] of openings.entries()){
  const p=planes.find(p=>p.id===o.planeId)!;
  if(projectedArea(o.polygon)>=projectedArea(p.polygon)-EPS)throw Error('Opening cannot consume entire roof plane');
  if(!contained(o.polygon,p.polygon))throw Error('Opening outside parent plane: '+o.id);
  for(const q of openings.slice(i+1))if(q.planeId===o.planeId&&overlap(o.polygon,q.polygon))throw Error('Overlapping roof openings');
 }
 for(const [i,e] of edges.entries()){
  if(edges.slice(i+1).some(q=>sameRun(e,q)))throw Error('Duplicate or overlapping roof edge');
  const parents=e.planeIds.map(id=>planes.find(p=>p.id===id)!);
  if(!parents.every(p=>segments(p.polygon).some(([a,b])=>on(e.start,a,b)&&on(e.end,a,b))))throw Error('Edge must follow a parent plane boundary');
  const ts=boundaryIntervals(e.start,e.end,planes.map(p=>p.polygon));
  for(let j=1;j<ts.length;j++){const owners=roofBoundaryOwners(interpolate(e.start,e.end,ts[j-1]),interpolate(e.start,e.end,ts[j]),planes);if(owners.length!==e.planeIds.length||owners.some(id=>!e.planeIds.includes(id)))throw Error('Edge ownership changes along boundary; split or reconcile edge');}
  if(['ridge','hip','valley'].includes(e.edgeType)&&parents.length!==2)throw Error('Shared edge requires two planes');
  if(['eave','rake','abutment','parapet'].includes(e.edgeType)&&parents.length!==1)throw Error('Exterior edge requires one plane');
  if(parents.length===2){
   const [p,q]=parents,dp=verticalChange(e.start,e.end,p.pitchRise,p.slopeDegrees),dq=verticalChange(e.start,e.end,q.pitchRise,q.slopeDegrees);
   if(dp!==null&&dq!==null&&Math.abs(dp-dq)>EPS)throw Error('Incompatible shared edge slopes');
   const zp=verticalChange(p.polygon[0],e.start,p.pitchRise,p.slopeDegrees),zq=verticalChange(q.polygon[0],e.start,q.pitchRise,q.slopeDegrees);
   if(zp!==null&&zq!==null&&p.elevationFt!==null&&q.elevationFt!==null&&Math.abs(p.elevationFt+zp-q.elevationFt-zq)>EPS)throw Error('Incompatible shared edge elevations');
  }
 }
 validateDerivedRoofSurfaces(entities);
}
export function measureRoof(workspaceId:string,entities:RoofEntity[]):{rows:QuantityContribution[];warnings:string[]} {
 validateRoofTopology(entities);
 const rows:QuantityContribution[]=[],warnings:string[]=[];
 const add=(e:RoofEntity,code:string,unit:QuantityContribution['unit'],basis:string,value:number|null,reason='Missing required measurement input')=>{
  const base={workspaceId,elementId:e.id,physicalId:e.physicalId,assemblyId:e.assemblyId,source:e.source,code,unit,basis};
  rows.push(value===null?{...base,status:'unquantified',reason}:{...base,status:'measured',quantity:value});
 };
 const planes=entities.filter((e):e is Plane=>e.kind==='roofPlane');
 const edges=entities.filter((e):e is Edge=>e.kind==='roofEdge');
 for(const p of planes){if(segments(p.polygon).some(([a,b])=>{const ts=boundaryIntervals(a,b,planes.map(q=>q.polygon).concat(edges.map(e=>[e.start,e.end])));return ts.slice(1).some((t,i)=>{const x=interpolate(a,b,ts[i]),y=interpolate(a,b,t);return !edges.some(e=>e.planeIds.includes(p.id)&&e.edgeType!=='unclassified'&&on(x,e.start,e.end)&&on(y,e.start,e.end))})}))warnings.push('Plane '+p.id+': boundary classification incomplete');}
 for(const e of entities){
  if(e.kind==='roofPlane'){
   const area=projectedArea(e.polygon),f=e.pitchRise===null?null:slopeFactor(e.pitchRise);
   const openings=entities.filter(o=>o.kind==='roofOpening'&&o.planeId===e.id);
   const unknown=openings.some(o=>o.kind==='roofOpening'&&(!o.deduction||o.deduction==='unspecified'));
   const deduct=openings.reduce((n,o)=>n+(o.kind==='roofOpening'&&o.deduction==='included'?projectedArea(o.polygon):0),0);
   add(e,'roof.projected','SF','gross projected polygon',area);
   add(e,'roof.gross','SF','gross sloped polygon',f===null?null:area*f);
   add(e,'roof.opening.projected','SF','all geometric openings',openings.reduce((n,o)=>n+(o.kind==='roofOpening'?projectedArea(o.polygon):0),0));
   add(e,'roof.deduction','SF','included sloped openings',unknown||f===null?null:deduct*f,'Pitch or opening treatment missing');
   add(e,'roof.covering','SF','net sloped polygon',unknown||f===null?null:(area-deduct)*f,'Pitch or opening treatment missing');
   if(e.pitchRise!==null&&e.pitchRise>0&&e.slopeDegrees===null)warnings.push('Plane '+e.id+': slope direction unspecified');
   if(e.pitchRise===null)warnings.push('Plane '+e.id+': pitch unspecified');
   if(unknown)warnings.push('Plane '+e.id+': opening treatment unspecified');
  }else if(e.kind==='roofEdge'){
   const p=planes.find(p=>p.id===e.planeIds[0])!;
   let len=edgeLength(e.start,e.end,p.pitchRise,p.slopeDegrees);
   if(e.planeIds.length===2){
    const q=planes.find(p=>p.id===e.planeIds[1])!;
    if(edgeLength(e.start,e.end,q.pitchRise,q.slopeDegrees)===null)len=null;
    if(p.elevationFt===null||q.elevationFt===null||len===null)warnings.push('Edge '+e.id+': junction elevation not verified');
   }
   add(e,'roof.edge.'+e.edgeType,'LF','actual classified edge',e.edgeType==='unclassified'?null:len);
   for(const [key,code] of [['fascia','roof.fascia'],['gutter','roof.gutter'],['soffit','roof.soffit.run']] as const){
    const a=e.applicability?.[key];if(a==='excluded'){warnings.push('Edge '+e.id+': '+key+' explicitly excluded');continue;}
    add(e,code,'LF','explicit edge assembly',a==='included'&&e.edgeType!=='unclassified'?len:null,'Applicability, classification or slope missing');
   }
  }else if(e.kind==='roofSurface'){
   const area=e.surfaceBasis===undefined||e.pitchRise===null?null:projectedArea(e.polygon)*slopeFactor(e.pitchRise);
   if(e.purpose==='soffit')add(e,'roof.soffit.area','SF','explicit soffit surface',e.derivation?.pendingApplicability?null:area,e.derivation?.pendingApplicability?'Soffit applicability unspecified':'Surface basis or pitch missing');
   else {
    const code='roof.insulation.'+(e.surfaceBasis||'unspecified');
    add(e,code,'SF','explicit insulation surface',e.insulationType?area:null,'Surface basis, pitch or insulation type missing');
    if(e.insulationType?.includes('foam'))add(e,code+'.volume','BF','actual surface × depth inches',area===null||!e.depthFt?null:area*e.depthFt*12,'Insulation thickness or surface missing');
   }
  }
 }
 if(!planes.length)warnings.push('No roof planes measured');
 if(!entities.some(e=>e.kind==='roofEdge'))warnings.push('No classified edges measured');
 if(!entities.some(e=>e.kind==='roofSurface'&&e.purpose==='soffit'))warnings.push('Soffit area not quantified');
 if(!entities.some(e=>e.kind==='roofSurface'&&e.purpose==='insulation'))warnings.push('Insulation area not quantified');
 validateContributionSet(rows);return {rows,warnings};
}
