import {foundationDeletionTarget} from '../engine/measurements/foundationSelection';
import {describeFoundationTakeoff,groupFoundationTakeoff} from '../engine/measurements/foundationTakeoff';
import {FoundationInspectorContext} from './FoundationInspectorTabs';
import {foundationColor} from './foundationComponentStyle';
import { orthogonalWallPerimeter } from '../engine/measurements/foundationPerimeterGeometry';
import { addFoundationTraceNotch, moveFoundationTraceVertex } from '../engine/measurements/foundationTraceCorrection';
import { foundationReleaseGroup } from '../engine/measurements/foundationAssemblyValidation';
import React, { useContext, useEffect, useMemo, useState } from 'react';
import { v4 as uuid } from 'uuid';
import type { ProjectDocument } from '../engine/projectDocument';
import type {
  AssemblyChange, AssemblyIntent, AssemblyPreview, AssemblyTrace, TraceCorrectionAudit, AssemblySpecifications, DraftSpecification, FoundationAssemblyRecord,
  MaterialChoice, Scope, Source, FoundationPreset, PresetVersion, WallSpec, FootingSpec, LayerSpec, DrainageSpec, PresetLayer, ChildBinding,
} from '../engine/measurements/foundationAssemblyModel';
import { drainageCatalogueAttributes, foundationMaterialCatalogue } from '../engine/measurements/foundationMaterialCatalogue';
import type { FoundationEntity } from '../engine/measurements/measurementTypes';
import { measureFoundation } from '../engine/measurements/foundationMeasurements';
import { previewAssemblyChange } from '../engine/measurements/foundationAssemblyController';
import { FoundationDimensionInput } from './FoundationDimensionInput';
import { FoundationMaterialInput } from './FoundationMaterialInput';

const field='block w-full rounded bg-slate-800 border border-slate-600 p-1.5';
const button='rounded bg-sky-800 px-2 py-1 disabled:opacity-50';
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const confirmed=<T,>(value:T, confirmation:Source)=>({value,confirmation});
const pending={status:'pending',reason:'Awaiting confirmed scope'} as const;
type System=Exclude<keyof AssemblySpecifications,'exteriorLayers'|'exteriorSequence'>;
const labels:Record<System,string>={walls:'Walls',footing:'Strip footing',drainage:'Drainage',slab:'Slab',insulation:'Under-slab insulation',granular:'Granular fill'};
const concrete={kind:'catalogue',category:'concrete',id:'poured concrete'} as const;
const sources=(reference:string):Source=>({kind:'plan',reference});

function scopeFields<T>(scope:Scope<T>):DraftSpecification<T> {
  return scope.status==='included'?scope.specification:scope.retainedSpecification??{};
}

export function assemblyFromSelection(entities:FoundationEntity[],selectedId:string|undefined){
  const selected=entities.find(e=>e.id===selectedId);
  const reference=selected?.foundation?.perimeterReference;
  if(!selected||!reference)return null;
  const walls=entities.filter(e=>e.kind==='foundationWall'&&e.assemblyId===selected.assemblyId)
    .sort((a,b)=>(a.foundation?.perimeterReference?.edge??-1)-(b.foundation?.perimeterReference?.edge??-1));
  const first=walls[0];
  if(!first||first.kind!=='foundationWall'||first.widthFt===null||first.heightFt===null||first.elevationFt===null||
    walls.length!==reference.points.length||
    walls.some((w,i)=>w.kind!=='foundationWall'||w.widthFt!==first.widthFt||w.heightFt!==first.heightFt||
      w.elevationFt!==first.elevationFt||!same(w.foundation?.elevationReference,first.foundation?.elevationReference)||w.foundation?.perimeterReference?.edge!==i||
      !same(w.foundation.perimeterReference.points,reference.points)))return null;
  const source=sources('Existing confirmed perimeter trace');
  const vertices=reference.points.map((point,i)=>({point,id:'vertex-'+i}));
  const segments=vertices.map((v,i)=>({id:'segment-'+i,startVertexId:v.id,endVertexId:vertices[(i+1)%vertices.length].id}));
  const openings=walls.flatMap((w,i)=>(w.foundation?.wallOpenings??[]).map(opening=>({sourceSegmentId:segments[i].id,opening})));
  const input:AssemblyIntent={
    trace:{kind:reference.kind,reference:reference.reference,vertices,segments,source},overrides:[],
    specifications:{walls:{status:'included',specification:{
      material:confirmed(concrete,source),widthFt:confirmed(first.widthFt,source),heightFt:confirmed(first.heightFt,source),
      datum:confirmed({basis:'base',elevationFt:first.elevationFt,...(first.foundation?.elevationReference?{reference:first.foundation.elevationReference}:{})},source),...(openings.length?{openings:confirmed(openings,source)}:{}),
    }},footing:pending,exteriorLayers:[],drainage:pending,slab:pending,insulation:pending,granular:pending},
  };
  return {input, bindings:walls.map((w,i)=>({role:{system:'wall',sourceId:segments[i].id} as const,entityId:w.id,physicalId:w.physicalId}))};
}

export function independentWallLoop(entities:FoundationEntity[],ids:string[]){
  const selected=entities.filter(entity=>ids.includes(entity.id));
  if(selected.length<4||selected.some(entity=>entity.kind!=='foundationWall'))throw Error('Select at least four independent walls that form one closed perimeter.');
  if(selected.length!==ids.length||selected.some(w=>w.foundation?.perimeterReference)||
    entities.some(entity=>!ids.includes(entity.id)&&selected.some(w=>w.assemblyId===entity.assemblyId)))
    throw Error('Select independent walls without existing perimeter ownership or other group members.');
  const walls=selected.filter((e):e is FoundationEntity&{kind:'foundationWall'}=>e.kind==='foundationWall');
  const [first,...remaining]=walls;
  const equalPoint=(a:typeof first.start,b:typeof first.start)=>Math.hypot(a.x-b.x,a.y-b.y)<1e-8;
  const ordered=[first];
  while(remaining.length){
    const end=ordered.at(-1)!.end;
    const matches=remaining.filter(w=>equalPoint(w.start,end)||equalPoint(w.end,end));
    if(matches.length!==1)throw Error('Selected walls must meet end to end in one unbranched loop.');
    const wall=matches[0];
    remaining.splice(remaining.indexOf(wall),1);
    if(!equalPoint(wall.start,end))throw Error('Selected wall directions must follow the loop consistently.');
    ordered.push(wall);
  }
  if(!equalPoint(ordered.at(-1)!.end,first.start))throw Error('Close the perimeter before creating an assembly.');
  if(first.widthFt===null)throw Error('Confirm the same wall thickness around the perimeter.');
  const points=ordered.map(w=>w.start);
  const geometry=orthogonalWallPerimeter(points,first.widthFt,'centreline');
  const virtual=ordered.map((w,i)=>{
    const expected=geometry.segments[i];
    if(!w.foundation?.centrelineConfirmed||!w.foundation.baseElevationConfirmed||w.foundation.material!=='poured concrete'||
      Math.abs((w.foundation.joinStartFt??0)-expected.joinStartFt)>1e-8||Math.abs((w.foundation.joinEndFt??0)-expected.joinEndFt)>1e-8)
      throw Error('Confirm poured-concrete walls, common elevations and compatible corner extensions before adoption.');
    return {...w,assemblyId:first.assemblyId,foundation:{...w.foundation,perimeterReference:{version:1 as const,kind:'orthogonal' as const,reference:'centreline' as const,points,widthFt:first.widthFt!,edge:i}}};
  });
  const draft=assemblyFromSelection(virtual,first.id);
  if(!draft)throw Error('Wall dimensions or elevation references differ. Reconcile dimensions before adoption.');
  return draft;
}

export type TracedAssembly = {id:string;input:AssemblyIntent};
export function createTracedAssembly(points:AssemblyTrace['vertices'][number]['point'][],kind:AssemblyTrace['kind'],reference:AssemblyTrace['reference']):TracedAssembly {
  const source=sources('Graphically traced foundation perimeter');
  const vertices=points.map(point=>({point,id:uuid()}));
  const segments=vertices.map((v,i)=>({id:uuid(),startVertexId:v.id,endVertexId:vertices[(i+1)%vertices.length].id}));
  const id=uuid();
  const slabOnly=kind==='slab';
  const convention={kind:'estimatingAssumption',reference:'Contractor confirmed conventional construction on Apply'} as const;
  return {id,input:{
    trace:{kind,reference,vertices,segments,source},overrides:[],
    specifications:{walls:slabOnly?{status:'excluded',reason:'Standalone slab'}:{status:'included',specification:{material:confirmed(concrete,convention),datum:confirmed({basis:'base',elevationFt:0,reference:{kind:'assembly',id}},convention)}},footing:pending,exteriorLayers:[],drainage:pending,
      slab:slabOnly?{status:'included',specification:{extent:confirmed({kind:'independent',points},source),material:confirmed(concrete,convention)}}:pending,insulation:pending,granular:pending},
  }};
}

