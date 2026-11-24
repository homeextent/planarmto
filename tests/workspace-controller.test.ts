import test from 'node:test';
import assert from 'node:assert/strict';
import { createBlankProject } from '../src/engine/samplePlans';
import { createProjectDocument, workspaceFloorplan, workspaceRenderView, commitWorkspaceRenderView, deserializeProjectDocument, serializeProjectDocument } from '../src/engine/projectDocument';
import { addWorkspace, selectWorkspace, renameWorkspace, moveWorkspace, removeWorkspace, updateWorkspaceView, normalizeProjectInput, canReportLegacyEstimate, validateProjectBudget, validateBlueprintBudget } from '../src/engine/workspaceController';

const fresh = () => createProjectDocument(createBlankProject(), 'floor');
const blueprint = (size = 100, scale = .01) => ({ src: 'data:image/png;base64,' + 'a'.repeat(size), worldX: 2, worldY: 3, feetPerPixel: scale, opacity: .5, isVisible: true, isLocked: false });
test('workspace lifecycle maintains stable identity and order', () => {
  let doc = addWorkspace(fresh(), 'roof', 'Roof', 'roof');
  doc = addWorkspace(doc, 'site', 'Site', 'site');
  doc = renameWorkspace(doc, 'roof', 'Upper Roof');
  doc = moveWorkspace(doc, 'roof', -1);
  assert.deepEqual(doc.workspaces.map(w => w.id), ['roof','floor','site']);
  assert.equal(doc.workspaces[0].name, 'Upper Roof');
  doc = selectWorkspace(doc, 'roof');
  doc = removeWorkspace(doc, 'roof');
  assert.equal(doc.activeWorkspaceId, 'floor');
  assert.throws(() => removeWorkspace(fresh(), 'floor'), /At least one/);
  assert.throws(() => addWorkspace(doc,'floor','Duplicate','floor'), /Duplicate/);
});
test('independent underlays and geometry survive selection and serialization', () => {
  let doc = addWorkspace(fresh(), 'upper', 'Upper', 'floor');
  let view = workspaceFloorplan(doc,'floor');
  view.nodes.push({id:'n',x:1,y:2}); view.underlay = blueprint(100,.0125);
  doc = updateWorkspaceView(doc,'floor',view);
  view = workspaceFloorplan(doc,'upper');
  view.nodes.push({id:'n',x:5,y:6}); view.underlay = blueprint(100,.05);
  view.settings.profitPercentage = 18;
  doc = updateWorkspaceView(doc,'upper',view);
  const restored = deserializeProjectDocument(validateProjectBudget(doc));
  assert.equal(workspaceFloorplan(restored,'floor').nodes[0].x,1);
  assert.equal(workspaceFloorplan(restored,'upper').nodes[0].x,5);
  assert.equal(workspaceFloorplan(restored,'floor').underlay?.feetPerPixel,.0125);
  assert.equal(workspaceFloorplan(restored,'upper').underlay?.feetPerPixel,.05);
  assert.equal(workspaceFloorplan(restored,'floor').settings.profitPercentage,18);
});
test('legacy aliases migrate and incomplete estimating modes remain gated', () => {
  const legacy = {...createBlankProject(),underlay:{url:'data:image/png;base64,test',x:3,y:4,scale:20}};
  const doc = normalizeProjectInput(legacy);
  assert.equal(workspaceFloorplan(doc).underlay?.feetPerPixel,.05);
  assert.equal(workspaceFloorplan(doc).underlay?.worldX,3);
  assert.equal(canReportLegacyEstimate(doc),true);
  const expanded = addWorkspace(doc,'roof','Roof','roof');
  assert.equal(canReportLegacyEstimate(expanded),false);
  assert.equal(canReportLegacyEstimate(fresh()),false);
  assert.throws(() => removeWorkspace(expanded,doc.activeWorkspaceId),/Legacy calculation owner/);
  assert.throws(() => normalizeProjectInput({...legacy,settings:'bad'}),/Invalid legacy settings/);
});
test('complete-project budget accepts three 800KB rasters and rejects overflow', () => {
  let doc = fresh();
  for (let i=0;i<5;i++) {
    const id = i===0?'floor':'level-'+i;
    if (i>0) doc=addWorkspace(doc,id,id,'floor');
    const view=workspaceFloorplan(doc,id);
    view.underlay=blueprint(800000);
    if(i<4) { validateBlueprintBudget(doc,id,view); doc=updateWorkspaceView(doc,id,view); }
    else assert.throws(()=>validateBlueprintBudget(doc,id,view),/Complete project exceeds/);
  }
  const large=workspaceFloorplan(doc); large.underlay=blueprint(850001);
  assert.throws(()=>validateBlueprintBudget(doc,doc.activeWorkspaceId,large),/Blueprint exceeds/);
});

test('interactive edits retain inactive workspace and unchanged collection references', () => {
  const doc = addWorkspace(fresh(), 'upper', 'Upper', 'floor');
  const view = workspaceRenderView(doc);
  const next = commitWorkspaceRenderView(doc,'upper',{...view,nodes:[{id:'n',x:2,y:3}]},false);
  assert.equal(next.workspaces[0],doc.workspaces[0]);
  assert.equal(next.workspaces[1].geometry.walls,view.walls);
  assert.equal(next.settings,doc.settings);
  assert.equal(doc.workspaces[1].geometry.nodes.length,0);
  assert.equal(next.workspaces[1].geometry.nodes.length,1);
  const finished = commitWorkspaceRenderView(next,'upper',workspaceRenderView(next));
  assert.deepEqual(deserializeProjectDocument(serializeProjectDocument(finished)),finished);
  assert.throws(()=>commitWorkspaceRenderView(next,'floor',view),/inactive workspace/);
});
test('transient invalid geometry cannot cross commit or persistence boundary', () => {
  const doc = fresh();
  const view = workspaceRenderView(doc);
  const invalid = {...view,nodes:[{id:'bad',x:NaN,y:0}]};
  const transient = commitWorkspaceRenderView(doc,'floor',invalid,false);
  assert.throws(()=>commitWorkspaceRenderView(transient,'floor',invalid),/invalid node coordinates/);
  assert.throws(()=>serializeProjectDocument(transient),/invalid node coordinates/);
  assert.throws(()=>commitWorkspaceRenderView(doc,'floor',{...view,settings:{...view.settings,profitPercentage:NaN}}),/invalid setting/);
  assert.throws(()=>commitWorkspaceRenderView(doc,'floor',{...view,activeProjectId:'other'}),/different project/);
});
test('shared settings and rates follow workspace selection while detached views remain isolated', () => {
  const doc = addWorkspace(fresh(),'roof','Roof','roof');
  const view = workspaceRenderView(doc);
  const rates = {...view.settings.costRates, syntheticRate: 42} as NonNullable<typeof view.settings.costRates>;
  const next = commitWorkspaceRenderView(doc,'roof',{...view,settings:{...view.settings,profitPercentage:19,costRates:rates}});
  const floor = workspaceRenderView(selectWorkspace(next,'floor'));
  assert.equal(floor.settings.profitPercentage,19);
  assert.equal(floor.settings.costRates,rates);
  assert.notEqual(workspaceFloorplan(next,'floor').settings,next.settings);
  assert.notEqual(doc.settings,next.settings);
  assert.equal(canReportLegacyEstimate(next),false);
});
