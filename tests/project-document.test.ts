import test from 'node:test';
import assert from 'node:assert/strict';
import { createBlankProject, createModernTwoBedroomRancher, createStudioSuite, createGarageWorkshop } from '../src/engine/samplePlans';
import { calculateMTO, calculateEstimatedCost, DEFAULT_UNIT_COST_RATES } from '../src/engine/estimator';
import { readProjectDocument, createProjectDocument, workspaceFloorplan, replaceWorkspaceGeometry, serializeProjectDocument, deserializeProjectDocument } from '../src/engine/projectDocument';
import type { ProjectDocument } from '../src/engine/projectDocument';
import type { FloorplanState } from '../src/types';

const blueprint = { src: 'data:image/png;base64,fixture', worldX: 12, worldY: -8, feetPerPixel: .0125, opacity: .37, isVisible: true, isLocked: true,
  pdfSource: { filename: 'plan.pdf', page: 2, width: 5000, height: 3200 } };
const cost = (state: FloorplanState) => calculateEstimatedCost(calculateMTO(state),
  state.settings.costRates || DEFAULT_UNIT_COST_RATES, state.settings.categoryInclusions,
  state.settings.itemInclusions, state.settings, state.stamps, state.apertures, state.walls);

for (const [name, factory] of [
  ['blank', createBlankProject], ['rancher', createModernTwoBedroomRancher],
  ['studio', createStudioSuite], ['garage', createGarageWorkshop],
] as const) {
  test('v3 floor adapter preserves established calculation inputs: ' + name, () => {
    const state = factory();
    state.activeProjectId = 'project-123';
    state.activeProjectName = 'Existing project';
    state.underlay = structuredClone(blueprint);
    state.settings = { ...state.settings, costRates: structuredClone(DEFAULT_UNIT_COST_RATES), profitPercentage: 17 };
    const before = structuredClone(state);
    assert.throws(() => readProjectDocument(state), /historical projects are retired/);
    const {activeProjectId,activeProjectName,settings,...geometry}=state;
    const doc=readProjectDocument({...createProjectDocument(createBlankProject(),'floor-a'),activeProjectId,activeProjectName,settings,workspaces:[{id:'floor-a',name:'Level 1',type:'floor',geometry,measurements:[]}]});
    assert.deepEqual(state, before);
    assert.equal(doc.workspaces[0].name, 'Level 1');
    assert.equal(doc.scope.mode,'explicit');
    assert.equal(doc.schemaVersion,3);
    const view = workspaceFloorplan(doc);
    assert.deepEqual(view, before);
    assert.deepEqual(calculateMTO(view), calculateMTO(before));
    assert.deepEqual(cost(view), cost(before));
    assert.deepEqual(deserializeProjectDocument(serializeProjectDocument(doc)), doc);
  });
}

