# Brunella Personal Assistant — Local Windows Blueprint

## Rövid válasz
A **legjobb megoldás** számodra nem egy teljesen új alkalmazás nulláról, hanem a meglévő **Brunella Agent System** termékesítése egy **Windows-first személyi AI asszisztenssé**.

## Miért ez a jó irány?
Mert a legfontosabb építőkockák már megvannak:
- **Tauri desktop shell** alap,
- **PAIOS / orchestrator chat** alap,
- **GitHub Models + Ollama** multi-provider routing,
- **HybridMemory + LanceDB** hosszú távú memória alap,
- **GraphRAG engine** és **ReflectionEngine**,
- **Robotkéz / computer-use** és **Windows bridge** automatizálási alapok,
- **RBAC + safe zones + approval** jellegű biztonsági alapok.

A hiány nem az alapplatform, hanem az, hogy ezek még nem egyetlen, koherens „személyi asszisztens termékké” vannak összehangolva.

---

## Ajánlott célarchitektúra

### 1. Desktop shell
- **Tauri**
- Modern magyar UI
- Egyetlen fő alkalmazás: **BAS Assistant**

### 2. Experience layer
- Chat
- Voice input/output
- Timeline / activity stream
- Automation panel
- Memory / preferences view

### 3. Orchestration layer
- `UniversalOrchestratorService`
- `AgentManager`
- `BifrostGateway`

### 4. Memory layer
- `HybridMemory` (LanceDB)
- `GraphRagEngine`
- `ReflectionEngine`

### 5. Action layer
- `Robotkez`
- `windows_bridge`
- Tool and workflow execution

### 6. Safety layer
- approvals
- RBAC
- safe zones
- audit trail

---

## A hangrendszerre javasolt irány

### Rövid távú MVP
- browser-alapú STT / átmeneti voice input
- meglévő TTS útvonal újrafelhasználása

### Középtávú ajánlott megoldás
- **faster-whisper** vagy hasonló local STT
- dedikált **női magyar TTS hang**
- push-to-talk + folyamatos hallgatás mód

### Fontos őszinte megjegyzés
A "női magyar hang" rész **nem tekinthető késznek** csak azért, mert van valamilyen TTS. Ezt külön kell minőségi szinten megoldani.

---

## Model-stratégia

### Ajánlott működés
- **Primary:** GitHub Models
- **Fallback / privacy / offline-ish mode:** local Ollama
- **Extra fallback:** Gemini / Cloudflare / Anthropic ahol szükséges

### Miért jó ez?
- jobb minőség komplex kérdésekre,
- lokális visszaesési lehetőség,
- költség és adatérzékenység szerint váltható.

---

## GraphRAG és hosszú távú memória

A meglévő GraphRAG + reflection alapokra építve az assistantnak külön memória-sémát kell kapnia:
- személyek,
- projektek,
- rutinok,
- preferenciák,
- tanulságok,
- visszatérő feladatok,
- jóváhagyási minták.

Ez lesz az a réteg, amitől nem csak "chatbot", hanem valódi személyi asszisztens lesz.

---

## Computer use és automatizálás

A jelenlegi irány már jó:
- Robotkéz a böngésző- és UI-műveletekhez,
- Windows bridge az OS-szintű PowerShell / fájlműveletekhez,
- tool orchestration az összetettebb workflow-khoz.

A következő lépés egy **assistant action bus**:
- safe action,
- approval required,
- admin-only action,
- audit log,
- rollback / retry stratégia.

---

## Fázisolt megvalósítás

### Phase 1 — Foundation MVP
- Assistant blueprint
- readiness API
- dashboard panel
- CLI visibility

### Phase 2 — Voice-first Hungarian UX
- local STT
- női magyar hang
- voice UX finomítás

### Phase 3 — Personal Memory
- assistant memory profile
- GraphRAG enrichment
- lessons persistence

### Phase 4 — Safe Computer Use
- assistant action bus
- approval policy
- routine automation

### Phase 5 — Product Polish
- Windows packaging
- onboarding
- Home / Today view
- napi használatra optimalizált flow

---

## Javasolt döntés

**Én azt javaslom, hogy ezt a meglévő Brunella rendszerben építsük meg, nem külön projektként.**

Így:
- gyorsabb a fejlesztés,
- a meglévő agent-, memory- és automation-stack újrahasznosítható,
- a kívánt személyi asszisztens valóban a jelenlegi platformból nő ki,
- kisebb a kockázat, mint egy teljes újrakezdésnél.

---

## A legfontosabb következő technikai lépés

**Egységes BAS Assistant felület létrehozása**:
- chat,
- voice,
- model selector,
- memory summary,
- automation summary,
- approvals.

Ez lesz az a pont, ahol a sok meglévő képesség végre egyetlen, modern magyar alkalmazássá áll össze.
