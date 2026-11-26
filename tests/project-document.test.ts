import {independentWallLoop} from '../src/components/FoundationAssemblyPanel';
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

import { previewAssemblyChange, applyAssemblyPreview } from '../src/engine/measurements/foundationAssemblyController';
import type { AssemblyIntent, ManualDrainageRoute, Source } from '../src/engine/measurements/foundationAssemblyModel';
import { addWorkspace, replaceFoundationPresets } from '../src/engine/workspaceController';

const assemblySource:Source={kind:'plan',reference:'Synthetic confirmed takeoff'};
const c=<T,>(value:T)=>({value,confirmation:assemblySource});
const unconfigured={status:'pending',reason:'Awaiting owner decision'} as const;
const poured={kind:'catalogue',category:'concrete',id:'poured concrete'} as const;
function assemblyFixture(){
 let seq=0;
 const id=()=> 'fixture-id-'+(++seq);
 const doc=addWorkspace(createProjectDocument(createBlankProject(),'floor'),'foundation','Synthetic foundation','foundation');
 const vertices=[{x:0,y:0},{x:40,y:0},{x:40,y:30},{x:0,y:30}].map((point,i)=>({id:'vertex-'+i,point}));
 const segments=vertices.map((v,i)=>({id:'edge-'+i,startVertexId:v.id,endVertexId:vertices[(i+1)%vertices.length].id}));
 const input:AssemblyIntent={trace:{kind:'rectangle',reference:'exterior',vertices,segments,source:assemblySource},overrides:[],specifications:{
  walls:{status:'included',specification:{material:c(poured),widthFt:c(8/12),heightFt:c(8),datum:c({basis:'base',elevationFt:0})}},
  footing:unconfigured,drainage:unconfigured,exteriorLayers:[],slab:unconfigured,insulation:unconfigured,granular:unconfigured,
 }};
 return {doc,input,id};
}
function assemblyWallVolume(preview:ReturnType<typeof previewAssemblyChange>,code:string){
 return preview.quantities.after.filter(r=>r.code===code&&r.status==='measured').reduce((sum,row)=>sum+(row.status==='measured'?row.quantity:0),0);
}
function expectVolume(actual:number,expected:number){
 assert.ok(Math.abs(actual-expected)<1e-7,actual+' differs from '+expected);
}
test('coordinated assembly uses exact wall, strip, waterproofing and drainage engines with atomic history',()=>{
 const {doc,input,id}=assemblyFixture();
 input.specifications.footing={status:'included',specification:{material:c(poured),widthFt:c(2),depthFt:c(.5),alignment:c({kind:'centred'}),top:c({kind:'wallBase'})}};
 input.specifications.drainage={status:'included',specification:{material:c({kind:'catalogue',category:'drainage',id:'perforated rigid pvc drainage pipe'}),route:c({kind:'footingEdgeOffset',offsetFt:8/12})}};
 input.specifications.exteriorLayers=[{id:'membrane',scope:{status:'included',specification:{
  material:c({kind:'catalogue',category:'waterproofing',id:'sheet waterproofing membrane'}),coverage:c({kind:'specifiedHeight',heightFt:6}),
 }}}];
 const snapshot={view:workspaceFloorplan(doc),measurements:[]};
 const preview=previewAssemblyChange(doc,'foundation','assembly',null,{kind:'create',input},id);
 assert.deepEqual(preview.conflicts,[]);
 expectVolume(assemblyWallVolume(preview,'foundation.wall.concrete'),27.12757201646);
 expectVolume(assemblyWallVolume(preview,'foundation.footing.strip.concrete'),5.08641975309);
 expectVolume(assemblyWallVolume(preview,'foundation.waterproofing.area'),840);
 expectVolume(assemblyWallVolume(preview,'foundation.drainage.length'),150.66666666667);
 assert.ok(preview.unresolvedSpecifications.some(g=>g.path==='attributes.nominalDiameterFt'&&g.blocks.includes('materialSpecification')));
 const applied=applyAssemblyPreview(doc,preview);
 assert.deepEqual(deserializeProjectDocument(serializeProjectDocument(applied)),applied);
 assert.throws(()=>applyAssemblyPreview(applied,preview),/Stale/);
 const [parent]=applied.workspaces[1].foundationAssemblies!;
 const next=structuredClone(input),footing=next.specifications.footing;
 assert.equal(footing.status,'included');
 if(footing.status==='included')footing.specification.depthFt=c(1);
 const modified=previewAssemblyChange(applied,'foundation','assembly',parent.revisionId,{kind:'replaceIntent',input:next},id);
 assert.deepEqual(modified.conflicts,[]);
 expectVolume(assemblyWallVolume(modified,'foundation.footing.strip.concrete'),10.17283950617);
 assert.deepEqual(modified.changes!.parents[0].children,parent.children);
 const modifiedDocument=applyAssemblyPreview(applied,modified);
 const reverted=previewAssemblyChange(modifiedDocument,'foundation','assembly',modified.changes!.parents[0].revisionId,{kind:'replaceIntent',input},id);
 assert.deepEqual(reverted.conflicts,[]);
 expectVolume(assemblyWallVolume(reverted,'foundation.footing.strip.concrete'),5.08641975309);
 const thicker=structuredClone(input),walls=thicker.specifications.walls;
 if(walls.status==='included')walls.specification.widthFt=c(10/12);
 const thickerPreview=previewAssemblyChange(applied,'foundation','assembly',parent.revisionId,{kind:'replaceIntent',input:thicker},id);
 assert.deepEqual(thickerPreview.conflicts,[]);
 expectVolume(assemblyWallVolume(thickerPreview,'foundation.wall.concrete'),33.744855967);
 assert.deepEqual(thickerPreview.changes!.parents[0].trace,parent.trace);
 assert.equal(previewAssemblyChange(applied,'foundation','assembly',parent.revisionId,{kind:'replaceIntent',input},id).changes,null);
 assert.deepEqual(restoreWorkspaceSnapshot(applied,'foundation',snapshot),doc);
 assert.throws(()=>replaceSpecialistEntities(applied,'foundation',applied.workspaces[1].measurements.slice(1)),/parent assembly/);
});
test('included incomplete specifications preserve known independent drainage and distinguish pending and exclusion',()=>{
 const {doc,input,id}=assemblyFixture();
 input.specifications.walls={status:'included',specification:{}};
 input.specifications.slab={status:'excluded',reason:'Outside bid'};
 const route:ManualDrainageRoute={kind:'manual',closed:false,
   vertices:[{id:'route-a',point:{x:0,y:0}},{id:'route-b',point:{x:10,y:0}}],
   segments:[{id:'route-first',startVertexId:'route-a',endVertexId:'route-b'}]};
 input.specifications.drainage={status:'included',specification:{material:c({kind:'catalogue',category:'drainage',id:'solid drainage pipe'}),route:c(route)}};
 const preview=previewAssemblyChange(doc,'foundation','assembly',null,{kind:'create',input},id);
 assert.deepEqual(preview.conflicts,[]);
 expectVolume(assemblyWallVolume(preview,'foundation.drainage.length'),10);
 assert.ok(preview.unresolvedSpecifications.some(g=>g.path==='walls.widthFt'&&g.blocks.includes('quantity')));
 assert.ok(preview.unresolvedSpecifications.some(g=>g.path==='attributes.nominalDiameterFt'));
 assert.equal(preview.quantities.after.length,1);
 const applied=applyAssemblyPreview(doc,preview);
 const parent=applied.workspaces[1].foundationAssemblies![0];
 const modified=structuredClone(input);
 if(modified.specifications.drainage.status==='included')modified.specifications.drainage.specification.route=c({...route,vertices:[route.vertices[0],{...route.vertices[1],point:{x:15,y:0}}]});
 const moved=previewAssemblyChange(applied,'foundation','assembly',parent.revisionId,{kind:'replaceIntent',input:modified},id);
 assert.deepEqual(moved.conflicts,[]);
 assert.deepEqual(moved.changes!.parents[0].children,parent.children);
 expectVolume(assemblyWallVolume(moved,'foundation.drainage.length'),15);
});
test('project-local preset versions, origin and confirmed snapshots validate through exact v3 round-trip',()=>{
 const {doc,input,id}=assemblyFixture();
 const version={version:1,name:'Synthetic wall template',systems:{
  walls:{status:'included' as const,specification:{widthFt:c(8/12)}},
  footing:unconfigured,exteriorLayers:[],drainage:unconfigured,insulation:unconfigured,granular:unconfigured,
 }};
 const preset={id:'local-preset',version:1 as const,origin:{presetId:'original-copy',version:2},versions:[version]};
 const selected=replaceFoundationPresets(doc,[preset]);
 input.preset={presetId:preset.id,version,confirmation:assemblySource};
 const next=applyAssemblyPreview(selected,previewAssemblyChange(selected,'foundation','assembly',null,{kind:'create',input},id));
 const deleted=replaceFoundationPresets(next,[]);
 const restored=deserializeProjectDocument(serializeProjectDocument(deleted));
 assert.deepEqual(restored.workspaces[1].foundationAssemblies![0].preset,input.preset);
 assert.throws(()=>replaceFoundationPresets(selected,[{...preset,versions:[version,version]}]),/versions must increase/);
});

