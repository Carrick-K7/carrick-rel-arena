import {
  InputModeSchema,
  OutputModeSchema,
  type InputMode,
  type OutputMode,
} from '../shared/contracts.js';

export const MODALITY_STORAGE_KEY =
  'relationship-training:modalities:v1';

export interface ModalityPreferences {
  input: InputMode;
  output: OutputMode;
}

export const DEFAULT_MODALITIES: ModalityPreferences = {
  input: 'text',
  output: 'text',
};

export function loadModalities(): ModalityPreferences {
  try {
    const stored = localStorage.getItem(MODALITY_STORAGE_KEY);
    if (!stored) return DEFAULT_MODALITIES;
    const parsed = JSON.parse(stored) as Record<string, unknown>;
    return {
      input: InputModeSchema.catch(DEFAULT_MODALITIES.input).parse(
        parsed.input,
      ),
      output: OutputModeSchema.catch(DEFAULT_MODALITIES.output).parse(
        parsed.output,
      ),
    };
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
