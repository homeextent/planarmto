import test from 'node:test';
import assert from 'node:assert/strict';
import type {RoofEntity,Point} from '../src/engine/measurements/measurementTypes';
import {measureRoof,projectedArea,simplePolygon,edgeLength,validateRoofTopology,slopeFactor} from '../src/engine/measurements/roofMeasurements';
import {boundaryAt,moveRoofVertex,snapRoofPoint} from '../src/engine/measurements/roofEditing';
const rect=(x:number,y:number,w:number,h:number):Point[]=>[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}];
const base=(id:string)=>({id,physicalId:id,assemblyId:id,source:{reference:'fixture'}});
const plane=(id:string,polygon=rect(0,0,40,30),pitchRise:number|null=6,slopeDegrees:number|null=90):Extract<RoofEntity,{kind:'roofPlane'}>=>({...base(id),kind:'roofPlane',polygon,pitchRise,slopeDegrees,elevationFt:null});
const value=(entities:RoofEntity[],code:string)=>{const r=measureRoof('roof',entities).rows.filter(r=>r.code===code);assert.ok(r.length);assert.ok(r.every(x=>x.status==='measured'));return r.reduce((s,x)=>s+(x.status==='measured'?x.quantity:0),0)};
const near=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
test('gross net and flat roof analytical quantities',()=>{const p=plane('p');near(value([p],'roof.gross'),1200*Math.sqrt(1.25));const o:RoofEntity={...base('o'),kind:'roofOpening',polygon:rect(2,2,4,5),planeId:'p',deduction:'included'};near(value([p,o],'roof.covering'),1180*Math.sqrt(1.25));near(value([p,o],'roof.deduction'),20*Math.sqrt(1.25));near(value([plane('f',undefined,0,null)],'roof.gross'),1200)});
test('mixed pitches independent of orientation and floor area',()=>{near(value([plane('a',rect(0,0,20,30),4),plane('b',rect(20,0,20,30),8)],'roof.gross'),600*Math.sqrt(10/9)+600*Math.sqrt(13/9));});
test('missing pitch and direction are not zero',()=>{assert.equal(measureRoof('roof',[plane('p',undefined,null)]).rows.find(r=>r.code==='roof.covering')?.status,'unquantified');assert.equal(edgeLength({x:0,y:0},{x:0,y:15},6,null),null);near(edgeLength({x:0,y:0},{x:40,y:0},6,90)!,40);near(edgeLength({x:0,y:0},{x:0,y:15},6,90)!,Math.sqrt(281.25))});
test('concave and reversed polygon; crossing rejected',()=>{const p=[{x:0,y:0},{x:4,y:0},{x:4,y:2},{x:2,y:2},{x:2,y:4},{x:0,y:4}];assert.ok(simplePolygon(p));near(projectedArea(p),12);near(projectedArea([...p].reverse()),12);assert.equal(simplePolygon([{x:0,y:0},{x:4,y:4},{x:0,y:4},{x:4,y:0}]),false)});
test('shared ridge once, duplicate edge rejected',()=>{const a=plane('a',rect(0,0,40,15),6,270),b=plane('b',rect(0,15,40,15),6,90);const e:RoofEntity={...base('e'),kind:'roofEdge',start:{x:0,y:15},end:{x:40,y:15},planeIds:['a','b'],edgeType:'ridge',applicability:{fascia:'excluded',gutter:'excluded',soffit:'excluded'}};near(value([a,b,e],'roof.edge.ridge'),40);assert.throws(()=>validateRoofTopology([a,b,e,{...e,...base('duplicate'),end:{x:20,y:15}}]),/overlap/);assert.equal(boundaryAt({x:20,y:15},[a,b],0.1)?.planeIds.length,2)});
test('openings containment overlap and pending treatment',()=>{const p=plane('p');const o:RoofEntity={...base('o'),kind:'roofOpening',polygon:rect(2,2,4,5),planeId:'p'};assert.equal(measureRoof('roof',[p,o]).rows.find(r=>r.code==='roof.covering')?.status,'unquantified');assert.throws(()=>validateRoofTopology([p,{...o,polygon:rect(39,29,4,5)}]));assert.throws(()=>validateRoofTopology([p,o,{...o,...base('q'),polygon:rect(3,3,4,5)}]));});
test('independent insulation and soffit surface quantities',()=>{const i:RoofEntity={...base('i'),kind:'roofSurface',polygon:rect(0,0,40,25),purpose:'insulation',surfaceBasis:'horizontal',pitchRise:0,insulationType:'closed cell foam',depthFt:0.5};near(value([i],'roof.insulation.horizontal'),1000);near(value([i],'roof.insulation.horizontal.volume'),6000);const s:RoofEntity={...base('s'),kind:'roofSurface',polygon:rect(0,0,10,2),purpose:'soffit',surfaceBasis:'sloped',pitchRise:6};near(value([s],'roof.soffit.area'),20*slopeFactor(6))});
test('snapping and immutable vertex movement',()=>{const p=plane('p');assert.deepEqual(snapRoofPoint({x:0.05,y:0.02},[p],0.1,1),{x:0,y:0});const n=moveRoofVertex([p],'p',1,{x:42,y:0});assert.equal(p.polygon[1].x,40);assert.equal((n[0] as typeof p).polygon[1].x,42)});

