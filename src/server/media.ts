import { timingSafeEqual } from 'node:crypto';
import {
  MediaGenerationSchema,
  type MediaGeneration,
  type MediaKind,
  type PublicSession,
} from '../shared/contracts.js';

type MediaProviderKind = 'disabled' | 'mock' | 'ark';

export interface MediaConfig {
  provider: MediaProviderKind;
  apiKey: string | null;
  accessKey: string | null;
  baseUrl: string;
  imageModel: string;
  imageSize: string;
  imageTimeoutMs: number;
  videoModel: string;
  videoResolution: string;
  videoRatio: string;
  videoDurationSeconds: number;
  videoPollIntervalMs: number;
  videoTimeoutMs: number;
}

interface MediaResult {
  url: string;
  usageTokens: number | null;
}

interface MediaProvider {
  readonly kind: Exclude<MediaProviderKind, 'disabled'>;
  imageModel: string;
  videoModel: string;
  generateImage(prompt: string): Promise<MediaResult>;
  generateVideo(prompt: string): Promise<MediaResult>;
}

interface StoredMediaGeneration extends MediaGeneration {
  prompt: string;
}

export class MediaError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'MediaError';
  }
}

export function readMediaConfig(): MediaConfig {
  const requested = (
    process.env.MEDIA_PROVIDER?.trim().toLowerCase() || 'disabled'
  );
  if (!['disabled', 'mock', 'ark'].includes(requested)) {
    throw new Error(
      `MEDIA_PROVIDER must be disabled, mock, or ark; received ${requested}`,
    );
  }

  const provider = requested as MediaProviderKind;
  const apiKey = cleanSecret(process.env.ARK_API_KEY);
  const accessKey = cleanSecret(process.env.MEDIA_ACCESS_KEY);
  if (provider === 'ark' && !apiKey) {
    throw new Error('MEDIA_PROVIDER=ark requires ARK_API_KEY on the server');
  }
  if (provider !== 'disabled' && !accessKey) {
    throw new Error(
      'Image and video generation require MEDIA_ACCESS_KEY on the server',
    );
  }

  return {
    provider,
    apiKey,
    accessKey,
    baseUrl:
      cleanText(process.env.ARK_BASE_URL) ??
      'https://ark.cn-beijing.volces.com/api/v3',
    imageModel:
      cleanText(process.env.ARK_IMAGE_MODEL) ??
      'doubao-seedream-5-0-260128',
    imageSize: cleanText(process.env.ARK_IMAGE_SIZE) ?? '2K',
    imageTimeoutMs: readInt(
      process.env.ARK_IMAGE_TIMEOUT_MS,
      180_000,
      30_000,
      300_000,
    ),
    videoModel:
      cleanText(process.env.ARK_VIDEO_MODEL) ??
      'doubao-seedance-2-0-260128',
    videoResolution:
      cleanText(process.env.ARK_VIDEO_RESOLUTION) ?? '480p',
    videoRatio: cleanText(process.env.ARK_VIDEO_RATIO) ?? '16:9',
    videoDurationSeconds: readInt(
      process.env.ARK_VIDEO_DURATION_SECONDS,
      4,
      4,
      15,
    ),
    videoPollIntervalMs: readInt(
      process.env.ARK_VIDEO_POLL_INTERVAL_MS,
      4_000,
      1_000,
      30_000,
    ),
    videoTimeoutMs: readInt(
      process.env.ARK_VIDEO_TIMEOUT_MS,
      360_000,
      30_000,
      900_000,
    ),
  };
}

export class MediaGenerationService {
  private readonly provider: MediaProvider | null;
  private readonly records = new Map<string, StoredMediaGeneration>();
  private readonly generationIds = new Map<string, string>();

  constructor(
    private readonly config: MediaConfig,
    private readonly getSession: (sessionId: string) => PublicSession,
  ) {
    this.provider = createMediaProvider(config);
    const timer = setInterval(() => this.deleteExpired(), 60_000);
    timer.unref();
  }

