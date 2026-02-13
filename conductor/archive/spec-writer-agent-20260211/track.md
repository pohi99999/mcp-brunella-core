# Track: SpecWriter Agent (Ötlet → Track Generátor)

**Status:** ✅ COMPLETED
**Priority:** P0
**Complexity:** MEDIUM
**Created:** 2026-02-11
**Completed:** 2026-02-13
**Owner:** Claude

## 🎯 Cél

Automatizált track generálás kreatív ötletekből professzionális specifikációvá és implementációs tervvé. Az ügynök a user ötletét elemzi, követelményeket von ki, professzionális promptot generál, és teljes track.md-t hoz létre a conductor rendszerhez.

## 📖 User Story

**As a** projekt owner
**I want** kreatív ötleteimet gyorsan track-ekké alakítani
**So that** ne kelljen manuálisan specifikációkat írnom és a fejlesztés azonnal kezdődhessen strukturáltan.

## ✅ Acceptance Criteria

- [x] Az ügynök fogad egy szöveges ötletet és elemzi a követelményeket
- [x] Automatikusan generál professzionális promptot az implementációhoz
- [x] Létrehoz teljes track.md fájlt a conductor/tracks/ mappában
- [x] Regisztrálja a track-et a conductor/tracks.md-ben
- [x] **Dashboard integráció:** Track generáló UI komponens
- [x] **CLI integráció:** Magyar menüvezérelt track generálás
- [x] Minden generált track tartalmazza a Dashboard + CLI integráció checklist-et

## 🔧 Technikai Követelmények

### Agent Implementáció (`src/agents/SpecWriterAgent.ts`)

1. **IAgent interface implementálás**
   - `name = "SpecWriter"`
   - `role = "Requirements Engineer & Prompt Architect"`
   - `capabilities = ["requirement_analysis", "prompt_engineering", "track_generation"]`

2. **Core funkciók:**

   ```typescript
   async analyzeIdea(idea: string): Promise<Requirements>
   async generatePrompt(requirements: Requirements): Promise<string>
   async createTrack(requirements: Requirements, prompt: string): Promise<string>
   async registerTrack(trackPath: string): Promise<void>
   ```

3. **LLM integráció:**
   - Ollama API használat (qwen2.5-coder:latest)
   - Strukturált JSON response parsing
   - Error handling + retry mechanizmus

### Dashboard Integráció (`src/dashboard/components/dashboard/TrackGenerator.tsx`)

1. **UI Komponens:**
   - Card layout (Radix UI)
   - Textarea input (multi-line ötlet beírás)
   - "Track Generálása" gomb
   - Progress indicator (generálás közben)
   - Success/Error toast notification

2. **Real-time feedback:**
   - Streaming status updates (WebSocket)
   - Generated requirements preview
   - Track file path megjelenítés
   - "Megnyitás" link → Track detail view

3. **Integráció pontok:**
   - POST /api/agents/specwriter/execute
   - WebSocket /ws/agent-status
   - Track list refresh trigger

### Track Kezelés Menü

```text
═══════════════════════════════════════
   BRUNELLA CONDUCTOR - TRACK KEZELÉS
═══════════════════════════════════════

1. 🎨 Új track generálása ötletből
2. 📊 Track státusz megtekintése
3. 📚 Összes track listázása
4. ✏️  Track szerkesztése
5. 🔙 Vissza a főmenübe

Válassz (1-5): _
```

**Menü flow:**

```text
1 választása után:
╔════════════════════════════════════════╗
║   ÚJ TRACK GENERÁLÁSA ÖTLETBŐL         ║
╚════════════════════════════════════════╝

Írd le az ötletedet (többsoros, ENTER ENTER befejez):
> [User input...]
> [User input...]
>

⏳ Elemzés folyamatban...
✅ Követelmények kibontva
✅ Prompt generálva
✅ Track létrehozva: conductor/tracks/my-feature-20260211/track.md

📋 Track összefoglaló:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Cím: My Feature
Prioritás: P1
Komplexitás: MEDIUM
Fájl: conductor/tracks/my-feature-20260211/track.md
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Mit szeretnél csinálni?
1. Megnyitás szövegszerkesztőben
2. Track státusz megtekintése
3. Vissza a főmenübe

Válassz (1-3): _
```

### Backend Routes (`src/server/tracksRoutes.ts`)

```typescript
POST   /api/tracks/generate        // Track generálás ötletből
GET    /api/tracks                 // Összes track listázása
GET    /api/tracks/:name           // Track részletek
PATCH  /api/tracks/:name/status    // Track státusz frissítés
DELETE /api/tracks/:name           // Track törlés
```

## 📦 Dependencies

- Nincs új dependency (meglévő Ollama API + TypeScript)

## ⚠️ Risks

1. **LLM response parsing hiba:** Strukturálatlan vagy hiányos JSON
   - **Mitigation:** Retry mechanizmus + fallback default template
