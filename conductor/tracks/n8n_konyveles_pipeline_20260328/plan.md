# Végrehajtási Terv: n8n Könyvelési Pipeline

**Track ID:** `n8n_konyveles_pipeline_20260328`
**Becsült idő:** Phase 1: 3 nap · Phase 2: 3 nap · Phase 3: külön track

---

## Phase 1 — Bank egyeztetés + n8n alapinfra (3 nap)

### 1.1 n8n infrastruktúra beállítása

- [ ] n8n instance elindítása és elérhetőség ellenőrzése (`http://localhost:5678`)
- [ ] BAS HTTP credential létrehozása n8n-ben (`http://localhost:3000`)
- [ ] SMTP credential konfigurálása n8n-ben (email értesítőkhöz)
- [ ] IMAP credential konfigurálása n8n-ben (bejövő számlák figyeléséhez)
- [ ] `data/bank-imports/` mappa létrehozása (bank CSV drop zone)
- [ ] `.gitignore` frissítése: `data/bank-imports/*.csv` (érzékeny adatok)

### 1.2 Hiányzó BAS endpoint: PATCH /api/v1/bookkeeping/status

- [ ] Route létrehozása: `src/server/routes/bookkeeping.ts` (ha még nincs)
  ```typescript
  PATCH /api/v1/bookkeeping/status
  Body: { summary: BookkeepingSummary, exceptions: BookkeepingException[], timestamp: string }
  ```
- [ ] Route regisztrálása `src/server/routes/index.ts`-ben
- [ ] `BookkeepingWidget` frissítése: `/api/v1/bookkeeping/status` GET endpoint és polling

### 1.3 WF-4 — Exception & Notify workflow (először, mert a többi ezt hívja)

- [ ] n8n workflow importálása: `conductor/tracks/n8n_konyveles_pipeline_20260328/n8n-workflows/wf4-exception-notify.json`
- [ ] Webhook endpoint tesztelése: `POST http://localhost:5678/webhook/notify`
- [ ] SMTP email sablon beállítása
- [ ] `data/konyveles/exceptions.json` írási jogosultság ellenőrzése
- [ ] Teszt: manuális webhook hívás → email megérkezik + dashboard frissül

### 1.4 WF-1 — Email Intake workflow

- [ ] n8n IMAP trigger konfigurálása (poll interval: 5 perc)
- [ ] EmailAgent hívás node konfigurálása
- [ ] WF-3 webhook trigger csatolása (NAV validációhoz)
- [ ] Hiba ág → WF-4 webhook
- [ ] Teszt: teszt email küldése csatolmánnyal → EmailAgent feldolgozza

### 1.5 WF-2 — Bank Reconciliation workflow

- [ ] File watch node konfigurálása (`data/bank-imports/*.csv`)
- [ ] Cron trigger beállítása (08:00 naponta)
- [ ] BankAgent HTTP node konfigurálása
- [ ] MatchingAgent HTTP node konfigurálása
- [ ] Unmatched IF elágazás → WF-4
- [ ] Sikeres ág → PATCH /api/v1/bookkeeping/status
- [ ] Teszt: minta CSV elhelyezése → automatikus párosítás lefut

### 1.6 WF-3 — NAV Validation workflow

- [ ] Webhook endpoint: `/n8n/nav-validate`
- [ ] NavAgent HTTP node konfigurálása
- [ ] MISMATCH IF elágazás → WF-4
- [ ] Teszt: minta invoice NAV validáció futtatása

### 1.7 Phase 1 integrációs teszt

- [ ] Teljes email → parse → NAV → match → értesítés folyamat futtatása
- [ ] Kivétel email ellenőrzése
- [ ] Dashboard frissülés ellenőrzése
- [ ] n8n execution log ellenőrzése (hibák, retry-ok)

---

## Phase 2 — KP Pénztár modul (3 nap)

### 2.1 SQLite — cash_entries tábla

- [ ] `src/data/bookkeeping_db.ts` bővítése:
  ```sql
  CREATE TABLE IF NOT EXISTS cash_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('KP_IN','KP_OUT')),
    amount REAL NOT NULL,
    description TEXT NOT NULL,
    invoice_number TEXT,
    source TEXT DEFAULT 'manual',
    synced_sheets INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );
  ```
- [ ] Migration futtatása meglévő adatbázison
- [ ] TypeScript típus hozzáadása: `CashEntry` interface a `src/types/bookkeeping.d.ts`-be

### 2.2 BAS REST API — KP endpoint-ok

