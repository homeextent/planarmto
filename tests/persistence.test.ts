import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createProjectDocument, workspaceFloorplan } from '../src/engine/projectDocument';
import { createBlankProject } from '../src/engine/samplePlans';
import { getSavedProjects, saveProjectToDirectory, saveAutoSaveState, getAutoSaveState, getHistoricalAutoSaveRaw, deleteProjectFromDirectory } from '../src/utils/storage';

const directoryKey = 'PLANAR_MTO_PROJECTS_LIST';
const payloadKey = 'PLANAR_MTO_PROJECT_test-pdf';
const autoKey = 'planarmto_autosave_state_v3';
const originalFetch = globalThis.fetch;
const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
const storageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
const values = new Map<string, string>();
let failKey: string | null = null;

function configureUser(currentUserId: number) {
  Object.defineProperty(globalThis, 'window', {
    configurable: true, value: {
      planarMTOConfig: { currentUserId, restUrl: 'https://example.invalid/wp-json/planarmto/v1/', nonce: 'synthetic' },
    },
  });
}
function historicalFixture() {
  return {
    ...createBlankProject(),
    activeProjectId: 'test-pdf',
    activeProjectName: 'Synthetic PDF project',
    underlay: {
      src: 'data:image/png;base64,synthetic',
      worldX: 7, worldY: -3, feetPerPixel: .0125, opacity: .5,
      isLocked: true, isVisible: true,
      pdfSource: { filename: 'synthetic.pdf', page: 2, width: 5000, height: 3235 },
    },
  };
}
function fixture() {
  const original = historicalFixture();
  const doc = createProjectDocument(createBlankProject(), 'floor');
  doc.activeProjectId = original.activeProjectId;
  doc.activeProjectName = original.activeProjectName;
  doc.workspaces[0].geometry.underlay = original.underlay;
  return doc;
}
function restore(name: string, descriptor: PropertyDescriptor | undefined) {
  if (descriptor) Object.defineProperty(globalThis, name, descriptor);
  else Reflect.deleteProperty(globalThis, name);
}
beforeEach(() => {
  values.clear();
  failKey = null;
  configureUser(0);
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (key === failKey) throw new DOMException('Synthetic quota exceeded', 'QuotaExceededError');
      values.set(key, value);
    },
    removeItem: (key: string) => values.delete(key),
  }});
  globalThis.fetch = async () => { throw new Error('Unexpected network call'); };
});
afterEach(() => {
  restore('window', windowDescriptor);
  restore('localStorage', storageDescriptor);
  globalThis.fetch = originalFetch;
});

test('guest project round trip preserves PDF calibration and source metadata', async () => {
  const state = fixture();
  await saveProjectToDirectory(state.activeProjectName, state);
  const projects = await getSavedProjects();
  assert.equal(projects.length, 1);
  assert.deepEqual(workspaceFloorplan(projects[0].state as ReturnType<typeof fixture>).underlay, workspaceFloorplan(state).underlay);
  assert.equal(JSON.parse(values.get(directoryKey)!)[0].state, undefined);
});

test('local payload quota failure rejects without changing previous save', async () => {
  const state = fixture();
  await saveProjectToDirectory('Original', state);
  const prior = values.get(payloadKey);
  failKey = payloadKey;
  await assert.rejects(saveProjectToDirectory('Updated', state), /Unable to save project/);
  assert.equal(values.get(payloadKey), prior);
});

test('directory index failure restores previous payload', async () => {
  const state = fixture();
  await saveProjectToDirectory('Original', state);
  const prior = values.get(payloadKey);
  const index = values.get(directoryKey);
  failKey = directoryKey;
  await assert.rejects(saveProjectToDirectory('Updated', state), /Unable to update the project directory/);
  assert.equal(values.get(payloadKey), prior);
  assert.equal(values.get(directoryKey), index);
});

test('failed first directory write removes newly created orphan payload', async () => {
  failKey = directoryKey;
  await assert.rejects(saveProjectToDirectory('New', fixture()), /Unable to update/);
  assert.equal(values.has(payloadKey), false);
});

