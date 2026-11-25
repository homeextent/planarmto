/** C.1C persistence boundary: explicit foundation topology, not completeness or engineering approval.
 * Preserve historical structurally valid v3 records without inferring new semantics.
 * Pending quantities are allowed; invalid confirmed geometry is not.
 */
import {validateSpecialistEntities,type FoundationEntity} from './measurementTypes';
import {simplePolygon} from './roofMeasurements';
import {validateDrainageSources} from './foundationDrainageDerivation';
import {validateEnvelopeSources} from './foundationEnvelopeDerivation';
import {validateStripSources} from './foundationDerivation';
import {foundationDetails} from './foundationDetails';
export function validateFoundationTopology(entities:FoundationEntity[]):void {
 validateSpecialistEntities('foundation',entities);
 validateStripSources(entities);
 validateEnvelopeSources(entities);
 validateDrainageSources(entities);
 // Derived geometry cannot contribute while its source is excluded or unresolved.
 const byId=new Map(entities.map(e=>[e.id,e]));
 for(const e of entities){
  const f=e.foundation,sourceIds=[...(f?.stripSource?[f.stripSource.wallId]:[]),...(f?.envelopeSource?[f.envelopeSource.sourceId,...(f.envelopeSource.perimeterWallIds??[])]:[]),...(f?.drainageSource?.wallIds??[])];
  if(e.scopeApplicability?.status==='excluded')continue;
  for(const id of sourceIds){const status=byId.get(id)?.scopeApplicability?.status;
   if(status==='excluded'||status==='pending'&&e.scopeApplicability?.status!=='pending')throw Error('Resolve applicability of source-linked components together');
  }
 }
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
