import { orthogonalExteriorEdges } from './foundationExteriorRoute';
import type {
  AssemblySpecifications, ChildBinding, ChildRole, FoundationAssemblyRecord, MaterialChoice, Scope, SpecificationGap,
} from './foundationAssemblyModel';
import { foundationReleaseGroup, foundationRoleKey } from './foundationAssemblyValidation';
import { deriveStripFootings } from './foundationDerivation';
import { derivePerimeterDrainage } from './foundationDrainageDerivation';
import { generateOrthogonalFoundationPerimeter } from './foundationDrafting';
import { deriveFoundationEnvelope, deriveRectangularEnvelope } from './foundationEnvelopeDerivation';
import type { FoundationEntity, FoundationEnvelopeSource } from './measurementTypes';
import { orthogonalWallPerimeter } from './foundationPerimeterGeometry';

const isFoam=(material:MaterialChoice)=>material.kind==='catalogue'&&['eps','xps','polyisocyanurate'].includes(material.id);
const materialString = (choice: MaterialChoice):string => choice.kind==='custom'?choice.description:choice.id;
function value<T>(scope:Scope<T>,name:keyof T):NonNullable<T[keyof T]>|undefined {
  return scope.status==='included'?scope.specification[name]?.value:undefined;
}

export function regenerateFoundationAssembly(parent:FoundationAssemblyRecord, independent:FoundationEntity[]){
  const {trace,specifications:spec}=parent;
  const points=trace.vertices.map(v=>v.point);
  const released=new Set((parent.detachments??[]).filter(a=>a.disposition==='released').map(a=>foundationReleaseGroup(a.former.role)));
  const allowed=(system:ChildRole['system'],layerId:string|null=null)=>!released.has(JSON.stringify([system,system==='exterior'?layerId:null]));
  const previous=new Map([...parent.children,...parent.dormantChildren.map(b=>b.child)].map(b=>[foundationRoleKey(b.role),b]));
  const scopes=new Map(parent.componentScope.map(s=>[s.entityId,s.decision]));
  const gaps:SpecificationGap[]=[];
  const children:ChildBinding[]=[];
  const members:FoundationEntity[]=[];
  const allocated=new Map<string,ChildBinding>();
  function binding(role:ChildRole){
    const key=foundationRoleKey(role);
    const found=allocated.get(key)??previous.get(key);
    if(found)return found;
    const entityId=JSON.stringify(['foundation-child',parent.id,key]);
    const next={role,entityId,physicalId:entityId};
    allocated.set(key,next);
    return next;
  }
  function add(entity:FoundationEntity,role:ChildRole){
    const child=binding(role),scope=scopes.get(child.entityId);
    const {scopeApplicability:_previous,...data}=entity;
    children.push(child);
    const member:FoundationEntity={...data,id:child.entityId,physicalId:child.physicalId,...(scope&&scope.status!=='legacyAbsent'?{scopeApplicability:scope}:{})};
    members.push(member);
    return member;
  }
  function gap(system:keyof AssemblySpecifications,path:string,reason:string,blocks:SpecificationGap['blocks']=['quantity']){
    gaps.push({system,path,reason,blocks});
  }
  function fields<T,K extends keyof T>(scope:Scope<T>,system:keyof AssemblySpecifications,names:K[],prefix=String(system)){
    if(scope.status!=='included')return false;
    let complete=true;
    for(const name of names)if(value(scope,name)===undefined){gap(system,prefix+'.'+String(name),'Confirm '+String(name));complete=false;}
    return complete;
  }
  function derivedIds(key:string){
    let index=-2;
    return ()=>++index===-1?JSON.stringify([parent.id,key,'group']):JSON.stringify([parent.id,key,index]);
  }

  const wallsBySegment=new Map<string,FoundationEntity>();
  const wallScope=spec.walls;
  if(allowed('wall')&&fields(wallScope,'walls',['material','widthFt','heightFt','datum'])&&wallScope.status==='included'){
    const s=wallScope.specification;
    const width=s.widthFt!.value,height=s.heightFt!.value,datum=s.datum!.value;
    const base=datum.basis==='top'?datum.elevationFt-height:datum.elevationFt;
    const keys=[JSON.stringify([parent.id,'walls']),...trace.segments.map(source=>binding({system:'wall',sourceId:source.id}).entityId)];
    let index=0;
    const generated=generateOrthogonalFoundationPerimeter(points,trace.reference,width,height,base,()=>keys[index++]);
    generated.forEach((e,i)=>{
      const segment=trace.segments[i];
      const overrides=parent.overrides.filter(o=>o.system==='walls'&&o.sourceSegmentId===segment.id);
      if(overrides.length>1)throw Error('Resolve duplicate wall overrides');
      const override=overrides[0];
      const patch=override?.system==='walls'?override.patch:{};
      if(patch.widthFt!==undefined&&patch.widthFt!==width)throw Error('Variable wall width requires an explicitly engineered independent detail');
      const wallHeight=patch.heightFt??height;
      const wallDatum=patch.datum??datum;
      const elevation=wallDatum.basis==='top'?wallDatum.elevationFt-wallHeight:wallDatum.elevationFt;
      const openings=s.openings?.value.filter(o=>o.sourceSegmentId===segment.id).map(o=>o.opening);
      if(e.kind!=='foundationWall')throw Error('Expected generated foundation wall');
      wallsBySegment.set(segment.id,add({...e,heightFt:wallHeight,elevationFt:elevation,foundation:{
        ...e.foundation!,material:materialString(patch.material??s.material!.value),...(openings?.length?{wallOpenings:openings}:{})
      }},{system:'wall',sourceId:segment.id}));
    });
  }
  const walls=[...wallsBySegment.values()];
  const wallIds=walls.map(e=>e.id);
  const segmentByWall=new Map([...wallsBySegment].map(([key,e])=>[e.id,key]));
  const supportsWallDerivation=walls.length>0&&walls.every(e=>e.scopeApplicability?.status!=='pending'&&e.scopeApplicability?.status!=='excluded');
  const footingScope=spec.footing;
  let footingProjection:number|undefined;
  if(allowed('footing')&&fields(footingScope,'footing',['material','widthFt','depthFt','alignment','top'])&&footingScope.status==='included'){
    const s=footingScope.specification;
    const alignment=parent.overrides.find(o=>o.system==='footing')?.alignment??s.alignment!.value;
    const top=s.top!.value;
    if(!supportsWallDerivation)gap('footing','walls','An applicable complete wall perimeter is required');
    else if(top.kind==='explicit'&&walls.some(w=>!('elevationFt' in w)||w.elevationFt!==top.elevationFt))
      gap('footing','top','The strip engine requires top at the confirmed wall base. Use an independent detail.');
    else if(alignment.kind==='explicitOffset'&&alignment.offsetFt!==0)
      gap('footing','alignment','Offset strips require an isolated wall. Use an independent detail.');
    else{
      const width=s.widthFt!.value;
      const generated=deriveStripFootings([...independent,...members],wallIds,width,s.depthFt!.value,derivedIds('footing'));
      generated.forEach(e=>add(e,{system:'footing',sourceId:segmentByWall.get(e.foundation!.stripSource!.wallId)!}));
      const wallWidth=value(wallScope,'widthFt');
      if(typeof wallWidth==='number'&&width>=wallWidth&&members.filter(e=>e.kind==='stripFooting').every(e=>e.scopeApplicability?.status!=='excluded'&&e.scopeApplicability?.status!=='pending'))
        footingProjection=(width-wallWidth)/2;
    }
  }

  for(const layer of spec.exteriorLayers){
    if(!allowed('exterior',layer.id))continue;
    if(!fields(layer.scope,'exteriorLayers',['material','coverage'],'exteriorLayers.'+layer.id)||layer.scope.status!=='included')continue;
    const s=layer.scope.specification,choice=s.material!.value;
    const override=parent.overrides.find(o=>o.system==='exterior'&&o.layerId===layer.id);
    const coverage=override?.system==='exterior'?override.coverage:s.coverage!.value;
    const purpose=choice.category==='insulation'?'insulation':'waterproofing';
    const material=materialString(choice);
    const thicknessFt=s.thicknessFt?.value;
    if(coverage.kind==='manualNetSegments'){
      for(const line of coverage.segments){
        const key={system:'exterior',sourceId:line.id,layerId:layer.id} as const;
        const child=binding(key);
        add({kind:'foundationLine',purpose,start:line.start,end:line.end,heightFt:line.heightFt,
          id:child.entityId,physicalId:child.physicalId,assemblyId:parent.id,source:{reference:'Confirmed net exterior coverage'},
          foundation:{version:1,material,coverage:{confirmed:true,layerId:layer.id,openingTreatment:'none',...(isFoam(choice)?{foam:true as const}:{}),...(thicknessFt!==undefined?{thicknessFt}:{})}}},key);
      }
    }else if(!supportsWallDerivation)gap('exteriorLayers',layer.id+'.walls','Exterior face derivation requires an applicable complete wall perimeter');
    else{
      const sourceHeight=walls[0].kind==='foundationWall'?walls[0].heightFt:null;
      const heightFt=coverage.kind==='specifiedHeight'?coverage.heightFt:sourceHeight;
      if(heightFt===null)gap('exteriorLayers',layer.id+'.height','Confirm exterior coverage height');
      else deriveRectangularEnvelope([...independent,...members],wallIds,{
        purpose:purpose==='insulation'?'verticalInsulation':'waterproofing',material,layerId:layer.id,heightFt,...(isFoam(choice)?{foam:true as const}:{}),...(thicknessFt===undefined?{}:{depthFt:thicknessFt}),
      },derivedIds('exterior:'+layer.id)).forEach(e=>add(e,{system:'exterior',layerId:layer.id,sourceId:segmentByWall.get(e.foundation!.envelopeSource!.sourceId)!}));
    }
  }

  const drainage=spec.drainage;
  if(allowed('drainage')&&fields(drainage,'drainage',['route','material'])&&drainage.status==='included'){
    const s=drainage.specification,material=materialString(s.material!.value);
    const override=parent.overrides.find(o=>o.system==='drainage');
    const route=override?.system==='drainage'?override.route:s.route!.value;
    const attrs=s.attributes?.value;
    for(const name of ['nominalDiameterFt','pipeMaterial','perforation'] as const)
      if(!attrs?.[name])gap('drainage','attributes.'+name,'Specify '+name,['materialSpecification']);
    if(route.kind==='manual'){
      const vertices=new Map(route.vertices.map(v=>[v.id,v.point]));
      for(const edge of route.segments){
        const start=vertices.get(edge.startVertexId),end=vertices.get(edge.endVertexId);
        if(!start||!end)throw Error('Invalid manual drainage route');
        const key={system:'drainage',sourceId:edge.id} as const,child=binding(key);
        add({kind:'foundationLine',purpose:'drainage',start,end,id:child.entityId,physicalId:child.physicalId,
          assemblyId:parent.id,source:{reference:'Confirmed manual drainage route'},
          foundation:{version:1,material,coverage:{confirmed:true,layerId:parent.id}}},key);
      }
    }else if(!supportsWallDerivation)gap('drainage','route','Confirm applicable perimeter or use an independent route');
    else if(route.kind==='footingEdgeOffset'&&footingProjection===undefined)gap('drainage','route','Confirm a centred footing edge or choose an explicit alternate route');
    else{
      const offset=route.offsetFt+(route.kind==='footingEdgeOffset'?footingProjection!:0);
      const all=[...independent,...members];
      const edges=orthogonalExteriorEdges(all,wallIds,offset);
      const same=(a:{x:number;y:number},b:{x:number;y:number})=>Math.abs(a.x-b.x)<1e-8&&Math.abs(a.y-b.y)<1e-8;
      derivePerimeterDrainage(all,wallIds,offset,material,parent.id,derivedIds('drainage')).forEach(e=>{
        if(e.kind!=='foundationLine')throw Error('Expected drainage line');
        const matches=edges.filter(edge=>same(e.start,edge.start)&&same(e.end,edge.end)||same(e.start,edge.end)&&same(e.end,edge.start));
        if(matches.length!==1)throw Error('Drainage edge has no unambiguous source segment');
        add(e,{system:'drainage',sourceId:segmentByWall.get(matches[0].sourceId)!});
      });
    }
  }

  let slab:FoundationEntity|undefined;
  const slabScope=spec.slab;
  if(allowed('slab')&&fields(slabScope,'slab',['material','extent','thicknessFt','baseFt','footingRelation'])&&slabScope.status==='included'){
    const s=slabScope.specification,extent=s.extent!.value;
    const width=value(wallScope,'widthFt');
    const polygon=extent.kind==='independent'?extent.points:
      typeof width==='number'&&supportsWallDerivation?orthogonalWallPerimeter(points,width,trace.reference).interior:null;
    if(!polygon)gap('slab','extent','Confirm applicable interior walls or trace the slab independently');
    else{
      const child=binding({system:'slab'});
      slab=add({kind:'slab',purpose:'concrete',polygon,depthFt:s.thicknessFt!.value,elevationFt:s.baseFt!.value,
        id:child.entityId,physicalId:child.physicalId,assemblyId:parent.id,source:{reference:'Confirmed assembly slab'},
        foundation:{version:1,material:materialString(s.material!.value),baseElevationConfirmed:true,
          ...(s.openings?.value.length?{slabOpenings:s.openings.value}:{}),...(s.thickenings?.value.length?{slabThickenings:s.thickenings.value}:{})}},
      {system:'slab'});
    }
  }
  let below=0;
  for(const system of ['insulation','granular'] as const){
    const scope=spec[system];
    if(!allowed(system)){
      if(system==='insulation'&&spec.granular.status==='included'&&allowed('granular')){
        gap('granular','sequence','Confirm independent insulation separation before positioning granular');break;
      }
      continue;
    }
    if(scope.status==='excluded')continue;
    if(!fields(scope,system,['id','material','thicknessFt'])||scope.status!=='included'){
      if(system==='insulation'&&spec.granular.status==='included'){gap('granular','sequence','Resolve under-slab insulation before positioning granular');break;}
      continue;
    }
    if(!slab||slab.scopeApplicability?.status==='excluded'||slab.scopeApplicability?.status==='pending'){
      gap(system,'slab','Confirm an applicable slab with base elevation');continue;
    }
    const s=scope.specification,layerId=s.id!.value,depthFt=s.thicknessFt!.value;
    const purpose:FoundationEnvelopeSource['purpose']=system==='insulation'?'horizontalInsulation':'granular';
    const [member]=deriveFoundationEnvelope([...independent,...members],[slab.id],{
      purpose,material:materialString(s.material!.value),layerId,depthFt,offsetBelowSlabFt:below,
      ...(system==='insulation'&&isFoam(s.material!.value)?{foam:true as const}:{}),
    },derivedIds(system+':'+layerId));
    const result=add(member,{system,layerId});
    if(system==='insulation'&&result.scopeApplicability?.status==='pending'){gap('granular','sequence','Resolve pending insulation before positioning granular');break;}
    if(result.scopeApplicability?.status!=='excluded')below+=depthFt;
  }
  return {members,children,gaps};
}
