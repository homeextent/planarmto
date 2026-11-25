import type {FoundationEntity,FoundationEnvelopeSource} from './measurementTypes';
import {simplePolygon} from './roofMeasurements';
import {extendedStrip,faceToCentreline} from './foundationGeometry';
type Config=Omit<FoundationEnvelopeSource,'version'|'sourceId'|'groupId'>;
function geometry(source:FoundationEntity,s:FoundationEnvelopeSource,id:string,assemblyId:string):FoundationEntity{
 const base={id,physicalId:id,assemblyId,source:{reference:'Derived '+s.purpose+' from '+source.id}};
 const foundation={version:1 as const,material:s.material,envelopeSource:s};
 if(s.purpose==='waterproofing'||s.purpose==='verticalInsulation'){
  if(source.kind!=='foundationWall'||!source.foundation?.centrelineConfirmed||source.widthFt===null||source.heightFt===null||!s.heightFt||s.heightFt>source.heightFt||!s.side)throw Error('Confirm wall width, centreline and sufficient coverage height');
  if(source.foundation.wallOpenings?.length)throw Error('Wall openings require explicit net coverage segments');
  // Bounded isolated wall face only: joined corners need an exterior perimeter contract.
  if(source.foundation.joinStartFt||source.foundation.joinEndFt)throw Error('Joined wall faces require explicit corner reconciliation');
  extendedStrip(source.start,source.end,source.widthFt);
  const face=faceToCentreline(source.start,source.end,source.widthFt,s.side);
  return {...base,kind:'foundationLine',...face,purpose:s.purpose==='waterproofing'?'waterproofing':'insulation',heightFt:s.heightFt,foundation:{...foundation,coverage:{layerId:s.layerId,confirmed:true,openingTreatment:'none',...(s.foam?{foam:true as const}:{}),...(s.depthFt!==undefined?{thicknessFt:s.depthFt}:{})}}};
 }
 if(source.kind!=='slab'||!source.foundation||source.foundation.material!=='poured concrete'||!simplePolygon(source.polygon)||source.foundation.slabOpenings?.length||source.foundation.slabThickenings?.length)throw Error('Confirm an unexcluded, unthickened slab footprint; complex coverage must be drafted explicitly');
 if(!s.depthFt||s.depthFt<=0)throw Error('Specify positive layer thickness');
 const z=source.foundation.baseElevationConfirmed&&source.elevationFt!==null?source.elevationFt-s.depthFt:null;
 if(s.purpose==='granular'&&z===null)throw Error('Confirm slab base elevation for granular layer');
 return {...base,kind:'foundationRegion',purpose:s.purpose==='granular'?'granular':'insulation',polygon:source.polygon.map(p=>({...p})),depthFt:s.depthFt,elevationFt:z,foundation:{...foundation,...(z!==null?{baseElevationConfirmed:true as const}:{}),...(s.purpose==='horizontalInsulation'?{coverage:{layerId:s.layerId,confirmed:true as const,...(s.foam?{foam:true as const}:{})}}:{})}};
}
export function deriveFoundationEnvelope(entities:FoundationEntity[],ids:string[],config:Config,id:()=>string):FoundationEntity[]{
 if(!ids.length||new Set(ids).size!==ids.length||!config.material.trim()||!config.layerId.trim())throw Error('Select distinct sources and specify material and layer');
 if(entities.some(e=>{const s=e.foundation?.envelopeSource;return s&&ids.includes(s.sourceId)&&s.purpose===config.purpose&&s.layerId===config.layerId}))throw Error('Remove existing derived layer before regenerating');
 const groupId=id(),assemblyId=id();
 return ids.map(sourceId=>{const source=entities.find(e=>e.id===sourceId);if(!source)throw Error('Missing envelope source');return geometry(source,{...config,version:1,sourceId,groupId},id(),assemblyId)});
}
export function validateEnvelopeSources(entities:FoundationEntity[]):void{
 const seen=new Set<string>(),groups=new Map<string,string>();
 for(const e of entities){const s=e.foundation?.envelopeSource;if(!s)continue;const source=entities.find(q=>q.id===s.sourceId);if(!source)throw Error('Missing derived envelope source');
 const key=JSON.stringify([s.sourceId,s.purpose,s.layerId]);if(seen.has(key))throw Error('Duplicate derived envelope layer');seen.add(key);
 const spec=JSON.stringify([e.assemblyId,s.purpose,s.side,s.heightFt,s.depthFt,s.material,s.layerId,s.foam]);if(groups.has(s.groupId)&&groups.get(s.groupId)!==spec)throw Error('Inconsistent envelope group');groups.set(s.groupId,spec);
 const expected=geometry(source,s,e.id,e.assemblyId);
 const signature=(q:FoundationEntity)=>JSON.stringify(['polygon' in q?q.polygon:[q.start,q.end],'depthFt' in q?q.depthFt:null,'heightFt' in q?q.heightFt:null,'elevationFt' in q?q.elevationFt:null,q.foundation?.material,q.foundation?.baseElevationConfirmed,q.foundation?.coverage?.layerId,q.foundation?.coverage?.confirmed,q.foundation?.coverage?.openingTreatment,q.foundation?.coverage?.foam,q.foundation?.coverage?.thicknessFt]);
 if(signature(e)!==signature(expected))throw Error('Derived envelope is stale; remove or regenerate before editing source');
 }
}
