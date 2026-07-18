import { describe, expect, it } from 'vitest';
import { GameAgents } from './agents.js';
import {
  MediaError,
  MediaGenerationService,
  type MediaConfig,
} from './media.js';
import { MockAiProvider } from './providers/mock.js';
import { GameSessionService } from './sessions.js';

const config: MediaConfig = {
  provider: 'mock',
  apiKey: null,
  accessKey: 'test-media-key',
  baseUrl: 'https://example.invalid/api/v3',
  imageModel: 'mock-image',
  imageSize: '2K',
  imageTimeoutMs: 180_000,
  videoModel: 'mock-video',
  videoResolution: '480p',
  videoRatio: '16:9',
  videoDurationSeconds: 4,
  videoPollIntervalMs: 1_000,
  videoTimeoutMs: 30_000,
};

function createService() {
  const sessions = new GameSessionService(
    new GameAgents(new MockAiProvider()),
    5,
  );
  const session = sessions.create('weekend-market', 'male');
  const service = new MediaGenerationService(
    config,
    (sessionId) => sessions.get(sessionId),
  );
  return { service, session };
}

describe('MediaGenerationService', () => {
  it('uses constant-time access validation and rejects the wrong key', () => {
    const { service, session } = createService();
    expect(service.verifyAccess('test-media-key')).toBe(true);
    expect(service.verifyAccess('wrong')).toBe(false);
    expect(() =>
      service.create(
        {
          sessionId: session.state.sessionId,
          hookId: session.state.activeEvent!.videoCue!.hookId,
          kind: 'image',
        },
        'wrong',
      ),
    ).toThrowError(MediaError);
  });

  it('generates one idempotent image for the active authored hook', async () => {
    const { service, session } = createService();
    const input = {
      sessionId: session.state.sessionId,
      hookId: session.state.activeEvent!.videoCue!.hookId,
      kind: 'image' as const,
    };

    const first = service.create(input, 'test-media-key');
    const duplicate = service.create(input, 'test-media-key');
    expect(duplicate.id).toBe(first.id);

    await new Promise((resolve) => setTimeout(resolve, 80));
    const completed = service.get(first.id, 'test-media-key');
    expect(completed.status).toBe('succeeded');
    expect(completed.url).toMatch(/^data:image\/svg\+xml/);
    expect(completed.usageTokens).toBe(0);
  });

  it('does not accept arbitrary or stale hook prompts', () => {
    const { service, session } = createService();
    expect(() =>
      service.create(
        {
          sessionId: session.state.sessionId,
          hookId: 'client-supplied-prompt',
          kind: 'video',
        },
        'test-media-key',
      ),
    ).toThrowError(
      expect.objectContaining({
        code: 'MEDIA_HOOK_INACTIVE',
      }),
    );
  });
});
