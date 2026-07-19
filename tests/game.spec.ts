import { expect, test, type Page } from '@playwright/test';

const genericStrongLine =
  '我知道你现在很难受，也在意你的真实需要。明天我们一起把具体安排定下来，你来选，也可以拒绝；我会陪你。';

const repairStrongLine =
  '我知道把你信任我才说的私事公开，是我越界，也让你在大家面前难堪。我现在先在群里叫停、要求删除并道歉；是否回去由你决定，我会陪你一起处理。';
const mediaAccessKey =
  process.env.E2E_MEDIA_ACCESS_KEY ?? 'test-media-key';
const externalMedia = process.env.E2E_EXTERNAL === '1';
const mediaGenerationTimeout = externalMedia ? 360_000 : 10_000;

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
  await expect(
    page.getByRole('link', { name: '关系修炼首页' }),
  ).toBeVisible();
  await expect(page.getByText('Relationship Arena')).toHaveCount(0);
  await expect(page.getByText('在线角色')).toHaveCount(0);
  await expect(page.getByText('八次对话 · 八种靠近')).toHaveCount(0);
  await expect(
    page.getByText('在一次次真实对话里，练习理解、表达与修复。'),
  ).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '真实场景' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '自由表达' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '多模态演出' })).toBeVisible();
  await expect(page.getByText('当前伴侣')).toBeVisible();
  await expect(
    page.getByText('本机只保存完成记录、分身份最佳成绩和已见结局。'),
  ).toHaveCount(0);
  await expect(page.locator('[data-testid^="scenario-card-"]')).toHaveCount(8);

  await page.getByTestId('type-filter-invitation').click();
  await expect(page.locator('[data-testid^="scenario-card-"]')).toHaveCount(2);
  await expect(page.getByTestId('scenario-card-weekend-market')).toContainText(
    '周五六点：约对方逛周末市集',
  );
  await expect(page.getByTestId('scenario-card-rain-check')).toContainText(
    '大雨突袭：把泡汤的约会重新约好',
  );

  await page.getByTestId('type-filter-comfort').click();
  await expect(page.locator('[data-testid^="scenario-card-"]')).toHaveCount(4);

  await page.getByTestId('difficulty-filter-进阶').click();
  await expect(page.locator('[data-testid^="scenario-card-"]')).toHaveCount(2);
  await page.getByRole('button', { name: '清除筛选' }).click();
  await page.getByTestId('progress-filter-completed').click();
  await expect(page.locator('[data-testid^="scenario-card-"]')).toHaveCount(0);
  await expect(page.getByText('没有符合条件的场景')).toBeVisible();
});

test('uses the new font system and selects a card before entering its briefing', async ({
  page,
}) => {
  await page.goto('./');
  await expect(
    page.getByRole('link', { name: '关系修炼首页' }).locator('img'),
  ).toBeVisible();

  for (const asset of [
    '/fonts/smiley-sans-display.woff2',
    '/fonts/source-han-sans-sc-regular.woff2',
    '/fonts/source-han-serif-sc-regular.woff2',
    '/fonts/OFL-Smiley-Sans.txt',
    '/fonts/OFL-Source-Han-Sans.txt',
    '/fonts/OFL-Source-Han-Serif.txt',
    '/brand/relationship-training-logo.svg',
    '/favicon.svg',
  ]) {
    expect((await page.request.get(asset)).ok()).toBe(true);
  }

  const fonts = await page.evaluate(async () => {
    await document.fonts.ready;
    return {
      hero: getComputedStyle(
        document.querySelector('.level-intro h1')!,
      ).fontFamily,
      card: getComputedStyle(
        document.querySelector('.scenario-card__copy')!,
      ).fontFamily,
      scene: getComputedStyle(
        document.querySelector('.scenario-preview h2')!,
      ).fontFamily,
    };
  });
  expect(fonts.hero).toContain('Relationship Display');
  expect(fonts.card).toContain('Relationship Sans');
  expect(fonts.scene).toContain('Relationship Serif');

  await page.getByTestId('scenario-card-rejected-proposal').click();
  await expect(page.getByTestId('scenario-preview')).toContainText(
    '提案被否',
  );
  await expect(page.getByTestId('start-game')).toHaveCount(0);
  await page.getByTestId('enter-scenario').click();
  await expect(page.getByTestId('start-game')).toBeVisible();
});