import {createProjectDocument,workspaceRenderView,serializeProjectDocument,deserializeProjectDocument} from '../src/engine/projectDocument';
import {createBlankProject} from '../src/engine/samplePlans';
import {addWorkspace,replaceSpecialistEntities,restoreWorkspaceSnapshot,selectWorkspace,canReportProjectEstimate} from '../src/engine/workspaceController';
test('partial shared boundaries split at ownership transition',()=>{
 const a=plane('a',rect(0,0,40,15),6,270),b=plane('b',rect(10,15,20,15),6,90);
 const hit=boundaryAt({x:20,y:15},[a,b],.1)!;
 assert.equal(hit.planeIds.length,2);near(Math.abs(hit.end.x-hit.start.x),20);
 const edge:RoofEntity={...base('edge'),kind:'roofEdge',start:{x:0,y:15},end:{x:40,y:15},planeIds:['a'],edgeType:'eave'};
 assert.throws(()=>validateRoofTopology([a,b,edge]),/ownership/);
});
test('unclassified perimeter remains explicitly incomplete',()=>{
 assert.ok(measureRoof('roof',[plane('p')]).warnings.some(w=>w.includes('boundary classification incomplete')));
});
test('canonical round trip and history retain specialist geometry and shared settings',()=>{
 const blank=createProjectDocument(createBlankProject(),'floor');
 const doc=addWorkspace(blank,'roof','Roof','roof');
 const snap={view:workspaceRenderView(doc),measurements:[]};
 const p=plane('p');
 const edit=replaceSpecialistEntities(doc,'roof',[p]);
 const saved=deserializeProjectDocument(serializeProjectDocument(edit));
 assert.deepEqual(saved.workspaces[1].measurements,[p]);
 assert.deepEqual(saved.workspaces[0],blank.workspaces[0]);
 const redo={view:workspaceRenderView(saved),measurements:[p]};
 const changed={...saved,settings:{...saved.settings,gridSnap:false}};
 const undo=restoreWorkspaceSnapshot(changed,'roof',snap);
 assert.equal(undo.workspaces[1].measurements.length,0);assert.equal(undo.settings.gridSnap,false);
 const restored=restoreWorkspaceSnapshot(undo,'roof',redo);
 assert.deepEqual(restored.workspaces[1].measurements,[p]);
 assert.equal(restored.settings.gridSnap,false);
 assert.throws(()=>restoreWorkspaceSnapshot(selectWorkspace(restored,'floor'),'roof',redo),/Inactive/);
 assert.equal(canReportProjectEstimate(restored),false);
 const invalid={...restored,workspaces:restored.workspaces.map(w=>w.id==='roof'?{...w,measurements:[p,plane('overlap',rect(1,1,5,5))]}:w)};
 assert.throws(()=>serializeProjectDocument(invalid),/Overlapping/);
});

