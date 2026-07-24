import { describe, expect, it } from 'vitest';
import {
  appRouteHref,
  readAppRoute,
} from './routing.js';

const sessionId = '11111111-1111-4111-8111-111111111111';

describe('application routes', () => {
  it('parses every page route under the production base path', () => {
    expect(readAppRoute('/rel-arena/', '/rel-arena/')).toEqual({
      screen: 'select',
    });
    expect(
      readAppRoute(
        '/rel-arena/scenarios/weekend-market',
        '/rel-arena/',
      ),
    ).toEqual({
      screen: 'briefing',
      scenarioId: 'weekend-market',
    });
    expect(
      readAppRoute(
        '/rel-arena/scenarios/weekend-market/memories',
        '/rel-arena/',
      ),
    ).toEqual({
      screen: 'archive',
      scenarioId: 'weekend-market',
    });
    expect(
      readAppRoute(
        `/rel-arena/sessions/${sessionId}`,
        '/rel-arena/',
      ),
    ).toEqual({ screen: 'playing', sessionId });
    expect(
      readAppRoute(
        `/rel-arena/sessions/${sessionId}/result`,
        '/rel-arena/',
      ),
    ).toEqual({ screen: 'result', sessionId });
  });

  it('builds matching development and production hrefs', () => {
    expect(
      appRouteHref(
        { screen: 'briefing', scenarioId: 'rain-check' },
        '/',
      ),
    ).toBe('/scenarios/rain-check');
    expect(
      appRouteHref(
        { screen: 'result', sessionId },
        '/rel-arena/',
      ),
    ).toBe(`/rel-arena/sessions/${sessionId}/result`);
  });

  it('rejects unknown scenarios, malformed sessions, and paths outside the base', () => {
    expect(
      readAppRoute('/rel-arena/scenarios/unknown', '/rel-arena/'),
    ).toBeNull();
    expect(
      readAppRoute('/rel-arena/sessions/not-a-uuid', '/rel-arena/'),
    ).toBeNull();
    expect(readAppRoute('/other/', '/rel-arena/')).toBeNull();
  });
});
