import { formatFoundationQuantity } from '../engine/measurements/foundationUnits';
import {FoundationDimensionInput, FoundationMetricContext} from './FoundationDimensionInput';
import {FoundationMaterialInput, foundationMaterialCategory} from './FoundationMaterialInput';
import {previewFoundationGeneration,foundationReplacement,applyFoundationGeneration} from '../engine/measurements/foundationGeneration';
import {manualFoundationCoverage} from '../engine/measurements/foundationManualCoverage';
import {setFoundationApplicability} from '../engine/measurements/foundationApplicability';
import {assignFoundationAssembly,foundationBaseElevation,convertFoundationElevation,editFoundationRuns} from '../engine/measurements/foundationAssembly';
import {derivePerimeterDrainage} from '../engine/measurements/foundationDrainageDerivation';
import {deriveFoundationEnvelope,deriveRectangularEnvelope} from '../engine/measurements/foundationEnvelopeDerivation';
import type {FoundationEnvelopeSource} from '../engine/measurements/measurementTypes';
import {deriveStripFootings,foundationAssemblyIds} from '../engine/measurements/foundationDerivation';
import React,{useMemo,useState,useEffect} from 'react';
import type {ActiveTool,SelectionState} from '../types';
import type {FoundationEntity,FoundationMetadata} from '../engine/measurements/measurementTypes';
import {v4 as uuidv4} from 'uuid';
import {foundationTools,generateFoundationPerimeter} from '../engine/measurements/foundationDrafting';
import {type RectangleReference} from '../engine/measurements/foundationGeometry';
import {validateFoundationTopology} from '../engine/measurements/foundationTopology';
import {rectanglePoints} from '../engine/precisionDrafting';
import {measureFoundation} from '../engine/measurements/foundationMeasurements';
export function FoundationToolbar({activeTool,onSelectTool,onStandardSlab}:{activeTool:ActiveTool;onSelectTool:(t:ActiveTool)=>void;onStandardSlab:(mode:'rectangle'|'polygon')=>void}){
 const primary=new Set<ActiveTool>(['foundation_rectangle','foundation_perimeter','foundation_wall','foundation_pad']);
 const renderTool=([tool,label]:readonly[ActiveTool,string])=><button key={tool} onClick={()=>onSelectTool(tool)}
  className={'block w-full text-left text-xs rounded p-2 mb-1 '+(activeTool===tool?'bg-sky-700 text-white':'bg-slate-800 hover:bg-slate-700')}>{label}</button>;
 return <aside className="w-36 shrink-0 bg-slate-900 border-r border-slate-700 p-2 overflow-y-auto">
  <h2 className="text-xs uppercase text-slate-400 mb-3">Foundation tools</h2>
  {renderTool(['select','Select'])}
  {foundationTools.filter(([tool])=>primary.has(tool)).map(renderTool)}
  <button onClick={()=>onStandardSlab('rectangle')} className="block w-full text-left text-xs rounded p-2 mb-1 bg-slate-800 hover:bg-slate-700">Draw rectangular slab</button>
  <button onClick={()=>onStandardSlab('polygon')} className="block w-full text-left text-xs rounded p-2 mb-1 bg-slate-800 hover:bg-slate-700">Draw polygon slab</button>
  {renderTool(['calibrate_scale','Calibrate scale'])}
  <details className="text-xs">
   <summary className="cursor-pointer mb-1">Advanced foundation tools</summary>
   {foundationTools.filter(([tool])=>!primary.has(tool)).map(renderTool)}
   {renderTool(['ruler_measure','Measure'])}
   {renderTool(['text_label','Annotation'])}
  </details>
 </aside>;
}
const field='block w-full bg-slate-800 border border-slate-600 rounded p-1.5 text-xs';
const dimension=(label:string,value:string,onChange:(value:string)=>void,section=false,hint?:string)=>
 <FoundationDimensionInput label={label} value={value} onChange={onChange} className={field} section={section} hint={hint}/>;