import { formatFoundationQuantity } from '../engine/measurements/foundationUnits';

type Props={
  key?:string;
  project:ProjectDocument;
  workspaceId:string;
  selectedId?:string;
  selectedIds?:string[];
  metric:boolean;
  traced?:TracedAssembly;
  deletionRequest?:{parentId:string};
  onCancelTrace:()=>void;
  onDraftChange:(draft:TracedAssembly)=>void;
  onApply:(preview:AssemblyPreview)=>boolean;
  onTraceEdit:(trace?:AssemblyTrace,onMove?:(index:number,point:{x:number;y:number})=>void)=>void;
  onPresets:(presets:FoundationPreset[])=>boolean;
  onPreview:(members:FoundationEntity[]|null,outline?:AssemblyTrace['vertices'][number]['point'][])=>void;
  onSelectChildren:(ids:string[])=>void;
};

export function FoundationAssemblyPanel({project,workspaceId,selectedId,selectedIds,metric,traced,deletionRequest,onCancelTrace,onDraftChange,onApply,onTraceEdit,onPresets,onPreview,onSelectChildren}:Props){
  const {tab,selectTab}=useContext(FoundationInspectorContext);
  useEffect(()=>{if(traced)selectTab('Construction')},[traced?.id]);
  const [newExterior,setNewExterior]=useState<string>();
  const [exteriorKinds,setExteriorKinds]=useState<Record<string,'waterproofing'|'insulation'>>({});
  const workspace=project.workspaces.find(w=>w.id===workspaceId)!;
  const parents=workspace.foundationAssemblies??[];
  const inherited=parents.find(p=>p.children.some(c=>c.entityId===selectedId||selectedIds?.includes(c.entityId)));
  const [editing,setEditing]=useState(false);
  const [focused,setFocused]=useState('');
  useEffect(()=>{if(inherited)setFocused(inherited.id)},[inherited?.id]);
  const [edit,setEdit]=useState<{parentId:string;revision:string;input:AssemblyIntent}>();
  const [preview,setPreview]=useState<AssemblyPreview|null>(null);
  const [additionalBindings,setAdditionalBindings]=useState<ChildBinding[]>([]);
  const [adoption,setAdoption]=useState<ReturnType<typeof assemblyFromSelection>>(null);
  const [reference,setReference]=useState('');
  const [presetName,setPresetName]=useState('');
  const [presetId,setPresetId]=useState('');
  const [presetError,setPresetError]=useState('');
  const [childStatus,setChildStatus]=useState<'included'|'excluded'|'pending'>('included');
  const [childReason,setChildReason]=useState('');
  const [detachReason,setDetachReason]=useState('');
  const [ownershipGroup,setOwnershipGroup]=useState('');
  const [traceEdge,setTraceEdge]=useState('0');
  const [notchOffset,setNotchOffset]=useState('');
  const [notchWidth,setNotchWidth]=useState('');
  const [notchDepth,setNotchDepth]=useState('');
  const [correctionError,setCorrectionError]=useState('');
  const [deleting,setDeleting]=useState(false);
  const [pickingCorner,setPickingCorner]=useState(false);
  const [correction,setCorrection]=useState<{id:string;revision:string;command:Extract<AssemblyChange,{kind:'correctTrace'}>}>();
  const presets=project.foundationPresets??[];
  const selectedPreset=presets.find(p=>p.id===presetId);
  const parent=traced?undefined:parents.find(p=>p.id===correction?.id&&p.revisionId===correction.revision)??parents.find(p=>p.id===focused)??inherited;
  const measured=useMemo(()=>parent?measureFoundation(workspaceId,workspace.measurements as FoundationEntity[]):null,[parent,workspace,workspaceId]);
  const ownedIds=new Set(parent?.children.map(binding=>binding.entityId));
  const summary=parent&&measured?groupFoundationTakeoff(measured.rows.filter(row=>ownedIds.has(row.elementId)),workspace.measurements as FoundationEntity[],[parent]):[];
  const selectedEdit=parent&&edit?.parentId===parent.id&&edit.revision===parent.revisionId?edit.input:
    parent?{trace:parent.trace,specifications:parent.specifications,overrides:parent.overrides,...(parent.preset?{preset:parent.preset}:{})}:undefined;
  const intent=traced?.input??adoption?.input??selectedEdit;
  const slabOnly=intent?.trace.kind==='slab';
  const inputReference=reference.trim()||(traced||parent&&!adoption?'Contractor confirmed foundation specification':'');
  const conventional=intent?.specifications.walls.status==='included'&&intent.specifications.walls.specification.datum?.value.reference?.kind==='assembly';
  const adoptable=!inherited?assemblyFromSelection(workspace.measurements as FoundationEntity[],selectedId):null;
  const pendingCorrection=correction&&parent?.id===correction.id&&parent.revisionId===correction.revision?correction:undefined;
  const activePreview=preview?.source===project&&(adoption&&!traced||preview.assemblyId===(traced?.id??parent?.id))?preview:null;
  const reviewedParent=activePreview?.changes?.parents.find(p=>p.id===activePreview.assemblyId);
  const reviewedSlab=reviewedParent?.specifications.slab;
  const completeNewDraft=!traced||!!reviewedParent?.children.some(c=>c.role.system===(slabOnly?'slab':'wall'))||
    slabOnly&&!!reviewedSlab&&reviewedSlab.status!=='included';
  useEffect(()=>{if(preview&&preview.source!==project)setPreview(null)},[project,preview]);
  function suggestions(system:System){
    const names=system==='walls'?['widthFt','heightFt']:system==='footing'?['widthFt','depthFt']:
      system==='slab'||system==='insulation'||system==='granular'?['thicknessFt']:[];
    return Object.fromEntries(names.map(name=>{
      const values=parents.flatMap(p=>{
        const scope=p.specifications[system] as Scope<Record<string,unknown>>;
        const value=scopeFields(scope)[name]?.value;
        return typeof value==='number'&&value>0?[value]:[];
      });
      return [name,[...new Set(values)].slice(0,12)];
    }));
  }
  function clearPreview(){setDeleting(false);setPickingCorner(false);setPreview(null);setCorrectionError('');onPreview(null);onTraceEdit()}
  function update(input:AssemblyIntent){
    if(traced)onDraftChange({id:traced.id,input});
    else if(adoption)setAdoption({...adoption,input});
    else if(parent)setEdit({parentId:parent.id,revision:parent.revisionId,input});
    clearPreview();
  }
  function setSystem(system:System,next:AssemblySpecifications[System]){
    if(!intent)return;
    if(conventional&&system==='footing'&&next.status==='included'){
      const footing=next as Scope<FootingSpec>&{status:'included'};
      const source={kind:'estimatingAssumption',reference:'Confirmed conventional centred strip footing under wall'} as const;
      const {alignment,top}=footing.specification;
      next={...footing,specification:{...footing.specification,alignment:alignment??confirmed({kind:'centred'},source),top:top??confirmed({kind:'wallBase'},source)}};
    }
    update({...intent,specifications:{...intent.specifications,[system]:next}});
  }
  function addExteriorLayer(category?:'waterproofing'|'insulation'){
    if(!intent)return;
    const id=uuid();
    setNewExterior(id);
    update({...intent,specifications:{...intent.specifications,exteriorSequence:{status:'unresolved'},exteriorLayers:[
      ...intent.specifications.exteriorLayers,{id,scope:{status:'included',specification:{}}},
    ]}});
    setExteriorKinds(old=>({...old,[id]:category??'waterproofing'}));
  }
  function moveExteriorLayer(from:number,to:number){
    if(!intent||to<0||to>=intent.specifications.exteriorLayers.length)return;
    const layers=[...intent.specifications.exteriorLayers];
    const [layer]=layers.splice(from,1);
    layers.splice(to,0,layer);
    update({...intent,specifications:{...intent.specifications,exteriorSequence:{status:'unresolved'},exteriorLayers:layers}});
  }
  function savePreset(){
    if(!intent||traced||!presetName.trim())return;
    const {walls,footing,exteriorLayers,drainage,insulation,granular}=intent.specifications;
    const restrict=<T,U>(scope:Scope<T>,map:(spec:DraftSpecification<T>)=>DraftSpecification<U>):Scope<U>=>
      scope.status==='included'?{status:'included',specification:map(scope.specification)}:
      {status:scope.status,reason:scope.reason,...(scope.retainedSpecification?{retainedSpecification:map(scope.retainedSpecification)}:{})};
    const version:PresetVersion={version:(selectedPreset?.versions.at(-1)?.version??0)+1,name:presetName.trim(),systems:{
      walls:restrict<WallSpec,Pick<WallSpec,'material'|'widthFt'|'heightFt'>>(walls,({datum:_datum,openings:_openings,...fields})=>fields),
      footing:restrict<FootingSpec, Omit<FootingSpec,'top'> & {top:{kind:'wallBase'}}>(footing,({top,...fields})=>({...fields,...(top?.value.kind==='wallBase'?{top:{...top,value:{kind:'wallBase' as const}}}:{})})),
      ...(intent.specifications.exteriorSequence?{exteriorSequence:intent.specifications.exteriorSequence}:{}),
      exteriorLayers:exteriorLayers.map(layer=>({...layer,scope:restrict<LayerSpec,PresetLayer>(layer.scope,({coverage,...fields})=>({...fields,...(
        coverage&&coverage.value.kind!=='manualNetSegments'?{coverage:{...coverage,value:coverage.value}}:{}
      )}))})),
      drainage:restrict<DrainageSpec,Omit<DrainageSpec,'route'> & {route:Exclude<DrainageSpec['route'],{kind:'manual'}>}>(drainage,({route,...fields})=>({...fields,...(route&&route.value.kind!=='manual'?{route:{...route,value:route.value}}:{})})),
      insulation,granular,
    }};
    const next:FoundationPreset=selectedPreset?{...selectedPreset,versions:[...selectedPreset.versions,version]}:{version:1,id:uuid(),versions:[version]};
    if(onPresets(presets.filter(p=>p.id!==next.id).concat(next))){setPresetId(next.id);setPresetError('');}
    else setPresetError('Preset could not be saved. Review the project storage limit and confirmed fields.');
  }
  function usePreset(){
    const version=selectedPreset?.versions.at(-1);
    if(!intent||!selectedPreset||!version||!inputReference)return;
    const source=sources(inputReference);
    const systems=version.systems;
    const provenance={kind:'presetSnapshot',presetId:selectedPreset.id,version:version.version,reference:inputReference} as const;
    const stamp=<T,>(scope:Scope<T>):Scope<T>=>{
      const fields=scopeFields(scope);
      const stamped=Object.fromEntries(Object.entries(fields).map(([key,entry])=>[key,{...(entry as {value:unknown}),confirmation:provenance}])) as DraftSpecification<T>;
      return scope.status==='included'?{status:'included',specification:stamped}:{...scope,retainedSpecification:stamped};
    };
    const {exteriorSequence:_priorSequence,...specified}=intent.specifications;
    const template:AssemblySpecifications={...specified,
      ...(systems.exteriorSequence?{exteriorSequence:systems.exteriorSequence.status==='confirmed'?{status:'confirmed',confirmation:provenance}:systems.exteriorSequence}:{}),
      walls:stamp<WallSpec>(systems.walls),footing:stamp<FootingSpec>(systems.footing),
      exteriorLayers:systems.exteriorLayers.map(layer=>({...layer,scope:stamp<LayerSpec>(layer.scope)})),
      drainage:stamp<DrainageSpec>(systems.drainage),
      insulation:stamp(systems.insulation),granular:stamp(systems.granular),
    } as AssemblySpecifications;
    if(template.walls.status==='included'&&intent.specifications.walls.status==='included'){
      const {datum,openings}=intent.specifications.walls.specification;
      template.walls={...template.walls,specification:{...template.walls.specification,...(datum?{datum}:{}),...(openings?{openings}:{})}};
    }
    update({...intent,specifications:template,preset:{presetId:selectedPreset.id,version,confirmation:source}});
  }
  const selectedEntity=workspace.measurements.find(e=>e.id===selectedId);
  const selectedSlab=selectedEntity?.kind==='slab'&&selectedEntity.depthFt!==null&&selectedEntity.elevationFt!==null&&
    selectedEntity.foundation?.baseElevationConfirmed&&selectedEntity.foundation.material==='poured concrete'?selectedEntity:null;
  const independentSelection=selectedIds?.length?selectedIds:selectedId?[selectedId]:[];
  function queue(bindings:ChildBinding[]){
    setAdditionalBindings(old=>[...old.filter(b=>!bindings.some(next=>next.role.system===b.role.system)),...bindings]);
  }
  function includeSlab(){
    if(!parent||!intent||!selectedSlab||!reference.trim())return;
    const source=sources(reference.trim());
    update({...intent,specifications:{...intent.specifications,slab:{status:'included',specification:{
      extent:confirmed({kind:'independent',points:selectedSlab.polygon},source),
      material:confirmed(concrete,source),thicknessFt:confirmed(selectedSlab.depthFt!,source),baseFt:confirmed(selectedSlab.elevationFt!,source),
      footingRelation:confirmed(source,source),...(selectedSlab.foundation?.elevationReference?{elevationReference:confirmed(selectedSlab.foundation.elevationReference,source)}:{}),...(selectedSlab.foundation?.slabOpenings?{openings:confirmed(selectedSlab.foundation.slabOpenings,source)}:{}),
      ...(selectedSlab.foundation?.slabThickenings?{thickenings:confirmed(selectedSlab.foundation.slabThickenings,source)}:{}),
    }}}});
    queue([{role:{system:'slab'},entityId:selectedSlab.id,physicalId:selectedSlab.physicalId}]);
  }
  function includeDrainage(){
    if(!parent||!intent||!reference.trim())return;
    const lines=workspace.measurements.filter((e):e is Extract<FoundationEntity,{kind:'foundationLine'}>=>independentSelection.includes(e.id)&&e.kind==='foundationLine'&&e.purpose==='drainage');
    const source=sources(reference.trim());
    const seenMaterial=lines[0]?.foundation?.material;
    if(!lines.length||lines.length!==independentSelection.length||!seenMaterial||lines.some(line=>line.foundation?.material!==seenMaterial||!line.foundation.coverage?.confirmed)){
      setPresetError('Select independent, confirmed drainage segments of one material.');return;
    }
    const remaining=lines.slice();
    const initial=lines.find(line=>!lines.some(other=>same(other.end,line.start)))??lines[0];
    let attach=initial;
    const vertices=[{id:uuid(),point:initial.start}];
    const segments: {id:string;startVertexId:string;endVertexId:string}[]=[];
    const bindings:ChildBinding[]=[];
    for(let i=0;i<lines.length;i++){
      remaining.splice(remaining.indexOf(attach),1);
      const closes=!remaining.length&&same(attach.end,initial.start);
      const end=closes?vertices[0]:{id:uuid(),point:attach.end};
      const segmentId=JSON.stringify(['route-segment',attach.id]);
      segments.push({id:segmentId,startVertexId:vertices.at(-1)!.id,endVertexId:end.id});
      if(!closes)vertices.push(end);
      bindings.push({role:{system:'drainage',sourceId:segmentId},entityId:attach.id,physicalId:attach.physicalId});
      if(remaining.length){
        const matches=remaining.filter(line=>same(line.start,attach.end));
        if(matches.length!==1){setPresetError('Manual route must form one directed, unbranched chain.');return;}
        attach=matches[0];
      }
    }
    const material:MaterialChoice=foundationMaterialCatalogue.drainage.some(([id])=>id===seenMaterial)
      ?{kind:'catalogue',id:seenMaterial,category:'drainage'}:{kind:'custom',id:uuid(),category:'drainage',description:seenMaterial};
    update({...intent,specifications:{...intent.specifications,drainage:{status:'included',specification:{
      material:confirmed(material,source),route:confirmed({kind:'manual',closed:segments.at(-1)!.endVertexId===vertices[0].id,vertices,segments},source),
    }}}});
    queue(bindings);setPresetError('');
  }
  function showPreview(next:AssemblyPreview,trace?:AssemblyTrace){
    setPreview(next);
    selectTab('Quantities');
    const owned=new Set(next.changes?.parents.find(p=>p.id===next.assemblyId)?.children.map(c=>c.entityId));
    onPreview(next.changes?.measurements.filter(e=>owned.has(e.id))??null,trace?.vertices.map(v=>v.point));
  }
  const groups=new Map(parent?.children.map(c=>[foundationReleaseGroup(c.role),c.role]));
  const released=new Map(parent?.detachments?.filter(a=>a.disposition==='released').map(a=>[foundationReleaseGroup(a.former.role),a.former.role]));
  const groupName=(role:ChildBinding['role'])=>role.system==='exterior'
    ? 'Exterior layer '+((parent?.specifications.exteriorLayers.findIndex(e=>e.id===role.layerId)??-1)+1)
    : labels[role.system==='wall'?'walls':role.system];
  function requestDetach(){
    if(!parent||!detachReason.trim()||!reference.trim())return;
    const roles=parent.children.filter(c=>foundationReleaseGroup(c.role)===ownershipGroup).map(c=>c.role);
    showPreview(previewAssemblyChange(project,workspaceId,parent.id,parent.revisionId,{
      kind:'detach',roles,reason:detachReason,source:sources(reference.trim()),
    },uuid));
  }
  function requestReadopt(){
    if(!parent||!intent||!reference.trim())return;
    const bindings=parent.detachments?.filter(a=>a.disposition==='released'&&foundationReleaseGroup(a.former.role)===ownershipGroup).map(a=>a.former)??[];
    if(!bindings.length)return;
    showPreview(previewAssemblyChange(project,workspaceId,parent.id,parent.revisionId,{
      kind:'replaceIntent',input:intent,adoption:{bindings,source:sources(reference.trim())},
    },uuid));
  }
  function requestCorrection(create:()=>{trace:AssemblyTrace;segments:TraceCorrectionAudit['segments']},reason=reference.trim()){
    setPickingCorner(false);
    if(!parent||!reason)return;
    if(edit?.parentId===parent.id&&edit.revision===parent.revisionId){
      setCorrectionError('Apply or cancel specification changes before editing the perimeter.');
      return;
    }
    try{
      const {trace,segments}=create();
      setCorrectionError('');
      const command={kind:'correctTrace',trace,segments,source:sources(reason)} as const;
      setCorrection({id:parent.id,revision:parent.revisionId,command});
      showPreview(previewAssemblyChange(project,workspaceId,parent.id,parent.revisionId,command,uuid),trace);
    }catch(error){setCorrectionError(error instanceof Error?error.message:String(error));}
  }
  function requestChildScope(){
    if(!parent||!selectedId||!parent.children.some(c=>c.entityId===selectedId)||!reference.trim())return;
    if(childStatus!=='included'&&!childReason.trim())return;
    showPreview(previewAssemblyChange(project,workspaceId,parent.id,parent.revisionId,{
      kind:'setComponentScope',entityIds:[selectedId],
      decision:childStatus==='included'?{status:'included'}:{status:childStatus,reason:childReason},
      confirmation:sources(reference.trim()),
    },uuid));
  }
  function request(){
    if(pendingCorrection){
      showPreview(previewAssemblyChange(project,workspaceId,pendingCorrection.id,pendingCorrection.revision,pendingCorrection.command,uuid),pendingCorrection.command.trace);
      return;
    }
    if(!intent)return;
    const id=traced?.id??(adoption?uuid():parent!.id);
    const slab=intent.specifications.slab;
    let input=intent;
    if(slab.status==='included'&&(slabOnly||conventional)&&!slab.specification.footingRelation&&!slab.specification.baseFt){
      const source={kind:'estimatingAssumption',reference:slabOnly?'Standalone slab bottom is slab-local zero':'Conventional slab bottom at confirmed wall base'} as const;
      input={...intent,specifications:{...intent.specifications,slab:{status:'included',specification:{
        ...slab.specification,footingRelation:confirmed(source,source),coverageBasis:confirmed('fullFootprintEstimate',source),
        ...(slabOnly?{baseFt:confirmed(0,source),elevationReference:confirmed({kind:'assembly',id},source)}:{
          extent:slab.specification.extent??confirmed({kind:'confirmedInterior'},source),
          bottomRelationship:confirmed('atWallBase',source),
        }),
      }}}};
    }
    const command:AssemblyChange=traced?{kind:'create',input}:adoption?{kind:'adopt',input,bindings:adoption.bindings,source:sources('Operator confirmed existing perimeter adoption')}:
      {kind:'replaceIntent',input,...(additionalBindings.length?{adoption:{bindings:additionalBindings,source:sources(reference.trim())}}:{})};
    showPreview(previewAssemblyChange(project,workspaceId,id,traced||adoption?null:parent!.revisionId,command,uuid));
  }
  function renderSystem(system:System){
    const scope=intent!.specifications[system];
    const editor=<SystemEditor system={system} scope={scope} metric={metric} reference={inputReference}
      conventional={conventional} slabOnly={slabOnly} suggestions={suggestions(system)} onChange={next=>setSystem(system,next)}/>;
    const primary=system===(slabOnly?'slab':'walls');
    if(primary)return <div key={system} style={{borderInlineStartColor:slabOnly?foundationColor.slab:foundationColor.wall}} className="rounded-lg border border-slate-700 border-l-4 bg-slate-800/50 p-2">{editor}</div>;
    const fields=scopeFields(scope as Scope<Record<string,unknown>>);
    const material=fields.material?.value as MaterialChoice|undefined;
    const label=material?.kind==='catalogue'?material.id:material?.description;
    const dimensions=(['widthFt','depthFt','thicknessFt'] as const).flatMap(name=>{
      const n=fields[name]?.value;
      return typeof n==='number'?[formatFoundationQuantity(metric?n*304.8:n*12,metric?'mm':'in',false)]:[];
    });
    const required=system==='footing'?['widthFt','depthFt']:system==='drainage'?['route']:['thicknessFt'];
    const unresolved=scope.status==='included'&&(!label||required.some(name=>fields[name]===undefined));
    const color=system==='footing'?foundationColor.footing:system==='slab'?foundationColor.slab:
      system==='insulation'?foundationColor.insulation:system==='granular'?foundationColor.granular:foundationColor.drainage;
    return <ConstructionCard key={(traced?.id??parent?.revisionId??'adoption')+system} accent={color}
      label={labels[system]} status={scope.status} summary={[label,...dimensions].filter(Boolean).join(' · ')}
      unresolved={unresolved}>{editor}</ConstructionCard>;
  }
  const selectionTarget=foundationDeletionTarget(parents,independentSelection);
  const canDelete=!!parent&&(!independentSelection.length||selectionTarget.kind==='complete'&&selectionTarget.parent.id===parent.id);
  const deletionBlocked=!!traced||!!edit||!!pendingCorrection||pickingCorner||!!adoption;
  function requestDeletion(targetId:string){
    const target=parents.find(candidate=>candidate.id===targetId);
    if(!target)return;
    if(deletionBlocked){setCorrectionError('Apply or cancel the active construction changes before deleting this assembly.');return;}
    clearPreview();setFocused(target.id);setEditing(true);setDeleting(true);
    showPreview(previewAssemblyChange(project,workspaceId,target.id,target.revisionId,{kind:'delete'},uuid));
  }
  useEffect(()=>{if(deletionRequest)requestDeletion(deletionRequest.parentId)},[deletionRequest]);
  const deleteButton=canDelete&&<button className={button} disabled={deletionBlocked||deleting} onClick={()=>requestDeletion(parent.id)}>Delete assembly</button>;
  const ownedSelection=new Set(inherited?.children.map(child=>child.entityId));
  const mixedSelection=selectionTarget.kind==='mixed'||(selectedIds?.length??0)>1&&selectedIds!.some(id=>!ownedSelection.has(id));
  const unrelatedSelection=!traced&&!adoption&&(mixedSelection||!!selectedId&&!inherited);
  const showConstruction=tab==='Construction'&&!unrelatedSelection;
  return <section className="space-y-2 text-xs" aria-label="Foundation assemblies">
    {intent&&(traced||adoption||editing)&&!unrelatedSelection&&<div role="group" aria-label="Construction transaction" className="sticky top-0 z-10 bg-slate-900 border-b border-slate-600 py-2 space-y-1">
        <p>{deleting?'Review assembly deletion':pendingCorrection?'Perimeter correction':activePreview?'Construction preview':traced||edit||adoption?'Construction draft':'Saved construction'}</p>
        <div className="flex flex-wrap gap-2">
        <button className={button} disabled={pickingCorner||deleting} aria-label="Preview assembly changes" onClick={request}>Preview</button>
        <button className={button} disabled={!activePreview?.changes||!completeNewDraft} aria-label={deleting?'Confirm delete assembly':'Apply assembly changes'} onClick={()=>{
          if(deleting&&!window.confirm('Delete this assembly and its construction layers? Independent construction stays. You can undo this change.'))return;
          if(activePreview&&onApply(activePreview)){setFocused(activePreview.assemblyId);setEdit(undefined);setAdoption(null);setAdditionalBindings([]);setCorrection(undefined);setNewExterior(undefined);onCancelTrace();clearPreview();selectTab('Construction');}
        }}>{deleting?'Confirm delete':'Apply'}</button>
        <button className={button} aria-label="Cancel assembly changes" onClick={()=>{setAdoption(null);setEdit(undefined);setAdditionalBindings([]);setCorrection(undefined);onCancelTrace();clearPreview();if(deleting)selectTab('Construction')}}>Cancel</button>
        </div>
        {activePreview&&<button type="button" className="text-sky-300 underline" onClick={()=>selectTab('Quantities')}>Review quantities and outstanding inputs{activePreview.unresolvedSpecifications.length>0?' ('+activePreview.unresolvedSpecifications.length+')':''}</button>}
        {activePreview&&!activePreview.changes&&tab!=='Quantities'&&<p role="alert">{activePreview.conflicts[0]?.message??'No changes to apply. Revise the specification and preview again.'}</p>}
        {!activePreview&&<p className="text-slate-300">Preview the current specification to enable Apply.</p>}
      </div>}
    <div hidden={tab!=='Construction'||unrelatedSelection}>
    <h3 className="font-semibold">{traced?(slabOnly?'Specify slab construction':'Specify foundation construction'):'Foundation assemblies'}</h3>
    {traced&&<p>{slabOnly?'Confirm the slab footprint and enter concrete thickness.':'Confirm the traced reference and enter the wall thickness and height.'} Review quantities before applying.</p>}
    </div>
    <div hidden={tab!=='Geometry'} className="space-y-2">
    {!traced&&parents.length>0&&<label className="block">Assembly
      <select aria-label="Foundation assembly" disabled={!!pendingCorrection||pickingCorner} className={field} value={parent?.id??''} onChange={e=>{setFocused(e.target.value);setEditing(false);setAdoption(null);setAdditionalBindings([]);clearPreview()}}>
        <option value="">Select assembly</option>
        {parents.map((p,i)=><option key={p.id} value={p.id}>{p.trace.kind==='slab'?'Slab':'Perimeter'} {i+1}</option>)}
      </select>
    </label>}
    {!traced&&!adoption&&selectedIds&&selectedIds.length>=4&&!inherited&&<button className={button} onClick={()=>{
      try{const draft=independentWallLoop(workspace.measurements as FoundationEntity[],selectedIds);setAdoption(draft);clearPreview();}
      catch(error){setCorrectionError(error instanceof Error?error.message:String(error));}
    }}>Create assembly from selected wall loop</button>}
    </div>
    <div hidden={tab!=='Construction'} className="space-y-2">
    {!traced&&adoptable&&!adoption&&<button className={button} onClick={()=>{setAdoption(adoptable);clearPreview()}}>Configure assembly from selected perimeter</button>}
    {parent&&!adoption&&!unrelatedSelection&&<>
      <p className="text-slate-200">{parent.trace.kind==='slab'?'Selected standalone slab':'Selected foundation perimeter'}</p>
      <button className={button} onClick={()=>setEditing(true)}>Edit assembly</button>
      {deleteButton}
    </>}
    </div>
    <div hidden={tab!=='Geometry'} className="space-y-2">
    {parent&&!adoption&&!unrelatedSelection&&<div className="flex flex-wrap gap-2">
      {<button className={button} onClick={()=>{
        if(edit?.parentId===parent.id&&edit.revision===parent.revisionId){
          setCorrectionError('Apply or cancel specification changes before editing the perimeter.');
          return;
        }
        setEditing(true);clearPreview();setPickingCorner(true);
        onTraceEdit(parent.trace,(index,point)=>requestCorrection(()=>({trace:moveFoundationTraceVertex(parent.trace,index,point),segments:[]}),'Contractor confirmed graphical perimeter correction'));
      }}>{parent.trace.kind==='slab'?'Edit slab footprint':'Edit perimeter'}</button>}
      <button className={button} onClick={()=>onSelectChildren(parent.children.map(c=>c.entityId))}>Select assembly components</button>
      {deleteButton}
    </div>}
    {(traced||parent)&&!unrelatedSelection&&<p className="text-slate-300" aria-label="Construction footprint">{describeTrace((traced?.input.trace??parent?.trace)!,metric)}</p>}
    </div>
    <div hidden={tab!=='Quantities'||unrelatedSelection}>
    {parent&&summary.length>0&&<details className="space-y-1">
      <summary>Assembly material quantities</summary>
      <ul>{summary.map(row=><li key={row.key}>
        {describeFoundationTakeoff(row,metric)} · {row.code.replace('foundation.','').replaceAll('.',' ')} · {row.known?formatFoundationQuantity(row.quantity,row.unit,metric):'Not quantified'}
        {row.pending?' · '+row.pending+' unresolved':''}{row.unit==='BF'?' · informational':''}
      </li>)}</ul>
      {measured?.footprintReferences.filter(ref=>parent.children.some(c=>c.entityId===ref.elementId)).map(ref=>
        <p key={ref.elementId}>Slab footprint reference · {ref.netSF===null?'Not quantified':formatFoundationQuantity(ref.netSF,'SF',metric)}</p>)}
    </details>}
    </div>
    <div hidden={!showConstruction}>
    {intent&&(traced||adoption||editing)&&!pendingCorrection&&!pickingCorner&&!deleting&&<>
      {!traced&&<label className="block">Reference for revised specifications
        <input className={field} value={reference} onChange={e=>setReference(e.target.value)}/>
      </label>}
      {adoption&&!traced?<p>Preview adoption of the selected perimeter. Existing component decisions are retained.</p>:
        <>
          <details className="space-y-1 mb-2">
            <summary>Advanced assembly inputs</summary>
            {parent&&parent.trace.kind!=='slab'&&<fieldset className="border border-slate-700 p-2 space-y-1">
              <legend>Correct saved perimeter</legend>
              <button className={button} disabled={!reference.trim()} onClick={()=>{
                clearPreview();setPickingCorner(true);
                onTraceEdit(parent.trace,(index,point)=>requestCorrection(()=>({trace:moveFoundationTraceVertex(parent.trace,index,point),segments:[]})));
              }}>Move trace vertex on canvas</button>
              <details><summary>Add orthogonal inset or projection</summary>
                <label className="block">Trace edge<select className={field} value={traceEdge} onChange={e=>setTraceEdge(e.target.value)}>
                  {parent.trace.segments.map((edge,i)=><option key={edge.id} value={i}>Edge {i+1}</option>)}
                </select></label>
                <FoundationDimensionInput label="Distance from edge start" className={field} metric={metric} value={notchOffset} onChange={setNotchOffset}/>
                <FoundationDimensionInput label="Inset width" className={field} metric={metric} value={notchWidth} onChange={setNotchWidth}/>
                <FoundationDimensionInput label="Signed depth (left positive)" className={field} metric={metric} value={notchDepth} onChange={setNotchDepth}/>
                <button className={button} disabled={!reference.trim()} onClick={()=>requestCorrection(()=>addFoundationTraceNotch(parent.trace,
                  Number(traceEdge),Number(notchOffset),Number(notchWidth),Number(notchDepth),uuid))}>Preview trace edge replacement</button>
              </details>
            </fieldset>}
            {parent&&(groups.size>0||released.size>0)&&<fieldset className="border border-slate-700 p-2 space-y-1">
              <legend>Component ownership</legend>
              <label className="block">Ownership group<select className={field} value={ownershipGroup} onChange={e=>setOwnershipGroup(e.target.value)}>
                <option value="">Select system or layer</option>
                {[...groups].map(([key,role])=><option key={key} value={key}>{groupName(role)}</option>)}
                {[...released].map(([key,role])=><option key={key} value={key}>{groupName(role)} · independent</option>)}
              </select></label>
              {groups.has(ownershipGroup)&&<>
                <label className="block">Confirmed detachment reason<input className={field} value={detachReason} onChange={e=>setDetachReason(e.target.value)}/></label>
                <button className={button} disabled={!detachReason.trim()||!reference.trim()} onClick={requestDetach}>Preview detachment</button>
              </>}
              {released.has(ownershipGroup)&&<button className={button} disabled={!reference.trim()} onClick={requestReadopt}>Preview re-adoption</button>}
            </fieldset>}
            <button className={button} disabled={!selectedSlab||!reference.trim()} onClick={includeSlab}>Adopt selected independent slab and confirm its footing relation</button>
            <button className={button} disabled={!independentSelection.length||!reference.trim()} onClick={includeDrainage}>Adopt selected independent drainage route</button>
            {parent?.children.some(c=>c.entityId===selectedId)&&<fieldset className="space-y-1 border border-slate-700 p-2">
              <legend>Selected owned component</legend>
              <p>Saved scope: {parent.componentScope.find(c=>c.entityId===selectedId)?.decision.status??'No explicit decision'}</p>
              <label className="block">Component applicability
                <select className={field} value={childStatus} onChange={e=>setChildStatus(e.target.value as typeof childStatus)}>
                  <option value="included">Included</option><option value="excluded">Excluded</option><option value="pending">Pending</option>
                </select>
              </label>
              {childStatus!=='included'&&<label className="block">Component scope reason<input className={field} value={childReason} onChange={e=>setChildReason(e.target.value)}/></label>}
              <button className={button} disabled={!reference.trim()||childStatus!=='included'&&!childReason.trim()} onClick={requestChildScope}>Preview component scope decision</button>
            </fieldset>}
            {additionalBindings.length>0&&<p>{additionalBindings.length} selected components queued for adoption preview</p>}
            {presetError&&<p role="alert">{presetError}</p>}
          </details>
          <details className="space-y-1">
            <summary>Project presets</summary>
            <label className="block">Preset<select className={field} value={presetId} onChange={e=>setPresetId(e.target.value)}>
              <option value="">New project preset</option>
              {presets.map(p=><option key={p.id} value={p.id}>{p.versions.at(-1)?.name}</option>)}
            </select></label>
            <label className="block">Preset name<input className={field} value={presetName} onChange={e=>setPresetName(e.target.value)}/></label>
            <button className={button} disabled={!!traced||!presetName.trim()} onClick={savePreset}>Save preset version</button>
            <button className={button} disabled={!selectedPreset||!inputReference} onClick={usePreset}>Use confirmed preset in draft</button>
            {presetError&&<p role="alert">{presetError}</p>}
          </details>
      {traced&&!slabOnly&&conventional&&<p>Wall base is the local estimating reference. Review and Apply confirm this convention.</p>}
          <div className="space-y-2">
            {renderSystem(slabOnly?'slab':'walls')}
            {!slabOnly&&<section aria-label="Supporting construction" className="space-y-2">
              <h4 className="font-semibold">Supporting construction</h4>
              {renderSystem('footing')}{renderSystem('drainage')}
            </section>}
          </div>
          {!slabOnly&&<>
          <section className="space-y-2" aria-label="Exterior protection">
          <h4 className="font-semibold">Exterior protection</h4>
          <p className="text-slate-300">Layers are ordered from the wall outward. Quantities use the confirmed wall face.</p>
          <div className="flex flex-wrap gap-1">
            <button className={button} onClick={()=>addExteriorLayer('waterproofing')}>Add waterproofing</button>
            <button className={button} onClick={()=>addExteriorLayer('insulation')}>Add vertical insulation</button>
            <button className={button} onClick={()=>addExteriorLayer()}>Add another exterior layer</button>
          </div>
          {intent.specifications.exteriorLayers.map((layer,i)=>{
            const saved=scopeFields<LayerSpec>(layer.scope);
            const kind=saved.material?.value.category??exteriorKinds[layer.id];
            const name=kind==='insulation'?'Vertical insulation':'Waterproofing';
            const material=saved.material?.value;
            const summary=material?.kind==='catalogue'?material.id:material?.description;
            const coverage=saved.coverage?.value;
            const coverageSummary=coverage?.kind==='confirmedFullHeight'?'Full wall height':
              coverage?.kind==='specifiedHeight'?formatFoundationQuantity(coverage.heightFt,'LF',metric)+' height':
              coverage?.kind==='manualNetSegments'?'Specified net coverage':undefined;
            return <ConstructionCard key={(traced?.id??parent?.revisionId??'adoption')+layer.id} accent={kind==='insulation'?foundationColor.insulation:foundationColor.waterproofing}
              label={(i+1)+'. '+name} status={layer.scope.status} summary={[summary,coverageSummary].filter(Boolean).join(' · ')}
              unresolved={layer.scope.status==='included'&&(!material||!coverage||kind==='insulation'&&!saved.thicknessFt)} initiallyOpen={newExterior===layer.id}>
            <SystemEditor system="exteriorLayers" initialExterior={exteriorKinds[layer.id]} label={'Exterior layer '+(i+1)}
            metric={metric} wallHeight={scopeFields<WallSpec>(intent.specifications.walls).heightFt?.value} reference={inputReference} scope={layer.scope} onChange={next=>{
              const scope=next as typeof layer.scope;
              const changed=scope.status!==layer.scope.status||!same(scopeFields<LayerSpec>(scope).material?.value,scopeFields<LayerSpec>(layer.scope).material?.value);
              update({...intent,specifications:{...intent.specifications,...(changed?{exteriorSequence:{status:'unresolved'}}:{}),
              exteriorLayers:intent.specifications.exteriorLayers.map(l=>l.id===layer.id?{...l,scope:next as typeof l.scope}:l),
            }})}}/>
            <div className="flex gap-2">
              <button className={button} disabled={!i} onClick={()=>moveExteriorLayer(i,i-1)}>Move layer {i+1} toward wall</button>
              <button className={button} disabled={i===intent.specifications.exteriorLayers.length-1} onClick={()=>moveExteriorLayer(i,i+1)}>Move layer {i+1} outward</button>
            </div>
          </ConstructionCard>})}
          {intent.specifications.exteriorLayers.length>0&&<label className="block"><input type="checkbox" checked={intent.specifications.exteriorSequence?.status==='confirmed'}
            onChange={e=>{
              const exteriorSequence=e.target.checked?{status:'confirmed' as const,confirmation:sources(inputReference)}:{status:'unresolved' as const};
              update({...intent,specifications:{...intent.specifications,exteriorSequence}});
            }}/> Confirm exterior layer order</label>}
          </section></>}
          <section aria-label={slabOnly?'Under-slab construction':'Interior construction'} className="space-y-2 mt-3">
            <h4 className="font-semibold">{slabOnly?'Under-slab construction':'Interior construction'}</h4>
            {!slabOnly&&renderSystem('slab')}{renderSystem('insulation')}{renderSystem('granular')}
          </section>
        </>}
    </>}
    </div>
    {correctionError&&<p role="alert">{correctionError}</p>}
    <div hidden={tab!=='Quantities'||unrelatedSelection}>
    {activePreview&&<section id="foundation-review" aria-label="Assembly preview details" className="space-y-1">
      {activePreview.conflicts.map(c=><p role="alert" key={c.code}>{c.message}</p>)}
      {activePreview.unresolvedSpecifications.map((gap,i)=><p className="text-amber-300" key={gap.path+i}>{gap.reason}</p>)}
      {reviewedSlab?.status==='included'&&reviewedSlab.specification.coverageBasis?.value==='fullFootprintEstimate'&&<p>
        {reviewedSlab.specification.bottomRelationship?.value==='atWallBase'?'Standard slab bottom is at the confirmed wall base.':
          reviewedSlab.specification.elevationReference?.value.kind==='assembly'?'The slab bottom is the local estimating reference.':''}
        {' '}Included insulation and granular base use the full confirmed slab footprint for estimating. Actual net installed coverage can differ. Quantities use the specified thickness and include only specified layers.
      </p>}
      {activePreview.changes&&<PreviewMaterialChanges
        preview={activePreview}
        before={workspace.measurements as FoundationEntity[]}
        previous={parent}
        metric={metric}
      />}
    </section>}
    </div>
  </section>;
}

