import type { z } from 'zod';
import type {
  DirectorDecision,
  EndingId,
  EndingTier,
  GameState,
  StoryEvent,
  TranscriptEntry,
} from '../../shared/contracts.js';

export type AgentName = 'director' | 'actor' | 'judge';
export type ProviderKind = 'mock' | 'openai' | 'deepseek';

export interface DirectorContext {
  state: GameState;
  transcript: TranscriptEntry[];
  playerLine: string;
  round: number;
  roundsLeftAfterThis: number;
}

export interface ActorContext {
  state: GameState;
  transcript: TranscriptEntry[];
  playerLine: string;
  director: DirectorDecision;
  activeEvent: StoryEvent | null;
}

export interface JudgeContext {
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

export interface AiProvider {
  readonly kind: ProviderKind;
  generate<T>(request: StructuredCompletionRequest<T>): Promise<T>;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly provider: ProviderKind,
    public readonly retryable = true,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}
