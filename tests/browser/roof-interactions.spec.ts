import { test, expect, type Page } from '@playwright/test';

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
