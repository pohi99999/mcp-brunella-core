# Brunella Agent System (BAS)

**Verzió:** 2.1.0 | **Utolsó frissítés:** 2026-02-05

AI multi-agent rendszer szoftverfejlesztés automatizálására lokális LLM-ekkel (Ollama), MCP protokollal és hibrid Node.js/Python architektúrával.

---

# ⚠️ AI ÜGYNÖKÖK - OLVASD EL ELŐSZÖR!

**Ha AI ügynökként dolgozol (Claude, Gemini, Cursor, Copilot, stb.), ez a szekció KÖTELEZŐ!**

## 1. Első Lépések - MINDIG

```
1. Olvasd be: .ai/FOSZAL.md          → Mi történt legutóbb?
2. Olvasd be: conductor/tracks.md    → Min dolgozunk?
3. Olvasd be: .ai/<te_neved>.md      → Van félbehagyott feladatod?
```

## 2. VÉDETT FÁJLOK - SOHA NE TÖRÖLD!

| Fájl | Miért kritikus |
|------|----------------|
| `.env` | API kulcsok, titkos konfigurációk |
| `package.json` | Projekt definíció, függőségek |
| `src/agents/*.ts` | Core ügynökök (OrchestratorAgent, EvaluatorAgent, stb.) |
| `src/agents/types.ts` | IAgent interfész |
| `src/agents/registry.json` | Ügynök regisztráció |
| `src/server/web.ts` | Web szerver |
| `src/server/registry.ts` | Tool regisztráció |
| `src/cli.ts` | CLI belépési pont |
| `src/core/llm_client.ts` | LLM kapcsolat |
| `src/index.ts` | Fő belépési pont |

**Ha "takarítani" akarsz vagy "tisztítani" a projektet - KÉRDEZZ ELŐSZÖR!**

## 3. Munkamenet Szabályok

### Munka ELŐTT:
```bash
git status              # Nézd meg mi változott
npm run build           # Ellenőrizd, hogy buildel
npm test                # Ellenőrizd, hogy tesztek futnak
```

### Munka UTÁN:
1. **Frissítsd a naplódat:** `.ai/<te_neved>.md`
2. **Formátum:**
   ```markdown
   ### YYYY-MM-DD HH:MM - Rövid cím

   **Feladat:** Mit csináltál
   **Fájlok:** érintett fájlok listája
   **Státusz:** ✅ Befejezve / ⏳ Folyamatban / ❌ Sikertelen
   **Megjegyzés:** Fontos info a következő ügynöknek
   ```
3. **Futtasd:** `python scripts/sync_foszal.py`

### Ügynök Váltáskor:
- **Commitolj** mielőtt abbahagyod (ha működő állapotban van)
- **Írd le** mi maradt félbe a naplódban
- **NE hagyj** törött build-et vagy failing teszteket

## 4. Amit SZABAD és amit NEM

| ✅ SZABAD | ❌ TILOS |
|-----------|----------|
| Új fájl létrehozása | Meglévő core fájl törlése |
| Kód módosítása | `.env` commitolása git-be |
| Új ügynök hozzáadása | `package.json` törlése |
| Bug javítása | "Takarítás" kérdés nélkül |
| Dokumentáció frissítése | `node_modules` commitolása |
| Teszt írása | Működő kód törlése |

## 5. Ha Problémába Ütközöl

1. **Build hiba:** `rmdir /s /q build && npm run build`
2. **Hiányzó fájl:** `git checkout HEAD -- <fájl>` (visszaállítás git-ből)
3. **Teszt fail:** Javítsd, NE töröld a tesztet
4. **Nem tudod mi történt:** Olvasd el `.ai/FOSZAL.md`

---

# Projekt Dokumentáció

## Gyors Indítás

```powershell
# Teljes rendszer indítás (AJÁNLOTT)
start-full.bat

# VAGY manuálisan:
npm install && npm run build
npm run dev          # Backend (:3000)
npm run dev:ui       # Dashboard (:5173)
```

## Fontos Fájlok Navigáció

| Mit keresel? | Hol találod? |
|--------------|--------------|
| AI ügynök szabályok | Ez a fájl (fent) |
| Claude specifikus instrukciók | `CLAUDE.md` |
| Gemini specifikus instrukciók | `GEMINI.md` |
| Copilot instrukciók | `.github/copilot-instructions.md` |
| Aktív fejlesztési szálak | `conductor/tracks.md` |
| Fejlesztési protokollok | `conductor/workflow.md` |
| Tech stack | `conductor/tech-stack.md` |
| Ügynök naplók | `.ai/` mappa |
| MCP eszközök listája | `Toolskeszlet.md` |

## Architektúra

