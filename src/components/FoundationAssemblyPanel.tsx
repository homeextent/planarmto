import React, { useEffect, useMemo, useState } from 'react';
import { v4 as uuid } from 'uuid';
import type { ProjectDocument } from '../engine/projectDocument';
import type {
  AssemblyChange, AssemblyIntent, AssemblyPreview, AssemblySpecifications, DraftSpecification, FoundationAssemblyRecord,
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
type System=Exclude<keyof AssemblySpecifications,'exteriorLayers'>;
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
      w.elevationFt!==first.elevationFt||w.foundation?.perimeterReference?.edge!==i||
      !same(w.foundation.perimeterReference.points,reference.points)))return null;
  const source=sources('Existing confirmed perimeter trace');
  const vertices=reference.points.map((point,i)=>({point,id:'vertex-'+i}));
  const segments=vertices.map((v,i)=>({id:'segment-'+i,startVertexId:v.id,endVertexId:vertices[(i+1)%vertices.length].id}));
  const openings=walls.flatMap((w,i)=>(w.foundation?.wallOpenings??[]).map(opening=>({sourceSegmentId:segments[i].id,opening})));
  const input:AssemblyIntent={
    trace:{kind:reference.kind,reference:reference.reference,vertices,segments,source},overrides:[],
    specifications:{walls:{status:'included',specification:{
      material:confirmed(concrete,source),widthFt:confirmed(first.widthFt,source),heightFt:confirmed(first.heightFt,source),
      datum:confirmed({basis:'base',elevationFt:first.elevationFt},source),...(openings.length?{openings:confirmed(openings,source)}:{}),
    }},footing:pending,exteriorLayers:[],drainage:pending,slab:pending,insulation:pending,granular:pending},
  };
  return {input, bindings:walls.map((w,i)=>({role:{system:'wall',sourceId:segments[i].id} as const,entityId:w.id,physicalId:w.physicalId}))};
}

import { formatFoundationQuantity } from '../engine/measurements/foundationUnits';

type Props={
  key?:string;
  project:ProjectDocument;
  workspaceId:string;
  selectedId?:string;
  selectedIds?:string[];
  metric:boolean;
  onApply:(preview:AssemblyPreview)=>boolean;
  onPresets:(presets:FoundationPreset[])=>boolean;
  onPreview:(members:FoundationEntity[]|null)=>void;
  onSelectChildren:(ids:string[])=>void;
};

