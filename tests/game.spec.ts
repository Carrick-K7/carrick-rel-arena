import { expect, test, type Page } from '@playwright/test';

const genericStrongLine =
  '我知道你现在很难受，也在意你的真实需要。明天我们一起把具体安排定下来，你来选，也可以拒绝；我会陪你。';

const repairStrongLine =
  '我知道把你信任我才说的私事公开，是我越界，也让你在大家面前难堪。我现在先在群里叫停、要求删除并道歉；是否回去由你决定，我会陪你一起处理。';
const mediaAccessKey =
  process.env.E2E_MEDIA_ACCESS_KEY ?? 'test-media-key';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!window.sessionStorage.getItem('relationship-training:test-init')) {
      window.localStorage.clear();
      window.sessionStorage.setItem(
        'relationship-training:test-init',
        'done',
      );
    }
    window.localStorage.setItem('relationship-training:voice', 'off');
  });
});

test('shows all eight open scenarios and filters by type and progress', async ({
  page,
}) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    '把关系练成',
  );
  await expect(page.getByText('关系修炼', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Relationship Arena')).toHaveCount(0);
  await expect(page.locator('[data-testid^="scenario-card-"]')).toHaveCount(8);

  await page.getByTestId('type-filter-invitation').click();
  await expect(page.locator('[data-testid^="scenario-card-"]')).toHaveCount(2);
  await expect(page.getByText('周五六点：约对方逛周末市集')).toBeVisible();
  await expect(page.getByText('大雨突袭：把泡汤的约会重新约好')).toBeVisible();

  await page.getByTestId('type-filter-comfort').click();
  await expect(page.locator('[data-testid^="scenario-card-"]')).toHaveCount(2);

  await page.getByTestId('type-filter-all').click();
  await page.getByTestId('progress-filter-completed').click();
  await expect(page.locator('[data-testid^="scenario-card-"]')).toHaveCount(0);
  await expect(page.getByText('这个筛选下还没有关卡记录。')).toBeVisible();
});

test('selects modalities and requires an in-memory key for image generation', async ({
  page,
}) => {
  await page.goto('./');
  await page.getByTestId('open-modality-settings').click();
  await expect(page.getByTestId('modality-settings')).toBeVisible();
  await expect(page.getByTestId('input-mode-text')).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await page.getByTestId('output-mode-voice').click();
  await expect(page.getByTestId('output-mode-voice')).toHaveAttribute(
    'aria-checked',
    'true',
  );

  await page.getByTestId('output-mode-image').click();
  await page.getByTestId('media-access-key').fill('wrong-key');
  await page.getByTestId('unlock-media').click();
  await expect(page.getByRole('alert')).toContainText('媒体密钥不正确');

  await page.getByTestId('media-access-key').fill(mediaAccessKey);
  await page.getByTestId('unlock-media').click();
  await expect(page.getByTestId('output-mode-image')).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await page.getByRole('button', { name: '关闭模态设置' }).click();

  await page.getByTestId('scenario-card-weekend-market').click();
  await page.getByTestId('start-game').click();
  await expect(page.getByTestId('generated-media-image')).toBeVisible({
    timeout: 10_000,
  });

  const stored = await page.evaluate(() =>
    JSON.stringify(window.localStorage),
  );
  expect(stored).not.toContain(mediaAccessKey);
  await expect(page.getByTestId('dialogue-input')).toBeVisible();
});

test('renders an authored story hook as video in mock mode', async ({
  page,
}) => {
  await page.goto('./');
  await page.getByTestId('open-modality-settings').click();
  await page.getByTestId('output-mode-video').click();
  await page.getByTestId('media-access-key').fill(mediaAccessKey);
  await page.getByTestId('unlock-media').click();
  await page.getByRole('button', { name: '关闭模态设置' }).click();
  await page.getByTestId('scenario-card-rain-check').click();
  await page.getByTestId('start-game').click();
  await expect(page.getByTestId('generated-media-video')).toBeVisible({
    timeout: 10_000,
  });
});

test('enters and leaves a briefing and supports both player identities', async ({
  page,
}) => {
  await page.goto('./');
  await page.getByTestId('scenario-card-rejected-proposal').click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    '提案被否',
  );
  await expect(page.getByText('黎岚，25 岁')).toBeVisible();
  await expect(page.locator('img[alt^="黎岚"]')).toBeVisible();

  await page.getByTestId('choose-female').click();
  await expect(page.getByText('周叙，25 岁')).toBeVisible();
  await expect(page.locator('img[alt^="周叙"]')).toBeVisible();

  await page.getByTestId('back-to-levels').click();
  await expect(page.getByTestId('scenario-card-rejected-proposal')).toBeVisible();
});

