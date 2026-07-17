import { z } from 'zod';
import type {
  AiProvider,
  ModelUsage,
  ProviderKind,
  StructuredCompletionRequest,
} from './types.js';
import { ProviderError } from './types.js';

interface RemoteProviderOptions {
  kind: Exclude<ProviderKind, 'mock'>;
  apiKey: string;
  model: string;
  baseUrl?: string;
  timeoutMs?: number;
}

interface ResponsesPayload {
  output_text?: string;
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
  error?: {
    message?: string;
  };
  usage?: {
    input_tokens?: number;
    input_tokens_details?: {
      cached_tokens?: number;
      cache_write_tokens?: number;
    };
    output_tokens?: number;
    output_tokens_details?: {
      reasoning_tokens?: number;
    };
    total_tokens?: number;
  };
}

interface ChatPayload {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
  error?: {
    message?: string;
  };
  usage?: {
    completion_tokens?: number;
    prompt_tokens?: number;
    prompt_cache_hit_tokens?: number;
    prompt_cache_miss_tokens?: number;
    total_tokens?: number;
    completion_tokens_details?: {
      reasoning_tokens?: number;
    };
  };
}

interface TokenUsage {
  inputTokens: number;
  cachedInputTokens: number;
  cacheWriteTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  totalTokens: number;
}

interface RemoteCallResult {
  text: string;
  usage: TokenUsage | null;
}

export class RemoteAiProvider implements AiProvider {
  readonly kind: Exclude<ProviderKind, 'mock'>;
  private readonly apiKey: string;
  readonly model: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(options: RemoteProviderOptions) {
    this.kind = options.kind;
    this.apiKey = options.apiKey;
    this.model = options.model;
    this.baseUrl =
      options.baseUrl ??
      (options.kind === 'openai'
        ? 'https://api.openai.com/v1'
        : 'https://api.deepseek.com');
    this.timeoutMs = options.timeoutMs ?? 25_000;
  }

  async generate<T>(request: StructuredCompletionRequest<T>) {
    const startedAt = performance.now();
    let lastError = 'unknown structured output error';
    let attempts = 0;
    let measured = false;
    const tokenUsage = emptyTokenUsage();

    for (let attempt = 0; attempt < 2; attempt += 1) {
      attempts = attempt + 1;
      try {
        const call =
          this.kind === 'openai'
            ? await this.callOpenAi(request, attempt)
            : await this.callDeepSeek(request, attempt);
        if (call.usage) {
          measured = true;
          addTokenUsage(tokenUsage, call.usage);
        }
        const parsedJson = JSON.parse(stripJsonFence(call.text)) as unknown;
        const parsed = request.schema.safeParse(parsedJson);
        if (parsed.success) {
          return {
            data: parsed.data,
            usage: this.createUsage(
              request,
              tokenUsage,
              attempts,
              measured,
              startedAt,
              true,
              null,
            ),
          };
        }
        lastError = z.prettifyError(parsed.error);
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }
    }

    const usage = this.createUsage(
      request,
      tokenUsage,
      attempts,
      measured,
      startedAt,
      false,
      'STRUCTURED_OUTPUT_FAILED',
    );
    throw new ProviderError(
      `${request.agent} structured response failed: ${lastError}`,
      this.kind,
      true,
      usage,
    );
  }

  private async callOpenAi<T>(
    request: StructuredCompletionRequest<T>,
    attempt: number,
  ): Promise<RemoteCallResult> {
    const schema = z.toJSONSchema(request.schema, {
      target: 'draft-7',
      unrepresentable: 'any',
    });
    const repair =
      attempt === 0
        ? ''
        : '\n上次输出未通过 Schema 校验。重新生成完整 JSON，保持字段和值域准确。';
    const response = await this.fetchJson(`${this.baseUrl}/responses`, {
      model: this.model,
      instructions: `${request.system}${repair}`,
      input: JSON.stringify(request.input),
      text: {
        format: {
          type: 'json_schema',
          name: request.schemaName,
          strict: true,
          schema,
        },
      },
      reasoning: {
        effort: request.agent === 'actor' ? 'none' : 'low',
      },
      max_output_tokens: request.maxOutputTokens,
      store: false,
    });

    const payload = response as ResponsesPayload;
    if (payload.error?.message) {
      throw new Error(payload.error.message);
    }
    const usage = parseOpenAiUsage(payload.usage);
    const direct = payload.output_text?.trim();
    if (direct) return { text: direct, usage };

    const outputText = payload.output
      ?.flatMap((item) => item.content ?? [])
      .find((content) => content.type === 'output_text' && content.text)
      ?.text?.trim();
    if (!outputText) throw new Error('OpenAI returned no output text');
    return { text: outputText, usage };
  }

