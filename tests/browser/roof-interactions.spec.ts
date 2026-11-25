import { test, expect, type Page } from '@playwright/test';
import {readFile} from 'node:fs/promises';
import type {ProjectDocument} from '../../src/engine/projectDocument';
import type {RoofEntity} from '../../src/engine/measurements/measurementTypes';

async function roofWorkspace(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: '+ Add workspace', exact: true }).click();
  await page.getByLabel('Workspace type').selectOption('roof');
  await page.getByLabel('New workspace name').fill('Synthetic roof');
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Roof tools' })).toBeVisible();
}
async function clickCanvas(page: Page, x: number, y: number) {
  const canvas = page.locator('canvas').first();
  await canvas.click({ position: { x, y } });
}
async function dimensions(page: Page, value: string) {
  await page.keyboard.type(value);
  await page.keyboard.press('Enter');
}
async function rectangle(page: Page) {
  await page.getByRole('button', { name: 'Roof plane', exact: true }).click();
  await clickCanvas(page, 250, 250);
  await clickCanvas(page, 550, 450);
}
const entities = (page: Page) => page.getByLabel('Select roof entity').locator('option');
async function area(page: Page, expected: string) {
  await expect(page.getByText('Projected polygon: ' + expected + ' SF', { exact: true })).toBeVisible();
}

const runtimeErrors = new WeakMap<Page, string[]>();
test.beforeEach(async ({page}) => {
  const errors: string[] = [];
  runtimeErrors.set(page, errors);
  page.on('pageerror', e => errors.push(e.message));
  await roofWorkspace(page);
});
test.afterEach(async ({page}) => { expect(runtimeErrors.get(page) || []).toEqual([]); });

test('rectangle keyboard correction, repeated correction and one undo transaction', async ({page}) => {
  await rectangle(page);
  await dimensions(page,'40,30');
  await area(page,'1200.00');
  await expect(page.getByLabel('Projected width (ft)')).toHaveValue('40');
  await dimensions(page,'40,20');
  await area(page,'800.00');
  await page.getByTitle('Undo (Ctrl+Z)', {exact:true}).click();
  await expect(entities(page)).toHaveCount(1);
  await page.getByTitle('Redo (Ctrl+Y)', {exact:true}).click();
  await expect(entities(page)).toHaveCount(2);
  await page.getByLabel('Select roof entity').selectOption({index:1});
  await area(page,'800.00');
});

test('polygon closes at the first draft vertex without adding duplicate vertex', async ({page}) => {
  await page.getByRole('button', {name:'Roof plane',exact:true}).click();
  await page.getByLabel('Roof drawing mode').selectOption('polygon');
  await clickCanvas(page,250,250);
  await clickCanvas(page,490,250);
  await clickCanvas(page,490,490);
  await clickCanvas(page,250,490);
  await clickCanvas(page,250,250);
  await expect(entities(page), 'Closure diagnostic: '+await page.getByRole('alert').allTextContents()).toHaveCount(2);
  await expect(page.getByText(/Projected polygon:/)).toBeVisible();
});

test('invalid bow-tie polygon retains draft and actionable diagnostic', async ({page}) => {
  await page.getByRole('button',{name:'Roof plane',exact:true}).click();
  await page.getByLabel('Roof drawing mode').selectOption('polygon');
  // Use an orthogonal self-crossing path so no preference toggle is needed.
  await clickCanvas(page,250,250);
  await clickCanvas(page,550,250);
  await clickCanvas(page,550,450);
  await clickCanvas(page,350,450);
  await clickCanvas(page,350,150);
  await clickCanvas(page,650,150);
  await page.getByRole('button',{name:'Finish polygon',exact:true}).click();
  await expect(page.getByRole('alert').filter({hasText:/edge|cross|polygon/i})).toBeVisible();
  await expect(entities(page)).toHaveCount(1);
  await expect(page.getByRole('button',{name:'Finish polygon',exact:true})).toBeVisible();
});

