/** R4-C pure geometry. No persistence or automatic scope assignment. Canonical feet. */
import type {Point,RoofEntity,Applicability,RoofDerivationMetadata} from './measurementTypes';
import {projectedArea,validateRoofTopology,slopeFactor} from './roofMeasurements';
type Plane=Extract<RoofEntity,{kind:'roofPlane'}>;
type Edge=Extract<RoofEntity,{kind:'roofEdge'}>;
export const sides=['north','east','south','west'] as const;
export type Side=typeof sides[number];
export type Bounds={xmin:number;ymin:number;xmax:number;ymax:number};
export type Depths=Record<Side,number>;
const EPS=1e-6;
const width=(b:Bounds)=>b.xmax-b.xmin;
const height=(b:Bounds)=>b.ymax-b.ymin;
const area=(b:Bounds)=>width(b)*height(b);
const valid=(b:Bounds)=>Object.values(b).every(Number.isFinite)&&width(b)>EPS&&height(b)>EPS;
export const rectanglePolygon=(b:Bounds):Point[]=>[{x:b.xmin,y:b.ymin},{x:b.xmax,y:b.ymin},{x:b.xmax,y:b.ymax},{x:b.xmin,y:b.ymax}];
const near=(a:number,b:number)=>Math.abs(a-b)<=EPS;
const inside=(a:Bounds,b:Bounds)=>a.xmin>=b.xmin-EPS&&a.ymin>=b.ymin-EPS&&a.xmax<=b.xmax+EPS&&a.ymax<=b.ymax+EPS;
const intersects=(a:Bounds,b:Bounds)=>Math.min(a.xmax,b.xmax)-Math.max(a.xmin,b.xmin)>EPS&&Math.min(a.ymax,b.ymax)-Math.max(a.ymin,b.ymin)>EPS;
function conserve(actual:number,expected:number,message:string){
 if(!Number.isFinite(actual)||Math.abs(actual-expected)>EPS*Math.max(1,expected))throw Error(message);
}
export function rectangularRoof(entities:RoofEntity[],planeIds:string[],requireConsistentSoffit=true){
 validateRoofTopology(entities.filter(e=>e.kind!=='roofSurface'));
 const selected=new Set(planeIds);
 const planes=entities.filter((e):e is Plane=>e.kind==='roofPlane'&&selected.has(e.id));
 if(!planes.length||planes.length!==planeIds.length||selected.size!==planeIds.length)throw Error('Select distinct existing roof planes.');
 const points=planes.flatMap(p=>p.polygon);
 const outer={xmin:Math.min(...points.map(p=>p.x)),ymin:Math.min(...points.map(p=>p.y)),xmax:Math.max(...points.map(p=>p.x)),ymax:Math.max(...points.map(p=>p.y))};
 if(!valid(outer))throw Error('Invalid roof extent.');
 // All polygons lie in the bounding rectangle; validated nonoverlap plus equal area proves coverage.
 conserve(planes.reduce((n,p)=>n+projectedArea(p.polygon),0),area(outer),'Selected planes do not fill a rectangle. Use manual surface drafting.');
 const edges=entities.filter((e):e is Edge=>e.kind==='roofEdge'&&e.planeIds.length===1&&selected.has(e.planeIds[0]));
 const boundary={} as Record<Side,{edgeIds:string[];soffit:Applicability}>;
 for(const side of sides){
  const horizontal=side==='north'||side==='south';
  const fixed=side==='north'?outer.ymin:side==='south'?outer.ymax:side==='west'?outer.xmin:outer.xmax;
  const coord=(p:Point)=>horizontal?p.y:p.x;
  const along=(p:Point)=>horizontal?p.x:p.y;
  const start=horizontal?outer.xmin:outer.ymin,end=horizontal?outer.xmax:outer.ymax;
  const runs=edges.filter(e=>near(coord(e.start),fixed)&&near(coord(e.end),fixed)).map(e=>({e,a:Math.min(along(e.start),along(e.end)),b:Math.max(along(e.start),along(e.end))})).sort((a,b)=>a.a-b.a);
  let cursor=start;
  for(const run of runs){
   if(run.e.edgeType==='unclassified'||!near(run.a,cursor)||run.b>end+EPS)throw Error('Classify and reconcile the entire '+side+' roof boundary.');
   cursor=run.b;
  }
  if(!runs.length||!near(cursor,end))throw Error('Classify the entire '+side+' roof boundary before deriving surfaces.');
  const statuses=new Set(runs.map(r=>r.e.applicability?.soffit||'unspecified'));
  if(requireConsistentSoffit&&statuses.size!==1)throw Error('Conflicting soffit applicability along '+side+' side. Use manual drafting.');
  boundary[side]={edgeIds:runs.map(r=>r.e.id),soffit:statuses.size===1?[...statuses][0]:'unspecified'};
 }
 return {outer,planes,boundary};
}
export function insetRoof(outer:Bounds,depths:Depths){
 if(!valid(outer)||sides.some(s=>!Number.isFinite(depths[s])||depths[s]<0))throw Error('Specify a nonnegative horizontal depth for every side.');
 const inner={xmin:outer.xmin+depths.west,ymin:outer.ymin+depths.north,xmax:outer.xmax-depths.east,ymax:outer.ymax-depths.south};
 if(!valid(inner))throw Error('Overhang depths must leave a positive interior footprint.');
 // North/south own corners. East/west span only the inner y extent.
 const strips:Record<Side,Bounds>={
  north:{...outer,ymax:inner.ymin},south:{...outer,ymin:inner.ymax},
  west:{xmin:outer.xmin,xmax:inner.xmin,ymin:inner.ymin,ymax:inner.ymax},
  east:{xmin:inner.xmax,xmax:outer.xmax,ymin:inner.ymin,ymax:inner.ymax}
 };
 const pieces=sides.filter(s=>valid(strips[s])).map(side=>({side,bounds:strips[side],polygon:rectanglePolygon(strips[side]),projectedSF:area(strips[side])}));
 conserve(pieces.reduce((n,p)=>n+p.projectedSF,0)+area(inner),area(outer),'Overhang partition does not conserve roof area.');
 return {inner,pieces,interiorSF:area(inner),interiorLF:2*(width(inner)+height(inner)),overhangSF:area(outer)-area(inner)};
}
export function thermalRectangles(inner:Bounds,exclusions:Bounds[]){
 if(!valid(inner)||exclusions.some(e=>!valid(e)||!inside(e,inner)))throw Error('Thermal exclusions must be valid rectangles inside the footprint.');
 for(const [i,e] of exclusions.entries())if(exclusions.slice(i+1).some(q=>intersects(e,q)))throw Error('Thermal exclusions overlap.');
 const xs=[...new Set([inner.xmin,inner.xmax,...exclusions.flatMap(e=>[e.xmin,e.xmax])])].sort((a,b)=>a-b);
 const ys=[...new Set([inner.ymin,inner.ymax,...exclusions.flatMap(e=>[e.ymin,e.ymax])])].sort((a,b)=>a-b);
 if(xs.length*ys.length>10000)throw Error('Too many thermal subdivisions. Use manual surfaces.');
 const pieces:Bounds[]=[];
 for(let i=1;i<xs.length;i++)for(let j=1;j<ys.length;j++){
  const b={xmin:xs[i-1],xmax:xs[i],ymin:ys[j-1],ymax:ys[j]};
  if(valid(b)&&!exclusions.some(e=>inside(b,e)))pieces.push(b);
 }
 if(!pieces.length)throw Error('Thermal exclusions consume the entire footprint.');
 conserve(pieces.reduce((n,b)=>n+area(b),0),area(inner)-exclusions.reduce((n,b)=>n+area(b),0),'Thermal partition does not conserve area.');
 return pieces;
}
const cross=(a:Point,b:Point,c:Point)=>(b.x-a.x)*(c.y-b.y)-(b.y-a.y)*(c.x-b.x);
function convex(poly:Point[]){
 const turns=poly.map((a,i)=>cross(a,poly[(i+1)%poly.length],poly[(i+2)%poly.length])).filter(v=>Math.abs(v)>EPS);
 return turns.length>0&&turns.every(v=>Math.sign(v)===Math.sign(turns[0]));
}
function clip(poly:Point[],b:Bounds):Point[]{
 let out=poly;
 for(const [axis,value,sign] of [['x',b.xmin,1],['x',b.xmax,-1],['y',b.ymin,1],['y',b.ymax,-1]] as const){
  const input=out;out=[];
  const signed=(p:Point)=>(p[axis]-value)*sign;
  for(let i=0;i<input.length;i++){
   const a=input[i],q=input[(i+1)%input.length],da=signed(a),dq=signed(q);
   if(da>=0)out.push(a);
   if((da>=0)!==(dq>=0)){
    const t=da/(da-dq);out.push({...{x:a.x+t*(q.x-a.x),y:a.y+t*(q.y-a.y)},[axis]:value});
   }
  }
  out=out.filter((p,i)=>i===0||Math.hypot(p.x-out[i-1].x,p.y-out[i-1].y)>EPS);
  if(out.length>1&&Math.hypot(out[0].x-out[out.length-1].x,out[0].y-out[out.length-1].y)<=EPS)out.pop();
 }
 return out;
}
export type ThermalPiece={polygon:Point[];planeId?:string;pitchRise:number|null;projectedSF:number;actualSF:number|null};
export function thermalPieces(rectangles:Bounds[],planes:Plane[],basis:'horizontal'|'sloped'):ThermalPiece[]{
 if(!rectangles.length||rectangles.some(b=>!valid(b)))throw Error('Specify valid thermal rectangles.');
 for(const [i,b] of rectangles.entries())if(rectangles.slice(i+1).some(q=>intersects(b,q)))throw Error('Thermal rectangles overlap.');
 if(basis==='horizontal')return rectangles.map(b=>({polygon:rectanglePolygon(b),pitchRise:0,projectedSF:area(b),actualSF:area(b)}));
 if(!planes.length||planes.some(p=>!convex(p.polygon)))throw Error('Sloped derivation requires convex roof planes. Use manual surfaces.');
 validateRoofTopology(planes);
 const pieces:ThermalPiece[]=[];
 for(const b of rectangles){
  const start=pieces.length;
  for(const p of planes){
   const polygon=clip(p.polygon,b),projectedSF=projectedArea(polygon);
   if(projectedSF<=EPS)continue;
   pieces.push({polygon,planeId:p.id,pitchRise:p.pitchRise,projectedSF,actualSF:p.pitchRise===null?null:projectedSF*slopeFactor(p.pitchRise)});
  }
  conserve(pieces.slice(start).reduce((n,p)=>n+p.projectedSF,0),area(b),'Roof planes do not cover the thermal boundary.');
 }
 return pieces;
}

