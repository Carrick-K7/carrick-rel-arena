import {
  appendFile,
  mkdirSync,
  readFileSync,
} from 'node:fs';
import path from 'node:path';
import type { SessionUsage } from '../shared/contracts.js';
import type {
  ModelUsage,
  ProviderKind,
} from './providers/types.js';

interface Pricing {
  inputUsdPerMillion: number;
  cachedInputUsdPerMillion: number;
  outputUsdPerMillion: number;
  cacheWriteMultiplier: number;
}

export interface UsageConfig {
  logPath: string | null;
  alertLogPath: string | null;
  alertWebhookUrl: string | null;
  adminToken: string | null;
  sessionCostLimitUsd: number;
  dailyCostLimitUsd: number;
  sessionTokenLimit: number;
  errorRateLimit: number;
  errorRateMinimumCalls: number;
  maxMemoryEvents: number;
}

interface TrackedModelUsage extends ModelUsage {
  id: string;
  kind: 'model';
  estimatedCostUsd: number | null;
}

interface TtsUsage {
  id: string;
  kind: 'tts';
  provider: 'openai' | 'browser';
  model: string;
  sessionId: string | null;
  occurredAt: string;
  success: boolean;
  latencyMs: number;
  characters: number;
  errorCode: string | null;
}

export interface UsageAlert {
  id: string;
  type:
    | 'session_cost'
    | 'daily_cost'
    | 'session_tokens'
    | 'provider_error_rate';
  severity: 'warning' | 'critical';
  message: string;
  actual: number;
  threshold: number;
  sessionId: string | null;
  createdAt: string;
}

type UsageEvent = TrackedModelUsage | TtsUsage;

export function readUsageConfig(): UsageConfig {
  const root = process.cwd();
  return {
    logPath:
      cleanText(process.env.USAGE_LOG_PATH) ??
      path.join(root, 'var/usage-events.jsonl'),
    alertLogPath:
      cleanText(process.env.USAGE_ALERT_LOG_PATH) ??
      path.join(root, 'var/usage-alerts.jsonl'),
    alertWebhookUrl: cleanText(process.env.USAGE_ALERT_WEBHOOK_URL),
    adminToken: cleanText(process.env.USAGE_ADMIN_TOKEN),
    sessionCostLimitUsd: readNonNegativeNumber(
      process.env.USAGE_ALERT_SESSION_USD,
      0.25,
    ),
    dailyCostLimitUsd: readNonNegativeNumber(
      process.env.USAGE_ALERT_DAILY_USD,
      5,
    ),
    sessionTokenLimit: readNonNegativeInt(
      process.env.USAGE_ALERT_SESSION_TOKENS,
      120_000,
    ),
    errorRateLimit: readRatioOrZero(
      process.env.USAGE_ALERT_ERROR_RATE,
      0.2,
    ),
    errorRateMinimumCalls: readPositiveInt(
      process.env.USAGE_ALERT_ERROR_MIN_CALLS,
      10,
    ),
    maxMemoryEvents: readPositiveInt(
      process.env.USAGE_MAX_MEMORY_EVENTS,
      5_000,
    ),
  };
}

export class UsageTracker {
  private readonly events: UsageEvent[] = [];
  private readonly alerts: UsageAlert[] = [];
  private readonly emittedAlertKeys = new Set<string>();

  constructor(private readonly config: UsageConfig) {
    prepareParent(config.logPath);
    prepareParent(config.alertLogPath);
    this.events.push(
      ...readJsonLines(config.logPath)
        .filter(isUsageEvent)
        .slice(-config.maxMemoryEvents),
    );
    this.alerts.push(
      ...readJsonLines(config.alertLogPath)
        .filter(isUsageAlert)
        .slice(-50),
    );
    for (const alert of this.alerts) {
      this.emittedAlertKeys.add(alertDedupeKey(alert));
    }
  }

  get alertingEnabled(): boolean {
    return (
      this.config.sessionCostLimitUsd > 0 ||
      this.config.dailyCostLimitUsd > 0 ||
      this.config.sessionTokenLimit > 0 ||
      this.config.errorRateLimit > 0
    );
  }

  get adminToken(): string | null {
    return this.config.adminToken;
  }

