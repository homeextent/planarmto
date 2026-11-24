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
