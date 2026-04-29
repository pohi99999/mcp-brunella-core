# Plan — Legacy Drift Cleanup (tracked routes + Cloudflare vendor copy)

## Goal
Remove the confirmed tracked legacy drift surfaces without pulling unrelated workspace noise into the commit.

## Steps
1. Verify the 6 `src/server/routes` orphans remain unreferenced.
2. Remove the 6 orphan route files from `src/server/routes/`.
3. Remove the tracked vendor copy under `integrations/bas-cloudflare-orchestrator/`.
4. Create a fresh session checkpoint under `docs/sessions/`.
5. Run `npm run build` and `npm run test:fast`.
6. Commit only the intended cleanup diff and keep unrelated untracked/modified files out of scope.

## Out of scope
- Untracked workspace-only files under `src/`, `myai/`, or other generated folders.
- Any further `src/agents` or `src/index.ts` handling until a separate approval clarifies whether those files are disposable or required in the current workspace.

## Notes
The earlier audit showed the 6 route files have zero live references and the integrations tree is a tracked vendor duplicate. The workspace is currently dirty for unrelated reasons, so the cleanup must stay tightly staged.