function multi(): ProjectDocument {
  const doc = createProjectDocument(createBlankProject(), 'floor-a');
  const blank = doc.workspaces[0].geometry;
  doc.workspaces.push(
    { id: 'floor-b', name: 'Upper floor', type: 'floor', geometry: structuredClone(blank), measurements: [] },
    { id: 'roof-a', name: 'Roof', type: 'roof', geometry: structuredClone(blank), measurements: [] },
    { id: 'foundation-a', name: 'Foundation', type: 'foundation', geometry: structuredClone(blank), measurements: [] },
    { id: 'site-a', name: 'Site', type: 'site', geometry: structuredClone(blank), measurements: [] },
  );
  return doc;
}
test('new projects have explicit unquantified scope, not legacy estimates', () => {
  const doc = createProjectDocument(createBlankProject(), 'floor-a');
  assert.deepEqual(doc.scope, { mode: 'explicit', assignments: { roof: { status: 'unquantified' }, foundation: { status: 'unquantified' }, site: { status: 'unquantified' } } });
  assert.throws(() => createProjectDocument(createModernTwoBedroomRancher(), 'floor-a'));
});
test('typed workspaces share settings and preserve isolated geometry and calibration', () => {
  const doc = multi();
  const a = workspaceFloorplan(doc, 'floor-a');
  a.nodes.push({ id: 'same-id', x: 1, y: 2 });
  a.underlay = structuredClone(blueprint);
  a.settings.profitPercentage = 99; // geometry adapter must not write project settings
  const first = replaceWorkspaceGeometry(doc, 'floor-a', a);
  const b = workspaceFloorplan(first, 'floor-b');
  b.nodes.push({ id: 'same-id', x: 20, y: 30 });
  b.underlay = { ...blueprint, feetPerPixel: .05 };
  const next = replaceWorkspaceGeometry(first, 'floor-b', b);
  assert.equal(doc.workspaces[0].geometry.nodes.length, 0);
  assert.equal(workspaceFloorplan(next, 'floor-a').nodes[0].x, 1);
  assert.equal(workspaceFloorplan(next, 'floor-b').nodes[0].x, 20);
  assert.equal(workspaceFloorplan(next, 'floor-a').underlay?.feetPerPixel, .0125);
  assert.equal(workspaceFloorplan(next, 'floor-b').underlay?.feetPerPixel, .05);
  assert.equal(next.settings.profitPercentage, doc.settings.profitPercentage);
  assert.equal(next.activeWorkspaceId, 'floor-a');
  assert.deepEqual(deserializeProjectDocument(serializeProjectDocument(next)), next);
});
test('explicit ownership supports multiple roof workspaces and distinguishes excluded from unquantified', () => {
  const doc = multi();
  doc.workspaces.push({ ...structuredClone(doc.workspaces[2]), id: 'roof-b' });
  doc.scope = { mode: 'explicit', assignments: {
    roof: { status: 'assigned', workspaceIds: ['roof-a','roof-b'] },
    foundation: { status: 'unquantified' }, site: { status: 'excluded', reason:'Outside contract' },
  } };
  assert.deepEqual(readProjectDocument(doc), doc);
  const wrong = structuredClone(doc);
  if (wrong.scope.mode === 'explicit') wrong.scope.assignments.roof = { status: 'assigned', workspaceIds: ['floor-a'] };
  assert.throws(() => readProjectDocument(wrong), /invalid scope owner/);
  const duplicate = structuredClone(doc);
  if (duplicate.scope.mode === 'explicit') duplicate.scope.assignments.roof = { status: 'assigned', workspaceIds: ['roof-a','roof-a'] };
  assert.throws(() => readProjectDocument(duplicate), /invalid scope owner/);
});
test('malformed documents and future versions are rejected, not blanked', () => {
  const doc = multi();
  assert.throws(() => readProjectDocument({ ...doc, schemaVersion: 4 }), /unsupported schema/);
  assert.throws(() => readProjectDocument({ ...doc, activeWorkspaceId: 'missing' }), /active workspace/);
  assert.throws(() => readProjectDocument({ ...doc, workspaces: [] }), /at least one/);
  assert.throws(() => readProjectDocument({ ...doc, workspaces: [doc.workspaces[0], doc.workspaces[0]] }), /duplicate workspace/);
  assert.throws(() => readProjectDocument({ ...doc, scope: { mode: 'legacy', workspaceId: 'roof-a' } }), /invalid scope policy/);
  assert.throws(() => readProjectDocument({ nodes: [], walls: [] }), /Invalid project/);
  assert.throws(() => deserializeProjectDocument('not JSON'));
  assert.throws(() => workspaceFloorplan(doc, 'missing'), /workspace not found/);
  const bad = workspaceFloorplan(doc);
  bad.underlay = { ...blueprint, feetPerPixel: 0 };
  assert.throws(() => replaceWorkspaceGeometry(doc, 'floor-a', bad), /invalid blueprint/);
  const foreign = workspaceFloorplan(doc);
  foreign.activeProjectId = 'other-project';
  assert.throws(() => replaceWorkspaceGeometry(doc, 'floor-a', foreign), /different project/);
});

