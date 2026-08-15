import type {
  Difficulty,
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