  recordModel(usage: ModelUsage): void {
    const event: TrackedModelUsage = {
      ...usage,
      id: crypto.randomUUID(),
      kind: 'model',
      estimatedCostUsd: estimateModelCostUsd(usage),
    };
    this.pushEvent(event);
    this.evaluateAlerts(event);
  }

  recordTts(input: {
    provider: 'openai' | 'browser';
    model: string;
    sessionId: string | null;
    success: boolean;
    latencyMs: number;
    characters: number;
    errorCode: string | null;
  }): void {
    this.pushEvent({
      ...input,
      id: crypto.randomUUID(),
      kind: 'tts',
      occurredAt: new Date().toISOString(),
    });
  }

  getSessionSummary(
    sessionId: string,
    provider: ProviderKind,
    model: string,
  ): SessionUsage {
    const events = this.events.filter(
      (event) => event.sessionId === sessionId,
    );
    const modelEvents = events.filter(
      (event): event is TrackedModelUsage => event.kind === 'model',
    );
    const ttsEvents = events.filter(
      (event): event is TtsUsage => event.kind === 'tts',
    );
    const costs = modelEvents
      .map((event) => event.estimatedCostUsd)
      .filter((cost): cost is number => cost !== null);
    const hasUnknownCost = modelEvents.some(
      (event) => event.estimatedCostUsd === null,
    );

    return {
      provider,
      model,
      calls: modelEvents.length,
      successfulCalls: modelEvents.filter((event) => event.success).length,
      failedCalls: modelEvents.filter((event) => !event.success).length,
      inputTokens: sum(modelEvents, 'inputTokens'),
      cachedInputTokens: sum(modelEvents, 'cachedInputTokens'),
      cacheWriteTokens: sum(modelEvents, 'cacheWriteTokens'),
      outputTokens: sum(modelEvents, 'outputTokens'),
      reasoningTokens: sum(modelEvents, 'reasoningTokens'),
      totalTokens: sum(modelEvents, 'totalTokens'),
      estimatedCostUsd:
        hasUnknownCost && costs.length === 0
          ? null
          : roundMoney(costs.reduce((total, cost) => total + cost, 0)),
      tokenMeasurement:
        modelEvents.length === 0
          ? 'none'
          : modelEvents.some((event) => event.measured)
            ? 'provider_reported'
            : 'estimated',
      ttsRequests: ttsEvents.length,
      ttsCharacters: ttsEvents.reduce(
        (total, event) => total + event.characters,
        0,
      ),
      alertCount: this.alerts.filter(
        (alert) => alert.sessionId === sessionId,
      ).length,
    };
  }

  getSnapshot() {
    const today = new Date().toISOString().slice(0, 10);
    const todayEvents = this.events.filter((event) =>
      event.occurredAt.startsWith(today),
    );
    const modelEvents = todayEvents.filter(
      (event): event is TrackedModelUsage => event.kind === 'model',
    );
    const ttsEvents = todayEvents.filter(
      (event): event is TtsUsage => event.kind === 'tts',
    );
    const providers = ['mock', 'openai', 'deepseek'] as const;

    return {
      generatedAt: new Date().toISOString(),
      period: today,
      totals: aggregateModelEvents(modelEvents, ttsEvents),
      byProvider: Object.fromEntries(
        providers.map((provider) => [
          provider,
          aggregateModelEvents(
            modelEvents.filter((event) => event.provider === provider),
            ttsEvents.filter((event) => event.provider === provider),
          ),
        ]),
      ),
      thresholds: {
        sessionCostLimitUsd: this.config.sessionCostLimitUsd,
        dailyCostLimitUsd: this.config.dailyCostLimitUsd,
        sessionTokenLimit: this.config.sessionTokenLimit,
        errorRateLimit: this.config.errorRateLimit,
        errorRateMinimumCalls: this.config.errorRateMinimumCalls,
      },
      alerts: this.alerts.slice(-50).reverse(),
    };
  }