test('autosave quota failure is explicit and previous recovery survives', () => {
  const state = fixture();
  saveAutoSaveState(state);
  failKey = autoKey;
  assert.throws(() => saveAutoSaveState({ ...state, activeProjectName: 'Updated' }), /Automatic recovery/);
  assert.equal(getAutoSaveState()?.state.activeProjectName, state.activeProjectName);
});

test('authenticated server failure never falls back to local project storage', async () => {
  configureUser(12);
  globalThis.fetch = async (_url,options) => options?.method === 'POST' ? new Response(JSON.stringify({ message: 'Synthetic database failure' }), { status: 500 }) : new Response('[]');
  await assert.rejects(saveProjectToDirectory('Test', fixture()), /Synthetic database failure/);
  assert.equal(values.size, 0);
});

test('authenticated save rejects missing acknowledgement', async () => {
  configureUser(12);
  globalThis.fetch = async (_url,options) => options?.method === 'POST' ? new Response(JSON.stringify({ success: false }), { status: 200 }) : new Response('[]');
  await assert.rejects(saveProjectToDirectory('Test', fixture()), /did not confirm/);
  assert.equal(values.size, 0);
});

test('authenticated save and reload preserve PDF data without duplicate src/url', async () => {
  configureUser(12);
  const state = fixture();
  let saved: any;
  globalThis.fetch = async (url, options) => {
    assert.equal(String(url), 'https://example.invalid/wp-json/planarmto/v1/projects');
    if (options?.method === 'POST') {
      saved = JSON.parse(String(options.body));
      assert.equal(saved.id, state.activeProjectId);
      assert.deepEqual(workspaceFloorplan(saved.state).underlay, workspaceFloorplan(state).underlay);
      return new Response(JSON.stringify({ success: true }));
    }
    return new Response(JSON.stringify(saved ? [saved] : []));
  };
  await saveProjectToDirectory('Test', state);
  const [project] = await getSavedProjects();
  assert.deepEqual(workspaceFloorplan(project.state as ReturnType<typeof fixture>).underlay, workspaceFloorplan(state).underlay);
  assert.equal(values.size, 0);
});

test('typed project persists all workspaces and independent copies', async () => {
  const { normalizeProjectInput, addWorkspace, updateWorkspaceView } = await import('../src/engine/workspaceController');
  const { workspaceFloorplan } = await import('../src/engine/projectDocument');
  let doc = normalizeProjectInput(fixture());
  doc = addWorkspace(doc,'roof','Roof','roof');
  const view = workspaceFloorplan(doc);
  view.underlay = { ...workspaceFloorplan(fixture()).underlay, feetPerPixel: .025 };
  doc = updateWorkspaceView(doc,'roof',view);
  const saved = await saveProjectToDirectory('Original',doc);
  const copy = await saveProjectToDirectory('Copy',doc,{id:'copy'});
  assert.equal(saved.estimatedTotal,0);
  assert.notEqual(saved.id,copy.id);
  const projects = await getSavedProjects();
  assert.equal(projects.length,2);
  for(const p of projects) {
    assert.equal('schemaVersion' in p.state,true);
    const restored = normalizeProjectInput(p.state);
    assert.equal(restored.workspaces.length,2);
    assert.equal(workspaceFloorplan(restored,'roof').underlay?.feetPerPixel,.025);
    assert.equal(restored.activeProjectId,String(p.id));
  }
  saveAutoSaveState(doc);
  assert.deepEqual(getAutoSaveState()?.state,doc);
  assert.ok(JSON.parse(values.get(directoryKey)!).every((p:any)=>!p.state));
});
test('typed authenticated project round trip retains all workspaces', async () => {
  const { normalizeProjectInput, addWorkspace } = await import('../src/engine/workspaceController');
  configureUser(12);
  const doc = addWorkspace(normalizeProjectInput(fixture()),'roof','Roof','roof');
  let saved:any;
  globalThis.fetch = async (_url,options) => {
    if(options?.method==='POST') {
      saved=JSON.parse(String(options.body));
      return new Response(JSON.stringify({success:true}));
    }
    return new Response(JSON.stringify(saved ? [saved] : []));
  };
  await saveProjectToDirectory('Original',doc);
  const [restored] = await getSavedProjects();
  assert.deepEqual(restored.state,{...doc,activeProjectName:'Original'});
  assert.equal(values.size,0);
});
test('unreadable directory cannot silently overwrite existing records', async () => {
  values.set(directoryKey,'invalid JSON');
  await assert.rejects(saveProjectToDirectory('Test',fixture()),/Unable to read saved projects directory/);
  assert.equal(values.get(directoryKey),'invalid JSON');
  assert.equal(values.has(payloadKey),false);
});
test('authenticated directory read failure does not fall back to guest data', async () => {
  configureUser(12);
  globalThis.fetch = async () => new Response(JSON.stringify({message:'Denied'}),{status:403});
  await assert.rejects(getSavedProjects(),/Unable to read authenticated projects/);
});

