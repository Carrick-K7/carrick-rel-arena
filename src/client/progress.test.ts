import { describe, expect, it } from 'vitest';
import {
  PROGRESS_STORAGE_KEY,
  clearProgress,
  emptyProgress,
  loadProgress,
  parseProgress,
  recordResult,
  saveProgress,
} from './progress.js';

describe('local relationship training progress', () => {
  it('returns empty progress for missing, damaged or old data', () => {
    expect(parseProgress(null)).toEqual(emptyProgress());
    expect(parseProgress('{not-json')).toEqual(emptyProgress());
    expect(
      parseProgress(
        JSON.stringify({
          version: 0,
          preferredGender: 'female',
          scenarios: {},
        }),
      ),
    ).toEqual(emptyProgress());
    expect(
      parseProgress(
        JSON.stringify({
          version: 1,
          preferredGender: 'male',
          scenarios: {
            'weekend-market': {
              completed: true,
              lastPlayedAt: 'not-a-date',
              genders: {},
            },
          },
        }),
      ),
    ).toEqual(emptyProgress());
  });

  it('keeps male and female records separate while merging completion', () => {
    let progress = recordResult(emptyProgress(), {
      scenarioId: 'weekend-market',
      gender: 'male',
      score: 62,
      tier: 'C',
      endingId: 'polite-goodbye',
      playedAt: '2026-07-18T08:00:00.000Z',
    });
    progress = recordResult(progress, {
      scenarioId: 'weekend-market',
      gender: 'female',
      score: 84,
      tier: 'A',
      endingId: 'another-day-with-date',
      playedAt: '2026-07-18T09:00:00.000Z',
    });

    expect(progress.scenarios['weekend-market']).toMatchObject({
      completed: true,
      lastPlayedAt: '2026-07-18T09:00:00.000Z',
    });
    expect(
      progress.scenarios['weekend-market']?.genders.male,
    ).toMatchObject({
      plays: 1,
      bestScore: 62,
      bestTier: 'C',
      endings: ['polite-goodbye'],
    });
    expect(
      progress.scenarios['weekend-market']?.genders.female,
    ).toMatchObject({
      plays: 1,
      bestScore: 84,
      bestTier: 'A',
      endings: ['another-day-with-date'],
    });
    expect(progress.preferredGender).toBe('female');
  });

  it('keeps the highest score and tier and de-duplicates endings', () => {
    let progress = recordResult(emptyProgress(), {
      scenarioId: 'party-joke',
      gender: 'male',
      score: 91,
      tier: 'S',
      endingId: 'back-side-by-side',
    });
    progress = recordResult(progress, {
      scenarioId: 'party-joke',
      gender: 'male',
      score: 55,
      tier: 'C',
      endingId: 'muted-group-chat',
    });
    progress = recordResult(progress, {
      scenarioId: 'party-joke',
      gender: 'male',
      score: 88,
      tier: 'S',
      endingId: 'back-side-by-side',
    });

    expect(progress.scenarios['party-joke']?.genders.male).toMatchObject({
      plays: 3,
      bestScore: 91,
      bestTier: 'S',
      endings: ['back-side-by-side', 'muted-group-chat'],
    });
  });

  it('persists and clears only the progress storage key', () => {
    const storage = new MemoryStorage();
    const progress = recordResult(emptyProgress(), {
      scenarioId: 'next-home',
      gender: 'female',
      score: 77,
      tier: 'A',
      endingId: 'two-more-viewings',
    });
    storage.setItem('unrelated', 'keep');
    saveProgress(progress, storage);

    expect(loadProgress(storage)).toEqual(progress);
    expect(storage.getItem(PROGRESS_STORAGE_KEY)).not.toBeNull();

    expect(clearProgress(storage)).toEqual(emptyProgress());
    expect(storage.getItem(PROGRESS_STORAGE_KEY)).toBeNull();
    expect(storage.getItem('unrelated')).toBe('keep');
  });
});

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}
