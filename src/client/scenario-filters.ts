import type {
  Difficulty,
  ScenarioId,
  ScenarioSummary,
  ScenarioType,
} from '../shared/contracts.js';
import type { LocalProgress } from './progress.js';

export type CompletionFilter = 'all' | 'incomplete' | 'completed';

export interface ScenarioFilters {
  completion: CompletionFilter;
  types: ScenarioType[];
  difficulties: Difficulty[];
}

export const DEFAULT_SCENARIO_FILTERS: ScenarioFilters = {
  completion: 'all',
  types: [],
  difficulties: [],
};

export function filterScenarios(
  scenarios: ScenarioSummary[],
  progress: LocalProgress,
  filters: ScenarioFilters,
): ScenarioSummary[] {
  return scenarios.filter((scenario) => {
    const completed = progress.scenarios[scenario.id]?.completed === true;
    const matchesCompletion =
      filters.completion === 'all' ||
      (filters.completion === 'completed' && completed) ||
      (filters.completion === 'incomplete' && !completed);
    const matchesType =
      filters.types.length === 0 || filters.types.includes(scenario.type);
    const matchesDifficulty =
      filters.difficulties.length === 0 ||
      filters.difficulties.includes(scenario.difficulty);
    return matchesCompletion && matchesType && matchesDifficulty;
  });
}

export function defaultScenarioId(
  scenarios: ScenarioSummary[],
  progress: LocalProgress,
): ScenarioId {
  const recent = Object.entries(progress.scenarios)
    .filter((entry): entry is [ScenarioId, NonNullable<typeof entry[1]>] =>
      Boolean(entry[1]?.lastPlayedAt),
    )
    .sort(
      (left, right) =>
        Date.parse(right[1].lastPlayedAt) - Date.parse(left[1].lastPlayedAt),
    )[0]?.[0];
  return recent && scenarios.some((scenario) => scenario.id === recent)
    ? recent
    : scenarios[0].id;
}

export function reconcileSelectedScenario(
  selected: ScenarioId,
  visible: ScenarioSummary[],
): ScenarioId | null {
  if (visible.some((scenario) => scenario.id === selected)) return selected;
  return visible[0]?.id ?? null;
}
