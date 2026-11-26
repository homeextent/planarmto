import { addFoundationTraceNotch, moveFoundationTraceVertex } from '../engine/measurements/foundationTraceCorrection';
import { foundationReleaseGroup } from '../engine/measurements/foundationAssemblyValidation';
import React, { useEffect, useMemo, useState } from 'react';
import { v4 as uuid } from 'uuid';
import type { ProjectDocument } from '../engine/projectDocument';
import type {
  AssemblyChange, AssemblyIntent, AssemblyPreview, AssemblyTrace, TraceCorrectionAudit, AssemblySpecifications, DraftSpecification, FoundationAssemblyRecord,
  MaterialChoice, Scope, Source, FoundationPreset, PresetVersion, WallSpec, FootingSpec, LayerSpec, DrainageSpec, PresetLayer, ChildBinding,
} from '../engine/measurements/foundationAssemblyModel';
import { foundationMaterialCatalogue } from '../engine/measurements/foundationMaterialCatalogue';
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

export type TracedAssembly = {id:string;input:AssemblyIntent};
export function createTracedAssembly(points:AssemblyTrace['vertices'][number]['point'][],kind:AssemblyTrace['kind'],reference:AssemblyTrace['reference']):TracedAssembly {
  const source=sources('Graphically traced foundation perimeter');
  const vertices=points.map(point=>({point,id:uuid()}));
  const segments=vertices.map((v,i)=>({id:uuid(),startVertexId:v.id,endVertexId:vertices[(i+1)%vertices.length].id}));
  return {id:uuid(),input:{
    trace:{kind,reference,vertices,segments,source},overrides:[],
    specifications:{walls:{status:'included',specification:{}},footing:pending,exteriorLayers:[],drainage:pending,
      slab:pending,insulation:pending,granular:pending},
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
  onCancelTrace:()=>void;
  onApply:(preview:AssemblyPreview)=>boolean;
  onTraceEdit:(trace?:AssemblyTrace,onMove?:(index:number,point:{x:number;y:number})=>void)=>void;
  onPresets:(presets:FoundationPreset[])=>boolean;
  onPreview:(members:FoundationEntity[]|null)=>void;
  onSelectChildren:(ids:string[])=>void;
};

export function FoundationAssemblyPanel({project,workspaceId,selectedId,selectedIds,metric,traced,onCancelTrace,onApply,onTraceEdit,onPresets,onPreview,onSelectChildren}:Props){
  const workspace=project.workspaces.find(w=>w.id===workspaceId)!;
  const parents=workspace.foundationAssemblies??[];
  const inherited=parents.find(p=>p.children.some(c=>c.entityId===selectedId||selectedIds?.includes(c.entityId)));
  const [editing,setEditing]=useState(false);
  const [focused,setFocused]=useState('');
  useEffect(()=>{if(inherited)setFocused(inherited.id)},[inherited?.id]);
  const [newEdit,setNewEdit]=useState<TracedAssembly>();
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
  const presets=project.foundationPresets??[];
  const selectedPreset=presets.find(p=>p.id===presetId);
  const parent=traced?undefined:parents.find(p=>p.id===focused)??inherited;
  const measured=useMemo(()=>parent?measureFoundation(workspaceId,workspace.measurements as FoundationEntity[]):null,[parent,workspace,workspaceId]);
  const summary=new Map<string,{material:string;code:string;unit:string;quantity:number;pending:number;known:number}>();
  if(measured&&parent){
    const owned=new Set(parent.children.map(c=>c.entityId));
    const materials=new Map((workspace.measurements as FoundationEntity[]).map(e=>[e.id,e.foundation?.material]));
    for(const row of measured.rows){
      if(!owned.has(row.elementId))continue;
      const material=materials.get(row.elementId)??'Material unresolved',key=JSON.stringify([material,row.code,row.unit]);
      const entry=summary.get(key)??{material,code:row.code,unit:row.unit,quantity:0,pending:0,known:0};
      if(row.status==='measured'){entry.quantity+=row.quantity;entry.known++;}else entry.pending++;
      summary.set(key,entry);
    }
  }
  const selectedEdit=parent&&edit?.parentId===parent.id&&edit.revision===parent.revisionId?edit.input:
    parent?{trace:parent.trace,specifications:parent.specifications,overrides:parent.overrides,...(parent.preset?{preset:parent.preset}:{})}:undefined;
  const intent=traced?(newEdit?.id===traced.id?newEdit.input:traced.input):adoption?.input??selectedEdit;
  const inputReference=reference.trim()||(traced||parent&&!adoption?'Contractor confirmed foundation specification':'');
  const conventional=intent?.specifications.walls.status==='included'&&intent.specifications.walls.specification.datum?.value.reference?.kind==='assembly';
  const adoptable=!inherited?assemblyFromSelection(workspace.measurements as FoundationEntity[],selectedId):null;
  const activePreview=preview?.source===project&&(adoption&&!traced||preview.assemblyId===(traced?.id??parent?.id))?preview:null;
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
  function clearPreview(){setPreview(null);setCorrectionError('');onPreview(null);onTraceEdit()}
  function update(input:AssemblyIntent){
    if(traced)setNewEdit({id:traced.id,input});
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
  function addExteriorLayer(){
    if(!intent)return;
    update({...intent,specifications:{...intent.specifications,exteriorSequence:{status:'unresolved'},exteriorLayers:[
      ...intent.specifications.exteriorLayers,{id:uuid(),scope:{status:'included',specification:{}}},
    ]}});
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
  function showPreview(next:AssemblyPreview){
    setPreview(next);
    const owned=new Set(next.changes?.parents.find(p=>p.id===next.assemblyId)?.children.map(c=>c.entityId));
    onPreview(next.changes?.measurements.filter(e=>owned.has(e.id))??null);
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
    if(!parent||!reason)return;
    try{
      const {trace,segments}=create();
      setCorrectionError('');
      showPreview(previewAssemblyChange(project,workspaceId,parent.id,parent.revisionId,{
        kind:'correctTrace',trace,segments,source:sources(reason),
      },uuid));
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
    if(!intent)return;
    const id=traced?.id??(adoption?uuid():parent!.id);
    const command:AssemblyChange=traced?{kind:'create',input:intent}:adoption?{kind:'adopt',input:intent,bindings:adoption.bindings,source:sources('Operator confirmed existing perimeter adoption')}:
      {kind:'replaceIntent',input:intent,...(additionalBindings.length?{adoption:{bindings:additionalBindings,source:sources(reference.trim())}}:{})};
    showPreview(previewAssemblyChange(project,workspaceId,id,traced||adoption?null:parent!.revisionId,command,uuid));
  }
  return <section className="space-y-2 text-xs" aria-label="Foundation assemblies">
    <h3 className="font-semibold">{traced?'Specify foundation construction':'Foundation assemblies'}</h3>
    {traced&&<p>Confirm the materials, dimensions and scope for this perimeter, then review quantities.</p>}
    {!traced&&parents.length>0&&<label className="block">Assembly
      <select aria-label="Foundation assembly" className={field} value={parent?.id??''} onChange={e=>{setFocused(e.target.value);setEditing(false);setAdoption(null);setAdditionalBindings([]);clearPreview()}}>
        <option value="">Select assembly</option>
        {parents.map((p,i)=><option key={p.id} value={p.id}>Perimeter {i+1}</option>)}
      </select>
    </label>}
    {!traced&&adoptable&&!adoption&&<button className={button} onClick={()=>{setAdoption(adoptable);clearPreview()}}>Configure assembly from selected perimeter</button>}
    {parent&&!adoption&&<div className="flex flex-wrap gap-2">
      <button className={button} onClick={()=>setEditing(true)}>Edit assembly</button>
      <button className={button} onClick={()=>{
        setEditing(true);clearPreview();
        onTraceEdit(parent.trace,(index,point)=>requestCorrection(()=>({trace:moveFoundationTraceVertex(parent.trace,index,point),segments:[]}),'Contractor confirmed graphical perimeter correction'));
      }}>Edit perimeter</button>
      <button className={button} onClick={()=>onSelectChildren(parent.children.map(c=>c.entityId))}>Select assembly components</button>
    </div>}
    {parent&&summary.size>0&&<details className="space-y-1">
      <summary>Assembly material quantities</summary>
      <ul>{[...summary].map(([key,row])=><li key={key}>
        {row.material} · {row.code.replace('foundation.','').replaceAll('.',' ')} · {row.known?formatFoundationQuantity(row.quantity,row.unit,metric):'Not quantified'}
        {row.pending?' · '+row.pending+' unresolved':''}{row.unit==='BF'?' · informational':''}
      </li>)}</ul>
      {measured?.footprintReferences.filter(ref=>parent.children.some(c=>c.entityId===ref.elementId)).map(ref=>
        <p key={ref.elementId}>Slab footprint reference · {ref.netSF===null?'Not quantified':formatFoundationQuantity(ref.netSF,'SF',metric)}</p>)}
    </details>}
    {intent&&(traced||adoption||editing)&&<>
      {!traced&&<label className="block">Reference for revised specifications
        <input className={field} value={reference} onChange={e=>setReference(e.target.value)}/>
      </label>}
      {adoption&&!traced?<p>Preview adoption of the selected perimeter. Existing component decisions are retained.</p>:
        <>
          <details className="space-y-1">
            <summary>Advanced assembly inputs</summary>
            {parent&&<fieldset className="border border-slate-700 p-2 space-y-1">
              <legend>Correct saved perimeter</legend>
              <button className={button} disabled={!reference.trim()} onClick={()=>{
                clearPreview();
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
      {traced&&intent.specifications.walls.status==='included'&&<label className="block">
        <input type="checkbox" checked={intent.specifications.walls.specification.datum?.value.reference?.kind==='assembly'} onChange={e=>{
          if(intent.specifications.walls.status!=='included')return;
          const {datum:_datum,...specification}=intent.specifications.walls.specification;
          const source={kind:'estimatingAssumption',reference:'Conventional residential wall base as assembly-local zero'} as const;
          const footing=intent.specifications.footing;
          update({...intent,specifications:{...intent.specifications,
            walls:{status:'included',specification:{...specification,...(e.target.checked?{datum:confirmed({basis:'base',elevationFt:0,reference:{kind:'assembly',id:traced.id}},source)}:{})}},
            ...(e.target.checked&&footing.status==='included'?{footing:{status:'included',specification:{...footing.specification,
              alignment:footing.specification.alignment??confirmed({kind:'centred'},source),
              top:footing.specification.top??confirmed({kind:'wallBase'},source),
            }}}:{}),
          }});
        }}/> Confirm conventional foundation using the wall base as the relative reference
      </label>}
          {(Object.keys(labels) as System[]).map(system=>
            <SystemEditor key={system} system={system} scope={intent.specifications[system]}
              metric={metric} reference={inputReference} conventional={conventional} suggestions={suggestions(system)} onChange={next=>setSystem(system,next)}/>)}
          <h4 className="font-semibold">Exterior layers from wall outward</h4>
          <p>Use the specified material order. Each layer keeps its own coverage and quantities.</p>
          <button className={button} onClick={addExteriorLayer}>Add exterior layer</button>
          {intent.specifications.exteriorLayers.map((layer,i)=><div key={layer.id} className="space-y-1">
            <SystemEditor system="exteriorLayers" label={'Exterior layer '+(i+1)}
            metric={metric} reference={inputReference} scope={layer.scope} onChange={next=>{
              const scope=next as typeof layer.scope;
              const changed=scope.status!==layer.scope.status||!same(scopeFields<LayerSpec>(scope).material?.value,scopeFields<LayerSpec>(layer.scope).material?.value);
              update({...intent,specifications:{...intent.specifications,...(changed?{exteriorSequence:{status:'unresolved'}}:{}),
              exteriorLayers:intent.specifications.exteriorLayers.map(l=>l.id===layer.id?{...l,scope:next as typeof l.scope}:l),
            }})}}/>
            <div className="flex gap-2">
              <button className={button} disabled={!i} onClick={()=>moveExteriorLayer(i,i-1)}>Move layer {i+1} toward wall</button>
              <button className={button} disabled={i===intent.specifications.exteriorLayers.length-1} onClick={()=>moveExteriorLayer(i,i+1)}>Move layer {i+1} outward</button>
            </div>
          </div>)}
          {intent.specifications.exteriorLayers.length>0&&<label className="block"><input type="checkbox" checked={intent.specifications.exteriorSequence?.status==='confirmed'}
            onChange={e=>{
              const exteriorSequence=e.target.checked?{status:'confirmed' as const,confirmation:sources(inputReference)}:{status:'unresolved' as const};
              update({...intent,specifications:{...intent.specifications,exteriorSequence}});
            }}/> Confirm exterior layer order</label>}
        </>}
      <div className="flex flex-wrap gap-2">
        <button className={button} onClick={request}>Preview assembly changes</button>
        <button className={button} disabled={!activePreview?.changes||(!!traced&&!activePreview.changes.parents.find(p=>p.id===traced.id)?.children.some(c=>c.role.system==='wall'))} onClick={()=>{
          if(activePreview&&onApply(activePreview)){setFocused(activePreview.assemblyId);setEdit(undefined);setAdoption(null);setAdditionalBindings([]);onCancelTrace();clearPreview();}
        }}>Apply assembly changes</button>
        <button className={button} onClick={()=>{setAdoption(null);setEdit(undefined);setAdditionalBindings([]);onCancelTrace();clearPreview()}}>Cancel assembly changes</button>
      </div>
    </>}
    {correctionError&&<p role="alert">{correctionError}</p>}
    {activePreview&&<section aria-label="Assembly preview details" className="space-y-1">
      {activePreview.conflicts.map(c=><p role="alert" key={c.code}>{c.message}</p>)}
      {activePreview.unresolvedSpecifications.map((gap,i)=><p className="text-amber-300" key={gap.path+i}>{gap.reason}</p>)}
      {activePreview.changes&&<PreviewMaterialChanges
        preview={activePreview}
        before={workspace.measurements as FoundationEntity[]}
        previous={parent}
        metric={metric}
      />}
    </section>}
  </section>;
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
    <table className="w-full text-left" aria-label="Preview quantities"><thead><tr><th>Material</th><th>Before</th><th>After</th></tr></thead>
      <tbody>{[...new Set([...old.keys(),...current.keys()])].map(key=><tr key={key}>
        <th scope="row">{(current.get(key)??old.get(key))!.label}</th><td>{show(old.get(key))}</td><td>{show(current.get(key))}</td>
      </tr>)}</tbody>
    </table>
    <p role="status">{changes.created.length} added, {changes.retained.length} retained ({revised} revised), {changes.retired.length} removed, {changes.detached.length} released as independent</p>
    <p>{replacements.length} replaced by {new Set(replacements.flatMap(row=>row.successorIds)).size} successor components</p>
  </>;
}

type EditableScope=AssemblySpecifications[System]|AssemblySpecifications['exteriorLayers'][number]['scope'];
function SystemEditor({system,label,scope,metric,reference,conventional,suggestions,onChange}:{
  key?:string;system:System|'exteriorLayers';label?:string;scope:EditableScope;metric:boolean;reference:string;conventional?:boolean;suggestions?:Record<string,number[]>;onChange:(next:EditableScope)=>void;
}){
  const fields=scopeFields(scope as Scope<Record<string,unknown>>);
  const source=sources(reference.trim());
  function change(name:string,value:unknown){
    if(scope.status!=='included'||!reference.trim())return;
    const { [name]:_old,...remainder }=fields;
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
  const [exteriorMaterial,setExteriorMaterial]=useState<'waterproofing'|'insulation'>('waterproofing');
  const exteriorCategory=material?.category==='insulation'||material?.category==='waterproofing'?material.category:exteriorMaterial;
  const materialCategory=system==='drainage'?'drainage':system==='insulation'?'insulation':system==='granular'?'granular':system==='exteriorLayers'?exteriorCategory:'concrete';
  return <fieldset className="border border-slate-700 rounded p-2 space-y-1">
    <legend>{label??labels[system as System]}</legend>
    <label className="block">Scope
      <select aria-label={(label??labels[system as System])+' scope'} className={field} value={scope.status} onChange={e=>{
        const status=e.target.value as EditableScope['status'];
        onChange((status==='included'?{status,specification:fields}:{status,reason:'',retainedSpecification:fields}) as EditableScope);
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
          <label className="block"><input type="checkbox" checked={(value('coverage') as {kind?:string})?.kind==='confirmedFullHeight'}
            onChange={e=>change('coverage',e.target.checked?{kind:'confirmedFullHeight'}:undefined)}/> Confirm full wall height as coverage</label>
          {numeric((value('coverage') as {heightFt?:number})?.heightFt,'Coverage height',false,v=>change('coverage',v===undefined?undefined:{kind:'specifiedHeight',heightFt:v}))}
          {dimension('thicknessFt','Layer thickness',true)}
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
          <label className="block">Pipe material attribute<input className={field} value={(value('attributes') as {pipeMaterial?:{value:string}})?.pipeMaterial?.value??''}
            onChange={e=>{
              const {pipeMaterial:_old,...attributes}=(value('attributes') as Record<string,unknown>)??{};
              change('attributes',{...attributes,...(e.target.value.trim()?{pipeMaterial:confirmed(e.target.value,source)}:{})});
            }}/></label>
          <label className="block">Pipe perforation attribute<select className={field}
            value={(value('attributes') as {perforation?:{value:string}})?.perforation?.value??''} onChange={e=>{
              const {perforation:_old,...attributes}=(value('attributes') as Record<string,unknown>)??{};
              change('attributes',{...attributes,...(e.target.value?{perforation:confirmed(e.target.value,source)}:{})});
            }}><option value="">Unconfirmed</option><option value="perforated">Perforated</option><option value="solid">Solid</option></select></label>
        </>}
        {system==='slab'&&<>
          <label className="block"><input type="checkbox" checked={(value('extent') as {kind?:string})?.kind==='confirmedInterior'} onChange={e=>change('extent',e.target.checked?{kind:'confirmedInterior'}:undefined)}/> Confirm interior slab extent</label>
          <label className="block"><input type="checkbox" checked={!!value('footingRelation')} onChange={e=>change('footingRelation',e.target.checked?source:undefined)}/> Confirm slab relation to footing</label>
          {conventional&&<label className="block"><input type="checkbox" checked={value('bottomRelationship')==='atWallBase'} onChange={e=>change('bottomRelationship',e.target.checked?'atWallBase':undefined)}/> Slab bottom at wall base (footing top for centred strip)</label>}
          {value('bottomRelationship')!=='atWallBase'&&dimension('baseFt','Slab bottom elevation')}{dimension('thicknessFt','Slab thickness',true)}
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
