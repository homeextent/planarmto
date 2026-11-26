import React,{useContext,useEffect,useRef,useState} from 'react';
import {v4 as uuid} from 'uuid';
import {deriveStripFootings,planFoundationDeletion} from '../engine/measurements/foundationDerivation';
import {deriveFoundationEnvelope} from '../engine/measurements/foundationEnvelopeDerivation';
import {measureFoundation} from '../engine/measurements/foundationMeasurements';
import {validateFoundationTopology} from '../engine/measurements/foundationTopology';
import {FoundationDimensionInput} from './FoundationDimensionInput';
import {FoundationMaterialInput} from './FoundationMaterialInput';
import {FoundationInspectorContext} from './FoundationInspectorTabs';
import {foundationColor} from './foundationComponentStyle';
import type {FoundationEntity,QuantityContribution} from '../engine/measurements/measurementTypes';
import {formatFoundationQuantity} from '../engine/measurements/foundationUnits';

type LayerKind='footing'|'waterproofing'|'verticalInsulation';
type LayerDraft={
 kind:LayerKind;original?:FoundationEntity;remove?:boolean;
 width:string;depth:string;offset:string;height:string;side:''|'left'|'right';material:string;
};
const layerNames:Record<LayerKind,string>={footing:'Strip footing',waterproofing:'Waterproofing',verticalInsulation:'Vertical insulation'};
const button='rounded bg-sky-800 px-2 py-1 disabled:opacity-50';
const field='block w-full rounded border border-slate-600 bg-slate-800 p-1.5';

function makeDraft(kind:LayerKind,original?:FoundationEntity):LayerDraft{
 const strip=original?.foundation?.stripSource,exterior=original?.foundation?.envelopeSource;
 return {kind,original,width:String(strip?.widthFt??''),depth:String(strip?.depthFt??exterior?.depthFt??''),
   offset:String(strip?.offsetFt??0),height:String(exterior?.heightFt??''),side:exterior?.side??'',
   material:original?.foundation?.material??(kind==='footing'?'poured concrete':'')};
}

function ensureSingleLayer(layer:FoundationEntity,entities:FoundationEntity[]){
 const strip=layer.foundation?.stripSource,exterior=layer.foundation?.envelopeSource;
 const group=strip?.groupId??exterior?.groupId;
 if(strip?.wallIds&&strip.wallIds.length!==1||exterior?.perimeterWallIds||exterior?.sourceIds&&exterior.sourceIds.length!==1||
   entities.filter(e=>(e.foundation?.stripSource?.groupId??e.foundation?.envelopeSource?.groupId)===group).length!==1)
   throw Error('This layer belongs to a shared group. Edit it through the complete group controls.');
 if(planFoundationDeletion(entities,[layer.id]).dependentCount)
   throw Error('Resolve dependent construction before changing this layer.');
}