test('independent slab extent and confirmed under-slab stack retain exact quantities and sequencing',()=>{
 const {doc,input,id}=assemblyFixture();
 input.specifications.walls=unconfigured;
 input.specifications.slab={status:'included',specification:{
  material:c(poured),extent:c({kind:'independent',points:[{x:0,y:0},{x:40,y:0},{x:40,y:30},{x:0,y:30}]}),
  thicknessFt:c(4/12),baseFt:c(0),footingRelation:c(assemblySource),
 }};
 input.specifications.insulation={status:'included',specification:{id:c('foam'),material:c({kind:'catalogue',category:'insulation',id:'eps'}),thicknessFt:c(.25)}};
 input.specifications.granular={status:'included',specification:{id:c('granular'),material:c({kind:'catalogue',category:'granular',id:'clear crushed stone'}),thicknessFt:c(.5)}};
 const preview=previewAssemblyChange(doc,'foundation','assembly',null,{kind:'create',input},id);
 assert.deepEqual(preview.conflicts,[]);
 expectVolume(assemblyWallVolume(preview,'foundation.slab.concrete'),14.81481481481);
 expectVolume(assemblyWallVolume(preview,'foundation.insulation.area'),1200);
 expectVolume(assemblyWallVolume(preview,'foundation.insulation.foam'),3600);
 expectVolume(assemblyWallVolume(preview,'foundation.granular.volume'),22.22222222222);
 const applied=applyAssemblyPreview(doc,preview);
 const values=applied.workspaces[1].measurements.filter(e=>'elevationFt' in e).map(e=>'elevationFt'in e?e.elevationFt:null);
 assert.deepEqual(values,[0,-.25,-.75]);

 const parent=applied.workspaces[1].foundationAssemblies![0];
 const excluded=structuredClone(input);
 excluded.specifications.insulation={status:'excluded',reason:'Not specified'};
 const direct=previewAssemblyChange(applied,'foundation',parent.id,parent.revisionId,{kind:'replaceIntent',input:excluded},id);
 assert.deepEqual(direct.conflicts,[]);
 const directBase=direct.changes?.measurements.find(e=>e.kind==='foundationRegion'&&e.purpose==='granular');
 assert.ok(directBase?.kind==='foundationRegion');
 assert.equal(directBase.elevationFt,-.5);
 expectVolume(assemblyWallVolume(direct,'foundation.granular.volume'),22.22222222222);
 const pending=structuredClone(input);
 pending.specifications.insulation={status:'pending',reason:'Awaiting detail'};
 const unresolved=previewAssemblyChange(applied,'foundation',parent.id,parent.revisionId,{kind:'replaceIntent',input:pending},id);
 assert.deepEqual(unresolved.conflicts,[]);
 assert.ok(unresolved.unresolvedSpecifications.some(g=>g.system==='granular'&&g.path==='sequence'));
 assert.equal(unresolved.quantities.after.some(row=>row.code==='foundation.granular.volume'),false);
 expectVolume(assemblyWallVolume(unresolved,'foundation.slab.concrete'),14.81481481481);
});