  toPrometheus(): string {
    const snapshot = this.getSnapshot();
    const lines = [
      '# HELP relationship_arena_model_calls_total Model calls observed today.',
      '# TYPE relationship_arena_model_calls_total gauge',
      `relationship_arena_model_calls_total ${snapshot.totals.calls}`,
      '# HELP relationship_arena_model_tokens_total Model tokens observed today.',
      '# TYPE relationship_arena_model_tokens_total gauge',
      `relationship_arena_model_tokens_total ${snapshot.totals.totalTokens}`,
      '# HELP relationship_arena_model_estimated_cost_usd Estimated model cost today.',
      '# TYPE relationship_arena_model_estimated_cost_usd gauge',
      `relationship_arena_model_estimated_cost_usd ${snapshot.totals.estimatedCostUsd ?? 'NaN'}`,
      '# HELP relationship_arena_usage_alerts_total Usage alerts retained in memory.',
      '# TYPE relationship_arena_usage_alerts_total gauge',
      `relationship_arena_usage_alerts_total ${this.alerts.length}`,
    ];

    for (const provider of ['mock', 'openai', 'deepseek'] as const) {
      const providerTotals = snapshot.byProvider[provider];
      lines.push(
        `relationship_arena_model_calls_total{provider="${provider}"} ${providerTotals.calls}`,
      );
    }
    return `${lines.join('\n')}\n`;
  }

  private pushEvent(event: UsageEvent) {
    this.events.push(event);
    if (this.events.length > this.config.maxMemoryEvents) {
      this.events.splice(
        0,
        this.events.length - this.config.maxMemoryEvents,
      );
    }
    appendJsonLine(this.config.logPath, event);
  }

  private evaluateAlerts(event: TrackedModelUsage) {
    const sessionEvents = this.events.filter(
      (candidate): candidate is TrackedModelUsage =>
        candidate.kind === 'model' &&
        candidate.sessionId === event.sessionId,
    );
    const sessionTokens = sessionEvents.reduce(
      (total, candidate) => total + candidate.totalTokens,
      0,
    );
    if (
      this.config.sessionTokenLimit > 0 &&
      sessionTokens >= this.config.sessionTokenLimit
    ) {
      this.emitAlert(
        `session-tokens:${event.sessionId}`,
        {
          type: 'session_tokens',
          severity: 'warning',
          message: `会话模型用量达到 ${sessionTokens} tokens。`,
          actual: sessionTokens,
          threshold: this.config.sessionTokenLimit,
          sessionId: event.sessionId,
        },
      );
    }

    const sessionCost = knownCost(sessionEvents);
    if (
      sessionCost !== null &&
      this.config.sessionCostLimitUsd > 0 &&
      sessionCost >= this.config.sessionCostLimitUsd
    ) {
      this.emitAlert(
        `session-cost:${event.sessionId}`,
        {
          type: 'session_cost',
          severity: 'warning',
          message: `会话估算模型成本达到 $${sessionCost.toFixed(4)}。`,
          actual: sessionCost,
          threshold: this.config.sessionCostLimitUsd,
          sessionId: event.sessionId,
        },
      );
    }

    const today = event.occurredAt.slice(0, 10);
    const todayModelEvents = this.events.filter(
      (candidate): candidate is TrackedModelUsage =>
        candidate.kind === 'model' &&
        candidate.occurredAt.startsWith(today),
    );
    const dailyCost = knownCost(todayModelEvents);
    if (
      dailyCost !== null &&
      this.config.dailyCostLimitUsd > 0 &&
      dailyCost >= this.config.dailyCostLimitUsd
    ) {
      this.emitAlert(`daily-cost:${today}`, {
        type: 'daily_cost',
        severity: 'critical',
        message: `今日估算模型成本达到 $${dailyCost.toFixed(4)}。`,
        actual: dailyCost,
        threshold: this.config.dailyCostLimitUsd,
        sessionId: null,
      });
    }

    const hourAgo = Date.now() - 60 * 60_000;
    const recent = this.events.filter(
      (candidate): candidate is TrackedModelUsage =>
        candidate.kind === 'model' &&
        Date.parse(candidate.occurredAt) >= hourAgo,
    );
    const failures = recent.filter((candidate) => !candidate.success).length;
    const errorRate = recent.length === 0 ? 0 : failures / recent.length;
    if (
      this.config.errorRateLimit > 0 &&
      recent.length >= this.config.errorRateMinimumCalls &&
      errorRate >= this.config.errorRateLimit
    ) {
      const hour = event.occurredAt.slice(0, 13);
      this.emitAlert(`provider-errors:${hour}`, {
        type: 'provider_error_rate',
        severity: 'critical',
        message: `最近一小时模型错误率达到 ${(errorRate * 100).toFixed(1)}%。`,
        actual: errorRate,
        threshold: this.config.errorRateLimit,
        sessionId: null,
      });
    }
  }

