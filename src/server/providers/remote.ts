import { z } from 'zod';
import type {
  AiProvider,
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
}

export class RemoteAiProvider implements AiProvider {
  readonly kind: Exclude<ProviderKind, 'mock'>;
  private readonly apiKey: string;
  private readonly model: string;
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

  async generate<T>(request: StructuredCompletionRequest<T>): Promise<T> {
    let lastError = 'unknown structured output error';

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const raw =
          this.kind === 'openai'
            ? await this.callOpenAi(request, attempt)
            : await this.callDeepSeek(request, attempt);
        const parsedJson = JSON.parse(stripJsonFence(raw)) as unknown;
        const parsed = request.schema.safeParse(parsedJson);
        if (parsed.success) return parsed.data;
        lastError = z.prettifyError(parsed.error);
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }
    }

    throw new ProviderError(
      `${request.agent} structured response failed: ${lastError}`,
      this.kind,
    );
  }

  private async callOpenAi<T>(
    request: StructuredCompletionRequest<T>,
    attempt: number,
  ): Promise<string> {
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
    const direct = payload.output_text?.trim();
    if (direct) return direct;

    const outputText = payload.output
      ?.flatMap((item) => item.content ?? [])
      .find((content) => content.type === 'output_text' && content.text)
      ?.text?.trim();
    if (!outputText) throw new Error('OpenAI returned no output text');
    return outputText;
  }

  private async callDeepSeek<T>(
    request: StructuredCompletionRequest<T>,
    attempt: number,
  ): Promise<string> {
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
    return content;
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

function stripJsonFence(value: string): string {
  return value
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}
