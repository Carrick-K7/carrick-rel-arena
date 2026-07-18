import {
  ENDING_IDS,
  SCENARIO_IDS,
  endingBelongsToScenario,
  type EndingId,
  type EndingTier,
  type Gender,
  type ScenarioId,
} from '../shared/contracts.js';

export const PROGRESS_STORAGE_KEY = 'relationship-training:progress:v1';

export interface RoleProgress {
  plays: number;
  bestScore: number;
  bestTier: EndingTier;
  endings: EndingId[];
  lastPlayedAt: string;
}

export interface ScenarioProgress {
  completed: boolean;
  lastPlayedAt: string;
  genders: Partial<Record<Gender, RoleProgress>>;
}

export interface LocalProgress {
  version: 1;
  preferredGender: Gender;
  scenarios: Partial<Record<ScenarioId, ScenarioProgress>>;
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function emptyProgress(): LocalProgress {
  return {
    version: 1,
    preferredGender: 'male',
    scenarios: {},
  };
}

export function parseProgress(raw: string | null): LocalProgress {
  if (!raw) return emptyProgress();
  try {
    const value = JSON.parse(raw) as unknown;
    if (!isRecord(value) || value.version !== 1) return emptyProgress();
    if (!isGender(value.preferredGender) || !isRecord(value.scenarios)) {
      return emptyProgress();
    }

    const scenarios: LocalProgress['scenarios'] = {};
    for (const [scenarioId, candidate] of Object.entries(value.scenarios)) {
      if (!isScenarioId(scenarioId) || !isRecord(candidate)) {
        return emptyProgress();
      }
      if (
        typeof candidate.completed !== 'boolean' ||
        !isIsoDate(candidate.lastPlayedAt) ||
        !isRecord(candidate.genders)
      ) {
        return emptyProgress();
      }
      const genders: ScenarioProgress['genders'] = {};
      for (const [gender, roleCandidate] of Object.entries(
        candidate.genders,
      )) {
        if (!isGender(gender) || !isRoleProgress(roleCandidate, scenarioId)) {
          return emptyProgress();
        }
        genders[gender] = {
          plays: roleCandidate.plays,
          bestScore: roleCandidate.bestScore,
          bestTier: roleCandidate.bestTier,
          endings: [...roleCandidate.endings],
          lastPlayedAt: roleCandidate.lastPlayedAt,
        };
      }
      scenarios[scenarioId] = {
        completed: candidate.completed,
        lastPlayedAt: candidate.lastPlayedAt,
        genders,
      };
    }

    return {
      version: 1,
      preferredGender: value.preferredGender,
      scenarios,
    };
  } catch {
    return emptyProgress();
  }
}

export function loadProgress(
  storage: StorageLike = window.localStorage,
): LocalProgress {
  try {
    return parseProgress(storage.getItem(PROGRESS_STORAGE_KEY));
  } catch {
    return emptyProgress();
  }
}

export function saveProgress(
  progress: LocalProgress,
  storage: StorageLike = window.localStorage,
): void {
  try {
    storage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Progress remains available for the current render.
  }
}

export function clearProgress(
  storage: StorageLike = window.localStorage,
): LocalProgress {
  try {
    storage.removeItem(PROGRESS_STORAGE_KEY);
  } catch {
    // The in-memory reset still succeeds.
  }
  return emptyProgress();
}

export function withPreferredGender(
  progress: LocalProgress,
  preferredGender: Gender,
): LocalProgress {
  return {
    ...progress,
    preferredGender,
  };
}

export function recordResult(
  progress: LocalProgress,
  result: {
    scenarioId: ScenarioId;
    gender: Gender;
    score: number;
    tier: EndingTier;
    endingId: EndingId;
    playedAt?: string;
  },
): LocalProgress {
  if (!endingBelongsToScenario(result.scenarioId, result.endingId)) {
    return progress;
  }
  const playedAt = result.playedAt ?? new Date().toISOString();
  const existingScenario = progress.scenarios[result.scenarioId];
  const existingRole = existingScenario?.genders[result.gender];
  const endings = Array.from(
    new Set([...(existingRole?.endings ?? []), result.endingId]),
  );
  const role: RoleProgress = {
    plays: (existingRole?.plays ?? 0) + 1,
    bestScore: Math.max(existingRole?.bestScore ?? 0, result.score),
    bestTier: bestTier(existingRole?.bestTier, result.tier),
    endings,
    lastPlayedAt: playedAt,
  };

  return {
    version: 1,
    preferredGender: result.gender,
    scenarios: {
      ...progress.scenarios,
      [result.scenarioId]: {
        completed: true,
        lastPlayedAt: playedAt,
        genders: {
          ...existingScenario?.genders,
          [result.gender]: role,
        },
      },
    },
  };
}

export function bestTier(
  current: EndingTier | undefined,
  next: EndingTier,
): EndingTier {
  if (!current) return next;
  const rank: Record<EndingTier, number> = { S: 3, A: 2, C: 1 };
  return rank[next] > rank[current] ? next : current;
}

function isRoleProgress(
  value: unknown,
  scenarioId: ScenarioId,
): value is RoleProgress {
  if (!isRecord(value)) return false;
  return (
    Number.isInteger(value.plays) &&
    typeof value.plays === 'number' &&
    value.plays >= 0 &&
    Number.isInteger(value.bestScore) &&
    typeof value.bestScore === 'number' &&
    value.bestScore >= 0 &&
    value.bestScore <= 100 &&
    isTier(value.bestTier) &&
    Array.isArray(value.endings) &&
    value.endings.every(
      (endingId) =>
        isEndingId(endingId) &&
        endingBelongsToScenario(scenarioId, endingId),
    ) &&
    new Set(value.endings).size === value.endings.length &&
    isIsoDate(value.lastPlayedAt)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isScenarioId(value: string): value is ScenarioId {
  return (SCENARIO_IDS as readonly string[]).includes(value);
}

function isEndingId(value: unknown): value is EndingId {
  return (
    typeof value === 'string' &&
    (ENDING_IDS as readonly string[]).includes(value)
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
