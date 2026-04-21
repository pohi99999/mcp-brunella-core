# Magyar NLP Task Routing - Használati Útmutató

## 📋 Áttekintés

Magyar nyelvű természetes nyelvi feladat végrehajtás az Enterprise Orchestrator segítségével.
Az OrchestratorAgent automatikusan irányít a megfelelő ügynökhöz (Robotkéz, Developer, Researcher, stb.)

## 🎯 Funkciók

### 1. CLI Parancs: `brunella task`

#### Alap használat

```bash
# Egyszerű feladat végrehajtás
brunella task "Keress rá az AI hírekre"

# Interaktív mód
brunella task
brunella task -i
brunella task interactive

# Kontextussal
brunella task "Készíts Python scriptet" --context '{"format": "pandas"}'
```

#### Példa parancsok

```bash
# Projekt státusz
brunella task "Ellenőrizd a projekt státuszát és add meg a track-ek összefoglalóját"

# Tesztek futtatása
brunella task "Futtasd le az összes tesztet és készíts összefoglalót"

# Webes kutatás
brunella task "Keress rá az AI fejlesztések legfrissebb híreire"

# Kód generálás
brunella task "Készíts Python scriptet CSV fájl beolvasására és elemzésére"
```

#### Interaktív Mód

A `brunella task` parancs önállóan indítva egy interaktív menüt nyit:

```
🧠 Brunella - Természetes Nyelvű Feladat Végrehajtás

Magyar nyelven írj bármilyen feladatot!
Példák:
  - "Keress rá az AI hírekre"
  - "Készíts Python scriptet CSV elemzésre"
  - "Ellenőrizd a projekt státuszát"

Kilépés: exit, quit, vagy Ctrl+C

? Mit szeretnél csinálni? (Use arrow keys)
❯ ✍️  Új feladat megadása
  📋 Előre definiált feladatok
  ❌ Kilépés
```

##### Előre Definiált Feladatok

- 🔍 Projekt Státusz Ellenőrzése
- 📊 Tesztek Futtatása
- 🌐 Webes Kutatás
- 💻 Kód Generálás

---

### 2. Dashboard Widget: Neural Command

#### Hol található?

**Dashboard → Neural Command widget**

A widget a WidgetGrid-ben jelenik meg, és a következő funkciókat kínálja:

#### Funkciók

1. **Természetes Nyelvű Bemenet**
   - Textarea a feladat leírásához
   - Ctrl + Enter gyorsbillentyű
   - 🇭🇺 Magyar nyelv támogatás

2. **Gyors Parancsok**
   Előre definiált gombok:
   - 🔍 Projekt Státusz
   - 📊 Tesztek Futtatása
   - 🌐 Webes Kutatás
   - 💻 Kód Generálás

3. **Eredmény Megjelenítés**
   - ✅ Sikeres végrehajtás zöld jelzéssel
   - ❌ Hiba piros jelzéssel
   - Timestamp (magyar formátum)
   - JSON/String eredmény formázva

---

## 🔧 Backend API

### Endpoint: `/api/enterprise/execute`

**Method:** POST

**Request Body:**
```json
{
  "task": "Magyar nyelvű feladat leírása",
  "context": {}  // Opcionális extra kontextus
}
```

**Response:**
```json
{
  "status": "success",
  "result": {
    "status": "success",
    "message": "Eredmény üzenet",
    "data": { ... }
  },
  "executedAt": "2026-02-21T10:30:00.000Z"
}
```

### Hiba Kezelés

- `400` - Hiányzó/érvénytelen task
- `503` - Orchestrator nem elérhető
- `500` - Végrehajtási hiba

---

## 🎨 Példa Használati Esetek

### 1. Webes Kutatás

**CLI:**
```bash
brunella task "Keress rá a Cloudflare Workers AI legújabb fejlesztéseire"
```

**Dashboard:**
1. Nyisd meg a Neural Command widget-et
2. Kattints a "🌐 Webes Kutatás" gombra
3. Módosítsd a szöveget igény szerint
4. Kattints a "Feladat Végrehajtása" gombra

### 2. Kód Generálás

**CLI:**
```bash
brunella task "Készíts Python függvényt ami JSON fájlt CSV-vé alakít pandas használatával"
```

### 3. Projekt Menedzsment

**CLI:**
```bash
brunella task "Ellenőrizd az aktív track-eket és add meg a legkritikusabb feladatokat"
```

---

## 📚 Technikai Részletek

### Architektúra

```
┌─────────────────┐
│   CLI / UI      │  <- brunella task / Neural Command Widget
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  POST /api/     │  <- Express REST API
│  enterprise/    │
│  execute        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Orchestrator    │  <- Intelligens routing KEYWORD_ROUTES alapján
│ Agent           │     (böngésző, keres, kód, javít, stb.)
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  Specialized Agents:                │
│  - RobotkezV2 (böngésző)           │
│  - Developer (kód)                  │
│  - Researcher (kutatás)             │
│  - DataScientist (adat elemzés)     │
│  - ... (30+ agent)                  │
└─────────────────────────────────────┘
```

### Fájlok

#### CLI
- **Implementáció:** `src/cli/taskCommands.ts`
- **Regisztráció:** `src/cli.ts` (registerTaskCommands)

#### Dashboard
- **Widget:** `src/dashboard/components/dashboard/NeuralCommandWidget.tsx`
- **Regisztráció:** `src/dashboard/lib/widgetRegistry.tsx`

#### Backend
- **Route:** `src/server/routes/enterprise.ts`
- **Agent:** `src/agents/OrchestratorAgent.ts` (KEYWORD_ROUTES)

---

## 🚀 Gyors Start

### 1. Backend Indítás
```bash
npm run dev
```

### 2. Dashboard Indítás
```bash
npm run dev:ui
```

### 3. CLI Használat
```bash
brunella task "Projekt státusz"
```

---

## ⚠️ Hibakezelés

### Gyakori Hibák

**API hiba (Connection refused):**
- Backend nem fut → `npm run dev`

**Orchestrator not available:**
- AgentManager nem inicializálódott → Újraindítás

**Üres válasz:**
- Orchestrator timeout → Nézd meg a logokat: `logs/orchestrator.log`

---

## 📝 Megjegyzések

- A feladatok **aszinkron módon** futnak (hosszú futási idők esetén)
- Az OrchestratorAgent **automatikusan választ** ügynököt magyar kulcsszavak alapján
- **Context** opcionális - az Orchestrator kitalálja a feladat természetét

---

**Készítette:** DeveloperAgent + Claude
**Verzió:** 1.0.0
**Dátum:** 2026-02-21
