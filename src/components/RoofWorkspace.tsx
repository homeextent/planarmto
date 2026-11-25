import {v4 as uuidv4} from 'uuid';
import {rectangularRoof,insetRoof,sides,thermalRectangles,thermalPieces,type ThermalPiece,replaceDerivedRoofGroup,removeDerivedRoofGroup,type Side,type Depths,type Bounds,type DerivationSpec} from '../engine/measurements/roofDerivation';
import {roofAssemblyMembers} from '../engine/measurements/roofSelection';
import React,{useMemo,useState} from 'react';
import type {ActiveTool,SelectionState} from '../types';
import type {RoofEntity,Applicability} from '../engine/measurements/measurementTypes';
import {resizeRoofRectangle} from '../engine/measurements/roofEditing';
import {resizeRectangle} from '../engine/precisionDrafting';
import {measureRoof,projectedArea,edgeLength} from '../engine/measurements/roofMeasurements';
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
type Edge=Extract<RoofEntity,{kind:'roofEdge'}>;
const assemblyKeys=['fascia','gutter','soffit'] as const;
type AssemblyKey=typeof assemblyKeys[number];
type BulkPatch=Record<AssemblyKey,Applicability|'unchanged'>;
const emptyPatch=():BulkPatch=>({fascia:'unchanged',gutter:'unchanged',soffit:'unchanged'});
function BulkAssemblies({entities,workspaceId,onChange,names}:{entities:RoofEntity[];workspaceId:string;onChange:(e:RoofEntity[])=>boolean;names:Map<string,string>}){
 const [classification,setClassification]=useState<Edge['edgeType']>('eave');
 const [patch,setPatch]=useState<BulkPatch>(emptyPatch);
 const [excludeOther,setExcludeOther]=useState(false);
 const [preview,setPreview]=useState<{source:RoofEntity[];next:RoofEntity[];targets:Edge[];others:Edge[]}|null>(null);
 const [error,setError]=useState('');
 const edges=entities.filter((e):e is Edge=>e.kind==='roofEdge');
 const targets=edges.filter(e=>e.edgeType===classification);
 const others=excludeOther?edges.filter(e=>e.edgeType!==classification&&e.edgeType!=='unclassified'):[];
 const changed=assemblyKeys.filter(k=>patch[k]!=='unchanged');
 const result=useMemo(()=>{try{return measureRoof(workspaceId,entities).rows}catch{return []}},[workspaceId,entities]);
 const actual=(e:Edge)=>result.find(r=>r.elementId===e.id&&r.code==='roof.edge.'+e.edgeType);
 const length=(list:Edge[])=>{const rows=list.map(actual);const measured=rows.filter(r=>r?.status==='measured');const pending=rows.length-measured.length;return pending&&!measured.length?'Not quantified ('+pending+' pending)':rows.reduce((n,r)=>n+(r?.status==='measured'?r.quantity:0),0).toFixed(2)+' LF'+(pending?' + pending':'')};
 const reset=()=>{setPreview(null);setError('')};
 if(!edges.length)return null;
 return <section aria-label="Bulk perimeter assemblies" className="rounded border border-slate-700 p-2 space-y-2 text-xs">
 <h3 className="font-semibold">Bulk perimeter assemblies</h3>
 <label className="block">Target classification<select aria-label="Target classification" className={field} value={classification} onChange={e=>{setClassification(e.target.value as Edge['edgeType']);reset()}}>{['eave','rake','ridge','hip','valley','abutment','parapet'].map(v=><option key={v}>{v}</option>)}</select></label>
 <p>{targets.length} target edges · {length(targets)}</p>
 {assemblyKeys.map(k=><label key={k} className="block">Bulk {k==='gutter'?'eavestrough':k==='soffit'?'soffit run':k}<select aria-label={'Bulk '+(k==='gutter'?'eavestrough':k==='soffit'?'soffit run':k)} className={field} value={patch[k]} onChange={e=>{setPatch(old=>({...old,[k]:e.target.value}));reset()}}>{['unchanged',...options].map(v=><option key={v}>{v}</option>)}</select></label>)}
 <label className="flex items-start gap-2"><input type="checkbox" checked={excludeOther} onChange={e=>{setExcludeOther(e.target.checked);reset()}}/>Explicitly exclude changed assemblies on other classified edges</label>
 <p className="text-slate-400">Unclassified edges remain pending. Existing assignments on non-target edges remain unchanged unless explicitly excluded above.</p>
 <button className="rounded bg-sky-800 px-2 py-1 disabled:opacity-40" disabled={!targets.length||!changed.length} onClick={()=>{
  const targetIds=new Set(targets.map(e=>e.id)),otherIds=new Set(others.map(e=>e.id));
  const next=entities.map(e=>{
   if(e.kind!=='roofEdge'||(!targetIds.has(e.id)&&!otherIds.has(e.id)))return e;
   const applicability={...e.applicability};
   for(const k of changed)applicability[k]=otherIds.has(e.id)?'excluded':patch[k] as Applicability;
   return {...e,applicability};
  });
  try{measureRoof(workspaceId,next);setPreview({source:entities,next,targets,others});setError('')}catch(err){setError(err instanceof Error?err.message:String(err))}
 }}>Preview assignments</button>
 {preview&&<div className="border border-sky-700 rounded p-2 space-y-1">
 <p className="font-semibold">Review assignment changes</p>
 <p>{preview.targets.length} target edges · {length(preview.targets)}</p>
 {preview.targets.map(e=><p key={e.id}>{names.get(e.id)} · {e.edgeType}</p>)}
 {changed.map(k=><p key={k}>{k}: {patch[k]}</p>)}
 {preview.others.length>0&&<><p>Explicit exclusions: {preview.others.length} other classified edges</p>{preview.others.map(e=><p key={e.id}>{names.get(e.id)} · {e.edgeType}</p>)}</>}
 <div className="flex gap-2"><button className="bg-sky-700 rounded px-2 py-1" onClick={()=>{if(preview.source!==entities){setError('Roof changed. Preview assignments again.');setPreview(null);return;}if(onChange(preview.next)){reset();setPatch(emptyPatch());setExcludeOther(false)}else setError('Assignment rejected. Review roof measurements.')}}>Apply assignments</button><button className="bg-slate-700 rounded px-2 py-1" onClick={reset}>Cancel assignments</button></div>
 </div>}
 {error&&<p role="alert" className="text-amber-300">{error}</p>}
 </section>
}
type Surface=Extract<RoofEntity,{kind:'roofSurface'}>;
function DerivedSoffit({entities,planeIds,onChange}:{entities:RoofEntity[];planeIds:string[];onChange:(e:RoofEntity[])=>boolean}){
 const matching=entities.filter((e):e is Surface=>e.kind==='roofSurface'&&e.purpose==='soffit'&&!!e.derivation&&e.derivation.planeIds.length===planeIds.length&&planeIds.every(id=>e.derivation!.planeIds.includes(id)));
 const groupIds=[...new Set(matching.map(e=>e.derivation!.groupId))];
 const existing=matching[0]?.derivation;
 const [depths,setDepths]=useState<Record<Side,string>>(()=>Object.fromEntries(sides.map(side=>[side,existing?String(existing.depths[side]):''])) as Record<Side,string>);
 const [uniform,setUniform]=useState('');
 const [confirmed,setConfirmed]=useState(existing?.cornersConfirmed??false);
 const [preview,setPreview]=useState<{source:RoofEntity[];next:RoofEntity[]|null;outer:Bounds;inner:Bounds;pieces:ReturnType<typeof insetRoof>['pieces'];statuses:Record<Side,Applicability>;interiorSF:number;interiorLF:number;overhangSF:number;includedSF:number;pendingSF:number}|null>(null);
 const [error,setError]=useState('');
 const reset=()=>{setPreview(null);setError('')};
 const makePreview=()=>{
  reset();
  try{
   if(groupIds.length>1)throw Error('Multiple derived soffit groups match this selection. Reconcile them before replacing.');
   const r=rectangularRoof(entities,planeIds);
   if(sides.some(side=>depths[side].trim()===''||!Number.isFinite(Number(depths[side]))||Number(depths[side])<0))throw Error('Enter a nonnegative horizontal depth in feet for each side, including explicit zero.');
   const d=Object.fromEntries(sides.map(side=>[side,Number(depths[side])])) as Depths;
   const inset=insetRoof(r.outer,d);
   const statuses=Object.fromEntries(sides.map(side=>[side,r.boundary[side].soffit])) as Record<Side,Applicability>;
   const includedSF=inset.pieces.filter(p=>statuses[p.side]==='included').reduce((n,p)=>n+p.projectedSF,0);
   const pendingSF=inset.pieces.filter(p=>statuses[p.side]==='unspecified').reduce((n,p)=>n+p.projectedSF,0);
   const mixed=new Set(inset.pieces.map(p=>statuses[p.side])).size>1;
   const spec:DerivationSpec={version:1,groupId:existing?.groupId??'derived:'+uuidv4(),planeIds:[...planeIds],edgeIds:sides.flatMap(side=>r.boundary[side].edgeIds),depths:d,purpose:'soffit',basis:'horizontal',exclusions:[],boundaryConfirmed:false,cornersConfirmed:confirmed};
   let next:RoofEntity[]|null=null;
   if(mixed&&!confirmed)setError('Confirm the mixed corner allocation before applying.');
   else if(!includedSF&&!pendingSF)setError('No included or pending soffit surface. No geometry will be created.');
   else {try{next=replaceDerivedRoofGroup(entities,spec,uuidv4)}catch(err){setError(err instanceof Error?err.message:String(err))}}
   setPreview({source:entities,next,outer:r.outer,inner:inset.inner,pieces:inset.pieces,statuses,interiorSF:inset.interiorSF,interiorLF:inset.interiorLF,overhangSF:inset.overhangSF,includedSF,pendingSF});
  }catch(err){setError(err instanceof Error?err.message:String(err))}
 };
 return <section aria-label="Derive soffit surfaces" className="rounded border border-slate-700 p-2 space-y-2 text-xs">
 <h3 className="font-semibold">Derive soffit surfaces</h3>
 <p>{planeIds.length} source roof plane(s) · {existing?'Replace existing derivation':'New derivation'}</p>
 <p className="text-slate-400">Rectangular classified roof only. Enter horizontal overhang depths in feet, not sloped lengths. For irregular or sloped soffits use Soffit area in the toolbar.</p>
 <label className="block">Uniform overhang (ft)<input aria-label="Uniform overhang (ft)" type="number" min="0" step="any" className={field} value={uniform} onChange={e=>{setUniform(e.target.value);reset()}}/></label>
 <button className="rounded bg-slate-700 px-2 py-1" disabled={uniform.trim()===''||!Number.isFinite(Number(uniform))||Number(uniform)<0} onClick={()=>{setDepths(Object.fromEntries(sides.map(side=>[side,uniform])) as Record<Side,string>);reset()}}>Use for all sides</button>
 <div className="grid grid-cols-2 gap-1">{sides.map(side=><label key={side} className="block capitalize">{side} (ft)<input aria-label={side+' overhang (ft)'} type="number" min="0" step="any" className={field} value={depths[side]} onChange={e=>{setDepths(old=>({...old,[side]:e.target.value}));reset()}}/></label>)}</div>
 <label className="flex gap-2 items-start"><input type="checkbox" checked={confirmed} onChange={e=>{setConfirmed(e.target.checked);reset()}}/>Confirm corner allocation: north/south own full-width corners; east/west stop at the inner boundary.</label>
 <button className="rounded bg-sky-800 px-2 py-1" onClick={makePreview}>Preview soffit derivation</button>
 {preview&&<div className="rounded border border-sky-700 p-2 space-y-1">
 <p className="font-semibold">Review soffit derivation</p>
 <svg role="img" aria-label="Soffit derivation plan" viewBox={[preview.outer.xmin,preview.outer.ymin,preview.outer.xmax-preview.outer.xmin,preview.outer.ymax-preview.outer.ymin].join(' ')} className="w-full max-h-48 bg-slate-950 rounded">
 <rect x={preview.outer.xmin} y={preview.outer.ymin} width={preview.outer.xmax-preview.outer.xmin} height={preview.outer.ymax-preview.outer.ymin} fill="#334155"/>
 {preview.pieces.map(p=><polygon key={p.side} points={p.polygon.map(q=>q.x+','+q.y).join(' ')} fill={preview.statuses[p.side]==='included'?'#2dd4bf':preview.statuses[p.side]==='excluded'?'#64748b':'#fbbf24'}/>)}
 <rect x={preview.inner.xmin} y={preview.inner.ymin} width={preview.inner.xmax-preview.inner.xmin} height={preview.inner.ymax-preview.inner.ymin} fill="#0f172a" stroke="#cbd5e1" strokeWidth="1" vectorEffect="non-scaling-stroke"/>
 </svg>
 <p>Physical overhang: {preview.overhangSF.toFixed(2)} SF</p><p>Interior footprint: {preview.interiorSF.toFixed(2)} SF · {preview.interiorLF.toFixed(2)} LF perimeter (reference only, not confirmed thermal scope)</p>
 {preview.pieces.map(p=><p key={p.side} className="capitalize">{p.side}: {p.projectedSF.toFixed(2)} SF · {preview.statuses[p.side]}</p>)}
 <p className="font-semibold text-teal-300">Included soffit: {preview.includedSF.toFixed(2)} SF</p>
 {preview.pendingSF>0&&<p className="text-amber-300">Pending applicability: {preview.pendingSF.toFixed(2)} SF (geometry retained; quantity unquantified)</p>}
 <div className="flex flex-wrap gap-2"><button className="rounded bg-emerald-800 px-2 py-1 disabled:opacity-40" disabled={!preview.next||preview.source!==entities} onClick={()=>{if(preview.source!==entities||!preview.next)return;if(onChange(preview.next))reset();else setError('Derivation rejected. Review roof measurements.')}}>Apply soffit derivation</button><button className="rounded bg-slate-700 px-2 py-1" onClick={reset}>Cancel soffit derivation</button></div>
 {preview.source!==entities&&<p className="text-amber-300">Roof changed. Preview again.</p>}
 </div>}
 {existing&&groupIds.length===1&&<button className="rounded bg-red-900 px-2 py-1" onClick={()=>{try{if(window.confirm('Remove this complete derived soffit group? Source roof geometry is preserved.')&&onChange(removeDerivedRoofGroup(entities,existing.groupId)))reset()}catch(err){setError(err instanceof Error?err.message:String(err))}}}>Remove derived soffit group</button>}
 {error&&<p role="alert" className="text-amber-300">{error}</p>}
 </section>;
}
const insulationMaterials=['blown cellulose','blown fiberglass','fiberglass batt','mineral wool batt','closed cell foam','open cell foam','other'];
type ExclusionDraft=Record<'x'|'y'|'width'|'depth',string>;
function DerivedInsulation({entities,planeIds,onChange}:{entities:RoofEntity[];planeIds:string[];onChange:(e:RoofEntity[])=>boolean}){
 const sameScope=(e:RoofEntity):e is Surface=>e.kind==='roofSurface'&&!!e.derivation&&e.derivation.planeIds.length===planeIds.length&&planeIds.every(id=>e.derivation!.planeIds.includes(id));
 const matching=entities.filter(sameScope).filter(e=>e.purpose==='insulation');
 const groupIds=[...new Set(matching.map(e=>e.derivation!.groupId))];
 const existing=matching[0]?.derivation;
 const soffit=entities.filter(sameScope).find(e=>e.purpose==='soffit')?.derivation;
 const [depths,setDepths]=useState<Record<Side,string>>(()=>Object.fromEntries(sides.map(side=>[side,existing?String(existing.depths[side]):''])) as Record<Side,string>);
 const [uniform,setUniform]=useState('');
 const [basis,setBasis]=useState<''|'horizontal'|'sloped'>(existing?.basis??'');
 const [material,setMaterial]=useState(existing?.material??'');
 const [thickness,setThickness]=useState(existing?.thicknessFt===undefined?'':String(existing.thicknessFt*12));
 const [confirmed,setConfirmed]=useState(existing?.boundaryConfirmed??false);
 const [exclusions,setExclusions]=useState<ExclusionDraft[]>(()=>{
  if(!existing)return [];
  try{const r=rectangularRoof(entities,planeIds,false),inner=insetRoof(r.outer,existing.depths).inner;return existing.exclusions.map(b=>({x:String(b.xmin-inner.xmin),y:String(b.ymin-inner.ymin),width:String(b.xmax-b.xmin),depth:String(b.ymax-b.ymin)}));}catch{return []}
 });
 const [preview,setPreview]=useState<{source:RoofEntity[];next:RoofEntity[]|null;outer:Bounds;inner:Bounds;exclusions:Bounds[];pieces:ThermalPiece[];projected:number;measured:number;pending:number;excluded:number}|null>(null);
 const [error,setError]=useState('');
 const reset=()=>{setPreview(null);setError('');setConfirmed(false)};
 const makePreview=()=>{
  setPreview(null);setError('');
  try{
   if(groupIds.length>1)throw Error('Multiple insulation groups match this scope. Reconcile before replacing.');
   const r=rectangularRoof(entities,planeIds,false);
   if(sides.some(side=>depths[side].trim()===''||!Number.isFinite(Number(depths[side]))||Number(depths[side])<0))throw Error('Enter a nonnegative horizontal depth for each side, including zero.');
   if(!basis||!material)throw Error('Choose an explicit insulation surface basis and material.');
   const depthFt=thickness.trim()===''?undefined:Number(thickness)/12;
   if(depthFt!==undefined&&(!Number.isFinite(depthFt)||depthFt<=0))throw Error('Enter positive thickness in inches or leave unspecified.');
   const d=Object.fromEntries(sides.map(side=>[side,Number(depths[side])])) as Depths;
   const inset=insetRoof(r.outer,d),inner=inset.inner;
   const boxes=exclusions.map((b:ExclusionDraft)=>{
    if([b.x,b.y,b.width,b.depth].some(v=>v.trim()===''||!Number.isFinite(Number(v))))throw Error('Complete every thermal exclusion dimension.');
    const x=inner.xmin+Number(b.x),y=inner.ymin+Number(b.y);
    return {xmin:x,ymin:y,xmax:x+Number(b.width),ymax:y+Number(b.depth)};
   });
   const rects=thermalRectangles(inner,boxes),pieces=thermalPieces(rects,r.planes,basis);
   const projected=pieces.reduce((n,p)=>n+p.projectedSF,0),measured=pieces.reduce((n,p)=>n+(p.actualSF??0),0),pending=pieces.filter(p=>p.actualSF===null).length;
   const spec:DerivationSpec={version:1,groupId:existing?.groupId??'derived:'+uuidv4(),planeIds:[...planeIds],edgeIds:sides.flatMap(side=>r.boundary[side].edgeIds),depths:d,purpose:'insulation',basis,exclusions:boxes,boundaryConfirmed:confirmed,cornersConfirmed:false,material,thicknessFt:depthFt};
   let next:RoofEntity[]|null=null;
   if(!confirmed)setError('Review the footprint and explicitly confirm the thermal boundary before applying.');
   else try{next=replaceDerivedRoofGroup(entities,spec,uuidv4)}catch(err){setError(err instanceof Error?err.message:String(err))}
   setPreview({source:entities,next,outer:r.outer,inner,exclusions:boxes,pieces,projected,measured,pending,excluded:inset.interiorSF-projected});
  }catch(err){setError(err instanceof Error?err.message:String(err))}
 };
 const updateExclusion=(index:number,key:keyof ExclusionDraft,value:string)=>{setExclusions(old=>old.map((b,i)=>i===index?{...b,[key]:value}:b));reset()};
 return <section aria-label="Derive insulation surfaces" className="rounded border border-slate-700 p-2 space-y-2 text-xs">
 <h3 className="font-semibold">Derive insulation surfaces</h3>
 <p>{planeIds.length} source roof plane(s) · {existing?'Replace existing derivation':'New derivation'}</p>
 <p className="text-slate-400">Confirm actual thermal limits. Physical overhangs do not depend on finished soffit applicability. Roof openings are not automatic thermal exclusions. Use manual insulation surfaces for irregular thermal boundaries.</p>
 {soffit&&<button className="rounded bg-slate-700 px-2 py-1" onClick={()=>{setDepths(Object.fromEntries(sides.map(side=>[side,String(soffit.depths[side])])) as Record<Side,string>);reset()}}>Copy physical overhang depths from soffit</button>}
 <label className="block">Uniform thermal inset (ft)<input aria-label="Uniform thermal inset (ft)" type="number" min="0" step="any" className={field} value={uniform} onChange={e=>{setUniform(e.target.value);reset()}}/></label>
 <button className="rounded bg-slate-700 px-2 py-1" disabled={uniform.trim()===''||!Number.isFinite(Number(uniform))||Number(uniform)<0} onClick={()=>{setDepths(Object.fromEntries(sides.map(side=>[side,uniform])) as Record<Side,string>);reset()}}>Use thermal inset for all sides</button>
 <div className="grid grid-cols-2 gap-1">{sides.map(side=><label key={side} className="block capitalize">{side} inset (ft)<input aria-label={side+' thermal inset (ft)'} type="number" min="0" step="any" className={field} value={depths[side]} onChange={e=>{setDepths(old=>({...old,[side]:e.target.value}));reset()}}/></label>)}</div>
 <label className="block">Insulation surface basis<select aria-label="Derived insulation basis" className={field} value={basis} onChange={e=>{setBasis(e.target.value as typeof basis);reset()}}><option value="">Choose basis</option><option value="horizontal">Horizontal ceiling / attic</option><option value="sloped">Sloped roof deck</option></select></label>
 <label className="block">Insulation material<select aria-label="Derived insulation material" className={field} value={material} onChange={e=>{setMaterial(e.target.value);reset()}}><option value="">Choose material</option>{insulationMaterials.map(m=><option key={m}>{m}</option>)}</select></label>
 <label className="block">Thickness (inches, optional)<input aria-label="Derived insulation thickness (inches)" type="number" min="0.000001" step="any" className={field} value={thickness} onChange={e=>{setThickness(e.target.value);reset()}}/></label>
 <p className="text-slate-400">Material does not determine measurement basis. Foam board feet require thickness; missing thickness remains pending.</p>
 <h4 className="font-semibold">Thermal exclusions</h4>
 <p className="text-slate-400">Rectangles located in feet from the inner footprint's upper-left corner, x right and y down. Confirm garages, porches and other unconditioned areas against drawings.</p>
 {exclusions.map((b,i)=><div key={i} className="rounded border border-slate-700 p-1 space-y-1"><div className="grid grid-cols-2 gap-1">{(['x','y','width','depth'] as const).map(k=><label key={k} className="capitalize">{k} (ft)<input aria-label={'Exclusion '+(i+1)+' '+k+' (ft)'} type="number" min="0" step="any" className={field} value={b[k]} onChange={e=>updateExclusion(i,k,e.target.value)}/></label>)}</div><button className="text-red-300" onClick={()=>{setExclusions(old=>old.filter((_,j)=>i!==j));reset()}}>Remove exclusion {i+1}</button></div>)}
 <button className="rounded bg-slate-700 px-2 py-1" onClick={()=>{setExclusions(old=>[...old,{x:'',y:'',width:'',depth:''}]);reset()}}>Add thermal exclusion</button>
 <label className="flex gap-2 items-start"><input type="checkbox" aria-label="Confirm thermal boundary" checked={confirmed} onChange={e=>{setConfirmed(e.target.checked);setPreview(null);setError('')}}/>Confirm the thermal footprint, exclusions and selected basis against the project drawings.</label>
 <button className="rounded bg-sky-800 px-2 py-1" onClick={makePreview}>Preview insulation derivation</button>
 {preview&&<div className="rounded border border-sky-700 p-2 space-y-1">
 <p className="font-semibold">Review insulation derivation</p>
 <svg role="img" aria-label="Insulation derivation plan" viewBox={[preview.outer.xmin,preview.outer.ymin,preview.outer.xmax-preview.outer.xmin,preview.outer.ymax-preview.outer.ymin].join(' ')} className="w-full max-h-48 bg-slate-950 rounded">
 <rect x={preview.outer.xmin} y={preview.outer.ymin} width={preview.outer.xmax-preview.outer.xmin} height={preview.outer.ymax-preview.outer.ymin} fill="#334155"/>
 {preview.pieces.map((p,i)=><polygon key={i} points={p.polygon.map(q=>q.x+','+q.y).join(' ')} fill={p.actualSF===null?'#fbbf24':'#c084fc'} stroke="#0f172a" strokeWidth=".6" vectorEffect="non-scaling-stroke"/>)}
 {preview.exclusions.map((b,i)=><rect key={i} x={b.xmin} y={b.ymin} width={b.xmax-b.xmin} height={b.ymax-b.ymin} fill="#64748b"/>)}
 <rect x={preview.inner.xmin} y={preview.inner.ymin} width={preview.inner.xmax-preview.inner.xmin} height={preview.inner.ymax-preview.inner.ymin} fill="none" stroke="#cbd5e1" strokeWidth="1" vectorEffect="non-scaling-stroke"/>
 </svg>
 <p>Excluded thermal footprint: {preview.excluded.toFixed(2)} SF</p><p>Net projected footprint: {preview.projected.toFixed(2)} SF</p>
 <p className="font-semibold text-purple-300">{basis==='horizontal'?'Horizontal':'Sloped'} insulation: {preview.pending===preview.pieces.length?'Not quantified':preview.measured.toFixed(2)+' SF'}{preview.pending&&preview.pending<preview.pieces.length?' + pending':''}</p>
 {preview.pending>0&&<p className="text-amber-300">{preview.pending} surface piece(s) require source roof pitch.</p>}
 {material.includes('foam')?<p>Foam: {thickness.trim()===''||preview.pending===preview.pieces.length?'Not quantified':(preview.measured*Number(thickness)).toFixed(2)+' BF'}{preview.pending&&thickness.trim()!==''&&preview.measured>0?' + pending':''}</p>:thickness.trim()!==''&&<p>Geometric volume (reference only): {preview.pending===preview.pieces.length?'Not quantified':(preview.measured*Number(thickness)/12).toFixed(2)+' CF'}{preview.pending&&preview.pending<preview.pieces.length?' + pending':''}; no procurement or R-value calculation.</p>}
 <p>{preview.pieces.length} derived surface piece(s)</p>
 <div className="flex flex-wrap gap-2"><button className="rounded bg-emerald-800 px-2 py-1 disabled:opacity-40" disabled={!preview.next||preview.source!==entities} onClick={()=>{if(!preview.next||preview.source!==entities)return;if(onChange(preview.next)){setPreview(null);setError('')}else setError('Derivation rejected. Review roof measurements.')}}>Apply insulation derivation</button><button className="rounded bg-slate-700 px-2 py-1" onClick={()=>{setPreview(null);setError('')}}>Cancel insulation derivation</button></div>
 {preview.source!==entities&&<p className="text-amber-300">Roof changed. Preview again.</p>}
 </div>}
 {existing&&groupIds.length===1&&<button className="rounded bg-red-900 px-2 py-1" onClick={()=>{try{if(window.confirm('Remove this complete derived insulation group? Source roof geometry is preserved.')&&onChange(removeDerivedRoofGroup(entities,existing.groupId)))reset()}catch(err){setError(err instanceof Error?err.message:String(err))}}}>Remove derived insulation group</button>}
 {error&&<p role="alert" className="text-amber-300">{error}</p>}
 </section>;
}

