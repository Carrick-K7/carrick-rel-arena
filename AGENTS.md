# AGENTS.md

This repository is designed for autonomous AI development.

## Product boundaries

- Optimize every feature for replay value, dramatic tension, streamer readability, and shareable outcomes.
- Keep each run self-contained. Sessions expire and relationship state stays temporary.
- Keep director, actor, and judge responsibilities separate in code, prompts, schemas, and evaluations.
- Maintain a complete mock provider so contributors and CI can play the whole game without paid API access.
- Keep provider secrets on the server.
- Treat server state as canonical. Model-proposed state changes pass through deterministic validation and clamping.
- Use repository-owned WebP portrait states with lightweight CSS motion. Live2D is an adapter milestone.
- Reserve video generation for opening, turning-point, and ending hooks.
- Treat `docs/DESIGN.md` as the single source of truth for the frontend design system; update it alongside any token, motion, or component-pattern change.

## Verification

Run before committing:

```bash
npm run verify
```

The full verification includes type checking, unit tests, production build, and Playwright interaction tests.

## Deployment and production closure

- Production is `https://games.carrick7.com/rel-arena/`.
- The local health contract is `GET /api/health`; through Caddy it is
  `GET /rel-arena/api/health`.
- Runtime provider secrets remain in `/etc/relationship-arena/` and must
  never appear in commits, CI logs, browser storage, or handoff text.
- Production currently runs as `relationship-arena.service`. Shared Caddy,
  the host-level unit, listeners, and monitoring are owned by the private
  `Carrick-K7/carrick-ops` repository.
- Application changes must not overwrite Caddy or systemd configuration.
- When a change is pushed through a production deployment workflow, the AI
  responsible for the change must follow the exact commit's workflow to
  completion and smoke-test only the changed public path before reporting it
  live.
- Real image/video provider tests cost money and remain explicitly manual;
  CI and routine smoke tests use mock or zero-cost paths.

## Closure

Commit only files belonging to this project. Include the tested provider mode and verification result in the handoff.
