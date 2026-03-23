# Spec: Brunella Remote Layer — Fázis 4: Distributed Mesh & Edge Routing

## Track ID

`remote_layer_phase4_distributed_mesh_20260322`

## Forrás

- `f:\mcp-brunella-core\.worktrees\Brunella_superinnteligencia.md`
- Implementációs prompt: Fázis 4.
- Fő témák: Distributed MCP Mesh, Cloudflare edge routing, multi-device orchestration, offline-first sync, agent federation, Phoenix replication, auto-join.

## Cél

1. A Brunella legyen több node-on futtatható, capability-megosztó remote platform.
2. A route-olás váljon edge-aware és fallback-képes rendszerré.
3. A több eszközről csatlakozó sessionök konzisztensen osszák meg az állapotot.
4. A Phoenix protokoll terjedjen ki globális state replikációra és automatikus csatlakozásra.

## Scope

- `src/mesh/meshNode.ts`
- `src/mesh/meshManager.ts`
- `src/core/edgeRouter.ts`
- Cloudflare worker edge-router integráció
- `src/core/deviceOrchestrator.ts`
- `src/core/offlineSync.ts`
- `src/agents/federation/FederatedAgentManager.ts`
- `src/core/phoenixReplication.ts`
- `src/mesh/autoJoin.ts`
- dashboard panelek a mesh / edge / linked devices / sync / federation / replication területekre

## Kimenetek

- Node discovery és node-to-node kommunikációs alapréteg
- Edge-native routing fallbackkel
- Linked device session modell
- Offline delta sync és visszaszinkronizálási logika
- Federált agent futtatási alapok
- Phoenix replikációs modul és auto-join csatlakozási folyamat

## Nem része ennek a fázisnak

- Swarm intelligencia és adaptív workflow optimalizáció
- Evolutionary agent rendszer
- Planet-scale mesh és emergens szuperintelligencia

## Elfogadási kritériumok

- Több Brunella node képes egymás képességeit listázni és elérni.
- Edge routing hibatűrően képes másik node-ra terelni a kérést.
- Egy user több sessionje szinkronban tartható.
- Offline queue után a rendszer képes delta alapú visszajátszásra.
- Federált agent lista és legalább egy remote execution flow működik.
- `npm run build` sikeres.
- `npm test` sikeres.

## Függőségek

- `remote_layer_phase1_foundation_20260322`
- `remote_layer_phase2_discovery_auth_20260322`
- `remote_layer_phase3_mobile_voice_20260322`

## Megjegyzés

Ez a fázis a remote réteget lokális funkcióból elosztott rendszerré emeli; innen kezdődik a Brunella valódi hálózati skálázása.
