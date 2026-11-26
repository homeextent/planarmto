import {test,expect,type Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import type {ProjectDocument} from '../../src/engine/projectDocument';
import type {FoundationEntity} from '../../src/engine/measurements/measurementTypes';
async function projectSnapshot(page:Page):Promise<ProjectDocument>{
 const [download]=await Promise.all([page.waitForEvent('download'),page.getByTitle('Save Project JSON',{exact:true}).click()]);
 const path=await download.path();if(!path)throw Error('Missing JSON download');
 return JSON.parse(await readFile(path,'utf8')) as ProjectDocument;
}
async function snapshot(page:Page):Promise<FoundationEntity[]>{
 return (await projectSnapshot(page)).workspaces.find(w=>w.type==='foundation')!.measurements as FoundationEntity[];
}
async function showTab(page:Page,name:'Construction'|'Geometry'|'Quantities'){
 await page.getByRole('tab',{name,exact:true}).click();
}
async function selectFoundationEntity(page:Page,option:{index:number}|string){
 await showTab(page,'Geometry');
 await page.getByLabel('Select foundation entity').selectOption(option);
 await showTab(page,'Construction');
}
async function selectEntireAssembly(page:Page){
 await showTab(page,'Geometry');
 await page.getByRole('button',{name:'Select entire foundation assembly',exact:true}).click();
 await showTab(page,'Construction');
}
async function expectWorkspaceQuantity(page:Page,value:string){
 const current=await page.getByRole('tab',{selected:true}).textContent() as 'Construction'|'Geometry'|'Quantities';
 await showTab(page,'Quantities');
 const summaries=page.locator('details:has(> summary) > summary').filter({hasText:/^(Concrete|Granular materials|Insulation|Waterproofing|Drainage|Informational)(?:$|\d)/});
 for(const summary of await summaries.all())if(await summary.locator('..').getAttribute('open')===null)await summary.click();
 await expect(page.getByText(value,{exact:true})).toBeVisible();
 if(current!=='Quantities')await showTab(page,current);
}
async function applyProperties(page:Page){
 const wall=page.getByRole('group',{name:'Wall construction transaction'});
 if(await wall.count()){
   await wall.getByRole('button',{name:'Preview',exact:true}).click();
   const apply=wall.getByRole('button',{name:'Apply',exact:true});
   if(await apply.isEnabled())await apply.click();
 }else await page.getByRole('button',{name:'Apply foundation properties',exact:true}).click();
}
async function advancedWall(page:Page){
 const toggle=page.getByText('Advanced independent construction',{exact:true});
 if(await toggle.count()&&!(await toggle.locator('..').getAttribute('open')!==null))await toggle.click();
}
async function confirmCentreline(page:Page){
 const checkbox=page.getByLabel('Confirm drafted centreline');
 if(await checkbox.count())await checkbox.check();
 else await expect(page.getByText('Wall thickness is measured about the traced centreline.')).toBeVisible();
}
async function wallElevation(page:Page){
 const toggle=page.getByText('Advanced wall elevations',{exact:true});
 if(await toggle.count()&&await toggle.locator('..').getAttribute('open')===null)await toggle.click();
}
async function fillFoundationField(page:Page,label:string,value:string){
 if(label.includes('elevation'))await wallElevation(page);
 const field=label==='Width (in)'?page.getByLabel(/^(Width|Wall thickness) \(in\)$/):
   label==='Height / depth (ft)'?page.getByLabel(/^(Height \/ depth|Wall height) \(ft\)$/):page.getByLabel(label,{exact:true});
 if(['Material','Derived layer material','Drainage material'].includes(label))await field.selectOption(value);
 else await field.fill(value);
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
 await page.getByText('Specialist drawing tools',{exact:true}).click();
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
 const editor=page.getByRole('form',{name:'Independent wall construction'});
 await expect(editor.getByLabel('Material',{exact:true})).toHaveValue('poured concrete');
 await page.getByLabel(/^(Width|Wall thickness) \(in\)$/).fill('0.6666666666666666 ft');
 await page.getByLabel(/^(Height \/ depth|Wall height) \(ft\)$/).fill('8');
 await wallElevation(page);
 await page.getByLabel('Base elevation (ft; blank unknown)',{exact:true}).fill('0');
 await confirmCentreline(page);
 await applyProperties(page);
 await expectWorkspaceQuantity(page,'7.90 CY');
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
 for(const [label,value] of [['Origin X (ft)','0'],['Origin Y (ft)','0'],['Perimeter width (ft)','40'],['Perimeter depth (ft)','30'],['Perimeter wall thickness (in)','0.6666666666666666 ft'],['Perimeter wall height (ft)','8'],['Perimeter base (ft; blank unknown)','0']])await fillFoundationField(page,label,value);
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
 await selectFoundationEntity(page,{index:1});
 await selectEntireAssembly(page);
 await expect(page.getByText('Selected: 4 Items',{exact:true})).toBeVisible();
 await advancedWall(page);await expect(page.getByText('Selected scope: No explicit decision',{exact:true})).toBeVisible();
 expect((await snapshot(page)).map(e=>e.scopeApplicability)).toEqual(Array(4).fill(undefined));
 await page.getByTitle('Undo (Ctrl+Z)',{exact:true}).click();
 await expect(entities(page)).toHaveCount(1);
});

test('selected wall derives centred footing with atomic undo',async({page})=>{
 await place(page,'Foundation wall',{x:250,y:250},{x:550,y:250},'40');
 await page.getByLabel('Material',{exact:true}).selectOption('poured concrete');
 await page.getByLabel(/^(Width|Wall thickness) \(in\)$/).fill('0.6666666666666666 ft');
 await page.getByLabel(/^(Height \/ depth|Wall height) \(ft\)$/).fill('8');
 await wallElevation(page);
 await page.getByLabel('Base elevation (ft; blank unknown)',{exact:true}).fill('0');
 await confirmCentreline(page);
 await applyProperties(page);
 await advancedWall(page);await page.getByText('Derive strip footings',{exact:true}).click();
 await page.getByLabel('Footing width (in)',{exact:true}).fill('2 ft');
 await page.getByLabel('Footing depth (in)',{exact:true}).fill('1 ft');
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
 for(const [label,value] of [['Material','poured concrete'],['Width (in)','0.6666666666666666 ft'],['Height / depth (ft)','8'],['Base elevation (ft; blank unknown)','0']])await fillFoundationField(page,label,value);
 await confirmCentreline(page);
 await applyProperties(page);
 await advancedWall(page);
 for(const [label,value] of [['Opening offset (ft)','5'],['Opening sill (ft)','2'],['Opening width (ft)','4'],['Opening height (ft)','3']])await fillFoundationField(page,label,value);
 await advancedWall(page);await page.getByRole('button',{name:'Add wall opening',exact:true}).click();
 await showTab(page,'Quantities');
 const summary=page.getByRole('region',{name:'Selected concrete volume breakdown'});
 await expect(summary.getByText('7.6049 CY',{exact:true})).toBeVisible();
 await showTab(page,'Construction');
 await advancedWall(page);
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
 await page.getByLabel('Material',{exact:true}).selectOption('poured concrete');
 await page.getByLabel('Depth (in)',{exact:true}).fill(String(4/12)+' ft');
 await applyProperties(page);
 const slab=(await snapshot(page))[0];if(slab.kind!=='slab')throw Error('Expected slab');
 const x=Math.min(...slab.polygon.map(p=>p.x)),y=Math.min(...slab.polygon.map(p=>p.y));
 for(const [label,value] of [['Detail origin X (ft)',String(x+1)],['Detail origin Y (ft)',String(y+1)],['Detail width (ft)','6'],['Detail length (ft)','10']])await fillFoundationField(page,label,value);
 await page.getByRole('button',{name:'Add slab exclusion',exact:true}).click();
 await showTab(page,'Quantities');
 await expect(page.getByRole('region',{name:'Selected concrete volume breakdown'}).getByText('14.0741 CY',{exact:true})).toBeVisible();
 await showTab(page,'Construction');
 await page.getByLabel('Slab detail type').selectOption('thickening');
 for(const [label,value] of [['Detail origin X (ft)',String(x+20)],['Detail origin Y (ft)',String(y+10)],['Detail width (ft)','10'],['Detail length (ft)','10'],['Thickening depth (in)','1.5 ft']])await fillFoundationField(page,label,value);
 await page.getByRole('button',{name:'Add slab thickening',exact:true}).click();
 await showTab(page,'Quantities');
 const summary=page.getByRole('region',{name:'Selected concrete volume breakdown'});
 await expect(summary.getByText('4.3210 CY',{exact:true})).toBeVisible();
 await expect(summary.getByText('18.3951 CY',{exact:true})).toBeVisible();
 await showTab(page,'Construction');
 await page.getByRole('button',{name:'Remove thickening 1',exact:true}).click();
 await showTab(page,'Quantities');
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
 await showTab(page,'Geometry');
 await drag(450,210,350,290);await showTab(page,'Geometry');await expect(page.getByRole('button',{name:'Delete selected foundation components'})).toBeVisible();
 await drag(200,200,600,300);await showTab(page,'Geometry');await expect(page.getByRole('button',{name:'Delete selected foundation components'})).toBeVisible();
});