test('component exclusion survives adoption, dormant scope and reactivation',()=>{
 const {doc,input,id}=assemblyFixture();
 const generated=previewAssemblyChange(doc,'foundation','source',null,{kind:'create',input},id);
 assert.deepEqual(generated.conflicts,[]);
 const source=generated.changes!;
 const measurements=structuredClone(source.measurements);
 const excluded=measurements[0];
 excluded.scopeApplicability={status:'excluded',reason:'Outside original trade'};
 const historical=replaceSpecialistEntities(doc,'foundation',measurements);
 const adopt=previewAssemblyChange(historical,'foundation','adopted',null,{kind:'adopt',input,bindings:source.parents[0].children,source:assemblySource},id);
 assert.deepEqual(adopt.conflicts,[]);
 const accepted=applyAssemblyPreview(historical,adopt);
 const adopted=accepted.workspaces[1].foundationAssemblies![0];
 assert.deepEqual(adopted.componentScope[0].decision,excluded.scopeApplicability);
 const off=structuredClone(input);
 off.specifications.walls={status:'excluded',reason:'Deferred scope'};
 const hide=previewAssemblyChange(accepted,'foundation','adopted',adopted.revisionId,{kind:'replaceIntent',input:off},id);
 assert.deepEqual(hide.conflicts,[]);
 assert.equal(hide.changes!.parents[0].dormantChildren.length,4);
 const suspended=applyAssemblyPreview(accepted,hide);
 const restore=previewAssemblyChange(suspended,'foundation','adopted',hide.changes!.parents[0].revisionId,{kind:'replaceIntent',input},id);
 assert.deepEqual(restore.conflicts,[]);
 assert.deepEqual(restore.changes!.measurements[0].scopeApplicability,excluded.scopeApplicability);
 assert.deepEqual(restore.changes!.parents[0].children,adopted.children);
 assert.equal(restore.quantities.after.filter(r=>r.code==='foundation.wall.concrete').length,3);
});

test('assembly validation rejects stale manifests, retention overflow and broken identity references',()=>{
 const {doc,input,id}=assemblyFixture();
 const preview=previewAssemblyChange(doc,'foundation','assembly',null,{kind:'create',input},id);
 assert.deepEqual(preview.conflicts,[]);
 const saved=applyAssemblyPreview(doc,preview);
 const copy=()=>structuredClone(saved);
 const damaged=copy();
 const parent=damaged.workspaces[1].foundationAssemblies![0];
 parent.children[0].physicalId='not-the-child-physical-id';
 assert.throws(()=>readProjectDocument(damaged),/mismatched owned measurement/);
 const stale=copy();
 const s=stale.workspaces[1].foundationAssemblies![0].specifications.walls;
 if(s.status==='included')s.specification.heightFt=c(9);
 assert.throws(()=>readProjectDocument(stale),/stale owned measurement/);
 const overflow=copy();
 const overParent=overflow.workspaces[1].foundationAssemblies![0];
 overParent.dormantChildren=Array.from({length:257},(_,i)=>({disabledAtRevisionId:overParent.revisionId,child:{
  entityId:'dormant-'+i,physicalId:'dormant-'+i,role:{system:'wall',sourceId:'removed-'+i},
 }}));
 assert.throws(()=>readProjectDocument(overflow),/dormantChildren/);
 const dangling=copy();
 const d=dangling.workspaces[1].foundationAssemblies![0];
 d.replacements=[{retired:{kind:'routeVertex',id:'old-vertex'},successorIds:['missing'],revisionId:d.revisionId}];
 assert.throws(()=>readProjectDocument(dangling),/dangling/);
});

