# Specifikacio: VIKTORIAVARGA phygital pipeline

## Hatter
A brand stacknek nem csak copy, hanem phygital útvonal is kell: browser, Python és harvest réteg, amely a webes és termékes tapasztalatot összeköti "Enjoy life in colours" stilusban.

## Scope
- Browser-based luxury visual verification.
- Python-driven fashion-specific metadata extraction (Bilingual: HU/EN).
- Event-driven "Content-to-Commerce" bridge (URL -> Extracted Data -> Brand Safe Copy).
- Multimodal context passing: RobotkezV2 vision -> ViktoriaBrandVoice copy.

## Outside scope
- Full e-commerce platform rewrite.
- Payment gateway replacement.
- Visual identity redesign.

## Implementacios celpontok
- `myai/schemas/viktoria_product.py`: Pydantic model specific for luxury fashion.
- `src/agents/ViktoriaPhygitalAgent.ts`: High-level orchestrator of visual and textual layers.
- `src/tools/viktoria_verify.ts`: Visual safety and "Phygital" data check tools.
- `src/agents/RobotkezV2Agent.ts`: Augmented with visual brand safety triggers.
- `src/agents/ChromeDevToolsAgent.ts`: Extended with visual health check capabilities.

## Acceptance kriteriumok
- A browser és Python surface egy irányított pipeline-ban megjelenik.
- A kimenetek brand-safe-ek (luxury fashion standards szerint).
- A termékadatok (Color, Material, Fit, Mood) kétnyelvűen, strukturáltan kinyerhetők.
- A folyamat végén a Vision adatok megérkeznek a Copywriterhez.

## Rollout
1. Extraction Bridge (Python Schema Design).
2. Vision Bridge (RobotkezV2 augmentation).
3. Orchestration (Implementing ViktoriaPhygitalAgent).
4. Monitoring (Dashboard Panel Registration).
5. Pipeline Verification.
