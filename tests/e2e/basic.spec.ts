import { test, expect } from '@playwright/test';

test.describe('Shape Spin E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.waitForTimeout(1500); // wait for async level loading
    const start = page.locator('[data-action="home-start"]');
    if (await start.isVisible()) await start.click();
  });

  test('home screen exposes primary player routes', async ({ page }) => {
    await page.reload();
    await page.waitForTimeout(1500);
    await expect(page.locator('[data-action="home-start"]')).toBeVisible();
    await expect(page.locator('[data-action="show-levels"]')).toBeVisible();
    await expect(page.locator('[data-action="daily-start"]')).toBeVisible();
    await expect(page.locator('[data-action="practice-open"]')).toBeVisible();
  });

  test('page loads with default zh-CN locale', async ({ page }) => {
    await expect(page).toHaveTitle(/Shape Spin/);
    const lang = await page.evaluate(() => document.documentElement.lang);
    expect(lang).toBe('zh-CN');
  });

  test('key game elements exist', async ({ page }) => {
    const elements = ['game', 'scene', 'sound-button', 'help-button', 'settings-button', 'level-button', 'spin-button', 'undo-button', 'restart-button', 'modal'];
    for (const id of elements) {
      await expect(page.locator(`#${id}`)).toBeAttached();
    }
  });

  test('help modal opens and closes', async ({ page }) => {
    await page.click('#help-button');
    await expect(page.locator('#modal')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#modal')).toBeHidden();
  });

  test('settings modal opens and closes', async ({ page }) => {
    await page.click('#settings-button');
    await expect(page.locator('#modal')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#modal')).toBeHidden();
  });

  test('level select modal shows 200 levels', async ({ page }) => {
    await page.click('#level-button');
    await expect(page.locator('#modal')).toBeVisible();
    await page.waitForSelector('.level-card', { timeout: 5000 });
    const levelCards = await page.locator('.level-card').count();
    expect(levelCards).toBe(200);
  });

  test('daily mode switches level', async ({ page }) => {
    await page.click('#level-button');
    await page.waitForSelector('[data-action="daily-start"]');
    await page.click('[data-action="daily-start"]');
    await page.waitForFunction(() => document.getElementById('level-title')?.textContent?.includes('每日挑战'), { timeout: 5000 });
    const after = await page.textContent('#level-title');
    expect(after).toContain('每日挑战');
  });

  test('practice mode switches level', async ({ page }) => {
    await page.click('#level-button');
    await page.waitForSelector('[data-action="practice-open"]');
    await page.click('[data-action="practice-open"]');
    await page.click('[data-action="practice-start"]');
    await page.waitForFunction(() => document.getElementById('level-title')?.textContent?.includes('自由练习'), { timeout: 5000 });
    const title = await page.textContent('#level-title');
    expect(title).toContain('自由练习');
  });

  test('editor is not exposed in the normal player flow', async ({ page }) => {
    await expect(page.locator('#editor-button')).toHaveCount(0);
    await page.click('#level-button');
    await page.waitForSelector('.level-card');
    await expect(page.locator('[data-action^="editor-"]')).toHaveCount(0);
  });

  test('editor is only exposed with explicit dev mode', async ({ page }) => {
    await page.goto('http://localhost:5173?dev=1');
    await page.waitForTimeout(1500);
    await expect(page.locator('[data-action="editor-open"]')).toBeVisible();
    await page.click('[data-action="editor-open"]');
    await expect(page.locator('#editor-grid')).toBeVisible();
  });

  test('spin button disabled when no spins', async ({ page }) => {
    // Campaign level 1 has 0 spins; wait for async init then check
    await page.waitForFunction(() => (document.getElementById('spin-button') as HTMLButtonElement)?.disabled === true, { timeout: 5000 });
  });

  test('keyboard shortcuts work', async ({ page }) => {
    // H opens help
    await page.keyboard.press('h');
    await expect(page.locator('#modal')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#modal')).toBeHidden();
  });

  test('no console errors on load', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.reload();
    await page.waitForTimeout(2000);
    expect(errors).toHaveLength(0);
  });
});
