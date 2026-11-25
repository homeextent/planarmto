import type {FoundationEntity} from './measurementTypes';
import {polygonEnvelope,orthogonalPolygonPieces,type Bounds} from './foundationGeometry';
import {simplePolygon} from './roofMeasurements';
type Layer=FoundationEntity & {kind:'foundationRegion';polygon:{x:number;y:number}[];depthFt:number|null;elevationFt:number|null};
const isLayer=(e:FoundationEntity):e is Layer=>e.kind==='foundationRegion'&&(e.purpose==='granular'||e.purpose==='insulation');
const overlap=(a:Bounds,b:Bounds)=>Math.min(a.xmax,b.xmax)>Math.max(a.xmin,b.xmin)+1e-8&&Math.min(a.ymax,b.ymax)>Math.max(a.ymin,b.ymin)+1e-8;
const explicit=(e:Layer)=>e.foundation?.envelopeSource?.offsetBelowSlabFt!==undefined||!!e.foundation?.granularLayerId||(!e.foundation?.envelopeSource&&e.purpose==='insulation'&&!!e.foundation?.baseElevationConfirmed);
const identity=(e:Layer)=>e.foundation?.granularLayerId??e.foundation?.envelopeSource?.layerId??e.foundation?.coverage?.layerId;
const interval=(e:Layer)=>e.foundation?.baseElevationConfirmed&&e.elevationFt!==null&&e.depthFt!==null&&e.depthFt>0?[e.elevationFt,e.elevationFt+e.depthFt] as const:null;
function plan(a:Layer,b:Layer){if(!simplePolygon(a.polygon)||!simplePolygon(b.polygon))return true;if(!overlap(polygonEnvelope(a.polygon),polygonEnvelope(b.polygon)))return false;try{return orthogonalPolygonPieces(a.polygon).some(x=>orthogonalPolygonPieces(b.polygon).some(y=>overlap(x,y)))}catch{return true}}
/** Cross-purpose installed layers are physical solids, not independent surface allowances.
 * Legacy entities retain their geometry; unresolved coincident layers are withheld.
 */
export function foundationLayerConflicts(entities:FoundationEntity[]):Map<string,string>{
 const layers=entities.filter(isLayer),blocked=new Map<string,string>();
 for(const e of layers)if(explicit(e)&&(!identity(e)||!interval(e)))blocked.set(e.id,'Confirm layer identity, thickness and base elevation');
 for(let i=0;i<layers.length;i++)for(const b of layers.slice(i+1)){
  const a=layers[i];if(!plan(a,b))continue;
  // Preserve legacy same-purpose reconciliation; cross-purpose layer overlap must never be counted twice.
  if(a.purpose===b.purpose&&!explicit(a)&&!explicit(b))continue;
  const x=interval(a),y=interval(b);
  if(x&&y&&Math.min(x[1],y[1])<=Math.max(x[0],y[0])+1e-8)continue;
  const reason='Overlapping under-slab material layers require explicit vertical separation';
  blocked.set(a.id,reason);blocked.set(b.id,reason);
 }
 return blocked;
}
