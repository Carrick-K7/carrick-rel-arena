import {
  ActorPerformanceSchema,
  DirectorDecisionSchema,
  JudgeVerdictSchema,
  type ActorPerformance,
  type DirectorDecision,
  type JudgeVerdict,
} from '../shared/contracts.js';
import {
  ACTOR_SYSTEM_PROMPT,
  DIRECTOR_SYSTEM_PROMPT,
  JUDGE_SYSTEM_PROMPT,
} from './prompts.js';
import { SCENARIO_FACTS } from './scenario.js';
import type {
  ActorContext,
  AiProvider,
  DirectorContext,
  JudgeContext,
} from './providers/types.js';

export class GameAgents {
  constructor(private readonly provider: AiProvider) {}

  get providerKind() {
    return this.provider.kind;
  }

  direct(context: DirectorContext): Promise<DirectorDecision> {
    return this.provider.generate({
      agent: 'director',
      schemaName: 'director_decision',
      schema: DirectorDecisionSchema,
      system: DIRECTOR_SYSTEM_PROMPT,
      input: {
        scenarioFacts: SCENARIO_FACTS,
        currentState: context.state,
        recentTranscript: context.transcript.slice(-6),
        playerLine: context.playerLine,
        round: context.round,
        roundsLeftAfterThis: context.roundsLeftAfterThis,
      },
      context,
      maxOutputTokens: 500,
    });
  }

  act(context: ActorContext): Promise<ActorPerformance> {
    return this.provider.generate({
      agent: 'actor',
      schemaName: 'actor_performance',
      schema: ActorPerformanceSchema,
      system: ACTOR_SYSTEM_PROMPT,
      input: {
        directorBrief: context.director.actorBrief,
        stateAfterDirector: context.state,
        latestPlayerLine: context.playerLine,
        recentTranscript: context.transcript.slice(-6),
        activeEvent: context.activeEvent,
        appliedStateChanges: context.director.delta,
      },
      context,
      maxOutputTokens: 500,
    });
  }

  judge(context: JudgeContext): Promise<JudgeVerdict> {
    return this.provider.generate({
      agent: 'judge',
      schemaName: 'judge_verdict',
      schema: JudgeVerdictSchema,
      system: JUDGE_SYSTEM_PROMPT,
      input: {
        lockedEnding: context.lockedEnding,
        finalState: context.state,
        goals: {
          public: '让黎岚愿意留下吃明早的早餐',
          hidden:
            '准确看见她在家人面前被晾下的难堪，并提出可验证的共同修复行动',
          restriction: '全局禁用直接道歉表达',
        },
        transcript: context.transcript,
      },
      context,
      maxOutputTokens: 1000,
    });
  }
}
