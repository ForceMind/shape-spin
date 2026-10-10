import { test, expect } from '@playwright/test';

test('legacy active run restarts safely without losing global progress', async ({ page }) => {
  await page.addInitScript(() => {
    const state = {
      board: [], buffer: [], targets: [], activeTargetIndex: 0,
      spinsRemaining: 0, moves: 0, phase: 'playing',
    };
    localStorage.setItem('shape-spin-save-v2', JSON.stringify({
      schemaVersion: 2,
      progress: {
        schemaVersion: 1, completedLevelIds: ['campaign-001'], selectedLevelId: 'campaign-002',
        locale: 'zh-CN', soundEnabled: false, reducedMotion: false,
        rewardLedger: { 'campaign:first-clear:campaign-001': 10 },
      },
      activeRun: {
        schemaVersion: 2, ruleVersion: 2, savedAtMs: 1, mode: 'campaign',
        levelId: 'campaign-002', state, history: [],
        audit: { runId: 'old-run', startedAtMs: 0, hintCount: 0, undoCount: 0, spinsUsed: 0 },
      },
    }));
  });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('[data-action="home-start"]')).toBeVisible();
  await expect(page.locator('[data-action="home-start"]')).toContainText('主线闯关');
  await page.click('[data-action="home-start"]');
  await expect(page.locator('#level-number')).toHaveText('02');
  await expect(page.locator('#status')).toContainText('全局进度已保留');
  await expect(page.locator('#fit-count')).toHaveText('0 / 15');
  await page.click('#level-button');
  await expect(page.locator('.level-card').first()).toContainText('✓');
  expect(errors).toEqual([]);
});
