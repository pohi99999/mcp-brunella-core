# Specifikáció: n8n Könyvelési Pipeline

**Track ID:** `n8n_konyveles_pipeline_20260328`
**Prioritás:** HIGH
**Tulajdonos:** Pohánka Péter
**Létrehozva:** 2026-03-28
**Függőség:** `konyveles_automatizalas` (meglévő ügynökök és adatbázis)

---

## 1. Célkitűzés

Hibrid n8n + BAS architektúra, amely automatizálja a teljes könyvelési folyamatot:
- **Bank egyeztetés:** bejövő utalásos számlák automatikus párosítása a bankszámla-forgalommal
- **KP pénztár:** készpénzes mozgások nyilvántartása, SQLite igazságforrással, Google Sheets szinkronnal
- **Értesítések:** kivételek esetén Dashboard + email értesítés

**Nem cél most:** szamlazz.hu kimenő számlázás automatizálása (Phase 3, külön track).

---

## 2. Architektúra

### Határvonal

| Felelős | Feladat |
|---------|---------|
| **n8n** | IMAP watch, file watch, cron ütemezés, retry (max 3x / 30s), email küldés, Google Sheets API hívás, webhook hívások BAS felé |
| **BAS** | Minden üzleti logika: invoice parse, bank-számla match, NAV validáció, SQLite írás/olvasás, Dashboard megjelenítés |

### Rendszer diagram

```
KÜLSŐ VILÁG              n8n (trigger + glue)           BAS (belső logika)
────────────────────────────────────────────────────────────────────────
Email (IMAP) ──────────► WF-1: Email Intake      ──►  EmailAgent
Bank CSV ───────────────► WF-2: Bank Reconcile    ──►  BankAgent + MatchingAgent
                         WF-3: NAV Validation    ──►  NavAgent
                         WF-4: Exception+Notify  ──►  Dashboard webhook + SMTP
KP manuális/email ──────► WF-5: KP Pénztár       ──►  cash_entries API + Sheets
```

### n8n futtatás

- **Mód:** self-hosted local npm workspace (`conductor/tracks/n8n_konyveles_pipeline_20260328/local-n8n/`, `npm run dev` → track-local launcher → `n8n start`)
- **Import:** `npm run import:workflows` betölti a WF-1..WF-4 scaffoldokat a track `n8n-workflows/` mappájából
- **Port:** 5678 (alapértelmezett)
- **BAS API alap URL:** `http://localhost:3000`
- **Credentials store:** n8n beépített credential vault (SMTP, Google OAuth2, IMAP)

---

## 3. Phase 1 — Bank egyeztetés ág

### 3.1 Triggerek

| Trigger | Leírás |
|---------|--------|
| IMAP poll (5 percenként) | Új email csatolmánnyal (PDF/XML számla) |
| File watch | Új CSV a `data/bank-imports/` mappában |
| Cron (08:00 naponta) | Elmaradt feldolgozások pótlása |

### 3.2 Workflow-ok

**WF-1: Email Intake**
1. IMAP Trigger → csatolmány kinyerés
2. `POST /api/v1/agents/EmailAgent/execute` → parsed invoice JSON
3. invoice_data mentés → WF-3 triggerelése (NAV validáció)
4. Hiba → WF-4 (exception)

**WF-2: Bank Reconciliation**
1. File watch VAGY cron trigger → CSV elérési út
2. `POST /api/v1/agents/BankAgent/execute` → tranzakciók importálása
3. `POST /api/v1/agents/MatchingAgent/execute` → párosítás futtatása
4. Ha `unmatched > 0` → WF-4 triggerelése
5. Ha sikeres → `PATCH /api/v1/bookkeeping/status` (dashboard frissítés)

**WF-3: NAV Validation**
1. Webhook: `POST /n8n/nav-validate` (WF-1-től hívódik)
2. `POST /api/v1/agents/NavAgent/execute` → NAV státusz lekérés
3. Ha `nav_status == MISMATCH` → WF-4 triggerelése
4. Ha `nav_status == OK` → noop

**WF-4: Exception & Notify**
1. Webhook: `POST /n8n/notify` (bármely WF-ből hívható)
2. Kivételek aggregálása (unmatched, NAV mismatch, hiányzó PDF)
3. `PATCH /api/v1/bookkeeping/status` → Dashboard frissítés
4. Ha `exceptions.length > 0`:
   - SMTP email küldés a tulajdonosnak
5. `data/konyveles/exceptions.json` írása (perzisztencia)

### 3.3 Retry stratégia

- Minden BAS API hívás: max 3 próbálkozás, 30 másodperc várakozással
- 3 sikertelen próbálkozás után: WF-4 exception-ba kerül
- n8n beépített execution log megőrzi a hibákat

### 3.4 BAS endpoint

```
PATCH /api/v1/bookkeeping/status
Body: { summary: {...}, exceptions: [...], timestamp: string }
```

Ez a BAS endpoint már elérhető; a repo oldali workflow scaffoldok most erre épülnek.

---

## 4. Phase 2 — KP Pénztár modul

### 4.1 Adatmodell

Új tábla a meglévő `src/data/bookkeeping_db.ts`-ben:

