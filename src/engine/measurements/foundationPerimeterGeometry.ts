/** Bounded simple orthogonal perimeter offsets. No topology-changing offsets or bounding-box fallback. */
import type {Point} from './measurementTypes';
import {simplePolygon,projectedArea} from './roofMeasurements';
import {orthogonalPolygonPieces,extendedStrip,reconcileRectangularPrisms,type RectangleReference} from './foundationGeometry';
const EPS=1e-8;
const area=(p:Point[])=>p.reduce((n,a,i)=>{const b=p[(i+1)%p.length];return n+a.x*b.y-b.x*a.y},0)/2;
function validate(p:Point[]){
 if(p.length<4||p.length>64||p.some(q=>!Number.isFinite(q.x)||!Number.isFinite(q.y))||!simplePolygon(p))throw Error('Expected a simple orthogonal perimeter of 4–64 vertices');
 for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length],c=p[(i+2)%p.length];const dx=b.x-a.x,dy=b.y-a.y;if((dx===0)===(dy===0)||Math.hypot(dx,dy)<=EPS||(dx===0)===(c.x===b.x))throw Error('Perimeter requires alternating nonzero orthogonal edges; remove redundant vertices')}
 if(Math.abs(area(p))<=EPS)throw Error('Degenerate perimeter');
}
export function offsetOrthogonalPerimeter(points:Point[],outwardFt:number):Point[]{
 validate(points);if(!Number.isFinite(outwardFt))throw Error('Invalid perimeter offset');
 const sign=Math.sign(area(points)),n=points.length;
 const normals=points.map((a,i)=>{const b=points[(i+1)%n],dx=b.x-a.x,dy=b.y-a.y,l=Math.hypot(dx,dy);return {x:sign*dy/l,y:-sign*dx/l}});
 const result=points.map((p,i)=>{const a=normals[(i+n-1)%n],b=normals[i];return {x:p.x+outwardFt*(a.x+b.x),y:p.y+outwardFt*(a.y+b.y)}});
 validate(result);
 if(Math.sign(area(result))!==sign)throw Error('Offset collapses perimeter');
 for(let i=0;i<n;i++){const a=points[i],b=points[(i+1)%n],c=result[i],d=result[(i+1)%n];if((b.x-a.x)*(d.x-c.x)+(b.y-a.y)*(d.y-c.y)<=EPS)throw Error('Offset reverses or collapses an edge')}
 // Reject topology-changing offsets even when endpoints alone remain simple:
 // each intermediate offset must preserve the same edge directions; swept nonadjacent
 // boundaries cannot intersect at a critical coordinate separation.
 const critical=new Set<number>();
 for(let i=0;i<n;i++)for(let j=i+1;j<n;j++)for(const k of ['x','y'] as const){const a=points[i][k]-points[j][k],b=result[i][k]-result[j][k];if(a*b<0)critical.add(a/(a-b));}
 for(const f of critical){const p=points.map((a,i)=>({x:a.x+(result[i].x-a.x)*f,y:a.y+(result[i].y-a.y)*f}));if(!simplePolygon(p))throw Error('Offset changes perimeter topology')}
 return result;
}
const pieceArea=(b:{xmin:number;xmax:number;ymin:number;ymax:number})=>(b.xmax-b.xmin)*(b.ymax-b.ymin);
export function orthogonalWallPerimeter(points:Point[],widthFt:number,reference:RectangleReference){
 if(!Number.isFinite(widthFt)||widthFt<=EPS||!['exterior','centreline','interior'].includes(reference))throw Error('Specify positive width and explicit reference');
 const h=widthFt/2,centre=offsetOrthogonalPerimeter(points,reference==='exterior'?-h:reference==='interior'?h:0);
 const exterior=offsetOrthogonalPerimeter(centre,h),interior=offsetOrthogonalPerimeter(centre,-h);
 const segments=centre.map((start,i)=>({start,end:centre[(i+1)%centre.length],joinStartFt:h,joinEndFt:h}));
 // Validate actual strip union against the independently decomposed exact ring.
 const outer=orthogonalPolygonPieces(exterior),inner=orthogonalPolygonPieces(interior);
 const expected=outer.reduce((n,b)=>n+pieceArea(b),0)-inner.reduce((n,b)=>n+pieceArea(b),0);
 const bounds=segments.map(s=>extendedStrip(s.start,s.end,widthFt,h,h));
 const actual=reconcileRectangularPrisms(bounds.map((b,i)=>({id:String(i),bounds:b,bottomFt:0,heightFt:1}))).reduce((n,p)=>n+(p.volumeCF??0),0);
 // Verify spatial equality, not area alone, by testing every cell of the common arrangement.
 const xs=[...new Set([...outer,...inner,...bounds].flatMap(b=>[b.xmin,b.xmax]))].sort((a,b)=>a-b),ys=[...new Set([...outer,...inner,...bounds].flatMap(b=>[b.ymin,b.ymax]))].sort((a,b)=>a-b);
 if(xs.length*ys.length*(outer.length+inner.length+bounds.length)>2000000)throw Error('Perimeter exceeds bounded complexity');
 const inside=(list:typeof bounds,x:number,y:number)=>list.some(b=>x>b.xmin&&x<b.xmax&&y>b.ymin&&y<b.ymax);
 for(let i=1;i<xs.length;i++)for(let j=1;j<ys.length;j++){if(xs[i]-xs[i-1]<=EPS||ys[j]-ys[j-1]<=EPS)continue;const x=(xs[i]+xs[i-1])/2,y=(ys[j]+ys[j-1])/2;if(inside(bounds,x,y)!==(inside(outer,x,y)&&!inside(inner,x,y)))throw Error('Wall strips do not match exact offset ring')}
 if(expected<=EPS||Math.abs(actual-expected)>EPS*Math.max(1,expected)||Math.abs(projectedArea(exterior)-projectedArea(interior)-expected)>EPS*Math.max(1,expected))throw Error('Unresolved perimeter ring reconciliation');
 return {centre,exterior,interior,segments,areaSF:expected};
}
