# Brunella Agent System — Projekt Konvenciók
<!-- Ez a fájl a Continual Learning rendszer human-readable rétege. -->
<!-- A hook automatikusan injektálja ezt a munkamenet elején. -->
<!-- Frissítéshez add hozzá az új sort, ne töröld a régieket. -->

## 🔴 KRITIKUS — BUILD ELBUKIK nélküle

- **ESM .js kiterjesztés KÖTELEZŐ**: `import { foo } from './bar.js'` — extensionless import = BUILD FAIL
- **console.log TILOS**: ESLint `no-console: warn` blokkolja. Használd: `logInfo()`, `logError()`, `setAgentStatus()` agent kódban; `Logger` osztály szerver/utility kódban
- **`any` TILOS**: használj `unknown` + type guard-ot
- **Dashboard KÜLÖN build**: `src/dashboard/` ki van zárva a fő `tsconfig.json`-ból → `npm run build:ui` kell
- **Vitest, NEM Jest**: `vi.fn()`, `vi.mock()`, `vi.spyOn()` — soha `jest.*`

## 🟠 AGENT KÓDOLÁSI SZABÁLYOK

- **BaseAgent finally AUTOMATIKUS**: `BaseAgent`-et kiterjesztő ágenseknél NINCS szükség manuális `setAgentStatus(name, 'idle')`-re — a `BaseAgent.execute()` csinálja
- **IAgent közvetlen implementációnál KÖTELEZŐ a finally**: ha NEM extends BaseAgent, a `setAgentStatus(this.name, 'idle')` MINDIG a `finally` blokkban legyen
- **AgentResponse interface**: `{ status: 'success' | 'error' | 'delegated', data?, error? }`
- **Új agent regisztrálása**: `src/agents/registry.json` + `src/server/registry.ts` registerAllTools()

## 🟡 RENDSZER INTEGRÁCIÓS SZABÁLYOK

- **Új feature cross-surface ellenőrzőlista**:
  1. Route: `src/server/routes/index.ts` — lazy() proxyn keresztül
  2. Dashboard panel: `src/dashboard/lib/navigation.tsx` NavigationRegistry
  3. CLI parancs: `src/cli.ts` vagy `src/cli/*Commands.ts` (Magyar, Inquirer.js)
  4. Agent: `src/agents/registry.json`
- **Route mount**: MINDIG `src/server/routes/index.ts`-be, soha nincs közvetlen import `web.ts`-ben
- **`GITHUB_PAT` preferált**: GitHub Models hitelesítéshez `GITHUB_PAT` > `GITHUB_TOKEN`

## 🔵 PYTHON ALRENDSZER (myai/)

- **Python 3.12+ és uv**: `cd myai && uv sync` — pip nem használandó
- **Windows Unicode**: emoji-t NE használj logban → `[OK]` / `[AI]` ASCII (UnicodeEncodeError!)
- **LanceDB opcionális import**: `try: import lancedb; HAS_LANCEDB = True except: HAS_LANCEDB = False`
- **Pydantic modellek kötelezők**: `myai/pydantic_models.py` — nyers dict nem elfogadható

## 🟢 CONDUCTOR / TRACK RENDSZER

- **tracks.md NE szerkeszd kézzel**: `npm exec -- brunella conductor rescan` generálja meta.json-ökből
- **Track archiválás folyamata**: meta.json `status: "archived"` → mappa átmozgatás `conductor/archive/` → conductor rescan
- **meta.json kötelező minden trackhez**: nélküle a Track State Manager nem látja
- **Track státusz sorrend**: PROPOSED → ACTIVE → TESTING → COMPLETED → ARCHIVED

## ⚙️ SCHEDULER / CRON

- **cron-parser v5 API**: `CronExpressionParser.parse()` — `parseExpression()` ELAVULT, nem működik
- **Ütemezett feladatok**: `src/server/schedulers/scheduledTasksRunner.ts` — ide kell az új cron job, nem párhuzamos mechanizmus

## 🧪 TESZTEK

- **Fake timers + waitFor deadlock**: `vi.useFakeTimers()` + `waitFor()` = HANG. Helyette: `vi.spyOn(globalThis, "setInterval")` assertion
- **React import test/ könyvtárban**: `import React from "react"` ELSŐ sor kötelező a `test/` alatti fájlokban (nem automatikus JSX transform)
- **Timeout**: 15 másodperc default, `fileParallelism: false`

## 📦 RUNTIME / MEMÓRIA

- **Memory contract env vars**: `BRUNELLA_NODE_MAX_OLD_SPACE_MBs`, `BRUNELLA_RUNTIME_MEMORY_LIMIT_MB`, `BRUNELLA_RUNTIME_RESTART_THRESHOLD_MB`
- **UI statikus hosting**: `build/public` — `npm run build:ui` ide írja a dashboardot, Node server innen tálalja

## 📝 TASK PERSISTENCIA

- **tasks.db task_kind mező**: `direct` vs `queued` — AgentManager csak `queued` típusú pending/running/paused taskokat hydratál újra init-kor