2. **Track név ütközés:** Már létező track név generálás
   - **Mitigation:** Timestamp suffix + uniqueness check
3. **File system hibák:** Permission denied vagy disk full
   - **Mitigation:** Try-catch + user-friendly error message

## 📋 Implementation Plan

### Phase 1: Agent Core ✅

- [x] IAgent interface implementálás (src/agents/spec-writer.ts)
- [x] Requirement extraction / track generálás (3-stage pipeline)
- [x] createTrack() / track.md template (EPP v2)
- [x] registerTrack() metódus (tracks.md automatikus update) — opcionális, eldöntendő
- [x] Unit tesztek (`test/SpecWriterAgent.test.ts`)
- [x] Agent regisztráció (`src/agents/registry.json`)

### Phase 2: Dashboard Integration 🎨

- [x] TrackGenerator komponens létrehozása
- [x] UI layout (Card + Textarea + Button)
- [x] API integráció (POST /api/agents/specwriter/execute)
- [x] Real-time status updates (WebSocket)
- [x] Success/Error handling (toast notifications)
- [x] Track list refresh trigger
- [x] Dashboard route regisztráció (src/dashboard/routes.tsx)
- [x] Component tesztek

### Phase 3: CLI Integration 🖥️

- [x] Track parancsok (magyar) (`src/cli/tracksCommands.ts`)
- [x] Inquirer.js vagy prompts.js integráció (menü kezelés)
- [x] Track generálás flow
- [x] Multi-line input handling
- [x] Progress indicator (loading spinner)
- [x] Success summary display
- [x] CLI command regisztráció (src/cli.ts)

### Phase 4: Backend Routes 🔌

- [x] Express routes létrehozása (`src/server/tracksRoutes.ts`)
- [x] POST /api/v1/tracks/generate handler
- [x] GET /api/v1/tracks handler
- [x] GET /api/v1/tracks/:trackId handler
- [x] API tesztek (dedikált route tesztek) — opcionális bővítés

### Phase 5: Testing & Validation ✅

- [x] Manual testing (CLI flow)
- [x] Manual testing (Dashboard flow)
- [x] Integration teszt (teljes flow end-to-end)
- [x] npm test - minden teszt zöld
- [x] Acceptance criteria verify

### Phase 6: Documentation & Deployment 📝

- [x] README.md frissítés (új ügynök dokumentálása)
- [x] .ai/claude.md frissítés (munkamenet napló)
- [x] python scripts/sync_foszal.py futtatás
- [x] GitHub commit: "feat(spec-writer): Add SpecWriter agent with Dashboard + CLI integration"
- [x] Track státusz: COMPLETED

## 📝 Implementation Prompt

```text
Implementáld a SpecWriterAgent-et a következő követelmények szerint:

**Agent funkciók:**
1. Fogad egy szöveges ötletet és elemzi LLM-mel (Ollama API)
2. Kibontja a követelményeket JSON formátumba
3. Generál professzionális implementációs promptot
4. Létrehoz teljes track.md fájlt a conductor/tracks/ mappában
5. Regisztrálja a track-et a conductor/tracks.md-ben

**Dashboard integráció:**
- TrackGenerator.tsx komponens (Radix UI + Tailwind)
- Real-time WebSocket feedback
- Success/Error toast notifications

**CLI integráció:**
- Magyar menüvezérelt interface (inquirer.js)
- Multi-line input support
- Progress indicators
- Summary display

**Technikai stack:**
- TypeScript strict mode
- ESM imports (.js extension)
- Logger használat (logInfo, logError)
- Error handling minden async műveletnél
- Unit tesztek (Vitest)

**Output:**
- src/agents/spec-writer.ts (teljes implementáció)
- src/dashboard/components/TrackGenerator.tsx
- src/cli-commands/tracks-hu.ts
- src/server/routes/tracks.ts
- test/agents/spec-writer.test.ts
- Frissített registry.json, routes.tsx, cli.ts

**Követelmény:** Minden funkció működjön Dashboard-ról ÉS CLI-ből is!
```

## 🐛 Bugs Fixed During Development

### Fixes

1. **SpecWriterAgent Registration Failure**: Added missing `export default SpecWriterAgent;` to ensure compatibility with `AgentManager`'s dynamic loader.
2. **Track List Registry Sync**: Ensured `registry.json` is synced to `build/` folder for proper CLI discovery.
3. **Markdown Linting**: Fixed fenced code blocks and header formatting in track files.

---

## 📊 Progress Tracking

**Created:** 2026-02-11
**Started:** TBD
**Completed:** TBD
**Total Time:** TBD

## 📌 Notes

- Ez lesz az első track ami saját magát használja (meta! 😄)
- Dashboard + CLI integráció most példa a többi track számára
- Magyar CLI menürendszer template a későbbi parancsokhoz
- Track generálás után MINDEN új feature ezt használja