- [ ] `src/server/routes/bookkeeping.ts` bővítése:
  - [ ] `POST /api/v1/bookkeeping/cash-entries` — tétel felvitele
  - [ ] `GET /api/v1/bookkeeping/cash-entries` — lista (szűrők: date_from, date_to, type, synced_sheets)
  - [ ] `GET /api/v1/bookkeeping/cash-summary` — egyenleg összesítő
  - [ ] `PATCH /api/v1/bookkeeping/cash-entries/:id` — synced_sheets flag frissítése
- [ ] Route-ok regisztrálása `index.ts`-ben
- [ ] Vitest tesztek az új endpoint-okhoz

### 2.3 Dashboard — HázipénztárWidget

- [ ] `src/dashboard/components/dashboard/HázipénztárWidget.tsx` létrehozása:
  - [ ] Egyenleg sáv (nyitó → mozgások → záró)
  - [ ] Tétel lista (dátum, típus badge, összeg, leírás, forrás, Sheets szinkron státusz)
  - [ ] Új tétel form (dátum, KP_IN/KP_OUT toggle, összeg, leírás, számlaszám)
  - [ ] 30 másodperces auto-refresh
- [ ] Regisztrálás `src/dashboard/lib/navigation.tsx`-ben (NavigationRegistry)
- [ ] `src/dashboard/lib/apiService.ts` bővítése KP endpoint-okkal

### 2.4 Google Sheets credential és tábla

- [ ] Google Cloud projekt + OAuth2 credential létrehozása
- [ ] Google Sheets tábla létrehozása (vagy meglévő azonosítása):
  ```
  | Dátum | Típus | Összeg | Leírás | Számlaszám | Forrás | BAS ID |
  ```
- [ ] Sheets ID és range konfiguráció n8n credential-ben

### 2.5 WF-5 — KP Pénztár workflow

- [ ] WF-5a: Email KP intake (IMAP trigger KP filter → EmailAgent → cash-entries POST)
- [ ] WF-5b: Sheets szinkron webhook (`/n8n/sheets-sync`)
  - [ ] Szinkronatlan tételek lekérése (`synced_sheets=0`)
  - [ ] Google Sheets sor hozzáadás
  - [ ] `synced_sheets: 1` flag visszaírása BAS-ba
  - [ ] Hiba ág → WF-4
- [ ] WF-5c: Dashboard manuális bevitel → webhook trigger → WF-5b automatikus hívása
- [ ] Teszt: manuális tétel → 60 másodpercen belül Sheets-ben megjelenik

### 2.6 Phase 2 integrációs teszt

- [ ] Manuális KP tétel felvitele Dashboard-ról → Sheets szinkron ellenőrzése
- [ ] KP email csatolmány küldése → automatikus feldolgozás ellenőrzése
- [ ] Egyenleg összesítő helyességének ellenőrzése
- [ ] Hiba szimulálása (Sheets API hibát dob) → email értesítő megérkezik

---

## Phase 3 — szamlazz.hu (Tervezett — külön track)

Ez a phase nem kerül implementálásra ebben a trackben. Előfeltételek amikre szükség lesz:
- [ ] szamlazz.hu API kulcs megszerzése
- [ ] szamlazz.hu API dokumentáció áttekintése (kiállított számlák lekérése)
- [ ] Döntés: n8n szamlazz.hu node vs. egyedi HTTP hívás
- [ ] Új track létrehozása: `szamlazz_hu_integration_{dátum}`

---

## n8n Workflow fájlok

A workflow-ok exportált JSON formátumban kerülnek a track mappájába:

```
conductor/tracks/n8n_konyveles_pipeline_20260328/
  n8n-workflows/
    wf1-email-intake.json
    wf2-bank-reconciliation.json
    wf3-nav-validation.json
    wf4-exception-notify.json
    wf5-kp-penztár.json
```

Importálás n8n-be: Settings → Import from file.

---

## Környezeti változók (.env kiegészítés)

```env
# n8n könyvelési pipeline
N8N_BASE_URL=http://localhost:5678
N8N_WEBHOOK_NOTIFY=http://localhost:5678/webhook/notify
N8N_WEBHOOK_NAV_VALIDATE=http://localhost:5678/webhook/nav-validate
N8N_WEBHOOK_SHEETS_SYNC=http://localhost:5678/webhook/sheets-sync
BOOKKEEPING_NOTIFY_EMAIL=konyveles@example.com
GOOGLE_SHEETS_ID=                    # Phase 2-ben kitöltendő
```

---

## Kockázatok

| Kockázat | Valószínűség | Kezelés |
|----------|-------------|---------|
| IMAP provider blokkolja a poll-t | KÖZEPES | App-specific password vagy OAuth2 IMAP |
| Google Sheets API kvóta (100 req/100s) | ALACSONY | n8n rate limiting node |
| n8n és BAS port konfliktus | ALACSONY | n8n port konfigurálható |
| NAV API ideiglenes leállás | KÖZEPES | WF-3 retry + exception értesítő |
