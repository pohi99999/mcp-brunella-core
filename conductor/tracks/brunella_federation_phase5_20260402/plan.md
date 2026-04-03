# Federation Phase 5 - execute hardening

## Elvegzett szelet

1. Signed, fail-closed auth gate a `/api/v1/federation/execute` es `/api/v1/federation/capabilities/execute` route-okon.
2. Minimalis current/next runtime key foundation a trust registryben.
3. Inbound federation execute lokalis capability vegrehajtasra szukitese.
4. Outbound federation signing helyreallitasa a valos lokalis sender peer ID-val.
5. `FederatedAgentManager` payload alignment az `agent_execute` capability szerzodeshez.
6. `executeLocalTool()` rekurziv fallback megszuntetese fail-fast hibara.
7. `/api/v1/federation/agents` discovery route visszaepitese a mesh sync surface-hez.
8. Outbound current -> next runtime key retry a signed federation HTTP hivasokra, ha a remote peer a jelenlegi target key-t auth hibaval elutasitja.
9. Runtime key lifecycle operator surface:
   - trust registry `stageNextRuntimeKey()` + `promoteNextRuntimeKey()`,
   - federation route-ok a stage/promote muveletekre,
   - CLI + dashboard operator felulet a key lifecycle-hoz.
10. Revoke propagation / runtime invalidation:
   - revoked peerhez tartozo manifest cache purge Phoenix event alapon,
   - revoked peer agentjeinek kilovese a federated agent registrybol,
   - explicit fail-closed trust guard a remote execute elott stale bejegyzes ellen.
11. Legacy HMAC fallback teljes kivezetese:
   - federation signer/verifier util asymmetric-only szerzodesre egyszerusitve,
   - `hmac-sha256-v1` es `allowLegacyHmacFallback` eltavolitva a runtime API-bol,
   - auth regresszio asymmetric-only modra frissitve.
12. Signed federation discovery hardening:
    - `/api/v1/federation/agents` discovery route signed/trusted federation auth moge kerult,
    - a `FederatedAgentManager.syncFromPeer()` mar signed GET federation discoveryt hasznal,
    - a sync a trust registry endpoint metadatajara es runtime key bindingjaira kotve fut.
13. Federation operator mutation route auth hardening:
    - a `register` / `revoke` / `runtime-keys/stage` / `runtime-keys/promote` route-ok loopback vagy remote bearer auth moge kerultek,
    - a helyi dashboard/CLI operator flow megmaradt, de tavoli anonymous hivas 401-re bukik,
    - route regressziok explicit deny/allow szerzodest fednek.
14. Federation operator evidence / rollout evidence surface:
     - uj `GET /api/v1/federation/evidence` snapshot route loopback vagy remote bearer auth mogott,
     - kozos federation read model a Phoenix federation eventek es audit log osszefuzesere,
     - CLI `brunella federation evidence` operator journal,
     - dashboard FederationCenter dark ops journal + rollout matrix.
15. Capability manifest signing contract hardening:
    - `MANIFEST_SIGNING_SECRET` default shared-secret fallback eltavolitva; minimum 32 karakteres env secret kotelezo,
    - manifest issue fail-closed config hibaval all meg, ha a signing secret hianyzik vagy rovid,
    - `verify()` config hiba eseten fail-closed `invalid_signature`-re ter vissza, hogy a routing ne dobjon exceptiont,
    - a `/manifests/local`, `/manifests/peer/:peerId`, `/manifests/verify` route-ok loopback vagy remote bearer auth moge kerultek,
    - a local manifest route uj issue helyett visszaadja a meg letezo ervenyes manifestet,
    - a verify route Zod shape guardot kapott es invalid payloadra 400 + `invalid_signature` contractot ad,
    - a dashboard verify input kliensoldali size/shape guardot kapott,
    - `.env.example` es `SECURITY.md` dokumentalja a kotelezo manifest signing secretet.

## Jelenlegi allapot

