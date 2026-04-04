# Plan — Brunella Core Stabilization

1. Azonosítani a Node OOM és unstable runtime konkrét kiváltó okait az orchestrator és startup logok alapján.
2. Kialakítani a Brunella Core stable runtime modellt, ahol a Node a fő control plane, a Python külön runtime marad.
3. A dashboard stable kiszolgálását a buildelt `build/public` statikus assetekre szabványosítani, Vite dev szerver nélkül.
4. Host-native supervision modellt definiálni Windows (Windows Service), Linux (systemd) és hordozható/staging (Docker Compose) célokra.
5. Egységes healthcheck, restart és recovery viselkedést rögzíteni a Node + Python runtime számára.
6. Az `inditas.bat` szerepét egyetlen kézi belépési pontra szűkíteni, nem uptime-mechanizmusként használni.
7. A stable módhoz szükséges config, startup és operációs dokumentációs pontokat kijelölni.
8. Validációs és bevezetési checklistet készíteni a későbbi implementációhoz.

## 2026-04-02 - Első stabilizációs slice

- canonical stable start lánc bevezetve (`build:stable`, `start:stable`, `start:python:stable`)
- Node runtime readiness/liveness különválasztva (`/readyz`, `/livez`, `/api/health/live`, `/api/health/ready`)
- event bus startup-fatal SQLite binding hiba in-memory degradációra cserélve
- Docker/PM2 stable útvonal supervisor-barát healthcheckre és memória policy-ra igazítva
- Windows + Linux supervision assetek létrehozva (`scripts/supervisors/windows`, `scripts/supervisors/linux`)
- `inditas.bat` kanonikus stable kézi belépési pont lett, a `Inditsd_Brunellat_Stabil.bat` console fallback szerepet kapott

## 2026-04-02 - Második operátori slice

- runtime telemetria került a control-plane health felületekre (`/livez`, `/readyz`, `/api/health`, `/api/health/live`, `/api/health/ready`)
- új közös memória/heap helper készült (`src/utils/runtimeTelemetry.ts`), hogy az OOM nyomás már ne csak logból legyen látható
- a `scripts/health_check.ts` memória- és heap-nyomás figyelmeztetést ad stable operátori nézetben
- Windows és Linux supervision bővítve lett `status` és `uninstall` műveletekkel
- `README.md` és `package.json` már tartalmazza a stable service-ops parancsokat
- célzott build, health/API tesztek, célzott lint és teljes `npm run test:fast` sikeresen lefutott

## 2026-04-02 - Harmadik stabilizációs slice

- egységes runtime budget contract került bevezetésre a stable indítási utakhoz (`BRUNELLA_NODE_MAX_OLD_SPACE_SIZE`, `BRUNELLA_RUNTIME_MEMORY_LIMIT_MB`, `BRUNELLA_RUNTIME_RESTART_THRESHOLD_MB`)
- a `scripts/start-stable.mjs` már boot előtt validálja a heap/runtime envelope-ot és fail-fast leáll drift vagy érvénytelen konfiguráció esetén
- Docker / PM2 / Windows service / systemd ugyanarra a memória-contractra lett igazítva
- a runtime budget már megjelenik a health payloadokban és az operátori status script-ekben is
- új célzott teszt készült a launcher contract validációjára (`test/start_stable_contract.test.ts`)
- célzott build + Vitest kör és teljes `npm run test:fast` sikeresen lefutott

## 2026-04-02 - Negyedik stabilizációs slice

- cross-platform service rollout preflight készült (`scripts/service-preflight.mjs`), amely install előtt ellenőrzi a stable buildet, a dashboard buildet, a Python runtime jelölteket, a runner fájlokat és a `data` / `logs` írhatóságát
- a Windows és Linux service installerek már kötelezően meghívják ezt a preflight réteget rollout előtt
- a `package.json` új kanonikus belépési pontot kapott a host preflightre (`npm run services:preflight`)
- a `README.md` a stable supervision workflow részeként már dokumentálja az install előtti preflight lépést
- új célzott teszt került be a preflight contractra (`test/service_preflight.test.ts`)
- célzott lint + build + Vitest kör és teljes `npm run test:fast` sikeresen lefutott

## 2026-04-03 - Rendszerellenőrzés és gyors runtime stabilizáció

- teljes lokális runtime ellenőrzés lefutott a Brunella core, dashboard, Python és Ollama komponensekre
- a `src/server/toolRegistry.ts` rekurzív registry-import hurka megszűnt; emiatt a backend ismét stabilan válaszol a `3000`-es porton (`/ping`, `/readyz`)
- új regressziós teszt került be a tool metadata építésre (`test/toolRegistry.test.ts`)
- a Linux supervisor loader Windows checkout melletti CRLF hibája javítva lett (`.gitattributes`, `scripts/supervisors/linux/load-runtime-threshold-env.sh`)
- a gyors validáció zöld: `npm run test:fast` → `273 passed | 1 skipped`
- a Copilot napló és a FOSZÁL összefoglaló frissítve lett a rendszerellenőrzési kör eredményeivel
- a smoke kör tartalmilag lefutott, de a Windows oldali `UV_HANDLE_CLOSING` assertion és a `langflow` / `wab` degradált health külön utánkövetést igényel

## Következő fókusz

- a Python runtime/container hardening felhozatala a Node stable szintjére
- a Python runtime rollout és container security parity felhozatala a Node stable szintjére
- az új runtime contract alapján heap/OOM drift operátori megfigyelése stable üzemben
- a Windows oldali smoke/assertion zaj és a `langflow` / `wab` degradált health kivizsgálása

## Zárás

- A stable core runtime, supervision, startup, és health contract work lezárult.
- A fennmaradó Windows smoke/assertion és `langflow` / `wab` megfigyelések külön operational follow-upként kezelhetők, ezért ehhez a trackhez nem kell új fejlesztési tracket nyitni.