  get capability(): 'unavailable' | 'mock' | 'ark' {
    return this.provider?.kind ?? 'unavailable';
  }

  get accessRequired(): boolean {
    return Boolean(this.provider && this.config.accessKey);
  }

  verifyAccess(candidate: string | undefined): boolean {
    const expected = this.config.accessKey;
    if (!expected || !candidate) return false;
    const expectedBytes = Buffer.from(expected);
    const candidateBytes = Buffer.from(candidate);
    return (
      expectedBytes.length === candidateBytes.length &&
      timingSafeEqual(expectedBytes, candidateBytes)
    );
  }

  assertAccess(candidate: string | undefined): void {
    if (!this.provider) {
      throw new MediaError(
        '图像与视频生成尚未配置。',
        503,
        'MEDIA_UNAVAILABLE',
      );
    }
    if (!this.verifyAccess(candidate)) {
      throw new MediaError(
        '媒体密钥不正确。',
        403,
        'MEDIA_ACCESS_DENIED',
      );
    }
  }

  create(
    input: {
      sessionId: string;
      hookId: string;
      kind: MediaKind;
    },
    accessKey: string | undefined,
  ): MediaGeneration {
    this.assertAccess(accessKey);
    const session = this.getSession(input.sessionId);
    const requestKey = [
      input.sessionId,
      input.hookId,
      input.kind,
    ].join(':');
    const existingId = this.generationIds.get(requestKey);
    if (existingId) return this.get(existingId, accessKey);

    const cue = session.state.activeEvent?.videoCue;
    if (!cue || cue.hookId !== input.hookId) {
      throw new MediaError(
        '这个剧情节点已经结束，请在当前节点生成媒体。',
        409,
        'MEDIA_HOOK_INACTIVE',
      );
    }

    const now = new Date().toISOString();
    const record: StoredMediaGeneration = {
      id: crypto.randomUUID(),
      sessionId: input.sessionId,
      hookId: input.hookId,
      kind: input.kind,
      status: 'queued',
      url: null,
      error: null,
      provider: this.provider!.kind,
      model:
        input.kind === 'image'
          ? this.provider!.imageModel
          : this.provider!.videoModel,
      usageTokens: null,
      createdAt: now,
      updatedAt: now,
      prompt: createMediaPrompt(session, cue.prompt, input.kind),
    };
    this.records.set(record.id, record);
    this.generationIds.set(requestKey, record.id);
    void this.run(record);
    return toPublic(record);
  }

  get(
    generationId: string,
    accessKey: string | undefined,
  ): MediaGeneration {
    this.assertAccess(accessKey);
    const record = this.records.get(generationId);
    if (!record) {
      throw new MediaError(
        '媒体任务不存在或已过期。',
        404,
        'MEDIA_NOT_FOUND',
      );
    }
    return toPublic(record);
  }

  private async run(record: StoredMediaGeneration): Promise<void> {
    record.status = 'running';
    record.updatedAt = new Date().toISOString();
    try {
      const result =
        record.kind === 'image'
          ? await this.provider!.generateImage(record.prompt)
          : await this.provider!.generateVideo(record.prompt);
      record.status = 'succeeded';
      record.url = result.url;
      record.usageTokens = result.usageTokens;
      record.error = null;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '媒体生成失败';
      console.error(
        `[media:${record.provider}:${record.kind}] ${message.replaceAll(/\s+/g, ' ')}`,
      );
      record.status = 'failed';
      record.error = '生成没有完成，请稍后重试。';
    }
    record.updatedAt = new Date().toISOString();
  }

  private deleteExpired() {
    const cutoff = Date.now() - 2 * 60 * 60_000;
    for (const [id, record] of this.records) {
      if (Date.parse(record.updatedAt) < cutoff) {
        this.records.delete(id);
        this.generationIds.delete(
          [record.sessionId, record.hookId, record.kind].join(':'),
        );
      }
    }
  }
}

