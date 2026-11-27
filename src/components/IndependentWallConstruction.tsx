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
 width:string;depth:string;offset:string;height:string;fullHeight:boolean;side:''|'left'|'right';material:string;
};
const layerNames:Record<LayerKind,string>={footing:'Strip footing',waterproofing:'Waterproofing',verticalInsulation:'Vertical insulation'};
const button='rounded bg-sky-800 px-2 py-1 disabled:opacity-50';
const field='block w-full rounded border border-slate-600 bg-slate-800 p-1.5';

function makeDraft(kind:LayerKind,original?:FoundationEntity):LayerDraft{
 const strip=original?.foundation?.stripSource,exterior=original?.foundation?.envelopeSource;
 return {kind,original,width:String(strip?.widthFt??''),depth:String(strip?.depthFt??exterior?.depthFt??''),
   offset:String(strip?.offsetFt??0),height:String(exterior?.heightFt??''),fullHeight:!original||exterior?.coverageMode==='fullWallHeight',side:exterior?.side??'',
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

export function IndependentWallConstruction({wall,entities,ownedIds,metric,onChange,onPreview,renderWall,onCancelDraft,focusedLayer}:{
 key?:string;wall:FoundationEntity;entities:FoundationEntity[];ownedIds?:ReadonlySet<string>;metric:boolean;onChange:(entities:FoundationEntity[])=>boolean;
 onPreview:(members:FoundationEntity[]|null)=>void;onCancelDraft?:()=>void;focusedLayer?:FoundationEntity;
 renderWall:(preview:(entity:FoundationEntity)=>boolean,reset:number,onHeightChange:(value:number|null)=>void)=>React.ReactNode;
}){
 const pad=wall.kind==='padFooting';
 const slab=wall.kind==='slab';
 const title=pad?'Pad footing':slab?'Slab':'Independent wall';
 const subject=pad?'Pad footing':slab?'Slab':'Wall construction';
 const {tab,selectTab}=useContext(FoundationInspectorContext);
 const formHost=useRef<HTMLDivElement>(null);
 const savedLayer=()=>focusedLayer?makeDraft(
   focusedLayer.kind==='stripFooting'?'footing':focusedLayer.foundation?.envelopeSource?.purpose==='waterproofing'?'waterproofing':'verticalInsulation',
   focusedLayer,
 ):undefined;
 const [draft,setDraft]=useState<LayerDraft>(savedLayer);
 useEffect(()=>{if(focusedLayer)setDraft(savedLayer());},[focusedLayer]);
 const [initialLayers,setInitialLayers]=useState<Partial<Record<LayerKind,LayerDraft>>>({});
 const [heightInput,setHeightInput]=useState<number|null>();
 const wallHeight=heightInput===undefined?('heightFt' in wall?wall.heightFt:null):heightInput;
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
 function review(next:FoundationEntity[],changedIds:string[],members:FoundationEntity[]=[],requireMeasured=true){
   validateFoundationTopology(next);
   const before=measureFoundation('wall-review',entities).rows;
   const after=measureFoundation('wall-review',next).rows;
   for(const record of before){
     if(changedIds.includes(record.elementId)||record.status!=='measured')continue;
     const candidate=after.find(r=>r.elementId===record.elementId&&r.code===record.code&&r.unit===record.unit);
     if(candidate?.status!=='measured'||Math.abs(candidate.quantity-record.quantity)>1e-8*Math.max(1,record.quantity))
       throw Error(candidate?.status==='unquantified'?candidate.reason:'Resolve the effect on other measured construction before applying.');
   }
   const affected=after.filter(row=>changedIds.includes(row.elementId));
   for(const member of members){
     if(!requireMeasured||member.scopeApplicability?.status==='excluded'||member.scopeApplicability?.status==='pending')continue;
     const rows=affected.filter(row=>row.elementId===member.id);
     if(!rows.some(row=>row.status==='measured'))
       throw Error(rows[0]?.status==='unquantified'?rows[0].reason:'Complete the required construction inputs.');
   }
   setPreview({source:entities,next,before:before.filter(row=>changedIds.includes(row.elementId)),after:affected});
   onPreview(members.length?members:null);
   selectTab('Quantities');
 }
 function buildLayer(currentEntities:FoundationEntity[],sourceWall:FoundationEntity,layer:LayerDraft){
   const original=layer.original;
   if(original){
     if(ownedIds?.has(original.id))throw Error('Edit this layer from its owning foundation assembly.');
     if(!currentEntities.includes(original))throw Error('The saved layer changed. Open the layer again.');
     ensureSingleLayer(original,currentEntities);
     if(layer.remove&&original.scopeApplicability)throw Error('Resolve the explicit scope decision in Advanced before removing this layer.');
   }
   let base=original?currentEntities.filter(entity=>entity.id!==original.id):currentEntities;
   if(layer.remove&&original)return {next:base,member:undefined};
   const source=original?.foundation?.stripSource??original?.foundation?.envelopeSource;
   const ids=source&&original?[source.groupId,original.assemblyId,original.id]:[];
   const id=()=>ids.shift()??uuid();
   let member:FoundationEntity;
   if(layer.kind==='footing'){
     if(sourceWall.kind!=='foundationWall'||!sourceWall.foundation?.centrelineConfirmed||sourceWall.widthFt===null||sourceWall.foundation.material!=='poured concrete')
       throw Error('Confirm the wall trace, thickness and poured concrete in Construction.');
     const offset=Number(layer.offset);
     if(!sourceWall.foundation.baseElevationConfirmed||sourceWall.elevationFt===null){
       if(offset!==0||sourceWall.elevationFt!==null||sourceWall.foundation.elevationReference)
         throw Error('Confirm the wall base under Advanced wall elevations for this footing.');
       const localWall:FoundationEntity={...sourceWall,elevationFt:0,foundation:{...sourceWall.foundation,
         baseElevationConfirmed:true,elevationReference:{kind:'assembly',id:sourceWall.id}}};
       base=base.map(entity=>entity.id===sourceWall.id?localWall:entity);
     }
     [member]=deriveStripFootings(base,[sourceWall.id],Number(layer.width),Number(layer.depth),id,offset);
   }else{
     if(!layer.side)throw Error('Select the exterior side to review coverage on the drawing.');
     const insulating=layer.kind==='verticalInsulation';
     const thickness=Number(layer.depth);
     if(insulating&&!(thickness>0))throw Error('Enter the insulation thickness.');
     const height=layer.fullHeight&&sourceWall.kind==='foundationWall'?sourceWall.heightFt:Number(layer.height);
     if(!height||height<=0)throw Error('Confirm a positive wall height or specify a positive coverage height.');
     [member]=deriveFoundationEnvelope(base,[sourceWall.id],{purpose:layer.kind,material:layer.material,
       layerId:original?.foundation?.envelopeSource?.layerId??uuid(),side:layer.side,heightFt:height,
       ...(layer.fullHeight?{coverageMode:'fullWallHeight' as const}:{}),
       ...(insulating?{depthFt:thickness}:{}),
       ...(insulating&&(['eps','xps','polyisocyanurate'].includes(layer.material)||original?.foundation?.material===layer.material&&original.foundation.envelopeSource?.foam)?{foam:true as const}:{})},id);
   }
   if(original)member={...member,physicalId:original.physicalId,source:original.source,...(original.scopeApplicability?{scopeApplicability:original.scopeApplicability}:{})};
   const next=original?currentEntities.map(entity=>entity.id===original.id?member:entity):[...base,member];
   return {next,member};
 }
 function previewWall(replacement:FoundationEntity){
   clear();
   try{
     const creating=!!onCancelDraft;
     let next=creating?[...entities,replacement]:entities.map(record=>record.id===wall.id?replacement:record);
     const layers:LayerDraft[]=creating?(Object.keys(layerNames) as LayerKind[]).flatMap(kind=>{const layer=initialLayers[kind];return layer?[layer]:[];}):related.flatMap(entity=>{
       const source=entity.foundation?.envelopeSource;
       return source?.coverageMode==='fullWallHeight'&&replacement.kind==='foundationWall'&&replacement.heightFt!==source.heightFt?
         [makeDraft(source.purpose==='waterproofing'?'waterproofing':'verticalInsulation',entity)]:[];
     });
     const members:FoundationEntity[]=[];
     for(const layer of layers){
       const source=next.find(entity=>entity.id===replacement.id)!;
       const result=buildLayer(next,source,layer);
       next=result.next;
       if(result.member)members.push(result.member);
     }
     const source=next.find(entity=>entity.id===replacement.id)!;
     review(next,[source.id,...members.map(member=>member.id)],[source,...members],creating||members.length>0);
     return true;
   }catch(cause){setError(cause instanceof Error?cause.message:String(cause));return false;}
 }
 function previewLayer(){
   if(!draft)return;
   clear();
   try{
     const {next,member}=buildLayer(entities,wall,draft);
     review(next,[member?.id??draft.original!.id],member?[member]:[]);
   }catch(cause){setError(cause instanceof Error?cause.message:String(cause));}
 }
 function start(next:LayerDraft){
   clear();
   setReset(value=>value+1);
   setHeightInput(undefined);
   setDraft(next);
   selectTab('Construction');
 }

 const section=(feet:number)=>formatFoundationQuantity(feet*(metric?304.8:12),metric?'mm':'in',false);
 const show=(row:QuantityContribution)=>row.code.replace('foundation.','').replaceAll('.',' ')+' · '+(row.status==='measured'?
   formatFoundationQuantity(row.quantity,row.unit,metric)+(row.unit==='BF'?' informational':''):row.reason);
 const concreteRows=current?.after.filter(row=>row.status==='measured'&&row.unit==='CY'&&row.code.endsWith('.concrete'))??[];
 const concreteSubtotal=concreteRows.length>1?concreteRows.reduce((sum,row)=>sum+(row.status==='measured'?row.quantity:0),0):null;
 function layerFields(layer:LayerDraft,change:(patch:Partial<LayerDraft>)=>void){
   const input=(label:string,key:'width'|'depth'|'offset'|'height',section=true)=>
     <FoundationDimensionInput label={label} value={layer[key]} onChange={value=>change({[key]:value})} className={field} section={section}/>;
   return <fieldset className="space-y-2 rounded-lg border border-slate-700 p-2">
     <legend>{layerNames[layer.kind]}</legend>
     {layer.kind==='footing'?<>
       <p>Poured concrete · {Number(layer.offset)===0?'Centred beneath the wall. Footing top is at the wall base.':'Advanced alignment. Footing top is at the wall base.'}</p>
       {input('Footing width','width')}{input('Footing depth','depth')}
       <details><summary>Advanced footing alignment</summary>{input('Footing offset','offset')}</details>
     </>:<>
       <FoundationMaterialInput label="Layer material" category={layer.kind==='waterproofing'?'waterproofing':'insulation'}
         value={layer.material} onChange={material=>change({material})} className={field}/>
       <label>Coverage<select aria-label="Coverage" className={field} value={layer.fullHeight?'full':'specified'} onChange={event=>change({fullHeight:event.target.value==='full'})}>
         <option value="full">Full wall height</option><option value="specified">Specified coverage height</option>
       </select></label>
       {layer.fullHeight?<p>{wallHeight?formatFoundationQuantity(wallHeight,'LF',metric)+' coverage':'Enter the wall height to establish coverage.'}</p>:input('Coverage height','height',false)}
       {layer.kind==='verticalInsulation'&&input('Insulation thickness','depth')}
       <label>Exterior side<select className={field} value={layer.side} onChange={event=>change({side:event.target.value as LayerDraft['side']})}>
         <option value="">Select exterior side</option><option value="left">Left, looking from start to end</option><option value="right">Right, looking from start to end</option>
       </select></label>
     </>}
   </fieldset>;
 }
 return <section aria-label={pad||slab?title+' construction':'Independent wall layers'} className="space-y-2 text-xs">
   <div className="sticky top-0 z-10 space-y-1 border-b border-slate-600 bg-slate-900 py-2" role="group" aria-label={subject+' transaction'}>
     <p>{draft?draft.remove?'Remove '+layerNames[draft.kind]:layerNames[draft.kind]:title} · {current?'Preview ready':'Construction'}</p>
     {current&&draft?.kind==='footing'&&!wall.foundation?.baseElevationConfirmed&&<p>Uses the wall base as a local estimating reference.</p>}
     <div className="flex gap-2">
       <button className={button} onClick={()=>{if(draft)previewLayer();else formHost.current?.querySelector('form')?.requestSubmit();}}>Preview</button>
       <button className={button} disabled={!current} onClick={()=>{
         if(!current)return;
         if(current.source!==entities||!onChange(current.next)){setError('Preview changed or failed validation. Review the construction again.');return;}
         clear();setDraft(savedLayer());setInitialLayers({});setHeightInput(undefined);setReset(value=>value+1);selectTab('Construction');
       }}>Apply</button>
       <button className={button} onClick={()=>{clear();setDraft(savedLayer());setInitialLayers({});setHeightInput(undefined);setReset(value=>value+1);selectTab('Construction');onCancelDraft?.();}}>Cancel</button>
     </div>
     {error?<p role="alert">{error}</p>:!current&&<p className="text-slate-300">Preview this construction before applying.</p>}
   </div>
   <div hidden={tab!=='Construction'} className="space-y-2">
     <div ref={formHost} hidden={!!draft} className="rounded-lg border border-slate-700 border-l-sky-400 border-l-4 p-2"
       onChangeCapture={clear}>{renderWall(previewWall,reset,setHeightInput)}</div>
     {!pad&&!slab&&onCancelDraft&&<>
       <h3 className="font-semibold">Supporting construction and exterior protection</h3>
       {(Object.keys(layerNames) as LayerKind[]).map(kind=>{
         const layer=initialLayers[kind];
         const accent=kind==='footing'?foundationColor.footing:kind==='waterproofing'?foundationColor.waterproofing:foundationColor.insulation;
         return <details key={kind} className="rounded-lg border border-slate-700 border-l-4 p-2" style={{borderInlineStartColor:accent}}>
           <summary>{layerNames[kind]} · {layer?'Included in draft':'Pending'}</summary>
           {layer?<>
             {layerFields(layer,patch=>{clear();setInitialLayers({...initialLayers,[kind]:{...layer,...patch}});})}
             <button className={button} onClick={()=>{clear();setInitialLayers(({[kind]:_removed,...rest})=>rest);}}>Leave pending</button>
           </>:<button className={button} onClick={()=>{clear();setInitialLayers({...initialLayers,[kind]:makeDraft(kind)});}}>Add {layerNames[kind].toLowerCase()}</button>}
         </details>;
       })}
       <details><summary>Advanced independent construction</summary><p>Use the wall elevations and junction controls above for nonstandard construction. Trace drainage separately using Specialist drawing tools.</p></details>
     </>}
     {!pad&&!slab&&!onCancelDraft&&<>
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
     {draft&&focusedLayer&&<button className={button} onClick={()=>{clear();setDraft(undefined);}}>Edit wall</button>}
     {draft&&!draft.remove&&layerFields(draft,patch=>{clear();setDraft({...draft,...patch});})}
     </>}
   </div>
   {tab==='Quantities'&&current&&<section aria-label={subject+' preview'} className="space-y-1">
     <h3 className="font-semibold">{subject} preview</h3>
     {current.before.length>0&&<div><h4>Before</h4>{current.before.map(row=><p key={row.elementId+row.code}>{show(row)}</p>)}</div>}
     <h4>After</h4>
     {concreteSubtotal!==null&&<p>Concrete subtotal · {formatFoundationQuantity(concreteSubtotal,'CY',metric)}</p>}
     {current.after.length?current.after.map(row=><p key={row.elementId+row.code}>{show(row)}</p>):<p>Removes the selected construction layer and its quantities.</p>}
   </section>}
 </section>;
}
