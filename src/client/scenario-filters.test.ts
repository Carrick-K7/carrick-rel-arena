import { describe, expect, it } from 'vitest';
import { listScenarioSummaries } from '../server/scenario.js';
import { emptyProgress, recordResult } from './progress.js';
import {
  defaultScenarioId,
  filterScenarios,
  reconcileSelectedScenario,
} from './scenario-filters.js';

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

  it('selects the most recently played scenario by default', () => {
    let progress = recordResult(emptyProgress(), {
      scenarioId: 'weekend-market',
      gender: 'male',
      score: 92,
      tier: 'S',
      endingId: 'weekend-has-plans',
      playedAt: '2026-07-17T08:00:00.000Z',
    });
    progress = recordResult(progress, {
      scenarioId: 'party-joke',
      gender: 'female',
      score: 85,
      tier: 'A',
      endingId: 'ask-first-next-time',
      playedAt: '2026-07-18T08:00:00.000Z',
    });

    expect(defaultScenarioId(scenarios, progress)).toBe('party-joke');
    expect(defaultScenarioId(scenarios, emptyProgress())).toBe(
      'weekend-market',
    );
  });

  it('keeps a visible selection and otherwise chooses the first result', () => {
    const visible = scenarios.filter(
      (scenario) => scenario.type === 'comfort',
    );
    expect(reconcileSelectedScenario('rejected-proposal', visible)).toBe(
      'rejected-proposal',
    );
    expect(reconcileSelectedScenario('weekend-market', visible)).toBe(
      'rejected-proposal',
    );
    expect(reconcileSelectedScenario('weekend-market', [])).toBeNull();
  });
});
