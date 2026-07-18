import { randomUUID } from 'node:crypto';
import {
  ActorPerformanceSchema,
  GameStateSchema,
  PublicSessionSchema,
  TranscriptEntrySchema,
  type ActorPerformance,
  type Gender,
  type GameState,
  type JudgeVerdict,
  type PublicSession,
  type ScenarioId,
  type SessionUsage,
  type TranscriptEntry,
} from '../shared/contracts.js';
import { GameAgents } from './agents.js';
import {
  applyDirectorDecision,
  createInitialState,
  lockVerdict,
  selectEnding,
} from './engine.js';
import {
  createBriefing,
  createEndingVideoEvent,
  createOpeningEvent,
  createOpeningPerformance,
  createTurningPointEvent,
  getEndingDefinition,
  getScenarioDefinition,
} from './scenario.js';
import type { UsageTracker } from './usage.js';

interface StoredSession {
  briefing: PublicSession['briefing'];
  state: GameState;
  transcript: TranscriptEntry[];
  lastPerformance: ActorPerformance;
  verdict: JudgeVerdict | null;
  expiresAt: Date;
  locked: boolean;
}

export class SessionError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'SessionError';
  }
}

export class GameSessionService {
  private readonly sessions = new Map<string, StoredSession>();
  private readonly ttlMs: number;

  constructor(
    private readonly agents: GameAgents,
    ttlMinutes = 120,
    private readonly usageTracker: UsageTracker | null = null,
  ) {
    this.ttlMs = Math.max(5, ttlMinutes) * 60_000;
    const timer = setInterval(() => this.deleteExpired(), 60_000);
    timer.unref();
  }

  get providerKind() {
    return this.agents.providerKind;
  }

  create(
    scenarioId: ScenarioId = 'suitcase-at-one',
    playerGender: Gender = 'male',
  ): PublicSession {
    const sessionId = randomUUID();
    const now = new Date();
    const briefing = createBriefing(scenarioId, playerGender);
    const openingPerformance = createOpeningPerformance(briefing);
    const opening = TranscriptEntrySchema.parse({
      id: randomUUID(),
      speaker: 'character',
      text: openingPerformance.line,
      round: 0,
      emotion: openingPerformance.emotion,
      tone: openingPerformance.tone,
      createdAt: now.toISOString(),
    });
    const state = GameStateSchema.parse({
      ...createInitialState(sessionId, scenarioId, playerGender),
      activeEvent: createOpeningEvent(briefing),
    });
    const stored: StoredSession = {
      briefing,
      state,
      transcript: [opening],
      lastPerformance: openingPerformance,
      verdict: null,
      expiresAt: new Date(now.getTime() + this.ttlMs),
      locked: false,
    };
    this.sessions.set(sessionId, stored);
    return this.toPublic(stored);
  }

  get(sessionId: string): PublicSession {
    const stored = this.getStored(sessionId);
    return this.toPublic(stored);
  }

