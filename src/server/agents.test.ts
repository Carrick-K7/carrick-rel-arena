import { describe, expect, it } from 'vitest';
import type {
  ActorPerformance,
  DirectorDecision,
  TranscriptEntry,
} from '../shared/contracts.js';
import { GameAgents } from './agents.js';
import { createInitialState } from './engine.js';
import {
  createActorSystemPrompt,
  DIRECTOR_SYSTEM_PROMPT,
} from './prompts.js';
import type {
  AiProvider,
  StructuredCompletionRequest,
} from './providers/types.js';
import { createBriefing } from './scenario.js';

const SESSION_ID = '7401c52f-e7f6-4cd6-a4f4-934dc783cf1f';

const decision: DirectorDecision = {
  assessment: '中立承接本轮回应。',
  delta: { warmth: 2, pressure: -1, openness: 1 },
  discoveries: {
    understoodNeed: false,
    proposedAction: true,
    respectedChoice: false,
    sincereCare: false,
  },
  event: null,
  actorBrief: '承认已经说清的安排，只询问仍缺失的一项信息。',
  shouldEnd: false,
  suggestedEndReason: null,
};

const performance: ActorPerformance = {
  line: '九点和楼下我听见了，返程方式我们再一起定一下。',
  emotion: 'softening',
  tone: 'quiet',
  expression: {
    brows: 'soft',
    eyes: 'direct',
    mouth: 'parted',
  },
  action: {
    pose: 'seated',
    gesture: 'nods',
    stageDirection: '她点点头，把已经确认的安排记在手机上。',
  },
  stateChanges: decision.delta,
};

class RecordingProvider implements AiProvider {
  readonly kind = 'mock' as const;
  readonly model = 'recording-provider';
  readonly requests: StructuredCompletionRequest<unknown>[] = [];

  async generate<T>(request: StructuredCompletionRequest<T>) {
    this.requests.push(
      request as unknown as StructuredCompletionRequest<unknown>,
    );
    const raw = request.agent === 'director' ? decision : performance;
    const data = request.schema.parse(raw);
    return {
      data,
      usage: {
        provider: this.kind,
        model: this.model,
        agent: request.agent,
        sessionId: request.context.state.sessionId,
        occurredAt: '2026-07-19T12:00:00.000Z',
        success: true,
        attempts: 1,
        measured: false,
        latencyMs: 0,
        inputTokens: 0,
        cachedInputTokens: 0,
        cacheWriteTokens: 0,
        outputTokens: 0,
        reasoningTokens: 0,
        totalTokens: 0,
        errorCode: null,
      },
    };
  }
}

function createTranscript(): TranscriptEntry[] {
  const transcript: TranscriptEntry[] = [
    {
      id: 'opening',
      speaker: 'character',
      text: '开场台词',
      round: 0,
      emotion: 'guarded',
      tone: 'quiet',
      createdAt: '2026-07-19T12:00:00.000Z',
    },
  ];
  for (let round = 1; round <= 4; round += 1) {
    transcript.push(
      {
        id: `player-${round}`,
        speaker: 'player',
        text: `玩家第 ${round} 轮台词`,
        round,
        emotion: null,
        tone: null,
        createdAt: `2026-07-19T12:0${round}:00.000Z`,
      },
      {
        id: `character-${round}`,
        speaker: 'character',
        text: `角色第 ${round} 轮台词`,
        round,
        emotion: 'guarded',
        tone: 'quiet',
        createdAt: `2026-07-19T12:0${round}:30.000Z`,
      },
    );
  }
  return transcript;
}

describe('agent conversation continuity', () => {
  it('sends the complete current-session transcript to director and actor', async () => {
    const provider = new RecordingProvider();
    const agents = new GameAgents(provider);
    const briefing = createBriefing('weekend-market', 'male');
    const state = createInitialState(
      SESSION_ID,
      'weekend-market',
      'male',
    );
    const transcript = createTranscript();

    await agents.direct({
      briefing,
      state,
      transcript,
      playerLine: '最后一轮玩家台词',
      round: 5,
      roundsLeftAfterThis: 0,
    });
    await agents.act({
      briefing,
      state,
      transcript,
      playerLine: '最后一轮玩家台词',
      director: decision,
      activeEvent: null,
    });

    expect(provider.requests).toHaveLength(2);
    for (const request of provider.requests) {
      expect(request.input.transcript).toEqual(transcript);
      expect(request.input).not.toHaveProperty('recentTranscript');
    }
  });

  it('requires neutral acknowledgement instead of manufactured resistance', () => {
    const actorPrompt = createActorSystemPrompt(
      createBriefing('weekend-market', 'male'),
    );

    expect(DIRECTOR_SYSTEM_PROMPT).toContain(
      '不得为了制造挑战、延长回合或维持冲突而增加阻力',
    );
    expect(DIRECTOR_SYSTEM_PROMPT).toContain(
      '只评价台词中可观察的内容和影响',
    );
    expect(DIRECTOR_SYSTEM_PROMPT).toContain(
      '不得仅因不够完美就降低关系温度或提高压力',
    );
    expect(actorPrompt).toContain('先准确承接玩家刚刚说出的具体内容');
    expect(actorPrompt).toContain('玩家已经回答的问题不得重复追问');
    expect(actorPrompt).toContain('不得为了保持挑战性而故意抵抗');
    expect(actorPrompt).not.toContain('检验诚意');
    expect(actorPrompt).not.toContain('保留符合当前压力的抵抗感');
  });
});