type Surface=Extract<RoofEntity,{kind:'roofSurface'}>;
export type DerivationSpec=Omit<RoofDerivationMetadata,'pieceKey'|'pendingApplicability'>;
type DerivedPiece=Pick<Surface,'polygon'|'pitchRise'> & {pieceKey:string;pendingApplicability?:true};
const sameIds=(a:string[],b:string[])=>a.length===b.length&&new Set(a).size===a.length&&a.every(id=>b.includes(id));
/** Reconstruct geometry from current source, never from saved quantity totals. */
export function reconstructRoofSurfaces(entities:RoofEntity[],spec:DerivationSpec):DerivedPiece[]{
 const r=rectangularRoof(entities,spec.planeIds,spec.purpose==='soffit');
 const edgeIds=sides.flatMap(side=>r.boundary[side].edgeIds);
 if(!sameIds(spec.edgeIds,edgeIds))throw Error('Derived roof boundary references changed. Remove or rederive surfaces.');
 const inset=insetRoof(r.outer,spec.depths);
 if(spec.purpose==='soffit'){
  if(spec.basis!=='horizontal')throw Error('Derived soffit must be horizontal.');
  if(new Set(inset.pieces.map(p=>r.boundary[p.side].soffit)).size>1&&!spec.cornersConfirmed)throw Error('Confirm mixed soffit corner allocation.');
  // Retain unresolved strip geometry, but never treat it as measured scope.
  return inset.pieces.filter(p=>r.boundary[p.side].soffit!=='excluded').map(p=>({pieceKey:p.side,polygon:p.polygon,pitchRise:0,...(r.boundary[p.side].soffit==='unspecified'?{pendingApplicability:true as const}:{})}));
 }
 if(!spec.boundaryConfirmed||!spec.material)throw Error('Confirm thermal boundary and insulation material.');
 const rects=thermalRectangles(inset.inner,spec.exclusions);
 return rects.flatMap((b,i)=>thermalPieces([b],[...r.planes].sort((a,b)=>a.id.localeCompare(b.id)),spec.basis).map(p=>({pieceKey:JSON.stringify([i,p.planeId??null]),polygon:p.polygon,pitchRise:p.pitchRise})));
}
function samePolygon(a:Point[],b:Point[]){
 return a.length===b.length&&a.every((p,i)=>near(p.x,b[i].x)&&near(p.y,b[i].y));
}
/** Called after structural and ordinary topology validation. */
export function validateDerivedRoofSurfaces(entities:RoofEntity[]):void{
 const groups=new Map<string,Surface[]>();
 for(const e of entities)if(e.kind==='roofSurface'&&e.derivation){
  const group=groups.get(e.derivation.groupId)||[];group.push(e);groups.set(e.derivation.groupId,group);
 }
 for(const group of groups.values()){
  const spec=group[0].derivation!;
  const expected=reconstructRoofSurfaces(entities,spec);
  if(expected.length!==group.length)throw Error('Incomplete or stale derived roof group. Remove or rederive surfaces.');
  for(const p of expected){
   const actual=group.find(e=>e.derivation!.pieceKey===p.pieceKey);
   if(!actual||actual.pitchRise!==p.pitchRise||actual.derivation!.pendingApplicability!==p.pendingApplicability||!samePolygon(actual.polygon,p.polygon))throw Error('Stale derived roof surface. Remove or rederive surfaces.');
  }
 }
}

