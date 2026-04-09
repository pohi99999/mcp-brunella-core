# CI/CD & Release Pipeline (Implementation-Ready)

Összefoglaló
-----------
Ajánlott CI/CD folyamat a Brunella projekthez: build, lint, unit tests (fast), integration cluster (mini MCP), e2e, smoke, és release artefactek generálása. Cél: megbízható, gyors visszajelzés és biztonságos kiadás.

Pipeline stage-ök
-----------------
1. Checkout & cache dependencies
2. Lint: `npm run lint`
3. Build: `npm run build`
4. Unit tests: `npm run test:fast`
5. Integration: start csharp-mcp-server (warmup) + node + python alrendszer, futtasd integration teszteket
6. E2E: Playwright tesztek (szakaszolva, slow/fast)
7. Smoke & health: `npm run smoke`
8. Package & upload artifacts (build/, docs/)
9. Deploy (ha CD engedélyezett): snapshot vagy tag release

GitHub Actions javaslat
-----------------------
- jobs:
  - lint
  - test: unit
  - test: integration (runs on-demand or scheduled due to cost)
  - release (manual or after tag)

Caching és gyorsítás
--------------------
- Node modules cache (actions/cache) a `~/.npm` és lockfile hash alapján
- Docker layer cache, ha Docker-t használsz
- Selective test runs: only changed packages (monorepo esetén)

Secrets & környezet
-------------------
- OLLAMA_BASE_URL, GITHUB_PAT, DB_CONNECTION, PYPI_TOKEN (ha publish)
- Minimal jogok: deploy token csak release job-hoz

Rollback és megfigyelés
-----------------------
- Verziózott artefaktok + health checks után canary/blue-green rollout
- Rollback on failed smoke tests: automatikus revert
- Observability: metrics + alerts a deploy stage után

PR & Release checklist
----------------------
- Lint pass, unit tests green, integration smoke pass
- Release notes frissítve (CHANGELOG.md)
- Tags: semantic versioning (`vMAJOR.MINOR.PATCH`)

Következő lépések
-----------------
- GitHub Actions workflow sablon készítése `/.github/workflows/ci.yml`
- Integration job: docker-compose vagy PowerShell script futtatása a mini cluster indításához
- Pipeline dokumentáció a `docs/ops/` alá
