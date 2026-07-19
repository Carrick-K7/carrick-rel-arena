import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_MODALITIES,
  MODALITY_STORAGE_KEY,
  hasOutput,
  loadModalities,
  saveModalities,
  toggleOutput,
  withOutput,
} from './modalities.js';

const storage = new Map<string, string>();

beforeEach(() => {
  storage.clear();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem(key: string) {
        return storage.get(key) ?? null;
      },
      setItem(key: string, value: string) {
        storage.set(key, value);
      },
    },
  });
});

describe('modality preferences', () => {
  it('falls back safely for missing or corrupt data', () => {
    expect(loadModalities()).toEqual(DEFAULT_MODALITIES);
    storage.set(MODALITY_STORAGE_KEY, '{bad-json');
    expect(loadModalities()).toEqual(DEFAULT_MODALITIES);
    storage.set(
      MODALITY_STORAGE_KEY,
      JSON.stringify({ input: 'camera', output: 'hologram' }),
    );
    expect(loadModalities()).toEqual(DEFAULT_MODALITIES);
  });

  it('stores several outputs while text remains mandatory', () => {
    saveModalities({ outputs: ['text', 'voice', 'image', 'video'] });
    expect(loadModalities()).toEqual({
      outputs: ['text', 'voice', 'image', 'video'],
    });
    expect(storage.get(MODALITY_STORAGE_KEY)).toBe(
      '{"outputs":["text","voice","image","video"]}',
    );
  });

  it('migrates the old single output and drops the old input choice', () => {
    storage.set(
      MODALITY_STORAGE_KEY,
      JSON.stringify({ input: 'voice', output: 'video' }),
    );
    expect(loadModalities()).toEqual({
      outputs: ['text', 'video'],
    });
  });

  it('toggles optional outputs without allowing text to be removed', () => {
    const voice = withOutput(DEFAULT_MODALITIES, 'voice');
    expect(hasOutput(voice, 'voice')).toBe(true);
    const combined = toggleOutput(voice, 'image');
    expect(combined.outputs).toEqual(['text', 'voice', 'image']);
    expect(toggleOutput(combined, 'voice').outputs).toEqual([
      'text',
      'image',
    ]);
    expect(toggleOutput(combined, 'text')).toBe(combined);
  });
});
