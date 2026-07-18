import { z } from 'zod';

export const GamePhaseSchema = z.enum([
  'briefing',
  'awaiting_player',
  'directing',
  'acting',
  'judging',
  'result',
]);

export const EmotionSchema = z.enum([
  'guarded',
  'angry',
  'hurt',
  'testing',
  'softening',
  'warm',
  'done',
]);

export const ToneSchema = z.enum([
  'icy',
  'sharp',
  'quiet',
  'shaky',
  'dry',
  'soft',
]);

export const EndingIdSchema = z.enum([
  'breakfast-stays-warm',
  'suitcase-by-the-door',
  'elevator-going-down',
  'apology-allergen',
]);

export const EndingTierSchema = z.enum(['S', 'A', 'C', 'F']);

export const EndReasonSchema = z.enum([
  'breakthrough',
  'provisional_truce',
  'relationship_break',
  'round_limit',
  'restriction_collapse',
]);

export const MetricDeltaSchema = z.strictObject({
  trust: z.number().int().min(-18).max(16),
  anger: z.number().int().min(-16).max(22),
  vulnerability: z.number().int().min(-12).max(16),
  hiddenProgress: z.number().int().min(0).max(1),
});

export const StateDiscoveriesSchema = z.strictObject({
  namedSpecificHurt: z.boolean(),
  ownedChoice: z.boolean(),
  concretePlan: z.boolean(),
  relationshipChosen: z.boolean(),
});

export const VideoHookSchema = z.strictObject({
  hookId: z.string().min(1).max(80),
  kind: z.enum(['opening', 'turning_point', 'ending']),
  prompt: z.string().min(1).max(600),
  idempotencyKey: z.string().min(1).max(120),
  status: z.literal('reserved'),
});

export const StoryEventSchema = z.strictObject({
  id: z.string().min(1).max(80),
  title: z.string().min(1).max(40),
  description: z.string().min(1).max(180),
  videoCue: VideoHookSchema.nullable(),
});

export const DirectorDecisionSchema = z.strictObject({
  assessment: z.string().min(1).max(240),
  delta: MetricDeltaSchema,
  discoveries: StateDiscoveriesSchema,
  restrictionHit: z.boolean(),
  event: StoryEventSchema.nullable(),
  actorBrief: z.string().min(1).max(400),
  shouldEnd: z.boolean(),
  suggestedEndReason: EndReasonSchema.nullable(),
});

export const ActorPerformanceSchema = z.strictObject({
  line: z.string().min(1).max(160),
  emotion: EmotionSchema,
  tone: ToneSchema,
  expression: z.strictObject({
    brows: z.enum(['flat', 'furrowed', 'raised', 'soft']),
    eyes: z.enum(['direct', 'averted', 'narrowed', 'wet', 'soft']),
    mouth: z.enum(['line', 'smirk', 'downturned', 'parted', 'small-smile']),
  }),
  action: z.strictObject({
    pose: z.enum([
      'arms-crossed',
      'holding-handle',
      'turned-away',
      'leaning',
      'relaxed',
    ]),
    gesture: z.enum([
      'none',
      'points-door',
      'checks-phone',
      'releases-handle',
      'wipes-eye',
    ]),
    stageDirection: z.string().min(1).max(180),
  }),
  stateChanges: MetricDeltaSchema,
});

export const TranscriptEntrySchema = z.strictObject({
  id: z.string().min(1),
  speaker: z.enum(['player', 'character']),
  text: z.string().min(1).max(280),
  round: z.number().int().min(0).max(8),
  emotion: EmotionSchema.nullable(),
  tone: ToneSchema.nullable(),
  createdAt: z.string().datetime(),
});

export const GameStateSchema = z.strictObject({
  sessionId: z.string().uuid(),
  scenarioId: z.literal('suitcase-at-one'),
  phase: GamePhaseSchema,
  round: z.number().int().min(0).max(7),
  maxRounds: z.literal(7),
  metrics: z.strictObject({
    trust: z.number().int().min(0).max(100),
    anger: z.number().int().min(0).max(100),
    vulnerability: z.number().int().min(0).max(100),
    hiddenProgress: z.number().int().min(0).max(3),
  }),
  flags: z.strictObject({
    forbiddenPhraseCount: z.number().int().min(0).max(7),
    namedSpecificHurt: z.boolean(),
    ownedChoice: z.boolean(),
    concretePlan: z.boolean(),
    relationshipChosen: z.boolean(),
  }),
  activeEvent: StoryEventSchema.nullable(),
  endingId: EndingIdSchema.nullable(),
});

export const GoalResultSchema = z.strictObject({
  label: z.string().min(1).max(80),
  met: z.boolean(),
  detail: z.string().min(1).max(180),
});

