# 🤖 Browser Automatizálás Összehasonlítás - Puppeteer vs Playwright vs Browser-Use

> **Célközönség:** RobotkezV2 fejlesztők (Brunella projekt)
> **Kérdés:** Melyik library a LEGJOBB a browser automatizáláshoz?
> **Frissítve:** 2026-02-17

---

## 📋 Tartalomjegyzék

1. [Quick Summary](#quick-summary)
2. [Puppeteer](#1-puppeteer-google)
3. [Playwright](#2-playwright-microsoft)
4. [Browser-Use](#3-browser-use-ai-powered)
5. [Összehasonlítás Táblázat](#összehasonlítás-táblázat)
6. [Melyiket Válasszam?](#melyiket-válasszam)
7. [Kód Példák](#kód-példák)
8. [RobotkezV2 Ajánlás](#robotkezv2-ajánlás)

---

## 🚀 Quick Summary (30 másodperc)

| Library | Erősség | Gyengeség | Ajánlott ha... |
|---------|---------|-----------|----------------|
| **Puppeteer** | Gyors, stabil, Chrome-only | Csak Chromium | Egyszerű scraping, screenshot, PDF |
| **Playwright** | Multi-browser, modern API | Lassabb mint Puppeteer | Cross-browser testing kell |
| **Browser-Use** | AI-powered, natural language | Lassú, LLM függő | Komplex AI task-ok |

**Brunella RobotkezV2-höz:** **Browser-Use (Playwright alapon)** - AI-native, flexible, future-proof! 🎯

---

## 1. Puppeteer (Google)

### Mi ez?

**Puppeteer** = Node.js library a Chrome/Chromium automatizálásához (Google fejlesztette)

**Eredeti cél:** Chrome DevTools Protocol tesztelése → Weboldal tesztelés automatizálása

### Főbb Funkciók

#### A) Screenshot & PDF

```javascript
const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  await page.goto('https://example.com');

  // Screenshot
  await page.screenshot({ path: 'screenshot.png' });

  // PDF
  await page.pdf({ path: 'page.pdf', format: 'A4' });

  await browser.close();
})();
```

#### B) Scraping (Adatkinyerés)

```javascript
const data = await page.evaluate(() => {
  const title = document.querySelector('h1').innerText;
  const links = Array.from(document.querySelectorAll('a')).map(a => a.href);
  return { title, links };
});

console.log(data);
// { title: 'Example Domain', links: [...] }
```

#### C) Form Kitöltés & Kattintás

```javascript
// Navigálás
await page.goto('https://github.com/login');

// Input mezők kitöltése
await page.type('#login_field', 'username');
await page.type('#password', 'password123');

// Gomb kattintás
await page.click('input[type="submit"]');

// Várakozás navigációra
await page.waitForNavigation();
```

#### D) JavaScript Futtatás

```javascript
// JavaScript injection
const result = await page.evaluate(() => {
  return window.innerWidth;
});

console.log('Window width:', result);
```

#### E) Network Interception

```javascript
// Request blokkolás (pl. képek letiltása → gyorsabb)
await page.setRequestInterception(true);

page.on('request', request => {
  if (request.resourceType() === 'image') {
    request.abort(); // Blokkolja a képeket
  } else {
    request.continue();
  }
});
```

#### F) Emulation (Device, Geolocation, Timezone)

```javascript
// Mobile device emulation
await page.emulate(puppeteer.devices['iPhone 12']);

// Geolocation
await page.setGeolocation({ latitude: 47.4979, longitude: 19.0402 }); // Budapest

// Timezone
await page.emulateTimezone('Europe/Budapest');
```

### Előnyök

✅ **Gyors** - Chrome-only, nincs overhead
✅ **Stabil** - Google támogatás, érett library (2017 óta)
✅ **Jó dokumentáció** - Rengeteg példa, Stack Overflow válasz
✅ **Screenshot/PDF native** - Beépített funkciók
✅ **Headless by default** - Gyorsabb, kevesebb resource

### Hátrányok

❌ **Csak Chromium** - Firefox/Safari nem támogatott
❌ **Régebbi API** - Kevésbé modern mint Playwright
❌ **Nincs AI integráció** - Manuális CSS selector írás kell
❌ **Single browser context** - Párhuzamos böngészés nehézkes

---

## 2. Playwright (Microsoft)

### Mi ez?

**Playwright** = Multi-browser automatizáló library (Microsoft fejlesztette, 2020)

**Eredeti cél:** Puppeteer "továbbfejlesztése" multi-browser támogatással

### Főbb Funkciók

#### A) Multi-Browser Support

```javascript
const { chromium, firefox, webkit } = require('playwright');

// Chromium (Chrome/Edge)
const browserChrome = await chromium.launch();

// Firefox
const browserFirefox = await firefox.launch();

// WebKit (Safari)
const browserSafari = await webkit.launch();
```

#### B) Modern API (async/await everywhere)

```javascript
const { chromium } = require('playwright');

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

await page.goto('https://example.com');

// Click with auto-wait (Puppeteer-nél manuális wait kell!)
await page.click('button#submit'); // Automatikusan vár amíg megjelenik

// Fill form (egyszerűbb mint Puppeteer)
await page.fill('input[name="email"]', 'test@example.com');

await browser.close();
```

#### C) Auto-Waiting (Smart waiting)

**Puppeteer:**
```javascript
// Manuális várakozás
await page.waitForSelector('button');
await page.click('button');
```

**Playwright:**
```javascript
// Automatikus várakozás (nincs waitForSelector!)
await page.click('button'); // Vár amíg megjelenik + kattintható
```

#### D) Network Interception (Fejlettebb)

```javascript
// Mock API responses
await page.route('**/api/users', route => {
  route.fulfill({
    status: 200,
    body: JSON.stringify([{ id: 1, name: 'John' }])
  });
});
```

#### E) Video Recording (Beépített!)

```javascript
const browser = await chromium.launch();
const context = await browser.newContext({
  recordVideo: { dir: 'videos/' } // Automatikus videó felvétel!
});

const page = await context.newPage();
await page.goto('https://example.com');
// ... actions ...

await browser.close(); // Video automatikusan mentve!
```

#### F) Parallel Execution (Browser Contexts)

```javascript
const browser = await chromium.launch();

// 3 párhuzamos session
const context1 = await browser.newContext();
const context2 = await browser.newContext();
const context3 = await browser.newContext();

// Mindegyik független cookie/storage-el
const page1 = await context1.newPage();
const page2 = await context2.newPage();
const page3 = await context3.newPage();

// Párhuzamos munka!
await Promise.all([
  page1.goto('https://site1.com'),
  page2.goto('https://site2.com'),
  page3.goto('https://site3.com'),
]);
```

### Előnyök

✅ **Multi-browser** - Chrome, Firefox, Safari (WebKit)
✅ **Modern API** - Auto-waiting, egyszerűbb mint Puppeteer
✅ **Browser contexts** - Párhuzamos session-ök egyszerűen
✅ **Video recording** - Beépített teszt videó
✅ **Cross-platform** - Windows, Linux, macOS, WSL
✅ **Microsoft támogatás** - Aktív fejlesztés, gyakori update

### Hátrányok

❌ **Lassabb** - Multi-browser overhead
❌ **Nagyobb install** - 3 browser letöltése (~500MB)
❌ **Nincs AI integráció** - Manuális selector írás (mint Puppeteer)

---

## 3. Browser-Use (AI-Powered)

### Mi ez?

**Browser-Use** = AI-powered browser automation library (Playwright/Selenium alapon, LLM irányítással)

**Eredeti cél:** Natural language browser tasks (nem kell CSS selector!)

### Főbb Funkciók

#### A) Natural Language Instructions

**Puppeteer/Playwright:**
```javascript
// Manuális selector írás
await page.click('#login-button');
await page.fill('input[name="username"]', 'john');
```

**Browser-Use:**
```python
from browser_use import Browser

async with Browser() as browser:
    # Natural language!
    await browser.navigate("https://github.com/login")
    await browser.act("Fill in username 'john' and password 'secret123'")
    await browser.act("Click the green Sign in button")
```

**AI dönti el hogy melyik gombot kattintsa!** (nincs CSS selector!)

#### B) LLM-Powered Decision Making

```python
# Komplex feladat - AI értelmezi
await browser.act("""
Go to GitHub Trending page,
find the top 3 Python repositories,
and extract their names and star counts
""")

# AI automatikusan:
# 1. Navigál github.com/trending
# 2. Szűr Python-ra
# 3. Kiválasztja a top 3-at
# 4. Kinyeri a név + star count-ot
```

#### C) Vision-Based Interaction (Screenshot → LLM)

```python
# AI "látja" a képernyőt és dönt
await browser.act("Click the red warning banner at the top")

# AI:
# 1. Screenshot
# 2. LLM elemzi a képet
# 3. Megtalálja a piros banner-t
# 4. Kattint rá
```

#### D) Context Awareness (Multi-Step Tasks)

```python
# Több lépéses feladat memóriával
await browser.act("""
1. Go to n8n.io
2. Click the pricing page
3. Find the cheapest plan
4. Return the price
""")

# AI emlékezik a korábbi lépésekre!
```

#### E) Structured Data Extraction

```python
from browser_use import Browser, StructuredExtractor

async with Browser() as browser:
    await browser.navigate("https://github.com/trending")

    # Strukturált kinyerés LLM-mel
    data = await browser.extract_structured({
        "repositories": [
            {
                "name": "string",
                "author": "string",
                "stars": "number",
                "description": "string"
            }
        ]
    })

# Eredmény: JSON validált adatokkal
```

### Előnyök

✅ **AI-native** - Natural language instructions
✅ **No selectors** - AI megtalálja az elemeket
✅ **Vision-based** - Screenshot elemzés LLM-mel
✅ **Flexible** - Működik változó UI-val is
✅ **Multi-step tasks** - Komplex workflow egyszerűen
✅ **Structured extraction** - JSON schema alapú kinyerés

### Hátrányok

❌ **Lassú** - LLM overhead (5-10x lassabb mint Playwright)
❌ **LLM dependency** - Ollama/Gemini/GPT-4 kell
❌ **Drága** - LLM token cost (ha nem lokális)
❌ **Nem determinisztikus** - AI különböző döntéseket hozhat
❌ **Kevésbé stabil** - Új library, kevesebb teszt

---

## 📊 Összehasonlítás Táblázat

| Funkció | **Puppeteer** | **Playwright** | **Browser-Use** |
|---------|---------------|----------------|-----------------|
| **Böngésző támogatás** | Chrome only | Chrome, Firefox, Safari | Chrome, Firefox (Playwright alapon) |
| **API stílus** | Callback-heavy | Modern async/await | Natural language |
| **Auto-waiting** | ❌ Manuális | ✅ Automatikus | ✅ AI-based |
| **Selector módszer** | CSS/XPath | CSS/XPath/Text | ✅ AI látás (nincs selector!) |
| **Párhuzamos futás** | Nehézkes | ✅ Browser contexts | ✅ (Playwright alapon) |
| **Video recording** | ❌ Plugin kell | ✅ Beépített | ✅ (Playwright alapon) |
| **Screenshot** | ✅ Natív | ✅ Natív | ✅ Natív |
| **PDF generálás** | ✅ Natív | ✅ Natív | ✅ Natív |
| **Network mock** | ✅ Van | ✅ Fejlettebb | ✅ (Playwright alapon) |
| **AI integráció** | ❌ Nincs | ❌ Nincs | ✅ **CORE FEATURE!** |
| **Natural language** | ❌ Nincs | ❌ Nincs | ✅ **CORE FEATURE!** |
| **Strukturált kinyerés** | Manuális | Manuális | ✅ LLM-powered |
| **Sebesség** | ⚡ Nagyon gyors | ⚡ Gyors | 🐢 Lassú (LLM overhead) |
| **Stabilitás** | ✅ Érett (2017) | ✅ Érett (2020) | ⚠️ Új (2023-2024) |
| **Dokumentáció** | ✅ Kiváló | ✅ Kiváló | ⚠️ Közepes |
| **Közösség** | ✅ Nagy | ✅ Nagy | ⚠️ Kis |
| **Ár (LLM token)** | $0 | $0 | $ (ha GPT-4), $0 (ha Ollama) |
| **Install méret** | ~100MB | ~500MB | ~600MB (Playwright + LLM) |
| **Learning curve** | Közepes | Könnyű | **Nagyon könnyű** (natural language!) |

---

## 🎯 Melyiket Válasszam?

### 1. Puppeteer-t válaszd ha...

✅ **Csak Chrome-ot** támogatnod kell
✅ **Sebesség kritikus** (pl. 1000+ oldal scraping)
✅ **Egyszerű task-ok** (screenshot, PDF, form kitöltés)
✅ **Stabil, tesztelt library** kell
✅ **Kis install méret** fontos

**Példa use case:**
- Screenshot service (oldal → kép)
- PDF generálás (oldal → PDF)
- Egyszerű scraping (fix CSS selectorok)
- CI/CD smoke test (gyors UI check)

---

### 2. Playwright-et válaszd ha...

✅ **Multi-browser testing** kell (Chrome, Firefox, Safari)
✅ **Modern API-t** szeretnél (auto-waiting)
✅ **Video recording** kell (teszt videó)
✅ **Párhuzamos execution** fontos
✅ **Cross-platform** támogatás kell

**Példa use case:**
- Cross-browser E2E testing
- UI regression testing
- Performance monitoring (több böngészőben)
- Complex scraping (fix selectorok, de modern API)

---

### 3. Browser-Use-t válaszd ha...

✅ **AI-powered automation** kell
✅ **Natural language tasks** (nincs CSS selector írás)
✅ **Változó UI** (AI alkalmazkodik)
✅ **Komplex multi-step tasks** (LLM "érti" a feladatot)
✅ **Strukturált adatkinyerés** LLM-mel
✅ **Gemini/Ollama már elérhető** (LLM dependency OK)

**Példa use case:**
- **RobotkezV2 (Brunella projekt!)** - AI-driven browser tasks
- Dynamic scraping (UI változik gyakran)
- Complex workflow automation (több lépés, döntések)
- Natural language automation (user: "find cheapest plan")

---

## 💻 Kód Példák (Összehasonlítás)

### Task: "Menj GitHub-ra, keress rá 'playwright', kattints az első repo-ra, kinyerd a star count-ot"

#### Puppeteer

```javascript
const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  // 1. Navigáció GitHub-ra
  await page.goto('https://github.com');

  // 2. Keresés
  await page.waitForSelector('input[name="q"]');
  await page.type('input[name="q"]', 'playwright');
  await page.keyboard.press('Enter');

  // 3. Várakozás eredményekre
  await page.waitForSelector('.repo-list-item');

  // 4. Első repo kattintás
  await page.click('.repo-list-item:first-child a');

  // 5. Várakozás repo oldalra
  await page.waitForNavigation();

  // 6. Star count kinyerés
  const stars = await page.evaluate(() => {
    const starElement = document.querySelector('#repo-stars-counter-star');
    return starElement ? starElement.textContent.trim() : null;
  });

  console.log('Stars:', stars);

  await browser.close();
})();
```

**Sor szám:** ~30 sor
**Idő:** ~5-10 másodperc
**Nehézség:** Közepes (CSS selectorok írása kell)

---

#### Playwright

```javascript
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // 1. Navigáció
  await page.goto('https://github.com');

  // 2. Keresés (auto-waiting!)
  await page.fill('input[name="q"]', 'playwright');
  await page.press('input[name="q"]', 'Enter');

  // 3. Első repo kattintás (auto-waiting!)
  await page.click('.repo-list-item:first-child a');

  // 4. Star count kinyerés (auto-waiting!)
  const stars = await page.textContent('#repo-stars-counter-star');

  console.log('Stars:', stars);

  await browser.close();
})();
```

**Sor szám:** ~20 sor
**Idő:** ~5-10 másodperc
**Nehézség:** Könnyebb (auto-waiting, egyszerűbb API)

---

#### Browser-Use (AI-Powered)

```python
from browser_use import Browser

async with Browser() as browser:
    # Natural language!
    result = await browser.act("""
    1. Go to GitHub
    2. Search for 'playwright'
    3. Click the first repository
    4. Extract the star count
    """)

    print('Stars:', result)
```

**Sor szám:** ~10 sor
**Idő:** ~30-60 másodperc (LLM overhead)
**Nehézség:** **Nagyon könnyű** (nincs CSS selector!)

---

## 🤖 RobotkezV2 Ajánlás

### Jelenlegi Stack

**RobotkezV2 (Brunella projekt):**
- **Playwright** - Multi-browser support
- **Browser-Use** - AI-powered automation
- **Python** - Async/await architecture
- **LLM:** Gemini / Ollama

---

### Ajánlás: **MARADJ Browser-Use + Playwright-nél!** ✅

**Indokok:**

#### 1. **AI-First Philosophy** (Brunella projekt)
- Brunella = AI agent system
- Browser-Use = Natural language browser automation
- **Tökéletes párosítás!**

#### 2. **Gemini/Ollama Már Elérhető**
- Browser-Use LLM dependency → **NEM probléma**
- Gemini 2.0 Flash: gyors + olcsó
- Ollama qwen2.5-coder: lokális fallback

#### 3. **Flexible UI Handling**
- Website UI változik → **CSS selector break**
- Browser-Use AI → **alkalmazkodik** (vision-based)
- Példa: n8n UI változik → Browser-Use továbbra is működik

#### 4. **Natural Language Tasks (User Friendly)**
- User (te): "Menj n8n.io-ra és hozz létre egy új workflow-t"
- Browser-Use: **Megcsinálja** (AI érti)
- Puppeteer/Playwright: **Manuális CSS selector írás kell**

#### 5. **Future-Proof**
- AI automation = jövő
- Puppeteer/Playwright = manuális (régi iskola)
- Browser-Use = cutting edge

---

### Hibrid Megközelítés (AJÁNLOTT!)

**Kombináld Browser-Use + Playwright-et!**

```python
from browser_use import Browser
from playwright.async_api import async_playwright

async def robotkez_task(instruction: str):
    # Ha egyszerű task → Playwright (gyors)
    if is_simple_task(instruction):
        async with async_playwright() as p:
            browser = await p.chromium.launch()
            page = await browser.newPage()
            # ... Playwright kód (gyors, CSS selector-ok)
            await browser.close()

    # Ha komplex task → Browser-Use (AI)
    else:
        async with Browser() as browser:
            result = await browser.act(instruction)
            return result

# Példa
await robotkez_task("Take a screenshot of github.com")  # → Playwright (gyors)
await robotkez_task("Find cheapest n8n plan and return price")  # → Browser-Use (AI)
```

**Előnyök:**
- ✅ Gyors task-ok gyorsak (Playwright)
- ✅ Komplex task-ok flexibilisek (Browser-Use AI)
- ✅ Best of both worlds!

---

### Mi van Puppeteer-rel?

**NEM AJÁNLOTT Brunella-hoz:**

❌ **Nincs AI integráció** (manuális selector írás)
❌ **Chrome-only** (Playwright multi-browser jobb)
❌ **Régebbi API** (Playwright modernebb)
❌ **Nem illeszkedik AI-first philosophy-hoz**

**Egyetlen előny:** Gyorsabb
**De:** Browser-Use + Playwright hibrid megoldja ezt!

---

## ✅ Végső Döntés (RobotkezV2)

### Ajánlott Stack:

```
RobotkezV2 (Python)
├── Browser-Use (AI-powered) ← Komplex tasks
├── Playwright (Python API)  ← Egyszerű tasks (fallback)
└── LLM: Gemini 2.0 Flash    ← Gyors + olcsó
```

**Workflow:**

1. **User instruction** → RobotkezV2
2. **Task complexity analysis:**
   - Simple (screenshot, PDF, fix selector) → **Playwright** (gyors)
   - Complex (dynamic UI, multi-step, NL) → **Browser-Use** (AI)
3. **Execute** → Result

**Példa kód (RobotkezV2):**

```python
# myai/agents/robotkez_v2.py

from browser_use import Browser
from playwright.async_api import async_playwright

class RobotkezV2:
    async def execute(self, instruction: str, mode: str = "auto"):
        # Auto mode: AI decides
        if mode == "auto":
            if self._is_simple(instruction):
                return await self._playwright_execute(instruction)
            else:
                return await self._browser_use_execute(instruction)

        # Manual mode: user chooses
        elif mode == "playwright":
            return await self._playwright_execute(instruction)
        elif mode == "browser-use":
            return await self._browser_use_execute(instruction)

    async def _playwright_execute(self, instruction: str):
        """Gyors, fix selector-os task-ok"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.newPage()
            # ... Playwright logic ...
            await browser.close()

    async def _browser_use_execute(self, instruction: str):
        """Komplex, AI-driven task-ok"""
        async with Browser(llm_model="gemini-2.0-flash") as browser:
            result = await browser.act(instruction)
            return result

    def _is_simple(self, instruction: str) -> bool:
        """AI complexity analysis"""
        simple_keywords = ["screenshot", "pdf", "navigate"]
        return any(kw in instruction.lower() for kw in simple_keywords)
```

---

## 🎓 Összefoglalás (1 perc)

### Puppeteer
- ✅ Gyors, stabil, jó Chrome-hoz
- ❌ Nincs AI, Chrome-only, régebbi API
- **Use case:** Screenshot service, egyszerű scraping

### Playwright
- ✅ Multi-browser, modern API, auto-waiting
- ❌ Nincs AI, manuális selector írás
- **Use case:** Cross-browser testing, E2E tests

### Browser-Use
- ✅ AI-powered, natural language, vision-based
- ❌ Lassú, LLM dependency, új library
- **Use case:** **RobotkezV2** (Brunella AI automation)

### RobotkezV2 Final Stack:
```
Browser-Use (AI) + Playwright (fallback) + Gemini 2.0 Flash
```

**Miért?**
- AI-first (illeszkedik Brunella-hoz)
- Flexible (alkalmazkodik UI változásokhoz)
- Natural language (user friendly)
- Hibrid mode (gyors task-ok Playwright-tel)

---

**Használd Browser-Use-t AI task-okhoz, Playwright-et gyors fix task-okhoz! 🚀**

---

**Készítette:** Claude Sonnet 4.5
**Projekt:** Brunella Agent System
**Verzió:** 1.0.0
**Dátum:** 2026-02-17