  private emitAlert(
    key: string,
    input: Omit<UsageAlert, 'id' | 'createdAt'>,
  ) {
    if (this.emittedAlertKeys.has(key)) return;
    this.emittedAlertKeys.add(key);
    const alert: UsageAlert = {
      ...input,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    this.alerts.push(alert);
    appendJsonLine(this.config.alertLogPath, alert);
    console.warn(`[usage-alert:${alert.type}] ${alert.message}`);

    if (this.config.alertWebhookUrl) {
      void fetch(this.config.alertWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(alert),
        signal: AbortSignal.timeout(5_000),
      }).catch((error: unknown) => {
        console.error(
          '[usage-alert:webhook]',
          error instanceof Error ? error.message : String(error),
        );
      });
    }
  }
}

export function estimateModelCostUsd(
  usage: Pick<
    ModelUsage,
    | 'provider'
    | 'model'
    | 'inputTokens'
    | 'cachedInputTokens'
    | 'cacheWriteTokens'
    | 'outputTokens'
  >,
): number | null {
  if (usage.provider === 'mock') return 0;
  const pricing = resolvePricing(usage.provider, usage.model);
  if (!pricing) return null;

  const cached = Math.min(
    usage.inputTokens,
    Math.max(0, usage.cachedInputTokens),
  );
  const cacheWrite = Math.min(
    Math.max(0, usage.inputTokens - cached),
    Math.max(0, usage.cacheWriteTokens),
  );
  const uncached = Math.max(
    0,
    usage.inputTokens - cached - cacheWrite,
  );
  const cost =
    (uncached * pricing.inputUsdPerMillion +
      cached * pricing.cachedInputUsdPerMillion +
      cacheWrite *
        pricing.inputUsdPerMillion *
        pricing.cacheWriteMultiplier +
      usage.outputTokens * pricing.outputUsdPerMillion) /
    1_000_000;
  return roundMoney(cost);
}

function resolvePricing(
  provider: ProviderKind,
  model: string,
): Pricing | null {
  if (provider === 'mock') return null;
  const custom = readCustomPricing(provider);
  if (custom) return custom;

  if (provider === 'openai' && model.startsWith('gpt-5.4-mini')) {
    return {
      inputUsdPerMillion: 0.75,
      cachedInputUsdPerMillion: 0.075,
      outputUsdPerMillion: 4.5,
      cacheWriteMultiplier: 1.25,
    };
  }
  if (provider === 'deepseek' && model.includes('v4-flash')) {
    return {
      inputUsdPerMillion: 0.14,
      cachedInputUsdPerMillion: 0.0028,
      outputUsdPerMillion: 0.28,
      cacheWriteMultiplier: 1,
    };
  }
  if (provider === 'deepseek' && model.includes('v4-pro')) {
    return {
      inputUsdPerMillion: 0.435,
      cachedInputUsdPerMillion: 0.003625,
      outputUsdPerMillion: 0.87,
      cacheWriteMultiplier: 1,
    };
  }
  return null;
}

function readCustomPricing(provider: Exclude<ProviderKind, 'mock'>) {
  const prefix = provider === 'openai' ? 'OPENAI' : 'DEEPSEEK';
  const input = readOptionalNonNegativeNumber(
    process.env[`${prefix}_INPUT_USD_PER_MILLION`],
  );
  const cached = readOptionalNonNegativeNumber(
    process.env[`${prefix}_CACHED_INPUT_USD_PER_MILLION`],
  );
  const output = readOptionalNonNegativeNumber(
    process.env[`${prefix}_OUTPUT_USD_PER_MILLION`],
  );
  if (input === null || cached === null || output === null) return null;
  return {
    inputUsdPerMillion: input,
    cachedInputUsdPerMillion: cached,
    outputUsdPerMillion: output,
    cacheWriteMultiplier: 1.25,
  };
}

