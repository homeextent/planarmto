import type {FoundationEntity} from './measurementTypes';
import {extendedStrip} from './foundationGeometry';
import {measureFoundation} from './foundationMeasurements';
/** Explicit signed datum conversion; null remains unknown. */
export function foundationBaseElevation(value:number|null,basis:'base'|'top',height:number|null):number|null{
 if(value===null)return null;
 if(!Number.isFinite(value))throw Error('Invalid elevation');
 if(basis==='base')return value;
 if(basis!=='top'||height===null||!Number.isFinite(height)||height<=0||!Number.isFinite(value-height))throw Error('Top elevation requires confirmed positive height or depth');
 return value-height;
}
/** Changing the displayed datum must preserve the physical interval. */
export function convertFoundationElevation(value:number|null,from:'base'|'top',to:'base'|'top',height:number|null):number|null{
 if(value===null)return null;
 if(!Number.isFinite(value))throw Error('Invalid elevation');
 if(from===to)return value;
 if(height===null||!Number.isFinite(height)||height<=0)throw Error('Confirm positive height or depth before switching elevation reference');
 const result=from==='base'?value+height:value-height;
 if(!Number.isFinite(result))throw Error('Invalid elevation conversion');
 return result;
}
/** Join whole independently drafted compatible line assemblies, never partially reassign an existing group. */
export function assignFoundationAssembly(entities:FoundationEntity[],ids:string[],assemblyId:string):FoundationEntity[]{
 const selected=entities.filter(e=>ids.includes(e.id));
 if(selected.length<2||selected.length!==new Set(ids).size||ids.length!==selected.length||!assemblyId.trim())throw Error('Select at least two distinct compatible components');
 if(entities.some(e=>e.assemblyId===assemblyId))throw Error('Choose a new assembly identity');
 const kind=selected[0].kind;
 if(!['foundationWall','stripFooting','foundationTrench'].includes(kind))throw Error('Assembly assignment supports wall, strip or trench runs');
 const existing=new Set(selected.map(e=>e.assemblyId));
 if(entities.some(e=>existing.has(e.assemblyId)&&!ids.includes(e.id)))throw Error('Select complete existing assemblies');
 if(entities.some(e=>{const f=e.foundation;return ids.includes(e.id)&&!!(f?.stripSource||f?.envelopeSource||f?.drainageSource)||!!f?.stripSource&&ids.includes(f.stripSource.wallId)||!!f?.envelopeSource&&(ids.includes(f.envelopeSource.sourceId)||f.envelopeSource.perimeterWallIds?.some(id=>ids.includes(id)))||!!f?.drainageSource&&f.drainageSource.wallIds.some(id=>ids.includes(id))}))throw Error('Remove dependent derived groups before reassigning assemblies');
 for(const e of selected){
 if(e.kind!==kind||!('widthFt' in e)||!e.foundation?.centrelineConfirmed||!e.foundation.baseElevationConfirmed||e.elevationFt===null||e.heightFt===null||e.widthFt===null||e.foundation.material!==selected[0].foundation?.material||e.foundation.wallOpenings?.length)throw Error('Confirm compatible material, width, height, centreline and base; opening-bearing runs require separate reconciliation');
 extendedStrip(e.start,e.end,e.widthFt,e.foundation.joinStartFt,e.foundation.joinEndFt);
 }
 const next=entities.map(e=>ids.includes(e.id)?{...e,assemblyId}:e);
 const result=measureFoundation('assembly-preview',next);
 if(result.rows.filter(r=>ids.includes(r.elementId)).some(r=>r.status!=='measured'))throw Error('Selected assembly has unresolved quantities or external overlaps');
 return next;
}
