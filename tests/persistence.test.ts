import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createBlankProject } from '../src/engine/samplePlans';
import { getSavedProjects, saveProjectToDirectory, saveAutoSaveState, getAutoSaveState } from '../src/utils/storage';

const directoryKey = 'PLANAR_MTO_PROJECTS_LIST';
const payloadKey = 'PLANAR_MTO_PROJECT_test-pdf';
const autoKey = 'planarmto_autosave_state_v1';
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
function fixture() {
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
  assert.deepEqual(projects[0].state.underlay, state.underlay);
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
  globalThis.fetch = async () => new Response(JSON.stringify({ message: 'Synthetic database failure' }), { status: 500 });
  await assert.rejects(saveProjectToDirectory('Test', fixture()), /Synthetic database failure/);
  assert.equal(values.size, 0);
});

test('authenticated save rejects missing acknowledgement', async () => {
  configureUser(12);
  globalThis.fetch = async () => new Response(JSON.stringify({ success: false }), { status: 200 });
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
      assert.deepEqual(saved.state.underlay, state.underlay);
      return new Response(JSON.stringify({ success: true }));
    }
    return new Response(JSON.stringify([saved]));
  };
  await saveProjectToDirectory('Test', state);
  const [project] = await getSavedProjects();
  assert.deepEqual(project.state.underlay, state.underlay);
  assert.equal(values.size, 0);
});