import type {FoundationEntity} from '../src/engine/measurements/measurementTypes';
import {measureFoundation} from '../src/engine/measurements/foundationMeasurements';
import {selectWorkspace,replaceSpecialistEntities,restoreWorkspaceSnapshot,canReportProjectEstimate} from '../src/engine/workspaceController';
const foundationWall=(id='w'):FoundationEntity=>({id,physicalId:id,assemblyId:'walls',source:{reference:'fixture'},kind:'foundationWall',start:{x:0,y:0},end:{x:40,y:0},widthFt:8/12,heightFt:8,elevationFt:0,foundation:{version:1,material:'poured concrete',centrelineConfirmed:true,baseElevationConfirmed:true,wallOpenings:[{id:'o-'+id,offsetFt:5,widthFt:4,sillFt:2,heightFt:3}]}});
const foundationDoc=()=>selectWorkspace(multi(),'foundation-a');
test('foundation detail metadata survives save/reopen and recomputed quantities',()=>{
 const doc=foundationDoc(),next=replaceSpecialistEntities(doc,'foundation-a',[foundationWall()]);
 const restored=deserializeProjectDocument(serializeProjectDocument(next));
 assert.deepEqual(restored,next);
 const entities=restored.workspaces.find(w=>w.id==='foundation-a')!.measurements as FoundationEntity[];
 const m=measureFoundation('foundation-a',entities);
 assert.ok(Math.abs(m.detailBreakdown[0].netCY!-7.604938271604938)<1e-8);
 assert.equal(canReportProjectEstimate(restored),false);
});
test('invalid opening edit rejected atomically at workspace replacement and serialization',()=>{
 const doc=replaceSpecialistEntities(foundationDoc(),'foundation-a',[foundationWall()]);
 const bad=foundationWall();bad.foundation!.wallOpenings![0].offsetFt=39;
 assert.throws(()=>replaceSpecialistEntities(doc,'foundation-a',[bad]),/outside parent/);
 assert.deepEqual(doc.workspaces.find(w=>w.id==='foundation-a')!.measurements,[foundationWall()]);
 const corrupt=structuredClone(doc);corrupt.workspaces.find(w=>w.id==='foundation-a')!.measurements=[bad];
 assert.throws(()=>serializeProjectDocument(corrupt),/outside parent/);
 assert.throws(()=>readProjectDocument(corrupt),/outside parent/);
});
test('foundation snapshot restore validates details and leaves original unchanged',()=>{
 const doc=replaceSpecialistEntities(foundationDoc(),'foundation-a',[foundationWall()]);
 const bad=foundationWall();bad.foundation!.wallOpenings![0].offsetFt=0;
 assert.throws(()=>restoreWorkspaceSnapshot(doc,'foundation-a',{view:workspaceFloorplan(doc),measurements:[bad]}),/junction/);
 const cleared=restoreWorkspaceSnapshot(doc,'foundation-a',{view:workspaceFloorplan(doc),measurements:[]});
 assert.equal(cleared.workspaces.find(w=>w.id==='foundation-a')!.measurements.length,0);
 const restored=restoreWorkspaceSnapshot(cleared,'foundation-a',{view:workspaceFloorplan(doc),measurements:[foundationWall()]});
 assert.deepEqual(restored,doc);
});
test('foundation detail IDs cannot collide across parents or with entity IDs',()=>{
 const doc=foundationDoc(),a=foundationWall('a'),b=foundationWall('b');
 b.foundation!.wallOpenings![0].id='o-a';
 assert.throws(()=>replaceSpecialistEntities(doc,'foundation-a',[a,b]),/Duplicate foundation entity or detail ID/);
 b.foundation!.wallOpenings![0].id='a';
 assert.throws(()=>replaceSpecialistEntities(doc,'foundation-a',[a,b]),/Duplicate foundation entity or detail ID/);
});
test('historical foundation metadata is not inferred on roundtrip',()=>{
 const e=foundationWall();delete e.foundation;
 const doc=replaceSpecialistEntities(foundationDoc(),'foundation-a',[e]);
 const restored=deserializeProjectDocument(serializeProjectDocument(doc));
 assert.deepEqual(restored,doc);
 assert.equal(measureFoundation('foundation-a',[e]).rows[0].status,'unquantified');
});
test('confirmed invalid foundation polygon cannot cross persistence boundary',()=>{
 const bad:FoundationEntity={id:'s',physicalId:'s',assemblyId:'slabs',source:{reference:'fixture'},kind:'slab',polygon:[{x:0,y:0},{x:10,y:10},{x:0,y:10},{x:8,y:0}],depthFt:1,purpose:'concrete',elevationFt:0,foundation:{version:1,material:'poured concrete',baseElevationConfirmed:true}};
 assert.throws(()=>replaceSpecialistEntities(foundationDoc(),'foundation-a',[bad]),/Invalid foundation polygon/);
 delete bad.foundation;
 const doc=replaceSpecialistEntities(foundationDoc(),'foundation-a',[bad]);
 assert.deepEqual(deserializeProjectDocument(serializeProjectDocument(doc)),doc);
 assert.equal(measureFoundation('foundation-a',[bad]).rows[0].status,'unquantified');
});

