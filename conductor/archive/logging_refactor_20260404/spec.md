# Specifikáció: Logging Audit

## 🎯 Célkitűzés
A Brunella Agent System kódbázisában található összes `console.log` hívás eliminálása és lecserélése a projekt standard `utils/logger.js` megoldására. Ez biztosítja a naplózás egységességét, a Dashboard Observability panelének helyes működését és a fájl-alapú auditálhatóságot.

## ⚠️ Jelenlegi Probléma
- Több mint 100 `console.log` találat a `src/` mappában.
- A naplók megkerülik a telemetriai rendszert.
- Zajos kimenet a CLI-ben, ami nem követi a Brunella logging formátumot.

## ✅ Elvárt Állapot
- 0 darab `console.log` hívás a production kódban (kivéve a `utils/logger.ts` magját).
- Minden napló a `logInfo`, `logError`, `logWarn`, vagy `logDebug` függvényeket használja.
- Minden napló tartalmazza a forrás modult/agentet.

## 🛠️ Technikai Követelmények
- Használd a `src/utils/logger.ts` exportált függvényeit.
- ESM import konvenció betartása (`.js` kiterjesztés).
- Dashboard real-time logok integrációjának ellenőrzése.
