# Design Spec: OpenAPI Schema-generálás a Cloudflare Workers track-be

**Dátum:** 2026-03-21
**Track:** cloudflare_workers_migration_20260226 (Phase 5 bővítés)
**Státusz:** APPROVED

---

## Összefoglalás

A Brunella MCP tool registry-ből automatikusan generálunk OpenAPI 3.1 spec-et, és minden Cloudflare Worker saját `/openapi.json` endpoint-ot kap. Ez lehetővé teszi, hogy külső rendszerek (n8n, Zapier, más API gateway-ek, egyéb kliensek) standard REST API-ként integrálódjanak Brunellával — MCP protokoll ismerete nélkül.

---

## Probléma

- A Brunella MCP eszközök `inputSchema` definícióval rendelkeznek, de nincs standard HTTP API dokumentáció
- Külső rendszerek (pl. n8n workflows, partner API-k) nem tudnak "autodiscover" módban csatlakozni
- A Workers track 16 agent Worker-t hoz létre, de ezek egyedi, dokumentálatlan HTTP endpointok lesznek
- Open WebUI MCP Proxy inspiráció: az MCP ↔ REST hídra van szükség

---

## Megközelítés

### Választott megközelítés: Generált OpenAPI — Build-time + Runtime

**Miért ez?**
- Build-time: statikus JSON generálás a `src/server/registry.ts` és MCP tool definíciók alapján
- Runtime: a `/api/openapi.json` endpoint mindig friss (dinamikus, runtime schema)
- Worker szintű: minden Worker saját minimális OpenAPI spec-et kap (csak az ő tool-jai)
- **Nem külső dependency** — pure TypeScript, Zod sémák → OpenAPI konverzió

---

## Architektúra

### Komponensek

```
src/utils/openapiGenerator.ts      ← ÚJ: MCP tool def → OpenAPI 3.1 konverter
src/server/routes/openapi.ts       ← ÚJ: GET /api/openapi.json endpoint
workers/shared/openapi-template.ts ← MINDEN Worker-hez copy: GET /openapi.json
```

### Adatfolyam

```
src/server/registry.ts (registeredToolsList)
  + src/tools/*.ts (inputSchema definitions)
        ↓
  openapiGenerator.ts
        ↓
  OpenAPI 3.1 JSON spec
        ↓
  GET /api/openapi.json  (Brunella Express szerver)
  GET /openapi.json      (minden Cloudflare Worker)
```

### OpenAPI Schema struktúra

```json
{
  "openapi": "3.1.0",
  "info": {
    "title": "Brunella Agent System API",
    "version": "2.0.0",
    "description": "AI multi-agent rendszer REST API"
  },
  "paths": {
    "/api/agents/{name}/execute": {
      "post": {
        "summary": "Agent végrehajtás",
        "parameters": [{ "name": "name", "in": "path", "required": true }],
        "requestBody": { "content": { "application/json": { "schema": { ... } } } }
      }
    },
    "/tools/{toolName}": {
      "post": {
        "summary": "MCP tool direkt hívás",
        "requestBody": { /* inputSchema alapján generált */ }
      }
    }
  }
}
```

### Worker-szintű spec

Minden Worker (pl. `brunella-lead-agent`) csak a saját tool-jait dokumentálja:
```
GET https://brunella-lead-agent.workers.dev/openapi.json
→ { paths: { "/execute": { post: { ... LeadMiningAgent, SalesHunterAgent schemas } } } }
```

---

## Implementáció részletei

### `src/utils/openapiGenerator.ts`

```typescript
import { registeredToolsList } from '../server/registry.js';

export function generateOpenAPISpec(): OpenAPISpec {
  const paths: Record<string, PathItem> = {};

  for (const tool of registeredToolsList) {
    paths[`/tools/${tool.name}`] = {
      post: {
        summary: tool.description,
        operationId: tool.name,
        requestBody: {
          content: {
            'application/json': {
              schema: buildJsonSchema(tool.parameters)
            }
          }
        },
        responses: {
          '200': { description: 'Sikeres végrehajtás' },
          '400': { description: 'Hibás paraméterek' },
          '500': { description: 'Agent hiba' }
        }
      }
    };
  }

  return { openapi: '3.1.0', info: BAS_INFO, paths };
}
```

### Workers track Phase 5 bővítés

A meglévő Phase 5 (Dashboard + CLI integráció) kap egy új task-ot:
- **OpenAPI endpoint minden Worker-ben:** `GET /openapi.json` → worker-specifikus spec
- **Master spec:** `GET /api/openapi.json` → teljes Brunella API
- **Swagger UI:** `GET /api-docs` már meglévő → frissítendő az új spec-cel
- **CI/CD:** `wrangler deploy` után auto-validáció: `curl <worker>/openapi.json | npx @readme/openapi-parser validate`

---

## Érintett fájlok

| Fájl | Módosítás típusa |
|------|-----------------|
| `src/utils/openapiGenerator.ts` | **ÚJ** |
| `src/server/routes/openapi.ts` | **ÚJ** |
| `src/server/web.ts` | módosítás: route regisztrálás |
| `conductor/tracks/cloudflare_workers_migration_20260226/meta.json` | Phase 5 bővítés |
| Minden Worker `src/` fájl | GET /openapi.json hozzáadás |

---

## Tesztelés

```bash
# Express szerver OpenAPI
curl http://localhost:3000/api/openapi.json | python -m json.tool
# Validáció
npx @readme/openapi-parser validate http://localhost:3000/api/openapi.json
# Worker OpenAPI (deploy után)
curl https://brunella-lead-agent.workers.dev/openapi.json
```

---

## Siker kritériumok

- [ ] `GET /api/openapi.json` → valid OpenAPI 3.1 spec (minden MCP tool dokumentálva)
- [ ] Minden Worker `GET /openapi.json` → worker-specifikus spec
- [ ] Swagger UI frissítve az új spec-cel
- [ ] `npm test` PASS (openapiGenerator unit teszt)
- [ ] CI/CD validáció: openapi-parser 0 hiba
