import { describe, expect, it } from 'vitest';
import {
  relationshipProgress,
  relationshipProgressLabel,
} from './relationship-progress.js';

describe('relationship progress', () => {
  it('combines warmth, openness, and inverse pressure', () => {
    expect(
      relationshipProgress({ warmth: 80, openness: 65, pressure: 20 }),
    ).toBe(75);
    expect(
      relationshipProgress({ warmth: 0, openness: 0, pressure: 100 }),
    ).toBe(0);
    expect(
      relationshipProgress({ warmth: 100, openness: 100, pressure: 0 }),
    ).toBe(100);
  });

  it('clamps inputs and rounds the combined value', () => {
    expect(
      relationshipProgress({ warmth: 90, openness: 81, pressure: 0 }),
    ).toBe(90);
    expect(
      relationshipProgress({ warmth: 150, openness: 120, pressure: -20 }),
    ).toBe(100);
  });

  it('labels every published boundary', () => {
    expect(relationshipProgressLabel(0)).toBe('疏离');
    expect(relationshipProgressLabel(24)).toBe('疏离');
    expect(relationshipProgressLabel(25)).toBe('紧绷');
    expect(relationshipProgressLabel(44)).toBe('紧绷');
    expect(relationshipProgressLabel(45)).toBe('试探');
    expect(relationshipProgressLabel(64)).toBe('试探');
    expect(relationshipProgressLabel(65)).toBe('靠近');
    expect(relationshipProgressLabel(79)).toBe('靠近');
    expect(relationshipProgressLabel(80)).toBe('稳定');
    expect(relationshipProgressLabel(100)).toBe('稳定');
  });
});
