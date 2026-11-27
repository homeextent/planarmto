/** C.1C-A: exact rectangular solid reconciliation, not a general polygon boolean engine. */
import type {Point} from './measurementTypes';
export type Bounds = {xmin:number;xmax:number;ymin:number;ymax:number};
export type Prism = {id:string;bounds:Bounds;bottomFt:number|null;heightFt:number|null};
export type PrismResult = {id:string;volumeCF:number|null;reason?:string};
const EPS=1e-8;
const finite=(n:number)=>Number.isFinite(n);
export function validateBounds(b:Bounds):void {
 if(![b.xmin,b.xmax,b.ymin,b.ymax].every(finite)||b.xmax-b.xmin<=EPS||b.ymax-b.ymin<=EPS)throw Error('Invalid or degenerate rectangular footprint');
}
export function rectangleBounds(points:Point[]):Bounds {
 if(points.length!==4||points.some(p=>!finite(p.x)||!finite(p.y)))throw Error('Expected four finite rectangle vertices');
 const xs=[...new Set(points.map(p=>p.x))],ys=[...new Set(points.map(p=>p.y))];
 if(xs.length!==2||ys.length!==2||new Set(points.map(p=>JSON.stringify([p.x,p.y]))).size!==4)throw Error('Expected axis-aligned rectangle');
 if(points.some((p,i)=>{const q=points[(i+1)%4];return (p.x===q.x)===(p.y===q.y)}))throw Error('Rectangle edges must follow boundary order');
 const b={xmin:Math.min(...xs),xmax:Math.max(...xs),ymin:Math.min(...ys),ymax:Math.max(...ys)};validateBounds(b);return b;
}
/** Full butt-ended strip footprint. Junction extensions must be explicitly constructed upstream. */
export function orthogonalStrip(start:Point,end:Point,widthFt:number):Bounds {
 if(![start.x,start.y,end.x,end.y,widthFt].every(finite)||widthFt<=EPS)throw Error('Invalid strip dimensions');
 const h=widthFt/2;
 if(start.y===end.y&&start.x!==end.x){const b={xmin:Math.min(start.x,end.x),xmax:Math.max(start.x,end.x),ymin:start.y-h,ymax:start.y+h};validateBounds(b);return b}
 if(start.x===end.x&&start.y!==end.y){const b={xmin:start.x-h,xmax:start.x+h,ymin:Math.min(start.y,end.y),ymax:Math.max(start.y,end.y)};validateBounds(b);return b}
 throw Error('Rectangular reconciliation requires orthogonal strip geometry');
}
const overlaps=(a:Bounds,b:Bounds)=>Math.min(a.xmax,b.xmax)>Math.max(a.xmin,b.xmin)&&Math.min(a.ymax,b.ymax)>Math.max(a.ymin,b.ymin);
const same=(a:Bounds,b:Bounds)=>a.xmin===b.xmin&&a.xmax===b.xmax&&a.ymin===b.ymin&&a.ymax===b.ymax;
const cuts=(values:number[])=>[...new Set(values)].sort((a,b)=>a-b);
/** One explicitly compatible physical material system per call.
 * Stable lexicographic attribution of shared cells; zero additional CF is valid only for a resolved shared cell.
 * Missing vertical information in an overlapping connected component blocks the whole component.
 * No inferred elevation, corner extension, or compatibility between materials.
 */