function ConstructionCard({accent,label,status,summary,unresolved,initiallyOpen=false,children}:{
  key?:string;accent:string;label:string;status:string;summary:string;unresolved:boolean;initiallyOpen?:boolean;children:React.ReactNode;
}){
  const [open,setOpen]=useState(initiallyOpen);
  useEffect(()=>setOpen(initiallyOpen),[initiallyOpen]);
  return <details open={open} onToggle={e=>setOpen(e.currentTarget.open)} style={{borderInlineStartColor:accent}}
    className="rounded-lg border border-slate-700 border-l-4 bg-slate-800/50">
    <summary className="cursor-pointer px-3 py-2.5 hover:bg-slate-700/60">
      <span className="font-semibold">{label}</span><span className="ml-1 text-slate-300"> · {status}</span>
      {summary&&<span className="block mt-1 text-slate-300">{summary}</span>}
      {unresolved&&<span className="block mt-1 text-amber-300">Inputs required</span>}
    </summary>
    <div className="space-y-2 px-2 pb-2">{children}</div>
  </details>;
}

function describeTrace(trace:AssemblyTrace,metric:boolean){
  const points=trace.vertices.map(v=>v.point);
  const width=Math.max(...points.map(p=>p.x))-Math.min(...points.map(p=>p.x));
  const depth=Math.max(...points.map(p=>p.y))-Math.min(...points.map(p=>p.y));
  const rectangle=points.length===4&&points.every((p,i)=>{
    const next=points[(i+1)%4];
    return (p.x===next.x)!==(p.y===next.y);
  });
  return rectangle?formatFoundationQuantity(width,'LF',metric)+' × '+formatFoundationQuantity(depth,'LF',metric)+' · '+trace.reference+' footprint':
    points.length+' edges · '+trace.reference+' footprint';
}