import {generateFoundationPerimeter} from '../src/engine/measurements/foundationDrafting';
import {deriveStripFootings,planFoundationDeletion} from '../src/engine/measurements/foundationDerivation';
import {deriveFoundationEnvelope,deriveRectangularEnvelope} from '../src/engine/measurements/foundationEnvelopeDerivation';
import {derivePerimeterDrainage} from '../src/engine/measurements/foundationDrainageDerivation';
import {rectanglePoints} from '../src/engine/precisionDrafting';
const closeQuantity=(actual:number,expected:number)=>assert.ok(Math.abs(actual-expected)<1e-7,actual+' != '+expected);
function sumFoundation(entities:FoundationEntity[],code:string,expected:number){
 const rows=measureFoundation('foundation-a',entities).rows.filter(r=>r.code===code);
 assert.ok(rows.length>0,'Missing '+code);assert.ok(rows.every(r=>r.status==='measured'),'Pending '+code);
 closeQuantity(rows.reduce((n,r)=>n+(r.status==='measured'?r.quantity:0),0),expected);
}
function integratedBasement(){
 let n=0;const id=()=> 'basement-'+(++n),t=8/12;
 const walls=generateFoundationPerimeter({xmin:0,xmax:40,ymin:0,ymax:30},'exterior',t,8,0,id),ids=walls.map(w=>w.id);
 const footings=deriveStripFootings(walls,ids,2,1,id);
 const waterproof=deriveRectangularEnvelope(walls,ids,{purpose:'waterproofing',heightFt:6,material:'membrane',layerId:'wp'},id);
 const insulation=deriveRectangularEnvelope(walls,ids,{purpose:'verticalInsulation',heightFt:6,depthFt:.25,material:'foam',layerId:'vertical',foam:true},id);
 const drainage=derivePerimeterDrainage(walls,ids,2,'pipe','drain',id);
 // Explicit interior slab clearance avoids overlap with the wall and footing volumes.
 const slab:FoundationEntity={id:'basement-slab',physicalId:'basement-slab',assemblyId:'basement-slab',source:{reference:'Synthetic independent interior slab'},kind:'slab',purpose:'concrete',polygon:rectanglePoints({x:2,y:2},{x:38,y:28}),depthFt:4/12,elevationFt:0,foundation:{version:1,material:'poured concrete',baseElevationConfirmed:true}};
 const granular=deriveFoundationEnvelope([slab],[slab.id],{purpose:'granular',material:'stone',layerId:'stone',depthFt:.5},id);
 const excavation:FoundationEntity={id:'basement-exc',physicalId:'basement-exc',assemblyId:'basement-exc',source:{reference:'Explicit excavation fixture'},kind:'foundationRegion',purpose:'excavation',polygon:rectanglePoints({x:-2,y:-2},{x:42,y:32}),depthFt:9,elevationFt:-1,foundation:{version:1,material:'in-situ soil',baseElevationConfirmed:true}};
 return {walls,footings,waterproof,insulation,drainage,slab,granular,excavation,entities:[...walls,...footings,...waterproof,...insulation,...drainage,slab,...granular,excavation]};
}
test('integrated basement quantities, canonical roundtrip, independent workspace and pricing gate',()=>{
 const f=integratedBasement(),t=8/12,centreW=40-t,centreD=30-t;
 const doc=replaceSpecialistEntities(foundationDoc(),'foundation-a',f.entities);
 const restored=deserializeProjectDocument(serializeProjectDocument(doc));
 assert.deepEqual(restored,doc);assert.deepEqual(restored.workspaces.find(w=>w.id==='floor-a'),doc.workspaces.find(w=>w.id==='floor-a'));
 const e=restored.workspaces.find(w=>w.id==='foundation-a')!.measurements as FoundationEntity[];
 assert.ok(measureFoundation('foundation-a',e).rows.every(r=>r.status==='measured'));
 sumFoundation(e,'foundation.wall.concrete',(1200-(40-2*t)*(30-2*t))*8/27);
 sumFoundation(e,'foundation.footing.strip.concrete',((centreW+2)*(centreD+2)-(centreW-2)*(centreD-2))/27);
 sumFoundation(e,'foundation.slab.concrete',936/81);
 sumFoundation(e,'foundation.granular.volume',936*.5/27);
 sumFoundation(e,'foundation.excavation.volume',44*34*9/27);
 sumFoundation(e,'foundation.waterproofing.area',840);
 sumFoundation(e,'foundation.insulation.area',840);
 sumFoundation(e,'foundation.insulation.foam',2520);
 sumFoundation(e,'foundation.drainage.length',156);
 assert.equal(canReportProjectEstimate(restored),false);
});
test('integrated basement dependency deletion and restoration preserve independent geometry',()=>{
 const f=integratedBasement(),doc=replaceSpecialistEntities(foundationDoc(),'foundation-a',f.entities);
 const plan=planFoundationDeletion(f.entities,[f.walls[0].id]);
 assert.equal(plan.dependentCount,16);assert.equal(plan.remaining.length,6);
 assert.ok(plan.remaining.some(e=>e.id===f.slab.id));
 assert.ok(plan.remaining.some(e=>e.id===f.excavation.id));
 const changed=replaceSpecialistEntities(doc,'foundation-a',plan.remaining);
 const restored=restoreWorkspaceSnapshot(changed,'foundation-a',{view:workspaceFloorplan(doc),measurements:f.entities});
 assert.deepEqual(restored,doc);
 const corrupted=structuredClone(doc);corrupted.workspaces.find(w=>w.id==='foundation-a')!.measurements=f.entities.filter(e=>e.id!==f.drainage[0].id);
 assert.throws(()=>readProjectDocument(corrupted),/Incomplete derived drainage group/);
});
test('integrated slab-on-grade net concrete, independent pad and explicit earthwork roundtrip',()=>{
 const slab:FoundationEntity={id:'sg-slab',physicalId:'sg-slab',assemblyId:'sg-slab',source:{reference:'Synthetic slab-on-grade'},kind:'slab',purpose:'concrete',polygon:rectanglePoints({x:0,y:0},{x:40,y:30}),depthFt:4/12,elevationFt:0,foundation:{version:1,material:'poured concrete',baseElevationConfirmed:true,slabOpenings:[{id:'sg-opening',polygon:rectanglePoints({x:1,y:1},{x:7,y:11})}],slabThickenings:[{id:'sg-thick',polygon:rectanglePoints({x:20,y:10},{x:30,y:20}),depthFt:1.5,basis:'total'}]}};
 const pad:FoundationEntity={id:'sg-pad',physicalId:'sg-pad',assemblyId:'sg-pad',source:{reference:'Independent pad'},kind:'padFooting',purpose:'concrete',polygon:rectanglePoints({x:42,y:0},{x:46,y:4}),depthFt:1,elevationFt:-1,foundation:{version:1,material:'poured concrete',baseElevationConfirmed:true}};
 const backfill:FoundationEntity={id:'sg-fill',physicalId:'sg-fill',assemblyId:'sg-fill',source:{reference:'Explicit backfill'},kind:'foundationRegion',purpose:'backfill',polygon:rectanglePoints({x:0,y:32},{x:40,y:37}),depthFt:1,elevationFt:-1,foundation:{version:1,material:'fill',baseElevationConfirmed:true}};
 const doc=replaceSpecialistEntities(foundationDoc(),'foundation-a',[slab,pad,backfill]),restored=deserializeProjectDocument(serializeProjectDocument(doc));
 assert.deepEqual(restored,doc);const e=restored.workspaces.find(w=>w.id==='foundation-a')!.measurements as FoundationEntity[];
 sumFoundation(e,'foundation.slab.concrete',(1140*4/12+100*14/12)/27);
 sumFoundation(e,'foundation.footing.pad.concrete',16/27);sumFoundation(e,'foundation.footing.pad.count',1);sumFoundation(e,'foundation.backfill.volume',200/27);
 assert.equal(canReportProjectEstimate(restored),false);
});

