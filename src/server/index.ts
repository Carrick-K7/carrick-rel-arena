import process from 'node:process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express, {
  type ErrorRequestHandler,
  type NextFunction,
  type Request,
  type Response,
} from 'express';
import { z, ZodError } from 'zod';
import {
  CapabilitiesSchema,
  CreateSessionInputSchema,
  GenderSchema,
  ToneSchema,
  TurnInputSchema,
} from '../shared/contracts.js';
import { GameAgents } from './agents.js';
import {
  createAiProvider,
  readProviderConfig,
} from './providers/index.js';
import { ProviderError } from './providers/types.js';
import { GameSessionService, SessionError } from './sessions.js';
import { createBriefing } from './scenario.js';
import {
  readTtsConfig,
  synthesizeSpeech,
} from './tts.js';
import {
  readUsageConfig,
  UsageTracker,
} from './usage.js';

try {
  process.loadEnvFile();
} catch (error) {
  const code = (error as NodeJS.ErrnoException).code;
  if (code !== 'ENOENT') throw error;
}

const providerConfig = readProviderConfig();
const provider = createAiProvider(providerConfig);
const usageTracker = new UsageTracker(readUsageConfig());
const agents = new GameAgents(
  provider,
  (usage) => usageTracker.recordModel(usage),
);
const ttlMinutes = parsePositiveInt(process.env.SESSION_TTL_MINUTES, 120);
const sessions = new GameSessionService(
  agents,
  ttlMinutes,
  usageTracker,
);
const ttsConfig = readTtsConfig();
const port = parsePositiveInt(process.env.PORT, 3100);
const host = process.env.HOST?.trim() || '127.0.0.1';
const appBasePath = normalizeBasePath(process.env.APP_BASE_PATH);
const isProduction = process.env.NODE_ENV === 'production';

const capabilities = CapabilitiesSchema.parse({
  textProvider: provider.kind,
  remoteText: provider.kind !== 'mock',
  serverTts: Boolean(ttsConfig.apiKey),
  ttsProvider: ttsConfig.provider,
  videoHooks: 'reserved',
  sessionStorage: 'memory-ttl',
  usageTracking: 'enabled',
  usageAlerting: usageTracker.alertingEnabled,
});

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 'loopback');
if (appBasePath) {
  app.use((request, response, next) => {
    if (request.url === appBasePath) {
      response.redirect(308, `${appBasePath}/`);
      return;
    }
    if (request.url.startsWith(`${appBasePath}/`)) {
      request.url = request.url.slice(appBasePath.length) || '/';
    }
    next();
  });
}
app.use(express.json({ limit: '32kb' }));
app.use((_request, response, next) => {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('Permissions-Policy', 'camera=(), geolocation=()');
  next();
});

const turnLimit = createRateLimit(30, 60_000);
const speechLimit = createRateLimit(60, 60_000);

app.get('/api/health', (_request, response) => {
  response.json({
    ok: true,
    provider: provider.kind,
    model: provider.model,
    usageAlerts: usageTracker.getSnapshot().alerts.length,
    now: new Date().toISOString(),
  });
});

app.get('/api/capabilities', (_request, response) => {
  response.json(capabilities);
});

app.get('/api/scenario', (request, response) => {
  const playerGender = GenderSchema
    .default('male')
    .parse(request.query.playerGender);
  response.json({ briefing: createBriefing(playerGender) });
});

app.post('/api/sessions', turnLimit, (request, response) => {
  const input = CreateSessionInputSchema.parse(request.body ?? {});
  response
    .status(201)
    .json({ session: sessions.create(input.playerGender) });
});

app.get('/api/sessions/:sessionId', (request, response) => {
  response.json({
    session: sessions.get(readRouteParam(request.params.sessionId)),
  });
});

app.post(
  '/api/sessions/:sessionId/turns',
  turnLimit,
  async (request, response) => {
    const input = TurnInputSchema.parse(request.body);
    const result = await sessions.playTurn(
      readRouteParam(request.params.sessionId),
      input.text,
    );
    response.json(result);
  },
);

const SpeechInputSchema = z.strictObject({
  text: z.string().trim().min(1).max(160),
  tone: ToneSchema,
  speakerGender: GenderSchema.optional(),
  sessionId: z.string().uuid().nullable().optional(),
});