test('manual drainage replacement preserves excluded predecessor scope in each directed successor',()=>{
 const {doc,input,id}=assemblyFixture();
 input.specifications.walls=unconfigured;
 const route:ManualDrainageRoute={kind:'manual',closed:false,vertices:[{id:'a',point:{x:0,y:0}},{id:'b',point:{x:10,y:0}}],
    segments:[{id:'edge-old',startVertexId:'a',endVertexId:'b'}]};
 input.specifications.drainage={status:'included',specification:{material:c({kind:'catalogue',category:'drainage',id:'solid drainage pipe'}),route:c(route),
  attributes:c({nominalDiameterFt:c(4/12),pipeMaterial:c('PVC'),perforation:c('solid')}),
 }};
 const first=applyAssemblyPreview(doc,previewAssemblyChange(doc,'foundation','assembly',null,{kind:'create',input},id));
 let old=first.workspaces[1].foundationAssemblies![0];
 const decision={status:'excluded',reason:'Outside owner takeoff'} as const;
 const excluded=applyAssemblyPreview(first,previewAssemblyChange(first,'foundation','assembly',old.revisionId,{
  kind:'setComponentScope',entityIds:[old.children[0].entityId],decision,confirmation:assemblySource,
 },id));
 old=excluded.workspaces[1].foundationAssemblies![0];
 const changed=structuredClone(input);
 if(changed.specifications.drainage.status==='included')changed.specifications.drainage.specification.route=c({
  kind:'manual',closed:false,vertices:[route.vertices[0],{id:'middle',point:{x:5,y:0}},route.vertices[1]],
  segments:[{id:'edge-left',startVertexId:'a',endVertexId:'middle'},{id:'edge-right',startVertexId:'middle',endVertexId:'b'}],
 });
 const blocked=previewAssemblyChange(excluded,'foundation','assembly',old.revisionId,{kind:'replaceIntent',input:changed},id);
 assert.match(blocked.conflicts[0].message,/explicit lineage/);
 const ids=['edge-left','edge-right'].map(segment=>JSON.stringify(['foundation-child','assembly',JSON.stringify(['drainage',segment,null])]));
 const replacement=previewAssemblyChange(excluded,'foundation','assembly',old.revisionId,{
  kind:'replaceIntent',input:changed,identityReplacements:[
    {retired:{kind:'routeSegment',id:'edge-old'},successorIds:['edge-left','edge-right']},
    {retired:{kind:'child',binding:old.children[0]},successorIds:ids},
  ],
 },id);
 assert.deepEqual(replacement.conflicts,[]);
 assert.equal(replacement.quantities.after.length,0);
 const applied=applyAssemblyPreview(excluded,replacement),next=applied.workspaces[1].foundationAssemblies![0];
 assert.deepEqual(next.children.map(b=>b.entityId),ids);
 assert.equal(next.componentScope.filter(s=>s.decision.status==='excluded').length,3);
 assert.ok(applied.workspaces[1].measurements.every(e=>'scopeApplicability' in e&&e.scopeApplicability?.status==='excluded'&&e.scopeApplicability.reason===decision.reason));
 assert.deepEqual(deserializeProjectDocument(serializeProjectDocument(applied)),applied);
});

test('coordinated exterior layers remain independently traceable, while duplicated coverage stays unresolved',()=>{
 const {doc,input,id}=assemblyFixture();
 const layer=(id:string,material:string)=>({id,scope:{status:'included' as const,specification:{
  material:c({kind:'catalogue' as const,category:'waterproofing' as const,id:material}),coverage:c({kind:'specifiedHeight' as const,heightFt:6}),
 }}});
 input.specifications.exteriorLayers=[layer('membrane','sheet waterproofing membrane'),layer('board','dimpled drainage membrane')];
 const preview=previewAssemblyChange(doc,'foundation','assembly',null,{kind:'create',input},id);
 assert.deepEqual(preview.conflicts,[]);
 expectVolume(assemblyWallVolume(preview,'foundation.waterproofing.area'),1680);
 assert.deepEqual([...new Set(preview.changes!.measurements.flatMap(e=>e.foundation?.coverage?[e.foundation.coverage.layerId]:[]))].sort(),['board','membrane']);
 const duplicate=structuredClone(input);
 duplicate.specifications.exteriorLayers[1]=layer('other-membrane','sheet waterproofing membrane');
 const unresolved=previewAssemblyChange(doc,'foundation','assembly',null,{kind:'create',input:duplicate},id);
 assert.ok(unresolved.unresolvedSpecifications.some(g=>g.reason.includes('Overlapping coverage')));
 assert.equal(unresolved.quantities.after.filter(r=>r.code==='foundation.waterproofing.area'&&r.status==='measured').length,0);
});