test('selects modalities and requires an in-memory key for image generation', async ({
  page,
}) => {
  if (externalMedia) test.setTimeout(480_000);
  await page.goto('./');
  await page.getByTestId('open-modality-settings').click();
  await expect(page.getByTestId('modality-settings')).toBeVisible();
  await expect(page.getByTestId('input-mode-text')).toContainText(
    '随时键入或修改内容',
  );
  await expect(page.getByTestId('input-mode-voice')).toBeVisible();
  await expect(page.getByRole('radio')).toHaveCount(0);
  await expect(page.getByTestId('output-mode-text')).toHaveAttribute(
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
  await expect(page.getByTestId('output-mode-voice')).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await page.getByTestId('output-mode-video').click();
  await expect(page.getByTestId('output-mode-video')).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(page.getByTestId('output-mode-image')).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await page.getByTestId('output-mode-video').click();
  await page.getByRole('button', { name: '关闭模态设置' }).click();

  await page.getByTestId('scenario-card-weekend-market').click();
  await page.getByTestId('enter-scenario').click();
  await page.getByTestId('start-game').click();
  await expect(page.getByTestId('generated-media-image')).toBeVisible({
    timeout: mediaGenerationTimeout,
  });
  const openingBeat = await page
    .getByTestId('generated-media-image')
    .getAttribute('data-visual-beat');
  await expect(page.getByTestId('visual-frame-0')).toBeVisible();
  const line = '我想先理解你的感受，再一起定一个具体时间。';
  await page.getByTestId('dialogue-input').fill(line);
  await page.getByTestId('send-line').click();
  await expect(page.getByTestId('generated-media-image')).not.toHaveAttribute(
    'data-visual-beat',
    openingBeat!,
    { timeout: mediaGenerationTimeout },
  );
  await expect(page.getByTestId('generated-media-image')).toContainText(line);
  await expect(page.getByTestId('generated-media-image')).toContainText(
    /秋雾/,
  );
  await expect(
    page
      .getByTestId('generated-media-image')
      .locator('.memory-frame__bubble--player'),
  ).toContainText(line);
  await expect(
    page
      .getByTestId('generated-media-image')
      .locator('.memory-frame__bubble--character'),
  ).toBeVisible();
  await expect(
    page.getByTestId('generated-media-image').locator('figcaption'),
  ).toHaveCount(0);
  await expect(page.getByText('对话文字由原文排版')).toHaveCount(0);
  await expect(page.getByTestId('visual-frame-1')).toBeVisible();
  await page.getByTestId('visual-frame-0').click();
  await expect(page.getByTestId('generated-media-image')).toHaveAttribute(
    'data-visual-beat',
    openingBeat!,
  );
  await page.getByTestId('visual-frame-1').click();
  await expect(page.getByTestId('generated-media-image')).not.toHaveAttribute(
    'data-visual-beat',
    openingBeat!,
  );

  const stored = await page.evaluate(() =>
    JSON.stringify(window.localStorage),
  );
  expect(stored).not.toContain(mediaAccessKey);
  await expect(page.getByTestId('dialogue-input')).toBeVisible();
});

test('uses per-turn images and creates one whole-session memory film', async ({
  page,
}) => {
  test.setTimeout(externalMedia ? 480_000 : 90_000);
  await page.goto('./');
  await page.getByTestId('open-modality-settings').click();
  await page.getByTestId('output-mode-video').click();
  await page.getByTestId('media-access-key').fill(mediaAccessKey);
  await page.getByTestId('unlock-media').click();
  await page.getByRole('button', { name: '关闭模态设置' }).click();
  await page.getByTestId('scenario-card-rain-check').click();
  await page.getByTestId('enter-scenario').click();
  await page.getByTestId('start-game').click();
  await expect(page.getByTestId('generated-media-image')).toBeVisible({
    timeout: mediaGenerationTimeout,
  });
  await expect(page.getByTestId('generated-media-video')).toHaveCount(0);
  await playUntilResult(page, genericStrongLine, 5);
  await expect(page.getByTestId('generated-media-video')).toBeVisible({
    timeout: mediaGenerationTimeout,
  });
  await expect(page.getByLabel('本局回忆')).toContainText(
    /第 \d 轮/,
  );
});

test('enters and leaves a briefing and supports both player identities', async ({
  page,
}) => {
  await page.goto('./');
  await page.getByTestId('scenario-card-rejected-proposal').click();
  await page.getByTestId('enter-scenario').click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    '提案被否',
  );
  await expect(page.getByText('秋雾，25 岁')).toBeVisible();
  await expect(page.locator('img[alt^="秋雾"]')).toBeVisible();
  await expect(page.getByRole('button', { name: /扮演徐坤/ })).toBeVisible();

  await page.getByTestId('choose-female').click();
  await expect(page.getByText('徐坤，25 岁')).toBeVisible();
  await expect(page.locator('img[alt^="徐坤"]')).toBeVisible();
  await expect(page.getByRole('button', { name: /扮演秋雾/ })).toBeVisible();

  await page.getByTestId('back-to-levels').click();
  await expect(page.getByTestId('scenario-card-rejected-proposal')).toBeVisible();
});

