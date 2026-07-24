import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { GameAgents } from './agents.js';
import {
  createImagePrompt,
  createMemoryVideoPrompt,
  loadPrototypeReferences,
  MediaError,
  MediaGenerationService,
  persistMediaAsset,
  type MediaConfig,
} from './media.js';
import { MockAiProvider } from './providers/mock.js';
import { GameSessionService } from './sessions.js';

const config: MediaConfig = {
  provider: 'mock',
  apiKey: null,
  accessKey: 'test-media-key',
  baseUrl: 'https://example.invalid/api/v3',
  publicBaseUrl: 'https://example.invalid/rel-arena/',
  imageModel: 'mock-image',
  imageSize: '2K',
  imageTimeoutMs: 180_000,
  videoModel: 'mock-video',
  videoResolution: '480p',
  videoRatio: '16:9',
  videoDurationSeconds: 15,
  videoPollIntervalMs: 1_000,
  videoTimeoutMs: 30_000,
  archiveDir: null,
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
  return { service, session, sessions };
}

describe('MediaGenerationService', () => {
  it('copies provider media into a stable release-independent path', async () => {
    const archiveDir = mkdtempSync(
      path.join(tmpdir(), 'relationship-media-'),
    );
    try {
      const url = await persistMediaAsset({
        sourceUrl:
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB',
        kind: 'image',
        generationId: '11111111-1111-4111-8111-111111111111',
        archiveDir,
        publicBaseUrl: 'https://example.com/rel-arena/',
      });
      expect(url).toBe(
        'https://example.com/rel-arena/api/media/files/11111111-1111-4111-8111-111111111111.png',
      );
      expect(
        existsSync(
          path.join(
            archiveDir,
            '11111111-1111-4111-8111-111111111111.png',
          ),
        ),
      ).toBe(true);
    } finally {
      rmSync(archiveDir, { force: true, recursive: true });
    }
  });

  it('inlines local prototype images so Ark does not fetch public URLs', () => {
    const references = loadPrototypeReferences(
      'https://example.invalid/rel-arena/',
    );
    expect(references).toHaveLength(3);
    for (const reference of references) {
      expect(reference).toMatch(/^data:image\/jpeg;base64,/);
      expect(reference.length).toBeGreaterThan(1_000);
    }
  });

  it('uses constant-time access validation and rejects the wrong key', () => {
    const { service, session } = createService();
    expect(service.verifyAccess('test-media-key')).toBe(true);
    expect(service.verifyAccess('wrong')).toBe(false);
    expect(() =>
      service.create(
        {
          sessionId: session.state.sessionId,
          beatId: session.visualBeats[0].id,
          kind: 'image',
        },
        'wrong',
      ),
    ).toThrowError(MediaError);
  });

  it('generates one idempotent image for any server-issued beat', async () => {
    const { service, session } = createService();
    const input = {
      sessionId: session.state.sessionId,
      beatId: session.visualBeats[0].id,
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

  it('rejects a client-supplied beat and a video before settlement', () => {
    const { service, session } = createService();
    expect(() =>
      service.create(
        {
          sessionId: session.state.sessionId,
          beatId: 'client-supplied-prompt',
          kind: 'image',
        },
        'test-media-key',
      ),
    ).toThrowError(
      expect.objectContaining({
        code: 'MEDIA_BEAT_INVALID',
      }),
    );
    expect(() =>
      service.create(
        {
          sessionId: session.state.sessionId,
          beatId: session.visualBeats[0].id,
          kind: 'video',
        },
        'test-media-key',
      ),
    ).toThrowError(
      expect.objectContaining({
        code: 'MEMORY_FILM_NOT_READY',
      }),
    );
  });

  it('creates a visual beat for every reply and one final memory film', async () => {
    const { service, session, sessions } = createService();
    let current = session;
    const line =
      '我理解你的需要，也真诚在意你。我们明天一起定具体安排，你可以选择，也可以拒绝。';

    while (current.state.phase !== 'result') {
      current = (
        await sessions.playTurn(current.state.sessionId, line)
      ).session;
    }

    expect(current.visualBeats).toHaveLength(current.state.round + 1);
    expect(current.visualBeats[0]).toMatchObject({
      round: 0,
      kind: 'opening',
      playerLine: null,
    });
    expect(current.visualBeats.at(-1)).toMatchObject({
      round: current.state.round,
      kind: 'ending',
      playerLine: line,
    });
    expect(current.visualBeats.at(-1)?.characterLine).toBe(
      current.transcript.at(-1)?.text,
    );

    for (const beat of current.visualBeats) {
      service.create(
        {
          sessionId: current.state.sessionId,
          beatId: beat.id,
          kind: 'image',
        },
        'test-media-key',
      );
      await new Promise((resolve) => setTimeout(resolve, 60));
    }

    const finalBeat = current.visualBeats.at(-1)!;
    const film = service.create(
      {
        sessionId: current.state.sessionId,
        beatId: finalBeat.id,
        kind: 'video',
      },
      'test-media-key',
    );
    const duplicate = service.create(
      {
        sessionId: current.state.sessionId,
        beatId: finalBeat.id,
        kind: 'video',
      },
      'test-media-key',
    );
    expect(duplicate.id).toBe(film.id);
    await new Promise((resolve) => setTimeout(resolve, 120));
    expect(service.get(film.id, 'test-media-key')).toMatchObject({
      status: 'succeeded',
      kind: 'video',
      beatId: finalBeat.id,
    });
  });

  it('builds continuity prompts without asking the models to draw text', async () => {
    const { session, sessions } = createService();
    const line = '我想先理解你的感受，再一起决定下一步。';
    const next = (
      await sessions.playTurn(session.state.sessionId, line)
    ).session;
    const beat = next.visualBeats.at(-1)!;
    const imagePrompt = createImagePrompt(next, beat, true);

    expect(imagePrompt).toContain('图1和图2都是秋雾');
    expect(imagePrompt).toContain('图3是徐坤');
    expect(imagePrompt).toContain('图4是本局上一视觉节拍');
    expect(imagePrompt).toContain(line);
    expect(imagePrompt).toContain('不要生成任何汉字');

    let settled = next;
    while (settled.state.phase !== 'result') {
      settled = (
        await sessions.playTurn(settled.state.sessionId, line)
      ).session;
    }
    const videoPrompt = createMemoryVideoPrompt(settled, 7, 15);
    const finalImagePrompt = createImagePrompt(
      settled,
      settled.visualBeats.at(-1)!,
      true,
    );
    expect(finalImagePrompt).toContain('结局定格');
    expect(finalImagePrompt).toContain('结局气氛冲突');
    expect(videoPrompt).toContain('15 秒');
    expect(videoPrompt).toContain('图4至图7');
    expect(videoPrompt).toContain('压缩一整局关系对话');
    expect(videoPrompt).toContain('不要生成对白声音');
  });
});
