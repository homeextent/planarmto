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
 await expect(entities(page)).toHaveCount(1);
 await page.getByRole('button',{name:'Cancel perimeter',exact:true}).click();
 await expect(entities(page)).toHaveCount(1);
 await page.getByRole('button',{name:'Preview perimeter',exact:true}).click();
 await page.getByRole('button',{name:'Apply perimeter',exact:true}).click();
 await expect(entities(page)).toHaveCount(5);
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
