import type { GameState } from '../shared/contracts.js';

export type RelationshipProgressLabel =
  | '疏离'
  | '紧绷'
  | '试探'
  | '靠近'
  | '稳定';

export function relationshipProgress(
  metrics: GameState['metrics'],
): number {
  const value = Math.round(
    (metrics.warmth + metrics.openness + (100 - metrics.pressure)) / 3,
  );
  return Math.min(100, Math.max(0, value));
}

export function relationshipProgressLabel(
  value: number,
): RelationshipProgressLabel {
  if (value <= 24) return '疏离';
  if (value <= 44) return '紧绷';
  if (value <= 64) return '试探';
  if (value <= 79) return '靠近';
  return '稳定';
}
