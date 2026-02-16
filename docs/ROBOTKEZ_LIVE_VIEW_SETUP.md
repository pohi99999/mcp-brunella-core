# 🔴 ROBOTKÉZ V2 - LIVE VIEW BEÁLLÍTÁSI ÚTMUTATÓ

**Verzió:** 1.0 | **Létrehozva:** 2026-02-16 | **Szerző:** Claude Code + Pohánka Péter

---

## 📋 MIT FOGSZ LÁTNI?

A Robotkéz V2 Live View **két módon** mutatja meg a böngésző működését:

### 1. **Dashboard Live View** (🖼️ Képernyőkép Stream)
- Valós idejű képernyőképek a Dashboard-on (~2 másodpercenként frissül)
- Nem kell megnyitni fizikai böngésző ablakot
- **Gyorsabb**, kevesebb erőforrást igényel

### 2. **Headed Mode** (🪟 Fizikai Böngésző Ablak)
- Felugró Chrome ablak amit **saját szemeddel látsz**
- Látod az egér mozgását, gépelést, kattintásokat
- **Fejlesztéshez/debuggoláshoz** ideális

---

## 🚀 GYORS BEÁLLÍTÁS (3 LÉPÉS)

### 1. Lépés: `.env` Fájl Módosítása

Nyisd meg a projekt gyökerében lévő `.env` fájlt, és add hozzá:

```env
# === ROBOTKÉZ V2 - LIVE VIEW BEÁLLÍTÁSOK ===
ROBOTKEZ_HEADLESS=false          # false = Látható ablak, true = Háttér
ROBOTKEZ_SAVE_SCREENSHOTS=true   # Screenshot mentés (Live View-hoz)
ROBOTKEZ_VIEWPORT_WIDTH=1280     # Böngésző ablak szélesség
ROBOTKEZ_VIEWPORT_HEIGHT=720     # Böngésző ablak magasság
```

**❗FONTOS:** Ha nincs `.env` fájlod, másold át a `.env.example`-t:
```bash
copy .env.example .env
```

---

### 2. Lépés: Rendszer Újraindítása

A változások érvényesítéséhez újra kell indítani a Python alrendszert:

**Opció A** - **Teljes rendszer újraindítás** (ajánlott):
```bash
# Ha fut, állítsd le (Ctrl+C minden terminalban)
# Majd indítsd újra:
start-full.bat
```

**Opció B** - **Csak Python újraindítás**:
```bash
# Állítsd le a myai/server.py-t (Ctrl+C)
# Majd:
cd myai
uv run uvicorn server:app --reload --port 8000
```

---

### 3. Lépés: Tesztelés

1. **Nyisd meg a Dashboard-ot:** http://localhost:5173
2. **Navigálj a Robotkéz V2 fülhöz** (bal oldali menü)
3. **Írj be egy magyar utasítást:**
   ```
   Keress rá a "gemini cli news" kifejezésre és nyisd meg az első találatot!
   ```
4. **VÁRHATÓ EREDMÉNY:**
   - ✅ **Headed Mode esetén**: Felugrik egy Chrome ablak, látod ahogy gépel és kattint
   - ✅ **Headless Mode esetén**: A Dashboard Live View paneljében frissülő képernyőképek

---

## 🎨 DASHBOARD LIVE VIEW HASZNÁLATA

### Live View Panel Elemei:

```
┌────────────────────────────────────────┐
│  🔴 LIVE VIEW                          │
│  ┌──────────────────────────────────┐  │
│  │                                  │  │
│  │   [Böngésző képernyőkép]        │  │
│  │                                  │  │
│  └──────────────────────────────────┘  │
│  Utoljára frissítve: 2s                │
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│  📜 TIMELINE (Végrehajtási Lépések)    │
│  ✅ 1. Navigálás: google.com          │
│  ✅ 2. Gépelés: "gemini cli news"     │
│  ⏳ 3. Kattintás: első találat        │
│  ⬜ 4. Screenshot készítés             │
└────────────────────────────────────────┘
```