test('selected rectangle generation preview, cancel and atomic replacement', async ({page}) => {
  await rectangle(page);
  await dimensions(page,'40,30');
  await page.getByRole('button',{name:'6:12',exact:true}).click();
  const generator=page.getByRole('button',{name:'Generate roof skeleton',exact:true});
  await generator.click();
  const panel=page.locator('section').filter({has:page.getByRole('heading',{name:'Generate Roof Skeleton',exact:true})});
  await expect(panel).toBeVisible();
  await panel.getByRole('button',{name:'Preview',exact:true}).click();
  await expect(panel.getByRole('button',{name:'Apply',exact:true})).toBeEnabled();
  await expect(entities(page)).toHaveCount(2);
  await panel.getByRole('button',{name:'Cancel',exact:true}).click();
  await expect(entities(page)).toHaveCount(2);
  await page.getByLabel('Select roof entity').selectOption({index:1});
  await generator.click();
  await panel.getByRole('button',{name:'Preview',exact:true}).click();
  await panel.getByRole('button',{name:'Apply',exact:true}).click();
  // Four planes, nine edges, plus the empty selector option.
  await expect(entities(page)).toHaveCount(14);
  await page.getByTitle('Undo (Ctrl+Z)',{exact:true}).click();
  await expect(entities(page)).toHaveCount(2);
});

test('roof workspace geometry stays independent when switching to floor and back', async ({page}) => {
  await rectangle(page);
  await dimensions(page,'40,30');
  const group=page.getByRole('group',{name:'Select workspace'});
  await group.getByRole('button',{name:/· Floor$/}).first().click();
  await expect(page.getByRole('heading',{name:'Roof tools'})).toHaveCount(0);
  await group.getByRole('button',{name:/Synthetic roof/}).click();
  await expect(entities(page)).toHaveCount(2);
  await page.getByLabel('Select roof entity').selectOption({index:1});
  await area(page,'1200.00');
});

test('imperial fractional dimensions preserve exact canonical area', async ({page}) => {
  await rectangle(page);
  await dimensions(page, "20' 6\",10'");
  await area(page,'205.00');
});

test('metric keyboard dimensions are converted to canonical feet', async ({page}) => {
  await page.getByRole('button',{name:'Metric (m)',exact:true}).click();
  await rectangle(page);
  await dimensions(page,'12.192,9.144');
  await area(page,'1200.00');
});

test('opening outside its selected parent cannot commit', async ({page}) => {
  await rectangle(page);
  await page.getByRole('button',{name:'Roof opening',exact:true}).click();
  await clickCanvas(page,600,500);
  await clickCanvas(page,680,580);
  await expect(page.getByRole('alert').filter({hasText:/contain|outside|parent|boundary|within/i})).toBeVisible();
  await expect(entities(page)).toHaveCount(2);
});

test('selected plane with a dependent classified boundary cannot be silently replaced', async ({page}) => {
  await rectangle(page);
  await page.getByRole('button',{name:'6:12',exact:true}).click();
  await page.getByRole('button',{name:'Classify edge',exact:true}).click();
  await clickCanvas(page,400,250);
  await expect(entities(page)).toHaveCount(3);
  await page.getByLabel('Select roof entity').selectOption({index:1});
  await page.getByRole('button',{name:'Generate roof skeleton',exact:true}).click();
  await expect(page.getByRole('alert').filter({hasText:/depend|edge|reference|replace/i})).toBeVisible();
  await expect(entities(page)).toHaveCount(3);
});

async function roofSnapshot(page:Page):Promise<ProjectDocument>{
  const [download]=await Promise.all([page.waitForEvent('download'),page.getByTitle('Save Project JSON',{exact:true}).click()]);
  const path=await download.path();
  if(!path)throw Error('Missing JSON download');
  return JSON.parse(await readFile(path,'utf8'));
}
const roofOf=(doc:ProjectDocument)=>doc.workspaces.find(w=>w.type==='roof')!.measurements as RoofEntity[];

test('overlapping roof openings are rejected without changing existing geometry',async ({page})=>{
  await rectangle(page);
  await dimensions(page,'20,20');
  await page.getByRole('button',{name:'Roof opening',exact:true}).click();
  await clickCanvas(page,330,330);
  await clickCanvas(page,450,450);
  await expect(entities(page)).toHaveCount(3);
  const before=await roofSnapshot(page);
  await page.getByLabel('Select roof entity').selectOption({index:1});
  await page.getByRole('button',{name:'Roof opening',exact:true}).click();
  await clickCanvas(page,390,390);
  await clickCanvas(page,510,510);
  await expect(page.getByRole('alert').filter({hasText:/overlap/i})).toBeVisible();
  expect(roofOf(await roofSnapshot(page))).toEqual(roofOf(before));
});

