import { z } from 'zod';

export const SCENARIO_IDS = [
  'weekend-market',
  'rain-check',
  'rejected-proposal',
  'friend-farewell',
  'shared-sunday',
  'party-joke',
  'suitcase-at-one',
  'next-home',
] as const;

export const ScenarioIdSchema = z.enum(SCENARIO_IDS);
export const ScenarioTypeSchema = z.enum([
  'invitation',
  'comfort',
  'alignment',
  'repair',
]);
export const DifficultySchema = z.enum(['入门', '进阶', '高压']);
export const GenderSchema = z.enum(['male', 'female']);

export const ENDING_IDS_BY_SCENARIO = {
  'weekend-market': [
    'weekend-has-plans',
    'another-day-with-date',
    'polite-goodbye',
  ],
  'rain-check': [
    'rainy-day-program',
    'rescheduled',
    'separate-ways-home',
  ],
  'rejected-proposal': [
    'laptop-finally-closed',
    'hot-noodles-first',
    'office-lights',
  ],
  'friend-farewell': [
    'company-tonight',
    'ten-more-minutes',
    'really-fine',
  ],
  'shared-sunday': [
    'half-busy-half-idle',
    'sunday-draft',
    'separate-sundays',
  ],
  'party-joke': [
    'back-side-by-side',
    'ask-first-next-time',
    'muted-group-chat',
  ],
  'suitcase-at-one': [
    'breakfast-stays-warm',
    'suitcase-by-the-door',
    'elevator-going-down',
  ],
  'next-home': [
    'same-key',
    'two-more-viewings',
    'two-addresses',
  ],
} as const;

export const ENDING_IDS = [
  'weekend-has-plans',
  'another-day-with-date',
  'polite-goodbye',
  'rainy-day-program',
  'rescheduled',
  'separate-ways-home',
  'laptop-finally-closed',
  'hot-noodles-first',
  'office-lights',
  'company-tonight',
  'ten-more-minutes',
  'really-fine',
  'half-busy-half-idle',
  'sunday-draft',
  'separate-sundays',
  'back-side-by-side',
  'ask-first-next-time',
  'muted-group-chat',
  'breakfast-stays-warm',
  'suitcase-by-the-door',
  'elevator-going-down',
  'same-key',
  'two-more-viewings',
  'two-addresses',
] as const;

export const EndingIdSchema = z.enum(ENDING_IDS);
export const EndingTierSchema = z.enum(['S', 'A', 'C']);

export function endingBelongsToScenario(
  scenarioId: ScenarioId,
  endingId: EndingId,
): boolean {
  return (ENDING_IDS_BY_SCENARIO[scenarioId] as readonly string[]).includes(
    endingId,
  );
}

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

export const EndReasonSchema = z.enum([
  'breakthrough',
  'provisional_truce',
  'relationship_break',
  'round_limit',
]);

export const MetricDeltaSchema = z.strictObject({
  warmth: z.number().int().min(-18).max(16),
  pressure: z.number().int().min(-16).max(22),
  openness: z.number().int().min(-12).max(16),
});

export const EvaluationSignalsSchema = z.strictObject({
  understoodNeed: z.boolean(),
  proposedAction: z.boolean(),
  respectedChoice: z.boolean(),
  sincereCare: z.boolean(),
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
  discoveries: EvaluationSignalsSchema,
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
      'seated',
      'standing',
      'walking',
      'packing',
      'holding-laptop',
      'holding-umbrella',
      'at-door',
      'at-table',
    ]),
    gesture: z.enum([
      'none',
      'points-door',
      'checks-phone',
      'releases-handle',
      'wipes-eye',
      'closes-laptop',
      'offers-seat',
      'folds-umbrella',
      'sets-down-bag',
      'reaches-out',
      'turns-key',
      'nods',
    ]),
    stageDirection: z.string().min(1).max(180),
  }),
  stateChanges: MetricDeltaSchema,
});

export const TranscriptEntrySchema = z.strictObject({
  id: z.string().min(1),
  speaker: z.enum(['player', 'character']),
  text: z.string().min(1).max(280),
  round: z.number().int().min(0).max(7),
  emotion: EmotionSchema.nullable(),
  tone: ToneSchema.nullable(),
  createdAt: z.string().datetime(),
});