function Properties({entity,onSave}:{key?:string;entity:FoundationEntity;onSave:(e:FoundationEntity)=>boolean}){
 const [material,setMaterial]=useState(entity.foundation?.material??'');
 const [width,setWidth]=useState('widthFt' in entity?String(entity.widthFt??''):'');
 const [height,setHeight]=useState('heightFt' in entity?String(entity.heightFt??''):'');
 const [depth,setDepth]=useState('depthFt' in entity?String(entity.depthFt??''):'');
 const [elevation,setElevation]=useState('elevationFt' in entity?String(entity.elevationFt??''):'');
 const [elevationBasis,setElevationBasis]=useState<'base'|'top'>('base');
 const [joinStart,setJoinStart]=useState(String(entity.foundation?.joinStartFt??''));
 const [joinEnd,setJoinEnd]=useState(String(entity.foundation?.joinEndFt??''));
 const [centre,setCentre]=useState(!!entity.foundation?.centrelineConfirmed);
 const [layer,setLayer]=useState(entity.foundation?.coverage?.layerId??entity.foundation?.granularLayerId??entity.foundation?.envelopeSource?.layerId??'');
 const [confirmed,setConfirmed]=useState(!!entity.foundation?.coverage?.confirmed);
 const [coverageFoam,setCoverageFoam]=useState(!!entity.foundation?.coverage?.foam);
 const [coverageThickness,setCoverageThickness]=useState(String(entity.foundation?.coverage?.thicknessFt??''));
 const [openingTreatment,setOpeningTreatment]=useState<''|'none'|'alreadyDeducted'>(entity.foundation?.coverage?.openingTreatment??'');
 const [error,setError]=useState('');
 const number=(v:string)=>{if(!v.trim())return null;const n=Number(v);if(!Number.isFinite(n))throw Error('Enter finite dimensions');return n};
 const input=(label:string,v:string,set:(s:string)=>void)=><label className="block">{label}<input aria-label={label} className={field} value={v} onChange={e=>set(e.target.value)}/></label>;
 const category=foundationMaterialCategory(entity);
 const coverage=entity.kind==='foundationLine'||entity.kind==='foundationRegion'&&entity.purpose==='insulation';
 return <form className="space-y-2 text-xs" onSubmit={ev=>{ev.preventDefault();try{if(!material.trim())throw Error('Specify construction material');const f:FoundationMetadata={...entity.foundation,version:1,material:material.trim()};if('widthFt' in entity){if(centre){f.centrelineConfirmed=true;const a=number(joinStart),b=number(joinEnd);if(a!==null)f.joinStartFt=a;else delete f.joinStartFt;if(b!==null)f.joinEndFt=b;else delete f.joinEndFt;}else{delete f.centrelineConfirmed;delete f.joinStartFt;delete f.joinEndFt;}}if('elevationFt' in entity){if(elevation.trim())f.baseElevationConfirmed=true;else delete f.baseElevationConfirmed;}if(entity.kind==='foundationRegion'&&entity.purpose==='granular'){if(f.envelopeSource){if(layer.trim()!==f.envelopeSource.layerId)throw Error('Replace derived layer to change its identity');}else if(layer.trim())f.granularLayerId=layer.trim();else delete f.granularLayerId;}if(coverage){const c=manualFoundationCoverage(entity,{layer,confirmed,foam:coverageFoam,thicknessFt:number(coverageThickness),openingTreatment});if(c)f.coverage=c;else delete f.coverage;}let next:FoundationEntity={...entity,foundation:f};if('widthFt' in next){if(entity.source.reference.startsWith('Generated ')&&'widthFt' in entity&&(number(width)!==entity.widthFt||!centre||(f.joinStartFt??0)!==(entity.foundation?.joinStartFt??0)||(f.joinEndFt??0)!==(entity.foundation?.joinEndFt??0)))throw Error('Generated perimeter reference requires regeneration before width or junction changes');next={...next,widthFt:number(width),heightFt:number(height),elevationFt:foundationBaseElevation(number(elevation),elevationBasis,number(height))};}else if('polygon' in next)next={...next,depthFt:number(depth),elevationFt:foundationBaseElevation(number(elevation),elevationBasis,number(depth))};else if(next.kind==='foundationLine'){const h=number(height);next={...next,heightFt:h??undefined}}if(!onSave(next))throw Error('Edit rejected; review geometry and dimensions');setError('')}catch(err){setError(err instanceof Error?err.message:String(err))}}}>
 {category?<FoundationMaterialInput label="Material" category={category} value={material} onChange={setMaterial} className={field}/>:input('Material',material,setMaterial)}
 {'widthFt' in entity&&<>{dimension('Width',width,setWidth,true)}{dimension('Height / depth',height,setHeight,entity.kind==='stripFooting')}<label className="block"><input type="checkbox" checked={centre} onChange={e=>setCentre(e.target.checked)}/> Confirm drafted centreline</label>{centre&&<>{dimension('Start junction extension',joinStart,setJoinStart,false)}{dimension('End junction extension',joinEnd,setJoinEnd,false)}</>}</>}
 {'polygon' in entity&&dimension('Depth',depth,setDepth,entity.purpose!=='excavation'&&entity.purpose!=='backfill')}
 {'elevationFt' in entity&&<><label className="block">Elevation reference<select aria-label="Elevation reference" className={field} value={elevationBasis} onChange={e=>{try{const next=e.target.value as 'base'|'top';const value=convertFoundationElevation(number(elevation),elevationBasis,next,number('widthFt' in entity?height:depth));setElevationBasis(next);setElevation(value===null?'':String(value));setError('')}catch(err){setError(err instanceof Error?err.message:String(err))}}}><option value="base">Base</option><option value="top">Top</option></select></label>{dimension(elevationBasis==='base'?'Base elevation':'Top elevation',elevation,setElevation,false,'blank unknown')}</>}
 {entity.kind==='foundationLine'&&entity.purpose!=='drainage'&&dimension('Coverage height',height,setHeight,false)}
 {entity.kind==='foundationRegion'&&entity.purpose==='granular'&&input('Granular layer identity',layer,setLayer)}
 {coverage&&<>{input('Layer identity',layer,setLayer)}<label className="block"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/> Confirm explicit route / net coverage, no remaining openings</label>
 {entity.kind==='foundationLine'&&entity.purpose!=='drainage'&&<><label className="block">Opening treatment<select aria-label="Coverage opening treatment" className={field} value={openingTreatment} onChange={e=>setOpeningTreatment(e.target.value as typeof openingTreatment)}><option value="">Pending confirmation</option><option value="none">Explicit net segments; no remaining openings</option><option value="alreadyDeducted">Legacy already deducted — review required</option></select></label>{openingTreatment==='alreadyDeducted'&&<p className="text-amber-300">Quantities remain pending until actual net coverage segments are confirmed.</p>}</>}
 {'purpose' in entity&&entity.purpose==='insulation'&&<><label className="block"><input type="checkbox" checked={coverageFoam} onChange={e=>setCoverageFoam(e.target.checked)}/> Calculate foam board feet</label>{entity.kind==='foundationLine'?dimension('Insulation thickness',coverageThickness,setCoverageThickness,true):<p>Horizontal foam thickness uses the entered region depth.</p>}</>}
 </>}
 <button className="bg-sky-700 rounded px-2 py-1" type="submit">Apply foundation properties</button>{error&&<p role="alert" className="text-amber-300">{error}</p>}</form>;
}

type GhostPreview={source:FoundationEntity[];members:FoundationEntity[];selection?:string;removedIds?:string[]};
type PreviewSink=(members:FoundationEntity[]|null)=>void;
function useGhostPreview<T extends GhostPreview>(entities:FoundationEntity[],selection:string|undefined,onPreview:PreviewSink,activePreview:boolean){
 const [preview,store]=useState<T|null>(null);
 const valid=activePreview&&preview&&preview.source===entities&&(preview.selection===undefined||preview.selection===selection)?preview:null;
 // Parent clears all preview state when switching generator; local inputs own only their current candidate.
 const setPreview=(next:T|null)=>{store(next);onPreview(next?.members??null)};
 useEffect(()=>{if(preview&&!valid){store(null);onPreview(null)}},[preview,valid]);
 return [valid,setPreview] as const;
}