function PreviewMaterialChanges({preview,before,previous,metric}:{
  preview:AssemblyPreview;before:FoundationEntity[];previous?:NonNullable<ProjectDocument['workspaces'][number]['foundationAssemblies']>[number];metric:boolean;
}){
  const changes=preview.changes!;
  const next=changes.parents.find(parent=>parent.id===preview.assemblyId);
  const beforeIds=new Set((previous?.children??[]).map(child=>child.entityId));
  const afterIds=new Set((next?.children??[]).map(child=>child.entityId));
  for(const child of changes.detached)afterIds.add(child.entityId);
  const previouslyAdopted=new Set(previous?.adoption?.entityIds??[]);
  for(const child of next?.adoption?.entityIds??[])if(!previouslyAdopted.has(child))beforeIds.add(child);
  type MaterialTotal={label:string;unit:AssemblyPreview['quantities']['before'][number]['unit'];quantity:number;known:number;pending:number};
  function aggregate(rows:AssemblyPreview['quantities']['before'],entities:FoundationEntity[],ids:Set<string>){
    const materials=new Map(entities.map(e=>[e.id,e.foundation?.material]));
    const totals=new Map<string,MaterialTotal>();
    for(const row of rows){
      if(!ids.has(row.elementId))continue;
      const material=materials.get(row.elementId)??'Material unresolved';
      const key=JSON.stringify([material,row.code,row.unit]);
      const total=totals.get(key)??{label:material+' · '+row.code.replace('foundation.','').replaceAll('.',' '),unit:row.unit,quantity:0,known:0,pending:0};
      if(row.status==='measured'){total.quantity+=row.quantity;total.known++;}
      else total.pending++;
      totals.set(key,total);
    }
    return totals;
  }
  const old=aggregate(preview.quantities.before,before,beforeIds);
  const current=aggregate(preview.quantities.after,changes.measurements,afterIds);
  const show=(total:MaterialTotal|undefined)=>!total?'None':
    (total.known?formatFoundationQuantity(total.quantity,total.unit,metric)+(total.unit==='BF'?' (informational)':''):'Unquantified')+(total.pending?' · '+total.pending+' unresolved':'');
  const replacements=next?.replacements.filter(row=>row.revisionId===next.revisionId)??[];
  const prior=new Map(before.map(entity=>[entity.id,JSON.stringify(entity)]));
  const retained=new Set(changes.retained.map(child=>child.entityId));
  const revised=changes.measurements.filter(entity=>retained.has(entity.id)&&prior.get(entity.id)!==JSON.stringify(entity)).length;
  return <>
    <table className="w-full text-left border-separate border-spacing-y-1" aria-label="Preview quantities"><thead><tr><th>Material</th><th className="px-1.5 text-right">Before</th><th className="pl-1.5 text-right">After</th></tr></thead>
      <tbody>{[...new Set([...old.keys(),...current.keys()])].map(key=><tr key={key}>
        <th scope="row" className="font-medium pr-1.5">{(current.get(key)??old.get(key))!.label}</th><td className="px-1.5 text-right align-top tabular-nums">{show(old.get(key))}</td><td className="pl-1.5 text-right align-top tabular-nums">{show(current.get(key))}</td>
      </tr>)}</tbody>
    </table>
    <p role="status">{changes.created.length} added, {changes.retained.length} retained ({revised} revised), {changes.retired.length} removed, {changes.detached.length} released as independent</p>
    <p>{replacements.length} replaced by {new Set(replacements.flatMap(row=>row.successorIds)).size} successor components</p>
  </>;
}