  async playTurn(
    sessionId: string,
    playerLine: string,
  ): Promise<{ session: PublicSession; directorSummary: string }> {
    const stored = this.getStored(sessionId);
    if (stored.state.phase === 'result') {
      throw new SessionError('本局已经结算，请开始新挑战。', 409, 'GAME_OVER');
    }
    if (stored.locked) {
      throw new SessionError(
        `${stored.briefing.character.name}还在消化上一句话。`,
        409,
        'TURN_IN_PROGRESS',
      );
    }

    stored.locked = true;
    const round = stored.state.round + 1;

    try {
      const playerEntry = TranscriptEntrySchema.parse({
        id: randomUUID(),
        speaker: 'player',
        text: playerLine,
        round,
        emotion: null,
        tone: null,
        createdAt: new Date().toISOString(),
      });
      const workingTranscript = [...stored.transcript, playerEntry];

      const proposedDecision = await this.agents.direct({
        briefing: stored.briefing,
        state: {
          ...stored.state,
          phase: 'directing',
        },
        transcript: stored.transcript,
        playerLine,
        round,
        roundsLeftAfterThis: stored.state.maxRounds - round,
      });
      const definition = getScenarioDefinition(stored.briefing.id);
      const rawDecision = {
        ...proposedDecision,
        event:
          round === definition.turning.round
            ? createTurningPointEvent(
                round,
                stored.state.sessionId.slice(0, 8),
                stored.briefing,
              )
            : null,
      };

      const applied = applyDirectorDecision(
        stored.state,
        rawDecision,
        round,
      );
      const performance = ActorPerformanceSchema.parse({
        ...(await this.agents.act({
          briefing: stored.briefing,
          state: applied.state,
          transcript: workingTranscript,
          playerLine,
          director: applied.decision,
          activeEvent: applied.state.activeEvent,
        })),
        stateChanges: applied.decision.delta,
      });

      const actorEntry = TranscriptEntrySchema.parse({
        id: randomUUID(),
        speaker: 'character',
        text: performance.line,
        round,
        emotion: performance.emotion,
        tone: performance.tone,
        createdAt: new Date().toISOString(),
      });
      workingTranscript.push(actorEntry);

      const endingId = selectEnding(applied.state);
      let nextState: GameState;
      let verdict: JudgeVerdict | null = null;

      if (endingId) {
        const ending = getEndingDefinition(
          applied.state.scenarioId,
          endingId,
        );
        nextState = GameStateSchema.parse({
          ...applied.state,
          phase: 'judging',
          endingId,
          activeEvent: createEndingVideoEvent(
            ending,
            applied.state.sessionId,
            stored.briefing,
          ),
        });
        const rawVerdict = await this.agents.judge({
          briefing: stored.briefing,
          state: nextState,
          transcript: workingTranscript,
          lockedEnding: {
            endingId,
            tier: ending.tier,
            title: ending.title,
            defaultEpilogue:
              nextState.activeEvent?.description ??
              ending.defaultEpilogue,
          },
        });
        verdict = lockVerdict(
          rawVerdict,
          applied.state.scenarioId,
          endingId,
        );
        nextState = GameStateSchema.parse({
          ...nextState,
          phase: 'result',
        });
      } else {
        nextState = GameStateSchema.parse({
          ...applied.state,
          phase: 'awaiting_player',
        });
      }

      stored.state = nextState;
      stored.transcript = workingTranscript;
      stored.lastPerformance = performance;
      stored.verdict = verdict;
      stored.expiresAt = new Date(Date.now() + this.ttlMs);

      return {
        session: this.toPublic(stored),
        directorSummary: applied.decision.assessment,
      };
    } finally {
      stored.locked = false;
    }
  }

  private getStored(sessionId: string): StoredSession {
    const stored = this.sessions.get(sessionId);
    if (!stored) {
      throw new SessionError('会话不存在或已过期。', 404, 'SESSION_NOT_FOUND');
    }
    if (stored.expiresAt.getTime() <= Date.now()) {
      this.sessions.delete(sessionId);
      throw new SessionError('会话已经过期。', 410, 'SESSION_EXPIRED');
    }
    return stored;
  }

  private toPublic(stored: StoredSession): PublicSession {
    return PublicSessionSchema.parse({
      briefing: stored.briefing,
      state: stored.state,
      transcript: stored.transcript,
      lastPerformance: stored.lastPerformance,
      verdict: stored.verdict,
      usage:
        this.usageTracker?.getSessionSummary(
          stored.state.sessionId,
          this.agents.providerKind,
          this.agents.providerModel,
        ) ??
        emptyUsage(
          this.agents.providerKind,
          this.agents.providerModel,
        ),
      expiresAt: stored.expiresAt.toISOString(),
    });
  }

  private deleteExpired() {
    const now = Date.now();
    for (const [sessionId, session] of this.sessions) {
      if (session.expiresAt.getTime() <= now) {
        this.sessions.delete(sessionId);
      }
    }
  }
}

function emptyUsage(
  provider: SessionUsage['provider'],
  model: string,
): SessionUsage {
  return {
    provider,
    model,
    calls: 0,
    successfulCalls: 0,
    failedCalls: 0,
    inputTokens: 0,
    cachedInputTokens: 0,
    cacheWriteTokens: 0,
    outputTokens: 0,
    reasoningTokens: 0,
    totalTokens: 0,
    estimatedCostUsd: provider === 'mock' ? 0 : null,
    tokenMeasurement: 'none',
    ttsRequests: 0,
    ttsCharacters: 0,
    alertCount: 0,
  };
}