/** Pure transaction candidate. Caller commits the returned array as one history entry.
 * Existing groups may be replaced only by an explicitly matching group ID.
 * Retain identities for unchanged piece keys; never mutate the input array.
 */
export function replaceDerivedRoofGroup(entities:RoofEntity[],spec:DerivationSpec,id:()=>string):RoofEntity[]{
 validateRoofTopology(entities);
 const previous=entities.filter((e):e is Surface=>e.kind==='roofSurface'&&e.derivation?.groupId===spec.groupId);
 if(previous.length&&previous[0].purpose!==spec.purpose)throw Error('Cannot change a derived group purpose. Remove it explicitly first.');
 const remaining=entities.filter(e=>!(e.kind==='roofSurface'&&e.derivation?.groupId===spec.groupId));
 const expected=reconstructRoofSurfaces(remaining,spec);
 if(!expected.length)throw Error('No included derived surfaces. Remove the existing group explicitly if required.');
 const retained=new Map(previous.map(e=>[e.derivation!.pieceKey,e]));
 const generated:Surface[]=expected.map(p=>{
  const prior=retained.get(p.pieceKey);
  const key=prior?.id??id();
  return {
   id:key,physicalId:prior?.physicalId??key,assemblyId:prior?.assemblyId??key,
   source:prior?.source??{reference:'Derived '+spec.purpose,note:'Confirmed rectangular roof derivation v1'},
   kind:'roofSurface',purpose:spec.purpose,surfaceBasis:spec.basis,
   polygon:p.polygon.map(q=>({...q})),pitchRise:p.pitchRise,
   ...(spec.material!==undefined?{insulationType:spec.material}:{}),
   ...(spec.thicknessFt!==undefined?{depthFt:spec.thicknessFt}:{}),
   derivation:{...spec,planeIds:[...spec.planeIds],edgeIds:[...spec.edgeIds],depths:{...spec.depths},exclusions:spec.exclusions.map(b=>({...b})),pieceKey:p.pieceKey,...(p.pendingApplicability?{pendingApplicability:true as const}:{pendingApplicability:undefined})}
  };
 });
 const next=[...remaining,...generated];
 validateRoofTopology(next);
 return next;
}
/** Explicit complete group removal, preserving independent surfaces and source geometry. */
export function removeDerivedRoofGroup(entities:RoofEntity[],groupId:string):RoofEntity[]{
 validateRoofTopology(entities);
 const next=entities.filter(e=>!(e.kind==='roofSurface'&&e.derivation?.groupId===groupId));
 if(next.length===entities.length)throw Error('Derived roof group not found.');
 validateRoofTopology(next);
 return next;
}
