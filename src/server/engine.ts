import {
  DirectorDecisionSchema,
  GameStateSchema,
  JudgeVerdictSchema,
  type DirectorDecision,
  type EndingId,
  type Gender,
  type GameState,
  type JudgeVerdict,
  type ScenarioId,
} from '../shared/contracts.js';
import {
  getEndingDefinition,
  getScenarioDefinition,
} from './scenario.js';

export function createInitialState(
  sessionId: string,
  scenarioId: ScenarioId = 'suitcase-at-one',
  playerGender: Gender = 'male',
): GameState {
  const definition = getScenarioDefinition(scenarioId);
  return GameStateSchema.parse({
    sessionId,
    scenarioId,
    playerGender,
    opponentGender: playerGender === 'male' ? 'female' : 'male',
    phase: 'awaiting_player',
    round: 0,
    maxRounds: definition.maxRounds,
    metrics: definition.initialMetrics,
    flags: {
      understoodNeed: false,
      proposedAction: false,
      respectedChoice: false,
      sincereCare: false,
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
    understoodNeed:
      current.flags.understoodNeed ||
      originalDecision.discoveries.understoodNeed,
    proposedAction:
      current.flags.proposedAction ||
      originalDecision.discoveries.proposedAction,
    respectedChoice:
      current.flags.respectedChoice ||
      originalDecision.discoveries.respectedChoice,
    sincereCare:
      current.flags.sincereCare ||
      originalDecision.discoveries.sincereCare,
  };

  const decision = DirectorDecisionSchema.parse({
    ...originalDecision,
  });

  const state = GameStateSchema.parse({
    ...current,
    phase: 'acting',
    round,
    metrics: {
      warmth: clamp(
        current.metrics.warmth + decision.delta.warmth,
        0,
        100,
      ),
      pressure: clamp(
        current.metrics.pressure + decision.delta.pressure,
        0,
        100,
      ),
      openness: clamp(
        current.metrics.openness + decision.delta.openness,
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
  const definition = getScenarioDefinition(state.scenarioId);
  const thresholds = definition.thresholds;
  const relationshipCollapsed =
    state.metrics.warmth <= 8 || state.metrics.pressure >= 94;
  if (relationshipCollapsed) {
    return definition.endings.C.id;
  }

  const signalCount = Object.values(state.flags).filter(Boolean).length;
  const strongResponse =
    state.flags.understoodNeed &&
    state.flags.proposedAction &&
    signalCount >= 3;

  if (
    state.round >= thresholds.sMinRound &&
    state.metrics.warmth >= thresholds.sWarmth &&
    state.metrics.pressure <= thresholds.sPressure &&
    strongResponse
  ) {
    return definition.endings.S.id;
  }

  if (
    state.round >= thresholds.aMinRound &&
    state.metrics.warmth >= thresholds.aWarmth &&
    state.metrics.pressure <= thresholds.aPressure &&
    signalCount >= 2 &&
    (state.flags.proposedAction || state.flags.respectedChoice)
  ) {
    return definition.endings.A.id;
  }

  if (state.round >= state.maxRounds) {
    return definition.endings.C.id;
  }

  return null;
}

export function lockVerdict(
  verdict: JudgeVerdict,
  scenarioId: ScenarioId,
  endingId: EndingId,
): JudgeVerdict {
  const locked = getEndingDefinition(scenarioId, endingId);
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
