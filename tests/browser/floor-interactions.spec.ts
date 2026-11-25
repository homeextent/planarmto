import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import type { ProjectDocument } from '../../src/engine/projectDocument';

async function snapshot(page: Page): Promise<ProjectDocument> {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTitle('Save Project JSON', {exact:true}).click(),
  ]);
  const path = await download.path();
  if (!path) throw Error('Project download missing');
  return JSON.parse(await readFile(path,'utf8'));
}
const floor = (doc: ProjectDocument) => doc.workspaces.find(w=>w.type==='floor')!.geometry;
async function click(page:Page,x:number,y:number) {
  await page.locator('canvas').first().click({position:{x,y}});
}
async function exact(page:Page,value:string) {
  await page.keyboard.type(value);
  await page.keyboard.press('Enter');
}
function lengths(doc:ProjectDocument) {
  const g=floor(doc);
  return g.walls.map(w=>{
    const a=g.nodes.find(n=>n.id===w.startNodeId)!;
    const b=g.nodes.find(n=>n.id===w.endNodeId)!;
    return Math.hypot(a.x-b.x,a.y-b.y);
  });
}
const errors=new WeakMap<Page,string[]>();
test.beforeEach(async ({page})=>{
  const messages:string[]=[];
  errors.set(page,messages);
  page.on('pageerror',e=>messages.push(e.message));
  await page.goto('/');
  await expect(page.locator('canvas').first()).toBeVisible();
});
test.afterEach(async ({page})=>expect(errors.get(page)||[]).toEqual([]));

test('wall first anchor is transient and exact correction is one history entry',async ({page})=>{
  await page.getByRole('button',{name:'Wall Pen (Continuous)',exact:true}).click();
  await click(page,250,250);
  const initial=await snapshot(page);
  expect(floor(initial).nodes).toHaveLength(0);
  expect(floor(initial).walls).toHaveLength(0);
  await click(page,490,250);
  await exact(page,'12');
  await exact(page,'15');
  const placed=await snapshot(page);
  expect(floor(placed).nodes).toHaveLength(2);
  // CI #80: Math.hypot returned 14.999999999999998 for 15 ft.
  // Preserve wall cardinality and verify canonical feet to six decimal places.
  expect(floor(placed).walls).toHaveLength(1);
  expect(lengths(placed)[0]).toBeCloseTo(15,6);
  await page.getByTitle('Undo (Ctrl+Z)',{exact:true}).click();
  expect(floor(await snapshot(page)).nodes).toHaveLength(0);
  await page.getByTitle('Redo (Ctrl+Y)',{exact:true}).click();
  expect(floor(await snapshot(page))).toEqual(floor(placed));
});

test('continuous wall begins at corrected endpoint',async ({page})=>{
  await page.getByRole('button',{name:'Wall Pen (Continuous)',exact:true}).click();
  await click(page,250,250);
  await click(page,490,250);
  await exact(page,'15');
  await click(page,610,490);
  await exact(page,'10');
  const doc=await snapshot(page),g=floor(doc);
  expect(g.walls).toHaveLength(2);
  expect(g.nodes).toHaveLength(3);
  expect(g.walls[1].startNodeId).toEqual(g.walls[0].endNodeId);
  expect(lengths(doc)[0]).toBeCloseTo(15,6);
  expect(lengths(doc)[1]).toBeCloseTo(10,6);
});

test('room box exact correction preserves four-wall topology and undo',async ({page})=>{
  await page.getByRole('button',{name:'4-Wall Room Box',exact:true}).click();
  await click(page,250,250);
  await click(page,490,490);
  await exact(page,'20,15');
  const doc=await snapshot(page),g=floor(doc);
  expect(g.nodes).toHaveLength(4);
  expect(g.walls).toHaveLength(4);
  expect(g.rooms).toHaveLength(1);
  const ls=lengths(doc).sort((a,b)=>a-b);
  // Interior/exterior justification shifts both axes by the same wall thickness.
  expect(ls[3]-ls[0]).toBeCloseTo(5,6);
  expect(ls[0]).toBeCloseTo(ls[1],6);
  expect(ls[2]).toBeCloseTo(ls[3],6);
  expect(Math.abs(ls[0]-15)).toBeLessThan(2);
  await page.getByTitle('Undo (Ctrl+Z)',{exact:true}).click();
  expect(floor(await snapshot(page)).walls).toHaveLength(0);
});

for(const [mode,sign] of [['interior_face',1],['centerline',0],['exterior_face',-1]] as const){
  test('room dimensions respect '+mode,async ({page})=>{
    await page.getByTitle('Global Project & Engine Settings',{exact:true}).click();
    await page.locator('#select-wall-justification').selectOption(mode);
    await page.locator('#save-settings-button').click();
    await page.getByRole('button',{name:'4-Wall Room Box',exact:true}).click();
    await click(page,250,250);
    await click(page,490,490);
    await exact(page,'20,15');
    const doc=await snapshot(page),g=floor(doc);
    expect(doc.settings.wallJustification).toBe(mode);
    expect(g.nodes).toHaveLength(4);
    expect(g.walls).toHaveLength(4);
    expect(g.rooms).toHaveLength(1);
    const t=Math.abs(g.walls[0].thickness-3.5/12)<0.001?4.5/12:g.walls[0].thickness;
    const ls=lengths(doc).sort((a,b)=>a-b);
    for(const n of ls.slice(0,2))expect(n).toBeCloseTo(15+sign*t,6);
    for(const n of ls.slice(2))expect(n).toBeCloseTo(20+sign*t,6);
  });
}

test('connected wall correction refuses to detach the existing endpoint',async ({page})=>{
  await page.getByRole('button',{name:'Wall Pen (Continuous)',exact:true}).click();
  await click(page,250,250);
  await click(page,490,250);
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Wall Pen (Continuous)',exact:true}).click();
  await click(page,490,490);
  await click(page,490,250);
  const before=await snapshot(page);
  expect(floor(before).walls).toHaveLength(2);
  expect(floor(before).nodes).toHaveLength(3);
  // Export focuses a header button; explicitly use the persistent dimension field.
  await page.getByLabel('Dimensions',{exact:true}).fill('20');
  await page.getByLabel('Dimensions',{exact:true}).press('Enter');
  await expect(page.getByRole('alert').filter({hasText:/connected geometry/i})).toBeVisible();
  expect(floor(await snapshot(page))).toEqual(floor(before));
});