export function reconcileRectangularPrisms(input:readonly Prism[]):PrismResult[] {
 const solids=[...input].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
 if(new Set(solids.map(p=>p.id)).size!==solids.length)throw Error('Duplicate prism ID');
 for(const p of solids){validateBounds(p.bounds);if(!p.id.trim()||p.heightFt!==null&&(!finite(p.heightFt)||p.heightFt<=EPS)||p.bottomFt!==null&&!finite(p.bottomFt)||p.bottomFt!==null&&p.heightFt!==null&&(!finite(p.bottomFt+p.heightFt)||p.bottomFt+p.heightFt<=p.bottomFt))throw Error('Invalid prism dimension or identity')}
 const results=new Map<string,PrismResult>();
 const remaining=new Set(solids);
 while(remaining.size){
  const first=remaining.values().next().value!;remaining.delete(first);
  const group=[first];
  for(let i=0;i<group.length;i++)for(const p of remaining)if(overlaps(group[i].bounds,p.bounds)){group.push(p);remaining.delete(p)}
  group.sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
  const pending=group.some(p=>p.heightFt===null)||group.length>1&&group.some(p=>p.bottomFt===null);
  if(pending){for(const p of group)results.set(p.id,{id:p.id,volumeCF:null,reason:'Missing thickness/height or overlapping solid elevation'});continue}
  if(group.length===1){const p=first,b=p.bounds;const v=(b.xmax-b.xmin)*(b.ymax-b.ymin)*p.heightFt!;if(!finite(v))throw Error('Nonfinite volume');results.set(p.id,{id:p.id,volumeCF:v});continue}
  for(let i=0;i<group.length;i++)for(const q of group.slice(i+1)){const p=group[i];if(same(p.bounds,q.bounds)&&p.bottomFt===q.bottomFt&&p.heightFt===q.heightFt)throw Error('Duplicate physical solid: '+p.id+' / '+q.id)}
  const xs=cuts(group.flatMap(p=>[p.bounds.xmin,p.bounds.xmax])),ys=cuts(group.flatMap(p=>[p.bounds.ymin,p.bounds.ymax])),zs=cuts(group.flatMap(p=>[p.bottomFt!,p.bottomFt!+p.heightFt!]));
  // Bounded work; refuse rather than approximate.
  if((xs.length-1)*(ys.length-1)*(zs.length-1)*group.length>2_000_000)throw Error('Solid reconciliation exceeds bounded complexity; divide into verified independent systems');
  const volumes=new Map(group.map(p=>[p.id,0]));
  for(let i=1;i<xs.length;i++)for(let j=1;j<ys.length;j++)for(let k=1;k<zs.length;k++){
   const owner=group.find(p=>xs[i-1]>=p.bounds.xmin&&xs[i]<=p.bounds.xmax&&ys[j-1]>=p.bounds.ymin&&ys[j]<=p.bounds.ymax&&zs[k-1]>=p.bottomFt!&&zs[k]<=p.bottomFt!+p.heightFt!);
   if(owner)volumes.set(owner.id,volumes.get(owner.id)!+(xs[i]-xs[i-1])*(ys[j]-ys[j-1])*(zs[k]-zs[k-1]));
  }
  for(const p of group){const v=volumes.get(p.id)!;if(!finite(v))throw Error('Nonfinite volume');results.set(p.id,{id:p.id,volumeCF:v})}
 }
 return solids.map(p=>results.get(p.id)!);
}

export type RectangleReference='exterior'|'centreline'|'interior';
/** Reference rectangle describes actual specified faces, not a bounding approximation. */
export function foundationRectangle(reference:Bounds,widthFt:number,mode:RectangleReference) {
 validateBounds(reference);
 if(!finite(widthFt)||widthFt<=EPS)throw Error('Missing or invalid wall thickness');
 if(!['exterior','centreline','interior'].includes(mode))throw Error('Invalid wall reference');
 const delta=mode==='exterior'?-widthFt/2:mode==='interior'?widthFt/2:0;
 const centre={xmin:reference.xmin-delta,xmax:reference.xmax+delta,ymin:reference.ymin-delta,ymax:reference.ymax+delta};
 validateBounds(centre);
 const h=widthFt/2;
 validateBounds({xmin:centre.xmin+h,xmax:centre.xmax-h,ymin:centre.ymin+h,ymax:centre.ymax-h});
 const {xmin,xmax,ymin,ymax}=centre;
 const vertices=[{x:xmin,y:ymin},{x:xmax,y:ymin},{x:xmax,y:ymax},{x:xmin,y:ymax}];
 return {centre,segments:vertices.map((start,i)=>({start,end:vertices[(i+1)%4],joinStartFt:h,joinEndFt:h}))};
}
/** Convert an explicitly oriented face line into a centreline. Left/right in stored XY coordinates. */
export function faceToCentreline(start:Point,end:Point,widthFt:number,side:'left'|'right') {
 const len=Math.hypot(end.x-start.x,end.y-start.y);
 if(!finite(len)||len<=EPS||!finite(widthFt)||widthFt<=EPS||!['left','right'].includes(side))throw Error('Invalid face reference or thickness');
 const sign=side==='left'?1:-1,dx=-(end.y-start.y)/len*widthFt/2*sign,dy=(end.x-start.x)/len*widthFt/2*sign;
 return {start:{x:start.x+dx,y:start.y+dy},end:{x:end.x+dx,y:end.y+dy}};
}
export function extendedStrip(start:Point,end:Point,widthFt:number,joinStartFt=0,joinEndFt=0):Bounds {
 const len=Math.hypot(end.x-start.x,end.y-start.y);
 if(!finite(len)||len<=EPS||![joinStartFt,joinEndFt].every(x=>finite(x)&&x>=0))throw Error('Invalid junction extension');
 const dx=(end.x-start.x)/len,dy=(end.y-start.y)/len;
 return orthogonalStrip({x:start.x-dx*joinStartFt,y:start.y-dy*joinStartFt},{x:end.x+dx*joinEndFt,y:end.y+dy*joinEndFt},widthFt);
}

