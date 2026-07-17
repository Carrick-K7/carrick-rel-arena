import { expect, test } from '@playwright/test';

const strongLine =
  '我把你一个人晾在妈妈的生日饭桌上，是我选择逃开。明天十点我们一起去见她，我来订位置，这段关系对我很重要，我选择站在你身边。';

test('plays the authored high-quality path into the S ending', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    '凌晨一点',
  );
  await expect(page.getByTestId('provider-badge')).toContainText(
    '本地导演模式',
  );

  await page.getByTestId('start-game').click();
  await expect(page.getByTestId('dialogue-input')).toBeVisible();
  await expect(page.getByTestId('latest-line')).toContainText('七句话');

  for (let round = 1; round <= 4; round += 1) {
    await page.getByTestId('dialogue-input').fill(strongLine);
    await page.getByTestId('send-line').click();
    if (round < 4) {
      await expect(page.getByTestId('round-counter')).toContainText(
        String(7 - round),
      );
      await expect(page.getByTestId('dialogue-input')).toBeEnabled();
      await expect(page.getByTestId('usage-meter')).toContainText(
        `模型 ${round * 2} 次`,
      );
    }
  }

  await expect(page.getByTestId('result-screen')).toBeVisible();
  await expect(page.getByTestId('result-screen')).toContainText('早餐还热');
  await expect(page.getByTestId('result-screen')).toContainText(
    '人形关系补丁',
  );
  await expect(page.getByTestId('result-usage')).toContainText(
    '本局模型 9 次',
  );

  const usage = await page.request.get('/api/admin/usage');
  expect(usage.ok()).toBe(true);
  const usageJson = (await usage.json()) as {
    totals: { calls: number; totalTokens: number };
  };
  expect(usageJson.totals.calls).toBeGreaterThanOrEqual(9);
  expect(usageJson.totals.totalTokens).toBeGreaterThan(0);

  const metrics = await page.request.get('/api/admin/metrics');
  expect(metrics.ok()).toBe(true);
  await expect(metrics.text()).resolves.toContain(
    'relationship_arena_model_calls_total',
  );
});

test('enforces the apology restriction and exposes the special ending', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByTestId('start-game').click();

  await page.getByTestId('dialogue-input').fill('对 不 起，我来晚了。');
  await page.getByTestId('send-line').click();
  await expect(page.getByTestId('restriction-count')).toContainText(
    '已触发 1 次',
  );

  await page.getByTestId('dialogue-input').fill('抱歉，我又说了一次。');
  await page.getByTestId('send-line').click();
  await expect(page.getByTestId('result-screen')).toBeVisible();
  await expect(page.getByTestId('result-screen')).toContainText(
    '道歉过敏原',
  );
  await expect(page.getByTestId('result-screen')).toContainText(
    '禁词连招大师',
  );
});

test('keeps the game usable at a mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByTestId('start-game').click();
  await expect(page.getByTestId('dialogue-input')).toBeVisible();

  const horizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  expect(horizontalOverflow).toBe(false);
});