export const GameStateSchema = z
  .strictObject({
    sessionId: z.string().uuid(),
    scenarioId: ScenarioIdSchema,
    playerGender: GenderSchema,
    opponentGender: GenderSchema,
    phase: GamePhaseSchema,
    round: z.number().int().min(0).max(7),
    maxRounds: z.number().int().min(5).max(7),
    metrics: z.strictObject({
      warmth: z.number().int().min(0).max(100),
      pressure: z.number().int().min(0).max(100),
      openness: z.number().int().min(0).max(100),
    }),
    flags: EvaluationSignalsSchema,
    activeEvent: StoryEventSchema.nullable(),
    endingId: EndingIdSchema.nullable(),
  })
  .superRefine((state, context) => {
    if (
      state.endingId &&
      !endingBelongsToScenario(state.scenarioId, state.endingId)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['endingId'],
        message: '结局不属于当前关卡',
      });
    }
    if (state.round > state.maxRounds) {
      context.addIssue({
        code: 'custom',
        path: ['round'],
        message: '当前轮次不能超过关卡轮次上限',
      });
    }
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
  goal: GoalResultSchema,
  keyMoments: z
    .array(
      z.strictObject({
        round: z.number().int().min(1).max(7),
        quote: z.string().min(1).max(120),
        analysis: z.string().min(1).max(220),
        impact: z.enum(['turned', 'helped', 'hurt']),
      }),
    )
    .min(1)
    .max(4),
  shareText: z.string().min(1).max(180),
});

export const ScenarioSummarySchema = z.strictObject({
  id: ScenarioIdSchema,
  number: z.number().int().min(1).max(8),
  type: ScenarioTypeSchema,
  title: z.string().min(1).max(80),
  summary: z.string().min(1).max(120),
  difficulty: DifficultySchema,
  maxRounds: z.number().int().min(5).max(7),
});

export const ScenarioBriefingSchema = z.strictObject({
  id: ScenarioIdSchema,
  number: z.number().int().min(1).max(8),
  type: ScenarioTypeSchema,
  title: z.string(),
  summary: z.string(),
  difficulty: DifficultySchema,
  timeAndPlace: z.string(),
  premise: z.string(),
  playerRole: z.string(),
  player: z.strictObject({
    gender: GenderSchema,
    age: z.literal(25),
    role: z.string(),
    experienceYears: z.literal(3),
  }),
  character: z.strictObject({
    gender: GenderSchema,
    name: z.string(),
    age: z.literal(25),
    role: z.string(),
    experienceYears: z.literal(3),
    personality: z.string(),
  }),
  goal: z.string(),
  maxRounds: z.number().int().min(5).max(7),
  openingLine: z.string().min(1).max(160),
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

export const PublicSessionSchema = z
  .strictObject({
    briefing: ScenarioBriefingSchema,
    state: GameStateSchema,
    transcript: z.array(TranscriptEntrySchema),
    lastPerformance: ActorPerformanceSchema,
    verdict: JudgeVerdictSchema.nullable(),
    usage: SessionUsageSchema,
    expiresAt: z.string().datetime(),
  })
  .superRefine((session, context) => {
    if (session.briefing.id !== session.state.scenarioId) {
      context.addIssue({
        code: 'custom',
        path: ['briefing', 'id'],
        message: '关卡简报与会话状态不一致',
      });
    }
    if (
      session.verdict &&
      !endingBelongsToScenario(
        session.state.scenarioId,
        session.verdict.endingId,
      )
    ) {
      context.addIssue({
        code: 'custom',
        path: ['verdict', 'endingId'],
        message: '评判结局不属于当前关卡',
      });
    }
  });

export const CreateSessionResponseSchema = z.strictObject({
  session: PublicSessionSchema,
});

export const CreateSessionInputSchema = z.strictObject({
  scenarioId: ScenarioIdSchema.default('suitcase-at-one'),
  playerGender: GenderSchema.default('male'),
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

export type ScenarioId = z.infer<typeof ScenarioIdSchema>;
export type ScenarioType = z.infer<typeof ScenarioTypeSchema>;
export type Difficulty = z.infer<typeof DifficultySchema>;
export type GamePhase = z.infer<typeof GamePhaseSchema>;
export type Gender = z.infer<typeof GenderSchema>;
export type Emotion = z.infer<typeof EmotionSchema>;
export type Tone = z.infer<typeof ToneSchema>;
export type EndingId = z.infer<typeof EndingIdSchema>;
export type EndingTier = z.infer<typeof EndingTierSchema>;
export type EndReason = z.infer<typeof EndReasonSchema>;
export type MetricDelta = z.infer<typeof MetricDeltaSchema>;
export type EvaluationSignals = z.infer<typeof EvaluationSignalsSchema>;
export type StateDiscoveries = EvaluationSignals;
export type VideoHook = z.infer<typeof VideoHookSchema>;
export type StoryEvent = z.infer<typeof StoryEventSchema>;
export type DirectorDecision = z.infer<typeof DirectorDecisionSchema>;
export type ActorPerformance = z.infer<typeof ActorPerformanceSchema>;
export type TranscriptEntry = z.infer<typeof TranscriptEntrySchema>;
export type GameState = z.infer<typeof GameStateSchema>;
export type JudgeVerdict = z.infer<typeof JudgeVerdictSchema>;
export type ScenarioSummary = z.infer<typeof ScenarioSummarySchema>;
export type ScenarioBriefing = z.infer<typeof ScenarioBriefingSchema>;
export type SessionUsage = z.infer<typeof SessionUsageSchema>;
export type PublicSession = z.infer<typeof PublicSessionSchema>;
export type Capabilities = z.infer<typeof CapabilitiesSchema>;
