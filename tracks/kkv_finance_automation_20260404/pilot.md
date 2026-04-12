# Pilot start — KKV pénzügyi emlékeztető és jóváhagyási automatizálás

Started at: 2026-04-12T04:17:07Z
Branch: feat/kkv-finance-automation-20260404

Cél: Pilot implementáció — leadott scope: számla-ingest, értesítések, jóváhagyási flow, reconciler.

Delegáció (agentek):
- bas-lead-developer — core implementáció (ingest, parser, approval router)
- robust-test-writer — unit/integration + dashboard + CLI tesztek
- frontend-design-review — dashboard panel és UX
- devops-infra-guardian — CI, lint, test pipeline

Első lépések:
1. Scaffolding (meta/plan/spec) — kész
2. Implementáció skeleton: service client + CLI command + dashboard panel (stubs)
3. Tesztek: unit + integration + dashboard component tests (100% coverage requirement for modified modules)
4. PR és review

Megjegyzés: A következő commit tartalmazza a pilot.md, új meta.json állapot és .ai/copilot.md bejegyzés.
