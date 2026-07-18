import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_MODALITIES,
  MODALITY_STORAGE_KEY,
  loadModalities,
  saveModalities,
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

  it('stores only selected modes', () => {
    saveModalities({ input: 'voice', output: 'video' });
    expect(loadModalities()).toEqual({
      input: 'voice',
      output: 'video',
    });
    expect(storage.get(MODALITY_STORAGE_KEY)).toBe(
      '{"input":"voice","output":"video"}',
    );
  });
});
