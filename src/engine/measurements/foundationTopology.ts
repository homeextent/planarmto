/** C.1C persistence boundary: explicit foundation topology, not completeness or engineering approval.
 * Preserve historical structurally valid v3 records without inferring new semantics.
 * Pending quantities are allowed; invalid confirmed geometry is not.
 */
import {validateSpecialistEntities,type FoundationEntity} from './measurementTypes';
import {simplePolygon} from './roofMeasurements';
import {validateStripSources} from './foundationDerivation';
import {foundationDetails} from './foundationDetails';
export function validateFoundationTopology(entities:FoundationEntity[]):void {
 validateSpecialistEntities('foundation',entities);
 validateStripSources(entities);
 const ids=new Set(entities.map(e=>e.id));
 for(const e of entities){
  if(!e.foundation)continue;
  if('polygon' in e&&!simplePolygon(e.polygon))throw Error('Invalid foundation polygon: '+e.id);
  if('start' in e&&e.kind!=='foundationLine'){
   const length=Math.hypot(e.end.x-e.start.x,e.end.y-e.start.y);
   if(!Number.isFinite(length)||length<=1e-8)throw Error('Invalid foundation run: '+e.id);
   if(e.foundation.baseElevationConfirmed&&e.elevationFt!==null&&e.heightFt!==null&&!Number.isFinite(e.elevationFt+e.heightFt))throw Error('Invalid foundation vertical interval: '+e.id);
  }
  if('polygon' in e&&e.foundation.baseElevationConfirmed&&e.elevationFt!==null&&e.depthFt!==null&&!Number.isFinite(e.elevationFt+e.depthFt))throw Error('Invalid foundation vertical interval: '+e.id);
  for(const detail of [...(e.foundation.wallOpenings??[]),...(e.foundation.slabOpenings??[]),...(e.foundation.slabThickenings??[])]){
   if(ids.has(detail.id))throw Error('Duplicate foundation entity or detail ID: '+detail.id);
   ids.add(detail.id);
  }
  foundationDetails(e);
 }
}
