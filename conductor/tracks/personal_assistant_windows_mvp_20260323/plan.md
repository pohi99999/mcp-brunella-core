# Plan — Brunella Personal Assistant Windows MVP Foundation

- [x] Audit existing Brunella capabilities relevant to the personal assistant.
- [x] Add assistant blueprint/readiness core service.
- [x] Add backend assistant API route.
- [x] Add dashboard panel for assistant blueprint.
- [x] Add CLI assistant inspection command.
- [x] Write blueprint documentation.
- [x] Run build and focused validation.

## Delivery Notes
This track focuses on turning the current BAS platform into a coherent personal-assistant product direction instead of building every subsystem at once.


## Validation

- `npm run build` ✅
- `npm run build:ui` ✅
- direct fast Vitest suite (`npx vitest run --reporter=dot --exclude test/cli-e2e* --exclude test/phase* --exclude test/swarm_smoke*`) ✅
- `npm run test:fast` ⚠️ Windows quoting issue suspected in existing npm script invocation; direct equivalent suite passed