test('staged assembly preview cannot be altered before Apply',()=>{
 const {doc,input,id}=assemblyFixture();
 const preview=previewAssemblyChange(doc,'foundation','assembly',null,{kind:'create',input},id);
 assert.deepEqual(preview.conflicts,[]);
 preview.changes!.measurements.pop();
 assert.throws(()=>applyAssemblyPreview(doc,preview),/preview changed/);
 assert.equal(doc.workspaces[1].measurements.length,0);
});

test('independent slab adoption preserves its identity, source, and the original takeoff geometry',()=>{
 const {doc,input,id}=assemblyFixture();
 const first=applyAssemblyPreview(doc,previewAssemblyChange(doc,'foundation','assembly',null,{kind:'create',input},id));
 const parent=first.workspaces[1].foundationAssemblies![0];
 const polygon=[{x:60,y:0},{x:100,y:0},{x:100,y:30},{x:60,y:30}];
 const slab={kind:'slab' as const,purpose:'concrete' as const,polygon,depthFt:4/12,elevationFt:0,id:'independent-slab',physicalId:'independent-slab',
  assemblyId:'manual-slab',source:{reference:'Owner traced detached garage slab'},foundation:{version:1 as const,baseElevationConfirmed:true as const,material:'poured concrete'}};
 const source=replaceSpecialistEntities(first,'foundation',[...first.workspaces[1].measurements,slab]);
 const next=structuredClone(input);
 next.specifications.slab={status:'included',specification:{extent:c({kind:'independent',points:polygon}),material:c(poured),
  thicknessFt:c(4/12),baseFt:c(0),footingRelation:c(assemblySource)}};
 const adopted=previewAssemblyChange(source,'foundation','assembly',parent.revisionId,{kind:'replaceIntent',input:next,
  adoption:{source:assemblySource,bindings:[{role:{system:'slab'},entityId:slab.id,physicalId:slab.physicalId}]}},id);
 assert.deepEqual(adopted.conflicts,[]);
 const resolved=applyAssemblyPreview(source,adopted);
 const preserved=resolved.workspaces[1].measurements.find(e=>e.id===slab.id)!;
 assert.deepEqual(preserved.source,slab.source);
 assert.equal(preserved.physicalId,slab.physicalId);
 expectVolume(assemblyWallVolume(adopted,'foundation.slab.concrete'),14.81481481481);
});

import { moveFoundationTraceVertex, addFoundationTraceNotch } from '../src/engine/measurements/foundationTraceCorrection';

