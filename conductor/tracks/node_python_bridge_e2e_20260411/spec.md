# Spec — Node↔Python Bridge E2E Tesztek

## Cél

A FastAPI Python alrendszer és a Node.js `pythonBridge.ts` között nincs e2e tesztlefedettség.
Ha a bridge elcsúszik, a RAG (`/rag/*`) és browser automation (`/comet/*`) csendesen hibázhat.

## Scope (in)

- `src/utils/pythonBridge.ts` — Zod schema validáció az összes Python API válaszhoz
- `myai/server.py` — FastAPI endpoint-ok: `/rag/query`, `/comet/execute`, `/comet/memory`, `/health`
- E2E tesztek: valós FastAPI szerver + Node.js bridge hívás (nem mock)
- Schema mismatch detekció — mi történik ha a Python módosul de a Node Zod schema nem

## Scope (out)

- Unit tesztek (már léteznek a pythonBridge.ts-hez)
- Python-oldali pytest tesztek (megvan: `myai/tests/`)
- Frontend/dashboard tesztek

## Elfogadási kritériumok

1. `test/integration/pythonBridge.integration.test.ts` létezik és zöld
2. Teszteli: `/rag/query`, `/comet/execute`, `/health` sikerút
3. Teszteli: schema mismatch → explicit warning emittálódik (nem silent fail)
4. Teszteli: FastAPI nem elérhető → graceful degradation, nem crash
5. CI pipeline-ba integrálva (opcionális: `npm run test:integration`)

## Kockázat

Ha ez a track nem készül el, és a Python API válasz struct változik,
a Node.js-oldali Zod validáció csendesen fallback-el, és a RAG/browser funkcionalitás
úgy tűnik, mintha működne, de üresen tér vissza.
