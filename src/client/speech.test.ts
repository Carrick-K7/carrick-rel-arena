import { describe, expect, it } from 'vitest';
import type { Tone } from '../shared/contracts.js';
import {
  browserSpeechRate,
  GENERATED_AUDIO_PLAYBACK_RATE,
} from './speech.js';

describe('character speech pace', () => {
  it('uses a natural browser speech rate for every non-sharp emotion', () => {
    const naturalTones: Tone[] = [
      'icy',
      'quiet',
      'shaky',
      'dry',
      'soft',
    ];
    for (const tone of naturalTones) {
      expect(browserSpeechRate(tone)).toBe(1);
    }
    expect(browserSpeechRate('sharp')).toBe(1.04);
  });

  it('slightly accelerates provider audio that otherwise sounds slow', () => {
    expect(GENERATED_AUDIO_PLAYBACK_RATE).toBe(1.08);
  });
});