function Perimeter({activePreview,entities,onChange,onPreview}:{entities:FoundationEntity[];onChange:(e:FoundationEntity[])=>boolean;onPreview:PreviewSink;activePreview:boolean}){
 const [x,setX]=useState(''),[y,setY]=useState(''),[w,setW]=useState(''),[d,setD]=useState(''),[t,setT]=useState(''),[height,setHeight]=useState(''),[z,setZ]=useState('');
 const [reference,setReference]=useState<RectangleReference>('exterior');
 const [preview,setPreview]=useGhostPreview<{source:FoundationEntity[];members:FoundationEntity[];volume:number}>(entities,undefined,onPreview,activePreview),[error,setError]=useState('');
 const input=(label:string,value:string,set:(v:string)=>void)=><label className="block">{label}<input aria-label={label} className={field} value={value} onChange={e=>{set(e.target.value);setPreview(null)}}/></label>;
 const required=(v:string)=>{if(!v.trim()||!Number.isFinite(Number(v)))throw Error('Enter explicit finite dimensions and origin');return Number(v)};
 return <details className="space-y-2 text-xs"><summary className="font-semibold">Generate rectangular foundation</summary><p className="text-slate-400">Advanced coordinate entry. Origins are in project feet. Preview only until Apply.</p>
 <label className="block">Perimeter reference<select aria-label="Perimeter reference" className={field} value={reference} onChange={e=>{setReference(e.target.value as RectangleReference);setPreview(null)}}><option value="exterior">Exterior face</option><option value="centreline">Centreline</option><option value="interior">Interior face</option></select></label>
 {input('Origin X (ft)',x,setX)}{input('Origin Y (ft)',y,setY)}{dimension('Perimeter width',w,v=>{setW(v);setPreview(null)},false)}{dimension('Perimeter depth',d,v=>{setD(v);setPreview(null)},false)}{dimension('Perimeter wall thickness',t,v=>{setT(v);setPreview(null)},true)}{dimension('Perimeter wall height',height,v=>{setHeight(v);setPreview(null)},false)}{dimension('Perimeter base',z,v=>{setZ(v);setPreview(null)},false, 'blank unknown')}
 <button className="bg-sky-700 rounded p-2" onClick={()=>{try{const xmin=required(x),ymin=required(y),members=generateFoundationPerimeter({xmin,ymin,xmax:xmin+required(w),ymax:ymin+required(d)},reference,required(t),required(height),z.trim()?required(z):null,uuidv4);const result=previewFoundationGeneration(entities,members);const rows=result.rows.filter(r=>members.some(e=>e.id===r.elementId));if(rows.some(r=>r.status!=='measured'))throw Error('Perimeter overlaps or requires unresolved reconciliation');const volume=rows.reduce((n,r)=>n+(r.status==='measured'?r.quantity:0),0);setPreview({source:entities,members,volume});setError('')}catch(err){setPreview(null);setError(err instanceof Error?err.message:String(err))}}}>Preview perimeter</button>
 {preview&&<div className="space-y-2"><p>4 walls · {preview.volume.toFixed(4)} CY</p><button disabled={preview.source!==entities} className="bg-emerald-800 rounded p-2 disabled:opacity-40" onClick={()=>{if(preview.source===entities&&onChange([...entities,...preview.members]))setPreview(null);else setError('Foundation changed or placement rejected')}}>Apply perimeter</button><button className="bg-slate-700 rounded p-2" onClick={()=>setPreview(null)}>Cancel perimeter</button></div>}{error&&<p role="alert" className="text-amber-300">{error}</p>}</details>
}


function StripGenerator({activePreview,entities,ids,onChange,onPreview}:{entities:FoundationEntity[];ids:string[];onChange:(e:FoundationEntity[])=>boolean;onPreview:PreviewSink;activePreview:boolean}){
 const [replaceExisting,setReplaceExisting]=useState(false);
 const [width,setWidth]=useState(''),[depth,setDepth]=useState(''),[offset,setOffset]=useState('0'),[error,setError]=useState(''),[preview,setPreview]=useGhostPreview<{source:FoundationEntity[];selection:string;members:FoundationEntity[];removedIds:string[];volume:number}>(entities,JSON.stringify([...ids].sort()),onPreview,activePreview);
 const key=JSON.stringify([...ids].sort());
 return <details className="space-y-2 text-xs"><summary className="font-semibold">Derive strip footings</summary><p>Selected walls: {ids.length}. Top at confirmed wall base. Signed offset is relative to the directed wall (+left normal in project XY); nonzero offset requires one isolated wall. Confirm structural bearing separately.</p>
 {dimension('Footing width',width,v=>{setWidth(v);setPreview(null)},true)}
 {dimension('Footing depth',depth,v=>{setDepth(v);setPreview(null)},true)}
 {dimension('Footing signed offset',offset,v=>{setOffset(v);setPreview(null)},true)}
 <label className="block"><input type="checkbox" checked={replaceExisting} onChange={e=>{setReplaceExisting(e.target.checked);setPreview(null)}}/> Replace existing strip footings</label>
 <button className="bg-sky-700 rounded p-2" onClick={()=>{try{if(!offset.trim()||!Number.isFinite(Number(offset)))throw Error('Enter explicit signed offset');const {base,removedIds}=foundationReplacement(entities,ids,'strip',replaceExisting);const members=deriveStripFootings(base,ids,Number(width),Number(depth),uuidv4,Number(offset));const result=previewFoundationGeneration(entities,members,removedIds);const rows=result.rows.filter(r=>members.some(e=>e.id===r.elementId));if(rows.length!==members.length||rows.some(r=>r.status!=='measured'))throw Error('Unresolved footing overlap');setPreview({source:entities,selection:key,members,removedIds,volume:rows.reduce((n,r)=>n+(r.status==='measured'?r.quantity:0),0)});setError('')}catch(err){setPreview(null);setError(err instanceof Error?err.message:String(err))}}}>Preview strip footings</button>
 {preview&&<div className="space-y-2">{preview.removedIds.length>0&&<p className="text-amber-300">Replace {preview.removedIds.length} existing components with {preview.members.length} new components.</p>}<p>{preview.members.length} footings · {preview.volume.toFixed(4)} CY</p><button className="bg-emerald-800 rounded p-2" disabled={preview.source!==entities||preview.selection!==key} onClick={()=>{if(preview.source===entities&&preview.selection===key&&onChange(applyFoundationGeneration(entities,preview.members,preview.removedIds)))setPreview(null);else setError('Preview is stale or rejected')}}>Apply strip footings</button><button className="bg-slate-700 rounded p-2" onClick={()=>setPreview(null)}>Cancel strip footings</button></div>}{error&&<p role="alert" className="text-amber-300">{error}</p>}</details>
}


