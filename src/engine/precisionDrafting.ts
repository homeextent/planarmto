import type {Point} from './measurements/measurementTypes';
// Canonical feet. Bare decimals follow active display units; explicit suffix overrides.
export function parseDimension(input:string,metric=false):number|null {
 const s=input.trim().toLowerCase().replace(/[′’]/g,"'").replace(/[″”]/g,'"');
 const scalar=/^(\d+(?:\.\d+)?|\.\d+)\s*(ft|feet|in|m|cm|mm|'|")?$/.exec(s);
 let n:number;
 if(scalar){const unit=scalar[2];n=Number(scalar[1])*(unit==='m'?1/.3048:unit==='cm'?.01/.3048:unit==='mm'?.001/.3048:unit==='in'||unit==='"'?1/12:unit?1:metric?1/.3048:1);}
 else {
 const f=/^(\d+(?:\.\d+)?)\s*'\s*(?:-\s*)?(?:(\d+(?:\.\d+)?)\s*)?(?:(\d+)\/(\d+)\s*)?"?$/.exec(s);
 if(!f)return null;
 const inches=Number(f[2]||0)+(f[3]?Number(f[3])/Number(f[4]):0);if(inches>=12)return null;n=Number(f[1])+inches/12;
 }
 return Number.isFinite(n)&&n>0?n:null;
}
export function orthoPoint(start:Point,end:Point):Point {
 return Math.abs(end.x-start.x)>=Math.abs(end.y-start.y)?{x:end.x,y:start.y}:{x:start.x,y:end.y};
}
export function exactEndpoint(start:Point,toward:Point,length:number,ortho=false):Point {
 const end=ortho?orthoPoint(start,toward):toward,dx=end.x-start.x,dy=end.y-start.y,d=Math.hypot(dx,dy);
 if(!Number.isFinite(length)||length<=0||!d)throw Error('Enter a positive length and indicate direction.');
 return {x:start.x+dx/d*length,y:start.y+dy/d*length};
}
export function exactRectangleCorner(start:Point,toward:Point,width:number,depth:number):Point {
 if(!Number.isFinite(width)||!Number.isFinite(depth)||width<=0||depth<=0||toward.x===start.x||toward.y===start.y)throw Error('Enter positive dimensions and indicate the opposite corner.');
 return {x:start.x+Math.sign(toward.x-start.x)*width,y:start.y+Math.sign(toward.y-start.y)*depth};
}
export function rectanglePoints(a:Point,b:Point):Point[]{
 if(a.x===b.x||a.y===b.y)throw Error('Rectangle requires nonzero width and depth.');
 return [a,{x:b.x,y:a.y},b,{x:a.x,y:b.y}].map(p=>({...p}));
}

/** Resize an axis-aligned rectangle about its first corner; never silently regularize a polygon. */
export function resizeRectangle(polygon:Point[],width:number,depth:number):Point[]{
 if(polygon.length!==4)throw Error('Only rectangular geometry supports width/depth editing.');
 const a=polygon[0],b=polygon[2],expected=rectanglePoints(a,b);
 const reverse=[expected[0],expected[3],expected[2],expected[1]];
 const matches=(p:Point[])=>p.every((q,i)=>Math.hypot(q.x-polygon[i].x,q.y-polygon[i].y)<1e-7);
 if(!matches(expected)&&!matches(reverse))throw Error('Only axis-aligned rectangles support width/depth editing.');
 const next=rectanglePoints(a,exactRectangleCorner(a,b,width,depth));
 return matches(expected)?next:[next[0],next[3],next[2],next[1]];
}
