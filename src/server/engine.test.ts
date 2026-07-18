import { describe, expect, it } from 'vitest';
import {
  GameStateSchema,
  SCENARIO_IDS,
  endingBelongsToScenario,
  type DirectorDecision,
} from '../shared/contracts.js';
import { GameAgents } from './agents.js';
import {
  applyDirectorDecision,
  createInitialState,
  selectEnding,
} from './engine.js';
import { MockAiProvider } from './providers/mock.js';
import {
  SCENARIO_ORDER,
  createBriefing,
  getScenarioDefinition,
} from './scenario.js';
import { GameSessionService } from './sessions.js';

const SESSION_ID = '7401c52f-e7f6-4cd6-a4f4-934dc783cf1f';

const neutralDecision: DirectorDecision = {
  assessment: '测试判定',
  delta: {
    warmth: 0,
    pressure: 0,
    openness: 0,
  },
  discoveries: {
    understoodNeed: false,
    proposedAction: false,
    respectedChoice: false,
    sincereCare: false,
  },
  event: null,
  actorBrief: '保持戒备。',
  shouldEnd: false,
  suggestedEndReason: null,
};

describe('typed scenario catalog', () => {
  it('contains the eight authored scenarios in order and with 5-7 rounds', () => {
    expect(SCENARIO_ORDER.map((scenario) => scenario.id)).toEqual(
      SCENARIO_IDS,
    );
    expect(SCENARIO_ORDER.map((scenario) => scenario.maxRounds)).toEqual([
      5, 5, 6, 6, 6, 6, 7, 7,
    ]);
    expect(
      SCENARIO_ORDER.map((scenario) => scenario.type),
    ).toEqual([
      'invitation',
      'invitation',
      'comfort',
      'comfort',
      'alignment',
      'repair',
      'repair',
      'alignment',
    ]);
  });

  it('defines one S, A and C ending owned by every scenario', () => {
    const allEndingIds = new Set<string>();
    for (const scenario of SCENARIO_ORDER) {
      expect(Object.keys(scenario.endings)).toEqual(['S', 'A', 'C']);
      for (const tier of ['S', 'A', 'C'] as const) {
        const ending = scenario.endings[tier];
        expect(ending.tier).toBe(tier);
        expect(endingBelongsToScenario(scenario.id, ending.id)).toBe(true);
        expect(ending.title.length).toBeGreaterThan(0);
        expect(ending.defaultEpilogue.length).toBeGreaterThan(0);
        expect(allEndingIds.has(ending.id)).toBe(false);
        allEndingIds.add(ending.id);
      }
    }
    expect(allEndingIds.size).toBe(24);
  });

  it('switches player and opponent identities for every scenario', () => {
    for (const scenarioId of SCENARIO_IDS) {
      const male = createBriefing(scenarioId, 'male');
      const female = createBriefing(scenarioId, 'female');
      expect(male.character).toMatchObject({
        name: '黎岚',
        gender: 'female',
        role: '产品经理',
      });
      expect(female.character).toMatchObject({
        name: '周叙',
        gender: 'male',
        role: '程序员',
      });
      expect(male.maxRounds).toBe(
        getScenarioDefinition(scenarioId).maxRounds,
      );
    }
  });
});

describe('deterministic game engine', () => {
  it('applies model deltas, clamps state and keeps evaluation signals', () => {
    const state = {
      ...createInitialState(SESSION_ID, 'weekend-market'),
      metrics: {
        warmth: 98,
        pressure: 3,
        openness: 95,
      },
    };
    const applied = applyDirectorDecision(
      state,
      {
        ...neutralDecision,
        delta: {
          warmth: 16,
          pressure: -16,
          openness: 16,
        },
        discoveries: {
          ...neutralDecision.discoveries,
          understoodNeed: true,
        },
      },
      1,
    );

    expect(applied.state.metrics).toEqual({
      warmth: 100,
      pressure: 0,
      openness: 100,
    });
    expect(applied.state.flags.understoodNeed).toBe(true);
  });

  it('locks each scenario to its own S, A and C gates', () => {
    for (const scenarioId of SCENARIO_IDS) {
      const definition = getScenarioDefinition(scenarioId);
      const base = createInitialState(SESSION_ID, scenarioId);

      expect(
        selectEnding({
          ...base,
          round: definition.thresholds.sMinRound,
          metrics: {
            warmth: definition.thresholds.sWarmth,
            pressure: definition.thresholds.sPressure,
            openness: 70,
          },
          flags: {
            understoodNeed: true,
            proposedAction: true,
            respectedChoice: true,
            sincereCare: true,
          },
        }),
      ).toBe(definition.endings.S.id);

      expect(
        selectEnding({
          ...base,
          round: definition.thresholds.aMinRound,
          metrics: {
            warmth: definition.thresholds.aWarmth,
            pressure: definition.thresholds.aPressure,
            openness: 52,
          },
          flags: {
            understoodNeed: true,
            proposedAction: true,
            respectedChoice: false,
            sincereCare: false,
          },
        }),
      ).toBe(definition.endings.A.id);

      expect(
        selectEnding({
          ...base,
          round: definition.maxRounds,
        }),
      ).toBe(definition.endings.C.id);
    }
  });

  it('rejects an ending from a different scenario', () => {
    const state = createInitialState(SESSION_ID, 'weekend-market');
    expect(() =>
      GameStateSchema.parse({
        ...state,
        endingId: 'elevator-going-down',
      }),
    ).toThrow(/结局不属于当前关卡/);
  });
});

describe('mock three-agent sessions', () => {
  it('plays all eight scenarios through their authored S path', async () => {
    const service = new GameSessionService(
      new GameAgents(new MockAiProvider()),
      5,
    );
    const strongLine =
      '我知道你现在很难受，也在意你的真实需要。明天我们一起把具体安排定下来，你来选，也可以拒绝；我会陪你。';

    for (const scenarioId of SCENARIO_IDS) {
      let session = service.create(scenarioId, 'male');
      while (
        session.state.phase !== 'result' &&
        session.state.round < session.state.maxRounds
      ) {
        session = (
          await service.playTurn(session.state.sessionId, strongLine)
        ).session;
      }
      expect(session.state.endingId).toBe(
        getScenarioDefinition(scenarioId).endings.S.id,
      );
      expect(session.verdict?.tier).toBe('S');
      expect(session.verdict?.shareText).toContain('《关系修炼》');
    }
  });

  it('keeps sessions independent and accepts direct apologies', async () => {
    const service = new GameSessionService(
      new GameAgents(new MockAiProvider()),
      5,
    );
    const first = service.create('party-joke', 'female');
    const second = service.create('rain-check', 'male');
    const updated = (
      await service.playTurn(
        first.state.sessionId,
        '对不起，我想先听你把刚才的难受说完。',
      )
    ).session;

    expect(updated.state.round).toBe(1);
    expect(updated.briefing.character.name).toBe('周叙');
    expect(updated.transcript.at(-2)?.text).toContain('对不起');
    expect(second.state.round).toBe(0);
    expect(second.transcript).toHaveLength(1);
  });
});
