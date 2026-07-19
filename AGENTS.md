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

## Closure

Commit only files belonging to this project. Include the tested provider mode and verification result in the handoff.