/** Parent-owned details are committed as independent, validated history transactions.
 * Draft coordinates are explicit; no structural or opening dimensions are assumed.
 */
function DetailEditor({entity,entities,onChange}:{key?:string;entity:FoundationEntity;entities:FoundationEntity[];onChange:(e:FoundationEntity[])=>boolean}){
 const [mode,setMode]=useState<'opening'|'thickening'>('opening');
 const [a,setA]=useState(''),[b,setB]=useState(''),[w,setW]=useState(''),[h,setH]=useState(''),[depth,setDepth]=useState('');
 const [basis,setBasis]=useState<'total'|'additional'>('total');
 const [error,setError]=useState('');
 const [editing,setEditing]=useState<string|null>(null);
 const f=entity.foundation;
 const isWall=entity.kind==='foundationWall';
 if(!f||f.material!=='poured concrete'||(!isWall&&entity.kind!=='slab'))return null;
 const wall=f.wallOpenings??[], openings=f.slabOpenings??[], thick=f.slabThickenings??[];
 const clear=()=>{setA('');setB('');setW('');setH('');setDepth('');setEditing(null);setError('')};
 const required=(value:string)=>{if(!value.trim()||!Number.isFinite(Number(value)))throw Error('Enter all required finite detail dimensions');return Number(value)};
 const input=(label:string,value:string,set:(v:string)=>void)=><label className="block">{label}<input aria-label={label} className={field} value={value} onChange={e=>set(e.target.value)}/></label>;
 const commit=(next:FoundationMetadata)=>{const candidate=entities.map(q=>q.id===entity.id?{...q,foundation:next}:q);validateFoundationTopology(candidate);if(!onChange(candidate))throw Error('Detail change rejected');clear()};
 const save=()=>{try{
  const x=required(a),y=required(b),width=required(w),height=required(h),id=editing??uuidv4();
  if(width<=0||height<=0)throw Error('Opening or zone dimensions must be positive');
  const next:FoundationMetadata={...f};
  if(isWall){next.wallOpenings=[...wall.filter(o=>o.id!==editing),{id,offsetFt:x,sillFt:y,widthFt:width,heightFt:height}]}
  else {const polygon=rectanglePoints({x,y},{x:x+width,y:y+height});next.slabOpenings=openings.filter(o=>o.id!==editing);next.slabThickenings=thick.filter(o=>o.id!==editing);if(mode==='opening')next.slabOpenings.push({id,polygon});else next.slabThickenings.push({id,polygon,depthFt:required(depth),basis})}
  commit(next);
 }catch(err){setError(err instanceof Error?err.message:String(err))}};
 const remove=(id:string)=>{try{const next={...f};if(isWall)next.wallOpenings=wall.filter(o=>o.id!==id);else {next.slabOpenings=openings.filter(o=>o.id!==id);next.slabThickenings=thick.filter(o=>o.id!==id)}commit(next)}catch(err){setError(err instanceof Error?err.message:String(err))}};
 const editZone=(o:{id:string;polygon:{x:number;y:number}[];depthFt?:number;basis?:'total'|'additional'})=>{const xs=o.polygon.map(p=>p.x),ys=o.polygon.map(p=>p.y),x=Math.min(...xs),y=Math.min(...ys);setEditing(o.id);setMode(o.depthFt===undefined?'opening':'thickening');setA(String(x));setB(String(y));setW(String(Math.max(...xs)-x));setH(String(Math.max(...ys)-y));setDepth(o.depthFt===undefined?'':String(o.depthFt));setBasis(o.basis??'total');setError('')};
 return <details open className="space-y-2 text-xs"><summary className="font-semibold">Construction details</summary>
 <p className="text-slate-400">{isWall?'Opening offset is measured along the wall from its start. Sill is relative to wall base. Through-wall openings only.':'Enter absolute project coordinates for rectangular slab exclusions or constant-section thickening.'}</p>
 {wall.map((o,i)=><div key={o.id} className="flex flex-wrap gap-2"><span>Wall opening {i+1}: {o.widthFt} × {o.heightFt} ft</span><button className="bg-slate-700 rounded px-2" onClick={()=>{setEditing(o.id);setA(String(o.offsetFt));setB(String(o.sillFt));setW(String(o.widthFt));setH(String(o.heightFt));setError('')}}>Edit opening {i+1}</button><button className="bg-red-900 rounded px-2" onClick={()=>remove(o.id)}>Remove opening {i+1}</button></div>)}
 {openings.map((o,i)=><div key={o.id} className="flex flex-wrap gap-2"><span>Slab exclusion {i+1}</span><button className="bg-slate-700 rounded px-2" onClick={()=>editZone(o)}>Edit exclusion {i+1}</button><button className="bg-red-900 rounded px-2" onClick={()=>remove(o.id)}>Remove exclusion {i+1}</button></div>)}
 {thick.map((o,i)=><div key={o.id} className="flex flex-wrap gap-2"><span>Thickening {i+1}: {o.depthFt} ft {o.basis}</span><button className="bg-slate-700 rounded px-2" onClick={()=>editZone(o)}>Edit thickening {i+1}</button><button className="bg-red-900 rounded px-2" onClick={()=>remove(o.id)}>Remove thickening {i+1}</button></div>)}
 {!isWall&&<label className="block">Slab detail type<select aria-label="Slab detail type" className={field} value={mode} onChange={e=>{clear();setMode(e.target.value as typeof mode)}}><option value="opening">Slab exclusion</option><option value="thickening">Slab thickening</option></select></label>}
 {isWall?dimension('Opening offset',a,setA):input('Detail origin X (ft)',a,setA)}{isWall?dimension('Opening sill',b,setB):input('Detail origin Y (ft)',b,setB)}{dimension(isWall?'Opening width':'Detail width',w,setW)}{dimension(isWall?'Opening height':'Detail length',h,setH)}
 {!isWall&&mode==='thickening'&&<><label className="block">Thickening basis<select aria-label="Thickening basis" className={field} value={basis} onChange={e=>setBasis(e.target.value as typeof basis)}><option value="total">Total depth</option><option value="additional">Additional depth</option></select></label>{dimension('Thickening depth',depth,setDepth,true)}</>}
 <div className="flex flex-wrap gap-2"><button className="bg-sky-700 rounded p-2" onClick={save}>{editing?'Save detail edit':isWall?'Add wall opening':mode==='opening'?'Add slab exclusion':'Add slab thickening'}</button>{editing&&<button className="bg-slate-700 rounded p-2" onClick={clear}>Cancel detail edit</button>}</div>{error&&<p role="alert" className="text-amber-300">{error}</p>}
 </details>
}


