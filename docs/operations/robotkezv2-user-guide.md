# RobotkezV2 - Felhasználói Útmutató

**Verzió:** 1.0.0
**Utolsó frissítés:** 2026-02-15

---

## 📚 Tartalomjegyzék

1. [Bevezetés](#bevezetés)
2. [Gyors Kezdés](#gyors-kezdés)
3. [Dashboard Használata](#dashboard-használata)
4. [CLI Parancsok](#cli-parancsok)
5. [Példák](#példák)
6. [Hibaelhárítás](#hibaelhárítás)
7. [Limitációk](#limitációk)

---

## Bevezetés

A **RobotkezV2** egy intelligens böngésző ügynök, hasonló a Perplexity Comet-hez. Magyar nyelvű természetes nyelvi utasításokat fogad, és automatikusan multi-step böngésző műveletek sorozatává alakítja.

### Főbb Funkciók

- ✅ **Magyar természetes nyelv támogatás** - "Keress rá az AI hírekre"
- ✅ **LLM-based planning** - GPT-4o/Gemini automatikus lépés generálás
- ✅ **Multi-step automation** - Navigálás, kattintás, gépelés, adat kinyerés
- ✅ **Background tasks** - Hosszú műveletek háttérben futnak
- ✅ **Live View** - Valós idejű screenshot előnézet
- ✅ **Dashboard + CLI** - Webes felület ÉS parancssor

---

## Gyors Kezdés

### 1. Szerver Indítás

```bash
# Teljes rendszer indítás
npm run dev         # Backend (port 3000)
npm run dev:ui      # Dashboard (port 5173)

# Python alrendszer (ha külön szükséges)
cd myai && uvicorn server:app --reload --port 8000
```

### 2. Dashboard Megnyitása

Böngészőben: `http://localhost:5173`

Navigálj a **"Robotkéz V2"** tab-ra.

### 3. Első Utasítás

Dashboard chat mezőben:
```
Navigálj a google.com-ra és keress rá az "TypeScript tutorial" kifejezésre
```

**Enter** → A RobotkezV2 automatikusan:
1. Generál egy execution plan-t (4 lépés)
2. Végrehajtja lépésről lépésre
3. Megjeleníti a Live View screenshot-ot

---

## Dashboard Használata

### Chat Interface (Comet-style)

**Input mező:** Magyar nyelvű utasítások (pl. "Keress rá az AI hírekre")

**Message bubbles:**
- 🟦 **Kék** = Felhasználó
- 🟩 **Zöld** = RobotkezV2 válasz

**Loading indicator:** Typing animation execution közben

### Execution Timeline

Valós idejű lépés vizualizáció:
- ✅ **Completed** (zöld)
- ⏳ **Running** (sárga)
- ⚪ **Pending** (szürke)
- ❌ **Error** (piros)

### Live Browser View

**Auto-refresh:** 2 másodpercenként
**Toggle:** Show/Hide gomb
**Current URL:** Státuszban látható

### Background Tasks Panel

Expandable dropdown:
- **Active tasks:** Futó háttér feladatok
- **Completed tasks:** Befejezett feladatok
- **Cancel button:** Feladat megszakítása

---

## CLI Parancsok

### Chat Mode

```bash
# Egyszerű chat utasítás
brunella robotkez chat "Navigálj a github.com-ra"

# Komplex multi-step instruction
brunella robotkez chat "Navigálj a google.com-ra, keress rá az AI hírekre, és kattints az első találatra"
```

### Plan Preview

```bash
# Execution plan generálása FUTTATÁS NÉLKÜL
brunella robotkez plan "Keress rá az AI hírekre"
```

**Output:**
```json
{
  "plan": [
    { "action": "navigate", "url": "https://www.google.com", "description": "Google megnyitása" },
    { "action": "wait", "selector": "textarea[name='q']", "timeout": 10000, "description": "Keresőmező betöltése" },
    { "action": "type", "selector": "textarea[name='q']", "text": "AI hírek", "description": "Keresés" },
    { "action": "click", "selector": "input[type='submit']", "description": "Submit" }
  ],
  "estimatedDuration": 20000,
  "backgroundEligible": false
}
```

### Direct Browser Actions

```bash
# Navigate
brunella robotkez exec --action navigate --url "https://google.com"

# Click
brunella robotkez exec --action click --selector ".button"

# Type
brunella robotkez exec --action type --selector "input[name='q']" --text "Hello"

# Screenshot
brunella robotkez screenshot
# Mentés: ./screenshots/robotkez-{timestamp}.png
```

### Status & Tasks

```bash
# Agent státusz
brunella robotkez status

# Background tasks lista
brunella robotkez tasks list

# Task státusz (ID alapján)
brunella robotkez tasks status task_abc123

# Task cancel
brunella robotkez tasks cancel task_abc123
```

### Interactive Mode (REPL)

```bash
brunella robotkez interactive
```

**REPL commands:**
- `.help` - Segítség
- `.status` - Agent státusz
- `.tasks` - Background tasks
- `.exit` - Kilépés

---

## Példák

### 1. Google Keresés

```bash
brunella robotkez chat "Keress rá az AI hírekre"
```

**Generált Plan:**
1. Navigate → `google.com`
2. Wait → Keresőmező betöltés
3. Type → "AI hírek"
4. Click → Submit gomb

### 2. Komplex Workflow

```bash
brunella robotkez chat "Navigálj a github.com-ra, keress rá a 'typescript', és kattints az első repository-ra"
```

**7 lépés:**
1. Navigate → github.com
2. Wait → Search input
3. Type → "typescript"
4. Click → Search button
5. Wait → Results loaded
6. Click → First repository link
7. Screenshot

### 3. Form Fill

```bash
brunella robotkez chat "Töltsd ki a név mezőt 'John Doe' névvel"
```

**2 lépés:**
1. Type → selector: `input[name='name']`, text: "John Doe"
2. Screenshot

### 4. Data Extraction

```bash
brunella robotkez chat "Navigálj a google.com-ra és nyerd ki az oldal címét"
```

**3 lépés:**
1. Navigate → google.com
2. Wait → Page loaded
3. Extract → selector: `title`, type: text

**Output:**
```json
{
  "extractedData": ["Google"]
}
```

### 5. Background Task (hosszú művelet)

```bash
brunella robotkez chat "Navigálj 5 különböző weboldalra egymás után és készíts screenshotot mindegyikről"
```

**Automatic background delegation:**
- Estimated duration: ~40s (> 30s threshold)
- Task ID: `task_xyz789`
- Status: `running`

**Task tracking:**
```bash
brunella robotkez tasks status task_xyz789
```

---

## Hibaelhárítás

### Probléma: "LLM planning failed"

**Ok:** GitHub PAT vagy Ollama nem elérhető

**Megoldás:**
1. Ellenőrizd `.env` fájlt:
   ```bash
   GITHUB_PAT=your_token_here
   # VAGY
   GEMINI_API_KEY=your_key_here
   ```
2. Indítsd újra a szervert:
   ```bash
   npm run dev
   ```

### Probléma: "Browser connection timeout"

**Ok:** Python alrendszer nem fut

**Megoldás:**
```bash
cd myai
uvicorn server:app --reload --port 8000
```

### Probléma: "Selector not found"

**Ok:** CSS selector invalid vagy elem nem létezik

**Megoldás:**
- Használj általánosabb selectorokat (pl. `input[type='text']` helyett ID)
- Növeld a `wait` timeout-ot (10s helyett 15s)
- Ellenőrizd hogy az elem tényleg létezik-e (inspect DOM)

### Probléma: "Click timeout - element not visible"

**Ok:** Modern weboldalak hidden submit button-t használnak (pl. Google)

**Megoldás:**
- Használj **Enter key press** helyett click
- Vagy várj tovább (növeld timeout-ot)
- **KNOWN ISSUE:** Google search submit button hidden → Edge Case

---

## Limitációk

### 1. Google Specifikus Problémák

⚠️ **Modern Google design**: Submit button HIDDEN
- LLM generál `click submit` action-t
- Playwright nem tudja kattintani (element not visible)
- **Workaround:** Enter key press használata

### 2. LLM Planning Variációk

⚠️ **Non-deterministic output**: GPT-4o/Gemini variál
- Ugyanaz az utasítás → különböző plan-ek
- Pl. "Keress rá" → egyszer 4 lépés, másszor 5 lépés
- **OK:** Mindkettő valid lehet

### 3. JavaScript Heavy Sites

⚠️ **SPA (Single Page Apps)**: Dynamic content loading
- Wait timeout-ok növelése szükséges
- Néha manual `wait` step hozzáadása kell

### 4. CAPTCHA & Login

⚠️ **Human verification**: CAPTCHA-kat nem tudja megoldani
⚠️ **Authentication**: Login flow-kat user input-tal kell kezelni

---

## További Dokumentáció

- **Developer Guide:** `docs/robotkezv2-dev-guide.md`
- **API Reference:** `docs/api/robotkez-endpoints.md`
- **Track Plan:** `conductor/tracks/robotkezv2-full-comet-20260215/plan.md`

---

**Készítette:** Claude Code + Pohánka Péter
**License:** MIT
**Support:** GitHub Issues - `https://github.com/yourusername/brunella-core/issues`
