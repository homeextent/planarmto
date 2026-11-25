import {test,expect,type Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import type {ProjectDocument} from '../../src/engine/projectDocument';
import type {FoundationEntity} from '../../src/engine/measurements/measurementTypes';
async function snapshot(page:Page):Promise<FoundationEntity[]>{
 const [download]=await Promise.all([page.waitForEvent('download'),page.getByTitle('Save Project JSON',{exact:true}).click()]);
 const path=await download.path();if(!path)throw Error('Missing JSON download');
 const doc=JSON.parse(await readFile(path,'utf8')) as ProjectDocument;
 return doc.workspaces.find(w=>w.type==='foundation')!.measurements as FoundationEntity[];
}
const entities=(page:Page)=>page.getByLabel('Select foundation entity').locator('option');
async function place(page:Page,tool:string,a:{x:number;y:number},b:{x:number;y:number},dimensions:string){
 await page.getByRole('button',{name:tool,exact:true}).click();
 const canvas=page.locator('canvas').first();
 await canvas.click({position:a});await canvas.click({position:b});
 await page.keyboard.type(dimensions);await page.keyboard.press('Enter');
 await expect(entities(page)).toHaveCount(2);
 await expect(page.getByLabel('Material',{exact:true})).toHaveCount(1);
}
const errors=new WeakMap<Page,string[]>();
test.beforeEach(async({page})=>{
 const e:string[]=[];errors.set(page,e);page.on('pageerror',err=>e.push(err.message));
 await page.goto('/');
 await page.getByRole('button',{name:'+ Add workspace',exact:true}).click();
 await page.getByLabel('Workspace type').selectOption('foundation');
 await page.getByLabel('New workspace name').fill('Synthetic foundation');
 await page.getByRole('button',{name:'Create',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Foundation tools'})).toBeVisible();
});
test.afterEach(async({page})=>expect(errors.get(page)).toEqual([]));
test('foundation rectangle exact correction and single history transaction',async({page})=>{
 await place(page,'Slab',{x:250,y:250},{x:550,y:450},'40,30');
 await expect(page.getByLabel('Live drafting dimensions')).toHaveText('Placement reference: 40.00 × 30.00 ft');
 await page.keyboard.type('40,20');await page.keyboard.press('Enter');
 await expect(page.getByLabel('Live drafting dimensions')).toHaveText('Placement reference: 40.00 × 20.00 ft');
 await page.getByTitle('Undo (Ctrl+Z)',{exact:true}).click();await expect(entities(page)).toHaveCount(1);
 await page.getByTitle('Redo (Ctrl+Y)',{exact:true}).click();await expect(entities(page)).toHaveCount(2);
 const e=(await snapshot(page))[0];if(e.kind!=='slab')throw Error('Expected slab');
 expect(Math.max(...e.polygon.map(p=>p.x))-Math.min(...e.polygon.map(p=>p.x))).toBeCloseTo(40,6);
 expect(Math.max(...e.polygon.map(p=>p.y))-Math.min(...e.polygon.map(p=>p.y))).toBeCloseTo(20,6);
 expect(e.depthFt).toBeNull();
});
test('wall inspector confirms dimensions and raw concrete quantity',async({page})=>{
 await place(page,'Foundation wall',{x:250,y:250},{x:550,y:250},'40');
 await page.getByLabel('Material',{exact:true}).fill('poured concrete');
 await page.getByLabel('Width (ft)',{exact:true}).fill('0.6666666666666666');
 await page.getByLabel('Height / depth (ft)',{exact:true}).fill('8');
 await page.getByLabel('Base elevation (ft; blank unknown)',{exact:true}).fill('0');
 await page.getByLabel('Confirm drafted centreline').check();
 await page.getByRole('button',{name:'Apply foundation properties',exact:true}).click();
 await expect(page.getByText('7.90 CY',{exact:true})).toBeVisible();
 const e=(await snapshot(page))[0];expect(e).toMatchObject({kind:'foundationWall',heightFt:8,elevationFt:0,foundation:{centrelineConfirmed:true,baseElevationConfirmed:true}});
});
test('foundation geometry remains isolated when switching to floor and back',async({page})=>{
 await place(page,'Slab',{x:250,y:250},{x:550,y:450},'40,30');
 const group=page.getByRole('group',{name:'Select workspace'});
 await group.getByRole('button',{name:/· Floor$/}).first().click();
 await expect(page.getByRole('heading',{name:'Foundation tools'})).toHaveCount(0);
 await group.getByRole('button',{name:/Synthetic foundation/}).click();
 await expect(entities(page)).toHaveCount(2);
 await expect(page.getByRole('status').filter({hasText:/consolidated pricing and reporting unavailable/i})).toBeVisible();
});

test('foundation polygon closes at first vertex',async({page})=>{
 await page.getByRole('button',{name:'Slab',exact:true}).click();
 await page.getByLabel('Foundation drawing mode').selectOption('polygon');
 const canvas=page.locator('canvas').first();
 for(const position of [{x:250,y:250},{x:550,y:250},{x:550,y:450},{x:250,y:450},{x:250,y:250}])await canvas.click({position});
 await expect(entities(page)).toHaveCount(2);
 const e=(await snapshot(page))[0];if(e.kind!=='slab')throw Error('Expected slab');expect(e.polygon).toHaveLength(4);
});
test('rectangular foundation preview cancel and apply are atomic',async({page})=>{
 await page.getByText('Generate rectangular foundation',{exact:true}).click();
 for(const [label,value] of [['Origin X (ft)','0'],['Origin Y (ft)','0'],['Perimeter width (ft)','40'],['Perimeter depth (ft)','30'],['Perimeter wall thickness (ft)','0.6666666666666666'],['Perimeter wall height (ft)','8'],['Perimeter base (ft; blank unknown)','0']])await page.getByLabel(label,{exact:true}).fill(value);
 await page.getByRole('button',{name:'Preview perimeter',exact:true}).click();
 await expect(page.getByText('4 walls · 27.1276 CY',{exact:true})).toBeVisible();
 await expect(page.getByLabel('Foundation graphical preview')).toHaveText('Preview — 4 uncommitted components');
 await expect(entities(page)).toHaveCount(1);
 await page.getByRole('button',{name:'Cancel perimeter',exact:true}).click();
 await expect(page.getByLabel('Foundation graphical preview')).toHaveCount(0);
 await expect(entities(page)).toHaveCount(1);
 await page.getByRole('button',{name:'Preview perimeter',exact:true}).click();
 await page.getByRole('button',{name:'Apply perimeter',exact:true}).click();
 await expect(page.getByLabel('Foundation graphical preview')).toHaveCount(0);
 await expect(entities(page)).toHaveCount(5);
 await page.getByLabel('Select foundation entity').selectOption({index:1});
 await page.getByRole('button',{name:'Select entire foundation assembly',exact:true}).click();
 await expect(page.getByText('Selected: 4 Items',{exact:true})).toBeVisible();
 await expect(page.getByText('Selected scope: No explicit decision',{exact:true})).toBeVisible();
 expect((await snapshot(page)).map(e=>e.scopeApplicability)).toEqual(Array(4).fill(undefined));
 await page.getByTitle('Undo (Ctrl+Z)',{exact:true}).click();
 await expect(entities(page)).toHaveCount(1);
});

test('selected wall derives centred footing with atomic undo',async({page})=>{
 await place(page,'Foundation wall',{x:250,y:250},{x:550,y:250},'40');
 await page.getByLabel('Material',{exact:true}).fill('poured concrete');
 await page.getByLabel('Width (ft)',{exact:true}).fill('0.6666666666666666');
 await page.getByLabel('Height / depth (ft)',{exact:true}).fill('8');
 await page.getByLabel('Base elevation (ft; blank unknown)',{exact:true}).fill('0');
 await page.getByLabel('Confirm drafted centreline').check();
 await page.getByRole('button',{name:'Apply foundation properties',exact:true}).click();
 await page.getByText('Derive strip footings',{exact:true}).click();
 await page.getByLabel('Footing width (ft)',{exact:true}).fill('2');
 await page.getByLabel('Footing depth (ft)',{exact:true}).fill('1');
 await page.getByRole('button',{name:'Preview strip footings',exact:true}).click();
 await expect(page.getByText('1 footings · 2.9630 CY',{exact:true})).toBeVisible();
 await expect(entities(page)).toHaveCount(2);
 await page.getByRole('button',{name:'Apply strip footings',exact:true}).click();
 await expect(entities(page)).toHaveCount(3);
 await page.getByTitle('Undo (Ctrl+Z)',{exact:true}).click();
 await expect(entities(page)).toHaveCount(2);
});

test('wall opening inspector validates, edits and undoes net deduction',async({page})=>{
 await place(page,'Foundation wall',{x:250,y:250},{x:550,y:250},'40');
 for(const [label,value] of [['Material','poured concrete'],['Width (ft)','0.6666666666666666'],['Height / depth (ft)','8'],['Base elevation (ft; blank unknown)','0']])await page.getByLabel(label,{exact:true}).fill(value);
 await page.getByLabel('Confirm drafted centreline').check();
 await page.getByRole('button',{name:'Apply foundation properties',exact:true}).click();
 for(const [label,value] of [['Opening offset (ft)','5'],['Opening sill (ft)','2'],['Opening width (ft)','4'],['Opening height (ft)','3']])await page.getByLabel(label,{exact:true}).fill(value);
 await page.getByRole('button',{name:'Add wall opening',exact:true}).click();
 const summary=page.getByRole('region',{name:'Selected concrete volume breakdown'});
 await expect(summary.getByText('7.6049 CY',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Edit opening 1',exact:true}).click();
 await page.getByLabel('Opening offset (ft)',{exact:true}).fill('39');
 await page.getByRole('button',{name:'Save detail edit',exact:true}).click();
 await expect(page.getByRole('alert').filter({hasText:/outside parent/})).toBeVisible();
 expect((await snapshot(page))[0].foundation?.wallOpenings?.[0].offsetFt).toBe(5);
 await page.getByTitle('Undo (Ctrl+Z)',{exact:true}).click();
 expect((await snapshot(page))[0].foundation?.wallOpenings??[]).toHaveLength(0);
});
test('slab exclusion and thickening inspector report nonadditive breakdown',async({page})=>{
 await place(page,'Slab',{x:250,y:250},{x:550,y:450},'40,30');
 await page.getByLabel('Material',{exact:true}).fill('poured concrete');
 await page.getByLabel('Depth (ft)',{exact:true}).fill(String(4/12));
 await page.getByRole('button',{name:'Apply foundation properties',exact:true}).click();
 const slab=(await snapshot(page))[0];if(slab.kind!=='slab')throw Error('Expected slab');
 const x=Math.min(...slab.polygon.map(p=>p.x)),y=Math.min(...slab.polygon.map(p=>p.y));
 for(const [label,value] of [['Detail origin X (ft)',String(x+1)],['Detail origin Y (ft)',String(y+1)],['Detail width (ft)','6'],['Detail length (ft)','10']])await page.getByLabel(label,{exact:true}).fill(value);
 await page.getByRole('button',{name:'Add slab exclusion',exact:true}).click();
 await expect(page.getByRole('region',{name:'Selected concrete volume breakdown'}).getByText('14.0741 CY',{exact:true})).toBeVisible();
 await page.getByLabel('Slab detail type').selectOption('thickening');
 for(const [label,value] of [['Detail origin X (ft)',String(x+20)],['Detail origin Y (ft)',String(y+10)],['Detail width (ft)','10'],['Detail length (ft)','10'],['Thickening depth (ft)','1.5']])await page.getByLabel(label,{exact:true}).fill(value);
 await page.getByRole('button',{name:'Add slab thickening',exact:true}).click();
 const summary=page.getByRole('region',{name:'Selected concrete volume breakdown'});
 await expect(summary.getByText('4.3210 CY',{exact:true})).toBeVisible();
 await expect(summary.getByText('18.3951 CY',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Remove thickening 1',exact:true}).click();
 await expect(summary.getByText('14.0741 CY',{exact:true})).toBeVisible();
});

test('foundation window and crossing selection distinguish partial and complete geometry',async({page})=>{
 await page.getByRole('button',{name:'Foundation wall',exact:true}).click();
 const canvas=page.locator('canvas').first();
 await canvas.click({position:{x:250,y:250}});await canvas.click({position:{x:550,y:250}});
 await page.getByRole('button',{name:'Select',exact:true}).click();
 const box=await canvas.boundingBox();if(!box)throw Error('Missing canvas');
 const drag=async(x1:number,y1:number,x2:number,y2:number)=>{await page.mouse.move(box.x+x1,box.y+y1);await page.mouse.down();await page.mouse.move(box.x+x2,box.y+y2,{steps:5});await page.mouse.up()};
 await drag(350,210,450,290);await expect(page.getByLabel('Select foundation entity')).toHaveValue('');
 await drag(450,210,350,290);await expect(page.getByRole('button',{name:'Delete selected foundation components'})).toBeVisible();
 await drag(200,200,600,300);await expect(page.getByRole('button',{name:'Delete selected foundation components'})).toBeVisible();
});

test('wall face drafting stores canonical offset and preserves source length through correction',async({page})=>{
 await page.getByRole('button',{name:'Foundation wall',exact:true}).click();
 await page.getByLabel('Foundation wall reference').selectOption('exterior-left');
 await page.getByLabel('Face reference wall thickness').fill('1');
 const canvas=page.locator('canvas').first();
 await canvas.click({position:{x:250,y:250}});await canvas.click({position:{x:550,y:250}});
 await page.keyboard.type('40');await page.keyboard.press('Enter');
 await expect(entities(page)).toHaveCount(2);
 const e=(await snapshot(page))[0];if(e.kind!=='foundationWall')throw Error('Expected wall');
 expect(e.widthFt).toBe(1);expect(e.foundation?.centrelineConfirmed).toBe(true);expect(e.heightFt).toBeNull();
 const source=JSON.parse(e.source.note!.replace('Source face ',''));
 expect(e.start.y-source.start.y).toBeCloseTo(.5,6);
 expect(e.end.x-e.start.x).toBeCloseTo(40,6);
 await page.getByTitle('Undo (Ctrl+Z)',{exact:true}).click();await expect(entities(page)).toHaveCount(1);
});

test('selected wall derives waterproofing coverage with atomic undo',async({page})=>{
 await place(page,'Foundation wall',{x:250,y:250},{x:550,y:250},'40');
 for(const [label,value] of [['Material','poured concrete'],['Width (ft)','0.6666666666666666'],['Height / depth (ft)','8'],['Base elevation (ft; blank unknown)','0']])await page.getByLabel(label,{exact:true}).fill(value);
 await page.getByLabel('Confirm drafted centreline').check();
 await page.getByRole('button',{name:'Apply foundation properties',exact:true}).click();
 await page.getByText('Derive foundation envelope',{exact:true}).click();
 await page.getByLabel('Derived coverage height (ft)',{exact:true}).fill('6');
 await page.getByLabel('Derived layer material',{exact:true}).fill('membrane');
 await page.getByLabel('Derived layer identity',{exact:true}).fill('wp');
 await page.getByRole('button',{name:'Preview envelope',exact:true}).click();
 await expect(page.getByText('240.0000 SF',{exact:true})).toBeVisible();
 await expect(entities(page)).toHaveCount(2);
 await page.getByRole('button',{name:'Apply envelope',exact:true}).click();
 await expect(entities(page)).toHaveCount(3);
 await page.getByTitle('Undo (Ctrl+Z)',{exact:true}).click();
 await expect(entities(page)).toHaveCount(2);
});

test('rectangular wall assembly derives exterior drainage with preview and undo',async({page})=>{
 await page.getByText('Generate rectangular foundation',{exact:true}).click();
 for(const [label,value] of [['Origin X (ft)','0'],['Origin Y (ft)','0'],['Perimeter width (ft)','40'],['Perimeter depth (ft)','30'],['Perimeter wall thickness (ft)','0.6666666666666666'],['Perimeter wall height (ft)','8'],['Perimeter base (ft; blank unknown)','0']])await page.getByLabel(label,{exact:true}).fill(value);
 await page.getByRole('button',{name:'Preview perimeter',exact:true}).click();
 await page.getByRole('button',{name:'Apply perimeter',exact:true}).click();
 await page.getByLabel('Select foundation entity').selectOption({index:1});
 await page.getByRole('button',{name:'Select entire foundation assembly',exact:true}).click();
 await page.getByText('Derive perimeter drainage',{exact:true}).click();
 for(const [label,value] of [['Drainage exterior offset (ft)','2'],['Drainage material','pipe'],['Drainage layer identity','drain']])await page.getByLabel(label,{exact:true}).fill(value);
 await page.getByRole('button',{name:'Preview drainage',exact:true}).click();
 await expect(page.getByText('156.0000 LF',{exact:true})).toBeVisible();
 await expect(entities(page)).toHaveCount(5);
 await page.getByRole('button',{name:'Apply drainage',exact:true}).click();
 await expect(entities(page)).toHaveCount(9);
 await page.getByTitle('Undo (Ctrl+Z)',{exact:true}).click();
 await expect(entities(page)).toHaveCount(5);
});

test('foundation component visibility filters selection without changing saved quantities',async({page})=>{
 await place(page,'Foundation wall',{x:250,y:250},{x:550,y:250},'40');
 for(const [label,value] of [['Material','poured concrete'],['Width (ft)','0.6666666666666666'],['Height / depth (ft)','8'],['Base elevation (ft; blank unknown)','0']])await page.getByLabel(label,{exact:true}).fill(value);
 await page.getByLabel('Confirm drafted centreline').check();await page.getByRole('button',{name:'Apply foundation properties',exact:true}).click();
 await page.getByRole('button',{name:'Slab',exact:true}).click();const canvas=page.locator('canvas').first();await canvas.click({position:{x:250,y:350}});await canvas.click({position:{x:550,y:450}});
 await expect(entities(page)).toHaveCount(3);
 await page.getByLabel('Foundation component filter').selectOption('slab');await expect(entities(page)).toHaveCount(2);await expect(page.getByText('7.90 CY',{exact:true})).toBeVisible();expect(await snapshot(page)).toHaveLength(2);
 await page.getByLabel('Foundation component filter').selectOption('all');await expect(entities(page)).toHaveCount(3);
});

test('rectangular exterior waterproofing measures continuous outer faces',async({page})=>{
 await page.getByText('Generate rectangular foundation',{exact:true}).click();
 for(const [label,value] of [['Origin X (ft)','0'],['Origin Y (ft)','0'],['Perimeter width (ft)','40'],['Perimeter depth (ft)','30'],['Perimeter wall thickness (ft)','0.6666666666666666'],['Perimeter wall height (ft)','8'],['Perimeter base (ft; blank unknown)','0']])await page.getByLabel(label,{exact:true}).fill(value);
 await page.getByRole('button',{name:'Preview perimeter',exact:true}).click();await page.getByRole('button',{name:'Apply perimeter',exact:true}).click();
 await page.getByLabel('Select foundation entity').selectOption({index:1});await page.getByRole('button',{name:'Select entire foundation assembly',exact:true}).click();
 await page.getByText('Derive foundation envelope',{exact:true}).click();await page.getByLabel('Complete orthogonal exterior').check();
 for(const [label,value] of [['Derived coverage height (ft)','6'],['Derived layer material','membrane'],['Derived layer identity','wp']])await page.getByLabel(label,{exact:true}).fill(value);
 await page.getByRole('button',{name:'Preview envelope',exact:true}).click();await expect(page.getByText('840.0000 SF',{exact:true})).toBeVisible();await expect(page.getByLabel('Foundation graphical preview')).toHaveText('Preview — 4 uncommitted components');
 await page.getByRole('button',{name:'Apply envelope',exact:true}).click();await expect(entities(page)).toHaveCount(9);
 await page.getByTitle('Undo (Ctrl+Z)',{exact:true}).click();await expect(entities(page)).toHaveCount(5);
});

test('irregular polygon perimeter previews six walls and commits one undoable assembly',async({page})=>{
 await page.getByRole('button',{name:'Polygon foundation perimeter',exact:true}).click();
 const canvas=page.locator('canvas').first();
 for(const p of [{x:200,y:200},{x:500,y:200},{x:500,y:320},{x:380,y:320},{x:380,y:440},{x:200,y:440}])await canvas.click({position:p});
 await page.getByRole('button',{name:'Finish foundation polygon',exact:true}).click();
 await expect(page.getByLabel('Polygon perimeter configuration')).toBeVisible();
 for(const [label,value] of [['Polygon wall thickness (ft)','1'],['Polygon wall height (ft)','8'],['Polygon wall base (ft)','0']])await page.getByLabel(label,{exact:true}).fill(value);
 await page.getByRole('button',{name:'Preview polygon perimeter',exact:true}).click();
 await expect(page.getByLabel('Foundation graphical preview')).toHaveText('Preview — 6 uncommitted components');
 await expect(entities(page)).toHaveCount(1);
 await page.getByRole('button',{name:'Apply polygon perimeter',exact:true}).click();
 await expect(entities(page)).toHaveCount(7);
 const saved=await snapshot(page);expect(new Set(saved.map(e=>e.assemblyId)).size).toBe(1);expect(saved.every(e=>e.kind==='foundationWall')).toBe(true);
 await page.getByTitle('Undo (Ctrl+Z)',{exact:true}).click();await expect(entities(page)).toHaveCount(1);
 await page.getByTitle('Redo (Ctrl+Y)',{exact:true}).click();await expect(entities(page)).toHaveCount(7);
});

test('foundation inspector converts top elevation into canonical base',async({page})=>{
 await place(page,'Foundation wall',{x:250,y:250},{x:550,y:250},'40');
 await page.getByLabel('Material',{exact:true}).fill('poured concrete');
 await page.getByLabel('Width (ft)',{exact:true}).fill('1');
 await page.getByLabel('Height / depth (ft)',{exact:true}).fill('8');
 await page.getByLabel('Elevation reference',{exact:true}).selectOption('top');
 await page.getByLabel('Top elevation (ft; blank unknown)',{exact:true}).fill('0');
 await page.getByLabel('Confirm drafted centreline').check();
 await page.getByRole('button',{name:'Apply foundation properties',exact:true}).click();
 const e=(await snapshot(page))[0];if(e.kind!=='foundationWall')throw Error('Expected wall');
 expect(e.elevationFt).toBe(-8);expect(e.foundation?.baseElevationConfirmed).toBe(true);
});

test('isolated strip footing signed offset persists in source-linked preview and apply',async({page})=>{
 await place(page,'Foundation wall',{x:250,y:250},{x:550,y:250},'40');
 await page.getByLabel('Material',{exact:true}).fill('poured concrete');
 await page.getByLabel('Width (ft)',{exact:true}).fill('1');
 await page.getByLabel('Height / depth (ft)',{exact:true}).fill('8');
 await page.getByLabel('Base elevation (ft; blank unknown)',{exact:true}).fill('0');
 await page.getByLabel('Confirm drafted centreline').check();
 await page.getByRole('button',{name:'Apply foundation properties',exact:true}).click();
 await page.getByText('Derive strip footings',{exact:true}).click();
 await page.getByLabel('Footing width (ft)',{exact:true}).fill('2');
 await page.getByLabel('Footing depth (ft)',{exact:true}).fill('1');
 await page.getByLabel('Footing signed offset (ft)',{exact:true}).fill('0.5');
 await page.getByRole('button',{name:'Preview strip footings',exact:true}).click();
 await expect(page.getByText('1 footings · 2.9630 CY',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Apply strip footings',exact:true}).click();
 const f=(await snapshot(page)).find(e=>e.kind==='stripFooting');expect(f?.foundation?.stripSource?.offsetFt).toBe(.5);
});

test('slab reference footprint remains separate from concrete volume',async({page})=>{
 await place(page,'Slab',{x:250,y:250},{x:550,y:450},'40,30');
 await page.getByLabel('Material',{exact:true}).fill('poured concrete');
 await page.getByLabel('Depth (ft)',{exact:true}).fill('0.3333333333333333');
 await page.getByLabel('Base elevation (ft; blank unknown)',{exact:true}).fill('0');
 await page.getByRole('button',{name:'Apply foundation properties',exact:true}).click();
 const ref=page.getByLabel('Selected foundation footprint reference');
 await expect(ref).toBeVisible();await expect(ref).toContainText('1200.00 SF');
 await expect(ref).toContainText('Not an additional concrete material quantity.');
});

test('manual wall assembly assignment preserves physical identities and undo redo',async({page})=>{
 const canvas=page.locator('canvas').first();
 const properties=async(width:string,height:string,base:string)=>{
  for(const [label,value] of [['Material','poured concrete'],['Width (ft)',width],['Height / depth (ft)',height],['Base elevation (ft; blank unknown)',base]])await page.getByLabel(label,{exact:true}).fill(value);
  await page.getByLabel('Confirm drafted centreline').check();
  await page.getByLabel('Start junction extension (ft)',{exact:true}).fill('0.5');
  await page.getByRole('button',{name:'Apply foundation properties',exact:true}).click();
 };
 await page.getByRole('button',{name:'Foundation wall',exact:true}).click();
 await canvas.click({position:{x:250,y:250}});await canvas.click({position:{x:550,y:250}});
 await expect(entities(page)).toHaveCount(2);await properties('1','8','-8');
 await canvas.click({position:{x:250,y:250}});await canvas.click({position:{x:250,y:440}});
 await expect(entities(page)).toHaveCount(3);await properties('1','6','-4');
 const before=await snapshot(page);expect(new Set(before.map(e=>e.assemblyId)).size).toBe(2);
 await page.getByRole('button',{name:'Select',exact:true}).click();
 const box=await canvas.boundingBox();if(!box)throw Error('Missing canvas');
 await page.mouse.move(box.x+190,box.y+190);await page.mouse.down();await page.mouse.move(box.x+600,box.y+480,{steps:5});await page.mouse.up();
 await expect(page.getByText('2 foundation components selected',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Assign selected to new assembly',exact:true}).click();
 const after=await snapshot(page);expect(new Set(after.map(e=>e.assemblyId)).size).toBe(1);
 expect(after.map(e=>e.physicalId)).toEqual(before.map(e=>e.physicalId));
 expect(after.map(e=>e.foundation?.joinStartFt)).toEqual([.5,.5]);
 await page.getByTitle('Undo (Ctrl+Z)',{exact:true}).click();expect((await snapshot(page)).map(e=>e.assemblyId)).toEqual(before.map(e=>e.assemblyId));
 await page.getByTitle('Redo (Ctrl+Y)',{exact:true}).click();expect((await snapshot(page)).map(e=>e.assemblyId)).toEqual(after.map(e=>e.assemblyId));
});

test('foundation applicability excludes quantities without deleting geometry and undo restores scope',async({page})=>{
 await place(page,'Foundation wall',{x:250,y:250},{x:550,y:250},'40');
 for(const [label,value] of [['Material','poured concrete'],['Width (ft)','1'],['Height / depth (ft)','8'],['Base elevation (ft; blank unknown)','0']])await page.getByLabel(label,{exact:true}).fill(value);
 await page.getByLabel('Confirm drafted centreline').check();await page.getByRole('button',{name:'Apply foundation properties',exact:true}).click();
 await page.getByLabel('Foundation applicability',{exact:true}).selectOption('excluded');
 await page.getByLabel('Scope decision reason',{exact:true}).fill('Existing wall retained');
 await page.getByRole('button',{name:'Apply foundation applicability',exact:true}).click();
 await expect(page.getByLabel('Foundation scope decisions')).toContainText('Existing wall retained');
 await expect(entities(page)).toHaveCount(2);expect((await snapshot(page))[0].scopeApplicability).toEqual({status:'excluded',reason:'Existing wall retained'});
 await page.getByTitle('Undo (Ctrl+Z)',{exact:true}).click();expect((await snapshot(page))[0].scopeApplicability).toBeUndefined();
});

test('under-slab derived layers persist explicit nonoverlapping vertical stack',async({page})=>{
 await place(page,'Slab',{x:250,y:250},{x:550,y:450},'40,30');
 for(const [label,value] of [['Material','poured concrete'],['Depth (ft)','0.3333333333333333'],['Base elevation (ft; blank unknown)','0']])await page.getByLabel(label,{exact:true}).fill(value);
 await page.getByRole('button',{name:'Apply foundation properties',exact:true}).click();
 await page.getByText('Derive foundation envelope',{exact:true}).click();
 await page.getByLabel('Derived layer type').selectOption('horizontalInsulation');
 for(const [label,value] of [['Derived layer thickness (ft)','0.25'],['Layer top below slab base (ft)','0'],['Derived layer material','foam'],['Derived layer identity','foam']])await page.getByLabel(label,{exact:true}).fill(value);
 await page.getByRole('button',{name:'Preview envelope',exact:true}).click();await page.getByRole('button',{name:'Apply envelope',exact:true}).click();
 await page.getByLabel('Select foundation entity').selectOption({index:1});
 await page.getByLabel('Derived layer type').selectOption('granular');
 for(const [label,value] of [['Derived layer thickness (ft)','0.5'],['Layer top below slab base (ft)','0.25'],['Derived layer material','stone'],['Derived layer identity','stone']])await page.getByLabel(label,{exact:true}).fill(value);
 await page.getByRole('button',{name:'Preview envelope',exact:true}).click();await page.getByRole('button',{name:'Apply envelope',exact:true}).click();
 const saved=await snapshot(page),g=saved.find(e=>e.kind==='foundationRegion'&&e.purpose==='granular');
 expect(g).toMatchObject({elevationFt:-.75,foundation:{granularLayerId:'stone',envelopeSource:{offsetBelowSlabFt:.25}}});
});

test('manual vertical insulation confirms explicit opening treatment and foam thickness',async({page})=>{
 await place(page,'Vertical insulation',{x:250,y:250},{x:550,y:250},'40');
 for(const [label,value] of [['Material','foam'],['Coverage height (ft)','8'],['Layer identity','wall foam'],['Insulation thickness (ft)','0.25']])await page.getByLabel(label,{exact:true}).fill(value);
 await page.getByLabel('Confirm explicit route / net coverage, no remaining openings',{exact:true}).check();
 await page.getByLabel('Calculate foam board feet',{exact:true}).check();
 await page.getByLabel('Coverage opening treatment',{exact:true}).selectOption('alreadyDeducted');
 await page.getByRole('button',{name:'Apply foundation properties',exact:true}).click();
 expect((await snapshot(page))[0].foundation?.coverage?.openingTreatment).toBe('alreadyDeducted');
 await page.getByLabel('Coverage opening treatment',{exact:true}).selectOption('none');
 await page.getByRole('button',{name:'Apply foundation properties',exact:true}).click();
 await expect(page.getByText('320.00 SF',{exact:true})).toBeVisible();
 await expect(page.getByText('960.00 BF',{exact:true})).toBeVisible();
 expect((await snapshot(page))[0].foundation?.coverage).toMatchObject({foam:true,thicknessFt:.25,openingTreatment:'none'});
});
test('manual horizontal insulation uses entered region depth for foam board feet',async({page})=>{
 await place(page,'Horizontal insulation',{x:250,y:250},{x:550,y:450},'40,30');
 for(const [label,value] of [['Material','foam'],['Depth (ft)','0.25'],['Base elevation (ft; blank unknown)','-0.25'],['Layer identity','slab foam']])await page.getByLabel(label,{exact:true}).fill(value);
 await page.getByLabel('Confirm explicit route / net coverage, no remaining openings',{exact:true}).check();
 await page.getByLabel('Calculate foam board feet',{exact:true}).check();
 await page.getByRole('button',{name:'Apply foundation properties',exact:true}).click();
 await expect(page.getByText('1200.00 SF',{exact:true})).toBeVisible();await expect(page.getByText('3600.00 BF',{exact:true})).toBeVisible();
 expect((await snapshot(page))[0].foundation?.coverage).toMatchObject({layerId:'slab foam',confirmed:true,foam:true});
});

test('irregular exterior envelope previews and applies one component per source wall',async({page})=>{
 await page.getByRole('button',{name:'Polygon foundation perimeter',exact:true}).click();
 const canvas=page.locator('canvas').first();
 for(const p of [{x:200,y:200},{x:500,y:200},{x:500,y:320},{x:380,y:320},{x:380,y:440},{x:200,y:440}])await canvas.click({position:p});
 await page.getByRole('button',{name:'Finish foundation polygon',exact:true}).click();
 for(const [label,value] of [['Polygon wall thickness (ft)','1'],['Polygon wall height (ft)','8'],['Polygon wall base (ft)','0']])await page.getByLabel(label,{exact:true}).fill(value);
 await page.getByRole('button',{name:'Preview polygon perimeter',exact:true}).click();await page.getByRole('button',{name:'Apply polygon perimeter',exact:true}).click();
 await page.getByLabel('Select foundation entity').selectOption({index:1});await page.getByRole('button',{name:'Select entire foundation assembly',exact:true}).click();
 await page.getByText('Derive foundation envelope',{exact:true}).click();await page.getByLabel('Complete orthogonal exterior').check();
 for(const [label,value] of [['Derived coverage height (ft)','6'],['Derived layer material','membrane'],['Derived layer identity','wp']])await page.getByLabel(label,{exact:true}).fill(value);
 await page.getByRole('button',{name:'Preview envelope',exact:true}).click();await expect(page.getByLabel('Foundation graphical preview')).toHaveText('Preview — 6 uncommitted components');
 await page.getByRole('button',{name:'Apply envelope',exact:true}).click();await expect(entities(page)).toHaveCount(13);
 const saved=await snapshot(page),derived=saved.filter(e=>e.foundation?.envelopeSource);expect(derived).toHaveLength(6);expect(new Set(derived.map(e=>e.foundation?.envelopeSource?.sourceId)).size).toBe(6);
 await page.getByTitle('Undo (Ctrl+Z)',{exact:true}).click();await expect(entities(page)).toHaveCount(7);
});

test('irregular perimeter drainage preview and apply preserves closed source-linked route and undo',async({page})=>{
 await page.getByRole('button',{name:'Polygon foundation perimeter',exact:true}).click();
 const canvas=page.locator('canvas').first();
 for(const p of [{x:200,y:200},{x:500,y:200},{x:500,y:320},{x:380,y:320},{x:380,y:440},{x:200,y:440}])await canvas.click({position:p});
 await page.getByRole('button',{name:'Finish foundation polygon',exact:true}).click();
 for(const [label,value] of [['Polygon wall thickness (ft)','1'],['Polygon wall height (ft)','8'],['Polygon wall base (ft)','0']])await page.getByLabel(label,{exact:true}).fill(value);
 await page.getByRole('button',{name:'Preview polygon perimeter',exact:true}).click();await page.getByRole('button',{name:'Apply polygon perimeter',exact:true}).click();
 await page.getByLabel('Select foundation entity').selectOption({index:1});await page.getByRole('button',{name:'Select entire foundation assembly',exact:true}).click();
 await page.getByText('Derive perimeter drainage',{exact:true}).click();
 for(const [label,value] of [['Drainage exterior offset (ft)','2'],['Drainage material','pipe'],['Drainage layer identity','drain']])await page.getByLabel(label,{exact:true}).fill(value);
 await page.getByRole('button',{name:'Preview drainage',exact:true}).click();
 await expect(page.getByLabel('Foundation graphical preview')).toHaveText('Preview — 6 uncommitted components');await expect(entities(page)).toHaveCount(7);
 await page.getByRole('button',{name:'Apply drainage',exact:true}).click();await expect(entities(page)).toHaveCount(13);
 const saved=await snapshot(page),drain=saved.filter(e=>e.foundation?.drainageSource).sort((a,b)=>a.foundation!.drainageSource!.edge-b.foundation!.drainageSource!.edge);
 expect(drain).toHaveLength(6);for(let i=0;i<drain.length;i++){const a=drain[i],b=drain[(i+1)%drain.length];if(a.kind!=='foundationLine'||b.kind!=='foundationLine')throw Error('Expected drainage line');expect(a.end).toEqual(b.start);expect(a.foundation!.drainageSource!.wallIds).toHaveLength(6)}
 await page.getByTitle('Undo (Ctrl+Z)',{exact:true}).click();await expect(entities(page)).toHaveCount(7);
 await page.getByTitle('Redo (Ctrl+Y)',{exact:true}).click();await expect(entities(page)).toHaveCount(13);
});

test('continuous foundation drafting retains corrected endpoint and atomic per-segment history',async({page})=>{
 await page.getByRole('button',{name:'Foundation wall',exact:true}).click();
 await page.getByLabel('Continuous foundation drafting').check();
 const canvas=page.locator('canvas').first();
 await canvas.click({position:{x:250,y:250}});await canvas.click({position:{x:550,y:250}});
 await page.keyboard.type('40');await page.keyboard.press('Enter');
 await expect(entities(page)).toHaveCount(2);
 await page.keyboard.type('30');await page.keyboard.press('Enter');
 await expect(entities(page)).toHaveCount(2);
 const first=(await snapshot(page))[0];if(first.kind!=='foundationWall')throw Error('Expected wall');
 await canvas.click({position:{x:550,y:440}});
 await expect(entities(page)).toHaveCount(3);
 await page.keyboard.type('20');await page.keyboard.press('Enter');
 const next=(await snapshot(page))[1];if(next.kind!=='foundationWall')throw Error('Expected wall');
 expect(next.start).toEqual(first.end);expect(Math.hypot(next.end.x-next.start.x,next.end.y-next.start.y)).toBeCloseTo(20,6);
 await page.getByTitle('Undo (Ctrl+Z)',{exact:true}).click();await expect(entities(page)).toHaveCount(2);
 await page.getByTitle('Undo (Ctrl+Z)',{exact:true}).click();await expect(entities(page)).toHaveCount(1);
});
test('invalid exact face-reference placement retains actionable error and no geometry',async({page})=>{
 await page.getByRole('button',{name:'Foundation wall',exact:true}).click();
 await page.getByLabel('Foundation wall reference').selectOption('exterior-left');
 const canvas=page.locator('canvas').first();await canvas.click({position:{x:250,y:250}});await canvas.hover({position:{x:550,y:250}});
 await page.keyboard.type('40');await page.keyboard.press('Enter');
 await expect(page.getByRole('alert')).toBeVisible();await expect(entities(page)).toHaveCount(1);
 await page.getByLabel('Face reference wall thickness').fill('1');
 await page.getByLabel('Dimensions',{exact:true}).fill('40');await page.getByLabel('Dimensions',{exact:true}).press('Enter');
 await expect(entities(page)).toHaveCount(2);
});

test('foundation elevation reference switches preserve saved physical base',async({page})=>{
 await place(page,'Foundation wall',{x:250,y:250},{x:550,y:250},'40');
 for(const [label,value] of [['Material','poured concrete'],['Width (ft)','1'],['Height / depth (ft)','8'],['Base elevation (ft; blank unknown)','-8']])await page.getByLabel(label,{exact:true}).fill(value);
 await page.getByLabel('Confirm drafted centreline').check();await page.getByRole('button',{name:'Apply foundation properties',exact:true}).click();
 await page.getByLabel('Elevation reference').selectOption('top');await expect(page.getByLabel('Top elevation (ft; blank unknown)',{exact:true})).toHaveValue('0');
 await page.getByLabel('Elevation reference').selectOption('base');await expect(page.getByLabel('Base elevation (ft; blank unknown)',{exact:true})).toHaveValue('-8');
 await page.getByLabel('Elevation reference').selectOption('top');await page.getByRole('button',{name:'Apply foundation properties',exact:true}).click();
 expect((await snapshot(page))[0]).toMatchObject({elevationFt:-8,foundation:{baseElevationConfirmed:true}});
});
test('foundation focused dimensions cancel without geometry and subsequent canvas placement supports keyboard correction',async({page})=>{
 await page.getByRole('button',{name:'Foundation wall',exact:true}).click();
 const canvas=page.locator('canvas').first();await canvas.click({position:{x:250,y:250}});await canvas.hover({position:{x:550,y:250}});
 const dimensions=page.getByLabel('Dimensions',{exact:true});await dimensions.fill('40');await dimensions.press('Escape');
 await expect(dimensions).toHaveValue('');await expect(entities(page)).toHaveCount(1);
 await canvas.click({position:{x:550,y:250}});await page.keyboard.type('30');await page.keyboard.press('Enter');
 await expect(page.getByLabel('Live drafting dimensions')).toHaveText('Placement reference: 30.00 ft');
 const e=(await snapshot(page))[0];if(e.kind!=='foundationWall')throw Error('Expected wall');expect(Math.hypot(e.end.x-e.start.x,e.end.y-e.start.y)).toBeCloseTo(30,6);
});
test('foundation zoom controls accept pointer clicks with the dimensions form present',async({page})=>{
 const fit=page.getByTitle('Zoom to Fit',{exact:true});
 const zoomReadout=fit.locator('..').getByText(/^\d+%$/);
 await page.getByTitle('Zoom In',{exact:true}).click();
 await expect(zoomReadout).toHaveText('120%');
 await page.getByRole('button',{name:'Foundation wall',exact:true}).click();
 const canvas=page.locator('canvas').first();
 await canvas.click({position:{x:250,y:250}});
 await canvas.hover({position:{x:550,y:250}});
 const dimensions=page.getByLabel('Dimensions',{exact:true});
 await dimensions.fill('40');
 await expect(dimensions).toBeFocused();
 await fit.click();
 await expect(zoomReadout).toHaveText('100%');
 await expect(dimensions).toHaveValue('40');
 await dimensions.press('Escape');
 await expect(dimensions).toHaveValue('');
 await canvas.click({position:{x:550,y:250}});
 await page.keyboard.type('30');
 await page.keyboard.press('Enter');
 await expect(page.getByLabel('Live drafting dimensions')).toHaveText('Placement reference: 30.00 ft');
});
test('continuous drafting displays next segment separately from last placement correction',async({page})=>{
 await page.getByRole('button',{name:'Foundation wall',exact:true}).click();await page.getByLabel('Continuous foundation drafting').check();
 const canvas=page.locator('canvas').first();await canvas.click({position:{x:250,y:250}});await canvas.click({position:{x:550,y:250}});
 await page.keyboard.type('40');await page.keyboard.press('Enter');await canvas.hover({position:{x:550,y:440}});
 await expect(page.getByLabel('Live drafting dimensions')).toHaveText('Placement reference: 40.00 ft');
 await expect(page.getByLabel('Next foundation segment dimensions')).toContainText('Next segment:');
 await page.keyboard.type('30');await page.keyboard.press('Enter');await expect(page.getByLabel('Live drafting dimensions')).toHaveText('Placement reference: 30.00 ft');
 await expect(entities(page)).toHaveCount(2);
});

test('face referenced wall refuses stale thickness edit and preserves original geometry',async({page})=>{
 await page.getByRole('button',{name:'Foundation wall',exact:true}).click();await page.getByLabel('Foundation wall reference').selectOption('exterior-left');await page.getByLabel('Face reference wall thickness').fill('1');
 const canvas=page.locator('canvas').first();await canvas.click({position:{x:250,y:250}});await canvas.click({position:{x:550,y:250}});await page.keyboard.type('40');await page.keyboard.press('Enter');
 const before=await snapshot(page);await page.getByLabel('Width (ft)',{exact:true}).fill('2');await page.getByRole('button',{name:'Apply foundation properties',exact:true}).click();
 await expect(page.getByRole('alert').first()).toBeVisible();expect(await snapshot(page)).toEqual(before);
});

test('explicit strip replacement previews cancels and commits one undoable transaction',async({page})=>{
 await place(page,'Foundation wall',{x:250,y:250},{x:550,y:250},'40');
 for(const [label,value] of [['Material','poured concrete'],['Width (ft)','1'],['Height / depth (ft)','8'],['Base elevation (ft; blank unknown)','0']])await page.getByLabel(label,{exact:true}).fill(value);
 await page.getByLabel('Confirm drafted centreline').check();await page.getByRole('button',{name:'Apply foundation properties',exact:true}).click();
 await page.getByText('Derive strip footings',{exact:true}).click();
 await page.getByLabel('Footing width (ft)',{exact:true}).fill('2');await page.getByLabel('Footing depth (ft)',{exact:true}).fill('1');
 await page.getByRole('button',{name:'Preview strip footings',exact:true}).click();await page.getByRole('button',{name:'Apply strip footings',exact:true}).click();
 const before=await snapshot(page);
 await page.getByLabel('Select foundation entity').selectOption({index:1});
 await page.getByLabel('Replace existing strip footings',{exact:true}).check();await page.getByLabel('Footing width (ft)',{exact:true}).fill('3');
 await page.getByRole('button',{name:'Preview strip footings',exact:true}).click();await expect(page.getByText('Replace 1 existing components with 1 new components.',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Cancel strip footings',exact:true}).click();expect(await snapshot(page)).toEqual(before);
 await page.getByRole('button',{name:'Preview strip footings',exact:true}).click();await page.getByRole('button',{name:'Apply strip footings',exact:true}).click();
 const after=await snapshot(page);expect(after).toHaveLength(2);expect(after.find(e=>e.kind==='stripFooting')).toMatchObject({widthFt:3});expect(after[1].id).not.toBe(before[1].id);
 await page.getByTitle('Undo (Ctrl+Z)',{exact:true}).click();expect(await snapshot(page)).toEqual(before);
 await page.getByTitle('Redo (Ctrl+Y)',{exact:true}).click();expect(await snapshot(page)).toEqual(after);
});

test('coordinated foundation run dimensions commit as one history transaction',async({page})=>{
 await page.getByText('Generate rectangular foundation',{exact:true}).click();
 for(const [label,value] of [['Origin X (ft)','0'],['Origin Y (ft)','0'],['Perimeter width (ft)','40'],['Perimeter depth (ft)','30'],['Perimeter wall thickness (ft)','1'],['Perimeter wall height (ft)','8'],['Perimeter base (ft; blank unknown)','0']])await page.getByLabel(label,{exact:true}).fill(value);
 await page.getByRole('button',{name:'Preview perimeter',exact:true}).click();await page.getByRole('button',{name:'Apply perimeter',exact:true}).click();
 const before=await snapshot(page);await page.getByLabel('Select foundation entity').selectOption({index:1});await page.getByRole('button',{name:'Select entire foundation assembly',exact:true}).click();
 await page.getByText('Coordinated run dimensions',{exact:true}).click();
 await page.getByLabel('Run 1 Height / depth (ft)',{exact:true}).fill('6');await page.getByLabel('Run 2 Base elevation (ft)',{exact:true}).fill('-1');
 await page.getByRole('button',{name:'Apply coordinated run dimensions',exact:true}).click();
 const after=await snapshot(page);expect(after[0]).toMatchObject({heightFt:6});expect(after[1]).toMatchObject({elevationFt:-1});expect(after.map(e=>e.id)).toEqual(before.map(e=>e.id));
 await page.getByTitle('Undo (Ctrl+Z)',{exact:true}).click();expect(await snapshot(page)).toEqual(before);
 await page.getByTitle('Redo (Ctrl+Y)',{exact:true}).click();expect(await snapshot(page)).toEqual(after);
});

test('angled face-reference foundation wall preserves exact length, width, quantity and history',async({page})=>{
 await page.getByRole('button',{name:'Foundation wall',exact:true}).click();
 await page.getByLabel('Foundation wall reference').selectOption('exterior-left');
 await page.getByLabel('Face reference wall thickness').fill('1.25');
 const canvas=page.locator('canvas').first();
 await canvas.click({position:{x:250,y:250}});await canvas.click({position:{x:550,y:390}});
 await page.keyboard.type('42');await page.keyboard.press('Enter');
 await expect(page.getByLabel('Live drafting dimensions')).toHaveText('Placement reference: 42.00 ft');
 const draft=await snapshot(page),wall=draft[0];if(wall.kind!=='foundationWall')throw Error('Expected wall');
 expect(Math.abs(wall.end.x-wall.start.x)).toBeGreaterThan(0);expect(Math.abs(wall.end.y-wall.start.y)).toBeGreaterThan(0);
 expect(Math.hypot(wall.end.x-wall.start.x,wall.end.y-wall.start.y)).toBeCloseTo(42,6);
 expect(wall.widthFt).toBe(1.25);
 for(const [label,value] of [['Height / depth (ft)','8'],['Base elevation (ft; blank unknown)','-8']])await page.getByLabel(label,{exact:true}).fill(value);
 await page.getByRole('button',{name:'Apply foundation properties',exact:true}).click();
 await expect(page.getByText('15.56 CY',{exact:true})).toBeVisible();
 const after=await snapshot(page);
 expect(after[0]).toMatchObject({id:wall.id,heightFt:8,elevationFt:-8,foundation:{centrelineConfirmed:true,baseElevationConfirmed:true}});
 await page.getByTitle('Undo (Ctrl+Z)',{exact:true}).click();expect(await snapshot(page)).toEqual(draft);
 await page.getByTitle('Redo (Ctrl+Y)',{exact:true}).click();expect(await snapshot(page)).toEqual(after);
 const group=page.getByRole('group',{name:'Select workspace'});await group.getByRole('button',{name:/· Floor$/}).first().click();await group.getByRole('button',{name:/Synthetic foundation/}).click();
 await expect(page.getByText('15.56 CY',{exact:true})).toBeVisible();expect(await snapshot(page)).toEqual(after);
});

test('continuous nonwall drafting remains active after face-reference wall tool selection',async({page})=>{
 await page.getByRole('button',{name:'Foundation wall',exact:true}).click();
 await page.getByLabel('Foundation wall reference').selectOption('exterior-left');
 await page.getByRole('button',{name:'Drainage',exact:true}).click();
 await page.getByLabel('Continuous foundation drafting').check();
 const canvas=page.locator('canvas').first();await canvas.click({position:{x:250,y:250}});await canvas.click({position:{x:550,y:250}});
 await page.keyboard.type('40');await page.keyboard.press('Enter');
 const first=(await snapshot(page))[0];if(first.kind!=='foundationLine')throw Error('Expected drainage');
 await canvas.click({position:{x:550,y:440}});
 await expect(entities(page)).toHaveCount(3);
 const next=(await snapshot(page))[1];if(next.kind!=='foundationLine')throw Error('Expected drainage');
 expect(next.start).toEqual(first.end);
});
test('scope applicability editor reflects selected record instead of reusing previous decision',async({page})=>{
 await page.getByText('Generate rectangular foundation',{exact:true}).click();
 for(const [label,value] of [['Origin X (ft)','0'],['Origin Y (ft)','0'],['Perimeter width (ft)','40'],['Perimeter depth (ft)','30'],['Perimeter wall thickness (ft)','1'],['Perimeter wall height (ft)','8'],['Perimeter base (ft; blank unknown)','0']])await page.getByLabel(label,{exact:true}).fill(value);
 await page.getByRole('button',{name:'Preview perimeter',exact:true}).click();await page.getByRole('button',{name:'Apply perimeter',exact:true}).click();
 await page.getByLabel('Select foundation entity').selectOption({index:1});
 await page.getByLabel('Foundation applicability',{exact:true}).selectOption('excluded');await page.getByLabel('Scope decision reason',{exact:true}).fill('Existing wall');
 await page.getByRole('button',{name:'Apply foundation applicability',exact:true}).click();
 await expect(page.getByLabel('Scope decision reason',{exact:true})).toHaveValue('Existing wall');
 await expect(page.getByText('Selected scope: excluded',{exact:true})).toBeVisible();
 await page.getByLabel('Select foundation entity').selectOption({index:2});await expect(page.getByLabel('Foundation applicability',{exact:true})).toHaveValue('included');
 await expect(page.getByText('Selected scope: No explicit decision',{exact:true})).toBeVisible();
 await expect(page.getByLabel('Scope decision reason',{exact:true})).toHaveCount(0);
 await page.getByLabel('Select foundation entity').selectOption({index:1});await expect(page.getByLabel('Foundation applicability',{exact:true})).toHaveValue('excluded');
 await expect(page.getByLabel('Scope decision reason',{exact:true})).toHaveValue('Existing wall');
});