function EnvelopeGenerator({activePreview,entities,ids,onChange,onPreview}:{entities:FoundationEntity[];ids:string[];onChange:(e:FoundationEntity[])=>boolean;onPreview:PreviewSink;activePreview:boolean}){
 const [replaceExisting,setReplaceExisting]=useState(false);
 const [wholePerimeter,setWholePerimeter]=useState(false);
 const [belowSlab,setBelowSlab]=useState('0');
 const [purpose,setPurpose]=useState<FoundationEnvelopeSource['purpose']>('waterproofing'),[side,setSide]=useState<'left'|'right'>('left'),[height,setHeight]=useState(''),[depth,setDepth]=useState(''),[material,setMaterial]=useState(''),[layer,setLayer]=useState(''),[foam,setFoam]=useState(false),[error,setError]=useState('');
 const [preview,setPreview]=useGhostPreview<{source:FoundationEntity[];selection:string;members:FoundationEntity[];removedIds:string[];summary:string}>(entities,JSON.stringify([...ids].sort()),onPreview,activePreview);
 const key=JSON.stringify([...ids].sort()),vertical=purpose==='waterproofing'||purpose==='verticalInsulation',insulation=purpose==='verticalInsulation'||purpose==='horizontalInsulation';
 const input=(label:string,value:string,set:(v:string)=>void)=><label className="block">{label}<input aria-label={label} className={field} value={value} onChange={e=>{set(e.target.value);setPreview(null)}}/></label>;
 return <details className="space-y-2 text-xs"><summary className="font-semibold">Derive foundation envelope</summary><p>Selected sources: {ids.length}. Isolated wall face, complete orthogonal exterior, or confirmed slab footprint. Confirm actual scope before applying.</p>
 <label className="block">Derived layer type<select aria-label="Derived layer type" className={field} value={purpose} onChange={e=>{setPurpose(e.target.value as typeof purpose);setMaterial('');setPreview(null)}}><option value="waterproofing">Wall waterproofing</option><option value="verticalInsulation">Vertical insulation</option><option value="horizontalInsulation">Horizontal insulation</option><option value="granular">Under-slab granular</option></select></label>
 {vertical&&<><label className="block"><input type="checkbox" checked={wholePerimeter} onChange={e=>{setWholePerimeter(e.target.checked);setPreview(null)}} aria-label="Complete orthogonal exterior"/> Complete orthogonal exterior</label>{!wholePerimeter&&<label className="block">Wall face normal<select aria-label="Wall face normal" className={field} value={side} onChange={e=>{setSide(e.target.value as typeof side);setPreview(null)}}><option value="left">+normal</option><option value="right">−normal</option></select></label>}{dimension('Derived coverage height',height,v=>{setHeight(v);setPreview(null)},false)}</>}
 {insulation&&<label><input type="checkbox" checked={foam} onChange={e=>{setFoam(e.target.checked);setPreview(null)}}/> Foam board-foot calculation</label>}
 {(!vertical||purpose==='verticalInsulation')&&dimension('Derived layer thickness',depth,v=>{setDepth(v);setPreview(null)},true)}
 {!vertical&&<>{dimension('Layer top below slab base',belowSlab,v=>{setBelowSlab(v);setPreview(null)},true)}<p>Zero places the layer directly beneath the slab. For lower layers, specify the total thickness above their top.</p></>}
 <FoundationMaterialInput key={purpose} label="Derived layer material" category={purpose==='waterproofing'||purpose==='granular'?purpose:'insulation'} value={material} onChange={v=>{setMaterial(v);setPreview(null)}} className={field}/>{input('Derived layer identity',layer,setLayer)}
 <label className="block"><input type="checkbox" checked={replaceExisting} onChange={e=>{setReplaceExisting(e.target.checked);setPreview(null)}}/> Replace existing envelope layer</label>
 <button className="bg-sky-700 rounded p-2" onClick={()=>{try{if(!vertical&&(!belowSlab.trim()||!Number.isFinite(Number(belowSlab))||Number(belowSlab)<0))throw Error('Specify nonnegative below-slab offset');const config={purpose,material:material.trim(),layerId:layer.trim()||material.trim(),...(!vertical?{offsetBelowSlabFt:Number(belowSlab)}:{}),...(vertical?{side,heightFt:Number(height)}:{}),...(!vertical||purpose==='verticalInsulation'?{depthFt:Number(depth)}:{}),...(insulation&&foam?{foam:true as const}:{})};if(config.depthFt!==undefined&&(!Number.isFinite(config.depthFt)||config.depthFt<=0))throw Error('Specify positive layer thickness');const {base,removedIds}=foundationReplacement(entities,ids,'envelope',replaceExisting,config.purpose,config.layerId);const members=vertical&&wholePerimeter?deriveRectangularEnvelope(base,ids,config,uuidv4):deriveFoundationEnvelope(base,ids,config,uuidv4);const result=previewFoundationGeneration(entities,members,removedIds);const rows=result.rows.filter(r=>members.some(e=>e.id===r.elementId));if(!rows.length||rows.some(r=>r.status!=='measured'))throw Error('Unresolved derived coverage or material overlap');const totals=new Map<string,number>();for(const r of rows)if(r.status==='measured')totals.set(r.unit,(totals.get(r.unit)??0)+r.quantity);setPreview({source:entities,selection:key,members,removedIds,summary:[...totals].map(([u,v])=>v.toFixed(4)+' '+u).join(' · ')});setError('')}catch(err){setPreview(null);setError(err instanceof Error?err.message:String(err))}}}>Preview envelope</button>
 {preview&&<div className="space-y-2">{preview.removedIds.length>0&&<p className="text-amber-300">Replace {preview.removedIds.length} existing components with {preview.members.length} new components.</p>}<p>{preview.summary}</p><button className="bg-emerald-800 rounded p-2" disabled={preview.source!==entities||preview.selection!==key} onClick={()=>{if(preview.source===entities&&preview.selection===key&&onChange(applyFoundationGeneration(entities,preview.members,preview.removedIds)))setPreview(null);else setError('Preview is stale or rejected')}}>Apply envelope</button><button className="bg-slate-700 rounded p-2" onClick={()=>setPreview(null)}>Cancel envelope</button></div>}{error&&<p role="alert" className="text-amber-300">{error}</p>}</details>
}