test('detached strip remains independent through edit, regeneration, deletion and explicit re-adoption',()=>{
 const {doc,input,id}=assemblyFixture();
 input.specifications.footing={status:'included',specification:{material:c(poured),widthFt:c(2),depthFt:c(.5),alignment:c({kind:'centred'}),top:c({kind:'wallBase'})}};
 const initial=applyAssemblyPreview(doc,previewAssemblyChange(doc,'foundation','assembly',null,{kind:'create',input},id));
 const parent=initial.workspaces[1].foundationAssemblies![0];
 const bindings=parent.children.filter(b=>b.role.system==='footing');
 const scopes=previewAssemblyChange(initial,'foundation',parent.id,parent.revisionId,{
  kind:'setComponentScope',entityIds:[bindings[0].entityId],decision:{status:'excluded',reason:'Owner-supplied strip'},confirmation:assemblySource,
 },id);
 const withScope=applyAssemblyPreview(initial,scopes);
 const saved=withScope.workspaces[1].foundationAssemblies![0];
 const blocked=previewAssemblyChange(withScope,'foundation',saved.id,saved.revisionId,{kind:'detach',roles:[bindings[0].role],reason:'Partial strip',source:assemblySource},id);
 assert.match(blocked.conflicts[0].message,/complete system/);
 const dependent=previewAssemblyChange(withScope,'foundation',saved.id,saved.revisionId,{kind:'detach',roles:saved.children.filter(b=>b.role.system==='wall').map(b=>b.role),reason:'Release walls',source:assemblySource},id);
 assert.match(dependent.conflicts[0].message,/Dependent measurements/);
 const preview=previewAssemblyChange(withScope,'foundation',saved.id,saved.revisionId,{kind:'detach',roles:bindings.map(b=>b.role),reason:'Separate trade takeoff',source:assemblySource},id);
 assert.deepEqual(preview.conflicts,[]);
 const released=applyAssemblyPreview(withScope,preview);
 const releasedParent=released.workspaces[1].foundationAssemblies![0];
 assert.equal(releasedParent.children.length,4);
 assert.equal(releasedParent.detachments?.length,4);
 assert.equal(releasedParent.dormantChildren.length,0);
 assert.equal(releasedParent.replacements.length,0);
 for(const binding of bindings){
  const original=withScope.workspaces[1].measurements.find(e=>e.id===binding.entityId);
  const next=released.workspaces[1].measurements.find(e=>e.id===binding.entityId);
  assert.ok(original&&next&&'foundation' in original&&'foundation' in next);
  assert.equal(next.physicalId,original.physicalId);
  assert.deepEqual(next.scopeApplicability,original.scopeApplicability);
  assert.equal(next.foundation?.stripSource,undefined);
 }
 expectVolume(assemblyWallVolume(preview,'foundation.footing.strip.concrete'),
  preview.quantities.before.filter(r=>r.code==='foundation.footing.strip.concrete'&&r.status==='measured').reduce((a,r)=>a+(r.status==='measured'?r.quantity:0),0));
 const reopened=deserializeProjectDocument(serializeProjectDocument(released));
 assert.deepEqual(reopened,released);
 const snap=(d:ProjectDocument)=>({view:workspaceFloorplan(d),measurements:d.workspaces[1].measurements,foundationAssemblies:d.workspaces[1].foundationAssemblies});
 assert.deepEqual(restoreWorkspaceSnapshot(released,'foundation',snap(withScope)),withScope);
 assert.deepEqual(restoreWorkspaceSnapshot(withScope,'foundation',snap(released)),released);
 const edited=replaceSpecialistEntities(released,'foundation',released.workspaces[1].measurements.map(e=>e.kind==='stripFooting'?{...e,heightFt:1}:e));
 const revised=structuredClone(input);
 if(revised.specifications.walls.status==='included')revised.specifications.walls.specification.heightFt=c(9);
 const regen=previewAssemblyChange(edited,'foundation',saved.id,releasedParent.revisionId,{kind:'replaceIntent',input:revised},id);
 assert.deepEqual(regen.conflicts,[]);
 assert.equal(regen.changes!.measurements.filter(e=>e.kind==='stripFooting').length,4);
 assert.ok(regen.changes!.measurements.every(e=>e.kind!=='stripFooting'||e.heightFt===1&&!e.foundation?.stripSource));
 const deleted=replaceSpecialistEntities(released,'foundation',released.workspaces[1].measurements.filter(e=>e.id!==bindings[0].entityId));
 assert.equal(deserializeProjectDocument(serializeProjectDocument(deleted)).workspaces[1].foundationAssemblies![0].detachments?.length,4);
 const readopt=previewAssemblyChange(released,'foundation',saved.id,releasedParent.revisionId,{kind:'replaceIntent',input,adoption:{bindings,source:assemblySource}},id);
 assert.deepEqual(readopt.conflicts,[]);
 assert.equal(readopt.changes!.measurements.filter(e=>e.kind==='stripFooting').length,4);
 assert.ok(readopt.changes!.parents[0].detachments?.every(a=>a.disposition==='readopted'));
 assert.deepEqual(readopt.changes!.measurements.find(e=>e.id===bindings[0].entityId)?.scopeApplicability,{status:'excluded',reason:'Owner-supplied strip'});
 const excessive=structuredClone(released);
 const audit=excessive.workspaces[1].foundationAssemblies![0].detachments!;
 excessive.workspaces[1].foundationAssemblies![0].detachments=Array.from({length:257},()=>audit[0]);
 assert.throws(()=>readProjectDocument(excessive),/detachments/);
});

test('confirmed vertex and edge correction retain prior trace, regenerate dependencies and record child lineage',()=>{
 const {doc,input,id}=assemblyFixture();
 input.specifications.footing={status:'included',specification:{material:c(poured),widthFt:c(2),depthFt:c(.5),alignment:c({kind:'centred'}),top:c({kind:'wallBase'})}};
 const origin=applyAssemblyPreview(doc,previewAssemblyChange(doc,'foundation','assembly',null,{kind:'create',input},id));
 const parent=origin.workspaces[1].foundationAssemblies![0];
 const moved=moveFoundationTraceVertex(parent.trace,1,{x:42,y:0});
 const plain=previewAssemblyChange(origin,'foundation',parent.id,parent.revisionId,{kind:'replaceIntent',input:{...input,trace:moved}},id);
 assert.match(plain.conflicts[0].message,/separately confirmed trace correction/);
 const corner=previewAssemblyChange(origin,'foundation',parent.id,parent.revisionId,{kind:'correctTrace',trace:moved,segments:[],source:assemblySource},id);
 assert.deepEqual(corner.conflicts,[]);
 assert.deepEqual(corner.changes!.parents[0].children,parent.children);
 const revised=applyAssemblyPreview(origin,corner);
 const after=revised.workspaces[1].foundationAssemblies![0];
 assert.deepEqual(after.traceCorrections?.[0].previousTrace,parent.trace);
 assert.ok(assemblyWallVolume(corner,'foundation.footing.strip.concrete')>5.08641975309);
 const notch=addFoundationTraceNotch(after.trace,0,10,10,4,id);
 const amended=previewAssemblyChange(revised,'foundation',after.id,after.revisionId,{kind:'correctTrace',...notch,source:assemblySource},id);
 assert.deepEqual(amended.conflicts,[]);
 const complete=applyAssemblyPreview(revised,amended);
 const final=complete.workspaces[1].foundationAssemblies![0];
 assert.equal(final.trace.vertices.length,8);
 assert.equal(final.traceCorrections?.length,2);
 assert.equal(final.replacements.length,2);
 assert.ok(final.replacements.every(r=>r.successorIds.length===5));
 assert.deepEqual(deserializeProjectDocument(serializeProjectDocument(complete)),complete);
 assert.throws(()=>addFoundationTraceNotch(after.trace,0,0,10,4,id),/within the selected edge/);
});

