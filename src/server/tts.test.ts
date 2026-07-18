import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  readTtsConfig,
  synthesizeSpeech,
  type TtsConfig,
} from './tts.js';

describe('TTS provider configuration', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('prefers MiMo when auto mode has both provider keys', () => {
    vi.stubEnv('TTS_PROVIDER', 'auto');
    vi.stubEnv('MIMO_API_KEY', 'test-mimo-key');
    vi.stubEnv('OPENAI_API_KEY', 'test-openai-key');

    expect(readTtsConfig()).toMatchObject({
      provider: 'mimo',
      apiKey: 'test-mimo-key',
      model: 'mimo-v2.5-tts',
      voice: '冰糖',
      baseUrl: 'https://api.xiaomimimo.com/v1',
    });
  });

  it('uses browser speech when no server-side TTS key is configured', () => {
    vi.stubEnv('TTS_PROVIDER', 'auto');
    vi.stubEnv('MIMO_API_KEY', '');
    vi.stubEnv('OPENAI_API_KEY', '');

    expect(readTtsConfig()).toEqual({
      provider: 'browser',
      apiKey: null,
      model: 'web-speech-api',
      voice: 'system-default',
      baseUrl: '',
    });
  });
});

describe('MiMo speech synthesis', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends the official assistant-message audio request and decodes WAV', async () => {
    const audio = Buffer.from('RIFF-test-wave');
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        choices: [
          {
            message: {
              audio: {
                data: audio.toString('base64'),
              },
            },
          },
        ],
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const config: TtsConfig = {
      provider: 'mimo',
      apiKey: 'test-mimo-key',
      model: 'mimo-v2.5-tts',
      voice: '冰糖',
      baseUrl: 'https://mimo.invalid/v1',
    };
    const result = await synthesizeSpeech(
      config,
      '行李箱可以先留下。',
      'soft',
    );

    expect(result).toMatchObject({
      provider: 'mimo',
      model: 'mimo-v2.5-tts',
      contentType: 'audio/wav',
    });
    expect(result?.audio).toEqual(audio);
    expect(fetchMock).toHaveBeenCalledOnce();

    const [url, init] = fetchMock.mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toBe('https://mimo.invalid/v1/chat/completions');
    expect(init.headers).toMatchObject({
      'api-key': 'test-mimo-key',
      'Content-Type': 'application/json',
    });
    expect(JSON.parse(String(init.body))).toEqual({
      model: 'mimo-v2.5-tts',
      messages: [
        {
          role: 'user',
          content: '用逐渐放软、仍然谨慎的中文语气说。',
        },
        {
          role: 'assistant',
          content: '行李箱可以先留下。',
        },
      ],
      audio: {
        format: 'wav',
        voice: '冰糖',
      },
      stream: false,
    });
  });
});