test('duplicate soffit surfaces rejected; independent insulation permitted',()=>{
 const a:RoofEntity={...base('s'),kind:'roofSurface',polygon:rect(0,0,10,2),purpose:'soffit',surfaceBasis:'horizontal',pitchRise:0};
 assert.throws(()=>validateRoofTopology([a,{...a,...base('s2')}]),/Overlapping same-purpose/);
 validateRoofTopology([a,{...a,...base('i'),purpose:'insulation'}]);
});
test('geometric opening area survives unspecified deduction',()=>{
 const p=plane('p');const o:RoofEntity={...base('o'),kind:'roofOpening',polygon:rect(2,2,4,5),planeId:'p'};
 near(value([p,o],'roof.opening.projected'),20);
 assert.equal(measureRoof('roof',[p,o]).rows.find(r=>r.code==='roof.covering')?.status,'unquantified');
});

import {parseDimension,exactEndpoint,exactRectangleCorner,rectanglePoints,resizeRectangle} from '../src/engine/precisionDrafting';
import {generateRectangularRoof,type RoofConfig} from '../src/engine/measurements/roofGenerator';
import {roofSnap,resizeRoofRectangle} from '../src/engine/measurements/roofEditing';
import {resizeWallSegment} from '../src/engine/floorPrecision';
const generated=(w:number,h:number,config:Partial<RoofConfig>={})=>{let n=0;return generateRectangularRoof({x:0,y:0},{x:w,y:h},{type:'hip',pitch:6,direction:90,ridge:'horizontal',...config},()=> 'generated-'+ ++n)};
test('precision input parses explicit and active units; invalid lengths rejected',()=>{
 near(parseDimension('40')!,40);near(parseDimension("20' 6 1/2\"")!,20+6.5/12);near(parseDimension('12m')!,12/.3048);near(parseDimension('600mm')!,.6/.3048);near(parseDimension('2',true)!,2/.3048);
 for(const x of ['','0','-1','Infinity','1e99','20 feet extra',"2' 13\"","1' 1/0\""])assert.equal(parseDimension(x),null,x);
});
test('exact line, Ortho and rectangle retain requested geometry',()=>{
 const a={x:2,y:3};assert.deepEqual(exactEndpoint(a,{x:9,y:4},40,true),{x:42,y:3});const b=exactEndpoint(a,{x:5,y:7},40);near(Math.hypot(b.x-a.x,b.y-a.y),40);
 const c=exactRectangleCorner(a,{x:-2,y:10},40,20);assert.deepEqual(c,{x:-38,y:23});near(projectedArea(rectanglePoints(a,c)),800);
 assert.throws(()=>exactEndpoint(a,a,40));assert.throws(()=>exactRectangleCorner(a,{x:2,y:6},20,40));
});
test('rectangle resize retains anchor and winding, rejects irregular polygons',()=>{
 const original=rect(2,3,10,20);const next=resizeRectangle(original,40,20);assert.deepEqual(next[0],original[0]);near(projectedArea(next),800);near(projectedArea(original),200);
 assert.throws(()=>resizeRectangle([{x:0,y:0},{x:4,y:0},{x:3,y:3},{x:0,y:3}],4,4));
});
test('sticky node capture respects breakout and eligibility',()=>{
 const p=plane('p');const lock=roofSnap({x:.1,y:.1},[p],.2,null);assert.equal(lock.type,'node');
 assert.deepEqual(roofSnap({x:.3,y:0},[p],.2,null,lock,.4),lock);
 assert.equal(roofSnap({x:1,y:0},[p],.2,null,lock,.4).type,'edge');
 assert.notEqual(roofSnap({x:.1,y:.1},[p],.2,null,lock,.4,()=>false).type,'node');
});
test('rectangular hip: 40 by 30 analytical coverage and unique actual hips/ridge',()=>{
 const e=generated(40,30);assert.equal(e.filter(q=>q.kind==='roofPlane').length,4);
 near(value(e,'roof.projected'),1200);near(value(e,'roof.gross'),1200*Math.sqrt(1.25));near(value(e,'roof.edge.eave'),140);near(value(e,'roof.edge.ridge'),10);near(value(e,'roof.edge.hip'),90);
 assert.equal(e.filter(q=>q.kind==='roofEdge'&&q.planeIds.length===2).length,5);
 assert.ok(e.filter(q=>q.kind==='roofEdge').every(q=>q.applicability?.gutter==='unspecified'));
});
test('vertical rectangular hip and square apex conserve area',()=>{
 const e=generated(30,40);near(value(e,'roof.edge.ridge'),10);near(value(e,'roof.edge.hip'),90);
 const s=generated(30,30);near(value(s,'roof.projected'),900);near(value(s,'roof.edge.hip'),90);assert.equal(s.filter(q=>q.kind==='roofEdge'&&q.edgeType==='ridge').length,0);
});
test('gable orientations preserve projected and sloped area; rake lengths analytical',()=>{
 for(const ridge of ['horizontal','vertical'] as const){const e=generated(40,30,{type:'gable',ridge});near(value(e,'roof.projected'),1200);near(value(e,'roof.gross'),1200*Math.sqrt(1.25));near(value(e,'roof.edge.ridge'),ridge==='horizontal'?40:30);near(value(e,'roof.edge.rake'),(ridge==='horizontal'?60:80)*Math.sqrt(1.25));}
});
test('shed directions and flat roof never infer assembly applicability',()=>{
 for(const direction of [0,90,180,270] as const){const e=generated(40,30,{type:'shed',direction});near(value(e,'roof.gross'),1200*Math.sqrt(1.25));near(value(e,'roof.edge.eave'),direction===0||direction===180?30:40);}
 const f=generated(40,30,{type:'flat',pitch:0});near(value(f,'roof.gross'),1200);assert.ok(f.filter(e=>e.kind==='roofEdge').every(e=>e.edgeType==='unclassified'));
});
test('generator invalid geometry and duplicate application rejected',()=>{
 assert.throws(()=>generated(0,30));assert.throws(()=>generated(40,30,{pitch:0}));assert.throws(()=>generated(40,30,{pitch:49}));const e=generated(40,30);assert.throws(()=>validateRoofTopology([...e,plane('existing')]),/Overlapping/);
});
test('generated roof survives canonical persistence and one specialist undo',()=>{
 const blank=createProjectDocument(createBlankProject(),'floor');const doc=addWorkspace(blank,'roof','Roof','roof');const snap={view:workspaceRenderView(doc),measurements:[]};const e=generated(40,30);
 const edit=replaceSpecialistEntities(doc,'roof',e);const saved=deserializeProjectDocument(serializeProjectDocument(edit));assert.deepEqual(saved.workspaces[1].measurements,e);
 assert.deepEqual(restoreWorkspaceSnapshot(saved,'roof',snap).workspaces[1].measurements,[]);assert.deepEqual(saved.workspaces[0],blank.workspaces[0]);assert.equal(canReportProjectEstimate(saved),false);
});
test('roof rectangle resize rejects dependent plane and preserves opening containment',()=>{
 const p=plane('p');const o:RoofEntity={...base('o'),kind:'roofOpening',polygon:rect(2,2,4,5),planeId:'p',deduction:'included'};
 assert.throws(()=>resizeRoofRectangle([p,o],'p',30,20),/dependent/);
 const next=resizeRoofRectangle([p,o],'o',6,8);near(value(next,'roof.opening.projected'),48);assert.throws(()=>resizeRoofRectangle([p,o],'o',50,8),/outside|consume/);
});
test('free wall length edit preserves anchor and rejects connected endpoint or opening conflict',()=>{
 const blank=createBlankProject();const w={id:'w',startNodeId:'a',endNodeId:'b',height:9,thickness:.375,wallType:'partition_2x4' as const};
 const state={...blank,nodes:[{id:'a',x:0,y:0},{id:'b',x:10,y:0}],walls:[w]};
 const next=resizeWallSegment(state,'w',40);assert.equal(next.nodes[1].x,40);assert.equal(state.nodes[1].x,10);
 assert.throws(()=>resizeWallSegment({...state,nodes:[...state.nodes,{id:'c',x:10,y:10}],walls:[w,{...w,id:'w2',startNodeId:'b',endNodeId:'c'}]},'w',40),/Connected/);
 assert.throws(()=>resizeWallSegment({...state,apertures:[{id:'o',wallId:'w',offset:5,width:3,height:7,type:'door_passage'}]},'w',6),/opening/);
});

