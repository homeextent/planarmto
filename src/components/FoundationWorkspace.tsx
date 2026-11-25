import React,{useMemo,useState} from 'react';
import type {ActiveTool,SelectionState} from '../types';
import type {FoundationEntity,FoundationMetadata} from '../engine/measurements/measurementTypes';
import {foundationTools} from '../engine/measurements/foundationDrafting';
import {measureFoundation} from '../engine/measurements/foundationMeasurements';
export function FoundationToolbar({activeTool,onSelectTool}:{activeTool:ActiveTool;onSelectTool:(t:ActiveTool)=>void}){
 const tools:[ActiveTool,string][]=[['select','Select'],...foundationTools.map(([t,l])=>[t,l] as [ActiveTool,string]),['ruler_measure','Measure'],['calibrate_scale','Calibrate scale'],['text_label','Annotation']];
 return <aside className="w-36 shrink-0 bg-slate-900 border-r border-slate-700 p-2 overflow-y-auto"><h2 className="text-xs uppercase text-slate-400 mb-3">Foundation tools</h2>{tools.map(([t,label])=><button key={t} onClick={()=>onSelectTool(t)} className={'block w-full text-left text-xs rounded p-2 mb-1 '+(activeTool===t?'bg-sky-700 text-white':'bg-slate-800 hover:bg-slate-700')}>{label}</button>)}</aside>;
}
const field='block w-full bg-slate-800 border border-slate-600 rounded p-1.5 text-xs';
function Properties({entity,onSave}:{entity:FoundationEntity;onSave:(e:FoundationEntity)=>boolean}){
 const [material,setMaterial]=useState(entity.foundation?.material??'');
 const [width,setWidth]=useState('widthFt' in entity?String(entity.widthFt??''):'');
 const [height,setHeight]=useState('heightFt' in entity?String(entity.heightFt??''):'');
 const [depth,setDepth]=useState('depthFt' in entity?String(entity.depthFt??''):'');
 const [elevation,setElevation]=useState('elevationFt' in entity?String(entity.elevationFt??''):'');
 const [centre,setCentre]=useState(!!entity.foundation?.centrelineConfirmed);
 const [layer,setLayer]=useState(entity.foundation?.coverage?.layerId??'');
 const [confirmed,setConfirmed]=useState(!!entity.foundation?.coverage?.confirmed);
 const [error,setError]=useState('');
 const number=(v:string)=>{if(!v.trim())return null;const n=Number(v);if(!Number.isFinite(n))throw Error('Enter finite dimensions');return n};
 const input=(label:string,v:string,set:(s:string)=>void)=><label className="block">{label}<input aria-label={label} className={field} value={v} onChange={e=>set(e.target.value)}/></label>;
 const coverage=entity.kind==='foundationLine'||entity.kind==='foundationRegion'&&entity.purpose==='insulation';
 return <form className="space-y-2 text-xs" onSubmit={ev=>{ev.preventDefault();try{if(!material.trim())throw Error('Specify construction material');const f:FoundationMetadata={...entity.foundation,version:1,material:material.trim()};if('widthFt' in entity){if(centre)f.centrelineConfirmed=true;else delete f.centrelineConfirmed;}if('elevationFt' in entity){if(elevation.trim())f.baseElevationConfirmed=true;else delete f.baseElevationConfirmed;}if(coverage){if(confirmed&&layer.trim())f.coverage={...f.coverage,layerId:layer.trim(),confirmed:true,...(entity.kind==='foundationLine'&&entity.purpose!=='drainage'?{openingTreatment:'none' as const}:{})};else delete f.coverage;}let next:FoundationEntity={...entity,foundation:f};if('widthFt' in next)next={...next,widthFt:number(width),heightFt:number(height),elevationFt:number(elevation)};else if('polygon' in next)next={...next,depthFt:number(depth),elevationFt:number(elevation)};else if(next.kind==='foundationLine'){const h=number(height);next={...next,heightFt:h??undefined}}if(!onSave(next))throw Error('Edit rejected; review geometry and dimensions');setError('')}catch(err){setError(err instanceof Error?err.message:String(err))}}}>
 {input('Material',material,setMaterial)}
 {'widthFt' in entity&&<>{input('Width (ft)',width,setWidth)}{input('Height / depth (ft)',height,setHeight)}<label className="block"><input type="checkbox" checked={centre} onChange={e=>setCentre(e.target.checked)}/> Confirm drafted centreline</label></>}
 {'polygon' in entity&&input('Depth (ft)',depth,setDepth)}
 {'elevationFt' in entity&&input('Base elevation (ft; blank unknown)',elevation,setElevation)}
 {entity.kind==='foundationLine'&&entity.purpose!=='drainage'&&input('Coverage height (ft)',height,setHeight)}
 {coverage&&<>{input('Layer identity',layer,setLayer)}<label className="block"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/> Confirm explicit route / net coverage, no remaining openings</label></>}
 <button className="bg-sky-700 rounded px-2 py-1" type="submit">Apply foundation properties</button>{error&&<p role="alert" className="text-amber-300">{error}</p>}</form>;
}
export function FoundationInspector({workspaceId,entities,selection,onChange,onSelect,onDelete}:{workspaceId:string;entities:FoundationEntity[];selection:SelectionState;onChange:(e:FoundationEntity[])=>boolean;onSelect:(s:SelectionState)=>void;onDelete:()=>void}){
 const ids=selection.type==='foundation'?(selection.ids??(selection.id?[selection.id]:[])):[],selected=ids.length===1?entities.find(e=>e.id===ids[0]):undefined;
 const result=useMemo(()=>{try{return measureFoundation(workspaceId,entities)}catch(err){return {rows:[],warnings:[err instanceof Error?err.message:String(err)],detailBreakdown:[]}}},[workspaceId,entities]);
 const totals=new Map<string,{qty:number;unit:string;pending:number;known:number}>();
 for(const r of result.rows){const t=totals.get(r.code)??{qty:0,unit:r.unit,pending:0,known:0};if(r.status==='measured'){t.qty+=r.quantity;t.known++}else t.pending++;totals.set(r.code,t)}
 return <aside className="w-72 shrink-0 bg-slate-900 border-l border-slate-700 p-3 overflow-y-auto space-y-3"><h2 className="text-sm font-semibold">Foundation properties</h2><select aria-label="Select foundation entity" className={field} value={selected?.id??''} onChange={e=>onSelect(e.target.value?{type:'foundation',id:e.target.value}:{type:'none'})}><option value="">Select component</option>{entities.map((e,i)=><option key={e.id} value={e.id}>{e.kind} {'purpose' in e?e.purpose:''} {i+1}</option>)}</select>{ids.length>0&&<button className="bg-red-900 rounded px-2 py-1 text-xs" onClick={onDelete}>Delete selected foundation components</button>}{selected&&<Properties key={JSON.stringify(selected)} entity={selected} onSave={e=>onChange(entities.map(q=>q.id===e.id?e:q))}/>}<hr className="border-slate-700"/><h2 className="text-sm font-semibold">Foundation quantities</h2><p className="text-xs text-slate-400">Raw quantities only. Missing inputs remain pending.</p>{[...totals].map(([code,t])=><div key={code} className="flex justify-between gap-2 text-xs"><span>{code.replace('foundation.','').replaceAll('.',' ')}</span><span>{t.known?t.qty.toFixed(2)+' '+t.unit+(t.pending?' + pending':''):'Not quantified'}</span></div>)}{result.warnings.length>0&&<details><summary className="text-xs text-amber-300">Measurement checks</summary>{result.warnings.map((w,i)=><p key={i} className="text-xs text-amber-300 break-words">{w}</p>)}</details>}</aside>;
}
