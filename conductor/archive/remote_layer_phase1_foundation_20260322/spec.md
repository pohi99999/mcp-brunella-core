# Spec: Brunella Remote Layer — Fázis 1: Remote Foundation

## Track ID

`remote_layer_phase1_foundation_20260322`

## Forrás

- `f:\mcp-brunella-core\.worktrees\Brunella_superinnteligencia.md`
- Koncepcionális szakaszok: service-mesh irány, Remote Console, MCP routing, PAIOS integráció, egységes dashboard.
- Implementációs prompt: Fázis 1 (`/api/remote/*`, WebSocket stream, `mcpRouter`, dashboard Remote Console, PAIOS kliens).

## Cél

1. A Brunella Core legyen API-first remote platform mobil, web és PAIOS kliensekhez.
2. Jöjjön létre egy egységes remote session + command + stream interfész.
3. Legyen alap MCP-routing skeleton, amelyre a későbbi discovery és capability mapping ráépülhet.
4. A dashboard kapjon működő Remote Console panelt a legelső használható remote vezérléshez.

## Scope

- `src/server/routes/remote.ts`
- Socket.IO / WebSocket remote stream namespace
- `src/core/mcpRouter.ts` skeleton singleton
- dashboard remote komponensek (`RemoteConsole`, `RemoteTargetSelector`, `RemoteStream`)
- `src/dashboard/lib/apiService.ts` remote hívásokkal
- `src/clients/BrunellaRemoteClient.ts`
- minimális smoke tesztek remote session / command / router működésre

## Kimenetek

- Működő `POST /api/remote/session`
- Működő `GET /api/remote/targets`
- Működő `POST /api/remote/command`
- Sessionhöz kötött real-time stream
- Dashboard Remote Console első iterációja
- PAIOS oldali kliens wrapper a remote API-hoz

## Nem része ennek a fázisnak

- MCP autodiscovery
- Token alapú authentikáció és autorizáció
- SQLite perzisztens session store
- Mobil UI és voice input
- Multi-node mesh / edge routing

## Elfogadási kritériumok

- A remote API alapútvonalai build-hibamentesen elérhetők.
- A session-létrehozás után command futtatható agentre és toolra.
- A session stream valós időben visszaküldi a státusz- és válasz-eseményeket.
- A dashboard Remote Console képes targetet választani és parancsot küldeni.
- `npm run build` sikeres.
- `npm test` sikeres.

## Függőségek

- Meglévő Express + Socket.IO infrastruktúra
- Meglévő agent registry és MCP tool registry
- Dashboard navigation és API service réteg

## Megjegyzés

Ez a fázis a dokumentum teljes korai architekturális részének (service mesh, remote console, MCP routing, PAIOS integráció) első gyakorlati lecsapódása.