export function IndependentWallConstruction({wall,entities,ownedIds,metric,onChange,onPreview,renderWall}:{
 key?:string;wall:FoundationEntity;entities:FoundationEntity[];ownedIds?:ReadonlySet<string>;metric:boolean;onChange:(entities:FoundationEntity[])=>boolean;
 onPreview:(members:FoundationEntity[]|null)=>void;
 renderWall:(preview:(entity:FoundationEntity)=>boolean,reset:number)=>React.ReactNode;
}){
 const {tab,selectTab}=useContext(FoundationInspectorContext);
 const formHost=useRef<HTMLDivElement>(null);
 const [draft,setDraft]=useState<LayerDraft>();
 const [reset,setReset]=useState(0);
 const [error,setError]=useState('');
 const [preview,setPreview]=useState<{source:FoundationEntity[];next:FoundationEntity[];before:QuantityContribution[];after:QuantityContribution[] }>();
 const current=preview?.source===entities?preview:undefined;
 const related=entities.filter(entity=>entity.foundation?.stripSource?.wallId===wall.id||
   entity.foundation?.envelopeSource?.sourceId===wall.id);
 function clear(){
   setPreview(undefined);
   setError('');
   onPreview(null);
 }
 useEffect(()=>{if(preview&&!current)clear();},[entities]);
 useEffect(()=>()=>onPreview(null),[wall.id]);
 function review(next:FoundationEntity[],changedId:string,member?:FoundationEntity,requireMeasured=true){
   validateFoundationTopology(next);
   const before=measureFoundation('wall-review',entities).rows;
   const after=measureFoundation('wall-review',next).rows;
   for(const record of before){
     if(record.elementId===changedId||record.status!=='measured')continue;
     const candidate=after.find(r=>r.elementId===record.elementId&&r.code===record.code&&r.unit===record.unit);
     if(candidate?.status!=='measured'||Math.abs(candidate.quantity-record.quantity)>1e-8*Math.max(1,record.quantity))
       throw Error('Resolve the effect on other measured construction before applying.');
   }
   const affected=after.filter(row=>row.elementId===changedId);
   if(requireMeasured&&member&&member.scopeApplicability?.status!=='excluded'&&member.scopeApplicability?.status!=='pending'&&!affected.some(row=>row.status==='measured'))
     throw Error(affected[0]?.status==='unquantified'?affected[0].reason:'Complete the required construction inputs.');
   setPreview({source:entities,next,before:before.filter(row=>row.elementId===changedId),after:affected});
   onPreview(member?[member]:null);
   selectTab('Quantities');
 }
 function previewWall(replacement:FoundationEntity){
   clear();
   try{
     review(entities.map(record=>record.id===wall.id?replacement:record),wall.id,replacement,false);
     return true;
   }catch(cause){setError(cause instanceof Error?cause.message:String(cause));return false;}
 }
 function previewLayer(){
   if(!draft)return;
   clear();
   try{
     const original=draft.original;
     if(original){
       if(ownedIds?.has(original.id))throw Error('Edit this layer from its owning foundation assembly.');
       if(!entities.includes(original))throw Error('The saved layer changed. Open the layer again.');
       ensureSingleLayer(original,entities);
       if(draft.remove&&original.scopeApplicability)throw Error('Resolve the explicit scope decision in Advanced before removing this layer.');
     }
     const other=original?entities.filter(entity=>entity.id!==original.id):entities;
     if(draft.remove&&original){review(other,original.id);return;}
     const source=original?.foundation?.stripSource??original?.foundation?.envelopeSource;
     const ids=source?[source.groupId,original!.assemblyId,original!.id]:[];
     const id=()=>ids.shift()??uuid();
     let member:FoundationEntity;
     if(draft.kind==='footing'){
       [member]=deriveStripFootings(other,[wall.id],Number(draft.width),Number(draft.depth),id,Number(draft.offset));
     }else{
       if(!draft.side)throw Error('Select the exterior side to review coverage on the drawing.');
       const insulating=draft.kind==='verticalInsulation';
       const thickness=Number(draft.depth);
       if(insulating&&!(thickness>0))throw Error('Enter the insulation thickness.');
       [member]=deriveFoundationEnvelope(other,[wall.id],{purpose:draft.kind,material:draft.material,
         layerId:original?.foundation?.envelopeSource?.layerId??uuid(),side:draft.side,heightFt:Number(draft.height),
         ...(insulating?{depthFt:thickness}:original?.foundation?.envelopeSource?.depthFt?{depthFt:original.foundation.envelopeSource.depthFt}:{}),
         ...(insulating&&['eps','xps','polyisocyanurate'].includes(draft.material)?{foam:true as const}:{})},id);
     }
     if(original)member={...member,physicalId:original.physicalId,source:original.source,...(original.scopeApplicability?{scopeApplicability:original.scopeApplicability}:{})};
     review(original?entities.map(entity=>entity.id===original.id?member:entity):[...entities,member],member.id,member);
   }catch(cause){setError(cause instanceof Error?cause.message:String(cause));}
 }
 function start(next:LayerDraft){
   clear();
   setReset(value=>value+1);
   setDraft(next);
   selectTab('Construction');
 }
 const update=(patch:Partial<LayerDraft>)=>{clear();setDraft(old=>old&&({...old,...patch}));};
 const section=(feet:number)=>formatFoundationQuantity(feet*(metric?304.8:12),metric?'mm':'in',false);
 const show=(row:QuantityContribution)=>row.status==='measured'?
   formatFoundationQuantity(row.quantity,row.unit,metric)+(row.unit==='BF'?' informational':''):row.reason;
 const input=(label:string,key:'width'|'depth'|'offset'|'height',section=true)=>
   <FoundationDimensionInput label={label} value={draft?.[key]??''} onChange={value=>update({[key]:value})} className={field} section={section}/>;
 return <section aria-label="Independent wall layers" className="space-y-2 text-xs">
   <div className="sticky top-0 z-10 space-y-1 border-b border-slate-600 bg-slate-900 py-2" role="group" aria-label="Wall construction transaction">
     <p>{draft?draft.remove?'Remove '+layerNames[draft.kind]:layerNames[draft.kind]:'Independent wall'} · {current?'Preview ready':'Construction'}</p>
     <div className="flex gap-2">
       <button className={button} onClick={()=>{if(draft)previewLayer();else formHost.current?.querySelector('form')?.requestSubmit();}}>Preview</button>
       <button className={button} disabled={!current} onClick={()=>{
         if(!current)return;
         if(current.source!==entities||!onChange(current.next)){setError('Preview changed or failed validation. Review the construction again.');return;}
         clear();setDraft(undefined);setReset(value=>value+1);selectTab('Construction');
       }}>Apply</button>
       <button className={button} onClick={()=>{clear();setDraft(undefined);setReset(value=>value+1);selectTab('Construction');}}>Cancel</button>
     </div>
     {error?<p role="alert">{error}</p>:!current&&<p className="text-slate-300">Preview this construction before applying.</p>}
   </div>
   <div hidden={tab!=='Construction'} className="space-y-2">
     <div ref={formHost} hidden={!!draft} className="rounded-lg border border-slate-700 border-l-sky-400 border-l-4 p-2"
       onChangeCapture={clear}>{renderWall(previewWall,reset)}</div>
     <h3 className="font-semibold">Supporting construction</h3>
     {(!related.some(e=>e.kind==='stripFooting'))&&<button className={button} onClick={()=>start(makeDraft('footing'))}>Add strip footing</button>}
     <h3 className="font-semibold">Exterior protection</h3>
     <div className="flex flex-wrap gap-2">
       <button className={button} onClick={()=>start(makeDraft('waterproofing'))}>Add waterproofing</button>
       <button className={button} onClick={()=>start(makeDraft('verticalInsulation'))}>Add vertical insulation</button>
     </div>
     {related.map(record=>{
       const kind=record.kind==='stripFooting'?'footing':record.foundation?.envelopeSource?.purpose==='waterproofing'?'waterproofing':'verticalInsulation';
       const linked=record.foundation?.stripSource,cover=record.foundation?.envelopeSource;
       const summary=linked?[section(linked.widthFt),section(linked.depthFt)].join(' × '):
         [cover?.heightFt&&formatFoundationQuantity(cover.heightFt,'LF',metric)+' coverage',cover?.depthFt&&section(cover.depthFt)].filter(Boolean).join(' · ');
       return <details key={record.id} className="rounded-lg border border-slate-700 border-l-4 bg-slate-800/50" style={{borderInlineStartColor:kind==='footing'?foundationColor.footing:kind==='waterproofing'?foundationColor.waterproofing:foundationColor.insulation}}>
         <summary className="cursor-pointer p-2 font-semibold">{layerNames[kind]} · {record.scopeApplicability?.status??'No explicit decision'}<span className="block font-normal">{record.foundation?.material} · {summary}</span></summary>
         <div className="flex gap-2 p-2">
           <button className={button} onClick={()=>start(makeDraft(kind,record))}>Edit {layerNames[kind].toLowerCase()}</button>
           <button className={button} onClick={()=>start({...makeDraft(kind,record),remove:true})}>Remove {layerNames[kind].toLowerCase()}</button>
         </div>
       </details>;
     })}
     {draft&&!draft.remove&&<fieldset className="space-y-2 rounded-lg border border-slate-700 p-2">
       <legend>{layerNames[draft.kind]}</legend>
       {draft.kind==='footing'?<>
         <p>Poured concrete · centred on the wall unless an offset is specified.</p>
         {input('Footing width','width')}{input('Footing depth','depth')}
         <details><summary>Advanced footing alignment</summary>{input('Footing offset','offset')}</details>
       </>:<>
         <FoundationMaterialInput label="Layer material" category={draft.kind==='waterproofing'?'waterproofing':'insulation'}
           value={draft.material} onChange={material=>update({material})} className={field}/>
         {input('Coverage height','height',false)}
         {draft.kind==='verticalInsulation'&&input('Insulation thickness','depth')}
         <label>Exterior side<select className={field} value={draft.side} onChange={event=>update({side:event.target.value as LayerDraft['side']})}>
           <option value="">Select exterior side</option><option value="left">Left, looking from start to end</option><option value="right">Right, looking from start to end</option>
         </select></label>
       </>}
     </fieldset>}
   </div>
   {tab==='Quantities'&&current&&<section aria-label="Wall construction preview" className="space-y-1">
     <h3 className="font-semibold">Wall construction preview</h3>
     {current.before.length>0&&<div><h4>Before</h4>{current.before.map(row=><p key={row.code}>{show(row)}</p>)}</div>}
     <h4>After</h4>
     {current.after.length?current.after.map(row=><p key={row.code}>{show(row)}</p>):<p>Removes the selected construction layer and its quantities.</p>}
   </section>}
 </section>;
}
