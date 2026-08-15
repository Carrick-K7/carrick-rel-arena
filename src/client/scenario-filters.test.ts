import { describe, expect, it } from 'vitest';
import { listScenarioSummaries } from '../server/scenario.js';
import { emptyProgress, recordResult } from './progress.js';
import { filterScenarios } from './scenario-filters.js';

const scenarios = listScenarioSummaries();

describe('scenario filters', () => {
  it('uses AND across groups and OR within a group', () => {
    const progress = recordResult(emptyProgress(), {
      scenarioId: 'weekend-market',
      gender: 'male',
      score: 92,
      tier: 'S',
      endingId: 'weekend-has-plans',
      playedAt: '2026-07-18T08:00:00.000Z',
    });
    const visible = filterScenarios(scenarios, progress, {
      completion: 'incomplete',
      types: ['invitation', 'comfort'],
      difficulties: ['进阶'],
    });

    expect(visible.map((scenario) => scenario.id)).toEqual([
      'rejected-proposal',
      'friend-farewell',
    ]);
  });

  it('filters by completion state', () => {
    const progress = recordResult(emptyProgress(), {
      scenarioId: 'weekend-market',
      gender: 'male',
      score: 92,
      tier: 'S',
      endingId: 'weekend-has-plans',
      playedAt: '2026-07-18T08:00:00.000Z',
    });

    expect(
      filterScenarios(scenarios, progress, {
        completion: 'completed',
        types: [],
        difficulties: [],
      }).map((scenario) => scenario.id),
    ).toEqual(['weekend-market']);
    expect(
      filterScenarios(scenarios, progress, {
        completion: 'incomplete',
        types: [],
        difficulties: [],
      }),
    ).toHaveLength(scenarios.length - 1);
  });
});
