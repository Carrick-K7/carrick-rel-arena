import { describe, expect, it } from 'vitest';
import type { DirectorDecision } from '../shared/contracts.js';
import { GameAgents } from './agents.js';
import {
  applyDirectorDecision,
  createInitialState,
  selectEnding,
} from './engine.js';
import { MockAiProvider } from './providers/mock.js';
import { containsForbiddenPhrase } from './scenario.js';
import { GameSessionService } from './sessions.js';

const neutralDecision: DirectorDecision = {
  assessment: '测试判定',
  delta: {
    trust: 0,
    anger: 0,
    vulnerability: 0,
    hiddenProgress: 0,
  },
  discoveries: {
    namedSpecificHurt: false,
    ownedChoice: false,
    concretePlan: false,
    relationshipChosen: false,
  },
  restrictionHit: false,
  event: null,
  actorBrief: '保持戒备。',
  shouldEnd: false,
  suggestedEndReason: null,
};

describe('deterministic game engine', () => {
  it('detects normalized forbidden apology phrases', () => {
    expect(containsForbiddenPhrase('对 不 起，我来晚了')).toBe(true);
    expect(containsForbiddenPhrase('SORRY，今晚是我失约')).toBe(true);
    expect(containsForbiddenPhrase('我看见你在饭桌上的难堪')).toBe(false);
  });

  it('applies a deterministic penalty when the model misses a restriction', () => {
    const state = createInitialState('7401c52f-e7f6-4cd6-a4f4-934dc783cf1f');
    const applied = applyDirectorDecision(
      state,
      neutralDecision,
      '对不起',
      1,
    );

    expect(applied.decision.restrictionHit).toBe(true);
    expect(applied.state.flags.forbiddenPhraseCount).toBe(1);
    expect(applied.state.metrics.trust).toBeLessThan(state.metrics.trust);
    expect(applied.state.metrics.anger).toBeGreaterThan(state.metrics.anger);
    expect(applied.state.activeEvent?.id).toBe('forbidden-phrase-1');
  });

  it('locks the four ending gates from canonical state', () => {
    const base = createInitialState('7401c52f-e7f6-4cd6-a4f4-934dc783cf1f');

    expect(
      selectEnding({
        ...base,
        round: 4,
        metrics: {
          trust: 80,
          anger: 20,
          vulnerability: 70,
          hiddenProgress: 3,
        },
        flags: {
          forbiddenPhraseCount: 0,
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
          hiddenProgress: 2,
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
        round: 2,
        flags: {
          ...base.flags,
          forbiddenPhraseCount: 2,
        },
      }),
    ).toBe('apology-allergen');

    expect(
      selectEnding({
        ...base,
        round: 7,
      }),
    ).toBe('elevator-going-down');
  });
});

describe('mock three-agent session', () => {
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

  it('turns repeated forbidden phrases into the special failure', async () => {
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
    session = (
      await service.playTurn(
        session.state.sessionId,
        '抱歉，我只能再说一次。',
      )
    ).session;

    expect(session.state.endingId).toBe('apology-allergen');
    expect(session.verdict?.title).toBe('禁词连招大师');
  });
});