import {rectangularRoof,insetRoof,thermalRectangles,thermalPieces,type Bounds,type Depths} from '../src/engine/measurements/roofDerivation';
const outer:Bounds={xmin:0,ymin:0,xmax:40,ymax:30};
const uniform=(d:number):Depths=>({north:d,east:d,south:d,west:d});
const ids=(es:RoofEntity[])=>es.filter(e=>e.kind==='roofPlane').map(e=>e.id);
test('R4 uniform inset conserves area and reconciles four corners',()=>{
 const result=insetRoof(outer,uniform(2));
 assert.deepEqual(result.inner,{xmin:2,ymin:2,xmax:38,ymax:28});
 near(result.interiorSF,936);near(result.interiorLF,124);near(result.overhangSF,264);
 assert.deepEqual(Object.fromEntries(result.pieces.map(p=>[p.side,p.projectedSF])),{north:80,east:52,south:80,west:52});
 const surfaces:RoofEntity[]=result.pieces.map(p=>({...base(p.side),kind:'roofSurface',purpose:'soffit',polygon:p.polygon,surfaceBasis:'horizontal',pitchRise:0}));
 near(value(surfaces,'roof.soffit.area'),264);
});
test('R4 nonuniform depths and explicit zero overhang',()=>{
 const result=insetRoof(outer,{west:1,east:2,north:3,south:0});
 assert.deepEqual(result.inner,{xmin:1,ymin:3,xmax:38,ymax:30});
 near(result.interiorSF,999);near(result.overhangSF,201);
 assert.deepEqual(Object.fromEntries(result.pieces.map(p=>[p.side,p.projectedSF])),{north:120,east:54,west:27});
 const zero=insetRoof(outer,uniform(0));near(zero.interiorSF,1200);assert.deepEqual(zero.pieces,[]);
});
test('R4 invalid and missing overhang depths refuse rather than default to zero',()=>{
 for(const d of [-1,NaN,Infinity,15,20])assert.throws(()=>insetRoof(outer,uniform(d)));
 assert.throws(()=>insetRoof(outer,{north:2,east:2,south:2} as Depths),/every side/);
});
test('R4 complete hip and gable outlines require reconciled classified exterior sides',()=>{
 for(const config of [{type:'hip'},{type:'gable',ridge:'horizontal'},{type:'gable',ridge:'vertical'}] as Partial<RoofConfig>[]){
  const es=generated(40,30,config);const r=rectangularRoof(es,ids(es));
  assert.deepEqual(r.outer,outer);
  assert.ok(Object.values(r.boundary).every(b=>b.edgeIds.length>0&&b.soffit==='unspecified'));
 }
 // Shed generation deliberately leaves the high boundary unclassified.
 // Verify refusal first, then explicitly classify the synthetic high boundary.
 for(const direction of [0,90,180,270] as const){
  const shed=generated(40,30,{type:'shed',direction});
  const unresolved=shed.filter(e=>e.kind==='roofEdge'&&e.edgeType==='unclassified');
  assert.equal(unresolved.length,1);
  assert.throws(()=>rectangularRoof(shed,ids(shed)),/Classify/);
  const resolved=shed.map(e=>e.kind==='roofEdge'&&e.edgeType==='unclassified'?{...e,edgeType:'abutment' as const}:e);
  const r=rectangularRoof(resolved,ids(resolved));
  assert.deepEqual(r.outer,outer);
  assert.ok(Object.values(r.boundary).every(b=>b.edgeIds.length>0&&b.soffit==='unspecified'));
 }
 const flat=generated(40,30,{type:'flat',pitch:0});
 assert.throws(()=>rectangularRoof(flat,ids(flat)),/Classify/);
 const classified=flat.map(e=>e.kind==='roofEdge'?{...e,edgeType:'parapet' as const}:e);
 assert.deepEqual(rectangularRoof(classified,ids(classified)).outer,outer);
});
test('R4 irregular, gapped, overlapping and unresolved roof selection refused',()=>{
 const l=plane('l',[{x:0,y:0},{x:40,y:0},{x:40,y:15},{x:20,y:15},{x:20,y:30},{x:0,y:30}]);
 assert.throws(()=>rectangularRoof([l],['l']),/fill a rectangle/);
 const a=plane('a',rect(0,0,10,30)),b=plane('b',rect(20,0,20,30));
 assert.throws(()=>rectangularRoof([a,b],['a','b']),/fill a rectangle/);
 assert.throws(()=>rectangularRoof([a,plane('c',rect(5,0,20,30))],['a','c']),/Overlapping/);
 assert.throws(()=>rectangularRoof([plane('p')],['p']),/Classify/);
 assert.throws(()=>rectangularRoof([plane('p')],['p','p']),/distinct/);
});
test('R4 mixed soffit applicability is explicit; split side conflict refused',()=>{
 const es=generated(40,30,{type:'gable',ridge:'horizontal'});
 const exterior=es.filter((e):e is Extract<RoofEntity,{kind:'roofEdge'}>=>e.kind==='roofEdge'&&e.planeIds.length===1);
 const east=exterior.filter(e=>e.start.x===40&&e.end.x===40);
 assert.equal(east.length,2);
 const modified=es.map(e=>e.id===east[0].id&&e.kind==='roofEdge'?{...e,applicability:{...e.applicability,soffit:'included' as const}}:e);
 assert.throws(()=>rectangularRoof(modified,ids(modified)),/Conflicting soffit applicability/);
 const assigned=generated(40,30).map(e=>e.kind==='roofEdge'&&e.edgeType==='eave'?{...e,applicability:{...e.applicability,soffit:e.start.y===0&&e.end.y===0?'included' as const:'excluded' as const}}:e);
 const r=rectangularRoof(assigned,ids(assigned));assert.equal(r.boundary.north.soffit,'included');assert.equal(r.boundary.east.soffit,'excluded');
 near(insetRoof(r.outer,uniform(2)).pieces.filter(p=>r.boundary[p.side].soffit==='included').reduce((n,p)=>n+p.projectedSF,0),80);
});
test('R4 horizontal and hip deck insulation analytical quantities',()=>{
 const es=generated(40,30);
 const r=rectangularRoof(es,ids(es)),inset=insetRoof(r.outer,uniform(2));
 const rs=thermalRectangles(inset.inner,[]);
 const horizontal=thermalPieces(rs,r.planes,'horizontal');
 near(horizontal.reduce((n,p)=>n+p.actualSF!,0),936);near(horizontal.reduce((n,p)=>n+p.actualSF!*6,0),5616);
 near(horizontal.reduce((n,p)=>n+p.actualSF!*.5,0),468);
 const sloped=thermalPieces(rs,r.planes,'sloped');
 assert.equal(sloped.length,4);near(sloped.reduce((n,p)=>n+p.projectedSF,0),936);
 near(sloped.reduce((n,p)=>n+p.actualSF!,0),936*Math.sqrt(1.25));
 const surfaces:RoofEntity[]=sloped.map((p,i)=>({...base('thermal-'+i),kind:'roofSurface',purpose:'insulation',polygon:p.polygon,surfaceBasis:'sloped',pitchRise:p.pitchRise,insulationType:'closed cell foam',depthFt:.5}));
 near(value(surfaces,'roof.insulation.sloped.volume'),936*Math.sqrt(1.25)*6);
});
test('R4 exclusions partition footprint without overlap and reject invalid exclusions',()=>{
 const inner=insetRoof(outer,uniform(2)).inner;
 const exclusion={xmin:18,ymin:8,xmax:38,ymax:18};
 const rs=thermalRectangles(inner,[exclusion]);
 const pieces=thermalPieces(rs,[],'horizontal');
 near(pieces.reduce((n,p)=>n+p.projectedSF,0),736);
 const surfaces:RoofEntity[]=pieces.map((p,i)=>({...base('thermal-'+i),kind:'roofSurface',purpose:'insulation',polygon:p.polygon,surfaceBasis:'horizontal',pitchRise:0,insulationType:'blown cellulose'}));
 near(value(surfaces,'roof.insulation.horizontal'),736);
 assert.throws(()=>thermalRectangles(inner,[exclusion,exclusion]),/overlap/);
 assert.throws(()=>thermalRectangles(inner,[outer]),/inside/);
 assert.throws(()=>thermalRectangles(inner,[inner]),/entire/);
});
test('R4 mixed roof pitches and missing pitch preserve individual clipped contributions',()=>{
 const rs=thermalRectangles(insetRoof(outer,uniform(2)).inner,[]);
 const a=plane('a',rect(0,0,20,30),4),b=plane('b',rect(20,0,20,30),8);
 const ps=thermalPieces(rs,[a,b],'sloped');
 assert.equal(ps.length,2);near(ps[0].projectedSF,468);near(ps[1].projectedSF,468);
 near(ps.reduce((n,p)=>n+p.actualSF!,0),468*Math.sqrt(10/9)+468*Math.sqrt(13/9));
 const pending=thermalPieces(rs,[a,{...b,pitchRise:null}],'sloped');
 assert.equal(pending[1].actualSF,null);near(pending[1].projectedSF,468);
 assert.throws(()=>thermalPieces(rs,[a],'sloped'),/cover/);
});
test('R4 sloped clipping rejects concave planes and overlapping thermal rectangles',()=>{
 const l=plane('l',[{x:0,y:0},{x:40,y:0},{x:40,y:15},{x:20,y:15},{x:20,y:30},{x:0,y:30}]);
 assert.throws(()=>thermalPieces([outer],[l],'sloped'),/convex/);
 assert.throws(()=>thermalPieces([outer,outer],[plane('p')],'horizontal'),/overlap/);
});