- A federation execute ut signed + asymmetric-only + replay/trust enforced.
- A kuldo peer ID mar nem driftel a target peerre kimeno keresnel.
- A mesh manager mar ervenyes federation agent discovery endpointot olvas.
- A gateway es a federated agent remote execute kozos helperrel (`src/core/federation/remoteRequest.ts`) hajt vegre signed JSON hivasokat.
- Auth elutasitas (HTTP 401) eseten a kimeneti federation hivas automatikusan megprobalja a peer `next` runtime key bindingjat, mielott teljes hibara futna.
- A trust registry mar tudja a next runtime kulcs stage-eleset es a stage-elt kulcs promotalasat current allapotba.
- Van operator surface a lifecycle kezelesere:
  - REST: `/api/v1/federation/peers/:id/runtime-keys/stage` es `/promote`
  - CLI: `brunella federation stage-runtime-key` / `promote-runtime-key`
  - Dashboard: FederationCenter runtime key lifecycle kartya
- A revoke mar runtime invalidationt is csinal:
  - `phoenix:federation_peer_revoked` esemenyre a manifest cache kipucolja a revoke-olt peer dokumentumait,
  - a `FederatedAgentManager` eltavolitja a revoke-olt peer agentjeit,
  - a remote execute kuldes elott explicit trust-check fail-closed modon megallitja a stale peer hivasokat.
- A legacy federation HMAC fallback teljesen ki van vezetve:
  - a federation runtime signer/verifier mar csak `asymmetric-v1` schemet ismer,
  - nincs tobbe dev secret / env-flag alapú HMAC fallback ag,
  - a hianyzo signing material explicit fail-closed hibaval megall.
- A federation agent discovery mar nem fail-open:
  - a `/api/v1/federation/agents` route unsigned callernek 401-et ad,
  - csak signed, trusted federation peer olvashat agent inventoryt,
  - a `syncFromPeer()` a trusted peer endpointjat hasznalja, nem a mesh altal bemondott hostot.
- A federation operator mutation route-ok sem publikusak tobbe:
  - a register / revoke / stage / promote route-ok loopback vagy Bearer token authot kovetelnek,
  - a local operator surface-ek tovabbra is mukodnek,
  - a remote anonymous mutacio most mar middleware-szinten fail-closed.
- A federation operator evidence surface is kesz:
  - a runtime key lifecycle + revoke operator muveletek egy kozos audit/event read modelben latszanak,
  - REST: `GET /api/v1/federation/evidence`,
  - CLI: `brunella federation evidence`,
  - Dashboard: FederationCenter operator journal + rollout matrix.
- A capability manifest signing contract is fail-closed:
  - nincs publikus default manifest signing secret fallback,
  - invalid vagy hianyzo signing secret nem eredmenyez tobbe forgeable manifestet,
  - a manifest route-ok nem maradtak open operator/oracle surface-ek,
  - a gateway discovery config hiba eseten ures candidate listara zar vissza, nem exceptionre.
- Fokuszalt validacio zold:
  - `npm run build`
  - `npm run build:ui`
  - `npx vitest run test\federation\trustRegistry.test.ts test\federationRoutes.test.ts test\federationCommands.test.ts`
  - `npx vitest run --config vitest.dashboard.config.ts test\dashboard\components\FederationCenter.test.tsx`
  - `npx vitest run test\federation\capabilityManifest.test.ts test\federation\trustRegistry.test.ts test\federationRoutes.test.ts test\phase4_mesh.test.ts`
  - `npx vitest run test\federation\federationPeerAuth.test.ts`
  - `npx vitest run test\federationRoutes.test.ts test\phase4_mesh.test.ts`
  - `npx vitest run test\federationRoutes.test.ts`
  - `npx vitest run test\federation\capabilityManifest.test.ts test\federation\federatedGateway.test.ts test\federationRoutes.test.ts`
  - `npx vitest run --config vitest.dashboard.config.ts test\dashboard\components\FederationCenter.test.tsx`

## Hatralevo Phase 5 munka

1. Kritikus Phase 5 federation security gap jelenleg nincs nyitva; kovetkezo lepes mar kulon trackelt manifest algorithm / asymmetric migration lehet.
