import {
  expect,
  test,
  type Page,
} from '@playwright/test';

const strongLines = [
  '我把你一个人晾在妈妈的生日饭桌上。你还得独自替我圆场，这个难堪是我选择逃开造成的。',
  '我听见你在问我是否认真。你在饭桌上等我出现，我却让你独自撑着。我的答案是：我选择这段关系，也选择站在你身边。你现在最需要我先听哪一件事？',
  '那张空椅子让你在妈妈面前难堪。明天十点我们一起去见她，我来订位置、提前确认行程；我们当面把这顿饭补上，并把它写进日历。',
  '今晚我先把手机放下，听你把饭桌上的难堪说完。明早我们一起核对安排，我会亲口回答她那句“你是认真的吗”。',
];

test('plays the authored high-quality path into the S ending', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.goto('/');
  const provider = await readProvider(page);
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    '凌晨一点',
  );
  await expect(page.getByTestId('provider-badge')).toContainText(
    provider === 'mock' ? '本地导演模式' : '实时导演',
  );

  await page.getByTestId('start-game').click();
  await expect(page.getByTestId('dialogue-input')).toBeVisible();
  await expect(page.getByTestId('latest-line')).toContainText('七句话');

  for (let round = 1; round <= strongLines.length; round += 1) {
    await page.getByTestId('dialogue-input').fill(
      strongLines[round - 1],
    );
    await page.getByTestId('send-line').click();
    if (round < strongLines.length) {
      await expect(page.getByTestId('round-counter')).toContainText(
        String(7 - round),
        {
          timeout: 30_000,
        },
      );
      await expect(page.getByTestId('dialogue-input')).toBeEnabled({
        timeout: 30_000,
      });
      await expect(page.getByTestId('usage-meter')).toContainText(
        `模型 ${round * 2} 次`,
      );
    }
  }

  await expect(page.getByTestId('result-screen')).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByTestId('result-screen')).toContainText('早餐还热');
  if (provider === 'mock') {
    await expect(page.getByTestId('result-screen')).toContainText(
      '人形关系补丁',
    );
  }
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
  test.setTimeout(60_000);
  await page.goto('/');
  const provider = await readProvider(page);
  await page.getByTestId('start-game').click();

  await page.getByTestId('dialogue-input').fill('对 不 起，我来晚了。');
  await page.getByTestId('send-line').click();
  await expect(page.getByTestId('restriction-count')).toContainText(
    '已触发 1 次',
    {
      timeout: 30_000,
    },
  );

  await page.getByTestId('dialogue-input').fill('抱歉，我又说了一次。');
  await page.getByTestId('send-line').click();
  await expect(page.getByTestId('result-screen')).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByTestId('result-screen')).toContainText(
    '道歉过敏原',
  );
  if (provider === 'mock') {
    await expect(page.getByTestId('result-screen')).toContainText(
      '禁词连招大师',
    );
  }
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

async function readProvider(
  page: Page,
): Promise<'mock' | 'openai' | 'deepseek'> {
  const response = await page.request.get('/api/capabilities');
  const payload = (await response.json()) as {
    textProvider: 'mock' | 'openai' | 'deepseek';
  };
  return payload.textProvider;
}
