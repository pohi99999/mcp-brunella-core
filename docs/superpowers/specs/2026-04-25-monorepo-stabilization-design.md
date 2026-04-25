# Specifikáció: Monorepo Stabilizáció és Path Drift Javítás (2026-04-25)

## 1. Célkitűzés
A Brunella Agent System monorepo struktúrájában tapasztalható útvonal-elcsúszások (path drift) megszüntetése, a rendszer hordozhatóságának javítása, valamint a teljes build és teszt folyamat stabilizálása a GitHub main ággal való szinkronizáció előtt.

## 2. Érintett területek
- **MCP Konfiguráció:** `mcp_servers.json` abszolút útvonalainak kiváltása dinamikus feloldással.
- **Útvonal Feloldás:** Központi `PathResolver` bevezetése a `process.cwd()` helyett.
- **Ügynök Betöltés:** Az `AgentManager.ts` és a dinamikus TOML betöltő logikájának javítása.
- **Dashboard:** Böngésző-biztos importok ellenőrzése és a `vite.config.ts` alias-ok szinkronizálása.
- **Indító Scriptek:** `dashboard.bat` és `ops/scripts/` stabilizálása.
- **Dokumentáció:** `README.md`, `.ai/copilot.md` és Conductor szinkron.

## 3. Tervezett változtatások

### 3.1. Útvonal Kezelés (Path Resolver)
Létrehozunk egy `packages/utils/pathResolver.ts` modult:
```typescript
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Kiszámítjuk a gyökeret a csomag helyzetéből (packages/utils/...)
export const PROJECT_ROOT = path.resolve(__dirname, '../../');
export const resolvePath = (relative: string) => path.resolve(PROJECT_ROOT, relative);
```

### 3.2. MCP Konfiguráció Dinamizálása
A `mcp_servers.json`-ben bevezetjük a `{{PROJECT_ROOT}}` placeholder-t, amit a betöltő kód futásidőben cserél le az aktuális abszolút útra.

### 3.3. Dashboard Alias Szinkron
A `vite.config.ts` alias-ait hozzáigazítjuk a gyökér `package.json` `imports` mezőjéhez, biztosítva, hogy a `@packages/*` feloldás konzisztens legyen a build és a dev környezetben is.

## 4. Validációs Terv
1. **Surgical Fixes:** A fenti változtatások alkalmazása.
2. **Build Test:** `npm run build:stable` futtatása.
3. **Fast Audit:** `npm run test:fast` futtatása (100% pass elvárás).
4. **Integration Check:** `dashboard.bat` indítása és a CLI/UI kapcsolat ellenőrzése.

## 5. Dokumentáció és Szinkron
1. `README.md` frissítése az új futtatási elvekkel.
2. `.ai/copilot.md` naplózás.
3. `npm run sync:docs` és `sync:doc-stats` futtatása.
4. Git commit és push a GitHub main ágra.

## 6. Kizárások / Korlátozások
- A shell nem kerül újraindításra a munkamenet folytonossága miatt.
- Csak a stabilizációhoz szükséges refaktorálásokat végezzük el, új funkciókat nem adunk hozzá ebben a körben.
