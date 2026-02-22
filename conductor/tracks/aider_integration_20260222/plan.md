# Aider Integration Track — Plan

**Cél:** Aider beillesztése a Brunella AI csapatba mint kód-író ügynök.

## Csapat Munkamegosztás

```
Te (tulajdonos / irányítás)
  │
  ├── Claude Code  ← Tervezés, koordináció, architektúra, döntések
  │                   Nagy képet látja, conductor protokollt tartja
  │
  ├── Aider        ← Kód írás, refactor, kis-közepes feladatok
  │   (GPT-4o /       Git commit-okat készít
  │    Gemini)         Önálló branch-eken dolgozik
  │
  └── Brunella     ← Automatizálás, data pipeline, monitoring
      Agents          OrchestratorAgent koordinál
```

## Mire Való Aider

✅ Használd Aider-t:
- Önálló, behatárolt kód módosítások (1-3 fájl)
- Refactoring (pl. rename, extract function)
- Teszt fájlok generálása
- Kis feature-ök önálló branch-en
- Boilerplate kód írás gyorsan

❌ NE használd Aider-t:
- conductor/tracks.md (ProjectConductor kezeli)
- CLAUDE.md, .env, registry.json (protected)
- Nagyobb architektúra döntések (Claude-dal kell megbeszélni)
- D1Adapter, modelRouter.ts, AgentManager.ts (kritikus infrastruktúra)

## .aiderignore Tartalom

```
conductor/tracks.md
conductor/workflow.md
CLAUDE.md
.env
src/agents/registry.json
src/core/modelRouter.ts
src/utils/d1Adapter.ts
src/agents/AgentManager.ts
build/
node_modules/
myai/.venv/
```

## LiteLLM Setup

```bash
# LiteLLM indítás
litellm --model github/gpt-4o --port 4000

# Aider csatlakoztatása
aider --model litellm/gpt-4o --openai-api-base http://localhost:4000

# Vagy Gemini-vel
aider --model litellm/gemini/gemini-2.0-flash --openai-api-base http://localhost:4000
```

## Koordinációs Szabályok

1. **Claude tervez** → Aider implementál → Claude review-ol
2. Aider minden munkát **új branch-en** csinál
3. Merge előtt `npm run build && npm test` kötelező
4. Ha Aider elakad → Claude-hoz jön
