# LogPulse Copilot Instructions

## Stack Contract (Do Not Drift)

- Backend runtime and tooling: Python + UV only.
- Frontend runtime and tooling: Bun + React only.
- UI system: shadcn components and patterns for all new UI work.

## Backend Rules

- Use `uv` for dependency and command execution.
- Prefer:
  - `uv sync`
  - `uv run <command>`
- Do not introduce `requirements.txt`-first workflows when `pyproject.toml` exists.
- Keep backend code under `backend/app` and expose routes under `/api/v1`.

## Frontend Rules

- Use Bun commands only:
  - `bun install`
  - `bun run dev`
  - `bun run build`
- Do not switch to npm/yarn/pnpm.
- Keep frontend code inside `frontend/src` with clear `pages`, `components`, `hooks`, `api`, and `store` boundaries.

## UI Rules (shadcn-first)

- Use existing shadcn primitives from `frontend/src/components/ui`.
- For any new UI element, prefer adding or extending a shadcn-style component before raw custom markup.
- Keep visual consistency with the active shadcn theme tokens from `frontend/src/index.css`.

## Delivery Pattern

- Follow implementation alternation requested for this repo:
  1. backend
  2. frontend
  3. backend
  4. frontend
  - Continue alternating for subsequent implementation passes.

## Streaming Validation Requirement

For real-time pipeline work, ensure this flow is always testable:
1. Backend Python synthetic log generation
2. Kafka publish to `logs.raw`
3. Stream consume from Kafka
4. DB persistence verification
5. Frontend visibility (status/recent logs)

## Guardrails

- Keep changes focused and phase-based.
- Preserve existing endpoint contracts unless a migration is documented.
- Avoid introducing new frameworks unless explicitly approved.