test('confirmed run override survives coordinated width revision and round-trip without overwriting provenance',()=>{
 const {doc,input,id}=assemblyFixture();
 input.overrides=[{system:'walls',sourceSegmentId:'edge-0',patch:{heightFt:9},source:{kind:'manualOverride',reference:'Confirmed stepped wall detail'}}];
 const initial=applyAssemblyPreview(doc,previewAssemblyChange(doc,'foundation','assembly',null,{kind:'create',input},id));
 const saved=initial.workspaces[1].foundationAssemblies![0];
 const wider=structuredClone(input);
 if(wider.specifications.walls.status==='included')wider.specifications.walls.specification.widthFt=c(10/12);
 const preview=previewAssemblyChange(initial,'foundation',saved.id,saved.revisionId,{kind:'replaceIntent',input:wider},id);
 assert.deepEqual(preview.conflicts,[]);
 const applied=applyAssemblyPreview(initial,preview);
 const reopened=deserializeProjectDocument(serializeProjectDocument(applied));
 const next=reopened.workspaces[1].foundationAssemblies![0];
 const overridden=next.children.find(c=>c.role.system==='wall'&&c.role.sourceId==='edge-0');
 assert.deepEqual(next.overrides,saved.overrides);
 assert.deepEqual(next.trace,saved.trace);
 assert.equal(overridden?.entityId,saved.children[0].entityId);
 assert.ok(reopened.workspaces[1].measurements.some(e=>e.kind==='foundationWall'&&e.id===overridden?.entityId&&e.heightFt===9));
});

test('conventional elevation references survive save, detachment and explicit re-adoption',()=>{
 const {doc,input,id}=assemblyFixture();
 if(input.specifications.walls.status!=='included')throw Error('Expected walls');
 input.specifications.walls.specification.datum=c({basis:'base',elevationFt:0,reference:{kind:'assembly',id:'local'}});
 input.specifications.footing={status:'included',specification:{material:c(poured),widthFt:c(2),depthFt:c(.5),alignment:c({kind:'centred'}),top:c({kind:'wallBase'})}};
 const creation=previewAssemblyChange(doc,'foundation','local',null,{kind:'create',input},id);
 assert.deepEqual(creation.conflicts,[]);
 const committed=deserializeProjectDocument(serializeProjectDocument(applyAssemblyPreview(doc,creation)));
 const parent=committed.workspaces[1].foundationAssemblies![0];
 const reference={kind:'assembly',id:'local'};
 assert.ok(committed.workspaces[1].measurements.every(e=>'foundation' in e&&JSON.stringify(e.foundation?.elevationReference)===JSON.stringify(reference)));
 const bindings=parent.children.filter(b=>b.role.system==='footing');
 const detached=previewAssemblyChange(committed,'foundation',parent.id,parent.revisionId,{
  kind:'detach',roles:bindings.map(b=>b.role),reason:'Separate trade',source:assemblySource,
 },id);
 assert.deepEqual(detached.conflicts,[]);
 const saved=applyAssemblyPreview(committed,detached);
 const slabless=saved.workspaces[1].foundationAssemblies![0];
 const rejoined=previewAssemblyChange(saved,'foundation',parent.id,slabless.revisionId,{
  kind:'replaceIntent',input,adoption:{bindings,source:assemblySource},
 },id);
 assert.deepEqual(rejoined.conflicts,[]);
 assert.deepEqual(rejoined.changes?.measurements.filter(e=>e.kind==='stripFooting').map(e=>[e.id,e.foundation?.elevationReference]),
  bindings.map(b=>[b.entityId,reference]));
 expectVolume(assemblyWallVolume(rejoined,'foundation.footing.strip.concrete'),5.08641975309);
});

