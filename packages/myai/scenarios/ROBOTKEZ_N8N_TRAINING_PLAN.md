# Robotkéz n8n Training Plan

## Áttekintés
Fokozatosan nehezedő scenariók az n8n workflow automatizálás gyakorlásához.

## Szintek

| Level | Scenario | Nehézség | Idő | Fő Tanulság |
|-------|----------|----------|-----|-------------|
| 1 | Basic Workflow | Beginner | 60s | Node hozzáadás, kapcsolás, mentés |
| 2 | HTTP Request | Intermediate | 120s | API hívás, JSON feldolgozás |
| 3 | Conditional | Advanced | 180s | IF elágazás, Merge |
| 4 | Webhook API | Advanced | 240s | Webhook, Code node, Response |

## Futtatás

### Egyetlen scenario
```bash
cd F:\mcp-brunella-core
$env:PYTHONPATH = "."
python myai/browser_worker.py --scenario myai/scenarios/n8n_level1_basic.json
```

### Összes scenario sorban
```bash
python myai/browser_worker.py --batch myai/scenarios/n8n_level*.json
```

### Scenario ellenőrzés (dry run)
```bash
python myai/browser_worker.py --check myai/scenarios/n8n_level1_basic.json
```

## Level 1: Basic Workflow
**Cél:** Két node összekapcsolása és futtatása

```
[Manual Trigger] → [Set (message)] → Execute
```

**Megtanulandó:**
- Canvas navigáció
- Node hozzáadása (+ gomb vagy drag)
- Node konfiguráció panel
- Ctrl+S mentés
- Test Workflow gomb

## Level 2: HTTP Request
**Cél:** Külső API hívás és adat feldolgozás

```
[Schedule Trigger] → [HTTP Request] → [Set (parse)] → Execute
                          ↓
                    GitHub API
```

**Megtanulandó:**
- HTTP Request node (GET/POST)
- JSON expression: `{{ $json.field }}`
- URL és headers konfigurálás

## Level 3: Conditional Branching
**Cél:** Feltételes elágazás és ágak összefűzése

```
[Manual Trigger] → [Set (score=75)] → [IF (>=70)]
                                           ↓
                              ┌────────────┴────────────┐
                              ↓                         ↓
                        [Set PASSED]              [Set FAILED]
                              ↓                         ↓
                              └────────────┬────────────┘
                                           ↓
                                       [Merge]
```

**Megtanulandó:**
- IF node konfigurálása
- Több kimenet kezelése
- Merge node használata
- Execution path követése

## Level 4: Webhook API
**Cél:** Külső API endpoint létrehozása

```
[Webhook POST] → [Code (JS)] → [Respond to Webhook]
      ↑                               ↓
      └──────── HTTP Request ─────────┘
```

**Megtanulandó:**
- Webhook node (production mode)
- Code node JavaScript
- Response headers
- Workflow aktiválás

## Validációs Kritériumok

Minden scenario végén ellenőrizni kell:

1. **Struktúra:** Minden node létrejött-e?
2. **Kapcsolatok:** Nodes összekötve?
3. **Konfiguráció:** Beállítások helyesek?
4. **Futtatás:** Test sikeres-e?
5. **Kimenet:** Várt output megjelent-e?

## Hibakezelés

| Hiba | Megoldás |
|------|----------|
| Node nem található | Keresés fallback selector-ral |
| Timeout | Növeld a wait timeout-ot |
| Login szükséges | N8N_TEST_USER/PASSWORD .env-ben |
| Workflow already exists | Random suffix hozzáadása |

## Következő Lépések

1. **Level 1-4 lefuttatása** egyesével
2. **Screenshot gyűjtés** minden lépésnél
3. **Error logging** LanceDB-be
4. **Sikeres minták mentése** Golden Dataset-be

## Cloudflare Browser Integration (Jövő)

Ha Cloudflare Browser Rendering-et használunk:

```javascript
// Worker-ben
const browser = await puppeteer.launch();
const page = await browser.newPage();
await page.goto('http://localhost:5678');
// ... scenario execution
```

**Előnyök:**
- Skálázható (edge-en fut)
- Nincs lokális Chrome dependency
- IP rotation (anti-ban)
