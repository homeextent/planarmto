import React,{useMemo,useState} from 'react';
import type {ActiveTool,SelectionState} from '../types';
import type {RoofEntity,Applicability} from '../engine/measurements/measurementTypes';
import {measureRoof,projectedArea} from '../engine/measurements/roofMeasurements';
const tools:[ActiveTool,string][]=[['select','Select'],['roof_generate','Generate roof skeleton'],['roof_plane','Roof plane'],['roof_edge','Classify edge'],['roof_opening','Roof opening'],['roof_soffit','Soffit area'],['roof_insulation','Insulation area'],['roof_vertex','Edit vertex'],['ruler_measure','Measure'],['calibrate_scale','Calibrate scale'],['text_label','Annotation']];
export function RoofToolbar({activeTool,onSelectTool}:{activeTool:ActiveTool;onSelectTool:(t:ActiveTool)=>void}){
 return <aside className="w-36 shrink-0 bg-slate-900 border-r border-slate-700 p-2 overflow-y-auto"><h2 className="text-xs uppercase text-slate-400 mb-3">Roof tools</h2>{tools.map(([t,label])=><button key={t} onClick={()=>onSelectTool(t)} className={'block w-full text-left text-xs rounded p-2 mb-1 '+(activeTool===t?'bg-sky-700 text-white':'bg-slate-800 hover:bg-slate-700')}>{label}</button>)}</aside>;
}
const field='w-full rounded bg-slate-800 border border-slate-600 px-2 py-1 text-sm text-slate-100';
function Numeric({label,value,onCommit,min,max}:{label:string;value:number|null;onCommit:(n:number|null)=>boolean|undefined;min?:number;max?:number}){
 const [draft,setDraft]=useState(value===null?'':String(value));
 return <label className="block text-xs text-slate-400">{label}<input className={field} type="number" step="any" min={min} max={max} value={draft} placeholder="Not specified" onChange={e=>setDraft(e.target.value)} onBlur={()=>{const n=draft.trim()===''?null:Number(draft);if(n!==null&&(!Number.isFinite(n)||(min!==undefined&&n<min)||(max!==undefined&&n>max))){setDraft(value===null?'':String(value));return;}if(n!==value&&!onCommit(n))setDraft(value===null?'':String(value))}} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur()}}/></label>;
}
const options:Applicability[]=['unspecified','included','excluded'];
export function RoofInspector({workspaceId,entities,selection,onChange,onSelect,onDelete}:{workspaceId:string;entities:RoofEntity[];selection:SelectionState;onChange:(e:RoofEntity[])=>boolean;onSelect:(s:SelectionState)=>void;onDelete:()=>void}){
 const e=selection.type==='roof'?entities.find(e=>e.id===selection.id):undefined;
 const names=new Map(entities.map((q,i)=>[q.id,(q.kind==='roofPlane'?'Roof plane':q.kind==='roofEdge'?'Roof edge':q.kind==='roofOpening'?'Roof opening':q.purpose==='soffit'?'Soffit area':'Insulation area')+' '+(i+1)]));
 const result=useMemo(()=>{try{return measureRoof(workspaceId,entities)}catch(err){return {rows:[],warnings:[err instanceof Error?err.message:String(err)]}}},[workspaceId,entities]);
 const update=(patch:Partial<RoofEntity>)=>{if(e)return onChange(entities.map(q=>q.id===e.id?{...q,...patch} as RoofEntity:q))};
 const totals=new Map<string,{unit:string;qty:number;missing:number}>();
 for(const r of result.rows){const x=totals.get(r.code)||{unit:r.unit,qty:0,missing:0};if(r.status==='measured')x.qty+=r.quantity;else x.missing++;totals.set(r.code,x)}
 const labels:Record<string,string>={'roof.projected':'Projected gross area','roof.gross':'Gross sloped area','roof.deduction':'Opening deductions','roof.covering':'Net covering','roof.fascia':'Fascia','roof.gutter':'Eavestrough','roof.soffit.run':'Soffit run','roof.soffit.area':'Soffit area'};
 return <aside className="w-72 shrink-0 overflow-y-auto bg-slate-900 border-l border-slate-700 p-3 space-y-3 text-slate-200">
 <h2 className="text-sm font-semibold">Roof properties</h2>
 <select aria-label="Select roof entity" className={field} value={e?.id||''} onChange={ev=>onSelect(ev.target.value?{type:'roof',id:ev.target.value}:{type:'none'})}><option value="">Select entity</option>{entities.map((q,i)=><option key={q.id} value={q.id}>{names.get(q.id)}{q.kind==='roofEdge'?' · '+q.edgeType:''}</option>)}</select>
 {e&&<div key={JSON.stringify(e)} className="space-y-2">
 <label className="block text-xs">Source reference<input className={field} defaultValue={e.source.reference} onBlur={ev=>{if(!ev.target.value.trim()||(ev.target.value!==e.source.reference&&!update({source:{...e.source,reference:ev.target.value.trim()}})))ev.target.value=e.source.reference}}/></label>
 {'polygon' in e&&<div className="text-xs">Projected polygon: {projectedArea(e.polygon).toFixed(2)} SF</div>}
 {e.kind==='roofPlane'&&<>
 <div className="flex flex-wrap gap-1">{[0,3,4,6,8,10,12].map(p=><button key={p} type="button" className="rounded bg-slate-800 px-2 py-1 text-xs" onClick={()=>update({pitchRise:p})}>{p}:12</button>)}</div>
 <Numeric label="Pitch rise per 12" value={e.pitchRise} min={0} onCommit={pitchRise=>update({pitchRise})}/>
 <div className="grid grid-cols-2 gap-1">{[[0,'Right'],[90,'Down'],[180,'Left'],[270,'Up']].map(([v,n])=><button key={v} type="button" className="bg-slate-800 rounded p-1 text-xs" onClick={()=>update({slopeDegrees:Number(v)})}>{n} {v}°</button>)}</div>
 <Numeric label="Downslope direction (0 right, 90 down)" value={e.slopeDegrees} min={0} max={359.999999} onCommit={slopeDegrees=>update({slopeDegrees})}/>
 <Numeric label="Elevation at first vertex (ft, optional)" value={e.elevationFt} onCommit={elevationFt=>update({elevationFt})}/>
 </>}
 {e.kind==='roofEdge'&&<>
 <label className="block text-xs">Classification<select className={field} value={e.edgeType} onChange={ev=>update({edgeType:ev.target.value as typeof e.edgeType})}>{['unclassified','eave','rake','ridge','hip','valley','abutment','parapet'].map(v=><option key={v}>{v}</option>)}</select></label>
 {(['fascia','gutter','soffit'] as const).map(k=><label key={k} className="block text-xs">{k}<select className={field} value={e.applicability?.[k]||'unspecified'} onChange={ev=>update({applicability:{...e.applicability,[k]:ev.target.value as Applicability}})}>{options.map(v=><option key={v}>{v}</option>)}</select></label>)}
 </>}
 {e.kind==='roofOpening'&&<label className="block text-xs">Deduction treatment<select className={field} value={e.deduction||'unspecified'} onChange={ev=>update({deduction:ev.target.value as Applicability})}>{options.map(v=><option key={v}>{v}</option>)}</select></label>}
 {e.kind==='roofSurface'&&<>
 <label className="block text-xs">Surface basis<select className={field} value={e.surfaceBasis||''} onChange={ev=>update({surfaceBasis:ev.target.value as 'horizontal'|'sloped',pitchRise:ev.target.value==='horizontal'?0:null})}><option value="" disabled>Not specified</option><option value="horizontal">Horizontal</option><option value="sloped">Sloped</option></select></label>
 {e.surfaceBasis==='sloped'&&<Numeric label="Surface pitch rise per 12" value={e.pitchRise} min={0} onCommit={pitchRise=>update({pitchRise})}/>}
 {e.purpose==='insulation'&&<>
 <label className="block text-xs">Insulation type<select className={field} value={e.insulationType||''} onChange={ev=>update({insulationType:ev.target.value||undefined})}><option value="">Not specified</option>{['blown cellulose','fiberglass batt','mineral wool batt','closed cell foam','open cell foam','other'].map(v=><option key={v}>{v}</option>)}</select></label>
 <Numeric label="Thickness (inches)" value={e.depthFt===undefined?null:e.depthFt*12} min={0.000001} onCommit={v=>update({depthFt:v===null?undefined:v/12})}/>
 </>}
 </>}
 <button className="rounded bg-red-900 px-2 py-1 text-xs" onClick={onDelete}>Delete selected</button></div>}
 <hr className="border-slate-700"/><h2 className="text-sm font-semibold">Roof quantities</h2><p className="text-xs text-slate-400">Raw measurements only — no rates or waste.</p>
 {[...totals].map(([code,x])=><div key={code} className="flex justify-between gap-2 text-xs"><span>{labels[code]||code.replace('roof.','').replaceAll('.',' ')}</span><span className={x.missing?'text-amber-300':'text-slate-100'}>{x.missing?(x.qty?x.qty.toFixed(2)+' '+x.unit+' + pending':'Not quantified'):x.qty.toFixed(2)+' '+x.unit}</span></div>)}
 {totals.has('roof.covering')&&!totals.get('roof.covering')!.missing&&<div className="text-xs">Roofing squares: {(totals.get('roof.covering')!.qty/100).toFixed(2)} SQ (same area)</div>}
 {result.warnings.some(w=>!w.includes('explicitly excluded'))&&<details open><summary className="text-xs text-amber-300">Measurement checks</summary>{result.warnings.filter(w=>!w.includes('explicitly excluded')).map((w,i)=><p key={i} className="text-xs text-amber-300">{entities.reduce((s,q)=>s.replace(q.id,names.get(q.id)||q.id),w).replace(/^Plane Roof plane/,'Roof plane').replace(/^Edge Roof edge/,'Roof edge')}</p>)}</details>}{result.warnings.some(w=>w.includes('explicitly excluded'))&&<details><summary className="text-xs text-slate-400">Explicit exclusions</summary>{result.warnings.filter(w=>w.includes('explicitly excluded')).map((w,i)=><p key={i} className="text-xs text-slate-400">{entities.reduce((s,q)=>s.replace(q.id,names.get(q.id)||q.id),w)}</p>)}</details>}
 </aside>;
}
