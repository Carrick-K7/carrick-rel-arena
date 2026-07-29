import { describe, expect, it } from 'vitest';
import type { MediaGeneration } from '../shared/contracts.js';
import {
  estimateGenerationProgress,
  formatGenerationWait,
} from './generation-progress.js';

const createdAt = '2026-07-24T12:00:00.000Z';

function generation(
  status: MediaGeneration['status'],
): MediaGeneration {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    sessionId: '22222222-2222-4222-8222-222222222222',
    beatId: 'opening',
    kind: 'image',
    status,
    url: status === 'succeeded' ? 'mock://image' : null,
    error: status === 'failed' ? 'failed' : null,
    provider: 'mock',
    model: 'mock-image',
    usageTokens: null,
    createdAt,
    updatedAt: createdAt,
  };
}

describe('estimated media generation progress', () => {
  it('moves a running image through visible stages without claiming completion', () => {
    const early = estimateGenerationProgress(
      'image',
      generation('running'),
      Date.parse(createdAt) + 5_000,
    );
    const middle = estimateGenerationProgress(
      'image',
      generation('running'),
      Date.parse(createdAt) + 50_000,
    );
    const longRunning = estimateGenerationProgress(
      'image',
      generation('running'),
      Date.parse(createdAt) + 600_000,
    );

    expect(early.percent).toBeGreaterThanOrEqual(10);
    expect(middle.percent).toBeGreaterThan(early.percent);
    expect(middle.stage).not.toBe(early.stage);
    expect(longRunning.percent).toBe(96);
  });

  it('only reports 100 percent after the task succeeds', () => {
    expect(
      estimateGenerationProgress(
        'image',
        generation('succeeded'),
        Date.parse(createdAt) + 30_000,
      ),
    ).toMatchObject({
      percent: 100,
      stage: '画面已经生成',
    });
  });

  it('describes a not-yet-created generation as submission rather than an upstream queue', () => {
    expect(
      estimateGenerationProgress(
        'image',
        null,
        Date.parse(createdAt) + 2_000,
        Date.parse(createdAt),
      ),
    ).toMatchObject({
      stage: '正在提交生成任务',
    });
  });

  it('formats short and multi-minute waits in Chinese', () => {
    expect(formatGenerationWait(42)).toBe('42 秒');
    expect(formatGenerationWait(120)).toBe('2 分钟');
    expect(formatGenerationWait(137)).toBe('2 分 17 秒');
  });
});