test('typed recovery rejects invalid geometry without replacing previous valid draft', async () => {
  const { normalizeProjectInput, addWorkspace } = await import('../src/engine/workspaceController');
  const { workspaceRenderView, commitWorkspaceRenderView } = await import('../src/engine/projectDocument');
  const doc = addWorkspace(normalizeProjectInput(fixture()),'roof','Roof','roof');
  saveAutoSaveState(doc);
  const previous = values.get(autoKey);
  const view = workspaceRenderView(doc);
  const invalid = commitWorkspaceRenderView(doc,'roof',{...view,nodes:[{id:'bad',x:NaN,y:0}]},false);
  assert.throws(()=>saveAutoSaveState(invalid),/Automatic recovery/);
  assert.equal(values.get(autoKey),previous);
  assert.deepEqual(getAutoSaveState()?.state,doc);
});
test('typed recovery quota failure preserves previous complete multi-workspace document', async () => {
  const { normalizeProjectInput, addWorkspace } = await import('../src/engine/workspaceController');
  const doc = addWorkspace(normalizeProjectInput(fixture()),'roof','Roof','roof');
  saveAutoSaveState(doc);
  const previous = values.get(autoKey);
  failKey = autoKey;
  assert.throws(()=>saveAutoSaveState({...doc,activeProjectName:'Changed'}),/Automatic recovery/);
  assert.equal(values.get(autoKey),previous);
  assert.deepEqual(getAutoSaveState()?.state,doc);
});

test('retired inline historical records survive new saves without rewriting their contents', async () => {
  const old = {id:'old',name:'Archived',state:historicalFixture(),updatedAt:1,createdAt:1};
  values.set(directoryKey,JSON.stringify([old]));
  await saveProjectToDirectory('New',fixture());
  const [archived] = (await getSavedProjects()).filter(p=>p.id==='old');
  assert.deepEqual(archived.state,old.state);
  assert.deepEqual(JSON.parse(values.get(directoryKey)!).find((p:any)=>p.id==='old'),old);
  await assert.rejects(saveProjectToDirectory('Overwrite',fixture(),{id:'old'}),/Historical project/);
  await assert.rejects(saveProjectToDirectory('Old',historicalFixture()),/historical projects are retired/);
});
test('historical recovery survives active v3 recovery writes', () => {
  const raw=JSON.stringify({timestamp:1,state:historicalFixture()});
  values.set('planarmto_autosave_state_v1',raw);
  saveAutoSaveState(fixture());
  assert.equal(getHistoricalAutoSaveRaw(),raw);
  assert.equal(getAutoSaveState()?.state.activeProjectId,'test-pdf');
});

test('saving and deleting other projects preserves raw historical index even with stale separate payload', async () => {
 const old={id:'old',name:'Archived',state:historicalFixture(),createdAt:1,updatedAt:1};
 values.set(directoryKey,JSON.stringify([old]));
 values.set('PLANAR_MTO_PROJECT_old',JSON.stringify({...old,name:'Stale payload'}));
 await saveProjectToDirectory('New',fixture());
 assert.deepEqual(JSON.parse(values.get(directoryKey)!).find((p:any)=>p.id==='old'),old);
 failKey=directoryKey;
 await assert.rejects(deleteProjectFromDirectory('test-pdf'));
 assert.ok(values.has(payloadKey));
 failKey=null;
 await deleteProjectFromDirectory('test-pdf');
 assert.deepEqual(JSON.parse(values.get(directoryKey)!),[old]);
});
