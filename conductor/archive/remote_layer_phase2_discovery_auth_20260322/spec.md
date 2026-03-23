# Spec: Brunella Remote Layer — Fázis 2: Discovery, Capability & Auth

## Track ID

`remote_layer_phase2_discovery_auth_20260322`

## Forrás

- `f:\mcp-brunella-core\.worktrees\Brunella_superinnteligencia.md`
- Implementációs prompt: Fázis 2.
- Fő témák: MCP szerver autodiscovery, capability mapping, remote auth, SQLite session store, high-level remote actions, dashboard MCP/Device view.

## Cél

1. A remote réteg váljon hitelesített, capability-alapú rendszerré.
2. Az MCP Router kapjon valódi discovery + mapping képességet.
3. A remote sessionök kerüljenek perzisztens tárolóba.
4. PAIOS és külső kliensek számára legyen magasabb szintű action API.

## Scope

- `src/core/mcpDiscovery.ts`
- `src/core/mcpRouter.ts` bővítése capability mappinggel
- `src/security/remoteAuth.ts`
- `src/server/middleware/authRemote.ts`
- `src/core/remoteSessionStore.ts`
- `src/server/routes/remote_actions.ts`
- dashboard bővítés: MCP Servers + Devices nézet
- tesztek discovery, auth, capabilities és remote actions területekre

## Kimenetek

- Lokális MCP szerverek automatikus felismerése konfigurációból
- `GET /api/remote/capabilities`
- Token alapú hozzáférés a remote route-okhoz
- SQLite-ban tárolt RemoteSession lifecycle
- `POST /api/remote/actions/run` magas szintű action routinggal
- Dashboard MCP Servers / Device View panelek

## Nem része ennek a fázisnak

- Teljes mobilalkalmazás
- Voice input és push event ökoszisztéma
- Többnode-os mesh
- Offline delta sync

## Elfogadási kritériumok

- Discovery képes legalább a konfigurált lokális MCP szerverek beolvasására.
- Capability mapping endpoint valós adatot ad vissza.
- A remote route-ok token nélkül elutasítanak, tokennel működnek.
- A sessionök újraindítás után is lekérhetők a store-ból.
- A high-level action API legalább egy agent és egy device/capability útvonalat kezel.
- `npm run build` sikeres.
- `npm test` sikeres.

## Függőségek

- `remote_layer_phase1_foundation_20260322`

## Megjegyzés

Ez a fázis teszi a remote réteget valódi platformréteggé: discovery, auth és action abstraction nélkül a későbbi mobil/mesh irány nem skálázható.
