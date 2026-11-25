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
