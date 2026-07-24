import {
  SCENARIO_IDS,
  type ScenarioId,
} from '../shared/contracts.js';

export type AppRoute =
  | { screen: 'select' }
  | { screen: 'briefing'; scenarioId: ScenarioId }
  | { screen: 'playing'; sessionId: string }
  | { screen: 'result'; sessionId: string }
  | { screen: 'archive'; scenarioId: ScenarioId };

interface AppHistoryState {
  relationshipTraining: true;
  depth: number;
  rootDepth: number | null;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function readAppRoute(
  pathname = window.location.pathname,
  basePath = import.meta.env.BASE_URL,
): AppRoute | null {
  const relativePath = stripBasePath(pathname, basePath);
  if (relativePath === null) return null;
  const segments = relativePath
    .split('/')
    .filter(Boolean)
    .map(safeDecode);
  if (segments.some((segment) => segment === null)) return null;
  const parts = segments as string[];

  if (parts.length === 0) return { screen: 'select' };
  if (
    parts.length === 2 &&
    parts[0] === 'scenarios' &&
    isScenarioId(parts[1])
  ) {
    return { screen: 'briefing', scenarioId: parts[1] };
  }
  if (
    parts.length === 3 &&
    parts[0] === 'scenarios' &&
    isScenarioId(parts[1]) &&
    parts[2] === 'memories'
  ) {
    return { screen: 'archive', scenarioId: parts[1] };
  }
  if (
    parts.length === 2 &&
    parts[0] === 'sessions' &&
    UUID_PATTERN.test(parts[1])
  ) {
    return { screen: 'playing', sessionId: parts[1] };
  }
  if (
    parts.length === 3 &&
    parts[0] === 'sessions' &&
    UUID_PATTERN.test(parts[1]) &&
    parts[2] === 'result'
  ) {
    return { screen: 'result', sessionId: parts[1] };
  }
  return null;
}

export function appRouteHref(
  route: AppRoute,
  basePath = import.meta.env.BASE_URL,
): string {
  const base = normalizeBasePath(basePath);
  switch (route.screen) {
    case 'select':
      return base;
    case 'briefing':
      return `${base}scenarios/${encodeURIComponent(route.scenarioId)}`;
    case 'archive':
      return `${base}scenarios/${encodeURIComponent(route.scenarioId)}/memories`;
    case 'playing':
      return `${base}sessions/${encodeURIComponent(route.sessionId)}`;
    case 'result':
      return `${base}sessions/${encodeURIComponent(route.sessionId)}/result`;
  }
}

export function writeAppRoute(
  route: AppRoute,
  options: { replace?: boolean } = {},
): void {
  const href = appRouteHref(route);
  const currentState = readHistoryState(window.history.state);
  if (window.location.pathname === href) {
    if (!currentState) {
      window.history.replaceState(
        {
          relationshipTraining: true,
          depth: 0,
          rootDepth: route.screen === 'select' ? 0 : null,
        },
        '',
        href,
      );
    }
    return;
  }
  const method = options.replace ? 'replaceState' : 'pushState';
  const depth = options.replace
    ? (currentState?.depth ?? 0)
    : (currentState?.depth ?? 0) + 1;
  window.history[method](
    {
      relationshipTraining: true,
      depth,
      rootDepth:
        route.screen === 'select'
          ? depth
          : (currentState?.rootDepth ?? null),
    },
    '',
    href,
  );
}

export function initializeAppHistory(): void {
  const route = readAppRoute();
  if (!route) return;
  writeAppRoute(route, { replace: true });
}

export function returnToAppRoot(): boolean {
  const currentState = readHistoryState(window.history.state);
  if (
    currentState &&
    currentState.rootDepth !== null &&
    currentState.depth > currentState.rootDepth
  ) {
    window.history.go(
      -(currentState.depth - currentState.rootDepth),
    );
    return true;
  }
  writeAppRoute({ screen: 'select' }, { replace: true });
  return false;
}

function stripBasePath(
  pathname: string,
  basePath: string,
): string | null {
  const base = normalizeBasePath(basePath);
  const withoutTrailingSlash =
    base.length > 1 ? base.slice(0, -1) : base;
  if (pathname === withoutTrailingSlash) return '';
  if (!pathname.startsWith(base)) return null;
  return pathname.slice(base.length);
}

function normalizeBasePath(basePath: string): string {
  const withLeadingSlash = basePath.startsWith('/')
    ? basePath
    : `/${basePath}`;
  return withLeadingSlash.endsWith('/')
    ? withLeadingSlash
    : `${withLeadingSlash}/`;
}

function safeDecode(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

function isScenarioId(value: string): value is ScenarioId {
  return (SCENARIO_IDS as readonly string[]).includes(value);
}

function readHistoryState(value: unknown): AppHistoryState | null {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('relationshipTraining' in value) ||
    value.relationshipTraining !== true ||
    !('depth' in value) ||
    typeof value.depth !== 'number' ||
    !Number.isInteger(value.depth) ||
    value.depth < 0 ||
    !('rootDepth' in value) ||
    !(
      value.rootDepth === null ||
      (typeof value.rootDepth === 'number' &&
        Number.isInteger(value.rootDepth) &&
        value.rootDepth >= 0 &&
        value.rootDepth <= value.depth)
    )
  ) {
    return null;
  }
  return {
    relationshipTraining: true,
    depth: value.depth,
    rootDepth: value.rootDepth,
  };
}
