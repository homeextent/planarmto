/** Explicit independent surface and drainage measurements. No inferred wall coverage or route geometry. */
import type {FoundationEntity,Point,QuantityContribution} from './measurementTypes';
import {simplePolygon,projectedArea} from './roofMeasurements';
import {polygonEnvelope,orthogonalPolygonPieces,type Bounds} from './foundationGeometry';
type Feature=FoundationEntity & ({kind:'foundationLine'}|{kind:'foundationRegion';purpose:'insulation'});
const isFeature=(e:FoundationEntity):e is Feature=>e.kind==='foundationLine'||e.kind==='foundationRegion'&&e.purpose==='insulation';
const overlap=(a:Bounds,b:Bounds)=>Math.min(a.xmax,b.xmax)>Math.max(a.xmin,b.xmin)&&Math.min(a.ymax,b.ymax)>Math.max(a.ymin,b.ymin);
const len=(a:Point,b:Point)=>Math.hypot(b.x-a.x,b.y-a.y);
function lineOverlap(a:Point,b:Point,c:Point,d:Point):boolean {
 const l=len(a,b),dx=(b.x-a.x)/l,dy=(b.y-a.y)/l;
 const cross=(p:Point)=>Math.abs((p.x-a.x)*dy-(p.y-a.y)*dx);
 if(cross(c)>1e-8||cross(d)>1e-8)return false;
 const t=(p:Point)=>(p.x-a.x)*dx+(p.y-a.y)*dy;
 return Math.min(l,Math.max(t(c),t(d)))>Math.max(0,Math.min(t(c),t(d)))+1e-8;
}
function regionOverlap(a:Point[],b:Point[]):boolean{
 if(!simplePolygon(a)||!simplePolygon(b))return true;
 if(!overlap(polygonEnvelope(a),polygonEnvelope(b)))return false;
 try{return orthogonalPolygonPieces(a).some(x=>orthogonalPolygonPieces(b).some(y=>overlap(x,y)))}catch{return true}
}
export function foundationCoverage(entities:FoundationEntity[]):{entity:Feature;code:string;unit:QuantityContribution['unit'];basis:string;value:number|null;reason:string}[]{
 const features=entities.filter(isFeature);
 return features.flatMap(e=>{
  const c=e.foundation?.coverage;
  let reason=!c||!e.foundation?.material?'Confirm material and explicit coverage ownership':'';
  // Different IDs alone do not prove distinct physical layers. Require explicit distinct layer IDs and material systems.
  for(const q of features){
   if(q===e||q.purpose!==e.purpose||q.kind!==e.kind)continue;
   const qc=q.foundation?.coverage;
   if(e.purpose!=='drainage'&&c&&qc&&c.layerId!==qc.layerId&&e.foundation?.material!==q.foundation?.material)continue;
   const conflict='start' in e&&'start' in q?lineOverlap(e.start,e.end,q.start,q.end):'polygon' in e&&'polygon' in q?regionOverlap(e.polygon,q.polygon):false;
   if(conflict)reason='Overlapping coverage or drainage route requires reconciliation';
  }
  let area:number|null=null;
  if('start' in e){
   if(e.purpose==='drainage')return [{entity:e,code:'foundation.drainage.length',unit:'LF' as const,basis:'explicit horizontal plan route',value:reason?null:len(e.start,e.end),reason}];
   if(!e.heightFt||!c?.openingTreatment)reason=reason||'Confirm coverage height and opening treatment';
   // alreadyDeducted cannot be represented by a single full-height line; split into net coverage segments instead.
   if(c?.openingTreatment==='alreadyDeducted')reason=reason||'Use explicit net coverage segments with no remaining openings';
   area=e.heightFt?len(e.start,e.end)*e.heightFt:null;
  }else if('polygon' in e&&simplePolygon(e.polygon))area=projectedArea(e.polygon);
  const code=e.purpose==='waterproofing'?'foundation.waterproofing.area':'foundation.insulation.area';
  const rows=[{entity:e,code,unit:'SF' as QuantityContribution['unit'],basis:'explicit '+('start' in e?'vertical':'horizontal')+' coverage',value:reason?null:area,reason:reason||'Invalid coverage geometry'}];
  if(e.purpose==='insulation'&&c?.foam){
   const thickness='polygon' in e?e.depthFt:c.thicknessFt;
   rows.push({entity:e,code:'foundation.insulation.foam',unit:'BF',basis:'actual coverage SF × thickness inches',value:reason||area===null||!thickness?null:area*thickness*12,reason:reason||'Missing foam thickness or coverage'});
  }
  return rows;
 });
}
