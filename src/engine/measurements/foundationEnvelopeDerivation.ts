import type {FoundationEntity,FoundationEnvelopeSource} from './measurementTypes';
import {rectangularExteriorRoute} from './foundationDrainageDerivation';
import {simplePolygon} from './roofMeasurements';
import {extendedStrip,faceToCentreline} from './foundationGeometry';
type Config=Omit<FoundationEnvelopeSource,'version'|'sourceId'|'groupId'|'perimeterWallIds'>;
const near=(a:number,b:number)=>Math.abs(a-b)<1e-8;
function geometry(source:FoundationEntity,s:FoundationEnvelopeSource,id:string,assemblyId:string,entities:FoundationEntity[]):FoundationEntity{
 const base={id,physicalId:id,assemblyId,source:{reference:'Derived '+s.purpose+' from '+source.id}};
 const foundation={version:1 as const,material:s.material,envelopeSource:s};
 if(s.purpose==='waterproofing'||s.purpose==='verticalInsulation'){
  if(source.kind!=='foundationWall'||!source.foundation?.centrelineConfirmed||source.widthFt===null||source.heightFt===null||!s.heightFt||s.heightFt>source.heightFt||!s.side)throw Error('Confirm wall width, centreline and sufficient coverage height');
  if(source.foundation.wallOpenings?.length)throw Error('Wall openings require explicit net coverage segments');
  let face=faceToCentreline(source.start,source.end,source.widthFt,s.side);
  if(s.perimeterWallIds){
   const perimeter=rectangularExteriorRoute(entities,s.perimeterWallIds,0);
   const walls=s.perimeterWallIds.map(id=>entities.find(e=>e.id===id)!);
   if(walls.some(e=>e.kind!=='foundationWall'||!e.foundation?.baseElevationConfirmed||e.elevationFt===null||e.heightFt===null||e.foundation.wallOpenings?.length||!near(e.elevationFt,source.elevationFt??Infinity)||!near(e.heightFt,source.heightFt!)))throw Error('Rectangular envelope requires equal confirmed wall bases and heights, without openings');
   const match=perimeter.map((start,i)=>({start,end:perimeter[(i+1)%4]})).find(e=>near(e.start.x,e.end.x)?near(face.start.x,e.start.x)&&near(face.end.x,e.start.x):near(face.start.y,e.start.y)&&near(face.end.y,e.start.y));
   if(!match)throw Error('Selected wall face is not exterior');
   face=match;
  }else{
   if(source.foundation.joinStartFt||source.foundation.joinEndFt)throw Error('Joined wall faces require explicit corner reconciliation');
   extendedStrip(source.start,source.end,source.widthFt);
  }
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
 return ids.map(sourceId=>{const source=entities.find(e=>e.id===sourceId);if(!source)throw Error('Missing envelope source');return geometry(source,{...config,version:1,sourceId,groupId},id(),assemblyId,entities)});
}
/** Complete exterior wall loop only; corners terminate at the actual outer vertices. */
export function deriveRectangularEnvelope(entities:FoundationEntity[],ids:string[],config:Config,id:()=>string):FoundationEntity[]{
 if(!['waterproofing','verticalInsulation'].includes(config.purpose)||!config.material.trim()||!config.layerId.trim())throw Error('Specify exterior coverage material and layer');
 const perimeterWallIds=[...ids].sort(),p=rectangularExteriorRoute(entities,perimeterWallIds,0);
 if(entities.some(e=>{const s=e.foundation?.envelopeSource;return s&&ids.includes(s.sourceId)&&s.purpose===config.purpose&&s.layerId===config.layerId}))throw Error('Remove existing derived layer before regenerating');
 const groupId=id(),assemblyId=id();
 return perimeterWallIds.map(sourceId=>{
  const source=entities.find(e=>e.id===sourceId)!;
  if(source.kind!=='foundationWall'||source.widthFt===null)throw Error('Expected confirmed wall');
  const side=(['left','right'] as const).find(side=>{const f=faceToCentreline(source.start,source.end,source.widthFt!,side);return p.some((a,i)=>{const b=p[(i+1)%4];return near(a.x,b.x)?near(f.start.x,a.x)&&near(f.end.x,a.x):near(f.start.y,a.y)&&near(f.end.y,a.y)})});
  if(!side)throw Error('Cannot identify exterior wall face');
  return geometry(source,{...config,side,version:1,sourceId,groupId,perimeterWallIds},id(),assemblyId,entities);
 });
}
export function validateEnvelopeSources(entities:FoundationEntity[]):void{
 const seen=new Set<string>(),groups=new Map<string,string>(),perimeters=new Map<string,FoundationEnvelopeSource[]>();
 for(const e of entities){const s=e.foundation?.envelopeSource;if(!s)continue;const source=entities.find(q=>q.id===s.sourceId);if(!source)throw Error('Missing derived envelope source');
 const key=JSON.stringify([s.sourceId,s.purpose,s.layerId]);if(seen.has(key))throw Error('Duplicate derived envelope layer');seen.add(key);
 if(s.perimeterWallIds){const g=perimeters.get(s.groupId)??[];g.push(s);perimeters.set(s.groupId,g)}
 const spec=JSON.stringify([e.assemblyId,s.purpose,s.perimeterWallIds?null:s.side,s.heightFt,s.depthFt,s.material,s.layerId,s.foam,s.perimeterWallIds?[...s.perimeterWallIds].sort():null]);if(groups.has(s.groupId)&&groups.get(s.groupId)!==spec)throw Error('Inconsistent envelope group');groups.set(s.groupId,spec);
 const expected=geometry(source,s,e.id,e.assemblyId,entities);
 const signature=(q:FoundationEntity)=>JSON.stringify(['polygon' in q?q.polygon:[q.start,q.end],'depthFt' in q?q.depthFt:null,'heightFt' in q?q.heightFt:null,'elevationFt' in q?q.elevationFt:null,q.foundation?.material,q.foundation?.baseElevationConfirmed,q.foundation?.coverage?.layerId,q.foundation?.coverage?.confirmed,q.foundation?.coverage?.openingTreatment,q.foundation?.coverage?.foam,q.foundation?.coverage?.thicknessFt]);
 if(signature(e)!==signature(expected))throw Error('Derived envelope is stale; remove or regenerate before editing source');
 }
 for(const g of perimeters.values())if(g.length!==4||new Set(g.map(s=>s.sourceId)).size!==4||g[0].perimeterWallIds!.some(id=>!g.some(s=>s.sourceId===id)))throw Error('Incomplete rectangular envelope group');
}