export function RoofInspector({workspaceId,entities,selection,onChange,onSelect,onDelete}:{workspaceId:string;entities:RoofEntity[];selection:SelectionState;onChange:(e:RoofEntity[])=>boolean;onSelect:(s:SelectionState)=>void;onDelete:()=>void}){
 const selectedIds=selection.type==='roof'?(selection.ids??(selection.id?[selection.id]:[])):[];
 const e=selectedIds.length===1?entities.find(e=>e.id===selectedIds[0]):undefined;
 const sourceIds=e?.kind==='roofSurface'&&e.derivation?e.derivation.planeIds:entities.filter(q=>q.kind==='roofPlane'&&selectedIds.includes(q.id)).map(q=>q.id);
 const sourceKey=JSON.stringify([...sourceIds].sort());

 const derived=e?.kind==='roofSurface'?e.derivation:undefined;
 const rectangle=(()=>{if(derived||!e||!('polygon' in e)||e.polygon.length!==4)return null;const a=e.polygon[0],b=e.polygon[2],width=Math.abs(b.x-a.x),depth=Math.abs(b.y-a.y);try{resizeRectangle(e.polygon,width,depth);return {width,depth}}catch{return null}})();
 const resize=(w:number,d:number)=>{try{return !!e&&onChange(resizeRoofRectangle(entities,e.id,w,d))}catch(err){alert(err instanceof Error?err.message:String(err));return false}};
 const names=new Map(entities.map((q,i)=>[q.id,(q.kind==='roofPlane'?'Roof plane':q.kind==='roofEdge'?'Roof edge':q.kind==='roofOpening'?'Roof opening':q.purpose==='soffit'?'Soffit area':'Insulation area')+' '+(i+1)]));
 const result=useMemo(()=>{try{return measureRoof(workspaceId,entities)}catch(err){return {rows:[],warnings:[err instanceof Error?err.message:String(err)]}}},[workspaceId,entities]);
 const update=(patch:Partial<RoofEntity>)=>{if(e)return onChange(entities.map(q=>q.id===e.id?{...q,...patch} as RoofEntity:q))};
 const selectedEdge=e?.kind==='roofEdge'?e:null;
 const edgeParents=selectedEdge?entities.filter((q):q is Extract<RoofEntity,{kind:'roofPlane'}>=>q.kind==='roofPlane'&&selectedEdge.planeIds.includes(q.id)):[];
 const edgePending=edgeParents.flatMap(p=>p.pitchRise===null?[names.get(p.id)+': specify pitch']:p.pitchRise>0&&p.slopeDegrees===null?[names.get(p.id)+': specify downslope direction']:[]);
 const actualEdge=selectedEdge&&edgeParents.length===selectedEdge.planeIds.length&&!edgePending.length?edgeLength(selectedEdge.start,selectedEdge.end,edgeParents[0].pitchRise,edgeParents[0].slopeDegrees):null;
 const totals=new Map<string,{unit:string;qty:number;missing:number;reasons:string[]}>();
 for(const r of result.rows){const x=totals.get(r.code)||{unit:r.unit,qty:0,missing:0,reasons:[]};if(r.status==='measured')x.qty+=r.quantity;else {x.missing++;x.reasons.push((names.get(r.elementId)||'Measurement')+': '+r.reason);}totals.set(r.code,x)}
 const labels:Record<string,string>={'roof.projected':'Projected gross area','roof.gross':'Gross sloped area','roof.deduction':'Opening deductions','roof.covering':'Net covering','roof.fascia':'Fascia','roof.gutter':'Eavestrough','roof.soffit.run':'Soffit run','roof.soffit.area':'Soffit area'};
 return <aside className="w-72 shrink-0 overflow-y-auto bg-slate-900 border-l border-slate-700 p-3 space-y-3 text-slate-200">
 <h2 className="text-sm font-semibold">Roof properties</h2>
 <select aria-label="Select roof entity" className={field} value={e?.id||''} onChange={ev=>onSelect(ev.target.value?{type:'roof',id:ev.target.value}:{type:'none'})}><option value="">Select entity</option>{entities.map((q,i)=><option key={q.id} value={q.id}>{names.get(q.id)}{q.kind==='roofEdge'?' · '+q.edgeType:''}</option>)}</select>
 {selectedIds.length>1&&<section aria-label="Roof selection" className="rounded border border-sky-700 p-2 space-y-2 text-xs"><p className="font-semibold">{selectedIds.length} roof entities selected</p><div className="flex flex-wrap gap-2"><button className="rounded bg-red-900 px-2 py-1" onClick={onDelete}>Delete selected assembly</button><button className="rounded bg-slate-700 px-2 py-1" onClick={()=>onSelect({type:'none'})}>Clear selection</button></div></section>}
 {e&&(e.kind==='roofPlane'||e.kind==='roofEdge')&&e.roofGroupId&&<button className="rounded bg-sky-800 px-2 py-1 text-xs" onClick={()=>onSelect({type:'roof',ids:roofAssemblyMembers(entities,e.id)})}>Select entire roof assembly</button>}
 {e&&<div key={JSON.stringify(e)} className="space-y-2">
 <label className="block text-xs">Source reference<input className={field} defaultValue={e.source.reference} onBlur={ev=>{if(!ev.target.value.trim()||(ev.target.value!==e.source.reference&&!update({source:{...e.source,reference:ev.target.value.trim()}})))ev.target.value=e.source.reference}}/></label>
 {'polygon' in e&&<div className="text-xs">Projected polygon: {projectedArea(e.polygon).toFixed(2)} SF</div>}
 {rectangle&&<><Numeric label="Projected width (ft)" value={rectangle.width} min={0.000001} onCommit={v=>v!==null&&resize(v,rectangle.depth)}/><Numeric label="Projected depth (ft)" value={rectangle.depth} min={0.000001} onCommit={v=>v!==null&&resize(rectangle.width,v)}/><p className="text-xs text-slate-400">First corner fixed; dependent geometry protected.</p></>}
 {e.kind==='roofPlane'&&<>
 <div className="flex flex-wrap gap-1">{[0,3,4,6,8,10,12].map(p=><button key={p} type="button" className="rounded bg-slate-800 px-2 py-1 text-xs" onClick={()=>update({pitchRise:p})}>{p}:12</button>)}</div>
 <Numeric label="Pitch rise per 12" value={e.pitchRise} min={0} onCommit={pitchRise=>update({pitchRise})}/>
 <div className="grid grid-cols-2 gap-1">{[[0,'Right'],[90,'Down'],[180,'Left'],[270,'Up']].map(([v,n])=><button key={v} type="button" className="bg-slate-800 rounded p-1 text-xs" onClick={()=>update({slopeDegrees:Number(v)})}>{n} {v}°</button>)}</div>
 <Numeric label="Downslope direction (0 right, 90 down)" value={e.slopeDegrees} min={0} max={359.999999} onCommit={slopeDegrees=>update({slopeDegrees})}/>
 <Numeric label="Elevation at first vertex (ft, optional)" value={e.elevationFt} onCommit={elevationFt=>update({elevationFt})}/>
 </>}
 {e.kind==='roofEdge'&&<>
 <div className="rounded border border-slate-700 p-2 space-y-1 text-xs">
 <p>Projected edge length: {Math.hypot(e.end.x-e.start.x,e.end.y-e.start.y).toFixed(2)} LF</p>
 <p>Actual edge length: {actualEdge===null?'Not quantified':actualEdge.toFixed(2)+' LF'}</p>
 {edgePending.map(reason=><p key={reason} className="text-amber-300">{reason}</p>)}
 {e.edgeType==='unclassified'&&<p className="text-amber-300">Choose a classification before assigning assemblies.</p>}
 <p className="text-slate-400">Projected length is a reference, not a substitute for actual sloped length.</p>
 </div>
 <label className="block text-xs">Classification<select aria-label="Classification" className={field} value={e.edgeType} onChange={ev=>update({edgeType:ev.target.value as typeof e.edgeType})}>{['unclassified','eave','rake','ridge','hip','valley','abutment','parapet'].map(v=><option key={v}>{v}</option>)}</select></label>
 <p className="text-xs text-slate-400">Included counts toward the assembly; excluded does not; unspecified remains pending. Soffit run is linear length, not surface area.</p>
 {(['fascia','gutter','soffit'] as const).map(k=><label key={k} className="block text-xs">{k==='gutter'?'Eavestrough (gutter)':k==='soffit'?'Soffit run':k}<select aria-label={k==='gutter'?'Eavestrough (gutter)':k==='soffit'?'Soffit run':'Fascia'} className={field} value={e.applicability?.[k]||'unspecified'} onChange={ev=>update({applicability:{...e.applicability,[k]:ev.target.value as Applicability}})}>{options.map(v=><option key={v}>{v}</option>)}</select></label>)}
 </>}
 {e.kind==='roofOpening'&&<label className="block text-xs">Deduction treatment<select className={field} value={e.deduction||'unspecified'} onChange={ev=>update({deduction:ev.target.value as Applicability})}>{options.map(v=><option key={v}>{v}</option>)}</select></label>}
 {derived&&<div className="rounded border border-sky-700 p-2 space-y-1 text-xs"><p className="font-semibold">Derived surface — group controlled</p><p>Revise dimensions, basis, material and thickness using the complete derivation controls below. Individual geometry edits are unavailable.</p>{derived.pendingApplicability&&<p className="text-amber-300">Soffit applicability pending — quantity unquantified.</p>}</div>}
 {e.kind==='roofSurface'&&!derived&&<>
 <p className="text-xs text-slate-400">Choose the actual surface basis. For horizontal surfaces use zero pitch; for sloped surfaces specify pitch. Insulation requires material and foam volume requires thickness.</p>
 <label className="block text-xs">Surface basis<select className={field} value={e.surfaceBasis||''} onChange={ev=>update({surfaceBasis:ev.target.value as 'horizontal'|'sloped',pitchRise:ev.target.value==='horizontal'?0:null})}><option value="" disabled>Not specified</option><option value="horizontal">Horizontal</option><option value="sloped">Sloped</option></select></label>
 {e.surfaceBasis==='sloped'&&<Numeric label="Surface pitch rise per 12" value={e.pitchRise} min={0} onCommit={pitchRise=>update({pitchRise})}/>}
 {e.purpose==='insulation'&&<>
 <label className="block text-xs">Insulation type<select className={field} value={e.insulationType||''} onChange={ev=>update({insulationType:ev.target.value||undefined})}><option value="">Not specified</option>{insulationMaterials.map(v=><option key={v}>{v}</option>)}</select></label>
 <Numeric label="Thickness (inches)" value={e.depthFt===undefined?null:e.depthFt*12} min={0.000001} onCommit={v=>update({depthFt:v===null?undefined:v/12})}/>
 </>}
 </>}
 {!derived&&<button className="rounded bg-red-900 px-2 py-1 text-xs" onClick={onDelete}>Delete selected</button>}</div>}
 <div key={workspaceId}><BulkAssemblies entities={entities} workspaceId={workspaceId} names={names} onChange={onChange}/></div>
 {sourceIds.length>0?<div key={workspaceId+sourceKey}><DerivedSoffit entities={entities} planeIds={sourceIds} onChange={onChange}/></div>:<p className="text-xs text-slate-400">Select a roof plane or entire roof assembly to derive soffit surfaces. Use the toolbar for manual surfaces.</p>}

 {sourceIds.length>0&&<div key={workspaceId+sourceKey+'-insulation'}><DerivedInsulation entities={entities} planeIds={sourceIds} onChange={onChange}/></div>}
 <hr className="border-slate-700"/><h2 className="text-sm font-semibold">Roof quantities</h2><p className="text-xs text-slate-400">Raw measurements only — no rates or waste.</p>
 {[...totals].map(([code,x])=><React.Fragment key={code}><div className="flex justify-between gap-2 text-xs"><span>{labels[code]||code.replace('roof.','').replaceAll('.',' ')}</span><span className={x.missing?'text-amber-300':'text-slate-100'}>{x.missing?(x.qty?x.qty.toFixed(2)+' '+x.unit+' + pending':'Not quantified'):x.qty.toFixed(2)+' '+x.unit}</span></div>{x.missing>0&&<details className="text-xs text-amber-300"><summary>{labels[code]||code.replace('roof.','').replaceAll('.',' ')}: {x.missing} pending</summary>{x.reasons.map((reason,i)=><p key={i}>{reason}</p>)}</details>}</React.Fragment>)}
 {totals.has('roof.covering')&&!totals.get('roof.covering')!.missing&&<div className="text-xs">Roofing squares: {(totals.get('roof.covering')!.qty/100).toFixed(2)} SQ (same area)</div>}
 {result.warnings.some(w=>!w.includes('explicitly excluded'))&&<details open><summary className="text-xs text-amber-300">Measurement checks</summary>{result.warnings.filter(w=>!w.includes('explicitly excluded')).map((w,i)=><p key={i} className="text-xs text-amber-300">{entities.reduce((s,q)=>s.replace(q.id,names.get(q.id)||q.id),w).replace(/^Plane Roof plane/,'Roof plane').replace(/^Edge Roof edge/,'Roof edge')}</p>)}</details>}{result.warnings.some(w=>w.includes('explicitly excluded'))&&<details><summary className="text-xs text-slate-400">Explicit exclusions</summary>{result.warnings.filter(w=>w.includes('explicitly excluded')).map((w,i)=><p key={i} className="text-xs text-slate-400">{entities.reduce((s,q)=>s.replace(q.id,names.get(q.id)||q.id),w)}</p>)}</details>}
 </aside>;
}
