# 🎯 AI Workflow - Brunella Projekt

Ez a dokumentum segít neked (a projekt gazdájának) hatékonyan dolgozni az AI ügynökökkel.

---

## 🔄 A Te Workflow-od

```
┌─────────────┐    ┌──────────────┐    ┌───────────────┐    ┌─────────────┐
│   TE        │ -> │  TERVEZŐ     │ -> │  KIVITELEZŐ   │ -> │  KÓDOLÓ     │
│  (Ötlet)    │    │  (Gem)       │    │  (Gem)        │    │  (Agent)    │
│             │    │  Spec-et ír  │    │  Promptot ír  │    │  Kódot ír   │
└─────────────┘    └──────────────┘    └───────────────┘    └─────────────┘
```

---

## 📋 Sablonok AI Ügynököknek

### 1️⃣ Új Ügynöknek Projekt Bemutatás

Másold be ezt amikor **új AI-val** kezdesz dolgozni:

```
A projektem neve: mcp-brunella-core
Ez egy AI multi-agent rendszer ami automatizálja a szoftverfejlesztést.

Tech stack: Node.js (TypeScript), Python (FastAPI), React, Ollama (lokális LLM)

A projekt struktúra és dokumentáció itt van: [másold be a CLAUDE.md tartalmát]

Fontos: Én nem vagyok programozó, kérlek érthetően magyarázd a dolgokat!
```

### 2️⃣ Fejlesztési Kérés Sablon

Használd ezt amikor **új feature-t** kérsz:

```
## Feladat
[Írd le mit szeretnél, hétköznapi nyelven]

## Kontextus
- Érintett fájlok: [ha tudod]
- Kapcsolódó track: [conductor/tracks.md-ből ha van]

## Elvárt Eredmény
[Mit kell látnom ha kész?]
```

### 3️⃣ Hiba Javítás Sablon

```
## Probléma
[Mi történik? Mi a hibaüzenet?]

## Mikor jelentkezik?
[Milyen parancs után? Melyik fájlban?]

## Mit próbáltál már?
[Ha próbáltál valamit]
```

### 4️⃣ Kód Review Kérés

```
## Fájl(ok) amire kíváncsi vagyok
[fájl útvonal]

## Kérdéseim
1. Ez így jó?
2. Van benne hiba?
3. Hogyan lehetne egyszerűbb?
```

---

## 📁 Mit Adj Át az AI-nak?

### Minimum (Gyors Kérdéshez)
- `CLAUDE.md` tartalma

### Normál (Feature Fejlesztéshez)
- `CLAUDE.md`
- `conductor/tracks.md` (releváns részek)
- Az érintett fájl(ok) tartalma

### Teljes (Komplex Feladathoz)
Futtasd: `node scripts/generate-ai-context.js --full`
És másold be az `_AI_CONTEXT.md` tartalmát.

---

## ✅ Ellenőrző Lista Minden Változás Után

- [ ] Build sikeres? (`npm run build`)
- [ ] Tesztek zöldek? (`npm test`)
- [ ] Szerver elindul? (`npm run dev`)
- [ ] Dashboard működik? (`npm run dev:ui`)
- [ ] `conductor/tracks.md` frissítve?

---

## 🚨 Gyakori Buktatók

### "Az AI nem érti a projektet"
→ Adj neki több kontextust (CLAUDE.md + Brunella.md)

### "A generált kód nem működik"
→ Kérd meg hogy magyarázza el mit csinál, és futtassa a teszteket

### "Elvesztem melyik ügynök mit csinált"
→ Mindig kérd az AI-t hogy írjon SUMMARY-t a végén

### "A dokumentáció elavult"
→ Kérd az AI-t: "Frissítsd a conductor/tracks.md-t a mostani változásokkal"

---

## 🎯 Arany Szabályok

1. **Egy feladat = Egy beszélgetés** - Ne keverd össze a témákat
2. **Kontextus a király** - Minél több hátteret adsz, annál jobb eredmény
3. **Ellenőrizd** - Futtass teszteket a kód után
4. **Dokumentáld** - Kérd az AI-t hogy frissítse a docs-ot

---

## 💡 Pro Tipp: AI Asszisztens Típusok

| Mire | Melyik AI |
|------|-----------|
| Ötletelés, brainstorm | Gemini App, Claude App (chat) |
| Spec írás | Tervező Gem |
| Prompt generálás | Kivitelező Gem |
| Kódolás | Cursor, Gemini CLI, Claude Code |
| Code review | Claude Code, Cursor |
| Dokumentáció | Bármelyik |

---

## 🛠️ Asszisztens Eszközök

### 1. AI Kontextus Generáló
Összegyűjti a projekt lényegét egyetlen fájlba amit bemásolhatsz bármely AI-nak.

```bash
npm run context        # Rövid verzió (gyors kérdéshez)
npm run context:full   # Teljes verzió (komplex feladathoz)
```
→ Létrehozza: `_AI_CONTEXT.md`

### 2. Sync Agent (Dokumentáció Frissítő)
Automatikusan frissíti a dokumentációt és ellenőrzi a konzisztenciát.

```bash
npm run sync           # Teljes szinkronizáció
npm run sync:check     # Csak ellenőrzés (nem módosít)
npm run sync:fix       # Automatikus javítás ahol lehet
```
→ Frissíti: `Toolskeszlet.md`, `_PROJECT_STRUCTURE.md`, `_AI_CONTEXT.md`

### 3. Változás Figyelő
Figyeli a projekt változásait és jelzi ha valami "gyanús".

```bash
npm run watch:changes  # Egyszer lefut és report-ol
npm run watch:live     # Folyamatosan figyel
```
→ Létrehozza: `_CHANGE_REPORT.md`, `_FIX_INSTRUCTIONS.md`

Ha hibát talál, a `_FIX_INSTRUCTIONS.md`-t másold be a kódoló ügynöknek!

### 4. AI Chat Log (Beszélgetés Napló)
Központi hely ahol elmented melyik AI-val mit beszéltél.

```bash
npm run chatlog:add    # Új bejegyzés (interaktív)
npm run chatlog:list   # Utolsó 20 bejegyzés
npm run chatlog:search "dashboard"  # Keresés
npm run chatlog        # Súgó
```
→ Tárolja: `_AI_CHAT_LOG.json`, `_AI_CHAT_LOG.md`

---

## 🔄 Ajánlott Napi Rutin

1. **Reggel:** `npm run sync` - frissítsd a dokumentációt
2. **Munka közben:** `npm run chatlog:add` - jegyezd fel mit csináltatok
3. **Új AI-val:** `npm run context` - add át a kontextust
4. **Hiba esetén:** `npm run watch:changes` - nézd meg mi romlott el
5. **Este:** `npm run sync:check` - ellenőrizd minden rendben van-e
