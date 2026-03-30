# P-Sales20260327 — Fejlesztési Spec

**Dátum:** 2026-03-30
**Track:** P-Sales20260327
**Státusz:** ACTIVE (visszaállítva archívból)
**Progress célja:** 40% → 100%

---

## Kontextus

A P-Sales20260327 track egy ingatlan- és iparterület-értékesítési platformot épít három delivery surface-szel:
1. BAS enterprise dashboard modul
2. Külön telepíthető standalone PWA alkalmazás
3. Cloudflare edge/backend opció (már meghatározva, Phase 7 kész)

Phase 0 (architektúra), Phase 1 (enterprise dashboard), Phase 6 (végrehajtási flow) és Phase 7 (Cloudflare opció) már **befejezve**. A track korai archivációval lett lezárva, de Phase 2–5 befejezetlen marad.

---

## Meglévő kódbázis (nem kell újraépíteni)

| Fájl | Státusz |
|------|---------|
| `src/data/pSalesTrack.ts` | ✅ Kész — teljes típusrendszer |
| `src/dashboard/components/dashboard/PropertySalesWidget.tsx` | ✅ Kész — enterprise panel, navigation-ban regisztrálva |
| `src/dashboard/components/dashboard/PropertyVisionaryWidget.tsx` | ✅ Kész — regisztrálva |
| `src/p-sales-standalone/App.tsx` + `main.tsx` + `index.html` | ✅ Kész — PWA shell, install prompt |
| `src/agents/PropertyAnalystAgent.ts` | ✅ Kész — OCR, CMA stub |
| `src/agents/SalesAgent.ts` + `SalesHunterAgent.ts` + `MarketingAgent.ts` | ✅ Kész |
| `src/server/routes/sales.ts` | ✅ Kész — regisztrálva |
| `src/cli/commands/property-sales-hu.ts` | ✅ Kész |
| `test/salesHunterAgent.test.ts` + `test/phase4_real_estate.test.ts` | ✅ Megvan |

---

## Phase 2: Standalone Auth Modell

### Cél
JWT-alapú belépési kapu a standalone shellhez. Fix tesztfelhasználók `.env`-ben, tenant-konfig hely kész de üres. Minden kritikus ponton `// TODO: replace with real auth provider` megjegyzés.

### Komponensek

**Backend:**
- `src/server/routes/psales-auth.ts`
  - `POST /api/psales/auth/login` — email+jelszó validálás, JWT kiadás (8h lejárat)
  - `POST /api/psales/auth/verify` — token ellenőrzés
  - JWT secret: `PSALES_JWT_SECRET` env változó
  - Tesztfelhasználók: `PSALES_TEST_USERS` env változó (JSON tömb)

**Frontend (standalone shell):**
- `src/p-sales-standalone/auth/AuthProvider.tsx` — React context, token tárolás sessionStorage-ban
- `src/p-sales-standalone/auth/LoginPage.tsx` — email+jelszó form, error state
- `src/p-sales-standalone/auth/useAuth.ts` — hook: `login()`, `logout()`, `isAuthenticated`
- `src/p-sales-standalone/auth/ProtectedRoute.tsx` — route guard

**Tenant konfig:**
- `src/p-sales-standalone/tenant.config.ts` — üres helyfoglaló, dokumentált `// TODO` mezőkkel

### .env kiegészítés
```env
PSALES_JWT_SECRET=dev-secret-change-in-production
PSALES_TEST_USERS=[{"email":"admin@psales.dev","password":"admin123","role":"admin"},{"email":"demo@psales.dev","password":"demo123","role":"viewer"}]
```

### Tesztek
- `test/psalesAuth.test.ts`
  - Sikeres login → JWT token visszaadva
  - Hibás jelszó → 401
  - Érvényes token verify → 200
  - Lejárt / módosított token → 401

---

## Phase 3: IntakeSurveyAgent

### Cél
Dokumentumfeltöltési folyam + hiánylista generáló ügynök. Ingatlantípus alapján megmondja, mely iratok kötelezők, melyek hiányoznak, és számolja a teljességet.

### Komponensek

**Agent:**
- `src/agents/IntakeSurveyAgent.ts` — `IAgent` interfész
  - `execute("survey", { propertyType, uploadedDocs })` → hiánylista + teljességjelző %
  - `execute("checklist", { propertyType })` → kötelező iratok listája
  - 3 alaptípus: `apartment`, `house`, `industrial`
  - Mock adatok — production interface-szel (`// TODO: connect real document storage`)

**Routes:**
- `src/server/routes/psales-intake.ts`
  - `POST /api/psales/intake/survey` — felmérés futtatása
  - `GET /api/psales/intake/checklist/:type` — kötelező iratok
  - Regisztrálás: `src/server/routes/index.ts`-ben

**Dashboard:**
- `src/dashboard/components/dashboard/PSalesIntakePanel.tsx`
  - Típus választó (apartment/house/industrial)
  - Feltöltött dokumentumok listája (mock toggle-ökkel)
  - Hiánylista megjelenítés
  - Teljességjelző progress bar
  - Regisztrálás: `navigation.tsx`-ben

**Kötelező iratok típusonként (mock):**
- `apartment`: tulajdoni lap, alaprajz, közös képviselői igazolás, energetikai tanúsítvány
- `house`: tulajdoni lap, helyszínrajz, használatbavételi engedély, közműdokumentumok
- `industrial`: tulajdoni lap, területrendezési igazolás, környezeti nyilatkozat, műszaki dokumentáció, közlekedési elérhetőség