export const JudgeVerdictSchema = z.strictObject({
  endingId: EndingIdSchema,
  tier: EndingTierSchema,
  score: z.number().int().min(0).max(100),
  title: z.string().min(2).max(20),
  roast: z.string().min(1).max(180),
  epilogue: z.string().min(1).max(360),
  goals: z.strictObject({
    publicGoal: GoalResultSchema,
    hiddenGoal: GoalResultSchema,
    restriction: GoalResultSchema,
  }),
  keyMoments: z.array(
    z.strictObject({
      round: z.number().int().min(1).max(7),
      quote: z.string().min(1).max(120),
      analysis: z.string().min(1).max(220),
      impact: z.enum(['turned', 'helped', 'hurt']),
    }),
  ).min(1).max(4),
  shareText: z.string().min(1).max(180),
});

export const ScenarioBriefingSchema = z.strictObject({
  id: z.literal('suitcase-at-one'),
  title: z.string(),
  subtitle: z.string(),
  timeAndPlace: z.string(),
  premise: z.string(),
  playerRole: z.string(),
  character: z.strictObject({
    name: z.string(),
    age: z.number().int(),
    role: z.string(),
    personality: z.string(),
  }),
  publicGoal: z.string(),
  hiddenGoalTeaser: z.string(),
  restriction: z.string(),
  maxRounds: z.literal(7),
});

export const SessionUsageSchema = z.strictObject({
  provider: z.enum(['mock', 'openai', 'deepseek']),
  model: z.string().min(1),
  calls: z.number().int().min(0),
  successfulCalls: z.number().int().min(0),
  failedCalls: z.number().int().min(0),
  inputTokens: z.number().int().min(0),
  cachedInputTokens: z.number().int().min(0),
  cacheWriteTokens: z.number().int().min(0),
  outputTokens: z.number().int().min(0),
  reasoningTokens: z.number().int().min(0),
  totalTokens: z.number().int().min(0),
  estimatedCostUsd: z.number().min(0).nullable(),
  tokenMeasurement: z.enum([
    'none',
    'estimated',
    'provider_reported',
  ]),
  ttsRequests: z.number().int().min(0),
  ttsCharacters: z.number().int().min(0),
  alertCount: z.number().int().min(0),
});

export const PublicSessionSchema = z.strictObject({
  briefing: ScenarioBriefingSchema,
  state: GameStateSchema,
  transcript: z.array(TranscriptEntrySchema),
  lastPerformance: ActorPerformanceSchema,
  verdict: JudgeVerdictSchema.nullable(),
  usage: SessionUsageSchema,
  expiresAt: z.string().datetime(),
});

export const CreateSessionResponseSchema = z.strictObject({
  session: PublicSessionSchema,
});

export const TurnInputSchema = z.strictObject({
  text: z.string().trim().min(1).max(240),
});

export const TurnResponseSchema = z.strictObject({
  session: PublicSessionSchema,
  directorSummary: z.string().min(1).max(240),
});

export const CapabilitiesSchema = z.strictObject({
  textProvider: z.enum(['mock', 'openai', 'deepseek']),
  remoteText: z.boolean(),
  serverTts: z.boolean(),
  ttsProvider: z.enum(['mimo', 'openai', 'browser']),
  videoHooks: z.literal('reserved'),
  sessionStorage: z.literal('memory-ttl'),
  usageTracking: z.literal('enabled'),
  usageAlerting: z.boolean(),
});

export type GamePhase = z.infer<typeof GamePhaseSchema>;
export type Emotion = z.infer<typeof EmotionSchema>;
export type Tone = z.infer<typeof ToneSchema>;
export type EndingId = z.infer<typeof EndingIdSchema>;
export type EndingTier = z.infer<typeof EndingTierSchema>;
export type EndReason = z.infer<typeof EndReasonSchema>;
export type MetricDelta = z.infer<typeof MetricDeltaSchema>;
export type StateDiscoveries = z.infer<typeof StateDiscoveriesSchema>;
export type VideoHook = z.infer<typeof VideoHookSchema>;
export type StoryEvent = z.infer<typeof StoryEventSchema>;
export type DirectorDecision = z.infer<typeof DirectorDecisionSchema>;
export type ActorPerformance = z.infer<typeof ActorPerformanceSchema>;
export type TranscriptEntry = z.infer<typeof TranscriptEntrySchema>;
export type GameState = z.infer<typeof GameStateSchema>;
export type JudgeVerdict = z.infer<typeof JudgeVerdictSchema>;
export type ScenarioBriefing = z.infer<typeof ScenarioBriefingSchema>;
export type SessionUsage = z.infer<typeof SessionUsageSchema>;
export type PublicSession = z.infer<typeof PublicSessionSchema>;
export type Capabilities = z.infer<typeof CapabilitiesSchema>;