  private async callDeepSeek<T>(
    request: StructuredCompletionRequest<T>,
    attempt: number,
  ): Promise<RemoteCallResult> {
    const jsonShape = z.toJSONSchema(request.schema, {
      target: 'draft-7',
      unrepresentable: 'any',
    });
    const repair =
      attempt === 0
        ? ''
        : '\n上次 JSON 为空或未通过校验。请重新返回完整、有效、符合字段和值域要求的 JSON。';
    const response = await this.fetchJson(`${this.baseUrl}/chat/completions`, {
      model: this.model,
      messages: [
        {
          role: 'system',
          content: `${request.system}\n输出必须是 JSON 对象。参考 JSON Schema：${JSON.stringify(jsonShape)}${repair}`,
        },
        {
          role: 'user',
          content: JSON.stringify(request.input),
        },
      ],
      response_format: {
        type: 'json_object',
      },
      thinking: {
        type: 'disabled',
      },
      max_tokens: request.maxOutputTokens,
      stream: false,
    });

    const payload = response as ChatPayload;
    if (payload.error?.message) {
      throw new Error(payload.error.message);
    }
    const content = payload.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error('DeepSeek returned empty JSON content');
    return {
      text: content,
      usage: parseDeepSeekUsage(payload.usage),
    };
  }

  private createUsage<T>(
    request: StructuredCompletionRequest<T>,
    tokens: TokenUsage,
    attempts: number,
    measured: boolean,
    startedAt: number,
    success: boolean,
    errorCode: string | null,
  ): ModelUsage {
    return {
      provider: this.kind,
      model: this.model,
      agent: request.agent,
      sessionId: request.context.state.sessionId,
      occurredAt: new Date().toISOString(),
      success,
      attempts,
      measured,
      latencyMs: Math.max(0, Math.round(performance.now() - startedAt)),
      ...tokens,
      errorCode,
    };
  }

  private async fetchJson(
    url: string,
    body: Record<string, unknown>,
  ): Promise<unknown> {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    const text = await response.text();
    if (!response.ok) {
      throw new Error(
        `${this.kind} HTTP ${response.status}: ${text.slice(0, 320)}`,
      );
    }

    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new Error(`${this.kind} returned invalid HTTP JSON`);
    }
  }
}

function emptyTokenUsage(): TokenUsage {
  return {
    inputTokens: 0,
    cachedInputTokens: 0,
    cacheWriteTokens: 0,
    outputTokens: 0,
    reasoningTokens: 0,
    totalTokens: 0,
  };
}

function addTokenUsage(target: TokenUsage, addition: TokenUsage) {
  target.inputTokens += addition.inputTokens;
  target.cachedInputTokens += addition.cachedInputTokens;
  target.cacheWriteTokens += addition.cacheWriteTokens;
  target.outputTokens += addition.outputTokens;
  target.reasoningTokens += addition.reasoningTokens;
  target.totalTokens += addition.totalTokens;
}

function parseOpenAiUsage(
  usage: ResponsesPayload['usage'],
): TokenUsage | null {
  if (!usage) return null;
  const inputTokens = nonNegativeInt(usage.input_tokens);
  const outputTokens = nonNegativeInt(usage.output_tokens);
  return {
    inputTokens,
    cachedInputTokens: nonNegativeInt(
      usage.input_tokens_details?.cached_tokens,
    ),
    cacheWriteTokens: nonNegativeInt(
      usage.input_tokens_details?.cache_write_tokens,
    ),
    outputTokens,
    reasoningTokens: nonNegativeInt(
      usage.output_tokens_details?.reasoning_tokens,
    ),
    totalTokens:
      nonNegativeInt(usage.total_tokens) || inputTokens + outputTokens,
  };
}

function parseDeepSeekUsage(
  usage: ChatPayload['usage'],
): TokenUsage | null {
  if (!usage) return null;
  const inputTokens = nonNegativeInt(usage.prompt_tokens);
  const outputTokens = nonNegativeInt(usage.completion_tokens);
  return {
    inputTokens,
    cachedInputTokens: nonNegativeInt(
      usage.prompt_cache_hit_tokens,
    ),
    cacheWriteTokens: 0,
    outputTokens,
    reasoningTokens: nonNegativeInt(
      usage.completion_tokens_details?.reasoning_tokens,
    ),
    totalTokens:
      nonNegativeInt(usage.total_tokens) || inputTokens + outputTokens,
  };
}

function nonNegativeInt(value: number | undefined): number {
  return Number.isFinite(value)
    ? Math.max(0, Math.round(value ?? 0))
    : 0;
}

function stripJsonFence(value: string): string {
  return value
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}
