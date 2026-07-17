import type { Tone } from '../shared/contracts.js';

const TONE_INSTRUCTIONS: Record<Tone, string> = {
  icy: '用克制、冰冷、低音量的中文语气说，停顿清楚。',
  sharp: '用锋利、快速、压着怒气的中文语气说。',
  quiet: '用安静、靠近耳语、情绪内收的中文语气说。',
  shaky: '用轻微颤抖、努力保持镇定的中文语气说。',
  dry: '用干燥、冷幽默、略带讽刺的中文语气说。',
  soft: '用逐渐放软、仍然谨慎的中文语气说。',
};

export interface TtsConfig {
  apiKey: string | null;
  model: string;
  voice: string;
}

export function readTtsConfig(): TtsConfig {
  const apiKey = process.env.OPENAI_API_KEY?.trim() || null;
  return {
    apiKey,
    model: process.env.OPENAI_TTS_MODEL?.trim() || 'gpt-4o-mini-tts',
    voice: process.env.OPENAI_TTS_VOICE?.trim() || 'marin',
  };
}

export async function synthesizeSpeech(
  config: TtsConfig,
  text: string,
  tone: Tone,
): Promise<Buffer | null> {
  if (!config.apiKey) return null;

  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.model,
      voice: config.voice,
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

  return Buffer.from(await response.arrayBuffer());
}
