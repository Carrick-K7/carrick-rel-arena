import {
  SCENARIO_IDS,
  type EndingTier,
  type Gender,
  type ScenarioId,
} from '../shared/contracts.js';

export const ARTIFACT_STORAGE_KEY =
  'relationship-training:artifacts:v1';

export interface ArchivedImage {
  id: string;
  round: number;
  label: string;
  url: string;
  provider: 'mock' | 'ark';
}

export interface ArtifactRun {
  id: string;
  scenarioId: ScenarioId;
  scenarioTitle: string;
  playerGender: Gender;
  playerName: string;
  characterName: string;
  tier: EndingTier;
  endingTitle: string;
  completedAt: string;
  updatedAt: string;
  images: ArchivedImage[];
  video: {
    id: string;
    url: string;
    provider: 'mock' | 'ark';
  } | null;
}

export interface ArtifactLibrary {
  version: 1;
  runs: ArtifactRun[];
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function emptyArtifactLibrary(): ArtifactLibrary {
  return { version: 1, runs: [] };
}

export function parseArtifactLibrary(
  raw: string | null,
): ArtifactLibrary {
  if (!raw) return emptyArtifactLibrary();
  try {
    const value = JSON.parse(raw) as unknown;
    if (
      !isRecord(value) ||
      value.version !== 1 ||
      !Array.isArray(value.runs) ||
      !value.runs.every(isArtifactRun)
    ) {
      return emptyArtifactLibrary();
    }
    return {
      version: 1,
      runs: [...value.runs].sort(
        (left, right) =>
          Date.parse(right.completedAt) -
          Date.parse(left.completedAt),
      ),
    };
  } catch {
    return emptyArtifactLibrary();
  }
}

export function loadArtifactLibrary(
  storage: StorageLike = window.localStorage,
): ArtifactLibrary {
  try {
    return parseArtifactLibrary(
      storage.getItem(ARTIFACT_STORAGE_KEY),
    );
  } catch {
    return emptyArtifactLibrary();
  }
}

export function saveArtifactLibrary(
  library: ArtifactLibrary,
  storage: StorageLike = window.localStorage,
): void {
  try {
    storage.setItem(
      ARTIFACT_STORAGE_KEY,
      JSON.stringify(library),
    );
  } catch {
    // The current page can still show the in-memory library.
  }
}

export function clearArtifactLibrary(
  storage: StorageLike = window.localStorage,
): ArtifactLibrary {
  try {
    storage.removeItem(ARTIFACT_STORAGE_KEY);
  } catch {
    // The in-memory reset still succeeds.
  }
  return emptyArtifactLibrary();
}

export function recordArtifactRun(
  library: ArtifactLibrary,
  run: ArtifactRun,
): ArtifactLibrary {
  const existing = library.runs.find(
    (candidate) => candidate.id === run.id,
  );
  const images = new Map(
    (existing?.images ?? []).map((image) => [image.id, image]),
  );
  for (const image of run.images) images.set(image.id, image);

  const merged: ArtifactRun = {
    ...run,
    completedAt: existing?.completedAt ?? run.completedAt,
    images: [...images.values()].sort(
      (left, right) => left.round - right.round,
    ),
    video: run.video ?? existing?.video ?? null,
  };
  return {
    version: 1,
    runs: [
      merged,
      ...library.runs.filter(
        (candidate) => candidate.id !== run.id,
      ),
    ].sort(
      (left, right) =>
        Date.parse(right.completedAt) -
        Date.parse(left.completedAt),
    ),
  };
}

export function artifactRunsForScenario(
  library: ArtifactLibrary,
  scenarioId: ScenarioId,
): ArtifactRun[] {
  return library.runs.filter(
    (run) => run.scenarioId === scenarioId,
  );
}

function isArtifactRun(value: unknown): value is ArtifactRun {
  if (!isRecord(value)) return false;
  return (
    isShortString(value.id, 100) &&
    isScenarioId(value.scenarioId) &&
    isShortString(value.scenarioTitle, 100) &&
    isGender(value.playerGender) &&
    isShortString(value.playerName, 40) &&
    isShortString(value.characterName, 40) &&
    isTier(value.tier) &&
    isShortString(value.endingTitle, 100) &&
    isIsoDate(value.completedAt) &&
    isIsoDate(value.updatedAt) &&
    Array.isArray(value.images) &&
    value.images.every(isArchivedImage) &&
    (value.video === null || isArchivedVideo(value.video))
  );
}

function isArchivedImage(value: unknown): value is ArchivedImage {
  return (
    isRecord(value) &&
    isShortString(value.id, 100) &&
    Number.isInteger(value.round) &&
    typeof value.round === 'number' &&
    value.round >= 0 &&
    value.round <= 7 &&
    isShortString(value.label, 100) &&
    isMediaUrl(value.url) &&
    isMediaProvider(value.provider)
  );
}

function isArchivedVideo(
  value: unknown,
): value is ArtifactRun['video'] {
  return (
    isRecord(value) &&
    isShortString(value.id, 100) &&
    isMediaUrl(value.url) &&
    isMediaProvider(value.provider)
  );
}

function isMediaUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 4096) return false;
  return (
    /^https?:\/\//.test(value) ||
    /^data:image\//.test(value) ||
    /^mock:\/\//.test(value)
  );
}

function isMediaProvider(
  value: unknown,
): value is 'mock' | 'ark' {
  return value === 'mock' || value === 'ark';
}

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isShortString(
  value: unknown,
  maxLength: number,
): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= maxLength
  );
}

function isScenarioId(value: unknown): value is ScenarioId {
  return (
    typeof value === 'string' &&
    (SCENARIO_IDS as readonly string[]).includes(value)
  );
}

function isGender(value: unknown): value is Gender {
  return value === 'male' || value === 'female';
}

function isTier(value: unknown): value is EndingTier {
  return value === 'S' || value === 'A' || value === 'C';
}

function isIsoDate(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    Number.isFinite(Date.parse(value))
  );
}
