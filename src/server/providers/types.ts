import type { z } from 'zod';
import type {
  DirectorDecision,
  EndingId,
  EndingTier,
  GameState,
  ScenarioBriefing,
  StoryEvent,
  TranscriptEntry,
} from '../../shared/contracts.js';

export type AgentName = 'director' | 'actor' | 'judge';
export type ProviderKind = 'mock' | 'openai' | 'deepseek';

export interface DirectorContext {
  briefing: ScenarioBriefing;
  state: GameState;
  transcript: TranscriptEntry[];
  playerLine: string;
  round: number;
  roundsLeftAfterThis: number;
}

export interface ActorContext {
  briefing: ScenarioBriefing;
  state: GameState;
  transcript: TranscriptEntry[];
  playerLine: string;
  director: DirectorDecision;
  activeEvent: StoryEvent | null;
}

export interface JudgeContext {
  briefing: ScenarioBriefing;
  state: GameState;
  transcript: TranscriptEntry[];
  lockedEnding: {
    endingId: EndingId;
    tier: EndingTier;
    title: string;
    defaultEpilogue: string;
  };
}

export interface StructuredCompletionRequest<T> {
  agent: AgentName;
  schemaName: string;
  schema: z.ZodType<T>;
  system: string;
  input: Record<string, unknown>;
  context: DirectorContext | ActorContext | JudgeContext;
  maxOutputTokens: number;
}

export interface ModelUsage {
  provider: ProviderKind;
  model: string;
  agent: AgentName;
  sessionId: string;
  occurredAt: string;
  success: boolean;
  attempts: number;
  measured: boolean;
  latencyMs: number;
  inputTokens: number;
  cachedInputTokens: number;
  cacheWriteTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  totalTokens: number;
  errorCode: string | null;
}

export interface StructuredCompletionResult<T> {
  data: T;
  usage: ModelUsage;
}

export interface AiProvider {
  readonly kind: ProviderKind;
  readonly model: string;
  generate<T>(
    request: StructuredCompletionRequest<T>,
  ): Promise<StructuredCompletionResult<T>>;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly provider: ProviderKind,
    public readonly retryable = true,
    public readonly usage: ModelUsage | null = null,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}
