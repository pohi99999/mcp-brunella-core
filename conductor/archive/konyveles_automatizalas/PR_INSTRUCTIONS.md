Pull Request Instructions
=========================

Automatic PR creation via GH CLI failed due to insufficient permissions. You can create the PR manually using the link below or via the GitHub UI.

Direct PR link (create new PR for this branch):

https://github.com/pohi99999/mcp-brunella-core/pull/new/feature/konyveles_automatizalas

Or via GH CLI (if authenticated and permitted):

```bash
gh pr create --repo pohi99999/mcp-brunella-core --base main --head feature/konyveles_automatizalas \
  --title "feat(konyveles): bookkeeping automation track - discovery & connectors" \
  --body "Adds discovery scripts, IMAP & GDrive connectors, NAV client (mTLS & OAuth), and matching prototype. Run `node scripts/konyveles_discovery_run.js` to reproduce sample matching output saved to data/konyveles/match_results.json."
```

PR checklist (recommended):

- [ ] Build passes (`npm run build`)
- [ ] Fast tests pass (`npm run test:fast`)
- [ ] Discovery run reproduces sample output (`node scripts/konyveles_discovery_run.js`)
- [ ] Security: no secrets committed (service account JSON, keys should be referenced via env vars)
- [ ] Add reviewer(s): `pohi99999`

If you need me to open the PR but lack GH permissions, grant the agent `gh` the necessary token or open the PR via the link above and I will continue with review comments.
