import { test, expect } from '@playwright/test';

test.describe('R2 renderer regression', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.waitForTimeout(1500);
    const start = page.locator('[data-action="home-start"]');
    if (await start.isVisible()) await start.click();
  });

  test('game stays centered and canvas matches physical pixels', async ({ page }) => {
    const dimensions = await page.evaluate(() => {
      const shell = document.querySelector('#game')!.getBoundingClientRect();
      const canvas = document.querySelector<HTMLCanvasElement>('#scene')!;
      return {
        center: shell.left + shell.width / 2,
        viewportCenter: document.documentElement.clientWidth / 2,
        pixelWidth: canvas.width,
        pixelHeight: canvas.height,
        expectedWidth: Math.round(shell.width * window.devicePixelRatio),
        expectedHeight: Math.round(shell.height * window.devicePixelRatio),
      };
    });
    expect(dimensions.center).toBeCloseTo(dimensions.viewportCenter, 0);
    expect(dimensions.pixelWidth).toBe(dimensions.expectedWidth);
    expect(dimensions.pixelHeight).toBe(dimensions.expectedHeight);
    await page.setViewportSize({ width: 1024, height: 768 });
    const resizedCenter = await page.locator('#game').boundingBox();
    expect(resizedCenter).not.toBeNull();
    expect(resizedCenter!.x + resizedCenter!.width / 2).toBeCloseTo(512, 0);
  });

  test('home overlay does not blur the game', async ({ page }) => {
    await page.reload();
    await expect(page.locator('[data-action="home-start"]')).toBeVisible();
    const filter = await page.locator('#modal').evaluate((element) => getComputedStyle(element).backdropFilter);
    expect(filter).toBe('none');
  });

  test('real pointer input advances the authoritative fitted counter', async ({ page }) => {
    await expect(page.locator('#fit-count')).toHaveText('0 / 12');
    await page.locator('.piece-hit').first().click();
    await expect(page.locator('#fit-count')).toHaveText('1 / 12');
  });

  test('board pointer layer is above canvas and accepts input', async ({ page }) => {
    const hitTarget = await page.evaluate(() => {
      const button = document.querySelector('.piece-hit');
      if (!(button instanceof HTMLElement)) return null;
      const rect = button.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
      return hit?.className ?? null;
    });
    expect(hitTarget).toContain('piece-hit');
  });

  test('campaign modal contains Daily and Practice but no Editor player entry', async ({ page }) => {
    await page.click('#level-button');
    await page.waitForSelector('.level-card');
    await expect(page.locator('[data-action="daily-start"]')).toBeVisible();
    await expect(page.locator('[data-action="practice-open"]')).toBeVisible();
    await expect(page.locator('#editor-button')).toHaveCount(0);
  });

  test('SPIN decrements a real resource in a level with spins', async ({ page }) => {
    await page.click('#level-button');
    await page.locator('.level-card').nth(1).click();
    await expect(page.locator('#level-number')).toHaveText('02');
    await expect(page.locator('#spin-button')).toBeEnabled();
    await page.click('#spin-button');
    await expect(page.locator('#spin-count')).toHaveText('1');
  });
});
