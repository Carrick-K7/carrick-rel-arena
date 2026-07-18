import { describe, expect, it } from 'vitest';
import type { DirectorDecision } from '../shared/contracts.js';
import { GameAgents } from './agents.js';
import {
  applyDirectorDecision,
  createInitialState,
  selectEnding,
} from './engine.js';
import { MockAiProvider } from './providers/mock.js';
import { GameSessionService } from './sessions.js';

const neutralDecision: DirectorDecision = {
  assessment: '测试判定',
  delta: {
    trust: 0,
    anger: 0,
    vulnerability: 0,
  },
  discoveries: {
    namedSpecificHurt: false,
    ownedChoice: false,
    concretePlan: false,
    relationshipChosen: false,
  },
  event: null,
  actorBrief: '保持戒备。',
  shouldEnd: false,
  suggestedEndReason: null,
};

describe('deterministic game engine', () => {
  it('applies model deltas and keeps discovered relationship facts', () => {
    const state = createInitialState('7401c52f-e7f6-4cd6-a4f4-934dc783cf1f');
    const applied = applyDirectorDecision(
      state,
      {
        ...neutralDecision,
        delta: {
          trust: 8,
          anger: -6,
          vulnerability: 4,
        },
        discoveries: {
          ...neutralDecision.discoveries,
          namedSpecificHurt: true,
        },
      },
      1,
    );

    expect(applied.state.metrics).toEqual({
      trust: 40,
      anger: 70,
      vulnerability: 42,
    });
    expect(applied.state.flags.namedSpecificHurt).toBe(true);
  });

  it('locks the three ending gates from canonical state', () => {
    const base = createInitialState('7401c52f-e7f6-4cd6-a4f4-934dc783cf1f');

    expect(
      selectEnding({
        ...base,
        round: 4,
        metrics: {
          trust: 80,
          anger: 40,
          vulnerability: 70,
        },
        flags: {
          namedSpecificHurt: true,
          ownedChoice: true,
          concretePlan: true,
          relationshipChosen: true,
        },
      }),
    ).toBe('breakfast-stays-warm');

    expect(
      selectEnding({
        ...base,
        round: 5,
        metrics: {
          trust: 60,
          anger: 45,
          vulnerability: 50,
        },
        flags: {
          ...base.flags,
          concretePlan: true,
        },
      }),
    ).toBe('suitcase-by-the-door');

    expect(
      selectEnding({
        ...base,
        round: 7,
      }),
    ).toBe('elevator-going-down');
  });

});

describe('mock three-agent session', () => {
  it('creates the opposite-gender opponent with the selected player role', () => {
    const service = new GameSessionService(
      new GameAgents(new MockAiProvider()),
      5,
    );
    const session = service.create('female');
    const malePlayerSession = service.create('male');

    expect(session.state.playerGender).toBe('female');
    expect(session.state.opponentGender).toBe('male');
    expect(session.briefing.player).toEqual({
      gender: 'female',
      age: 25,
      role: '产品经理',
      experienceYears: 3,
    });
    expect(session.briefing.character).toMatchObject({
      name: '周叙',
      gender: 'male',
      age: 25,
      role: '程序员',
      experienceYears: 3,
    });
    expect(malePlayerSession.briefing.player.role).toBe('程序员');
    expect(malePlayerSession.briefing.character).toMatchObject({
      name: '黎岚',
      gender: 'female',
      role: '产品经理',
      personality: expect.stringContaining('可爱'),
    });
  });

  it('plays a full high-quality path and produces an S verdict', async () => {
    const service = new GameSessionService(
      new GameAgents(new MockAiProvider()),
      5,
    );
    let session = service.create();
    const line =
      '我把你一个人晾在妈妈的生日饭桌上，是我选择逃开。明天十点我们一起去见她，我来订位置，这段关系对我很重要，我选择站在你身边。';

    for (let index = 0; index < 4; index += 1) {
      const result = await service.playTurn(session.state.sessionId, line);
      session = result.session;
    }

    expect(session.state.phase).toBe('result');
    expect(session.state.endingId).toBe('breakfast-stays-warm');
    expect(session.verdict?.tier).toBe('S');
    expect(session.verdict?.keyMoments.length).toBeGreaterThan(0);
  });

  it('accepts direct apologies as ordinary free-form dialogue', async () => {
    const service = new GameSessionService(
      new GameAgents(new MockAiProvider()),
      5,
    );
    let session = service.create();

    session = (
      await service.playTurn(
        session.state.sessionId,
        '对不起，我真的没想这样。',
      )
    ).session;
    expect(session.state.round).toBe(1);
    expect(session.state.phase).toBe('awaiting_player');
    expect(session.state.endingId).toBeNull();
    expect(session.transcript.at(-2)?.text).toContain('对不起');
  });
});
