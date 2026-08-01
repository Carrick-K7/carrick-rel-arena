import { z } from 'zod';
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { createInitialState } from './engine.js';
import { createBriefing } from './scenario.js';
import { RemoteAiProvider } from './providers/remote.js';
import type { ModelUsage } from './providers/types.js';
import {
  estimateModelCostUsd,
  estimateRequestMaximumCostUsd,
  formatUsageDateKey,
  UsageBudgetError,
  UsageTracker,
  type UsageConfig,
} from './usage.js';

const quietConfig: UsageConfig = {
  logPath: null,
  alertLogPath: null,
  alertWebhookUrl: null,
  adminToken: null,
  sessionCostLimitUsd: 100,
  dailyCostLimitUsd: 100,
  dailyTtsCharacterLimit: 100_000,
  sessionTokenLimit: 1_000_000,
  errorRateLimit: 1,
  errorRateMinimumCalls: 100,
  maxMemoryEvents: 100,
  timeZone: 'Asia/Shanghai',
};

describe('usage accounting', () => {
  it('prices OpenAI cached input separately from uncached input', () => {
    const cost = estimateModelCostUsd({
      provider: 'openai',
      model: 'gpt-5.4-mini',
      inputTokens: 1_000_000,
      cachedInputTokens: 500_000,
      cacheWriteTokens: 0,
      outputTokens: 100_000,
    });

    expect(cost).toBe(0.8625);
  });

  it('keeps provider-reported reasoning and cache details in summaries', () => {
    const tracker = new UsageTracker(quietConfig);
    tracker.recordModel(
      usage({
        provider: 'deepseek',
        model: 'deepseek-v4-flash',
        inputTokens: 2_000,
        cachedInputTokens: 1_200,
        outputTokens: 500,
        reasoningTokens: 100,
        totalTokens: 2_500,
        measured: true,
      }),
    );

    const summary = tracker.getSessionSummary(
      SESSION_ID,
      'deepseek',
      'deepseek-v4-flash',
    );
    expect(summary.calls).toBe(1);
    expect(summary.cachedInputTokens).toBe(1_200);
    expect(summary.reasoningTokens).toBe(100);
    expect(summary.tokenMeasurement).toBe('provider_reported');
    expect(summary.estimatedCostUsd).toBe(0.00025536);
  });

  it('emits a de-duplicated session token alert', () => {
    const tracker = new UsageTracker({
      ...quietConfig,
      sessionTokenLimit: 10,
    });
    tracker.recordModel(
      usage({
        inputTokens: 8,
        outputTokens: 4,
        totalTokens: 12,
      }),
    );
    tracker.recordModel(
      usage({
        inputTokens: 3,
        outputTokens: 2,
        totalTokens: 5,
      }),
    );

    const snapshot = tracker.getSnapshot();
    expect(snapshot.alerts).toHaveLength(1);
    expect(snapshot.alerts[0].type).toBe('session_tokens');
    expect(
      tracker.getSessionSummary(
        SESSION_ID,
        'mock',
        'deterministic-v1',
      ).alertCount,
    ).toBe(1);
  });

  it('groups daily usage in the configured local time zone', () => {
    expect(
      formatUsageDateKey(
        new Date('2026-07-17T22:00:00.000Z'),
        'Asia/Shanghai',
      ),
    ).toBe('2026-07-18');
  });

  it('reserves a conservative model ceiling before a paid call', () => {
    const ceiling = estimateRequestMaximumCostUsd(
      'openai',
      'gpt-5.4-mini',
      {
        system: 'Return JSON.',
        input: { line: '测试' },
        maxOutputTokens: 500,
      },
    );
    expect(ceiling).toBeTypeOf('number');
    expect(ceiling).toBeGreaterThan(0);
  });

  it('stops TTS before the daily hard character boundary is crossed', () => {
    const tracker = new UsageTracker({
      ...quietConfig,
      dailyTtsCharacterLimit: 5,
    });
    tracker.recordTts({
      provider: 'openai',
      model: 'test',
      sessionId: SESSION_ID,
      success: true,
      latencyMs: 1,
      characters: 5,
      errorCode: null,
    });
    expect(() => tracker.reserveTts(1, true)).toThrow(UsageBudgetError);
  });

  it('stops a paid model call before its reservation crosses the daily limit', () => {
    const tracker = new UsageTracker({
      ...quietConfig,
      dailyCostLimitUsd: 0.000001,
    });
    expect(() => tracker.reserveModelCall('openai', 'gpt-5.4-mini', request()))
      .toThrow(UsageBudgetError);
  });
});

