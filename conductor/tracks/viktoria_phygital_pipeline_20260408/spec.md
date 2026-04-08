# Specifikacio: VIKTORIAVARGA phygital pipeline

## Hatter
A brand stacknek nem csak copy, hanem phygital útvonal is kell: browser, Python és harvest réteg, amely a webes és termékes tapasztalatot összeköti.

## Scope
- Browser-based verification.
- Python extraction / harvesting surface.
- Content-to-commerce bridge.

## Outside scope
- Full e-commerce platform rewrite.
- Payment gateway replacement.
- Visual identity redesign.

## Implementacios celpontok
- `src/agents/RobotkezV2Agent.ts`
- `src/agents/ChromeDevToolsAgent.ts`
- `src/tools/browser.ts`
- `src/tools/harvest_*`
- `src/agents/PythonAgent.ts`

## Acceptance kriteriumok
- A browser és Python surface egy irányított pipeline-ban megjelenik.
- A kimenetek brand-safe-ek.
- A fallback minimalis és reprodukalhato.

## Rollout
1. Capability discovery.
2. Extraction bridge.
3. Browser validation.
4. Pipeline verification.
