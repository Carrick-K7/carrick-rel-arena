import {
  ActorPerformanceSchema,
  DirectorDecisionSchema,
  JudgeVerdictSchema,
  type ActorPerformance,
  type DirectorDecision,
  type JudgeVerdict,
} from '../shared/contracts.js';
import {
  createActorSystemPrompt,
  DIRECTOR_SYSTEM_PROMPT,
  JUDGE_SYSTEM_PROMPT,
} from './prompts.js';
import { createScenarioFacts } from './scenario.js';
import type {
  ActorContext,
  AiProvider,
  DirectorContext,
  JudgeContext,
  ModelUsage,
  StructuredCompletionRequest,
} from './providers/types.js';
import { ProviderError } from './providers/types.js';

export class GameAgents {
  constructor(
    private readonly provider: AiProvider,
    private readonly recordUsage: (usage: ModelUsage) => void = () =>
      undefined,
  ) {}

  get providerKind() {
    return this.provider.kind;
  }

  get providerModel() {
    return this.provider.model;
  }

  direct(context: DirectorContext): Promise<DirectorDecision> {
    return this.generate({
      agent: 'director',
      schemaName: 'director_decision',
      schema: DirectorDecisionSchema,
      system: DIRECTOR_SYSTEM_PROMPT,
      input: {
        scenarioFacts: createScenarioFacts(context.briefing),
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
    return this.generate({
      agent: 'actor',
      schemaName: 'actor_performance',
      schema: ActorPerformanceSchema,
      system: createActorSystemPrompt(context.briefing.character),
      input: {
        character: context.briefing.character,
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
    return this.generate({
      agent: 'judge',
      schemaName: 'judge_verdict',
      schema: JudgeVerdictSchema,
      system: JUDGE_SYSTEM_PROMPT,
      input: {
        lockedEnding: context.lockedEnding,
        finalState: context.state,
        goals: {
          public: context.briefing.publicGoal,
          hidden:
            '准确看见对方在家人面前被晾下的难堪，并提出可验证的共同修复行动',
          restriction: '全局禁用直接道歉表达',
        },
        transcript: context.transcript,
      },
      context,
      maxOutputTokens: 1000,
    });
  }

  private async generate<T>(
    request: StructuredCompletionRequest<T>,
  ): Promise<T> {
    try {
      const result = await this.provider.generate(request);
      this.recordUsage(result.usage);
      return result.data;
    } catch (error) {
      if (error instanceof ProviderError && error.usage) {
        this.recordUsage(error.usage);
      }
      throw error;
    }
  }
}