function DrainageGenerator({activePreview,entities,ids,onChange,onPreview}:{entities:FoundationEntity[];ids:string[];onChange:(e:FoundationEntity[])=>boolean;onPreview:PreviewSink;activePreview:boolean}){
 const [replaceExisting,setReplaceExisting]=useState(false);
 const [offset,setOffset]=useState(''),[material,setMaterial]=useState(''),[layer,setLayer]=useState(''),[error,setError]=useState('');
 const [preview,setPreview]=useGhostPreview<{source:FoundationEntity[];selection:string;members:FoundationEntity[];removedIds:string[];length:number}>(entities,JSON.stringify([...ids].sort()),onPreview,activePreview);
 const key=JSON.stringify([...ids].sort());
 const input=(label:string,value:string,set:(v:string)=>void)=><label className="block">{label}<input aria-label={label} className={field} value={value} onChange={e=>{set(e.target.value);setPreview(null)}}/></label>;
 return <details className="space-y-2 text-xs"><summary className="font-semibold">Derive perimeter drainage</summary><p>Select all walls of one verified orthogonal perimeter assembly (4–64 walls). Offset measured from exterior concrete face to route centreline. Plan LF only.</p>
 {dimension('Drainage exterior offset',offset,v=>{setOffset(v);setPreview(null)},true)}<FoundationMaterialInput label="Drainage material" category="drainage" value={material} onChange={v=>{setMaterial(v);setPreview(null)}} className={field}/>{input('Drainage layer identity',layer,setLayer)}
 <label className="block"><input type="checkbox" checked={replaceExisting} onChange={e=>{setReplaceExisting(e.target.checked);setPreview(null)}}/> Replace existing drainage</label>
 <button className="bg-sky-700 rounded p-2" onClick={()=>{try{if(!offset.trim())throw Error('Specify exterior offset explicitly');const {base,removedIds}=foundationReplacement(entities,ids,'drainage',replaceExisting);const members=derivePerimeterDrainage(base,ids,Number(offset),material.trim(),layer.trim()||material.trim(),uuidv4);const result=previewFoundationGeneration(entities,members,removedIds);const rows=result.rows.filter(r=>members.some(e=>e.id===r.elementId));if(rows.length!==members.length||rows.some(r=>r.status!=='measured'))throw Error('Unresolved drainage route overlap');setPreview({source:entities,selection:key,members,removedIds,length:rows.reduce((n,r)=>n+(r.status==='measured'?r.quantity:0),0)});setError('')}catch(err){setPreview(null);setError(err instanceof Error?err.message:String(err))}}}>Preview drainage</button>
 {preview&&<div className="space-y-2">{preview.removedIds.length>0&&<p className="text-amber-300">Replace {preview.removedIds.length} existing components with {preview.members.length} new components.</p>}<p>{preview.length.toFixed(4)} LF</p><button className="bg-emerald-800 rounded p-2" disabled={preview.source!==entities||preview.selection!==key} onClick={()=>{if(preview.source===entities&&preview.selection===key&&onChange(applyFoundationGeneration(entities,preview.members,preview.removedIds)))setPreview(null);else setError('Preview is stale or rejected')}}>Apply drainage</button><button className="bg-slate-700 rounded p-2" onClick={()=>setPreview(null)}>Cancel drainage</button></div>}{error&&<p role="alert" className="text-amber-300">{error}</p>}</details>
}

function CoordinatedRunEditor({entities,ids,onChange}:{key?:string;entities:FoundationEntity[];ids:string[];onChange:(e:FoundationEntity[])=>boolean}){
 const runs=entities.filter(e=>ids.includes(e.id)&&'widthFt' in e);
 const [values,setValues]=useState(()=>Object.fromEntries(runs.map(e=>[e.id,'widthFt' in e?[String(e.widthFt??''),String(e.heightFt??''),String(e.elevationFt??''),String(e.foundation?.joinStartFt??0),String(e.foundation?.joinEndFt??0)]:[]])));
 const [error,setError]=useState('');
 if(runs.length!==ids.length||runs.length<2)return null;
 const fields=['Width','Height / depth','Base elevation','Start extension','End extension'];
 return <details className="space-y-2 text-xs"><summary className="font-semibold">Coordinated run dimensions</summary><p>Review each run explicitly. All selected dimensions commit together. No automatic junction design.</p>{runs.map((e,i)=><fieldset key={e.id} className="border border-slate-700 rounded p-2 space-y-1"><legend>Run {i+1} · {e.id.slice(0,8)}</legend>{fields.map((label,j)=><FoundationDimensionInput key={label} label={label} accessibleLabel={'Run '+(i+1)+' '+label} className={field} section={j===0||j===1&&e.kind==='stripFooting'} value={values[e.id]?.[j]??''} onChange={v=>setValues(old=>({...old,[e.id]:old[e.id].map((x,k)=>k===j?v:x)}))}/>)}</fieldset>)}<button className="bg-sky-700 rounded p-2" onClick={()=>{try{const edits=runs.map(e=>{const v=values[e.id];if(v.some(x=>!x.trim()||!Number.isFinite(Number(x))))throw Error('Complete all run dimensions explicitly');const [widthFt,heightFt,baseFt,joinStartFt,joinEndFt]=v.map(Number);return {id:e.id,widthFt,heightFt,baseFt,joinStartFt,joinEndFt}});if(!onChange(editFoundationRuns(entities,edits)))throw Error('Coordinated edit rejected');setError('')}catch(err){setError(err instanceof Error?err.message:String(err))}}}>Apply coordinated run dimensions</button>{error&&<p role="alert" className="text-amber-300">{error}</p>}</details>
}