app.post('/api/speech', speechLimit, async (request, response) => {
  const input = SpeechInputSchema.parse(request.body);
  const startedAt = performance.now();
  let speech: Awaited<ReturnType<typeof synthesizeSpeech>>;
  try {
    speech = await synthesizeSpeech(
      ttsConfig,
      input.text,
      input.tone,
      input.speakerGender,
    );
    usageTracker.recordTts({
      provider: speech?.provider ?? 'browser',
      model: speech?.model ?? 'web-speech-api',
      sessionId: input.sessionId ?? null,
      success: true,
      latencyMs: Math.max(
        0,
        Math.round(performance.now() - startedAt),
      ),
      characters: input.text.length,
      errorCode: null,
    });
  } catch (error) {
    usageTracker.recordTts({
      provider: ttsConfig.provider,
      model: ttsConfig.model,
      sessionId: input.sessionId ?? null,
      success: false,
      latencyMs: Math.max(
        0,
        Math.round(performance.now() - startedAt),
      ),
      characters: input.text.length,
      errorCode: 'TTS_FAILED',
    });
    throw error;
  }
  if (!speech) {
    response.status(204).end();
    return;
  }
  response.setHeader('Content-Type', speech.contentType);
  response.setHeader('Cache-Control', 'private, no-store');
  response.send(speech.audio);
});

app.get(
  '/api/admin/usage',
  requireUsageAdmin,
  (_request, response) => {
    response.setHeader('Cache-Control', 'private, no-store');
    response.json(usageTracker.getSnapshot());
  },
);

app.get(
  '/api/admin/metrics',
  requireUsageAdmin,
  (_request, response) => {
    response.type('text/plain; version=0.0.4');
    response.send(usageTracker.toPrometheus());
  },
);

app.use('/api', (_request, response) => {
  response.status(404).json({
    error: {
      code: 'API_NOT_FOUND',
      message: 'API 路径不存在。',
    },
  });
});

if (isProduction) {
  const projectRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../..',
  );
  const clientDir = path.join(projectRoot, 'dist/client');
  app.use(
    express.static(clientDir, {
      etag: true,
      maxAge: '1h',
      setHeaders(response, assetPath) {
        if (assetPath.includes(`${path.sep}assets${path.sep}`)) {
          response.setHeader(
            'Cache-Control',
            'public, max-age=31536000, immutable',
          );
        }
      },
    }),
  );
  app.get('/*splat', (_request, response) => {
    response.sendFile(path.join(clientDir, 'index.html'));
  });
} else {
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    server: {
      middlewareMode: true,
    },
    appType: 'spa',
  });
  app.use(vite.middlewares);
}

const errorHandler: ErrorRequestHandler = (
  error: unknown,
  _request: Request,
  response: Response,
  _next: NextFunction,
) => {
  if (error instanceof ZodError) {
    response.status(400).json({
      error: {
        code: 'INVALID_INPUT',
        message: '输入格式不符合要求。',
        detail: z.prettifyError(error),
      },
    });
    return;
  }

  if (error instanceof SessionError) {
    response.status(error.status).json({
      error: {
        code: error.code,
        message: error.message,
      },
    });
    return;
  }

  if (error instanceof ProviderError) {
    console.error(
      `[provider:${error.provider}] ${error.message.replaceAll(/\s+/g, ' ')}`,
    );
    response.status(502).json({
      error: {
        code: 'MODEL_UNAVAILABLE',
        message: '对方正在组织语言，这一轮没有消耗。请再试一次。',
      },
    });
    return;
  }

  const message = error instanceof Error ? error.message : String(error);
  console.error('[server]', message);
  response.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: '场记刚刚摔了一跤，请重试。',
    },
  });
};
app.use(errorHandler);

app.listen(port, host, () => {
  console.log(
    `关系修罗场 running at http://${host}:${port} [${provider.kind}:${provider.model}]`,
  );
});

function requireUsageAdmin(
  request: Request,
  response: Response,
  next: NextFunction,
) {
  const expected = usageTracker.adminToken;
  if (!expected) {
    next();
    return;
  }
  const authorization = request.get('authorization') ?? '';
  const supplied = authorization.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : request.get('x-usage-admin-token') ?? '';
  if (supplied !== expected) {
    response.status(401).json({
      error: {
        code: 'USAGE_ADMIN_UNAUTHORIZED',
        message: '用量管理凭据无效。',
      },
    });
    return;
  }
  next();
}

function createRateLimit(limit: number, windowMs: number) {
  const buckets = new Map<string, number[]>();

  return (request: Request, response: Response, next: NextFunction) => {
    const key = request.ip || request.socket.remoteAddress || 'local';
    const cutoff = Date.now() - windowMs;
    const recent = (buckets.get(key) ?? []).filter(
      (timestamp) => timestamp > cutoff,
    );
    if (recent.length >= limit) {
      response.status(429).json({
        error: {
          code: 'RATE_LIMITED',
          message: '这一分钟说得有点多，先让空气安静一下。',
        },
      });
      return;
    }
    recent.push(Date.now());
    buckets.set(key, recent);
    next();
  };
}

function parsePositiveInt(
  value: string | undefined,
  fallback: number,
): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readRouteParam(value: string | string[]): string {
  return Array.isArray(value) ? value[0] ?? '' : value;
}

function normalizeBasePath(value: string | undefined): string {
  const segment = value?.trim().replace(/^\/+|\/+$/g, '') ?? '';
  return segment ? `/${segment}` : '';
}