test('completes an invitation, keeps progress after refresh, and stores no dialogue', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.goto('./');
  await page.getByTestId('scenario-card-weekend-market').click();
  await page.getByTestId('enter-scenario').click();
  await page.getByTestId('start-game').click();
  await playUntilResult(page, genericStrongLine, 5);

  await expect(page.getByTestId('result-screen')).toContainText('周末有约');
  await expect(page.getByTestId('result-screen')).toContainText('S');
  await page.getByTestId('back-to-levels').click();
  await expect(page.getByTestId('scenario-card-weekend-market')).toContainText(
    '已完成',
  );
  await expect(page.getByTestId('scenario-card-weekend-market')).toContainText(
    '徐坤 S',
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
  await page.getByTestId('enter-scenario').click();
  await page.getByTestId('choose-female').click();
  await page.getByTestId('start-game').click();
  await playUntilResult(page, repairStrongLine, 6);

  await expect(page.getByTestId('result-screen')).toContainText('并肩回场');
  await expect(page.getByTestId('result-screen')).toContainText('关系实干家');
  await expect(page.getByTestId('result-screen')).not.toContainText('tokens');
  await expect(page.getByTestId('result-screen')).not.toContainText('评判 AI');
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
  await page.getByTestId('enter-scenario').click();
  await page.getByTestId('start-game').click();
  await expect(page.getByTestId('dialogue-input')).toBeVisible();

  const horizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  expect(horizontalOverflow).toBe(false);
});

test('keeps one progress bar, complete history, and the unified composer', async ({
  page,
}) => {
  await page.goto('./');
  await page.getByTestId('scenario-card-weekend-market').click();
  await page.getByTestId('enter-scenario').click();
  await page.getByTestId('start-game').click();

  await expect(page.getByRole('progressbar')).toHaveCount(1);
  await expect(page.getByText('事情发生之前')).toBeVisible();
  await expect(
    page.getByText(/最近总在下班后多聊十分钟/),
  ).toBeVisible();
  await expect(page.getByText('AI 角色')).toHaveCount(0);
  await expect(page.getByText('文字输出')).toHaveCount(0);
  await expect(page.getByText('AI 实时生成')).toHaveCount(0);

  const openingLine = page.getByTestId('message-character').first();
  await expect(openingLine).toBeVisible();
  await expect(openingLine.locator('button')).toBeVisible();
  await expect(page.getByTestId('stage-direction-0')).toBeVisible();
  const metaPositions = await openingLine.evaluate((element) => {
    const label = element.querySelector('.message__meta > span');
    const button = element.querySelector('.message__meta button');
    return {
      labelRight: label?.getBoundingClientRect().right ?? 0,
      buttonLeft: button?.getBoundingClientRect().left ?? 9999,
    };
  });
  expect(metaPositions.buttonLeft - metaPositions.labelRight).toBeLessThan(80);

  const dialogueInput = page.getByTestId('dialogue-input');
  await dialogueInput.focus();
  const focusStyles = await dialogueInput.evaluate((element) => ({
    inputShadow: getComputedStyle(element).boxShadow,
    composerShadow: getComputedStyle(element.closest('.composer')!).boxShadow,
  }));
  expect(focusStyles.inputShadow).toBe('none');
  expect(focusStyles.composerShadow).not.toBe('none');

  await dialogueInput.fill('我想先听听你的想法');
  await page.getByTestId('dialogue-input').press('Shift+Enter');
  await page.getByTestId('dialogue-input').type('，然后一起定时间。');
  await expect(page.getByTestId('dialogue-input')).toHaveValue(
    '我想先听听你的想法\n，然后一起定时间。',
  );
  await page.getByTestId('dialogue-input').press('Enter');
  await expect(page.getByTestId('message-player')).toContainText(
    '我想先听听你的想法',
  );
  await expect(page.getByText('你 · 1', { exact: true })).toHaveCount(0);
  await expect(page.getByTestId('message-character')).toHaveCount(2);
  await expect(page.getByRole('progressbar')).toHaveCount(1);
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
