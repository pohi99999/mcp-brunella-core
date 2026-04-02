# Spec: Brunella Core Stabilization

## Track ID

`brunella_core_stabilization_20260402`

## Háttér

Az aktuális fő kockázat nem újabb agent-képesség hiánya, hanem a Brunella fő vezénylő rétegének instabilitása. Az `orchestrator.log` több alkalommal `JavaScript heap out of memory` összeomlást mutatott, miközben a stable runtime jelenleg még erősen fejlesztői indítási mintákra támaszkodik.

## Cél

1. A **Brunella Core** legyen az első számú, stabil control plane.
2. A dashboard **stable módban** Node-ból menjen, ne külön Vite dev szerverből.
3. A Python alrendszer külön runtime maradjon, de egységes supervision és health modell alatt.
4. A runtime host-native supervisor alá kerüljön:
   - Windows: **Windows Service**
   - Linux: **systemd**
   - hordozható / staging: **Docker Compose**
5. Az `inditas.bat` maradjon meg egyetlen kézi belépési pontnak, de ne az tartsa életben a rendszert.

## Scope

- Node runtime stabilizáció és memória/OOM hardening
- stable dashboard serving modell
- Node + Python supervision célarchitektúra
- egységes healthcheck és recovery elvek
- `inditas.bat` szerepének újradefiniálása
- operációs célminta Windows + Linux + staging környezetre

## Kimenetek

- Brunella Core stable mode definíció
- Node + Python supervision terv
- UI buildelt kiszolgálás szabványosítása
- memory/OOM hardening követelménylista
- egységes healthcheck és recovery viselkedés
- implementációs sorrend és rollout terv

## Nem része ennek a fázisnak

- Brunella identity újrapozicionálása mint rendszerpersona
- Project Maintainer megvalósítás
- reflection loop aktiválás
- Zero-Prompt → ephemeral trigger bridge
- federation további bővítése

## Acceptance kritériumok

- A stable runtime modell egyértelműen különválik a fejlesztői indítási modelltől.
- A dashboard stable kiszolgálása a Node által buildelt assetekre támaszkodik.
- A Node és Python supervision modell mind Windows, mind Linux célokra definiált.
- Az `inditas.bat` kézi fallback szerepe dokumentált, de nem elsődleges uptime-megoldásként.
- A fő OOM / restart fájdalompontok és kezelésük explicit rögzítve vannak.

## Függőségek

- `src/server/web.ts` statikus asset serving
- `package.json` build és UI build scriptek
- runtime logok (`orchestrator.log`, `startup.log`, `node-server.log`)
- meglévő startup script-ek és supervision fájlok (`inditas.bat`, `ecosystem.config.cjs`)

## Megjegyzés

Ez a track az egész Brunella-roadmap alaprétege. Minden további autonóm, tanuló és proaktív réteg erre a stabil vezénylő magra épül.