/** Exact decomposition of a simple orthogonal polygon into disjoint rectangular strips.
 * Caller validates simple topology. No snapping or bounding-box approximation.
 */
export function orthogonalPolygonPieces(points:Point[]):Bounds[]{
 if(points.length<4||points.some(p=>!finite(p.x)||!finite(p.y)))throw Error('Invalid orthogonal polygon');
 const edges=points.map((p,i)=>[p,points[(i+1)%points.length]] as const);
 if(edges.some(([a,b])=>(a.x===b.x)===(a.y===b.y)))throw Error('Nonorthogonal polygon');
 const xs=cuts(points.map(p=>p.x)), pieces:Bounds[]=[];
 if(xs.length*edges.length>200000)throw Error('Polygon decomposition exceeds bounded complexity');
 for(let i=1;i<xs.length;i++){
  const xmin=xs[i-1],xmax=xs[i],x=xmin+(xmax-xmin)/2;
  const ys=edges.filter(([a,b])=>a.y===b.y&&x>Math.min(a.x,b.x)&&x<Math.max(a.x,b.x)).map(([a])=>a.y).sort((a,b)=>a-b);
  if(ys.length%2)throw Error('Invalid polygon scanline');
  for(let j=0;j<ys.length;j+=2){const b={xmin,xmax,ymin:ys[j],ymax:ys[j+1]};validateBounds(b);pieces.push(b)}
 }
 if(!pieces.length)throw Error('Empty polygon decomposition');
 return pieces;
}
export function polygonEnvelope(points:Point[]):Bounds{
 const b={xmin:Infinity,xmax:-Infinity,ymin:Infinity,ymax:-Infinity};
 for(const p of points){b.xmin=Math.min(b.xmin,p.x);b.xmax=Math.max(b.xmax,p.x);b.ymin=Math.min(b.ymin,p.y);b.ymax=Math.max(b.ymax,p.y)}
 validateBounds(b);return b;
}

/** Exact oriented butt-ended footprint with explicit longitudinal extensions.
 * This does not construct or infer a mitred angled junction. */
export function orientedStripFootprint(start:Point,end:Point,widthFt:number,joinStartFt=0,joinEndFt=0):Point[]{
 const length=Math.hypot(end.x-start.x,end.y-start.y);
 if(![start.x,start.y,end.x,end.y,widthFt,length,joinStartFt,joinEndFt].every(finite)||length<=EPS||widthFt<=EPS||joinStartFt<0||joinEndFt<0)throw Error('Invalid oriented strip dimensions');
 const ux=(end.x-start.x)/length,uy=(end.y-start.y)/length,nx=-uy*widthFt/2,ny=ux*widthFt/2;
 const a={x:start.x-ux*joinStartFt,y:start.y-uy*joinStartFt},b={x:end.x+ux*joinEndFt,y:end.y+uy*joinEndFt};
 const p=[{x:a.x+nx,y:a.y+ny},{x:b.x+nx,y:b.y+ny},{x:b.x-nx,y:b.y-ny},{x:a.x-nx,y:a.y-ny}];
 if(p.some(q=>!finite(q.x)||!finite(q.y)))throw Error('Nonfinite oriented footprint');
 return p;
}
/** Separating axis test for convex rectangles. Touching is not volumetric overlap. */
export function orientedFootprintsOverlap(a:Point[],b:Point[]):boolean{
 for(const p of [a,b])for(let i=0;i<p.length;i++){
  const q=p[(i+1)%p.length],dx=q.x-p[i].x,dy=q.y-p[i].y,l=Math.hypot(dx,dy);
  if(l<=EPS)throw Error('Degenerate footprint edge');
  const project=(v:Point)=>((v.x-p[i].x)*dy-(v.y-p[i].y)*dx)/l;
  const x=a.map(project),y=b.map(project);
  if(Math.min(Math.max(...x),Math.max(...y))-Math.max(Math.min(...x),Math.min(...y))<=EPS)return false;
 }
 return true;
}
