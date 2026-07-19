import {
  OutputModeSchema,
  type OutputMode,
} from '../shared/contracts.js';

export const MODALITY_STORAGE_KEY =
  'relationship-training:modalities:v1';

export interface ModalityPreferences {
  outputs: OutputMode[];
}

export const DEFAULT_MODALITIES: ModalityPreferences = {
  outputs: ['text'],
};

const OUTPUT_ORDER: OutputMode[] = ['text', 'voice', 'image', 'video'];

export function loadModalities(): ModalityPreferences {
  try {
    const stored = localStorage.getItem(MODALITY_STORAGE_KEY);
    if (!stored) return DEFAULT_MODALITIES;
    const parsed = JSON.parse(stored) as Record<string, unknown>;
    const candidates = Array.isArray(parsed.outputs)
      ? parsed.outputs
      : parsed.output
        ? [parsed.output]
        : [];
    return { outputs: normalizeOutputs(candidates) };
  } catch {
    return DEFAULT_MODALITIES;
  }
}

export function saveModalities(
  preferences: ModalityPreferences,
): void {
  try {
    localStorage.setItem(
      MODALITY_STORAGE_KEY,
      JSON.stringify(preferences),
    );
  } catch {
    // The preference remains in memory when storage is unavailable.
  }
}

export function hasOutput(
  preferences: ModalityPreferences,
  output: OutputMode,
): boolean {
  return preferences.outputs.includes(output);
}

export function withOutput(
  preferences: ModalityPreferences,
  output: OutputMode,
): ModalityPreferences {
  if (output === 'text' || hasOutput(preferences, output)) {
    return preferences;
  }
  return {
    outputs: normalizeOutputs([...preferences.outputs, output]),
  };
}

export function toggleOutput(
  preferences: ModalityPreferences,
  output: OutputMode,
): ModalityPreferences {
  if (output === 'text') return preferences;
  return {
    outputs: normalizeOutputs(
      hasOutput(preferences, output)
        ? preferences.outputs.filter((candidate) => candidate !== output)
        : [...preferences.outputs, output],
    ),
  };
}

function normalizeOutputs(values: unknown[]): OutputMode[] {
  const valid = new Set<OutputMode>(['text']);
  for (const value of values) {
    const result = OutputModeSchema.safeParse(value);
    if (result.success) valid.add(result.data);
  }
  return OUTPUT_ORDER.filter((output) => valid.has(output));
}