test('wall face drafting stores canonical offset and preserves source length through correction',async({page})=>{
 await page.getByRole('button',{name:'Foundation wall',exact:true}).click();
 await page.getByLabel('Foundation wall reference').selectOption('exterior-left');
 await page.getByLabel('Face reference wall thickness (in)').fill('1 ft');
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
 for(const [label,value] of [['Material','poured concrete'],['Width (in)','0.6666666666666666 ft'],['Height / depth (ft)','8'],['Base elevation (ft; blank unknown)','0']])await fillFoundationField(page,label,value);
 await confirmCentreline(page);
 await applyProperties(page);
 await advancedWall(page);await page.getByText('Exterior protection and slab layers',{exact:true}).click();
 await page.getByLabel('Exterior side').selectOption('left');
 await page.getByLabel('Derived coverage height (ft)',{exact:true}).fill('6');
 await page.getByLabel('Derived layer material',{exact:true}).selectOption('sheet waterproofing membrane');
 await page.getByText('Advanced coverage identity',{exact:true}).click();
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
 for(const [label,value] of [['Origin X (ft)','0'],['Origin Y (ft)','0'],['Perimeter width (ft)','40'],['Perimeter depth (ft)','30'],['Perimeter wall thickness (in)','0.6666666666666666 ft'],['Perimeter wall height (ft)','8'],['Perimeter base (ft; blank unknown)','0']])await fillFoundationField(page,label,value);
 await page.getByRole('button',{name:'Preview perimeter',exact:true}).click();
 await page.getByRole('button',{name:'Apply perimeter',exact:true}).click();
 await selectFoundationEntity(page,{index:1});
 await selectEntireAssembly(page);
 await page.getByText('Derive perimeter drainage',{exact:true}).click();
 for(const [label,value] of [['Drainage exterior offset (in)','2 ft'],['Drainage material','perforated rigid pvc drainage pipe'],['Drainage layer identity','drain']])await fillFoundationField(page,label,value);
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
 for(const [label,value] of [['Material','poured concrete'],['Width (in)','0.6666666666666666 ft'],['Height / depth (ft)','8'],['Base elevation (ft; blank unknown)','0']])await fillFoundationField(page,label,value);
 await confirmCentreline(page);await applyProperties(page);
 await page.getByRole('button',{name:'Slab',exact:true}).click();const canvas=page.locator('canvas').first();await canvas.click({position:{x:250,y:350}});await canvas.click({position:{x:550,y:450}});
 await expect(entities(page)).toHaveCount(3);
 await showTab(page,'Geometry');await page.getByLabel('Foundation component filter').selectOption('slab');await expect(entities(page)).toHaveCount(2);await expectWorkspaceQuantity(page,'7.90 CY');expect(await snapshot(page)).toHaveLength(2);
 await showTab(page,'Geometry');await page.getByLabel('Foundation component filter').selectOption('all');await expect(entities(page)).toHaveCount(3);
});

test('rectangular exterior waterproofing measures continuous outer faces',async({page})=>{
 await page.getByText('Generate rectangular foundation',{exact:true}).click();
 for(const [label,value] of [['Origin X (ft)','0'],['Origin Y (ft)','0'],['Perimeter width (ft)','40'],['Perimeter depth (ft)','30'],['Perimeter wall thickness (in)','0.6666666666666666 ft'],['Perimeter wall height (ft)','8'],['Perimeter base (ft; blank unknown)','0']])await fillFoundationField(page,label,value);
 await page.getByRole('button',{name:'Preview perimeter',exact:true}).click();await page.getByRole('button',{name:'Apply perimeter',exact:true}).click();
 await selectFoundationEntity(page,{index:1});await selectEntireAssembly(page);
 await advancedWall(page);await page.getByText('Exterior protection and slab layers',{exact:true}).click();await page.getByLabel('Complete orthogonal exterior').check();
 for(const [label,value] of [['Derived coverage height (ft)','6'],['Derived layer material','sheet waterproofing membrane'],['Derived layer identity','wp']])await fillFoundationField(page,label,value);
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
 await page.getByText('Advanced individual perimeter',{exact:true}).click();
 for(const [label,value] of [['Polygon wall thickness (in)','1 ft'],['Polygon wall height (ft)','8'],['Polygon wall base (ft)','0']])await fillFoundationField(page,label,value);
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
 await page.getByLabel('Material',{exact:true}).selectOption('poured concrete');
 await page.getByLabel(/^(Width|Wall thickness) \(in\)$/).fill('1 ft');
 await page.getByLabel(/^(Height \/ depth|Wall height) \(ft\)$/).fill('8');
 await wallElevation(page);
 await page.getByLabel('Elevation reference',{exact:true}).selectOption('top');
 await wallElevation(page);
 await page.getByLabel('Top elevation (ft; blank unknown)',{exact:true}).fill('0');
 await confirmCentreline(page);
 await applyProperties(page);
 const e=(await snapshot(page))[0];if(e.kind!=='foundationWall')throw Error('Expected wall');
 expect(e.elevationFt).toBe(-8);expect(e.foundation?.baseElevationConfirmed).toBe(true);
});

