import { describe, expect, it } from 'vitest';
import {
  ARTIFACT_STORAGE_KEY,
  artifactRunsForScenario,
  clearArtifactLibrary,
  emptyArtifactLibrary,
  loadArtifactLibrary,
  parseArtifactLibrary,
  recordArtifactRun,
  saveArtifactLibrary,
  type ArtifactRun,
} from './artifacts.js';

function run(overrides: Partial<ArtifactRun> = {}): ArtifactRun {
  return {
    id: 'archive-1',
    scenarioId: 'weekend-market',
    scenarioTitle: '周五六点',
    playerGender: 'male',
    playerName: '徐坤',
    characterName: '秋雾',
    tier: 'S',
    endingTitle: '周末有约',
    completedAt: '2026-07-24T01:00:00.000Z',
    updatedAt: '2026-07-24T01:00:00.000Z',
    images: [
      {
        id: 'image-0',
        round: 0,
        label: '开场',
        url: 'https://example.com/image.jpg',
        provider: 'ark',
      },
    ],
    video: null,
    ...overrides,
  };
}

describe('local artifact library', () => {
  it('falls back safely for missing, damaged, or invalid data', () => {
    expect(parseArtifactLibrary(null)).toEqual(emptyArtifactLibrary());
    expect(parseArtifactLibrary('{bad json')).toEqual(
      emptyArtifactLibrary(),
    );
    expect(
      parseArtifactLibrary(
        JSON.stringify({ version: 1, runs: [{ id: 'bad' }] }),
      ),
    ).toEqual(emptyArtifactLibrary());
  });

  it('merges later images and video into the same completed run', () => {
    let library = recordArtifactRun(emptyArtifactLibrary(), run());
    library = recordArtifactRun(
      library,
      run({
        updatedAt: '2026-07-24T01:05:00.000Z',
        images: [
          {
            id: 'image-1',
            round: 1,
            label: '第 1 轮',
            url: 'https://example.com/image-1.jpg',
            provider: 'ark',
          },
        ],
        video: {
          id: 'video-1',
          url: 'https://example.com/video.mp4',
          provider: 'ark',
        },
      }),
    );

    expect(library.runs).toHaveLength(1);
    expect(library.runs[0].images.map((image) => image.round)).toEqual([
      0, 1,
    ]);
    expect(library.runs[0].video?.id).toBe('video-1');
    expect(
      artifactRunsForScenario(library, 'weekend-market'),
    ).toHaveLength(1);
    expect(
      artifactRunsForScenario(library, 'party-joke'),
    ).toHaveLength(0);
  });

  it('persists only the artifact key and clears it independently', () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    };
    const library = recordArtifactRun(emptyArtifactLibrary(), run());
    saveArtifactLibrary(library, storage);
    expect(values.has(ARTIFACT_STORAGE_KEY)).toBe(true);
    expect(loadArtifactLibrary(storage)).toEqual(library);
    expect(clearArtifactLibrary(storage)).toEqual(emptyArtifactLibrary());
    expect(values.has(ARTIFACT_STORAGE_KEY)).toBe(false);
  });
});