```
┌─────────────────────────────────────────────────────────────────┐
│                    BRUNELLA AGENT SYSTEM                         │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │ Ollama   │  │ Express  │  │ FastAPI  │  │ React    │        │
│  │ :11434   │  │ :3000    │  │ :8000    │  │ :5173    │        │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘        │
│       │             │             │             │               │
│       └─────────────┴──────┬──────┴─────────────┘               │
│                            │                                     │
│              ┌─────────────┴─────────────┐                      │
│              │     OrchestratorAgent     │                      │
│              │   (Központi Delegáló)     │                      │
│              └─────────────┬─────────────┘                      │
│    ┌───────────┬───────────┼───────────┬───────────┐           │
│    ▼           ▼           ▼           ▼           ▼           │
│ Developer  Evaluator  Researcher  DataScientist  EdgeProxy     │
└─────────────────────────────────────────────────────────────────┘
```

## Könyvtárstruktúra

```
mcp-brunella-core/
├── .ai/                    # 🔴 AI ügynök koordináció
│   ├── FOSZAL.md          # Egyesített napló (OLVASD ELŐSZÖR!)
│   ├── claude.md          # Claude Code napló
│   ├── gemini.md          # Gemini CLI napló
│   ├── cursor.md          # Cursor AI napló
│   └── copilot.md         # GitHub Copilot napló
│
├── conductor/              # 📋 Projekt menedzsment
│   ├── tracks.md          # Aktív fejlesztési szálak
│   ├── workflow.md        # Data Flywheel, Phoenix Protocol
│   └── tracks/            # Részletes track dokumentumok
│
├── src/                    # 💻 TypeScript forráskód
│   ├── agents/            # AI ügynökök (NE TÖRÖLD!)
│   ├── tools/             # MCP eszközök
│   ├── server/            # Express + Socket.IO
│   ├── dashboard/         # React UI (Vite)
│   └── cli.ts             # CLI belépési pont
│
├── myai/                   # 🐍 Python alrendszer
│   ├── server.py          # FastAPI szerver (:8000)
│   ├── browser_worker.py  # Playwright automatizálás
│   └── refiner_logic.py   # Adat tisztítás
│
├── .env                    # 🔐 TITKOS - soha ne commitold!
├── package.json           # 📦 NE TÖRÖLD!
└── README.md              # 📖 Ez a fájl
```

## Parancsok

### Indítás
```bash
start-full.bat             # Teljes rendszer (ajánlott)
npm run dev                # Backend (:3000)
npm run dev:ui             # Dashboard (:5173)
```

### Build & Teszt
```bash
npm run build              # TypeScript fordítás
npm test                   # Vitest tesztek
npm run test:watch         # Teszt watch mód
```

### CLI
```bash
brunella doctor            # Rendszer diagnosztika
brunella chat              # Ollama chat
brunella agents            # Ügynökök listázása
brunella tools             # MCP eszközök
```

### Szinkronizálás
```bash
python scripts/sync_foszal.py    # FŐSZÁL frissítés
```

## Fejlesztési Szabályok

### 0-Hiba Stratégia
- `npm run build` MUSZÁJ sikeresnek lennie
- `npm test` MUSZÁJ átmennie
- Napló frissítés KÖTELEZŐ munkamenet végén

### Track Rendszer
- Minden nagyobb fejlesztés = Track a `conductor/tracks/` mappában
- Ne szerkeszd kézzel a `conductor/tracks.md` fájlt (auto-generált)
- Track státuszok: `PROPOSED → ACTIVE → TESTING → COMPLETED`

### Kód Konvenciók
- ESM importok `.js` kiterjesztéssel: `import { foo } from './bar.js'`
- `logger.ts` használata `console.log` helyett
- `any` típus kerülése, `unknown` használata ha szükséges

## Hibaelhárítás

| Probléma | Megoldás |
|----------|----------|
| Ollama nem válaszol | `ollama serve` futtatása |
| Port 3000 foglalt | `npm run dev:alt` (port 3001) |
| Python import hiba | `cd myai && uv sync` |
| Build hiba | `rmdir /s /q build && npm run build` |
| Hiányzó fájl | `git checkout HEAD -- <fájl>` |
| .env hiányzik | Kérd el Pétertől a kulcsokat |

## API Végpontok

| Végpont | Leírás |
|---------|--------|
| `GET /api/health` | Rendszer állapot |
| `GET /api/agents` | Ügynökök listája |
| `POST /api/agents/:name/execute` | Ügynök futtatás |
| `GET /api/tools` | MCP eszközök |
| `GET /api-docs` | Swagger UI |

---

*Projekt tulajdonos: Péter (kreatív, nem programozó)*
*Fejlesztés: AI ügynökökkel (Claude, Gemini, Cursor, Copilot)*
*Ha kérdésed van, kérdezz - ne találgass!*