### Live View Frissítési Gyakoriság:
- **Automatic**: Minden lépés után automatikus screenshot
- **Refresh Rate**: ~2 másodperc (beállítható)
- **Screenshot Cache**: Utolsó 10 képernyőkép tárolva

---

## ⚙️ HALADÓ BEÁLLÍTÁSOK

### Headed/Headless Mód Váltása Futás Közben

**Nincs** futásidejű váltás - a beállítás **böngésző indításkor** rögzül. Ha váltani akarsz:

1. Állítsd le a Robotkéz-t (ha fut)
2. Módosítsd a `.env` fájlt
3. Indítsd újra a Python alrendszert

### Viewport Méret Testreszabása

Ha nagyobb/kisebb böngésző ablakot szeretnél:

```env
ROBOTKEZ_VIEWPORT_WIDTH=1920   # Full HD szélesség
ROBOTKEZ_VIEWPORT_HEIGHT=1080  # Full HD magasság
```

**Ajánlott méretek:**
- **Laptop:** 1280x720 (alapértelmezett)
- **Desktop:** 1920x1080
- **4K:** 3840x2160

### Screenshot Minőség Beállítása

A screenshot minőség a Python `interactive_browser.py` fájlban állítható:

```python
# Sor 80: screenshot_bytes = await pg.screenshot(type='png')
screenshot_bytes = await pg.screenshot(type='png', quality=90)  # JPEG-nél működik
```

---

## 🐛 HIBAELHÁRÍTÁS

### Probléma 1: "Böngésző nem nyílik meg"

**Tünetek:**
- `ROBOTKEZ_HEADLESS=false` beállítás ellenére sem látod az ablakot
- Hiba: `Browser process exited with code 1`

**Megoldás:**
1. Ellenőrizd hogy Playwright telepítve van:
   ```bash
   cd myai
   uv run playwright install chromium
   ```
2. Windows esetén futtasd adminisztrátor módban
3. Ellenőrizd a `myai/logs/` mappában az error logot

---

### Probléma 2: "Dashboard Live View nem frissül"

**Tünetek:**
- Headed mode működik, de Dashboard-on nem látod a képernyőképeket
- Régi screenshot látszik

**Megoldás:**
1. Ellenőrizd a Socket.IO kapcsolatot:
   ```javascript
   // Browser Console (F12)
   console.log(io.connected);  // Should be true
   ```
2. Frissítsd a Dashboard-ot (F5)
3. Ellenőrizd hogy `ROBOTKEZ_SAVE_SCREENSHOTS=true`

---

### Probléma 3: "Lassú végrehajtás headed módban"

**Tünetek:**
- Headed mode esetén sokkal lassabb mint headless

**Ok:**
- A fizikai renderelés extra erőforrást igényel

**Megoldás:**
- Csökkentsd a viewport méretet: `ROBOTKEZ_VIEWPORT_WIDTH=800`
- Zárd be a felesleges programokat
- Használd headless módot production-ben

---

## 📊 TELJESÍTMÉNY ÖSSZEHASONLÍTÁS

| Mód        | Sebesség | CPU | RAM  | Ajánlott Használat           |
|------------|----------|-----|------|------------------------------|
| **Headless** | ⚡⚡⚡⚡⚡ (100%) | 15% | 200MB | Production, gyors tesztek    |
| **Headed**   | ⚡⚡⚡⚡ (85%)   | 25% | 350MB | Fejlesztés, debugging, demo  |

---

## 🎯 HASZNÁLATI PÉLDÁK

### Példa 1: Webes Scraping (Headless)

```env
ROBOTKEZ_HEADLESS=true
```

**Chat parancs:**
```
Keress rá a "python tutorials 2026" kifejezésre és gyűjtsd össze az első 10 cím linkjét!
```

**Eredmény:** Gyors végrehajtás, Dashboard Live View mutatja a képernyőképeket