type EditableScope=AssemblySpecifications[System]|AssemblySpecifications['exteriorLayers'][number]['scope'];
function SystemEditor({system,label,scope,initialExterior,metric,reference,conventional,slabOnly,suggestions,wallHeight,onChange}:{
  key?:string;initialExterior?:'waterproofing'|'insulation';system:System|'exteriorLayers';label?:string;scope:EditableScope;metric:boolean;reference:string;conventional?:boolean;slabOnly?:boolean;wallHeight?:number;suggestions?:Record<string,number[]>;onChange:(next:EditableScope)=>void;
}){
  const fields=scopeFields(scope as Scope<Record<string,unknown>>);
  const source=sources(reference.trim());
  function change(name:string,value:unknown){
    if(scope.status!=='included'||!reference.trim())return;
    const { [name]:_old,...remainder }=fields;
    if(system==='drainage'&&name==='material'&&value){
      const choice=value as MaterialChoice;
      const catalogueAttributes=choice.kind==='catalogue'?drainageCatalogueAttributes(choice.id):{};
      const {pipeMaterial:_oldMaterial,perforation:_oldPerforation,...prior}=(fields.attributes?.value??{}) as Record<string,unknown>;
      const attributes={...prior,...Object.fromEntries(Object.entries(catalogueAttributes).map(([key,value])=>[key,confirmed(value,source)]))};
      onChange({...scope,specification:{...fields,material:confirmed(choice,source),attributes:confirmed(attributes,source)}} as EditableScope);
      return;
    }
    onChange({...scope,specification:{...remainder,...(value===undefined?{}:{[name]:confirmed(value,source)})}} as EditableScope);
  }
  const value=(name:string)=>fields[name]?.value;
  const dimension=(name:string,label:string,section=false)=> <FoundationDimensionInput label={label} metric={metric} compound section={section} className={field} suggestions={suggestions?.[name]}
    value={typeof value(name)==='number'?String(value(name)):''} onChange={v=>change(name,v&&Number.isFinite(Number(v))?Number(v):undefined)}/>;
  const numeric=(existing:unknown,label:string,section:boolean,set:(value:number|undefined)=>void)=><FoundationDimensionInput label={label} className={field}
    metric={metric} compound section={section} value={typeof existing==='number'?String(existing):''}
    onChange={v=>set(v&&Number.isFinite(Number(v))?Number(v):undefined)}/>;
  const datum=value('datum') as WallSpec['datum']|undefined;
  const material=value('material') as MaterialChoice|undefined;
  const [exteriorMaterial,setExteriorMaterial]=useState<'waterproofing'|'insulation'>(initialExterior??'waterproofing');
  const exteriorCategory=material?.category==='insulation'||material?.category==='waterproofing'?material.category:exteriorMaterial;
  const materialCategory=system==='drainage'?'drainage':system==='insulation'?'insulation':system==='granular'?'granular':system==='exteriorLayers'?exteriorCategory:'concrete';
  return <fieldset className="border border-slate-700 rounded p-2 space-y-1">
    <legend>{label??labels[system as System]}</legend>
    <label className="block">Scope
      <select aria-label={(label??labels[system as System])+' scope'} className={field} value={scope.status} onChange={e=>{
        const status=e.target.value as EditableScope['status'];
        const concreteSystem=system==='walls'||system==='footing'||system==='slab';
        const include=concreteSystem&&!fields.material&&scope.status!=='included'&&Object.keys(fields).length===0
          ?{...fields,material:confirmed(concrete,source)}:fields;
        onChange((status==='included'?{status,specification:include}:{status,reason:'',retainedSpecification:fields}) as EditableScope);
      }}><option value="included">Included</option><option value="excluded">Excluded</option><option value="pending">Pending</option></select>
    </label>
    {scope.status!=='included'?<label className="block">Reason<input className={field} value={scope.reason} onChange={e=>onChange({...scope,reason:e.target.value})}/></label>:
      <fieldset disabled={!reference.trim()} className="space-y-1">
        {system==='exteriorLayers'&&<label className="block">Exterior layer kind
          <select className={field} value={exteriorCategory} onChange={e=>{setExteriorMaterial(e.target.value as typeof exteriorMaterial);change('material',undefined)}}>
            <option value="waterproofing">Waterproofing</option><option value="insulation">Insulation</option>
          </select>
        </label>}
        <FoundationMaterialInput key={materialCategory} label="Material" category={materialCategory} className={field}
          value={material?.kind==='catalogue'?material.id:material?.description??''}
          onChange={(v,custom)=>change('material',v?custom
            ?{kind:'custom',id:material?.kind==='custom'?material.id:uuid(),category:materialCategory,description:v}
            :{kind:'catalogue',id:v,category:materialCategory}:undefined)}/>
        {system==='walls'&&<>
          {dimension('widthFt','Wall thickness',true)}{dimension('heightFt','Wall height')}
          <details><summary>Advanced wall elevation</summary><label className="block">Wall datum reference<select className={field}
            value={(value('datum') as {basis?:string})?.basis??'base'} onChange={e=>{
              const height=value('heightFt');
              const basis=e.target.value as 'base'|'top';
              if(datum&&typeof height==='number')change('datum',{...datum,basis,elevationFt:datum.elevationFt+(basis===datum.basis?0:basis==='top'?height:-height)});
            }}><option value="base">Base</option><option value="top">Top</option></select></label>
          {numeric((value('datum') as {elevationFt?:number})?.elevationFt,'Wall datum',false,v=>change('datum',v===undefined?undefined:{
            ...datum,basis:datum?.basis??'base',elevationFt:v
          }))}
          {datum&&<label className="block">Elevation comparison<select className={field} value={datum.reference?.kind??'historical'} onChange={e=>{
            if(e.target.value==='assembly')return;
            const kind=e.target.value as 'project'|'unresolved'|'historical';
            change('datum',{...datum,reference:{kind}});
          }}><option value="historical">Existing reference</option><option value="project">Shared project reference</option>
            <option value="unresolved">Unresolved reference</option>{datum.reference?.kind==='assembly'&&<option value="assembly">Assembly-relative wall base</option>}
          </select></label>}</details>
        </>}
        {system==='footing'&&<>
          {dimension('widthFt','Footing width',true)}{dimension('depthFt','Footing depth',true)}
          {conventional&&(value('alignment') as {kind?:string})?.kind==='centred'&&(value('top') as {kind?:string})?.kind==='wallBase'?<p>Centred beneath the wall. Footing top is at the wall base.</p>:<>
          <label className="block"><input type="checkbox" checked={(value('alignment') as {kind?:string})?.kind==='centred'} onChange={e=>change('alignment',e.target.checked?{kind:'centred'}:undefined)}/> Confirm centred footing</label>
          <label className="block"><input type="checkbox" checked={(value('top') as {kind?:string})?.kind==='wallBase'} onChange={e=>change('top',e.target.checked?{kind:'wallBase'}:undefined)}/> Confirm top at wall base</label></>}
          <details><summary>Advanced footing alignment</summary>
            {numeric((value('alignment') as {offsetFt?:number})?.offsetFt,'Signed strip offset',true,v=>change('alignment',v===undefined?undefined:{kind:'explicitOffset',offsetFt:v}))}
            {numeric((value('top') as {elevationFt?:number})?.elevationFt,'Explicit footing top elevation',false,v=>change('top',v===undefined?undefined:{kind:'explicit',elevationFt:v}))}
          </details>
        </>}
        {system==='exteriorLayers'&&<>
          <label className="block">Coverage<select aria-label="Coverage" className={field}
            value={(value('coverage') as {kind?:string})?.kind??'specifiedHeight'}
            onChange={e=>change('coverage',e.target.value==='confirmedFullHeight'?{kind:'confirmedFullHeight'}:undefined)}>
            <option value="confirmedFullHeight">Full wall height</option><option value="specifiedHeight">Specified coverage height</option>
            {(value('coverage') as {kind?:string})?.kind==='manualNetSegments'&&<option value="manualNetSegments">Specified net coverage</option>}
          </select></label>
          {(value('coverage') as {kind?:string})?.kind==='confirmedFullHeight'?
            <p>{wallHeight?formatFoundationQuantity(wallHeight,'LF',metric)+' coverage':'Enter the wall height to establish coverage.'}</p>:
            numeric((value('coverage') as {heightFt?:number})?.heightFt,'Coverage height',false,v=>change('coverage',v===undefined?undefined:{kind:'specifiedHeight',heightFt:v}))}
          {exteriorCategory==='insulation'?dimension('thicknessFt','Layer thickness',true):fields.thicknessFt&&<details><summary>Advanced specified thickness</summary>{dimension('thicknessFt','Layer thickness',true)}</details>}
        </>}
        {system==='drainage'&&<>
          <label className="block"><input type="checkbox" checked={(value('route') as {kind?:string})?.kind==='footingEdgeOffset'}
            onChange={e=>change('route',e.target.checked?{kind:'footingEdgeOffset',offsetFt:8/12}:undefined)}/> Confirm {metric?'203.2 mm':'8 in'} from footing exterior edge</label>
          {numeric((value('route') as {kind?:string;offsetFt?:number})?.kind==='footingEdgeOffset'?(value('route') as {offsetFt:number}).offsetFt:undefined,'Offset from exterior footing edge',true,v=>change('route',v===undefined?undefined:{kind:'footingEdgeOffset',offsetFt:v}))}
          <details><summary>Advanced drainage route</summary>
            {numeric((value('route') as {kind?:string;offsetFt?:number})?.kind==='wallFaceOffset'?(value('route') as {offsetFt:number}).offsetFt:undefined,'Offset from exterior wall face',true,v=>change('route',v===undefined?undefined:{kind:'wallFaceOffset',offsetFt:v}))}
          </details>
          {numeric((value('attributes') as {nominalDiameterFt?:{value:number}})?.nominalDiameterFt?.value,'Nominal pipe diameter',true,v=>{
            const {nominalDiameterFt:_old,...attributes}=(value('attributes') as Record<string,unknown>)??{};
            change('attributes',{...attributes,...(v===undefined?{}:{nominalDiameterFt:confirmed(v,source)})});
          })}
          {!drainageCatalogueAttributes(material?.kind==='catalogue'?material.id:'').pipeMaterial&&<label className="block">Pipe material<input className={field} value={(value('attributes') as {pipeMaterial?:{value:string}})?.pipeMaterial?.value??''}
            onChange={e=>{
              const {pipeMaterial:_old,...attributes}=(value('attributes') as Record<string,unknown>)??{};
              change('attributes',{...attributes,...(e.target.value.trim()?{pipeMaterial:confirmed(e.target.value,source)}:{})});
            }}/></label>}
          {!drainageCatalogueAttributes(material?.kind==='catalogue'?material.id:'').perforation&&<label className="block">Pipe perforation<select className={field}
            value={(value('attributes') as {perforation?:{value:string}})?.perforation?.value??''} onChange={e=>{
              const {perforation:_old,...attributes}=(value('attributes') as Record<string,unknown>)??{};
              change('attributes',{...attributes,...(e.target.value?{perforation:confirmed(e.target.value,source)}:{})});
            }}><option value="">Unconfirmed</option><option value="perforated">Perforated</option><option value="solid">Solid</option></select></label>}
        </>}
        {system==='slab'&&<>
          {dimension('thicknessFt','Slab thickness',true)}
          {slabOnly?<p>Coverage follows the traced slab outline.</p>:conventional?<p>Standard coverage is the entire inside face of the foundation.</p>:null}
          <details><summary>Advanced slab elevations and coverage</summary>
          {!slabOnly&&<label className="block"><input type="checkbox" checked={(value('extent') as {kind?:string})?.kind==='confirmedInterior'} onChange={e=>change('extent',e.target.checked?{kind:'confirmedInterior'}:undefined)}/> Confirm interior slab extent</label>}
          <label className="block"><input type="checkbox" checked={!!value('footingRelation')} onChange={e=>change('footingRelation',e.target.checked?source:undefined)}/> Confirm slab relation to footing</label>
          {conventional&&<label className="block"><input type="checkbox" checked={value('bottomRelationship')==='atWallBase'} onChange={e=>change('bottomRelationship',e.target.checked?'atWallBase':undefined)}/> Slab bottom at wall base (footing top for centred strip)</label>}
          {value('bottomRelationship')!=='atWallBase'&&dimension('baseFt','Slab bottom elevation')}
          </details>
        </>}
        {(system==='insulation'||system==='granular')&&<FoundationDimensionInput label="Layer thickness" section metric={metric} className={field} suggestions={suggestions?.thicknessFt}
          value={typeof value('thicknessFt')==='number'?String(value('thicknessFt')):''} onChange={v=>{
            const n=Number(v);
            if(v&&Number.isFinite(n))onChange({...scope,specification:{...fields,id:fields.id??confirmed(uuid(),source),thicknessFt:confirmed(n,source)}} as EditableScope);
            else change('thicknessFt',undefined);
          }}/>}
      </fieldset>}
  </fieldset>;
}