for(const [type,orientation,planeCount] of [
  ['gable','horizontal',2],['gable','vertical',2],['shed','90',1],['flat','',1]
] as const){
  test('generator '+type+' '+orientation+' reconciles perimeter and pitch',async ({page})=>{
    await rectangle(page);
    await dimensions(page,'40,30');
    await page.getByRole('button',{name:'6:12',exact:true}).click();
    await page.getByRole('button',{name:'Generate roof skeleton',exact:true}).click();
    const panel=page.locator('section').filter({has:page.getByRole('heading',{name:'Generate Roof Skeleton',exact:true})});
    await panel.getByLabel('Configuration').selectOption(type);
    if(type==='gable')await panel.getByLabel('Ridge orientation').selectOption(orientation);
    if(type==='shed')await panel.getByLabel('Downslope direction').selectOption(orientation);
    await panel.getByRole('button',{name:'Preview',exact:true}).click();
    await expect(entities(page)).toHaveCount(2);
    await panel.getByRole('button',{name:'Apply',exact:true}).click();
    const roof=roofOf(await roofSnapshot(page));
    const planes=roof.filter(e=>e.kind==='roofPlane');
    const edges=roof.filter(e=>e.kind==='roofEdge');
    expect(planes).toHaveLength(planeCount);
    expect(edges).toHaveLength(type==='gable'?7:4);
    expect(planes.reduce((sum,p)=>sum+Math.abs(p.polygon.reduce((a,q,i)=>{const n=p.polygon[(i+1)%p.polygon.length];return a+q.x*n.y-n.x*q.y;},0))/2,0)).toBeCloseTo(1200,6);
    expect(planes.every(p=>p.pitchRise===(type==='flat'?0:6))).toBe(true);
    if(type==='gable'){
      const ridges=edges.filter(e=>e.edgeType==='ridge');
      expect(ridges).toHaveLength(1);
      expect(Math.hypot(ridges[0].start.x-ridges[0].end.x,ridges[0].start.y-ridges[0].end.y)).toBeCloseTo(orientation==='horizontal'?40:30,6);
    }
    if(type==='shed')expect(planes[0].slopeDegrees).toBe(90);
  });
}