```sql
CREATE TABLE cash_entries (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  date        TEXT NOT NULL,
  type        TEXT NOT NULL CHECK(type IN ('KP_IN','KP_OUT')),
  amount      REAL NOT NULL,
  description TEXT NOT NULL,
  invoice_number TEXT,
  source      TEXT DEFAULT 'manual', -- 'manual' | 'email' | 'import'
  synced_sheets INTEGER DEFAULT 0,
  created_at  TEXT DEFAULT (datetime('now'))
);
```

### 4.2 Új BAS endpoint-ok

```
POST   /api/v1/bookkeeping/cash-entries     → KP tétel felvitele
GET    /api/v1/bookkeeping/cash-entries     → lista, szűrők: date_from, date_to, type
GET    /api/v1/bookkeeping/cash-summary     → nyitó/záró egyenleg, havi összesítő
```

### 4.3 Workflow-ok

**WF-5: KP Pénztár**

*5a — Email-ből kinyert KP számla:*
1. IMAP Trigger (KP tag VAGY tárgy tartalmaz "készpénz"/"kp")
2. `POST /api/v1/agents/EmailAgent/execute` → KP invoice parse
3. `POST /api/v1/bookkeeping/cash-entries` → SQLite mentés (`source: 'email'`)
4. Webhook trigger → Sheets szinkron (WF-5b)

*5b — Google Sheets szinkron:*
1. Webhook: `POST /n8n/sheets-sync`
2. `GET /api/v1/bookkeeping/cash-entries?synced_sheets=0` → szinkronatlan tételek
3. Google Sheets API: sor hozzáadás
   ```
   | Dátum | Típus | Összeg | Leírás | Számlaszám | Forrás |
   ```
4. `PATCH /api/v1/bookkeeping/cash-entries/:id` → `synced_sheets: 1`
5. Hiba → WF-4 (exception + email)

*5c — Manuális bevitel (Dashboard-ból):*
1. `HázipénztárWidget` → form submit
2. `POST /api/v1/bookkeeping/cash-entries` → SQLite mentés (`source: 'manual'`)
3. n8n webhook trigger → automatikus Sheets szinkron (WF-5b)

### 4.4 Dashboard — HázipénztárWidget

Új panel (`src/dashboard/components/dashboard/HázipénztárWidget.tsx`):
- **Egyenleg sáv:** nyitó egyenleg → mozgások → záró egyenleg
- **Tétel lista:** dátum, típus (be/ki), összeg, leírás, forrás badge (email/manuális)
- **Új tétel form:** dátum, típus, összeg, leírás, opcionális számlaszám
- **Sheets státusz badge:** szinkronizált / folyamatban / hiba

Regisztrálás: `src/dashboard/lib/navigation.tsx` → NavigationRegistry.

---

## 5. Phase 3 — szamlazz.hu (Tervezett, külön track)

A szamlazz.hu integráció a cég **kimenő** számlázásáért felelős. Ez önálló pipeline lesz:
- szamlazz.hu API → kiállított számlák lekérése
- NAV Online Számla rendszerbe automatikus beküldés
- BAS MatchingAgent-be visszacsatolás (kiállított számla → bank egyeztetés)

**Ez a track NEM tartalmazza a szamlazz.hu implementációt.** Külön track kerül létrehozásra amikor a könyvelési pipeline (Phase 1+2) stabilan fut.

---

## 6. Értesítési rendszer

### Email értesítő tartalom (kivételek esetén)

```
Tárgy: [Brunella] Könyvelési kivételek — {YYYY-MM-DD}

Összesítő:
  - Feldolgozott tranzakciók: {n}
  - Sikeresen párosítva: {n}
  - Párosítatlan: {n}
  - NAV eltérés: {n}
  - KP szinkron hiba: {n}

Kivételek részletei:
  [lista]

Részletek: http://localhost:5173 → Könyvelés panel
```

### Dashboard értesítés

- `BookkeepingWidget`: összesítő badge (matched/unmatched/KP)
- `HázipénztárWidget`: Sheets szinkron státusz
- Mindkét widget 30 másodpercenként auto-frissül

---

## 7. Függőségek és előfeltételek

| Elem | Állapot |
|------|---------|
| EmailAgent, BankAgent, MatchingAgent, NavAgent | ✅ Kész |
| `bookkeeping_db.ts` (transactions tábla) | ✅ Kész |
| `BookkeepingWidget` (Dashboard) | ✅ Kész |
| n8n self-hosted futó instance | ⚠️ Szükséges (local npm workspace) |
| Google OAuth2 credential (Sheets) | ⚠️ Szükséges |
| SMTP credential (email értesítő) | ⚠️ Szükséges |
| `PATCH /api/v1/bookkeeping/status` | ✅ Kész |
| `POST/GET /api/v1/bookkeeping/cash-entries` | ❌ Létrehozandó |
| `cash_entries` SQLite tábla | ❌ Létrehozandó |
| `HázipénztárWidget` | ❌ Létrehozandó |

---

## 8. Siker kritériumok

**Phase 1 kész, ha:**
- Bejövő email csatolmány 5 percen belül feldolgozódik és SQLite-ba kerül
- Bank CSV feltöltés után MatchingAgent automatikusan fut
- Kivétel esetén email értesítő megérkezik
- Dashboard BookkeepingWidget frissül

**Phase 2 kész, ha:**
- KP tétel manuálisan felvihető a Dashboard-ról
- KP email csatolmány automatikusan feldolgozódik
- Google Sheets sor létrejön 60 másodpercen belül a tétel felvitele után
- HázipénztárWidget helyesen mutatja az egyenleget