### Tesztek
- `test/intakeSurveyAgent.test.ts`
  - Minden típusra helyes kötelező lista
  - Hiánylista korrekt számítása (uploaded vs required)
  - Teljességjelző % (0, 50, 100)
  - Ismeretlen típus → graceful error

---

## Phase 4: PropertyResearchAgent

### Cél
Piaci összehasonlítás, értéktartomány és kutatási riport — mock adatokkal, de production-ready interfésszel (valódi web keresés later swap-elhető).

### Komponensek

**Agent:**
- `src/agents/PropertyResearchAgent.ts` — `IAgent` interfész
  - `execute("analyze", { location, propertyType, areaSqm, askingPrice })` → riport
  - Mock comparables: 5 hasonló ingatlan generálva lokáció+típus alapján
  - Értéktartomány: konzervatív / cél / gyorseladási ár
  - Kockázati jelzések: dokumentáció, teher, likviditás, volatilitás
  - Production interface: `// TODO: replace mock with ResearcherAgent web scraping`

**Routes:**
- `src/server/routes/psales-research.ts`
  - `POST /api/psales/research/analyze` — riport generálás
  - Regisztrálás: `index.ts`-ben

**Dashboard:**
- `src/dashboard/components/dashboard/PSalesResearchPanel.tsx`
  - Input form (lokáció, típus, terület, kért ár)
  - Összehasonlítók táblázat
  - Értéktartomány vizualizáció
  - Kockázati jelzések badge-ek
  - Regisztrálás: `navigation.tsx`-ben

### Mock logika
```
lokáció + típus + terület → base EUR/m² × terület = becsült érték
konzervatív = becsült × 0.85
cél = becsült × 1.00
gyors = becsült × 0.75
kockázat = random(2-4 jelzés) az előre definiált listából
```

### Tesztek
- `test/propertyResearchAgent.test.ts`
  - Értéktartomány: konzervatív < cél, gyors < konzervatív
  - Comparables: minimum 3, helyes mezők
  - Kockázati jelzések: nem üres tömb
  - Riport struktúra: minden kötelező mező jelen van
  - Ismeretlen lokáció → Budapest fallback

---

## Phase 5: StrategyPlannerAgent

### Cél
Értékesítési csatorna ajánlat, jóváhagyási kapu (approval gate), döntéshozói célcsoport lista.

### Komponensek

**Agent:**
- `src/agents/StrategyPlannerAgent.ts` — `IAgent` interfész
  - `execute("plan", { propertyProfile, researchReport })` → stratégiai terv
  - `execute("approve", { planId, decision })` → approval state update
  - Approval state machine: `pending` → `approved` | `rejected`
  - Mock célcsoport: befektetők, fejlesztők, ipari vevők, portál keresők
  - Production interface: `// TODO: connect real outreach execution`

**Routes:**
- `src/server/routes/psales-strategy.ts`
  - `POST /api/psales/strategy/plan` — terv generálás
  - `POST /api/psales/strategy/approve` — jóváhagyás / elutasítás
  - `GET /api/psales/strategy/:planId` — terv lekérés
  - Regisztrálás: `index.ts`-ben

**Dashboard:**
- `src/dashboard/components/dashboard/PSalesStrategyPanel.tsx`
  - Csatorna mix ajánlás (priorizált lista)
  - Célcsoport táblázat
  - Approval gate UI (Approve / Reject gombok, pending badge)
  - Összefoglaló riport preview
  - Regisztrálás: `navigation.tsx`-ben

### Approval state machine
```
PENDING → [user approves] → APPROVED → végrehajtás engedélyezett
PENDING → [user rejects]  → REJECTED → replan trigger
APPROVED → [user revokes] → PENDING
```

### Tesztek
- `test/strategyPlannerAgent.test.ts`
  - Terv generálás: csatornák, célcsoport, approval state = pending
  - Approve → state = approved
  - Reject → state = rejected
  - Approved nélkül nem indul végrehajtás (guard teszt)
  - Riport: minden kötelező szekció jelen van

---

## Track visszaállítás

### Lépések
1. `conductor/archive/P-Sales20260327/` → `conductor/tracks/P-Sales20260327/` mozgatás
2. `meta.json` frissítés: `status: "active"`, `progress: 40`
3. `conductor/tracks.md` frissítés: Active szekcióba felvétel, Archived-ból törlés

### Frissített progress lépések
| Fázis | Progress hozzájárulás |
|-------|-----------------------|
| Phase 0-1, 6-7 (kész) | 40% |
| Phase 2 (auth) | +15% → 55% |
| Phase 3 (intake) | +15% → 70% |
| Phase 4 (research) | +15% → 85% |
| Phase 5 (strategy) | +15% → 100% |

---

## Szállítási sorrend

1. Track visszaállítás (git move + meta.json + tracks.md)
2. Phase 2: psales-auth route + AuthProvider + LoginPage + useAuth + ProtectedRoute + teszt
3. Phase 3: IntakeSurveyAgent + psales-intake route + PSalesIntakePanel + teszt
4. Phase 4: PropertyResearchAgent + psales-research route + PSalesResearchPanel + teszt
5. Phase 5: StrategyPlannerAgent + psales-strategy route + PSalesStrategyPanel + teszt
6. `npm run build` + `npm run test:fast` — minden fázis után

---

## Nem szerepel ebben a spec-ben

- Valódi auth provider integráció (Clerk/Auth.js) — future Phase 2b
- Valódi web keresés a ResearchAgent-ben — future Phase 4b
- Cloudflare R2/D1 tényleges bekötés — future Phase 7b
- Email küldés / outreach végrehajtás — future Phase 6b