describe('remote provider usage contracts', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('normalizes OpenAI Responses API cache and reasoning usage', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({
          output_text: '{"line":"收到"}',
          usage: {
            input_tokens: 1_000,
            input_tokens_details: {
              cached_tokens: 600,
              cache_write_tokens: 100,
            },
            output_tokens: 120,
            output_tokens_details: {
              reasoning_tokens: 20,
            },
            total_tokens: 1_120,
          },
        }),
      ),
    );
    const provider = new RemoteAiProvider({
      kind: 'openai',
      apiKey: 'test-key',
      model: 'gpt-5.4-mini',
      baseUrl: 'https://openai.invalid/v1',
    });

    const result = await provider.generate(request());
    expect(result.data.line).toBe('收到');
    expect(result.usage).toMatchObject({
      provider: 'openai',
      inputTokens: 1_000,
      cachedInputTokens: 600,
      cacheWriteTokens: 100,
      outputTokens: 120,
      reasoningTokens: 20,
      totalTokens: 1_120,
      measured: true,
    });
  });

  it('normalizes DeepSeek cache hit and reasoning usage', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({
          choices: [
            {
              message: {
                content: '{"line":"继续"}',
              },
            },
          ],
          usage: {
            prompt_tokens: 900,
            prompt_cache_hit_tokens: 700,
            prompt_cache_miss_tokens: 200,
            completion_tokens: 80,
            completion_tokens_details: {
              reasoning_tokens: 12,
            },
            total_tokens: 980,
          },
        }),
      ),
    );
    const provider = new RemoteAiProvider({
      kind: 'deepseek',
      apiKey: 'test-key',
      model: 'deepseek-v4-flash',
      baseUrl: 'https://deepseek.invalid',
    });

    const result = await provider.generate(request());
    expect(result.data.line).toBe('继续');
    expect(result.usage).toMatchObject({
      provider: 'deepseek',
      inputTokens: 900,
      cachedInputTokens: 700,
      outputTokens: 80,
      reasoningTokens: 12,
      totalTokens: 980,
      measured: true,
    });
  });
});

const SESSION_ID = '7401c52f-e7f6-4cd6-a4f4-934dc783cf1f';
const TestOutputSchema = z.strictObject({
  line: z.string(),
});

function request() {
  return {
    agent: 'director' as const,
    schemaName: 'test_output',
    schema: TestOutputSchema,
    system: 'Return a test object.',
    input: {
      line: 'test',
    },
    context: {
      briefing: createBriefing('suitcase-at-one', 'male'),
      state: createInitialState(SESSION_ID),
      transcript: [],
      playerLine: '测试',
      round: 1,
      roundsLeftAfterThis: 6,
    },
    maxOutputTokens: 100,
  };
}

function usage(
  overrides: Partial<ModelUsage> = {},
): ModelUsage {
  return {
    provider: 'mock',
    model: 'deterministic-v1',
    agent: 'director',
    sessionId: SESSION_ID,
    occurredAt: new Date().toISOString(),
    success: true,
    attempts: 1,
    measured: false,
    latencyMs: 1,
    inputTokens: 8,
    cachedInputTokens: 0,
    cacheWriteTokens: 0,
    outputTokens: 4,
    reasoningTokens: 0,
    totalTokens: 12,
    errorCode: null,
    ...overrides,
  };
}