test('schema v3 JSON round trip restores roof geometry and blocks consolidated reporting',async ({page})=>{
  await rectangle(page);
  await dimensions(page,'40,30');
  await page.getByRole('button',{name:'6:12',exact:true}).click();
  const original=await roofSnapshot(page);
  expect(original.schemaVersion).toBe(3);
  expect(roofOf(original)).toHaveLength(1);
  expect(roofOf(original)[0]).toMatchObject({kind:'roofPlane',pitchRise:6});
  // CI #83: pitch editing is a distinct history transaction (handleRoofChange).
  // Verify both undo boundaries before exercising the import.
  await page.getByTitle('Undo (Ctrl+Z)',{exact:true}).click();
  await expect(entities(page)).toHaveCount(2);
  expect(roofOf(await roofSnapshot(page))[0]).toMatchObject({kind:'roofPlane',pitchRise:null});
  await page.getByTitle('Undo (Ctrl+Z)',{exact:true}).click();
  await expect(entities(page)).toHaveCount(1);
  page.once('dialog',d=>d.accept());
  await page.locator('[title="Import JSON Project"] input[type=file]').setInputFiles({name:'synthetic.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(original))});
  await expect(entities(page)).toHaveCount(2);
  expect((await roofSnapshot(page)).workspaces).toEqual(original.workspaces);
  await expect(page.getByRole('status').filter({hasText:/consolidated pricing and reporting unavailable/i})).toBeVisible();
  const message=page.waitForEvent('dialog');
  const clicked=page.getByTitle('Print Floorplan & MTO Report (Ctrl+P)',{exact:true}).click();
  const dialog=await message;
  const text=dialog.message();
  await dialog.accept();
  await clicked;
  expect(text).toMatch(/estimate and print reporting are unavailable/i);
});

test('inspector keyboard focus does not hijack dimensional entry',async ({page})=>{
  await rectangle(page);
  await dimensions(page,'40,30');
  const source=page.getByLabel('Source reference');
  await source.click();
  await source.press('ControlOrMeta+a');
  await page.keyboard.type('Sheet A-102');
  await expect(source).toHaveValue('Sheet A-102');
  await expect(page.getByLabel('Dimensions',{exact:true})).toHaveValue('');
  await source.press('Tab');
  const doc=await roofSnapshot(page);
  expect(roofOf(doc)).toHaveLength(1);
  expect(roofOf(doc)[0].source.reference).toBe('Sheet A-102');
  await area(page,'1200.00');
});

for(const [dx,dy] of [[1,-1],[-1,1],[-1,-1]] as const){
  test('rectangle correction preserves anchor and quadrant '+dx+','+dy,async ({page})=>{
    await page.getByRole('button',{name:'Roof plane',exact:true}).click();
    await clickCanvas(page,400,350);
    await clickCanvas(page,400+dx*144,350+dy*144);
    const before=roofOf(await roofSnapshot(page))[0];
    if(before.kind!=='roofPlane')throw Error('Expected roof plane');
    const input=page.getByLabel('Dimensions',{exact:true});
    await input.fill('40,30');
    await input.press('Enter');
    const after=roofOf(await roofSnapshot(page))[0];
    if(after.kind!=='roofPlane')throw Error('Expected roof plane');
    expect(after.id).toBe(before.id);
    expect(after.polygon).toHaveLength(4);
    expect(after.polygon[0]).toEqual(before.polygon[0]);
    expect(after.polygon[2].x-after.polygon[0].x).toBeCloseTo(dx*40,6);
    expect(after.polygon[2].y-after.polygon[0].y).toBeCloseTo(dy*30,6);
    await area(page,'1200.00');
  });
}

test('manual concave orthogonal polygon closes without a duplicate vertex',async ({page})=>{
  await page.getByRole('button',{name:'Roof plane',exact:true}).click();
  await page.getByLabel('Roof drawing mode').selectOption('polygon');
  for(const [x,y] of [[250,250],[490,250],[490,370],[370,370],[370,490],[250,490],[250,250]])await clickCanvas(page,x,y);
  await expect(entities(page)).toHaveCount(2);
  const plane=roofOf(await roofSnapshot(page))[0];
  if(plane.kind!=='roofPlane')throw Error('Expected roof plane');
  expect(plane.polygon).toHaveLength(6);
  expect(new Set(plane.polygon.map(p=>p.x+','+p.y)).size).toBe(6);
  await area(page,'75.00');
});

test('Ortho diagonal closure requires explicit Finish polygon',async ({page})=>{
  // CI #87 established that the fresh workspace has Ortho disabled.
  // Explicitly enable the required test precondition using the actual UI.
  if(!(await roofSnapshot(page)).settings.orthoMode){
    await page.getByTitle('Ortho Mode (Lock 90° angles)',{exact:true}).click();
  }
  expect((await roofSnapshot(page)).settings.orthoMode).toBe(true);
  await page.getByRole('button',{name:'Roof plane',exact:true}).click();
  await page.getByLabel('Roof drawing mode').selectOption('polygon');
  for(const [x,y] of [[250,250],[490,250],[490,490],[250,250]])await clickCanvas(page,x,y);
  await expect(page.getByRole('alert').filter({hasText:/Closing edge is diagonal/})).toBeVisible();
  await expect(entities(page)).toHaveCount(1);
  await page.getByRole('button',{name:'Finish polygon',exact:true}).click();
  await expect(entities(page)).toHaveCount(2);
  const plane=roofOf(await roofSnapshot(page))[0];
  if(plane.kind!=='roofPlane')throw Error('Expected roof plane');
  expect(plane.polygon).toHaveLength(3);
  await area(page,'50.00');
});

test('R4 direct edge selection reports missing slope and does not duplicate existing edge',async ({page})=>{
  await rectangle(page);
  await page.getByRole('button',{name:'Classify edge',exact:true}).click();
  await clickCanvas(page,400,250);
  await expect(entities(page)).toHaveCount(3);
  await page.getByLabel('Classification',{exact:true}).selectOption('eave');
  await expect(page.getByText(/Projected edge length:.*LF/)).toBeVisible();
  await expect(page.getByText('Actual edge length: Not quantified',{exact:true})).toBeVisible();
  await expect(page.getByText('Roof plane 1: specify pitch',{exact:true})).toBeVisible();
  await page.getByLabel('Select roof entity').selectOption({index:1});
  await page.getByRole('button',{name:'6:12',exact:true}).click();
  await page.getByLabel('Select roof entity').selectOption({index:2});
  await expect(page.getByText('Roof plane 1: specify downslope direction',{exact:true})).toBeVisible();
  await page.getByLabel('Select roof entity').selectOption({index:1});
  await page.getByRole('button',{name:'Down 90°',exact:true}).click();
  await page.getByRole('button',{name:'Classify edge',exact:true}).click();
  await clickCanvas(page,400,250);
  await expect(entities(page)).toHaveCount(3);
  const roof=roofOf(await roofSnapshot(page));
  const edge=roof.find(e=>e.kind==='roofEdge')!;
  expect(edge.edgeType).toBe('eave');
  const length=Math.hypot(edge.end.x-edge.start.x,edge.end.y-edge.start.y);
  await expect(page.getByText('Actual edge length: '+length.toFixed(2)+' LF',{exact:true})).toBeVisible();
});

test('R4 irregular generator explains rectangular-only scope without mutating outline',async ({page})=>{
  await page.getByRole('button',{name:'Roof plane',exact:true}).click();
  await page.getByLabel('Roof drawing mode').selectOption('polygon');
  for(const [x,y] of [[250,250],[490,250],[490,370],[370,370],[370,490],[250,490],[250,250]])await clickCanvas(page,x,y);
  const before=roofOf(await roofSnapshot(page));
  await page.getByRole('button',{name:'Generate roof skeleton',exact:true}).click();
  await expect(page.getByRole('alert').filter({hasText:/Automatic roof skeleton generation requires a rectangular outline/})).toBeVisible();
  expect(roofOf(await roofSnapshot(page))).toEqual(before);
});

test('R4 manual insulation surface has contextual guidance and 1000 SF / 6000 BF',async ({page})=>{
  await page.getByRole('button',{name:'Insulation area',exact:true}).click();
  await expect(page.getByText(/Draw insulation surface.*Click first corner/)).toBeVisible();
  await clickCanvas(page,250,250);
  const canvas=page.locator('canvas').first();
  const bounds=await canvas.boundingBox();
  if(!bounds)throw Error('Canvas unavailable');
  await page.mouse.move(bounds.x+490,bounds.y+490);
  await expect(page.getByLabel('Live drafting dimensions')).toHaveText('Live: 10.00 × 10.00 ft');
  await clickCanvas(page,490,490);
  await dimensions(page,'40,25');
  await area(page,'1000.00');
  await page.getByLabel('Surface basis').selectOption('horizontal');
  await page.getByLabel('Insulation type').selectOption('closed cell foam');
  await page.getByLabel('Thickness (inches)').fill('6');
  await page.getByLabel('Thickness (inches)').press('Enter');
  await expect(page.getByText('1000.00 SF',{exact:true})).toBeVisible();
  await expect(page.getByText('6000.00 BF',{exact:true})).toBeVisible();
  expect(roofOf(await roofSnapshot(page))[0]).toMatchObject({kind:'roofSurface',purpose:'insulation',surfaceBasis:'horizontal',pitchRise:0,insulationType:'closed cell foam',depthFt:0.5});
});

test('R4 bulk eaves assignment previews, cancels, applies and undoes atomically',async ({page})=>{
  await rectangle(page);
  await dimensions(page,'40,30');
  await page.getByRole('button',{name:'6:12',exact:true}).click();
  await page.getByRole('button',{name:'Generate roof skeleton',exact:true}).click();
  const generator=page.locator('section').filter({has:page.getByRole('heading',{name:'Generate Roof Skeleton',exact:true})});
  await generator.getByRole('button',{name:'Preview',exact:true}).click();
  await generator.getByRole('button',{name:'Apply',exact:true}).click();
  await expect(entities(page)).toHaveCount(14);
  const before=roofOf(await roofSnapshot(page));
  const bulk=page.getByRole('region',{name:'Bulk perimeter assemblies'});
  await expect(bulk.getByText('4 target edges · 140.00 LF',{exact:true})).toBeVisible();
  for(const label of ['Bulk fascia','Bulk eavestrough','Bulk soffit run'])await bulk.getByLabel(label,{exact:true}).selectOption('included');
  await bulk.getByRole('checkbox',{name:/Explicitly exclude/}).check();
  await bulk.getByRole('button',{name:'Preview assignments'}).click();
  await expect(bulk.getByText('Explicit exclusions: 5 other classified edges',{exact:true})).toBeVisible();
  expect(roofOf(await roofSnapshot(page))).toEqual(before);
  await bulk.getByRole('button',{name:'Cancel assignments'}).click();
  expect(roofOf(await roofSnapshot(page))).toEqual(before);
  await bulk.getByRole('button',{name:'Preview assignments'}).click();
  await bulk.getByRole('button',{name:'Apply assignments'}).click();
  const after=roofOf(await roofSnapshot(page));
  expect(after).toHaveLength(13);
  for(const e of after)if(e.kind==='roofEdge'){
    const status=e.edgeType==='eave'?'included':'excluded';
    expect(e.applicability).toEqual({fascia:status,gutter:status,soffit:status});
  }
  for(const name of ['Fascia','Eavestrough','Soffit run']){
    const row=page.locator('div.flex.justify-between').filter({has:page.getByText(name,{exact:true})});
    await expect(row).toHaveText(name+'140.00 LF');
  }
  await page.getByTitle('Undo (Ctrl+Z)',{exact:true}).click();
  expect(roofOf(await roofSnapshot(page))).toEqual(before);
  await page.getByTitle('Redo (Ctrl+Y)',{exact:true}).click();
  expect(roofOf(await roofSnapshot(page))).toEqual(after);
});