import {generateOrthogonalFoundationPerimeter} from '../src/engine/measurements/foundationDrafting';
import {setFoundationApplicability} from '../src/engine/measurements/foundationApplicability';
function integratedIrregularR2(){
 let n=0;const id=()=> 'r2-'+(++n);
 const outline=[{x:0,y:0},{x:40,y:0},{x:40,y:20},{x:20,y:20},{x:20,y:40},{x:0,y:40}];
 const walls=generateOrthogonalFoundationPerimeter(outline,'exterior',1,8,0,id),ids=walls.map(e=>e.id);
 const footings=deriveStripFootings(walls,ids,2,1,id);
 const waterproof=deriveRectangularEnvelope(walls,ids,{purpose:'waterproofing',heightFt:6,material:'membrane',layerId:'wp'},id);
 const vertical=deriveRectangularEnvelope(walls,ids,{purpose:'verticalInsulation',heightFt:6,depthFt:.25,material:'foam',layerId:'vertical',foam:true},id);
 const drainage=derivePerimeterDrainage(walls,ids,2,'pipe','drain',id);
 const slab:FoundationEntity={id:'r2-slab',physicalId:'r2-slab',assemblyId:'r2-slab',source:{reference:'Explicit independent interior slab'},kind:'slab',purpose:'concrete',polygon:[{x:2,y:2},{x:38,y:2},{x:38,y:18},{x:18,y:18},{x:18,y:38},{x:2,y:38}],depthFt:4/12,elevationFt:0,foundation:{version:1,material:'poured concrete',baseElevationConfirmed:true}};
 const horizontal=deriveFoundationEnvelope([slab],[slab.id],{purpose:'horizontalInsulation',material:'foam',layerId:'horizontal',depthFt:.25,foam:true,offsetBelowSlabFt:0},id);
 const granular=deriveFoundationEnvelope([slab,...horizontal],[slab.id],{purpose:'granular',material:'stone',layerId:'stone',depthFt:.5,offsetBelowSlabFt:.25},id);
 const pad:FoundationEntity={id:'r2-existing-pad',physicalId:'r2-existing-pad',assemblyId:'r2-pad',source:{reference:'Existing isolated pad'},kind:'padFooting',purpose:'concrete',polygon:rectanglePoints({x:45,y:0},{x:49,y:4}),depthFt:1,elevationFt:-1,foundation:{version:1,material:'poured concrete',baseElevationConfirmed:true},scopeApplicability:{status:'excluded',reason:'Existing pad retained'}};
 const fill:FoundationEntity={id:'r2-fill',physicalId:'r2-fill',assemblyId:'r2-fill',source:{reference:'Explicit provisional fill'},kind:'foundationRegion',purpose:'backfill',polygon:rectanglePoints({x:45,y:10},{x:55,y:20}),depthFt:1,elevationFt:-1,foundation:{version:1,material:'fill',baseElevationConfirmed:true},scopeApplicability:{status:'pending',reason:'Confirm fill extent'}};
 const entities=[...walls,...footings,...waterproof,...vertical,...drainage,slab,...horizontal,...granular,pad,fill];
 return {walls,footings,waterproof,vertical,drainage,slab,horizontal,granular,pad,fill,entities};
}
test('R2 integrated irregular foundation retains scope, envelope, layer ownership and reference areas across roundtrip',()=>{
 const f=integratedIrregularR2(),doc=replaceSpecialistEntities(foundationDoc(),'foundation-a',f.entities);
 const restored=deserializeProjectDocument(serializeProjectDocument(doc));assert.deepEqual(restored,doc);
 const e=restored.workspaces.find(w=>w.id==='foundation-a')!.measurements as FoundationEntity[],m=measureFoundation('foundation-a',e);
 const slabSF=36*16+16*20;
 sumFoundation(e,'foundation.wall.concrete',156*8/27);
 sumFoundation(e,'foundation.footing.strip.concrete',312/27);
 sumFoundation(e,'foundation.slab.concrete',slabSF/81);
 sumFoundation(e,'foundation.waterproofing.area',960);
 sumFoundation(e,'foundation.insulation.area',960+slabSF);
 sumFoundation(e,'foundation.insulation.foam',(960+slabSF)*3);
 sumFoundation(e,'foundation.granular.volume',slabSF*.5/27);
 sumFoundation(e,'foundation.drainage.length',176);
 assert.ok(m.rows.every(r=>r.elementId===f.fill.id?r.status==='unquantified':r.status==='measured'));
 assert.ok(!m.rows.some(r=>r.elementId===f.pad.id));
 assert.equal(m.scopeDiagnostics.find(r=>r.elementId===f.pad.id)?.reason,'Existing pad retained');
 assert.equal(m.scopeDiagnostics.find(r=>r.elementId===f.fill.id)?.status,'pending');
 closeQuantity(m.footprintReferences.find(r=>r.elementId===f.slab.id)!.netSF!,slabSF);
 assert.equal(canReportProjectEstimate(restored),false);
});
test('R2 integrated scope transactions and dependency deletion preserve unrelated material ownership',()=>{
 const f=integratedIrregularR2(),doc=replaceSpecialistEntities(foundationDoc(),'foundation-a',f.entities);
 assert.throws(()=>setFoundationApplicability(f.entities,[f.slab.id],{status:'excluded',reason:'Existing slab'}),/source-linked/);
 const slabGroup=[f.slab.id,...f.horizontal.map(e=>e.id),...f.granular.map(e=>e.id)];
 const excluded=setFoundationApplicability(f.entities,slabGroup,{status:'excluded',reason:'Existing assembly'});
 const changed=replaceSpecialistEntities(doc,'foundation-a',excluded);
 const m=measureFoundation('foundation-a',excluded);assert.ok(!m.rows.some(r=>slabGroup.includes(r.elementId)));
 sumFoundation(excluded,'foundation.wall.concrete',156*8/27);sumFoundation(excluded,'foundation.drainage.length',176);
 assert.deepEqual(deserializeProjectDocument(serializeProjectDocument(changed)),changed);
 const plan=planFoundationDeletion(f.entities,[f.walls[0].id]);assert.equal(plan.dependentCount,24);
 assert.ok(slabGroup.every(id=>plan.remaining.some(e=>e.id===id)));
 const deleted=replaceSpecialistEntities(doc,'foundation-a',plan.remaining);
 assert.deepEqual(restoreWorkspaceSnapshot(deleted,'foundation-a',{view:workspaceFloorplan(doc),measurements:f.entities}),doc);
 assert.equal(f.entities.find(e=>e.id===f.slab.id)?.scopeApplicability,undefined);
});
test('R2 integrated coincident layer conflict remains pending across persistence without changing unrelated quantities',()=>{
 const f=integratedIrregularR2();let n=0;
 const conflict=deriveFoundationEnvelope([f.slab],[f.slab.id],{purpose:'granular',material:'stone',layerId:'stone',depthFt:.5,offsetBelowSlabFt:0},()=> 'r2-conflict-'+(++n));
 const entities=[...f.entities.filter(e=>!f.granular.some(g=>g.id===e.id)),...conflict];
 const doc=replaceSpecialistEntities(foundationDoc(),'foundation-a',entities);
 const restored=deserializeProjectDocument(serializeProjectDocument(doc));assert.deepEqual(restored,doc);
 const saved=restored.workspaces.find(w=>w.id==='foundation-a')!.measurements as FoundationEntity[];
 const m=measureFoundation('foundation-a',saved),blocked=[...f.horizontal,...conflict].map(e=>e.id);
 assert.equal(m.rows.filter(r=>blocked.includes(r.elementId)).length,3);
 assert.ok(m.rows.filter(r=>blocked.includes(r.elementId)).every(r=>r.status==='unquantified'));
 sumFoundation(saved,'foundation.drainage.length',176);sumFoundation(saved,'foundation.slab.concrete',896/81);
 assert.equal(canReportProjectEstimate(restored),false);
});