function createMediaProvider(config: MediaConfig): MediaProvider | null {
  if (config.provider === 'disabled') return null;
  if (config.provider === 'mock') {
    return new MockMediaProvider(config);
  }
  return new ArkMediaProvider(config);
}

class MockMediaProvider implements MediaProvider {
  readonly kind = 'mock' as const;
  readonly imageModel: string;
  readonly videoModel: string;

  constructor(config: MediaConfig) {
    this.imageModel = config.imageModel;
    this.videoModel = config.videoModel;
  }

  async generateImage(): Promise<MediaResult> {
    await delay(40);
    const svg = [
      '<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540">',
      '<defs><linearGradient id="g" x1="0" x2="1"><stop stop-color="#f9dce5"/><stop offset="1" stop-color="#dff5ef"/></linearGradient></defs>',
      '<rect width="960" height="540" fill="url(#g)"/>',
      '<circle cx="390" cy="255" r="92" fill="#ffffff" opacity=".78"/>',
      '<circle cx="570" cy="255" r="92" fill="#ffffff" opacity=".78"/>',
      '<text x="480" y="430" text-anchor="middle" fill="#35615d" font-size="34" font-family="sans-serif">关系修炼 · 剧情图像</text>',
      '</svg>',
    ].join('');
    return {
      url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
      usageTokens: 0,
    };
  }

  async generateVideo(): Promise<MediaResult> {
    await delay(80);
    return {
      url: 'mock://relationship-training/video',
      usageTokens: 0,
    };
  }
}

class ArkMediaProvider implements MediaProvider {
  readonly kind = 'ark' as const;
  readonly imageModel: string;
  readonly videoModel: string;

  constructor(private readonly config: MediaConfig) {
    this.imageModel = config.imageModel;
    this.videoModel = config.videoModel;
  }

  async generateImage(prompt: string): Promise<MediaResult> {
    const payload = await this.request<{
      data?: Array<{ url?: string }>;
      usage?: {
        total_tokens?: number;
        output_tokens?: number;
      };
      error?: { message?: string };
    }>(
      '/images/generations',
      {
        method: 'POST',
        body: JSON.stringify({
          model: this.config.imageModel,
          prompt,
          size: this.config.imageSize,
          sequential_image_generation: 'disabled',
          response_format: 'url',
          watermark: false,
        }),
      },
      this.config.imageTimeoutMs,
    );
    const url = payload.data?.[0]?.url;
    if (!url) {
      throw new Error(
        payload.error?.message || 'Ark image response contained no URL',
      );
    }
    return {
      url,
      usageTokens:
        payload.usage?.total_tokens ??
        payload.usage?.output_tokens ??
        null,
    };
  }

  async generateVideo(prompt: string): Promise<MediaResult> {
    const created = await this.request<{ id?: string; error?: unknown }>(
      '/contents/generations/tasks',
      {
        method: 'POST',
        body: JSON.stringify({
          model: this.config.videoModel,
          content: [{ type: 'text', text: prompt }],
          resolution: this.config.videoResolution,
          ratio: this.config.videoRatio,
          duration: this.config.videoDurationSeconds,
          generate_audio: false,
          watermark: false,
        }),
      },
    );
    if (!created.id) {
      throw new Error('Ark video response contained no task ID');
    }

    const deadline = Date.now() + this.config.videoTimeoutMs;
    while (Date.now() < deadline) {
      await delay(this.config.videoPollIntervalMs);
      let task: {
        status?: string;
        content?: { video_url?: string };
        usage?: {
          total_tokens?: number;
          completion_tokens?: number;
        };
        error?: { code?: string; message?: string } | null;
      };
      try {
        task = await this.request(
          `/contents/generations/tasks/${encodeURIComponent(created.id)}`,
        );
      } catch (error) {
        if (isRetryablePollError(error)) continue;
        throw error;
      }
      if (task.status === 'succeeded') {
        const url = task.content?.video_url;
        if (!url) throw new Error('Ark video task contained no URL');
        return {
          url,
          usageTokens:
            task.usage?.total_tokens ??
            task.usage?.completion_tokens ??
            null,
        };
      }
      if (
        ['failed', 'cancelled', 'expired'].includes(task.status ?? '')
      ) {
        throw new Error(
          `Ark video task ${task.status}: ${
            task.error?.message ?? task.error?.code ?? 'unknown error'
          }`,
        );
      }
    }
    throw new Error('Ark video task timed out');
  }