test('confirmed exterior order preserves stable children, material quantities and v3 round trip',()=>{
 const {doc,input,id}=assemblyFixture();
 input.specifications.exteriorLayers=[
  {id:'wrap',scope:{status:'included',specification:{material:c({kind:'catalogue',category:'waterproofing',id:'sheet waterproofing membrane'}),coverage:c({kind:'specifiedHeight',heightFt:6})}}},
  {id:'foam',scope:{status:'included',specification:{material:c({kind:'catalogue',category:'insulation',id:'eps'}),coverage:c({kind:'confirmedFullHeight'}),thicknessFt:c(.25)}}},
 ];
 input.specifications.exteriorSequence={status:'confirmed',confirmation:assemblySource};
 const first=previewAssemblyChange(doc,'foundation','ordered',null,{kind:'create',input},id);
 assert.deepEqual(first.conflicts,[]);
 const saved=applyAssemblyPreview(doc,first);
 const parent=saved.workspaces[1].foundationAssemblies![0];
 input.specifications.exteriorLayers.reverse();
 input.specifications.exteriorSequence={status:'unresolved'};
 const unresolved=previewAssemblyChange(saved,'foundation',parent.id,parent.revisionId,{kind:'replaceIntent',input},id);
 assert.ok(unresolved.unresolvedSpecifications.some(g=>g.path==='sequence'));
 input.specifications.exteriorSequence={status:'confirmed',confirmation:assemblySource};
 const reordered=previewAssemblyChange(saved,'foundation',parent.id,parent.revisionId,{kind:'replaceIntent',input},id);
 assert.deepEqual(reordered.conflicts,[]);
 assert.deepEqual(reordered.changes?.parents[0].children.map(child=>child.entityId).sort(),parent.children.map(child=>child.entityId).sort());
 assert.deepEqual(reordered.quantities.after.sort((a,b)=>a.elementId.localeCompare(b.elementId)),first.quantities.after.sort((a,b)=>a.elementId.localeCompare(b.elementId)));
 const reopened=deserializeProjectDocument(serializeProjectDocument(applyAssemblyPreview(saved,reordered)));
 assert.deepEqual(reopened.workspaces[1].foundationAssemblies![0].specifications.exteriorLayers.map(layer=>layer.id),['foam','wrap']);
 assert.equal(reopened.workspaces[1].foundationAssemblies![0].specifications.exteriorSequence?.status,'confirmed');
});

test('standalone garage slab uses specified layer thickness and preserves estimated footprint basis',()=>{
 const {doc,input,id}=assemblyFixture();
 input.trace={...input.trace,kind:'slab',reference:'interior'};
 input.specifications.walls={status:'excluded',reason:'Standalone garage slab'};
 input.specifications.slab={status:'included',specification:{
  material:c(poured),extent:c({kind:'independent',points:input.trace.vertices.map(v=>v.point)}),
  thicknessFt:c(.5),baseFt:c(0),footingRelation:c(assemblySource),
  elevationReference:c({kind:'assembly',id:'garage'}),coverageBasis:c('fullFootprintEstimate'),
 }};
 input.specifications.insulation={status:'excluded',reason:'Not specified'};
 input.specifications.granular={status:'included',specification:{id:c('base'),material:c({kind:'catalogue',category:'granular',id:'clear crushed stone'}),thicknessFt:c(.25)}};
 const preview=previewAssemblyChange(doc,'foundation','garage',null,{kind:'create',input},id);
 assert.deepEqual(preview.conflicts,[]);
 expectVolume(assemblyWallVolume(preview,'foundation.slab.concrete'),1200*.5/27);
 expectVolume(assemblyWallVolume(preview,'foundation.granular.volume'),1200*.25/27);
 assert.equal(preview.quantities.after.length,2);
 assert.match(preview.quantities.after.find(row=>row.code==='foundation.granular.volume')!.basis,/Estimated full slab footprint/);
 const saved=applyAssemblyPreview(doc,preview);
 assert.deepEqual(deserializeProjectDocument(serializeProjectDocument(saved)),saved);
});

test('closed independent wall loop adopts exactly once with preserved scope and identities',()=>{
 const {doc,id}=assemblyFixture();
 const outline=[{x:0,y:0},{x:40,y:0},{x:40,y:30},{x:0,y:30}];
 const walls=generateOrthogonalFoundationPerimeter(outline,'centreline',1,8,0,id).map(w=>{
  const {perimeterReference:_perimeter,...foundation}=w.foundation!;
  return {...w,foundation};
 });
 const selected=walls.map(w=>w.id);
 const existing=replaceSpecialistEntities(doc,'foundation',walls);
 assert.throws(()=>independentWallLoop(walls,selected.slice(1)),/Select at least four/);
 assert.throws(()=>independentWallLoop(walls.map((w,i)=>i===1?{...w,widthFt:2}:w),selected),/dimensions or elevation references differ/);
 const {input,bindings}=independentWallLoop(walls,selected);
 const result=previewAssemblyChange(existing,'foundation','adopted-loop',null,{kind:'adopt',input,bindings,source:assemblySource},id);
 assert.deepEqual(result.conflicts,[]);
 assert.deepEqual(result.changes?.measurements.map(w=>[w.id,w.physicalId,w.scopeApplicability]),walls.map(w=>[w.id,w.physicalId,w.scopeApplicability]));
 assert.equal(result.quantities.before.length,result.quantities.after.length);
 const wallTotal=(rows:typeof result.quantities.before)=>rows.reduce((sum,row)=>sum+(row.status==='measured'?row.quantity:0),0);
 expectVolume(wallTotal(result.quantities.after),wallTotal(result.quantities.before));
});