import {reconstructRoofSurfaces,type DerivationSpec} from '../src/engine/measurements/roofDerivation';
type DerivedSurface=Extract<RoofEntity,{kind:'roofSurface'}>;
const sourceRoof=(w=40,pitch=6):RoofEntity[]=>generated(w,30,{pitch}).map(e=>e.kind==='roofPlane'?{...e,roofGroupId:'roof-group'}:e.kind==='roofEdge'?{...e,roofGroupId:'roof-group',applicability:{...e.applicability,soffit:e.edgeType==='eave'?'included':'excluded'}}:e);
function derivedFixture(source:RoofEntity[],purpose:'soffit'|'insulation',basis:'horizontal'|'sloped'='horizontal'){
 const spec:DerivationSpec={version:1,groupId:'derived-'+purpose,planeIds:ids(source),edgeIds:source.filter(e=>e.kind==='roofEdge'&&e.planeIds.length===1).map(e=>e.id),depths:uniform(2),purpose,basis,exclusions:[],boundaryConfirmed:true,cornersConfirmed:true,...(purpose==='insulation'?{material:'closed cell foam',thicknessFt:.5}:{})};
 const surfaces:DerivedSurface[]=reconstructRoofSurfaces(source,spec).map((p,i)=>({...base(spec.groupId+'-'+i),kind:'roofSurface',purpose,polygon:p.polygon,pitchRise:p.pitchRise,surfaceBasis:basis,insulationType:spec.material,depthFt:spec.thicknessFt,derivation:{...spec,pieceKey:p.pieceKey}}));
 return {spec,surfaces};
}
test('R4 canonical derived hip surfaces preserve analytical quantities and separate identities',()=>{
 const source=sourceRoof(),s=derivedFixture(source,'soffit'),i=derivedFixture(source,'insulation','sloped');
 const all=[...source,...s.surfaces,...i.surfaces];
 assert.equal(s.surfaces.length,4);assert.equal(i.surfaces.length,4);
 validateRoofTopology(all);
 near(value(all,'roof.soffit.area'),264);
 near(value(all,'roof.insulation.sloped.volume'),936*Math.sqrt(1.25)*6);
 assert.equal(new Set(all.map(e=>e.physicalId)).size,all.length);
});
test('R4 derived group rejects changed source extent and slope independently',()=>{
 const source=sourceRoof(),i=derivedFixture(source,'insulation','sloped');
 assert.throws(()=>validateRoofTopology([...sourceRoof(42),...i.surfaces]),/Stale|stale/);
 assert.throws(()=>validateRoofTopology([...sourceRoof(40,8),...i.surfaces]),/Stale|stale/);
});
test('R4 derived group rejects missing piece, modified polygon and missing source reference',()=>{
 const source=sourceRoof(),s=derivedFixture(source,'soffit');
 assert.throws(()=>validateRoofTopology([...source,...s.surfaces.slice(1)]),/Incomplete/);
 const first=s.surfaces[0];
 const changed={...first,polygon:first.polygon.map(p=>({x:p.x+100,y:p.y}))};
 assert.throws(()=>validateRoofTopology([...source,changed,...s.surfaces.slice(1)]),/Stale/);
 assert.throws(()=>validateRoofTopology([...source.filter(e=>e.id!==s.spec.edgeIds[0]),...s.surfaces]),/missing derivation source reference/);
});
test('R4 soffit applicability change requires reconciliation; mixed corners require confirmation',()=>{
 const source=sourceRoof(),s=derivedFixture(source,'soffit');
 const changed=source.map(e=>e.kind==='roofEdge'&&e.id===s.spec.edgeIds[0]?{...e,applicability:{...e.applicability,soffit:'excluded' as const}}:e);
 assert.throws(()=>validateRoofTopology([...changed,...s.surfaces]),/Incomplete/);
 assert.throws(()=>reconstructRoofSurfaces(changed,{...s.spec,cornersConfirmed:false}),/Confirm mixed/);
 const unresolved=source.map(e=>e.kind==='roofEdge'&&e.id===s.spec.edgeIds[0]?{...e,applicability:{...e.applicability,soffit:'unspecified' as const}}:e);
 assert.throws(()=>reconstructRoofSurfaces(unresolved,s.spec),/Resolve soffit/);
});
test('R4 derived identity and consistent group parameters validated',()=>{
 const source=sourceRoof(),s=derivedFixture(source,'soffit'),first=s.surfaces[0],second=s.surfaces[1];
 assert.throws(()=>validateRoofTopology([...source,first,{...second,derivation:{...second.derivation!,pieceKey:first.derivation!.pieceKey}},...s.surfaces.slice(2)]),/duplicate derivation piece/);
 assert.throws(()=>validateRoofTopology([...source,{...first,derivation:{...first.derivation!,depths:uniform(3)}},...s.surfaces.slice(1)]),/inconsistent derivation group parameters/);
 assert.throws(()=>validateRoofTopology(source.map(e=>e.kind==='roofEdge'?{...e,roofGroupId:'missing-group'}:e)),/roof group has no plane/);
});
test('R4 derived metadata survives project JSON and history restoration; stale import and edit refused',()=>{
 const blank=createProjectDocument(createBlankProject(),'floor'),doc=addWorkspace(blank,'roof','Roof','roof');
 const source=sourceRoof(),i=derivedFixture(source,'insulation','sloped'),all=[...source,...i.surfaces];
 const before=replaceSpecialistEntities(doc,'roof',source),after=replaceSpecialistEntities(before,'roof',all);
 const saved=deserializeProjectDocument(serializeProjectDocument(after));
 assert.deepEqual(saved.workspaces[1].measurements,JSON.parse(JSON.stringify(all)));
 const undo=restoreWorkspaceSnapshot(saved,'roof',{view:workspaceRenderView(before),measurements:source});
 assert.deepEqual(undo.workspaces[1].measurements,source);
 const redo=restoreWorkspaceSnapshot(undo,'roof',{view:workspaceRenderView(after),measurements:all});
 assert.deepEqual(redo.workspaces[1].measurements,all);
 assert.deepEqual(redo.workspaces[0],blank.workspaces[0]);
 const stale=[...sourceRoof(40,8),...i.surfaces];
 assert.throws(()=>replaceSpecialistEntities(after,'roof',stale),/Stale/);
 const corrupt={...after,workspaces:after.workspaces.map(w=>w.id==='roof'?{...w,measurements:stale}:w)};
 assert.throws(()=>deserializeProjectDocument(JSON.stringify(corrupt)),/Stale/);
 assert.equal(canReportProjectEstimate(redo),false);
});
