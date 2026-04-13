# Specifikáció: Alaprendszer Stabilitás és Telemetria Bővítése

**ID:** `alaprendszer_stabilitas_telemetria_20260413`

## Áttekintés
Ez a fejlesztési szál (track) a BAS (Brunella Agent System) alaprendszerének stabilizálását, valamint a telemetriai és naplózási képességek bővítését célozza, hogy átfogóbb képet kapjunk az ügynökök belső állapotáról és a szolgáltatások elérhetőségéről. 

## Célok
- Rendszer szintű egészségügyi ellenőrzések (health checks) proaktív kiterjesztése.
- Bővített, kontextusfüggő hiba- és eseménynaplózás az ágensek működése során.
- A "Phoenix Protocol" hibatűrő és visszajelző képességének megerősítése az Orchestrator szintjén.
- A LangSmith nyomkövetéshez (tracing) részletesebb metaadatok csatolása az AI hívásokhoz.

## Kritériumok (DoD)
- [EPP v2] Működő telemetriai végpontok integrálása az Express.js háttérrendszerbe.
- [EPP v2] CLI integráció (pl. `brunella health` vagy `brunella stats` parancs kiegészítése strukturált outputtal).
- [EPP v2] Dashboard integráció (új vagy meglévő telemetria nézet bővítése a React UI-on).
- [QA] Minimum 80% kódfedettség az új modulokra, a `npm run test` hiba nélkül fut.
- [QA] `npm run build` tiszta futása garantált (nincs Typescript/ESLint hiba).