export function FoundationAssemblyPanel({project,workspaceId,selectedId,selectedIds,metric,onApply,onPresets,onPreview,onSelectChildren}:Props){
  const workspace=project.workspaces.find(w=>w.id===workspaceId)!;
  const parents=workspace.foundationAssemblies??[];
  const inherited=parents.find(p=>p.children.some(c=>c.entityId===selectedId));
  const [focused,setFocused]=useState('');
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
  const presets=project.foundationPresets??[];
  const selectedPreset=presets.find(p=>p.id===presetId);
  const parent=parents.find(p=>p.id===focused)||inherited;
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
  const intent=adoption?.input??selectedEdit;
  const adoptable=!inherited?assemblyFromSelection(workspace.measurements as FoundationEntity[],selectedId):null;
  const activePreview=preview?.source===project?preview:null;
  useEffect(()=>{if(preview&&preview.source!==project)setPreview(null)},[project,preview]);
  function clearPreview(){setPreview(null);onPreview(null)}
  function update(input:AssemblyIntent){
    if(adoption)setAdoption({...adoption,input});
    else if(parent)setEdit({parentId:parent.id,revision:parent.revisionId,input});
    clearPreview();
  }
  function setSystem(system:System,next:AssemblySpecifications[System]){
    if(intent)update({...intent,specifications:{...intent.specifications,[system]:next}});
  }
  function savePreset(){
    if(!intent||!presetName.trim())return;
    const {walls,footing,exteriorLayers,drainage,insulation,granular}=intent.specifications;
    const restrict=<T,U>(scope:Scope<T>,map:(spec:DraftSpecification<T>)=>DraftSpecification<U>):Scope<U>=>
      scope.status==='included'?{status:'included',specification:map(scope.specification)}:
      {status:scope.status,reason:scope.reason,...(scope.retainedSpecification?{retainedSpecification:map(scope.retainedSpecification)}:{})};
    const version:PresetVersion={version:(selectedPreset?.versions.at(-1)?.version??0)+1,name:presetName.trim(),systems:{
      walls:restrict<WallSpec,Pick<WallSpec,'material'|'widthFt'|'heightFt'>>(walls,({datum:_datum,openings:_openings,...fields})=>fields),
      footing:restrict<FootingSpec, Omit<FootingSpec,'top'> & {top:{kind:'wallBase'}}>(footing,({top,...fields})=>({...fields,...(top?.value.kind==='wallBase'?{top:{...top,value:{kind:'wallBase' as const}}}:{})})),
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
    if(!intent||!selectedPreset||!version||!reference.trim())return;
    const source=sources(reference.trim());
    const systems=version.systems;
    const provenance={kind:'presetSnapshot',presetId:selectedPreset.id,version:version.version,reference:reference.trim()} as const;
    const stamp=<T,>(scope:Scope<T>):Scope<T>=>{
      const fields=scopeFields(scope);
      const stamped=Object.fromEntries(Object.entries(fields).map(([key,entry])=>[key,{...(entry as {value:unknown}),confirmation:provenance}])) as DraftSpecification<T>;
      return scope.status==='included'?{status:'included',specification:stamped}:{...scope,retainedSpecification:stamped};
    };
    const template:AssemblySpecifications={...intent.specifications,
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
      footingRelation:confirmed(source,source),...(selectedSlab.foundation?.slabOpenings?{openings:confirmed(selectedSlab.foundation.slabOpenings,source)}:{}),
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
    const id=adoption?uuid():parent!.id;
    const command:AssemblyChange=adoption?{kind:'adopt',input:intent,bindings:adoption.bindings,source:sources('Operator confirmed existing perimeter adoption')}:
      {kind:'replaceIntent',input:intent,...(additionalBindings.length?{adoption:{bindings:additionalBindings,source:sources(reference.trim())}}:{})};
    showPreview(previewAssemblyChange(project,workspaceId,id,adoption?null:parent!.revisionId,command,uuid));
  }
  return <section className="space-y-2 text-xs" aria-label="Foundation assemblies">
    <h3 className="font-semibold">Foundation assemblies</h3>
    {parents.length>0&&<label className="block">Assembly
      <select aria-label="Foundation assembly" className={field} value={parent?.id??''} onChange={e=>{setFocused(e.target.value);setAdoption(null);setAdditionalBindings([]);clearPreview()}}>
        <option value="">Select assembly</option>
        {parents.map((p,i)=><option key={p.id} value={p.id}>Perimeter {i+1}</option>)}
      </select>
    </label>}
    {adoptable&&!adoption&&<button className={button} onClick={()=>{setAdoption(adoptable);clearPreview()}}>Configure assembly from selected perimeter</button>}
    {parent&&!adoption&&<button className={button} onClick={()=>onSelectChildren(parent.children.map(c=>c.entityId))}>Select assembly components</button>}
    {parent&&summary.size>0&&<details className="space-y-1">
      <summary>Assembly material quantities</summary>
      <ul>{[...summary].map(([key,row])=><li key={key}>
        {row.material} · {row.code.replace('foundation.','').replaceAll('.',' ')} · {row.known?formatFoundationQuantity(row.quantity,row.unit,metric):'Not quantified'}
        {row.pending?' · '+row.pending+' unresolved':''}{row.unit==='BF'?' · informational':''}
      </li>)}</ul>
      {measured?.footprintReferences.filter(ref=>parent.children.some(c=>c.entityId===ref.elementId)).map(ref=>
        <p key={ref.elementId}>Slab footprint reference · {ref.netSF===null?'Not quantified':formatFoundationQuantity(ref.netSF,'SF',metric)}</p>)}
    </details>}
    {intent&&<>
      <label className="block">Reference for revised specifications
        <input className={field} value={reference} onChange={e=>setReference(e.target.value)}/>
      </label>
      {adoption?<p>Preview adoption of the selected perimeter. Existing component decisions are retained.</p>:
        <>
          <details className="space-y-1">
            <summary>Advanced assembly inputs</summary>
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
            <button className={button} disabled={!presetName.trim()} onClick={savePreset}>Save preset version</button>
            <button className={button} disabled={!selectedPreset||!reference.trim()} onClick={usePreset}>Use confirmed preset in draft</button>
            {presetError&&<p role="alert">{presetError}</p>}
          </details>
          {(Object.keys(labels) as System[]).map(system=>
            <SystemEditor key={system} system={system} scope={intent.specifications[system]}
              metric={metric} reference={reference} onChange={next=>setSystem(system,next)}/>)}
          <button className={button} onClick={()=>update({...intent,specifications:{...intent.specifications,exteriorLayers:[
            ...intent.specifications.exteriorLayers,{id:uuid(),scope:{status:'included',specification:{}}},
          ]}})}>Add exterior layer</button>
          {intent.specifications.exteriorLayers.map((layer,i)=><SystemEditor key={layer.id} system="exteriorLayers" label={'Exterior layer '+(i+1)}
            metric={metric} reference={reference} scope={layer.scope} onChange={next=>update({...intent,specifications:{...intent.specifications,
              exteriorLayers:intent.specifications.exteriorLayers.map(l=>l.id===layer.id?{...l,scope:next as typeof l.scope}:l),
            }})}/>)}
        </>}
      <div className="flex flex-wrap gap-2">
        <button className={button} onClick={request}>Preview assembly changes</button>
        <button className={button} disabled={!activePreview?.changes} onClick={()=>{
          if(activePreview&&onApply(activePreview)){setFocused(activePreview.assemblyId);setEdit(undefined);setAdoption(null);setAdditionalBindings([]);clearPreview();}
        }}>Apply assembly changes</button>
        <button className={button} onClick={()=>{setAdoption(null);setEdit(undefined);setAdditionalBindings([]);clearPreview()}}>Cancel assembly changes</button>
      </div>
    </>}
    {activePreview&&<section aria-label="Assembly preview details" className="space-y-1">
      {activePreview.conflicts.map(c=><p role="alert" key={c.code}>{c.message}</p>)}
      {activePreview.unresolvedSpecifications.map((gap,i)=><p className="text-amber-300" key={gap.path+i}>{gap.reason}</p>)}
      {activePreview.changes&&<ul aria-label="Preview quantities">
        {activePreview.quantities.after.filter(r=>activePreview.changes!.parents.find(p=>p.id===activePreview.assemblyId)?.children.some(c=>c.entityId===r.elementId)).map(r=>
          <li key={JSON.stringify([r.elementId,r.code,r.unit])}>{r.code.replace('foundation.','')} · {r.status==='measured'?formatFoundationQuantity(r.quantity,r.unit,metric):r.reason}</li>)}
      </ul>}
      {activePreview.changes&&<p role="status">{activePreview.changes.created.length} added, {activePreview.changes.retained.length} retained, {activePreview.changes.retired.length} removed</p>}
    </section>}
  </section>;
}

type EditableScope=AssemblySpecifications[System]|AssemblySpecifications['exteriorLayers'][number]['scope'];
function SystemEditor({system,label,scope,metric,reference,onChange}:{
  key?:string;system:System|'exteriorLayers';label?:string;scope:EditableScope;metric:boolean;reference:string;onChange:(next:EditableScope)=>void;
}){
  const fields=scopeFields(scope as Scope<Record<string,unknown>>);
  const source=sources(reference.trim());
  function change(name:string,value:unknown){
    if(scope.status!=='included'||!reference.trim())return;
    const { [name]:_old,...remainder }=fields;
    onChange({...scope,specification:{...remainder,...(value===undefined?{}:{[name]:confirmed(value,source)})}} as EditableScope);
  }
  const value=(name:string)=>fields[name]?.value;
  const dimension=(name:string,label:string,section=false)=> <FoundationDimensionInput label={label} metric={metric} compound section={section} className={field}
    value={typeof value(name)==='number'?String(value(name)):''} onChange={v=>change(name,v&&Number.isFinite(Number(v))?Number(v):undefined)}/>;
  const numeric=(existing:unknown,label:string,section:boolean,set:(value:number|undefined)=>void)=><FoundationDimensionInput label={label} className={field}
    metric={metric} compound section={section} value={typeof existing==='number'?String(existing):''}
    onChange={v=>set(v&&Number.isFinite(Number(v))?Number(v):undefined)}/>;
  const [exteriorMaterial,setExteriorMaterial]=useState<'waterproofing'|'insulation'>('waterproofing');
  const materialCategory=system==='drainage'?'drainage':system==='insulation'?'insulation':system==='granular'?'granular':system==='exteriorLayers'?exteriorMaterial:'concrete';
  const material=value('material') as MaterialChoice|undefined;
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
          <select className={field} value={exteriorMaterial} onChange={e=>{setExteriorMaterial(e.target.value as typeof exteriorMaterial);change('material',undefined)}}>
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
          <label className="block">Wall datum reference<select className={field}
            value={(value('datum') as {basis?:string})?.basis??'base'} onChange={e=>{
              const datum=value('datum') as {basis:'base'|'top';elevationFt:number}|undefined;
              const height=value('heightFt');
              const basis=e.target.value as 'base'|'top';
              if(datum&&typeof height==='number')change('datum',{basis,elevationFt:datum.elevationFt+(basis===datum.basis?0:basis==='top'?height:-height)});
            }}><option value="base">Base</option><option value="top">Top</option></select></label>
          {numeric((value('datum') as {elevationFt?:number})?.elevationFt,'Wall datum',false,v=>change('datum',v===undefined?undefined:{
            basis:(value('datum') as {basis?:string})?.basis??'base',elevationFt:v
          }))}
        </>}
        {system==='footing'&&<>
          {dimension('widthFt','Footing width',true)}{dimension('depthFt','Footing depth',true)}
          <label className="block"><input type="checkbox" checked={(value('alignment') as {kind?:string})?.kind==='centred'} onChange={e=>change('alignment',e.target.checked?{kind:'centred'}:undefined)}/> Confirm centred footing</label>
          <label className="block"><input type="checkbox" checked={(value('top') as {kind?:string})?.kind==='wallBase'} onChange={e=>change('top',e.target.checked?{kind:'wallBase'}:undefined)}/> Confirm top at wall base</label>
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
          <label className="block"><input type="checkbox" checked={!!value('extent')} onChange={e=>change('extent',e.target.checked?{kind:'confirmedInterior'}:undefined)}/> Confirm interior slab extent</label>
          <label className="block"><input type="checkbox" checked={!!value('footingRelation')} onChange={e=>change('footingRelation',e.target.checked?source:undefined)}/> Confirm slab relation to footing</label>
          {dimension('baseFt','Slab base')}{dimension('thicknessFt','Slab thickness',true)}
        </>}
        {(system==='insulation'||system==='granular')&&<FoundationDimensionInput label="Layer thickness" section metric={metric} className={field}
          value={typeof value('thicknessFt')==='number'?String(value('thicknessFt')):''} onChange={v=>{
            const n=Number(v);
            if(v&&Number.isFinite(n))onChange({...scope,specification:{...fields,id:fields.id??confirmed(uuid(),source),thicknessFt:confirmed(n,source)}} as EditableScope);
            else change('thicknessFt',undefined);
          }}/>}
      </fieldset>}
  </fieldset>;
}
