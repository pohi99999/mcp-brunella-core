# Implementációs Terv: Type Safety Follow-up — Browser and Wrangler helpers

## 📋 Fázisok

### 1. Fázis: Helper-layer typing
- [ ] `src/utils/persistentBrowser.ts` JSON parsing és response typing.
- [ ] `src/utils/wranglerHelper.ts` D1 helper parsing és result typing.

### 2. Fázis: Verification
- [ ] `npm run build`.
- [ ] Relevant targeted tests if the helper changes affect existing coverage.

## Notes
- This track is intentionally separate from the main type-safety slice because the remaining helper cleanup is not required for the `aiHelpers.ts` fix.
- Keep runtime behavior unchanged; only tighten types and guards.