test('isolated strip footing signed offset persists in source-linked preview and apply',async({page})=>{
 await place(page,'Foundation wall',{x:250,y:250},{x:550,y:250},'40');
 await page.getByLabel('Material',{exact:true}).selectOption('poured concrete');
 await page.getByLabel(/^(Width|Wall thickness) \(in\)$/).fill('1 ft');
 await page.getByLabel(/^(Height \/ depth|Wall height) \(ft\)$/).fill('8');
 await wallElevation(page);
 await page.getByLabel('Base elevation (ft; blank unknown)',{exact:true}).fill('0');
 await confirmCentreline(page);
 await applyProperties(page);
 await advancedWall(page);await page.getByText('Derive strip footings',{exact:true}).click();
 await page.getByLabel('Footing width (in)',{exact:true}).fill('2 ft');
 await page.getByLabel('Footing depth (in)',{exact:true}).fill('1 ft');
 await page.getByText('Advanced footing alignment',{exact:true}).click();
 await page.getByLabel('Footing signed offset (in)',{exact:true}).fill('0.5 ft');
 await page.getByRole('button',{name:'Preview strip footings',exact:true}).click();
 await expect(page.getByText('1 footings · 2.9630 CY',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Apply strip footings',exact:true}).click();
 const f=(await snapshot(page)).find(e=>e.kind==='stripFooting');expect(f?.foundation?.stripSource?.offsetFt).toBe(.5);
});

test('slab reference footprint remains separate from concrete volume',async({page})=>{
 await place(page,'Slab',{x:250,y:250},{x:550,y:450},'40,30');
 await page.getByLabel('Material',{exact:true}).selectOption('poured concrete');
 await page.getByLabel('Depth (in)',{exact:true}).fill('0.3333333333333333 ft');
 await wallElevation(page);
 await page.getByLabel('Base elevation (ft; blank unknown)',{exact:true}).fill('0');
 await applyProperties(page);
 await showTab(page,'Quantities');
 const ref=page.getByLabel('Selected foundation footprint reference');
 await expect(ref).toBeVisible();await expect(ref).toContainText('1200.00 SF');
 await expect(ref).toContainText('Not an additional concrete material quantity.');
});

test('manual wall assembly assignment preserves physical identities and undo redo',async({page})=>{
 const canvas=page.locator('canvas').first();
 const properties=async(width:string,height:string,base:string)=>{
  for(const [label,value] of [['Material','poured concrete'],['Width (in)',width+' ft'],['Height / depth (ft)',height],['Base elevation (ft; blank unknown)',base]])await fillFoundationField(page,label,value);
  await confirmCentreline(page);
  await page.getByText('Advanced wall junctions',{exact:true}).click();
  await page.getByLabel('Start junction extension (ft)',{exact:true}).fill('0.5');
  await applyProperties(page);
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
 await showTab(page,'Geometry');
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
 for(const [label,value] of [['Material','poured concrete'],['Width (in)','1 ft'],['Height / depth (ft)','8'],['Base elevation (ft; blank unknown)','0']])await fillFoundationField(page,label,value);
 await confirmCentreline(page);await applyProperties(page);
 await advancedWall(page);await page.getByLabel('Foundation applicability',{exact:true}).selectOption('excluded');
 await page.getByLabel('Scope decision reason',{exact:true}).fill('Existing wall retained');
 await page.getByRole('button',{name:'Apply foundation applicability',exact:true}).click();
 await expect(page.getByLabel('Foundation scope decisions')).toContainText('Existing wall retained');
 await expect(entities(page)).toHaveCount(2);expect((await snapshot(page))[0].scopeApplicability).toEqual({status:'excluded',reason:'Existing wall retained'});
 await page.getByTitle('Undo (Ctrl+Z)',{exact:true}).click();expect((await snapshot(page))[0].scopeApplicability).toBeUndefined();
});

test('under-slab derived layers persist explicit nonoverlapping vertical stack',async({page})=>{
 await place(page,'Slab',{x:250,y:250},{x:550,y:450},'40,30');
 for(const [label,value] of [['Material','poured concrete'],['Depth (in)','0.3333333333333333 ft'],['Base elevation (ft; blank unknown)','0']])await fillFoundationField(page,label,value);
 await applyProperties(page);
 await advancedWall(page);await page.getByText('Exterior protection and slab layers',{exact:true}).click();
 await page.getByLabel('Derived layer type').selectOption('horizontalInsulation');
 for(const [label,value] of [['Derived layer thickness (in)','0.25 ft'],['Layer top below slab base (in)','0 ft'],['Derived layer material','eps'],['Derived layer identity','foam']])await fillFoundationField(page,label,value);
 await page.getByRole('button',{name:'Preview envelope',exact:true}).click();await page.getByRole('button',{name:'Apply envelope',exact:true}).click();
 await selectFoundationEntity(page,{index:1});
 await page.getByLabel('Derived layer type').selectOption('granular');
 for(const [label,value] of [['Derived layer thickness (in)','0.5 ft'],['Layer top below slab base (in)','0.25 ft'],['Derived layer material','clear crushed stone'],['Derived layer identity','stone']])await fillFoundationField(page,label,value);
 await page.getByRole('button',{name:'Preview envelope',exact:true}).click();await page.getByRole('button',{name:'Apply envelope',exact:true}).click();
 const saved=await snapshot(page),g=saved.find(e=>e.kind==='foundationRegion'&&e.purpose==='granular');
 expect(g).toMatchObject({elevationFt:-.75,foundation:{granularLayerId:'stone',envelopeSource:{offsetBelowSlabFt:.25}}});
});

test('manual vertical insulation confirms explicit opening treatment and foam thickness',async({page})=>{
 await place(page,'Vertical insulation',{x:250,y:250},{x:550,y:250},'40');
 for(const [label,value] of [['Material','eps'],['Coverage height (ft)','8'],['Layer identity','wall foam'],['Insulation thickness (in)','0.25 ft']])await fillFoundationField(page,label,value);
 await page.getByLabel('Confirm explicit route / net coverage, no remaining openings',{exact:true}).check();
 await page.getByLabel('Calculate foam board feet',{exact:true}).check();
 await page.getByLabel('Coverage opening treatment',{exact:true}).selectOption('alreadyDeducted');
 await applyProperties(page);
 expect((await snapshot(page))[0].foundation?.coverage?.openingTreatment).toBe('alreadyDeducted');
 await page.getByLabel('Coverage opening treatment',{exact:true}).selectOption('none');
 await applyProperties(page);
 await expectWorkspaceQuantity(page,'320.00 SF');
 await expectWorkspaceQuantity(page,'960.00 BF');
 expect((await snapshot(page))[0].foundation?.coverage).toMatchObject({foam:true,thicknessFt:.25,openingTreatment:'none'});
});
test('manual horizontal insulation uses entered region depth for foam board feet',async({page})=>{
 await place(page,'Horizontal insulation',{x:250,y:250},{x:550,y:450},'40,30');
 for(const [label,value] of [['Material','eps'],['Depth (in)','0.25 ft'],['Base elevation (ft; blank unknown)','-0.25'],['Layer identity','slab foam']])await fillFoundationField(page,label,value);
 await page.getByLabel('Confirm explicit route / net coverage, no remaining openings',{exact:true}).check();
 await page.getByLabel('Calculate foam board feet',{exact:true}).check();
 await applyProperties(page);
 await expectWorkspaceQuantity(page,'1200.00 SF');await expectWorkspaceQuantity(page,'3600.00 BF');
 expect((await snapshot(page))[0].foundation?.coverage).toMatchObject({layerId:'slab foam',confirmed:true,foam:true});
});

test('irregular exterior envelope previews and applies one component per source wall',async({page})=>{
 await page.getByRole('button',{name:'Polygon foundation perimeter',exact:true}).click();
 const canvas=page.locator('canvas').first();
 for(const p of [{x:200,y:200},{x:500,y:200},{x:500,y:320},{x:380,y:320},{x:380,y:440},{x:200,y:440}])await canvas.click({position:p});
 await page.getByRole('button',{name:'Finish foundation polygon',exact:true}).click();
 await page.getByText('Advanced individual perimeter',{exact:true}).click();
 for(const [label,value] of [['Polygon wall thickness (in)','1 ft'],['Polygon wall height (ft)','8'],['Polygon wall base (ft)','0']])await fillFoundationField(page,label,value);
 await page.getByRole('button',{name:'Preview polygon perimeter',exact:true}).click();await page.getByRole('button',{name:'Apply polygon perimeter',exact:true}).click();
 await selectFoundationEntity(page,{index:1});await selectEntireAssembly(page);
 await advancedWall(page);await page.getByText('Exterior protection and slab layers',{exact:true}).click();await page.getByLabel('Complete orthogonal exterior').check();
 for(const [label,value] of [['Derived coverage height (ft)','6'],['Derived layer material','sheet waterproofing membrane'],['Derived layer identity','wp']])await fillFoundationField(page,label,value);
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
 await page.getByText('Advanced individual perimeter',{exact:true}).click();
 for(const [label,value] of [['Polygon wall thickness (in)','1 ft'],['Polygon wall height (ft)','8'],['Polygon wall base (ft)','0']])await fillFoundationField(page,label,value);
 await page.getByRole('button',{name:'Preview polygon perimeter',exact:true}).click();await page.getByRole('button',{name:'Apply polygon perimeter',exact:true}).click();
 await selectFoundationEntity(page,{index:1});await selectEntireAssembly(page);
 await page.getByText('Derive perimeter drainage',{exact:true}).click();
 for(const [label,value] of [['Drainage exterior offset (in)','2 ft'],['Drainage material','perforated rigid pvc drainage pipe'],['Drainage layer identity','drain']])await fillFoundationField(page,label,value);
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
 await page.getByLabel('Face reference wall thickness (in)').fill('1 ft');
 await page.getByLabel('Dimensions',{exact:true}).fill('40');await page.getByLabel('Dimensions',{exact:true}).press('Enter');
 await expect(entities(page)).toHaveCount(2);
});

test('foundation elevation reference switches preserve saved physical base',async({page})=>{
 await place(page,'Foundation wall',{x:250,y:250},{x:550,y:250},'40');
 for(const [label,value] of [['Material','poured concrete'],['Width (in)','1 ft'],['Height / depth (ft)','8'],['Base elevation (ft; blank unknown)','-8']])await fillFoundationField(page,label,value);
 await confirmCentreline(page);await applyProperties(page);
 await wallElevation(page);
 await page.getByLabel('Elevation reference').selectOption('top');await expect(page.getByLabel('Top elevation (ft; blank unknown)',{exact:true})).toHaveValue('0');
 await wallElevation(page);
 await page.getByLabel('Elevation reference').selectOption('base');await expect(page.getByLabel('Base elevation (ft; blank unknown)',{exact:true})).toHaveValue('-8');
 await wallElevation(page);
 await page.getByLabel('Elevation reference').selectOption('top');await applyProperties(page);
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
 await page.getByRole('button',{name:'Foundation wall',exact:true}).click();await page.getByLabel('Foundation wall reference').selectOption('exterior-left');await page.getByLabel('Face reference wall thickness (in)').fill('1 ft');
 const canvas=page.locator('canvas').first();await canvas.click({position:{x:250,y:250}});await canvas.click({position:{x:550,y:250}});await page.keyboard.type('40');await page.keyboard.press('Enter');
 const before=await snapshot(page);await page.getByLabel(/^(Width|Wall thickness) \(in\)$/).fill('2 ft');await applyProperties(page);
 await expect(page.getByRole('alert').first()).toBeVisible();expect(await snapshot(page)).toEqual(before);
});

test('explicit strip replacement previews cancels and commits one undoable transaction',async({page})=>{
 await place(page,'Foundation wall',{x:250,y:250},{x:550,y:250},'40');
 for(const [label,value] of [['Material','poured concrete'],['Width (in)','1 ft'],['Height / depth (ft)','8'],['Base elevation (ft; blank unknown)','0']])await fillFoundationField(page,label,value);
 await confirmCentreline(page);await applyProperties(page);
 await advancedWall(page);await page.getByText('Derive strip footings',{exact:true}).click();
 await page.getByLabel('Footing width (in)',{exact:true}).fill('2 ft');await page.getByLabel('Footing depth (in)',{exact:true}).fill('1 ft');
 await page.getByRole('button',{name:'Preview strip footings',exact:true}).click();await page.getByRole('button',{name:'Apply strip footings',exact:true}).click();
 const before=await snapshot(page);
 await selectFoundationEntity(page,{index:1});
 await page.getByLabel('Replace existing strip footings',{exact:true}).check();await page.getByLabel('Footing width (in)',{exact:true}).fill('3 ft');
 await page.getByRole('button',{name:'Preview strip footings',exact:true}).click();await expect(page.getByText('Replace 1 existing components with 1 new components.',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Cancel strip footings',exact:true}).click();expect(await snapshot(page)).toEqual(before);
 await page.getByRole('button',{name:'Preview strip footings',exact:true}).click();await page.getByRole('button',{name:'Apply strip footings',exact:true}).click();
 const after=await snapshot(page);expect(after).toHaveLength(2);expect(after.find(e=>e.kind==='stripFooting')).toMatchObject({widthFt:3});expect(after[1].id).not.toBe(before[1].id);
 await page.getByTitle('Undo (Ctrl+Z)',{exact:true}).click();expect(await snapshot(page)).toEqual(before);
 await page.getByTitle('Redo (Ctrl+Y)',{exact:true}).click();expect(await snapshot(page)).toEqual(after);
});

test('coordinated foundation run dimensions commit as one history transaction',async({page})=>{
 await page.getByText('Generate rectangular foundation',{exact:true}).click();
 for(const [label,value] of [['Origin X (ft)','0'],['Origin Y (ft)','0'],['Perimeter width (ft)','40'],['Perimeter depth (ft)','30'],['Perimeter wall thickness (in)','1 ft'],['Perimeter wall height (ft)','8'],['Perimeter base (ft; blank unknown)','0']])await fillFoundationField(page,label,value);
 await page.getByRole('button',{name:'Preview perimeter',exact:true}).click();await page.getByRole('button',{name:'Apply perimeter',exact:true}).click();
 const before=await snapshot(page);await selectFoundationEntity(page,{index:1});await selectEntireAssembly(page);
 await showTab(page,'Geometry');
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
 await page.getByLabel('Face reference wall thickness (in)').fill('1.25 ft');
 const canvas=page.locator('canvas').first();
 await canvas.click({position:{x:250,y:250}});await canvas.click({position:{x:550,y:390}});
 await page.keyboard.type('42');await page.keyboard.press('Enter');
 await expect(page.getByLabel('Live drafting dimensions')).toHaveText('Placement reference: 42.00 ft');
 const draft=await snapshot(page),wall=draft[0];if(wall.kind!=='foundationWall')throw Error('Expected wall');
 expect(Math.abs(wall.end.x-wall.start.x)).toBeGreaterThan(0);expect(Math.abs(wall.end.y-wall.start.y)).toBeGreaterThan(0);
 expect(Math.hypot(wall.end.x-wall.start.x,wall.end.y-wall.start.y)).toBeCloseTo(42,6);
 expect(wall.widthFt).toBe(1.25);
 for(const [label,value] of [['Height / depth (ft)','8'],['Base elevation (ft; blank unknown)','-8']])await fillFoundationField(page,label,value);
 await applyProperties(page);
 await expectWorkspaceQuantity(page,'15.56 CY');
 const after=await snapshot(page);
 expect(after[0]).toMatchObject({id:wall.id,heightFt:8,elevationFt:-8,foundation:{centrelineConfirmed:true,baseElevationConfirmed:true}});
 await page.getByTitle('Undo (Ctrl+Z)',{exact:true}).click();expect(await snapshot(page)).toEqual(draft);
 await page.getByTitle('Redo (Ctrl+Y)',{exact:true}).click();expect(await snapshot(page)).toEqual(after);
 const group=page.getByRole('group',{name:'Select workspace'});await group.getByRole('button',{name:/· Floor$/}).first().click();await group.getByRole('button',{name:/Synthetic foundation/}).click();
 await expectWorkspaceQuantity(page,'15.56 CY');expect(await snapshot(page)).toEqual(after);
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
 for(const [label,value] of [['Origin X (ft)','0'],['Origin Y (ft)','0'],['Perimeter width (ft)','40'],['Perimeter depth (ft)','30'],['Perimeter wall thickness (in)','1 ft'],['Perimeter wall height (ft)','8'],['Perimeter base (ft; blank unknown)','0']])await fillFoundationField(page,label,value);
 await page.getByRole('button',{name:'Preview perimeter',exact:true}).click();await page.getByRole('button',{name:'Apply perimeter',exact:true}).click();
 await selectFoundationEntity(page,{index:1});
 await advancedWall(page);await page.getByLabel('Foundation applicability',{exact:true}).selectOption('excluded');await page.getByLabel('Scope decision reason',{exact:true}).fill('Existing wall');
 await page.getByRole('button',{name:'Apply foundation applicability',exact:true}).click();
 await expect(page.getByLabel('Scope decision reason',{exact:true})).toHaveValue('Existing wall');
 await advancedWall(page);await expect(page.getByText('Selected scope: excluded',{exact:true})).toBeVisible();
 await selectFoundationEntity(page,{index:2});await expect(page.getByLabel('Foundation applicability',{exact:true})).toHaveValue('included');
 await advancedWall(page);await expect(page.getByText('Selected scope: No explicit decision',{exact:true})).toBeVisible();
 await expect(page.getByLabel('Scope decision reason',{exact:true})).toHaveCount(0);
 await selectFoundationEntity(page,{index:1});await expect(page.getByLabel('Foundation applicability',{exact:true})).toHaveValue('excluded');
 await expect(page.getByLabel('Scope decision reason',{exact:true})).toHaveValue('Existing wall');
});

test('graphical foundation rectangle uses exact dimensions and one committed history entry',async({page})=>{
 const canvas=page.locator('canvas').first();
 await page.getByRole('button',{name:'Rectangle foundation',exact:true}).click();
 await canvas.click({position:{x:250,y:250}});
 await canvas.hover({position:{x:550,y:450}});
 await expect(page.getByLabel('Live drafting dimensions')).toHaveText(/^Live: .* × .* ft$/);
 await canvas.click({position:{x:550,y:450}});
 await expect(page.getByLabel('Rectangle perimeter configuration')).toBeVisible();
 await expect(entities(page)).toHaveCount(1);
 await page.keyboard.type('40,30');await page.keyboard.press('Enter');
 await expect(page.getByLabel('Live drafting dimensions')).toHaveText('Placement reference: 40.00 × 30.00 ft');
 await page.getByText('Advanced individual perimeter',{exact:true}).click();
 await fillFoundationField(page,'Rectangle wall thickness (in)','8');
 await fillFoundationField(page,'Rectangle wall height (ft)',`8'`);
 await fillFoundationField(page,'Rectangle wall base (ft)','0');
 await page.getByRole('button',{name:'Preview rectangle perimeter',exact:true}).click();
 await expect(page.getByLabel('Rectangle perimeter quantity')).toHaveText('4 walls · 27.1276 CY');
 await expect(entities(page)).toHaveCount(1);
 await page.getByRole('button',{name:'Apply rectangle perimeter',exact:true}).click();
 const saved=await snapshot(page);
 expect(saved).toHaveLength(4);
 expect(saved.every(e=>e.foundation?.perimeterReference?.reference==='exterior')).toBe(true);
 const trace=saved[0].foundation!.perimeterReference!.points;
 expect(Math.abs(trace[2].x-trace[0].x)).toBeCloseTo(40,10);
 expect(Math.abs(trace[2].y-trace[0].y)).toBeCloseTo(30,10);
 await page.getByTitle('Undo (Ctrl+Z)',{exact:true}).click();
 await expect(entities(page)).toHaveCount(1);
 await page.getByTitle('Redo (Ctrl+Y)',{exact:true}).click();
 expect(await snapshot(page)).toEqual(saved);
});

test('continuous perimeter trace highlights closure and retains an invalid draft for recovery',async({page})=>{
 const canvas=page.locator('canvas').first();
 await page.getByRole('button',{name:'Foundation wall',exact:true}).click();
 await page.getByLabel('Continuous foundation drafting').check();
 await page.getByRole('button',{name:'Trace continuous perimeter',exact:true}).click();
 for(const [x,y] of [[250,250],[550,250],[550,450],[400,450]])await canvas.click({position:{x,y}});
 await canvas.hover({position:{x:253,y:250}});
 await expect(page.getByText('Start node snapped',{exact:true})).toBeVisible();
 await canvas.click({position:{x:253,y:250}});
 await expect(page.getByRole('alert').filter({hasText:'Close perimeter with orthogonal edges'})).toBeVisible();
 await expect(entities(page)).toHaveCount(1);
 await page.getByRole('button',{name:'Remove last vertex',exact:true}).click();
 await canvas.click({position:{x:250,y:450}});
 await canvas.click({position:{x:250,y:250}});
 await expect(page.getByLabel('Polygon perimeter configuration')).toBeVisible();
 await expect(entities(page)).toHaveCount(1);
 await page.getByRole('button',{name:'Cancel polygon perimeter',exact:true}).click();
 await expect(page.getByLabel('Polygon perimeter configuration')).toHaveCount(0);
 await expect(entities(page)).toHaveCount(1);
});

test('wall endpoint snap continues an independent wall without adopting its source',async({page})=>{
 const canvas=page.locator('canvas').first();
 await place(page,'Foundation wall',{x:250,y:250},{x:490,y:250},'10');
 const [first]=await snapshot(page);
 await page.getByRole('button',{name:'Select',exact:true}).click();
 await page.getByRole('button',{name:'Foundation wall',exact:true}).click();
 await canvas.hover({position:{x:495,y:250}});
 await expect(page.getByText('Wall endpoint snapped',{exact:true})).toBeVisible();
 await canvas.click({position:{x:495,y:250}});
 await canvas.click({position:{x:490,y:490}});
 const [before,added]=await snapshot(page);
 if(first.kind!=='foundationWall'||added.kind!=='foundationWall')throw Error('Expected walls');
 expect(before).toEqual(first);
 expect(added.start).toEqual(first.end);
 expect(added.assemblyId).not.toBe(first.assemblyId);
});

test('foundation units and catalogue preserve canonical values across unit changes',async({page})=>{
 await place(page,'Foundation wall',{x:250,y:250},{x:550,y:250},`40' 6"`);
 await fillFoundationField(page,'Material','poured concrete');
 await fillFoundationField(page,'Width (in)','7 1/2');
 await fillFoundationField(page,'Height / depth (ft)',`8' 6"`);
 await fillFoundationField(page,'Base elevation (ft; blank unknown)','-8');
 await confirmCentreline(page);
 await applyProperties(page);
 const [first]=await snapshot(page);
 expect(first).toMatchObject({widthFt:.625,heightFt:8.5,elevationFt:-8,foundation:{material:'poured concrete'}});
 if(first.kind!=='foundationWall')throw Error('Expected wall');
 expect(Math.hypot(first.end.x-first.start.x,first.end.y-first.start.y)).toBeCloseTo(40.5,10);
 await page.getByRole('button',{name:'Metric (m)',exact:true}).click();
 await expect(page.getByLabel('Wall thickness (mm)',{exact:true})).toHaveValue('190.5');
 await expect(page.getByLabel('Wall height (m)',{exact:true})).toHaveValue('2.5908');
 await applyProperties(page);
 expect((await snapshot(page))[0]).toEqual(first);
 await expect(page.getByLabel('Material',{exact:true}).locator('option')).toHaveText(['Select material','Poured concrete']);
});

test('unsupported saved concrete and custom insulation keep their measurement classifications',async({page})=>{
 await place(page,'Foundation wall',{x:250,y:250},{x:550,y:250},'40');
 await fillFoundationField(page,'Material','poured concrete');
 await fillFoundationField(page,'Width (in)','8');
 await fillFoundationField(page,'Height / depth (ft)','8');
 await fillFoundationField(page,'Base elevation (ft; blank unknown)','0');
 await confirmCentreline(page);
 await applyProperties(page);
 const doc=await projectSnapshot(page);
 const workspace=doc.workspaces.find(w=>w.type==='foundation')!;
 const [historical]=workspace.measurements as FoundationEntity[];
 historical.foundation!.material='concrete block';
 page.once('dialog',dialog=>dialog.accept());
 await page.getByTitle('Import JSON Project').locator('input').setInputFiles({name:'historical.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(doc))});
 await showTab(page,'Quantities');
 await page.getByText('Not quantified',{exact:true}).waitFor();
 await selectFoundationEntity(page,{index:1});
 await expect(page.getByRole('option',{name:'Saved material · concrete block'})).toBeDisabled();
 await applyProperties(page);
 expect(await snapshot(page)).toEqual([historical]);
 await page.getByRole('button',{name:'Horizontal insulation',exact:true}).click();
 const canvas=page.locator('canvas').first();
 await canvas.click({position:{x:250,y:400}});
 await canvas.click({position:{x:450,y:550}});
 await fillFoundationField(page,'Material','other');
 await fillFoundationField(page,'Depth (in)','3');
 await applyProperties(page);
 expect((await snapshot(page)).find(e=>e.kind==='foundationRegion')?.foundation).toBeUndefined();
 await page.getByLabel('Material description',{exact:true}).fill('Specified rigid fibreboard');
 await page.getByLabel('Layer identity',{exact:true}).fill('separate fibreboard layer');
 await page.getByLabel('Confirm explicit route / net coverage, no remaining openings').check();
 await applyProperties(page);
 expect((await snapshot(page)).find(e=>e.kind==='foundationRegion')?.foundation?.material).toBe('Specified rigid fibreboard');
});

test('calibrated graphical rectangle preserves the underlay and original trace through zoom and reopen',async({page})=>{
 const drawing='<svg xmlns="http://www.w3.org/2000/svg" width="600" height="480"><path fill="none" stroke="red" stroke-width="3" d="M50 50H450V350H50Z"/></svg>';
 await page.getByTitle('Import Blueprint / Floor Plan Image or PDF').locator('input').setInputFiles({name:'synthetic.svg',mimeType:'image/svg+xml',buffer:Buffer.from(drawing)});
 await expect(page.getByTitle('Open Blueprint Underlay Settings')).toBeVisible();
 const canvas=page.locator('canvas').first();
 const size=await canvas.evaluate(e=>({w:e.clientWidth,h:e.clientHeight}));
 const pixel=(x:number,y:number,feetPerPixel:number)=>{
  const scale=Math.max(10,Math.min(60,Math.min(size.w/(600*feetPerPixel+12),size.h/(480*feetPerPixel+12))*0.85));
  return {x:Math.round(size.w/2+(x-300)*feetPerPixel*scale),y:Math.round(size.h/2+(y-240)*feetPerPixel*scale)};
 };
 const fit=page.getByTitle('Zoom to Fit',{exact:true});
 await fit.click();
 await page.getByRole('button',{name:'Calibrate scale',exact:true}).click();
 await canvas.click({position:pixel(50,50,50/600)});
 page.once('dialog',dialog=>dialog.accept('40'));
 await canvas.click({position:pixel(450,50,50/600)});
 const foundation=(doc:ProjectDocument)=>doc.workspaces.find(w=>w.type==='foundation')!;
 const calibrated=foundation(await projectSnapshot(page)).geometry.underlay!;
 expect(calibrated.feetPerPixel).toBeCloseTo(.1,3);
 await page.getByTitle('Zoom In',{exact:true}).click();
 await fit.click();
 await page.getByRole('button',{name:'Rectangle foundation',exact:true}).click();
 await canvas.click({position:pixel(50,50,calibrated.feetPerPixel)});
 await canvas.click({position:pixel(450,350,calibrated.feetPerPixel)});
 await page.keyboard.type('40,30');await page.keyboard.press('Enter');
 await page.getByLabel('Rectangle reference',{exact:true}).selectOption('interior');
 await page.getByText('Advanced individual perimeter',{exact:true}).click();
 await fillFoundationField(page,'Rectangle wall thickness (in)','8');
 await fillFoundationField(page,'Rectangle wall height (ft)','8');
 await fillFoundationField(page,'Rectangle wall base (ft)','0');
 await page.getByRole('button',{name:'Preview rectangle perimeter',exact:true}).click();
 const volume=(2*(8/12)*(40+30)+4*(8/12)**2)*8/27;
 await expect(page.getByLabel('Rectangle perimeter quantity')).toHaveText('4 walls · '+volume.toFixed(4)+' CY');
 await page.getByRole('button',{name:'Apply rectangle perimeter',exact:true}).click();
 const saved=await projectSnapshot(page);
 expect(foundation(saved).geometry.underlay).toEqual(calibrated);
 await page.reload();
 await page.getByTitle('Import JSON Project').locator('input').setInputFiles({name:'synthetic-foundation.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(saved))});
 await expect(page.getByRole('heading',{name:'Foundation tools'})).toBeVisible();
 expect(foundation(await projectSnapshot(page))).toEqual(foundation(saved));
});

test('graphical assembly adopts its traced perimeter, previews strip changes and reopens with IDs',async({page})=>{
 const canvas=page.locator('canvas').first();
 const fit=page.getByTitle('Zoom to Fit',{exact:true});
 await fit.click();
 await page.getByRole('button',{name:'Rectangle foundation',exact:true}).click();
 await canvas.click({position:{x:250,y:250}});await canvas.click({position:{x:550,y:450}});
 await page.keyboard.type('40,30');await page.keyboard.press('Enter');
 await page.getByText('Advanced individual perimeter',{exact:true}).click();
 await fillFoundationField(page,'Rectangle wall thickness (in)','8');
 await fillFoundationField(page,'Rectangle wall height (ft)','8');
 await fillFoundationField(page,'Rectangle wall base (ft)','0');
 await page.getByRole('button',{name:'Preview rectangle perimeter',exact:true}).click();
 await page.getByRole('button',{name:'Apply rectangle perimeter',exact:true}).click();
 const before=await snapshot(page);
 const panel=page.getByRole('region',{name:'Foundation assemblies',exact:true});
 await panel.getByRole('button',{name:'Configure assembly from selected perimeter',exact:true}).click();
 await panel.getByRole('button',{name:'Preview assembly changes',exact:true}).click();
 await expect(panel.getByRole('button',{name:'Apply assembly changes',exact:true})).toBeEnabled();
 await panel.getByRole('button',{name:'Apply assembly changes',exact:true}).click();
 const adopted=await projectSnapshot(page);
 const foundation=(doc:ProjectDocument)=>doc.workspaces.find(w=>w.type==='foundation')!;
 const [assembly]=foundation(adopted).foundationAssemblies!;
 expect(assembly.children.map(c=>c.entityId)).toEqual(before.map(e=>e.id));
 await panel.getByRole('button',{name:'Edit assembly',exact:true}).click();
 await expect(panel.getByLabel('Wall height (ft)',{exact:true})).toHaveValue(`8' 0"`);
 await panel.getByLabel('Reference for revised specifications').fill('Synthetic plan sheet A-1');
 await panel.getByText('Strip footing · pending',{exact:true}).click();
 await panel.getByLabel('Strip footing scope').selectOption('included');
 const footing=panel.getByRole('group',{name:'Strip footing',exact:true});
 await footing.getByLabel('Material',{exact:true}).selectOption('poured concrete');
 await footing.getByLabel('Footing width (in)',{exact:true}).fill('24');
 await footing.getByLabel('Footing depth (in)',{exact:true}).fill('6');
 await footing.getByLabel('Confirm centred footing').check();
 await footing.getByLabel('Confirm top at wall base').check();
 await panel.getByRole('button',{name:'Preview assembly changes',exact:true}).click();
 expect(foundation(await projectSnapshot(page)).measurements).toHaveLength(4);
 await panel.getByRole('button',{name:'Apply assembly changes',exact:true}).click();
 await expectWorkspaceQuantity(page,'5.09 CY');
 const applied=await projectSnapshot(page);
 expect(foundation(applied).measurements).toHaveLength(8);
 await page.getByTitle('Undo (Ctrl+Z)',{exact:true}).click();
 expect(foundation(await projectSnapshot(page))).toEqual(foundation(adopted));
 await page.getByTitle('Redo (Ctrl+Y)',{exact:true}).click();
 expect(foundation(await projectSnapshot(page))).toEqual(foundation(applied));
 await page.reload();
 await page.getByTitle('Import JSON Project').locator('input').setInputFiles({name:'assembly.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(applied))});
 await showTab(page,'Geometry');
 await expect(panel.getByLabel('Foundation assembly')).toBeVisible();
 expect(foundation(await projectSnapshot(page))).toEqual(foundation(applied));
 await panel.getByLabel('Foundation assembly').selectOption({index:1});
 await showTab(page,'Construction');
 await panel.getByRole('button',{name:'Edit assembly',exact:true}).click();
 await panel.locator('summary').filter({hasText:'Strip footing · included'}).click();
 await expect(footing.getByLabel('Footing width (in)')).toHaveValue('24');
 await expect(footing.getByLabel('Footing depth (in)')).toHaveValue('6');
 await footing.getByLabel('Footing depth (in)').fill('8');
 await panel.getByRole('button',{name:'Preview assembly changes',exact:true}).click();
 const review=panel.getByRole('table',{name:'Preview quantities'});
 await expect(review.getByRole('row').filter({hasText:'footing strip concrete'})).toContainText('5.09 CY');
 await expect(review.getByRole('row').filter({hasText:'footing strip concrete'})).toContainText('6.78 CY');
 await expect(review.getByRole('row').filter({hasText:'wall concrete'}).getByRole('cell')).toHaveText(['27.13 CY','27.13 CY']);
 await expect(panel.getByText(/0 added, 8 retained \(4 revised\)/)).toBeVisible();
 await panel.getByRole('button',{name:'Apply assembly changes',exact:true}).click();
 await expectWorkspaceQuantity(page,'6.78 CY');
});

test('saved assembly supports graphical trace correction, preset snapshots and reversible detachment',async({page})=>{
 const canvas=page.locator('canvas').first();
 await page.getByTitle('Zoom to Fit',{exact:true}).click();
 await page.getByRole('button',{name:'Rectangle foundation',exact:true}).click();
 await canvas.click({position:{x:250,y:250}});await canvas.click({position:{x:550,y:450}});
 await page.keyboard.type('40,30');await page.keyboard.press('Enter');
 await page.getByRole('button',{name:'Specify foundation construction',exact:true}).click();
 const editor=page.getByRole('region',{name:'Foundation assemblies',exact:true});
 await editor.getByRole('group',{name:'Walls',exact:true}).getByLabel('Material',{exact:true}).selectOption('poured concrete');
 await editor.getByLabel('Wall thickness (in)',{exact:true}).fill('8');
 await editor.getByLabel('Wall height (ft)',{exact:true}).fill('8');
 await expect(editor.getByText(/Wall base is the local estimating reference/)).toBeVisible();
 await editor.getByRole('button',{name:'Preview assembly changes',exact:true}).click();
 await editor.getByRole('button',{name:'Apply assembly changes',exact:true}).click();
 const foundation=(doc:ProjectDocument)=>doc.workspaces.find(w=>w.type==='foundation')!;
 const original=foundation(await projectSnapshot(page));
 const panel=page.getByRole('region',{name:'Foundation assemblies',exact:true});
 await panel.getByRole('button',{name:'Edit assembly',exact:true}).click();
 await panel.getByLabel('Reference for revised specifications').fill('Corrected synthetic drawing');
 await panel.getByText('Advanced assembly inputs',{exact:true}).click();
 await panel.getByRole('button',{name:'Move trace vertex on canvas'}).click();
 await expect(page.getByText('Click a highlighted trace vertex')).toBeVisible();
 await canvas.click({position:{x:250,y:250}});
 await expect(page.getByText('Click the corrected corner position')).toBeVisible();
 await expect(page.getByText('Corner 1 selected',{exact:true})).toBeVisible();
 await canvas.click({position:{x:226,y:226}});
 await panel.getByRole('button',{name:'Preview assembly changes'}).click();
 await expect(panel.getByText('Perimeter correction',{exact:true})).toBeVisible();
 await expect(panel.getByRole('button',{name:'Apply assembly changes'})).toBeEnabled();
 expect(foundation(await projectSnapshot(page))).toEqual(original);
 await panel.getByRole('button',{name:'Apply assembly changes'}).click();
 const corrected=foundation(await projectSnapshot(page));
 expect(corrected.foundationAssemblies![0].traceCorrections![0].previousTrace).toEqual(original.foundationAssemblies![0].trace);
 expect(corrected.foundationAssemblies![0].children).toEqual(original.foundationAssemblies![0].children);
 await panel.getByText('Project presets',{exact:true}).click();
 await panel.getByLabel('Preset name').fill('Reviewed walls');
 await panel.getByRole('button',{name:'Save preset version'}).click();
 await panel.getByRole('button',{name:'Use confirmed preset in draft'}).click();
 await panel.getByRole('button',{name:'Preview assembly changes'}).click();
 await panel.getByRole('button',{name:'Apply assembly changes'}).click();
 const withPreset=await projectSnapshot(page);
 expect(foundation(withPreset).foundationAssemblies![0].preset?.version.version).toBe(1);
 await panel.getByLabel('Preset name').fill('Reviewed walls revision');
 await panel.getByRole('button',{name:'Save preset version'}).click();
 const saved=await projectSnapshot(page);
 expect(saved.foundationPresets![0].versions).toHaveLength(2);
 expect(foundation(saved).foundationAssemblies![0].preset?.version.version).toBe(1);
 await showTab(page,'Quantities');
 await panel.getByText('Assembly material quantities',{exact:true}).click();
 await page.getByRole('button',{name:'Metric (m)',exact:true}).click();
 await expect(panel.getByText(/Poured concrete · wall concrete · [0-9.]+ m³/)).toBeVisible();
 expect(foundation(await projectSnapshot(page))).toEqual(foundation(saved));
 await showTab(page,'Construction');
 await panel.getByText('Advanced assembly inputs',{exact:true}).click();
 await panel.getByLabel('Ownership group').selectOption({label:'Walls'});
 await panel.getByLabel('Confirmed detachment reason').fill('Walls taken off by another trade');
 await panel.getByRole('button',{name:'Preview detachment'}).click();
 await expect(panel.getByText(/4 released as independent/)).toBeVisible();
 await panel.getByRole('button',{name:'Apply assembly changes'}).click();
 const detached=foundation(await projectSnapshot(page));
 expect(detached.measurements).toEqual(foundation(saved).measurements);
 expect(detached.foundationAssemblies![0].children).toHaveLength(0);
 expect(detached.foundationAssemblies![0].detachments).toHaveLength(4);
 await page.getByTitle('Undo (Ctrl+Z)',{exact:true}).click();
 expect(foundation(await projectSnapshot(page))).toEqual(foundation(saved));
 await page.getByTitle('Redo (Ctrl+Y)',{exact:true}).click();
 expect(foundation(await projectSnapshot(page))).toEqual(detached);
});

test('standard irregular trace opens coordinated construction, cancels, and applies an inside-face slab atomically',async({page})=>{
 const canvas=page.locator('canvas').first();
 const panel=page.getByRole('region',{name:'Foundation assemblies',exact:true});
 const click=async(name:string)=>page.getByRole('button',{name,exact:true}).click();
 const trace=async()=>{
  await click('Polygon foundation perimeter');
  for(const p of [{x:200,y:200},{x:500,y:200},{x:500,y:320},{x:380,y:320},{x:380,y:440},{x:200,y:440}])await canvas.click({position:p});
  await click('Finish foundation polygon');
  await click('Specify foundation construction');
  await expect(panel.getByRole('heading',{name:'Specify foundation construction'})).toBeVisible();
  await expect(page.getByLabel('Uncommitted foundation trace')).toBeVisible();
 };
 await trace();
 await click('Cancel assembly changes');
 expect(await snapshot(page)).toEqual([]);
 await trace();
 await expect(panel.getByRole('group',{name:'Walls',exact:true}).getByLabel('Material',{exact:true})).toHaveValue('poured concrete');
 await panel.getByLabel('Wall thickness (in)',{exact:true}).fill('8 1/2');
 await panel.getByLabel('Wall height (ft)',{exact:true}).fill("8' 0\"");
 await expect(panel.getByText(/Wall base is the local estimating reference/)).toBeVisible();
 await panel.getByText('Strip footing · pending',{exact:true}).click();
 await panel.getByLabel('Strip footing scope').selectOption('included');
 const footing=panel.getByRole('group',{name:'Strip footing',exact:true});
 await expect(footing.getByLabel('Material',{exact:true})).toHaveValue('poured concrete');
 await footing.getByLabel('Footing width (in)').fill('24');
 await footing.getByLabel('Footing depth (in)').fill('6');
 await panel.getByText('Slab · pending',{exact:true}).click();
 await panel.getByLabel('Slab scope').selectOption('included');
 const slab=panel.getByRole('group',{name:'Slab',exact:true});
 await expect(slab.getByLabel('Material',{exact:true})).toHaveValue('poured concrete');
 await slab.getByLabel('Slab thickness (in)').fill('4');
 await click('Preview assembly changes');
 await expect(panel.getByRole('table',{name:'Preview quantities'})).toContainText('slab concrete');
 expect(await snapshot(page)).toEqual([]);
 await click('Apply assembly changes');
 const saved=await snapshot(page);
 expect(saved.filter(e=>e.kind==='foundationWall')).toHaveLength(6);
 expect(saved.filter(e=>e.kind==='stripFooting'&&e.elevationFt===-.5)).toHaveLength(6);
 expect(saved.filter(e=>e.kind==='slab'&&e.elevationFt===0)).toHaveLength(1);
 await showTab(page,'Geometry');
 await expect(panel.getByRole('button',{name:'Edit perimeter',exact:true})).toBeVisible();
 await page.getByTitle('Undo (Ctrl+Z)',{exact:true}).click();
 expect(await snapshot(page)).toEqual([]);
 await page.getByTitle('Redo (Ctrl+Y)',{exact:true}).click();
 expect(await snapshot(page)).toEqual(saved);
});

test('independent polygon slab uses coordinated construction and atomic Apply',async({page})=>{
 await page.getByRole('button',{name:'Draw polygon slab',exact:true}).click();
 await expect(page.getByLabel('Foundation drawing mode')).toHaveValue('polygon');
 const canvas=page.locator('canvas').first();
 for(const p of [{x:200,y:200},{x:500,y:200},{x:400,y:400}])await canvas.click({position:p});
 await page.getByRole('button',{name:'Finish foundation polygon',exact:true}).click();
 const panel=page.getByRole('region',{name:'Foundation assemblies',exact:true});
 await expect(panel.getByRole('heading',{name:'Specify slab construction'})).toBeVisible();
 await expect(page.getByLabel('Uncommitted foundation trace')).toBeVisible();
 expect(await snapshot(page)).toEqual([]);
 const slab=panel.getByRole('group',{name:'Slab',exact:true});
 await expect(slab.getByLabel('Material',{exact:true})).toHaveValue('poured concrete');
 await slab.getByLabel('Slab thickness (in)').fill('4');
 const actions=panel.getByRole('group',{name:'Construction transaction'});
 await actions.getByRole('button',{name:'Preview assembly changes'}).click();
 await expect(panel.getByText(/full confirmed slab footprint/)).toBeVisible();
 await actions.getByRole('button',{name:'Apply assembly changes'}).click();
 expect((await snapshot(page)).map(e=>e.kind)).toEqual(['slab']);
 await expect(page.getByLabel('Uncommitted foundation trace')).toHaveCount(0);
 await page.getByTitle('Undo (Ctrl+Z)',{exact:true}).click();
 expect(await snapshot(page)).toEqual([]);
});

test('new slab draft retains its geometry and inputs across foundation workspaces',async({page})=>{
 const canvas=page.locator('canvas').first();
 const panel=page.getByRole('region',{name:'Foundation assemblies',exact:true});
 await page.getByRole('button',{name:'Draw rectangular slab',exact:true}).click();
 await canvas.click({position:{x:200,y:200}});
 await canvas.click({position:{x:500,y:440}});
 await page.getByRole('button',{name:'Specify slab construction',exact:true}).click();
 const slab=panel.getByRole('group',{name:'Slab',exact:true});
 await slab.getByLabel('Material',{exact:true}).selectOption('poured concrete');
 await slab.getByLabel('Slab thickness (in)').fill('6');
 await expect(page.getByLabel('Uncommitted foundation trace')).toBeVisible();
 await page.getByRole('button',{name:'+ Add workspace',exact:true}).click();
 await page.getByLabel('Workspace type').selectOption('foundation');
 await page.getByLabel('New workspace name').fill('Second foundation');
 await page.getByRole('button',{name:'Create',exact:true}).click();
 await expect(page.getByLabel('Uncommitted foundation trace')).toHaveCount(0);
 await page.getByRole('button',{name:'Synthetic foundation · Foundation',exact:true}).click();
 await expect(page.getByLabel('Uncommitted foundation trace')).toBeVisible();
 await expect(slab.getByLabel('Slab thickness (in)')).toHaveValue('6');
 await panel.getByRole('button',{name:'Preview assembly changes',exact:true}).click();
 await expect(page.getByLabel('Uncommitted foundation trace')).toBeVisible();
 await panel.getByRole('button',{name:'Apply assembly changes',exact:true}).click();
 expect((await snapshot(page)).map(e=>e.kind)).toEqual(['slab']);
});

test('subsequent foundation drafts survive rejected overlap and commit separately',async({page})=>{
 const canvas=page.locator('canvas').first();
 const panel=page.getByRole('region',{name:'Foundation assemblies',exact:true});
 const click=(name:string)=>page.getByRole('button',{name,exact:true}).click();
 const point=(x:number,y:number)=>canvas.click({position:{x,y}});
 const rectangle=async(x:number,y:number)=>{
  await click('Rectangle foundation');
  await point(x,y);
  await point(x+160,y+130);
  await click('Specify foundation construction');
 };
 const specify=async()=>{
  const walls=panel.getByRole('group',{name:'Walls',exact:true});
  await expect(walls.getByLabel('Material',{exact:true})).toHaveValue('poured concrete');
  await walls.getByLabel('Wall thickness (in)').fill('8');
  await walls.getByLabel('Wall height (ft)').fill('8');
  await expect(panel.getByText(/Wall base is the local estimating reference/)).toBeVisible();
  await click('Preview assembly changes');
  await expect(page.getByLabel('Uncommitted foundation trace')).toBeVisible();
 };
 await rectangle(160,200);
 await specify();
 await click('Apply assembly changes');
 const first=await snapshot(page);
 expect(first).toHaveLength(4);
 await rectangle(160,200);
 await specify();
 await expect(panel.getByRole('button',{name:'Apply assembly changes'})).toBeDisabled();
 expect(await snapshot(page)).toEqual(first);
 await showTab(page,'Construction');
 await expect(panel.getByLabel('Wall thickness (in)')).toHaveValue('8');
 await click('Cancel assembly changes');
 await rectangle(380,200);
 await specify();
 await click('Apply assembly changes');
 expect(await snapshot(page)).toHaveLength(8);
 await click('Polygon foundation perimeter');
 for(const [x,y] of [[160,440],[460,440],[460,540],[360,540],[360,650],[160,650]])await point(x,y);
 await click('Finish foundation polygon');
 await click('Specify foundation construction');
 await specify();
 await click('Apply assembly changes');
 const committed=await snapshot(page);
 expect(committed).toHaveLength(14);
 await showTab(page,'Geometry');await page.getByLabel('Foundation component filter').selectOption('foundationWall');
 expect(await snapshot(page)).toEqual(committed);
 await page.getByTitle('Undo (Ctrl+Z)',{exact:true}).click();
 expect(await snapshot(page)).toHaveLength(8);
 await page.getByTitle('Redo (Ctrl+Y)',{exact:true}).click();
 expect(await snapshot(page)).toEqual(committed);
 await showTab(page,'Quantities');
 const wallQuantity=page.getByText('wall concrete',{exact:true}).locator('../..').filter({hasText:'Poured concrete'});
 const priorQuantity=(await wallQuantity.innerText()).split('\n').at(-1);
 await click('Foundation wall');
 await point(630,420);
 await point(740,420);
 const editor=page.getByRole('form',{name:'Independent wall construction'});
 const assemblyRegion=page.getByRole('region',{name:'Foundation assemblies'});
 await expect(editor).toBeVisible();
 expect((await editor.boundingBox())!.y).toBeLessThan((await assemblyRegion.boundingBox())!.y);
 await expect(editor.getByLabel('Material',{exact:true})).toHaveValue('poured concrete');
 expect((await snapshot(page)).filter(entity=>entity.kind==='foundationWall')).toHaveLength(15);
 await showTab(page,'Quantities');
 await expect(wallQuantity).toContainText(priorQuantity!);
 await page.getByText('Measurement checks',{exact:true}).click();
 await expect(page.getByText(/Enter the component width to determine its footprint/).filter({visible:true})).toHaveCount(1);

});

test('exact standard slab dimensions, footprint correction and confirmed assembly deletion are atomic',async({page})=>{
 const canvas=page.locator('canvas').first();
 const panel=page.getByRole('region',{name:'Foundation assemblies',exact:true});
 const click=(name:string)=>page.getByRole('button',{name,exact:true}).click();
 await click('Draw rectangular slab');
 await canvas.click({position:{x:240,y:240}});
 await canvas.click({position:{x:530,y:430}});
 await page.keyboard.type('20,20');
 await page.keyboard.press('Enter');
 await click('Specify slab construction');
 await showTab(page,'Geometry');
 await expect(page.getByLabel('Construction footprint')).toContainText('20.00 LF × 20.00 LF');
 await showTab(page,'Construction');
 const slab=panel.getByRole('group',{name:'Slab',exact:true});
 await expect(slab.getByLabel('Material',{exact:true})).toHaveValue('poured concrete');
 await expect(page.getByRole('button',{name:'Foundation wall',exact:true})).toBeDisabled();
 await slab.getByLabel('Slab thickness (in)').fill('6');
 await click('Preview assembly changes');
 await expect(panel.getByRole('table',{name:'Preview quantities'})).toContainText('7.41 CY');
 await click('Apply assembly changes');
 expect(await snapshot(page)).toHaveLength(1);
 await showTab(page,'Geometry');
 await click('Edit slab footprint');
 await canvas.click({position:{x:240,y:240}});
 await canvas.click({position:{x:215,y:215}});
 await click('Preview assembly changes');
 await click('Apply assembly changes');
 const corrected=await snapshot(page);
 expect(corrected).toHaveLength(1);
 await showTab(page,'Geometry');
 await click('Delete assembly');
 await expect(panel.getByText('Review assembly deletion',{exact:true})).toBeVisible();
 page.once('dialog',dialog=>dialog.dismiss());
 await click('Confirm delete assembly');
 expect(await snapshot(page)).toEqual(corrected);
 page.once('dialog',dialog=>dialog.accept());
 await click('Confirm delete assembly');
 expect(await snapshot(page)).toEqual([]);
 await page.getByTitle('Undo (Ctrl+Z)',{exact:true}).click();
 expect(await snapshot(page)).toEqual(corrected);
 await page.getByTitle('Redo (Ctrl+Y)',{exact:true}).click();
 expect(await snapshot(page)).toEqual([]);
});

test('layered inspector preserves a draft, visual previews and exterior material rules across tabs',async({page},info)=>{
 const canvas=page.locator('canvas').first();
 const panel=page.getByRole('region',{name:'Foundation assemblies'});
 const click=(name:string)=>page.getByRole('button',{name,exact:true}).click();
 await click('Rectangle foundation');
 await canvas.click({position:{x:225,y:230}});
 await canvas.click({position:{x:510,y:475}});
 await page.keyboard.type('20,20');
 await page.keyboard.press('Enter');
 await click('Specify foundation construction');
 const walls=panel.getByRole('group',{name:'Walls',exact:true});
 await expect(walls.getByLabel('Material',{exact:true})).toHaveValue('poured concrete');
 await walls.getByLabel('Wall thickness (in)').fill('8');
 await walls.getByLabel('Wall height (ft)').fill('8');
 await page.screenshot({path:info.outputPath('01-initial-construction.png')});
 await showTab(page,'Geometry');
 await expect(page.getByLabel('Construction footprint')).toContainText('20.00 LF');
 await expect(page.getByRole('group',{name:'Construction transaction'})).toBeVisible();
 await page.screenshot({path:info.outputPath('02-geometry.png')});
 await showTab(page,'Construction');
 await expect(walls.getByLabel('Wall height (ft)')).toHaveValue('8');
 await click('Add waterproofing');
 const waterproofing=panel.getByRole('group',{name:'Exterior layer 1',exact:true});
 await waterproofing.getByLabel('Material',{exact:true}).selectOption('sheet waterproofing membrane');
 await waterproofing.getByLabel('Confirm full wall height as coverage').check();
 await expect(waterproofing.getByLabel('Layer thickness (in)')).toHaveCount(0);
 await click('Add vertical insulation');
 const insulation=panel.getByRole('group',{name:'Exterior layer 2',exact:true});
 await insulation.getByLabel('Material',{exact:true}).selectOption('xps');
 await insulation.getByLabel('Confirm full wall height as coverage').check();
 await insulation.getByLabel('Layer thickness (in)').fill('2');
 await panel.getByLabel('Confirm exterior layer order').check();
 await panel.getByText('Strip footing · pending',{exact:true}).click();
 await panel.getByLabel('Strip footing scope').selectOption('included');
 const footing=panel.getByRole('group',{name:'Strip footing',exact:true});
 await expect(footing.getByLabel('Material',{exact:true})).toHaveValue('poured concrete');
 await footing.getByLabel('Footing width (in)').fill('24');
 await footing.getByLabel('Footing depth (in)').fill('6');
 await page.screenshot({path:info.outputPath('03-exterior-protection.png')});
 await click('Preview assembly changes');
 await expect(page.getByRole('tab',{name:'Quantities'})).toHaveAttribute('aria-selected','true');
 await expect(panel.getByRole('table',{name:'Preview quantities'})).toContainText('15.28 CY');
 await expect(panel.getByRole('table',{name:'Preview quantities'})).toContainText('2.86 CY');
 await page.screenshot({path:info.outputPath('04-preview-and-quantities.png')});
 await showTab(page,'Construction');
 await expect(panel.getByRole('button',{name:'Apply assembly changes'})).toBeEnabled();
 await click('Apply assembly changes');
 const saved=await projectSnapshot(page);
 const assembly=saved.workspaces.find(w=>w.type==='foundation')!.foundationAssemblies![0];
 expect(assembly.specifications.exteriorLayers).toHaveLength(2);
 expect(assembly.specifications.exteriorSequence?.status).toBe('confirmed');
 await showTab(page,'Construction');
 await click('Edit assembly');
 await expect(panel.getByRole('group',{name:'Exterior layer 1',exact:true})).not.toBeVisible();
 await page.screenshot({path:info.outputPath('05-saved-collapsed.png')});
 await showTab(page,'Quantities');
 await expect(page.getByRole('heading',{name:'Workspace material totals'})).toBeVisible();
 await page.screenshot({path:info.outputPath('06-workspace-quantities.png')});
 await showTab(page,'Construction');
 await panel.locator('summary').filter({hasText:'1. Waterproofing'}).click();
 await click('Move layer 1 outward');
 await expect(panel.getByLabel('Confirm exterior layer order')).not.toBeChecked();
 await panel.getByLabel('Confirm exterior layer order').check();
 await click('Preview assembly changes');
 const reorderedReview=panel.getByRole('table',{name:'Preview quantities'});
 await expect(reorderedReview.getByRole('row').filter({hasText:'waterproofing area'}).getByRole('cell')).toHaveText(['640.00 SF','640.00 SF']);
 await click('Apply assembly changes');
 const reordered=(await projectSnapshot(page)).workspaces.find(w=>w.type==='foundation')!.foundationAssemblies![0];
 expect(reordered.specifications.exteriorLayers.map(layer=>layer.id)).toEqual(assembly.specifications.exteriorLayers.map(layer=>layer.id).reverse());
 expect(reordered.children.map(child=>child.entityId).sort()).toEqual(assembly.children.map(child=>child.entityId).sort());
 await click('Foundation wall');
 await canvas.click({position:{x:720,y:255}});
 await canvas.click({position:{x:835,y:255}});
 const wall=page.getByRole('form',{name:'Independent wall construction'});
 await expect(wall.getByLabel('Material',{exact:true})).toHaveValue('poured concrete');
 await expect(panel.getByRole('group',{name:'Walls',exact:true})).not.toBeVisible();
 await page.screenshot({path:info.outputPath('07-independent-wall.png')});
 await page.setViewportSize({width:1366,height:900});
 await page.screenshot({path:info.outputPath('08-independent-wall-1366.png')});
});

test('independent wall construction validates previews and edits source-linked layers atomically',async({page,browser},info)=>{
 await place(page,'Foundation wall',{x:250,y:250},{x:550,y:250},'25');
 const wall=page.getByRole('form',{name:'Independent wall construction'});
 const panel=page.getByRole('region',{name:'Independent wall layers'});
 const actions=panel.getByRole('group',{name:'Wall construction transaction'});
 const preview=actions.getByRole('button',{name:'Preview',exact:true});
 const apply=actions.getByRole('button',{name:'Apply',exact:true});
 const cancel=actions.getByRole('button',{name:'Cancel',exact:true});
 await expect(wall.getByLabel('Material',{exact:true})).toHaveValue('poured concrete');
 await wall.getByLabel('Wall thickness (in)',{exact:true}).fill('8');
 await wall.getByLabel('Wall height (ft)',{exact:true}).fill('8');
 await wallElevation(page);
 await wall.getByLabel('Base elevation (ft; blank unknown)',{exact:true}).fill('0');
 await page.screenshot({path:info.outputPath('01-independent-wall.png')});
 const [draftWall]=await snapshot(page);
 await preview.click();
 await expect(panel.getByRole('region',{name:'Wall construction preview'})).toContainText('4.94 CY');
 expect(await snapshot(page)).toEqual([draftWall]);
 await showTab(page,'Construction');
 await wall.getByLabel('Wall height (ft)',{exact:true}).fill('7');
 await expect(apply).toBeDisabled();
 await cancel.click();
 expect(await snapshot(page)).toEqual([draftWall]);
 await wall.getByLabel('Wall thickness (in)',{exact:true}).fill('8');
 await wall.getByLabel('Wall height (ft)',{exact:true}).fill('8');
 await wallElevation(page);
 await wall.getByLabel('Base elevation (ft; blank unknown)',{exact:true}).fill('0');
 await preview.click();await apply.click();
 const [source]=await snapshot(page);
 await panel.getByRole('button',{name:'Add strip footing',exact:true}).click();
 await panel.getByLabel('Footing width (in)').fill('24');
 await panel.getByLabel('Footing depth (in)').fill('6');
 await preview.click();
 await expect(panel.getByRole('region',{name:'Wall construction preview'})).toContainText('0.93 CY');
 await showTab(page,'Geometry');
 await expect(apply).toBeEnabled();
 await expect(page.getByLabel('Foundation graphical preview')).toBeVisible();
 await apply.click();
 await panel.getByRole('button',{name:'Add waterproofing',exact:true}).click();
 await panel.getByLabel('Layer material').selectOption('sheet waterproofing membrane');
 await panel.getByLabel('Coverage height (ft)').fill('8');
 await preview.click();
 await expect(panel.getByRole('alert')).toContainText('Select the exterior side');
 await panel.getByLabel('Exterior side').selectOption('right');
 await preview.click();
 await expect(panel.getByRole('region',{name:'Wall construction preview'})).toContainText('200.00 SF');
 await page.screenshot({path:info.outputPath('02-active-preview.png')});
 await apply.click();
 await panel.getByRole('button',{name:'Add vertical insulation',exact:true}).click();
 await panel.getByLabel('Layer material').selectOption('xps');
 await panel.getByLabel('Coverage height (ft)').fill('8');
 await panel.getByLabel('Insulation thickness (in)').fill('2');
 await panel.getByLabel('Exterior side').selectOption('right');
 await preview.click();await apply.click();
 const saved=await snapshot(page);
 expect(saved.find(e=>e.id===source.id)).toEqual(source);
 expect(saved.find(e=>e.kind==='stripFooting')?.foundation?.stripSource?.wallId).toBe(source.id);
 expect(saved.filter(e=>e.foundation?.envelopeSource?.sourceId===source.id).map(e=>e.foundation?.envelopeSource?.side)).toEqual(['right','right']);
 await panel.locator('summary').filter({hasText:'Strip footing · No explicit decision'}).click();
 await panel.getByRole('button',{name:'Edit strip footing',exact:true}).click();
 await expect(panel.getByLabel('Footing width (in)')).toHaveValue('24');
 await expect(panel.getByLabel('Footing depth (in)')).toHaveValue('6');
 await panel.getByLabel('Footing depth (in)').fill('8');
 await page.screenshot({path:info.outputPath('03-edit-footing.png')});
 await preview.click();await apply.click();
 const revised=await snapshot(page);
 expect(revised.map(e=>e.id)).toEqual(saved.map(e=>e.id));
 await page.getByTitle('Undo (Ctrl+Z)',{exact:true}).click();
 expect(await snapshot(page)).toEqual(saved);
 await page.getByTitle('Redo (Ctrl+Y)',{exact:true}).click();
 expect(await snapshot(page)).toEqual(revised);
 await selectFoundationEntity(page,source.id);
 await panel.locator('summary').filter({hasText:'Waterproofing · No explicit decision'}).click();
 await panel.getByRole('button',{name:'Remove waterproofing',exact:true}).click();
 await preview.click();await apply.click();
 const removed=await projectSnapshot(page);
 expect(removed.workspaces.find(w=>w.type==='foundation')!.measurements).toHaveLength(3);
 const reopened=await browser.newPage();
 try{
   const reopenErrors:string[]=[];
   reopened.on('pageerror',error=>reopenErrors.push(error.message));
   await reopened.goto(page.url());
   await reopened.getByTitle('Import JSON Project').locator('input').setInputFiles({name:'wall.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(removed))});
   await expect(reopened.getByRole('heading',{name:'Foundation tools'})).toBeVisible();
   expect(await projectSnapshot(reopened)).toEqual(removed);
   expect(reopenErrors).toEqual([]);
 }finally{
   await reopened.close();
 }
});

test('standalone slab defaults and applicable layers produce the controlled material totals',async({page})=>{
 const panel=page.getByRole('region',{name:'Foundation assemblies'});
 const click=(name:string)=>page.getByRole('button',{name,exact:true}).click();
 await click('Draw rectangular slab');
 const canvas=page.locator('canvas').first();
 await canvas.click({position:{x:200,y:200}});
 await canvas.click({position:{x:510,y:460}});
 await page.keyboard.type('20,20');
 await page.keyboard.press('Enter');
 await click('Specify slab construction');
 const slab=panel.getByRole('group',{name:'Slab',exact:true});
 await expect(slab.getByLabel('Material',{exact:true})).toHaveValue('poured concrete');
 await slab.getByLabel('Slab thickness (in)').fill('6');
 for(const [system,product,thickness] of [['Under-slab insulation','xps','2'],['Granular fill','pea gravel','6']]){
   await panel.getByText(system+' · pending',{exact:true}).click();
   const card=panel.getByRole('group',{name:system,exact:true});
   await card.getByLabel(system+' scope').selectOption('included');
   await card.getByLabel('Material',{exact:true}).selectOption(product);
   await card.getByLabel('Layer thickness (in)').fill(thickness);
 }
 await click('Preview assembly changes');
 const table=panel.getByRole('table',{name:'Preview quantities'});
 for(const [label,value] of [['slab concrete','7.41 CY'],['insulation area','400.00 SF'],['insulation foam','800.00 BF'],['granular volume','7.41 CY']])
   await expect(table.getByRole('row').filter({hasText:label})).toContainText(value);
 await click('Apply assembly changes');
 expect((await snapshot(page)).map(e=>e.kind)).toEqual(['slab','foundationRegion','foundationRegion']);
});

test('new independent pad and strip footings propose poured concrete',async({page})=>{
 const canvas=page.locator('canvas').first();
 await page.getByRole('button',{name:'Pad footing',exact:true}).click();
 await canvas.click({position:{x:230,y:210}});
 await canvas.click({position:{x:330,y:310}});
 const properties=page.getByRole('form',{name:'Independent component construction'});
 await expect(properties.getByLabel('Material',{exact:true})).toHaveValue('poured concrete');
 await properties.getByLabel('Depth (in)').fill('12');
 await applyProperties(page);
 await page.getByRole('button',{name:'Strip footing',exact:true}).click();
 await canvas.click({position:{x:510,y:270}});
 await canvas.click({position:{x:730,y:270}});
 await expect(properties.getByLabel('Material',{exact:true})).toHaveValue('poured concrete');
 expect((await snapshot(page)).map(e=>e.kind)).toEqual(['padFooting','stripFooting']);
});

test('workspace takeoff displays separate material specifications and non-additive subtotals',async({page},info)=>{
 const doc=await projectSnapshot(page);
 const workspace=doc.workspaces.find(w=>w.type==='foundation')!;
 const region=(id:string,material:string,purpose:'granular'|'insulation',x:number,depthFt:number):FoundationEntity=>({
   id,physicalId:id,assemblyId:id,source:{reference:'Synthetic material takeoff'},
   kind:'foundationRegion',purpose,depthFt,elevationFt:0,
   polygon:[{x,y:0},{x:x+20,y:0},{x:x+20,y:20},{x,y:20}],
   foundation:{version:1,material,baseElevationConfirmed:true,...(purpose==='insulation'?{coverage:{confirmed:true,layerId:id,foam:true}}:{})},
 });
 workspace.measurements=[
   region('gravel-a','clear crushed stone','granular',0,.5),region('gravel-b','clear crushed stone','granular',30,.5),
   region('sand','sand','granular',60,.5),region('xps-2','xps','insulation',90,2/12),
   region('xps-3','xps','insulation',120,3/12),region('mineral','rigid mineral wool','insulation',150,2/12),
 ];
 page.once('dialog',dialog=>void dialog.accept());
 await page.getByTitle('Import JSON Project').locator('input').setInputFiles({name:'takeoff.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(doc))});
 await showTab(page,'Quantities');
 const granular=page.locator('details').filter({has:page.locator('summary').filter({hasText:'Granular materials'})});
 const insulation=page.locator('details').filter({has:page.locator('summary').filter({hasText:/^Insulation/})});
 await expect(granular.locator('summary')).toContainText('22.22 CY subtotal');
 await expect(granular.getByText('Clear crushed stone',{exact:true})).not.toBeVisible();
 await page.screenshot({path:info.outputPath('04-category-summaries.png')});
 await granular.locator('summary').click();
 await insulation.locator('summary').click();
 await expect(granular.getByRole('listitem').filter({hasText:'Clear crushed stone'})).toContainText('14.81 CY');
 await expect(granular.getByRole('listitem').filter({hasText:'Sand'})).toContainText('7.41 CY');
 await expect(insulation.getByText('XPS · 2.00 in',{exact:true})).toBeVisible();
 await expect(insulation.getByText('XPS · 3.00 in',{exact:true})).toBeVisible();
 const informational=page.locator('details').filter({has:page.locator('summary').filter({hasText:/^Informational/})});
 await informational.locator('summary').click();
 await expect(informational.getByRole('listitem')).toHaveCount(2);
 await expect(informational.getByText(/mineral wool/i)).toHaveCount(0);
 await page.screenshot({path:info.outputPath('05-material-specific-totals.png')});
 await page.setViewportSize({width:1366,height:900});
 await page.getByRole('button',{name:'Metric (m)',exact:true}).click();
 await expect(insulation.getByText('XPS · 50.80 mm',{exact:true})).toBeVisible();
 await page.screenshot({path:info.outputPath('06-material-totals-metric-1366.png')});
});