const componentNames:Record<string,string>={
  foundationWall:'Walls',stripFooting:'Strip footings',padFooting:'Pad footings',slab:'Slabs',
  foundationTrench:'Trenches','foundationLine:waterproofing':'Waterproofing',
  'foundationLine:insulation':'Exterior insulation','foundationLine:drainage':'Drainage',
  'foundationRegion:insulation':'Horizontal insulation','foundationRegion:granular':'Granular base',
  'foundationRegion:excavation':'Excavation','foundationRegion:backfill':'Backfill',
};
const componentName=(kind:string)=>componentNames[kind]??kind.replace(':',' · ');

export function FoundationInspector({assemblyControls,ownedComponentIds,metric,workspaceId,entities,selection,onChange,onSelect,onDelete,onPreview,filter,onFilter}:{key?:string;assemblyControls?:React.ReactNode;ownedComponentIds?:ReadonlySet<string>;metric:boolean;workspaceId:string;entities:FoundationEntity[];selection:SelectionState;onChange:(e:FoundationEntity[])=>boolean;onSelect:(s:SelectionState)=>void;onDelete:()=>void;onPreview:PreviewSink;filter:string;onFilter:(kind:string)=>void}){
 const ids=selection.type==='foundation'?(selection.ids??(selection.id?[selection.id]:[])):[],selected=ids.length===1?entities.find(e=>e.id===ids[0]):undefined;
 const result=useMemo(()=>{try{return measureFoundation(workspaceId,entities)}catch(err){return {rows:[],warnings:[err instanceof Error?err.message:String(err)],detailBreakdown:[],footprintReferences:[],scopeDiagnostics:[]}}},[workspaceId,entities]);
 const [activeGenerator,setActiveGenerator]=useState('');
 const [assemblyError,setAssemblyError]=useState('');
 const [scopeStatus,setScopeStatus]=useState<'included'|'excluded'|'pending'>('included');
 const [scopeReason,setScopeReason]=useState('');
 const [scopeError,setScopeError]=useState('');
 const scopeSelectionKey=JSON.stringify(entities.filter(e=>ids.includes(e.id)).map(e=>[e.id,e.scopeApplicability??null]));
 useEffect(()=>{const selectedScope=entities.filter(e=>ids.includes(e.id)).map(e=>e.scopeApplicability);const first=selectedScope[0];const same=selectedScope.length>0&&selectedScope.every(s=>JSON.stringify(s??null)===JSON.stringify(first??null));setScopeStatus(same&&first?first.status:'included');setScopeReason(same&&first&&'reason' in first?first.reason:'');setScopeError('')},[scopeSelectionKey]);
 const sink=(owner:string):PreviewSink=>members=>{if(members){setActiveGenerator(owner);onPreview(members)}else if(activeGenerator===owner)onPreview(null)};
 const filterKind=(e:FoundationEntity)=>e.kind==='foundationLine'||e.kind==='foundationRegion'?e.kind+':'+e.purpose:e.kind;
 const breakdown=result.detailBreakdown.find(b=>b.elementId===selected?.id);
 const footprint=result.footprintReferences.find(b=>b.elementId===selected?.id);
 const totals=new Map<string,{qty:number;unit:string;pending:number;known:number}>();
 for(const r of result.rows){const t=totals.get(r.code)??{qty:0,unit:r.unit,pending:0,known:0};if(r.status==='measured'){t.qty+=r.quantity;t.known++}else t.pending++;totals.set(r.code,t)}
 const advancedComponentTools=<>{ids.length>0&&<button className="bg-red-900 rounded px-2 py-1 text-xs" onClick={onDelete}>Delete selected foundation components</button>}{selected&&<button className="bg-slate-700 rounded p-2 text-xs" onClick={()=>onSelect({type:'foundation',ids:foundationAssemblyIds(entities,selected.id)})}>Select entire foundation assembly</button>}{ids.length>1&&<section className="space-y-2 text-xs"><p>{ids.length} foundation components selected</p><button className="bg-sky-700 rounded p-2" onClick={()=>{try{const next=assignFoundationAssembly(entities,ids,uuidv4());if(!onChange(next))throw Error('Assembly assignment rejected');setAssemblyError('')}catch(err){setAssemblyError(err instanceof Error?err.message:String(err))}}}>Assign selected to new assembly</button><p>Confirm actual junction extensions and elevations first. Existing assemblies must be selected in full.</p>{assemblyError&&<p role="alert" className="text-amber-300">{assemblyError}</p>}<CoordinatedRunEditor key={JSON.stringify(entities.filter(e=>ids.includes(e.id)))} entities={entities} ids={ids} onChange={onChange}/></section>}{ids.length>0&&<section aria-label="Foundation scope applicability" className="space-y-2 text-xs border border-slate-700 rounded p-2"><h3 className="font-semibold">Scope applicability</h3><p>Selected scope: {ids.map(id=>entities.find(e=>e.id===id)?.scopeApplicability?.status??'No explicit decision').filter((v,i,a)=>a.indexOf(v)===i).join(', ')}</p><select aria-label="Foundation applicability" className={field} value={scopeStatus} onChange={e=>setScopeStatus(e.target.value as typeof scopeStatus)}><option value="included">Included</option><option value="excluded">Excluded</option><option value="pending">Pending decision</option></select>{scopeStatus!=='included'&&<label className="block">Scope decision reason<input aria-label="Scope decision reason" className={field} value={scopeReason} onChange={e=>setScopeReason(e.target.value)}/></label>}<button className="bg-sky-700 rounded p-2" onClick={()=>{try{const next=setFoundationApplicability(entities,ids,scopeStatus==='included'?{status:'included'}:{status:scopeStatus,reason:scopeReason});if(!onChange(next))throw Error('Scope change rejected');setScopeError('')}catch(err){setScopeError(err instanceof Error?err.message:String(err))}}}>Apply foundation applicability</button>{scopeError&&<p role="alert" className="text-amber-300">{scopeError}</p>}</section>}{selected&&<Properties key={'properties:'+JSON.stringify(selected)} entity={selected} onSave={e=>onChange(entities.map(q=>q.id===e.id?e:q))}/>}{footprint&&<section aria-label="Selected foundation footprint reference" className="text-xs space-y-1 border border-slate-700 rounded p-2"><h3 className="font-semibold">{footprint.code==='foundation.slab.area'?'Slab':'Pad footing'} footprint (reference only)</h3><p className="text-slate-400">Not an additional concrete material quantity.</p>{([['Gross footprint',footprint.grossSF],['Exclusion area',footprint.exclusionSF],['Net footprint',footprint.netSF]] as const).map(([label,value])=><div key={label} className="flex justify-between gap-2"><span>{label}</span><span>{value===null?'Pending':value.toFixed(2)+' SF'}</span></div>)}{footprint.reason&&<p className="text-amber-300">{footprint.reason}</p>}</section>}{selected&&<DetailEditor key={'details:'+JSON.stringify(selected)} entity={selected} entities={entities} onChange={onChange}/>} {breakdown&&(selected?.foundation?.wallOpenings?.length||selected?.foundation?.slabOpenings?.length||selected?.foundation?.slabThickenings?.length)?<section aria-label="Selected concrete volume breakdown" className="text-xs space-y-1 border border-slate-700 rounded p-2"><h3 className="font-semibold">Selected concrete volume</h3><p className="text-slate-400">Reference breakdown only — net is the material quantity.</p>{([['Gross concrete',breakdown.grossCY],['Opening deduction',breakdown.deductionCY],['Additional thickening',breakdown.additionalCY],['Net concrete',breakdown.netCY]] as const).map(([label,value])=><div key={label} className="flex justify-between gap-2"><span>{label}</span><span>{value===null?'Pending':value.toFixed(4)+' CY'}</span></div>)}</section>:null}<Perimeter activePreview={activeGenerator==='perimeter'} entities={entities} onChange={onChange} onPreview={sink('perimeter')}/><StripGenerator activePreview={activeGenerator==='strip'} entities={entities} ids={ids} onChange={onChange} onPreview={sink('strip')}/><EnvelopeGenerator activePreview={activeGenerator==='envelope'} entities={entities} ids={ids} onChange={onChange} onPreview={sink('envelope')}/><DrainageGenerator activePreview={activeGenerator==='drainage'} entities={entities} ids={ids} onChange={onChange} onPreview={sink('drainage')}/></>;
 return <FoundationMetricContext.Provider value={metric}><aside className="w-72 shrink-0 bg-slate-900 border-l border-slate-700 p-3 overflow-y-auto space-y-3"><h2 className="text-sm font-semibold">Foundation properties</h2>{assemblyControls}<label className="block text-xs">Visible components<select aria-label="Foundation component filter" className={field} value={filter} onChange={e=>onFilter(e.target.value)}><option value="all">All components</option>{[...new Set(entities.map(filterKind))].sort().map(k=><option key={k} value={k}>{componentName(k)}</option>)}</select></label><p className="text-xs text-slate-400">The filter changes what you see and select on the drawing.</p><select aria-label="Select foundation entity" className={field} value={selected?.id??''} onChange={e=>onSelect(e.target.value?{type:'foundation',id:e.target.value}:{type:'none'})}><option value="">Select component</option>{entities.filter(e=>filter==='all'||filterKind(e)===filter).map((e,i)=><option key={e.id} value={e.id}>{e.kind} {'purpose' in e?e.purpose:''} {i+1}</option>)}</select>{ids.some(id=>ownedComponentIds?.has(id))?<details className="space-y-2 border border-slate-700 rounded p-2">
   <summary>Advanced component tools</summary><p className="text-xs">Use assembly controls to change owned components. These tools remain available for independent measurements.</p>
 </details>:advancedComponentTools}<hr className="border-slate-700"/><h2 className="text-sm font-semibold">Foundation quantities</h2><p className="text-xs text-slate-400">Raw quantities only. Missing inputs remain pending.</p>{result.scopeDiagnostics.some(d=>d.status==='excluded'||d.status==='pending')&&<section aria-label="Foundation scope decisions" className="text-xs space-y-1"><h3 className="font-semibold">Scope decisions</h3>{result.scopeDiagnostics.filter(d=>d.status==='excluded'||d.status==='pending').map(d=><p key={d.elementId}>{componentName(filterKind(entities.find(e=>e.id===d.elementId)!))} · {d.status} · {d.reason}</p>)}</section>}{[...totals].map(([code,t])=><div key={code} className="flex justify-between gap-2 text-xs"><span>{code.replace('foundation.','').replaceAll('.',' ')}{t.unit==='BF'?' (informational)':''}</span><span>{t.known?formatFoundationQuantity(t.qty,t.unit,metric)+(t.pending?' + pending':''):'Not quantified'}</span></div>)}{result.warnings.length>0&&<details><summary className="text-xs text-amber-300">Measurement checks</summary>{result.warnings.map((w,i)=><p key={i} className="text-xs text-amber-300 break-words">{w}</p>)}</details>}</aside></FoundationMetricContext.Provider>;
}
