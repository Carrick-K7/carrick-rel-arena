import {
  DirectorDecisionSchema,
  GameStateSchema,
  JudgeVerdictSchema,
  type DirectorDecision,
  type EndingId,
  type Gender,
  type GameState,
  type JudgeVerdict,
} from '../shared/contracts.js';
import {
  ENDING_CATALOG,
  containsForbiddenPhrase,
  createForbiddenEvent,
} from './scenario.js';

export function createInitialState(
  sessionId: string,
  playerGender: Gender = 'male',
): GameState {
  return GameStateSchema.parse({
    sessionId,
    scenarioId: 'suitcase-at-one',
    playerGender,
    opponentGender: playerGender === 'male' ? 'female' : 'male',
    phase: 'awaiting_player',
    round: 0,
    maxRounds: 7,
    metrics: {
      trust: 32,
      anger: 76,
      vulnerability: 38,
      hiddenProgress: 0,
    },
    flags: {
      forbiddenPhraseCount: 0,
      namedSpecificHurt: false,
      ownedChoice: false,
      concretePlan: false,
      relationshipChosen: false,
    },
    activeEvent: null,
    endingId: null,
  });
}

export interface AppliedDirectorResult {
  state: GameState;
  decision: DirectorDecision;
}

export function applyDirectorDecision(
  current: GameState,
  originalDecision: DirectorDecision,
  playerLine: string,
  round: number,
): AppliedDirectorResult {
  const deterministicRestriction = containsForbiddenPhrase(playerLine);
  const restrictionHit = deterministicRestriction;
  const penalty = restrictionHit
    ? { trust: -7, anger: 6, vulnerability: -2 }
    : { trust: 0, anger: 0, vulnerability: 0 };
  const mergedDiscoveries = {
    namedSpecificHurt:
      current.flags.namedSpecificHurt ||
      originalDecision.discoveries.namedSpecificHurt,
    ownedChoice:
      current.flags.ownedChoice ||
      originalDecision.discoveries.ownedChoice,
    concretePlan:
      current.flags.concretePlan ||
      originalDecision.discoveries.concretePlan,
    relationshipChosen:
      current.flags.relationshipChosen ||
      originalDecision.discoveries.relationshipChosen,
  };
  const potentialHiddenProgress =
    Number(mergedDiscoveries.namedSpecificHurt) +
    Number(
      mergedDiscoveries.ownedChoice ||
        mergedDiscoveries.relationshipChosen,
    ) +
    Number(
      mergedDiscoveries.concretePlan &&
        mergedDiscoveries.relationshipChosen,
    );
  const validatedHiddenIncrement =
    potentialHiddenProgress > current.metrics.hiddenProgress ? 1 : 0;

  const decision = DirectorDecisionSchema.parse({
    ...originalDecision,
    restrictionHit,
    delta: {
      trust: clamp(originalDecision.delta.trust + penalty.trust, -18, 16),
      anger: clamp(originalDecision.delta.anger + penalty.anger, -16, 22),
      vulnerability: clamp(
        originalDecision.delta.vulnerability + penalty.vulnerability,
        -12,
        16,
      ),
      hiddenProgress: restrictionHit
        ? 0
        : Math.max(
            originalDecision.delta.hiddenProgress,
            validatedHiddenIncrement,
          ),
    },
    event: restrictionHit
      ? createForbiddenEvent(round)
      : originalDecision.event,
  });

  const state = GameStateSchema.parse({
    ...current,
    phase: 'acting',
    round,
    metrics: {
      trust: clamp(
        current.metrics.trust + decision.delta.trust,
        0,
        100,
      ),
      anger: clamp(
        current.metrics.anger + decision.delta.anger,
        0,
        100,
      ),
      vulnerability: clamp(
        current.metrics.vulnerability + decision.delta.vulnerability,
        0,
        100,
      ),
      hiddenProgress: clamp(
        current.metrics.hiddenProgress + decision.delta.hiddenProgress,
        0,
        3,
      ),
    },
    flags: {
      forbiddenPhraseCount:
        current.flags.forbiddenPhraseCount + (restrictionHit ? 1 : 0),
      ...mergedDiscoveries,
    },
    activeEvent: decision.event,
  });

  return { state, decision };
}

export function selectEnding(state: GameState): EndingId | null {
  if (state.flags.forbiddenPhraseCount >= 2) {
    return 'apology-allergen';
  }

  const relationshipCollapsed =
    state.metrics.trust <= 10 || state.metrics.anger >= 90;
  const firstRestrictionGetsAReply =
    state.round === 1 && state.flags.forbiddenPhraseCount === 1;
  if (relationshipCollapsed && !firstRestrictionGetsAReply) {
    return 'elevator-going-down';
  }

  const hiddenGoalComplete =
    state.metrics.hiddenProgress >= 3 &&
    state.flags.namedSpecificHurt &&
    state.flags.concretePlan &&
    state.flags.relationshipChosen;

  if (
    state.round >= 4 &&
    state.metrics.trust >= 72 &&
    state.metrics.anger <= 40 &&
    hiddenGoalComplete &&
    state.flags.forbiddenPhraseCount === 0
  ) {
    return 'breakfast-stays-warm';
  }

  if (
    state.round >= 5 &&
    state.metrics.trust >= 54 &&
    state.metrics.anger <= 52 &&
    state.flags.concretePlan
  ) {
    return 'suitcase-by-the-door';
  }

  if (state.round >= state.maxRounds) {
    if (
      state.flags.forbiddenPhraseCount > 0 &&
      state.metrics.trust < 35
    ) {
      return 'apology-allergen';
    }
    return 'elevator-going-down';
  }

  return null;
}

export function lockVerdict(
  verdict: JudgeVerdict,
  endingId: EndingId,
): JudgeVerdict {
  const locked = ENDING_CATALOG[endingId];
  return JudgeVerdictSchema.parse({
    ...verdict,
    endingId,
    tier: locked.tier,
    epilogue: verdict.epilogue || locked.defaultEpilogue,
  });
}

export function clamp(
  value: number,
  min: number,
  max: number,
): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}