test('generated perimeter reference is preserved on roundtrip and rejects corrupted geometry on import',()=>{
 let n=0;const w=generateFoundationPerimeter({xmin:0,xmax:40,ymin:0,ymax:30},'exterior',1,8,0,()=> 'persist-ref'+(++n));
 const doc=replaceSpecialistEntities(foundationDoc(),'foundation-a',w);
 assert.deepEqual(deserializeProjectDocument(serializeProjectDocument(doc)),doc);
 const a=w[0];if(a.kind!=='foundationWall')throw Error('Expected wall');
 const corrupt=structuredClone(doc);corrupt.workspaces.find(q=>q.id==='foundation-a')!.measurements=[{...a,widthFt:2},...w.slice(1)];
 assert.throws(()=>readProjectDocument(corrupt),/perimeter reference is stale/);
});

import {createReferencedWall} from '../src/engine/measurements/foundationDrafting';
test('R4 angled face-reference wall and manual footing survive canonical project roundtrip with exact independent quantities',()=>{
 const a=createReferencedWall({x:0,y:0},{x:30,y:40},'r4-angle','exterior-left',1.25);
 if(a.kind!=='foundationWall')throw Error('Expected wall');
 const wall={...a,heightFt:8,elevationFt:0,foundation:{...a.foundation!,baseElevationConfirmed:true as const}};
 const footing:FoundationEntity={id:'r4-angle-footing',physicalId:'r4-angle-footing',assemblyId:'r4-angle-footing',source:{reference:'Explicit independent angled strip'},kind:'stripFooting',start:a.start,end:a.end,widthFt:2,heightFt:1,elevationFt:-1,foundation:{version:1,material:'poured concrete',centrelineConfirmed:true,baseElevationConfirmed:true}};
 const doc=replaceSpecialistEntities(foundationDoc(),'foundation-a',[wall,footing]),restored=deserializeProjectDocument(serializeProjectDocument(doc));
 assert.deepEqual(restored,doc);
 const saved=restored.workspaces.find(w=>w.id==='foundation-a')!.measurements as FoundationEntity[];
 sumFoundation(saved,'foundation.wall.concrete',500/27);sumFoundation(saved,'foundation.footing.strip.concrete',100/27);
 assert.equal(canReportProjectEstimate(restored),false);
 assert.deepEqual(restored.workspaces.find(w=>w.id==='floor-a'),doc.workspaces.find(w=>w.id==='floor-a'));
 const corrupt=structuredClone(doc);corrupt.workspaces.find(w=>w.id==='foundation-a')!.measurements=[{...wall,widthFt:2},footing];
 assert.throws(()=>readProjectDocument(corrupt),/Face-reference geometry is stale/);
});
test('R4 intersecting angled runs retain unresolved quantities across roundtrip without blocking independent solids',()=>{
 const base={kind:'foundationWall' as const,widthFt:1,heightFt:8,elevationFt:0,source:{reference:'Explicit angled run'},foundation:{version:1 as const,material:'poured concrete',centrelineConfirmed:true as const,baseElevationConfirmed:true as const}};
 const a:FoundationEntity={...base,id:'r4-a',physicalId:'r4-a',assemblyId:'r4-cross',start:{x:0,y:0},end:{x:30,y:40}};
 const b:FoundationEntity={...base,id:'r4-b',physicalId:'r4-b',assemblyId:'r4-cross',start:{x:0,y:40},end:{x:30,y:0}};
 const c:FoundationEntity={...base,id:'r4-c',physicalId:'r4-c',assemblyId:'r4-independent',start:{x:60,y:0},end:{x:90,y:40}};
 const doc=replaceSpecialistEntities(foundationDoc(),'foundation-a',[a,b,c]),restored=deserializeProjectDocument(serializeProjectDocument(doc));
 assert.deepEqual(restored,doc);
 const m=measureFoundation('foundation-a',restored.workspaces.find(w=>w.id==='foundation-a')!.measurements as FoundationEntity[]);
 assert.ok(m.rows.filter(r=>r.elementId===a.id||r.elementId===b.id).every(r=>r.status==='unquantified'));
 const row=m.rows.find(r=>r.elementId===c.id);assert.ok(row?.status==='measured');if(row?.status==='measured')closeQuantity(row.quantity,400/27);
 assert.equal(canReportProjectEstimate(restored),false);
});