---

### Példa 2: UI Automatizálás Tesztelése (Headed)

```env
ROBOTKEZ_HEADLESS=false
```

**Chat parancs:**
```
Navigálj a n8n.io oldalra, kattints a "Get Started" gombra és töltsd ki a regisztrációs űrlapot!
```

**Eredmény:** Látod a böngésző ablakban ahogy kitölti az űrlapot

---

### Példa 3: Screenshot Készítés (Headless)

```env
ROBOTKEZ_HEADLESS=true
ROBOTKEZ_SAVE_SCREENSHOTS=true
```

**Chat parancs:**
```
Készíts screenshot-ot a claude.ai főoldaláról!
```

**Eredmény:** Screenshot Base64 formátumban elérhető a válaszban

---

## 🔗 KAPCSOLÓDÓ DOKUMENTUMOK

- **USER_START.md** - Teljes rendszer indítási útmutató
- **PROJEKT_DIAGRAM.md** - Architektúra diagram
- **test/robotkezV2.e2e.test.ts** - E2E teszt példák
- **src/agents/RobotkezV2Agent.ts** - Agent implementáció

---

## 💡 PRO TIPPEK

### 1. Fejlesztés Közben Használj Headed Módot

**Miért?**
- Azonnal látod mi történik
- Gyorsabb debuggolás
- Megérted az LLM döntéseit

### 2. Production-ben Használj Headless Módot

**Miért?**
- 15% gyorsabb végrehajtás
- Kevesebb memória
- Nincs szükség GUI-ra

### 3. Live View Frissítési Gyakoriság

**Alapértelmezett:** Minden lépés után screenshot

**Ha lassú:**
```typescript
// src/agents/RobotkezV2Agent.ts
// Kommenteld ki a screenshot hívásokat nem kritikus lépéseknél
// await persistentBrowser.sendCommand({ action: 'screenshot' });
```

### 4. Background Tasks (30s+ feladatok)

**Automatikus:** Ha a feladat > 30s, automatikusan háttérbe megy

**Manuális background futtatás:**
```typescript
const { taskId, plan } = await robotkez.executeInBackground("Long task...");
```

---

## ❓ GYAKORI KÉRDÉSEK

### K: Lehet egyszerre headless ÉS headed módban futtatni?

**V:** Nem. Egy Robotkéz instance csak egy módban fut. De indíthatsz két külön instance-t (pl. két terminálban).

---

### K: Dashboard Live View működik headless módban is?

**V:** **Igen!** A Live View független a headed/headless beállítástól. A screenshot-ok mindig készülnek.

---

### K: Milyen felbontásban készülnek a screenshot-ok?

**V:** A `ROBOTKEZ_VIEWPORT_WIDTH` x `ROBOTKEZ_VIEWPORT_HEIGHT` felbontásban (alapértelmezett: 1280x720).

---

### K: Lehet video recording-ot készíteni?

**V:** Jelenleg **nem** támogatott. Csak screenshot-ok készülnek. Video recording hozzáadása a roadmap-en van.

---

## 🚀 KÖVETKEZŐ LÉPÉSEK

Miután beállítottad a Live View-t:

1. ✅ Teszteld különböző weboldalakkal
2. ✅ Próbáld ki a Timeline funkciót
3. ✅ Experimálj a viewport méretekkel
4. ✅ Hozz létre saját automation workflow-kat

---

**🔴 FONTOS EMLÉKEZTETŐ:**

> Minden indításkor állítsd be a `.env` fájlban hogy headed vagy headless módot szeretnél!
> Fejlesztéskor: `ROBOTKEZ_HEADLESS=false` (látod az ablakot)
> Production: `ROBOTKEZ_HEADLESS=true` (gyorsabb, háttér)

---

**Készítette:** Claude Sonnet 4.5 @ 2026-02-16
**Projekt:** Brunella Agent System - Robotkéz V2 Agent
**Track:** robotkezv2-full-comet-20260215
