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
import { ENDING_CATALOG } from './scenario.js';

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
    },
    flags: {
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
  round: number,
): AppliedDirectorResult {
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

  const decision = DirectorDecisionSchema.parse({
    ...originalDecision,
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
    },
    flags: mergedDiscoveries,
    activeEvent: decision.event,
  });

  return { state, decision };
}

export function selectEnding(state: GameState): EndingId | null {
  const relationshipCollapsed =
    state.metrics.trust <= 10 || state.metrics.anger >= 90;
  if (relationshipCollapsed) {
    return 'elevator-going-down';
  }

  const strongRepair =
    state.flags.namedSpecificHurt &&
    state.flags.concretePlan &&
    state.flags.relationshipChosen;

  if (
    state.round >= 4 &&
    state.metrics.trust >= 72 &&
    state.metrics.anger <= 40 &&
    strongRepair
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