test('completes an invitation, keeps progress after refresh, and stores no dialogue', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.goto('./');
  await page.getByTestId('scenario-card-weekend-market').click();
  await page.getByTestId('start-game').click();
  await playUntilResult(page, genericStrongLine, 5);

  await expect(page.getByTestId('result-screen')).toContainText('周末有约');
  await expect(page.getByTestId('result-screen')).toContainText('S');
  await page.getByTestId('back-to-levels').click();
  await expect(page.getByTestId('scenario-card-weekend-market')).toContainText(
    '已完成',
  );
  await expect(page.getByTestId('scenario-card-weekend-market')).toContainText(
    '男 S',
  );

  const stored = await page.evaluate(() =>
    window.localStorage.getItem('relationship-training:progress:v1'),
  );
  expect(stored).not.toContain(genericStrongLine);
  expect(stored).not.toContain('sessionId');
  expect(stored).not.toContain('transcript');

  await page.reload();
  await expect(page.getByTestId('scenario-card-weekend-market')).toContainText(
    '已完成',
  );
  await page.getByTestId('progress-filter-completed').click();
  await expect(page.locator('[data-testid^="scenario-card-"]')).toHaveCount(1);
});

test('plays a repair scenario to its authored S ending', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('./');
  await page.getByTestId('scenario-card-party-joke').click();
  await page.getByTestId('choose-female').click();
  await page.getByTestId('start-game').click();
  await playUntilResult(page, repairStrongLine, 6);

  await expect(page.getByTestId('result-screen')).toContainText('并肩回场');
  await expect(page.getByTestId('result-screen')).toContainText('关系实干家');
  await expect(page.getByTestId('result-usage')).toContainText('本局模型');
});

test('keeps legacy suitcase APIs compatible', async ({ page }) => {
  await page.goto('./');
  const scenario = await page.request.get('/api/scenario?playerGender=female');
  expect(scenario.ok()).toBe(true);
  expect((await scenario.json()).briefing.id).toBe('suitcase-at-one');

  const session = await page.request.post('/api/sessions', {
    data: { playerGender: 'male' },
  });
  expect(session.status()).toBe(201);
  expect((await session.json()).session.state.scenarioId).toBe(
    'suitcase-at-one',
  );
});

test('clears local progress after confirmation', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'relationship-training:progress:v1',
      JSON.stringify({
        version: 1,
        preferredGender: 'male',
        scenarios: {
          'weekend-market': {
            completed: true,
            lastPlayedAt: '2026-07-18T08:00:00.000Z',
            genders: {
              male: {
                plays: 1,
                bestScore: 90,
                bestTier: 'S',
                endings: ['weekend-has-plans'],
                lastPlayedAt: '2026-07-18T08:00:00.000Z',
              },
            },
          },
        },
      }),
    );
  });
  await page.goto('./');
  await expect(page.getByTestId('scenario-card-weekend-market')).toContainText(
    '已完成',
  );

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '清除本机进度' }).click();
  await expect(page.getByTestId('scenario-card-weekend-market')).toContainText(
    '未完成',
  );
});

test('keeps selection and gameplay usable at a mobile viewport', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');
  await expect(page.getByTestId('scenario-card-weekend-market')).toBeVisible();
  await page.getByTestId('open-modality-settings').click();
  await expect(page.getByTestId('modality-settings')).toBeVisible();
  await expect(page.getByTestId('output-mode-video')).toBeVisible();
  await page.getByRole('button', { name: '关闭模态设置' }).click();
  await page.getByTestId('scenario-card-rain-check').click();
  await page.getByTestId('start-game').click();
  await expect(page.getByTestId('dialogue-input')).toBeVisible();

  const horizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  expect(horizontalOverflow).toBe(false);
});

async function playUntilResult(
  page: Page,
  line: string,
  maxRounds: number,
) {
  for (let round = 0; round < maxRounds; round += 1) {
    const previousCounter =
      (await page.getByTestId('round-counter').textContent()) ?? '';
    await page.getByTestId('dialogue-input').fill(line);
    await page.getByTestId('send-line').click();
    await page.waitForFunction(
      ({ previous }) => {
        const result = document.querySelector(
          '[data-testid="result-screen"]',
        );
        const counter = document.querySelector(
          '[data-testid="round-counter"]',
        );
        return Boolean(result) || counter?.textContent !== previous;
      },
      { previous: previousCounter },
      { timeout: 30_000 },
    );
    if (await page.getByTestId('result-screen').count()) return;
    await expect(page.getByTestId('dialogue-input')).toBeEnabled({
      timeout: 30_000,
    });
  }
  await expect(page.getByTestId('result-screen')).toBeVisible({
    timeout: 30_000,
  });
}
