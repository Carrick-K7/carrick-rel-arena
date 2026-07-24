import type { Gender, Tone } from '../shared/contracts.js';

const NATURAL_PACE =
  '保持自然日常对话语速，不刻意放慢，不拖长句尾，不加入不必要的停顿。';

const TONE_INSTRUCTIONS: Record<Tone, string> = {
  icy: `用克制、冰冷、低音量的中文语气说。${NATURAL_PACE}`,
  sharp: `用锋利、略快、压着怒气但吐字清楚的中文语气说。${NATURAL_PACE}`,
  quiet: `用安静、情绪内收但清晰可闻的中文语气说。${NATURAL_PACE}`,
  shaky: `用轻微颤抖、仍在维持镇定的中文语气说。${NATURAL_PACE}`,
  dry: `用干燥、冷幽默、略带讽刺的中文语气说。${NATURAL_PACE}`,
  soft: `用逐渐放软、仍然谨慎的中文语气说。${NATURAL_PACE}`,
};

export interface TtsConfig {
  provider: 'mimo' | 'openai' | 'browser';
  apiKey: string | null;
  model: string;
  voice: string;
  maleVoice: string;
  femaleVoice: string;
  baseUrl: string;
}

export interface TtsResult {
  audio: Buffer;
  contentType: 'audio/wav' | 'audio/mpeg';
  provider: 'mimo' | 'openai';
  model: string;
}

export function readTtsConfig(): TtsConfig {
  const requested = (
    process.env.TTS_PROVIDER?.trim().toLowerCase() || 'auto'
  );
  if (!['auto', 'mimo', 'openai', 'browser'].includes(requested)) {
    throw new Error(
      `TTS_PROVIDER must be auto, mimo, openai, or browser; received ${requested}`,
    );
  }
  const mimoApiKey = process.env.MIMO_API_KEY?.trim() || null;
  const openAiApiKey = process.env.OPENAI_API_KEY?.trim() || null;

  if (
    (requested === 'auto' && mimoApiKey) ||
    (requested === 'mimo' && mimoApiKey)
  ) {
    return {
      provider: 'mimo',
      apiKey: mimoApiKey,
      model:
        process.env.MIMO_TTS_MODEL?.trim() || 'mimo-v2.5-tts',
      voice: process.env.MIMO_TTS_VOICE?.trim() || '冰糖',
      maleVoice:
        process.env.MIMO_TTS_MALE_VOICE?.trim() || '白桦',
      femaleVoice:
        process.env.MIMO_TTS_FEMALE_VOICE?.trim() ||
        process.env.MIMO_TTS_VOICE?.trim() ||
        '冰糖',
      baseUrl:
        process.env.MIMO_BASE_URL?.trim() ||
        'https://api.xiaomimimo.com/v1',
    };
  }

  if (
    (requested === 'auto' && openAiApiKey) ||
    (requested === 'openai' && openAiApiKey)
  ) {
    return {
      provider: 'openai',
      apiKey: openAiApiKey,
      model: process.env.OPENAI_TTS_MODEL?.trim() || 'gpt-4o-mini-tts',
      voice: process.env.OPENAI_TTS_VOICE?.trim() || 'marin',
      maleVoice:
        process.env.OPENAI_TTS_MALE_VOICE?.trim() || 'cedar',
      femaleVoice:
        process.env.OPENAI_TTS_FEMALE_VOICE?.trim() ||
        process.env.OPENAI_TTS_VOICE?.trim() ||
        'marin',
      baseUrl:
        process.env.OPENAI_BASE_URL?.trim() ||
        'https://api.openai.com/v1',
    };
  }

  return {
    provider: 'browser',
    apiKey: null,
    model: 'web-speech-api',
    voice: 'system-default',
    maleVoice: 'system-default',
    femaleVoice: 'system-default',
    baseUrl: '',
  };
}

export async function synthesizeSpeech(
  config: TtsConfig,
  text: string,
  tone: Tone,
  speakerGender?: Gender,
): Promise<TtsResult | null> {
  if (!config.apiKey) return null;
  if (config.provider === 'mimo') {
    return synthesizeMiMo(config, text, tone, speakerGender);
  }
  if (config.provider === 'openai') {
    return synthesizeOpenAi(config, text, tone, speakerGender);
  }
  return null;
}

async function synthesizeOpenAi(
  config: TtsConfig,
  text: string,
  tone: Tone,
  speakerGender?: Gender,
): Promise<TtsResult> {
  const response = await fetch(`${config.baseUrl}/audio/speech`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.model,
      voice: selectVoice(config, speakerGender),
      input: text,
      instructions: TONE_INSTRUCTIONS[tone],
      response_format: 'mp3',
    }),
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `OpenAI TTS HTTP ${response.status}: ${detail.slice(0, 240)}`,
    );
  }

  return {
    audio: Buffer.from(await response.arrayBuffer()),
    contentType: 'audio/mpeg',
    provider: 'openai',
    model: config.model,
  };
}

interface MiMoSpeechPayload {
  choices?: Array<{
    message?: {
      audio?: {
        data?: string;
      };
    };
  }>;
  error?: {
    message?: string;
  };
}

async function synthesizeMiMo(
  config: TtsConfig,
  text: string,
  tone: Tone,
  speakerGender?: Gender,
): Promise<TtsResult> {
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'api-key': config.apiKey ?? '',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        {
          role: 'user',
          content: TONE_INSTRUCTIONS[tone],
        },
        {
          role: 'assistant',
          content: text,
        },
      ],
      audio: {
        format: 'wav',
        voice: selectVoice(config, speakerGender),
      },
      stream: false,
    }),
    signal: AbortSignal.timeout(30_000),
  });

  const body = await response.text();
  if (!response.ok) {
    throw new Error(
      `MiMo TTS HTTP ${response.status}: ${body.slice(0, 240)}`,
    );
  }

  let payload: MiMoSpeechPayload;
  try {
    payload = JSON.parse(body) as MiMoSpeechPayload;
  } catch {
    throw new Error('MiMo TTS returned invalid HTTP JSON');
  }
  if (payload.error?.message) {
    throw new Error(`MiMo TTS: ${payload.error.message}`);
  }
  const encoded = payload.choices?.[0]?.message?.audio?.data;
  if (!encoded) {
    throw new Error('MiMo TTS returned no audio data');
  }
  const audio = Buffer.from(encoded, 'base64');
  if (audio.length === 0) {
    throw new Error('MiMo TTS returned empty audio data');
  }
  return {
    audio,
    contentType: 'audio/wav',
    provider: 'mimo',
    model: config.model,
  };
}

function selectVoice(
  config: TtsConfig,
  speakerGender: Gender | undefined,
): string {
  if (speakerGender === 'male') return config.maleVoice;
  if (speakerGender === 'female') return config.femaleVoice;
  return config.voice;
}
