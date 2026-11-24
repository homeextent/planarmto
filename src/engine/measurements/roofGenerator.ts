import type {Point,RoofEntity} from './measurementTypes';
import {projectedArea,validateRoofTopology,measureRoof} from './roofMeasurements';
type Plane=Extract<RoofEntity,{kind:'roofPlane'}>;
type Edge=Extract<RoofEntity,{kind:'roofEdge'}>;
export type RoofConfig={type:'hip'|'gable'|'shed'|'flat';pitch:number;direction:0|90|180|270;ridge:'horizontal'|'vertical'};
const EPS=1e-6;
export function generateRectangularRoof(a:Point,b:Point,config:RoofConfig,id:()=>string):RoofEntity[]{
 if(![a.x,a.y,b.x,b.y,config.pitch].every(Number.isFinite)||config.pitch<0||config.pitch>48||(config.type!=='flat'&&config.pitch<=0))throw Error('Enter a valid positive pitch (maximum 48:12), or select flat.');
 const x=Math.min(a.x,b.x),y=Math.min(a.y,b.y),w=Math.abs(a.x-b.x),h=Math.abs(a.y-b.y);
 if(w<=EPS||h<=EPS)throw Error('Roof perimeter requires positive width and depth.');
 const A={x,y},B={x:x+w,y},C={x:x+w,y:y+h},D={x,y:y+h};
 const planes:Plane[]=[];
 const pitch=config.type==='flat'?0:config.pitch;
 const identity=()=>{const key=id();return {id:key,physicalId:key,assemblyId:key,source:{reference:'Generated '+config.type+' roof',note:'User-confirmed parametric perimeter; relative elevation datum'}}};
 const plane=(polygon:Point[],direction:number,height:(p:Point)=>number)=>{
  planes.push({...identity(),kind:'roofPlane',polygon,pitchRise:pitch,slopeDegrees:direction,elevationFt:height(polygon[0])*pitch/12});
 };
 const north=(p:Point)=>p.y-y,south=(p:Point)=>y+h-p.y,west=(p:Point)=>p.x-x,east=(p:Point)=>x+w-p.x;
 if(config.type==='hip'){
  const d=Math.min(w,h)/2;
  const L={x:x+d,y:y+d},R={x:x+w-d,y:y+h-d};
  const square=Math.hypot(R.x-L.x,R.y-L.y)<=EPS;
  if(square){plane([A,B,L],270,north);plane([B,C,L],0,east);plane([C,D,L],90,south);plane([D,A,L],180,west);}
  else {plane(w>=h?[A,B,R,L]:[A,B,L],270,north);plane(w>=h?[B,C,R]:[B,C,R,L],0,east);plane(w>=h?[C,D,L,R]:[C,D,R],90,south);plane(w>=h?[D,A,L]:[D,A,L,R],180,west);}
 }else if(config.type==='gable'){
  if(config.ridge==='horizontal'){const L={x,y:y+h/2},R={x:x+w,y:y+h/2};plane([A,B,R,L],270,north);plane([L,R,C,D],90,south);}
  else {const T={x:x+w/2,y},U={x:x+w/2,y:y+h};plane([A,T,U,D],180,west);plane([T,B,C,U],0,east);}
 }else if(config.type==='shed'){
  const height={0:east,90:south,180:west,270:north}[config.direction];
  if(!height)throw Error('Select a downslope direction.');
  plane([A,B,C,D],config.direction,height);
 }else if(config.type==='flat')plane([A,B,C,D],0,()=>0);
 else throw Error('Unsupported roof configuration.');
 const edges:Edge[]=[];
 const eq=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y)<=EPS;
 for(const p of planes)for(let i=0;i<p.polygon.length;i++){
  const start=p.polygon[i],end=p.polygon[(i+1)%p.polygon.length];
  const prior=edges.find(e=>(eq(e.start,start)&&eq(e.end,end))||(eq(e.start,end)&&eq(e.end,start)));
  if(prior){prior.planeIds.push(p.id);prior.edgeType=Math.abs(start.x-end.x)<=EPS||Math.abs(start.y-end.y)<=EPS?'ridge':'hip';continue;}
  const horizontal=Math.abs(start.y-end.y)<=EPS;
  const vertical=Math.abs(start.x-end.x)<=EPS;
  let edgeType:Edge['edgeType']='unclassified';
  if(config.type==='hip')edgeType='eave';
  if(config.type==='gable')edgeType=(config.ridge==='horizontal'?horizontal:vertical)?'eave':'rake';
  if(config.type==='shed'){
   const low=config.direction===0?Math.abs(start.x-x-w)<=EPS&&vertical:config.direction===180?Math.abs(start.x-x)<=EPS&&vertical:config.direction===90?Math.abs(start.y-y-h)<=EPS&&horizontal:Math.abs(start.y-y)<=EPS&&horizontal;
   const side=config.direction===0||config.direction===180?horizontal:vertical;
   edgeType=low?'eave':side?'rake':'unclassified';
  }
  edges.push({...identity(),kind:'roofEdge',start:{...start},end:{...end},planeIds:[p.id],edgeType,applicability:{fascia:'unspecified',gutter:'unspecified',soffit:'unspecified'}});
 }
 const result:RoofEntity[]=[...planes,...edges];
 validateRoofTopology(result);
 const area=planes.reduce((n,p)=>n+projectedArea(p.polygon),0);
 if(Math.abs(area-w*h)>EPS*Math.max(1,w*h))throw Error('Generated roof failed perimeter coverage reconciliation.');
 measureRoof('preview',result);
 return result;
}