function aggregateModelEvents(
  modelEvents: TrackedModelUsage[],
  ttsEvents: TtsUsage[],
) {
  const costs = modelEvents
    .map((event) => event.estimatedCostUsd)
    .filter((cost): cost is number => cost !== null);
  return {
    calls: modelEvents.length,
    successfulCalls: modelEvents.filter((event) => event.success).length,
    failedCalls: modelEvents.filter((event) => !event.success).length,
    inputTokens: sum(modelEvents, 'inputTokens'),
    cachedInputTokens: sum(modelEvents, 'cachedInputTokens'),
    cacheWriteTokens: sum(modelEvents, 'cacheWriteTokens'),
    outputTokens: sum(modelEvents, 'outputTokens'),
    reasoningTokens: sum(modelEvents, 'reasoningTokens'),
    totalTokens: sum(modelEvents, 'totalTokens'),
    estimatedCostUsd:
      costs.length === 0 && modelEvents.length > 0
        ? null
        : roundMoney(costs.reduce((total, cost) => total + cost, 0)),
    ttsRequests: ttsEvents.length,
    ttsCharacters: ttsEvents.reduce(
      (total, event) => total + event.characters,
      0,
    ),
  };
}

function knownCost(events: TrackedModelUsage[]): number | null {
  if (events.some((event) => event.estimatedCostUsd === null)) return null;
  return roundMoney(
    events.reduce(
      (total, event) => total + (event.estimatedCostUsd ?? 0),
      0,
    ),
  );
}

function sum(
  events: TrackedModelUsage[],
  key:
    | 'inputTokens'
    | 'cachedInputTokens'
    | 'cacheWriteTokens'
    | 'outputTokens'
    | 'reasoningTokens'
    | 'totalTokens',
): number {
  return events.reduce((total, event) => total + event[key], 0);
}

function appendJsonLine(
  filePath: string | null,
  value: object,
): void {
  if (!filePath) return;
  appendFile(filePath, `${JSON.stringify(value)}\n`, (error) => {
    if (error) console.error('[usage-log]', error.message);
  });
}

function prepareParent(filePath: string | null): void {
  if (!filePath) return;
  mkdirSync(path.dirname(filePath), { recursive: true });
}

function readJsonLines(filePath: string | null): unknown[] {
  if (!filePath) return [];
  let content: string;
  try {
    content = readFileSync(filePath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    console.error(
      '[usage-log:restore]',
      error instanceof Error ? error.message : String(error),
    );
    return [];
  }

  const values: unknown[] = [];
  for (const line of content.split('\n')) {
    if (!line.trim()) continue;
    try {
      values.push(JSON.parse(line) as unknown);
    } catch {
      console.error('[usage-log:restore] skipped an invalid JSONL line');
    }
  }
  return values;
}

function isUsageEvent(value: unknown): value is UsageEvent {
  if (!isRecord(value)) return false;
  return (
    (value.kind === 'model' || value.kind === 'tts') &&
    typeof value.id === 'string' &&
    typeof value.occurredAt === 'string' &&
    typeof value.success === 'boolean'
  );
}

function isUsageAlert(value: unknown): value is UsageAlert {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.type === 'string' &&
    typeof value.createdAt === 'string' &&
    typeof value.actual === 'number' &&
    typeof value.threshold === 'number'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function alertDedupeKey(alert: UsageAlert): string {
  if (alert.type === 'session_tokens') {
    return `session-tokens:${alert.sessionId}`;
  }
  if (alert.type === 'session_cost') {
    return `session-cost:${alert.sessionId}`;
  }
  if (alert.type === 'daily_cost') {
    return `daily-cost:${alert.createdAt.slice(0, 10)}`;
  }
  return `provider-errors:${alert.createdAt.slice(0, 13)}`;
}

function roundMoney(value: number): number {
  return Math.round(value * 100_000_000) / 100_000_000;
}

function cleanText(value: string | undefined): string | null {
  const cleaned = value?.trim();
  return cleaned ? cleaned : null;
}

function readNonNegativeNumber(
  value: string | undefined,
  fallback: number,
): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function readOptionalNonNegativeNumber(
  value: string | undefined,
): number | null {
  if (value === undefined || value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function readPositiveInt(
  value: string | undefined,
  fallback: number,
): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readNonNegativeInt(
  value: string | undefined,
  fallback: number,
): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function readRatioOrZero(
  value: string | undefined,
  fallback: number,
): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1
    ? parsed
    : fallback;
}
