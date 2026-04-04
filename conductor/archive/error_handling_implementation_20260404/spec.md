# Specifikáció: Error Handling Implementation

## 🎯 Célkitűzés
A `error_handling_standard_20260404` tervezési döntéseinek végrehajtása a maradék magas prioritású kódszakaszokon, kezdve a CLI felületekkel.

## Scope
- Phase 1: `src/cli.ts`, `src/cli-jules-interactive.ts`, `src/cli/*.ts` command fájlok.
- Phase 2: `src/tools/*` külső integrációk és shell bridge-ek.
- Phase 3: `src/server/*` core és legacy control-surface modulok.
- Phase 4: `src/agents/*` és végső verifikáció.

## ✅ Elvárt állapot
- A scoped fájlokban `catch (error: unknown)` és `ensureError(error)` használat.
- A scoped fájlokban nincs silent `catch {}`.
- A felhasználó felé menő hibák maradnak olvashatók, az exit kódok nem változnak.
- A build és a releváns tesztek zöldek.

## 🛠️ Korlátok
- A már megtisztított `src/server/routes/` nem kerül újranyitásra, hacsak egy közvetlen függőség nem kívánja meg.
- A Python alrendszer külön track marad, ha szükséges.