  private async request<T>(
    pathname: string,
    init: RequestInit = {},
    timeoutMs = 30_000,
  ): Promise<T> {
    const response = await fetch(`${this.config.baseUrl}${pathname}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
        ...init.headers,
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
    const body = await response.text();
    if (!response.ok) {
      throw new Error(
        `Ark HTTP ${response.status}: ${body.slice(0, 300)}`,
      );
    }
    try {
      return JSON.parse(body) as T;
    } catch {
      throw new Error('Ark returned invalid JSON');
    }
  }
}

function createMediaPrompt(
  session: PublicSession,
  authoredPrompt: string,
  kind: MediaKind,
): string {
  const scene =
    kind === 'video'
      ? sanitizeVideoPrompt(authoredPrompt)
      : authoredPrompt;
  if (kind === 'video') {
    return `${scene}\n两位25岁成年中国职场人，一位短黑发男性，一位棕色长卷发女性，穿粉白与浅薄荷色现代职场服装。使用原创普通人面孔，中远景构图，不做面部特写。生成4秒横向写实广告叙事镜头，16:9，人物动作自然，运镜稳定。画面中不要出现文字、字幕、水印或品牌标志。`;
  }

  const player =
    session.state.playerGender === 'female'
      ? '25岁成年中国女性产品经理，棕色长卷发，粉白与浅薄荷职场穿搭'
      : '25岁成年中国男性程序员，短黑发，清爽克制的浅色职场穿搭';
  const opponent =
    session.briefing.character.gender === 'female'
      ? '25岁成年中国女性产品经理，棕色长卷发，圆润可爱但有明确成年感，粉白与浅薄荷职场穿搭'
      : '25岁成年中国男性程序员，短黑发，克制敏锐，清爽浅色职场穿搭';
  return `${scene}\n人物设定：玩家是${player}；对方是${opponent}。两人都是原创虚构人物，使用原创虚构面孔。生成一张横向写实剧情剧照，16:9 构图，人物身份清晰，画面中不要出现文字、字幕、水印或品牌标志。`;
}

function sanitizeVideoPrompt(prompt: string): string {
  return prompt
    .replaceAll('露天电影', '河边户外活动')
    .replaceAll('小型放映', '小型室内活动')
    .replaceAll('电影镜头', '写实镜头')
    .replaceAll('电影感', '写实质感')
    .replaceAll('放映', '室内活动')
    .replaceAll('电影', '活动');
}

function toPublic(record: StoredMediaGeneration): MediaGeneration {
  return MediaGenerationSchema.parse({
    id: record.id,
    sessionId: record.sessionId,
    hookId: record.hookId,
    kind: record.kind,
    status: record.status,
    url: record.url,
    error: record.error,
    provider: record.provider,
    model: record.model,
    usageTokens: record.usageTokens,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });
}

function cleanSecret(value: string | undefined): string | null {
  return cleanText(value);
}

function cleanText(value: string | undefined): string | null {
  const cleaned = value?.trim();
  return cleaned ? cleaned : null;
}

function readInt(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed)
    ? Math.min(maximum, Math.max(minimum, parsed))
    : fallback;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function isRetryablePollError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (
    error.name === 'AbortError' ||
    error.name === 'TimeoutError' ||
    error.message === 'fetch failed'
  ) {
    return true;
  }
  const status = /^Ark HTTP (\d{3}):/.exec(error.message)?.[1];
  if (!status) return false;
  const code = Number.parseInt(status, 10);
  return code === 429 || code >= 500;
}
