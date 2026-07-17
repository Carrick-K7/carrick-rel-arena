import { MockAiProvider } from './mock.js';
import { RemoteAiProvider } from './remote.js';
import type { AiProvider, ProviderKind } from './types.js';

export interface ProviderConfig {
  requested: ProviderKind;
  openAiApiKey: string | null;
  openAiModel: string;
  deepSeekApiKey: string | null;
  deepSeekModel: string;
}

export function readProviderConfig(): ProviderConfig {
  const requested = (process.env.AI_PROVIDER ?? 'mock').toLowerCase();
  if (!['mock', 'openai', 'deepseek'].includes(requested)) {
    throw new Error(
      `AI_PROVIDER must be mock, openai, or deepseek; received ${requested}`,
    );
  }

  return {
    requested: requested as ProviderKind,
    openAiApiKey: cleanSecret(process.env.OPENAI_API_KEY),
    openAiModel: process.env.OPENAI_MODEL?.trim() || 'gpt-5.4-mini',
    deepSeekApiKey: cleanSecret(process.env.DEEPSEEK_API_KEY),
    deepSeekModel:
      process.env.DEEPSEEK_MODEL?.trim() || 'deepseek-v4-flash',
  };
}

export function createAiProvider(config: ProviderConfig): AiProvider {
  if (config.requested === 'mock') return new MockAiProvider();

  if (config.requested === 'openai') {
    if (!config.openAiApiKey) {
      throw new Error(
        'AI_PROVIDER=openai requires OPENAI_API_KEY on the server',
      );
    }
    return new RemoteAiProvider({
      kind: 'openai',
      apiKey: config.openAiApiKey,
      model: config.openAiModel,
    });
  }

  if (!config.deepSeekApiKey) {
    throw new Error(
      'AI_PROVIDER=deepseek requires DEEPSEEK_API_KEY on the server',
    );
  }
  return new RemoteAiProvider({
    kind: 'deepseek',
    apiKey: config.deepSeekApiKey,
    model: config.deepSeekModel,
  });
}

function cleanSecret(value: string | undefined): string | null {
  const cleaned = value?.trim();
  return cleaned ? cleaned : null;
}
