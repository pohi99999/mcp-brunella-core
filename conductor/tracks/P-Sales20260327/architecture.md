# Architektúra — P-Sales20260327

## 1. Cél

A P-Sales20260327 egy közös domain-core-ra épülő értékesítési platform ingatlanokhoz, iparterületekhez és kapcsolódó ingatlanvagyonokhoz. A rendszer ugyanazt az üzleti logikát két szállítási felszínen szolgálja ki:

- BAS enterprise dashboard modul
- külön telepíthető standalone alkalmazás

A core feladata, hogy a dokumentumfeltöltéstől a felmérésen, kutatáson és stratégiaalkotáson át a jóváhagyott végrehajtásig egyetlen, jól auditálható workflow-t biztosítson.

## 2. Tervezési elvek

- Egy domain-core, több UI shell.
- Approval-first működés: külső publikálás vagy megkeresés csak explicit felhasználói jóváhagyással indulhat.
- Reusable services, ne UI-ba ragasztott üzleti logika.
- Source-traceability: minden kutatási és stratégiai döntéshez legyen visszakereshető forrás vagy indoklás.
- Storage-agnostic core: a perzisztencia később cserélhető vagy bővíthető legyen.

## 3. Logikai rétegek

### 3.1 Shared domain core

A shared core tartalmazza azokat a komponenseket, amelyek mindkét felszínen azonosak:

- ingatlanügy / case modell
- dokumentumok feldolgozása és kategorizálása
- hiánylista és megfelelőségi állapot
- kutatási eredmények normalizálása
- stratégia és akcióterv előállítása
- végrehajtási napló és audit események

Ez a réteg nem ismeri a dashboard vagy a standalone shell konkrét UI struktúráját.

### 3.2 BAS enterprise dashboard modul

Az enterprise modul a BAS meglévő dashboardjába illeszkedik. Feladata:

- a belső felhasználók gyors intake nézetének megjelenítése
- kutatási riportok, ár-tartományok és stratégiai ajánlások bemutatása
- approval flow kezelése
- audit és státusz nézetek megjelenítése

Integrációs elv:

- a navigation registry-ben külön panelként jelenjen meg
- a domain-core közvetlenül ne a UI komponensekbe kerüljön
- a BAS auth / RBAC meglévő mechanizmusait használja

### 3.3 Standalone alkalmazás

A standalone shell külön telepíthető, saját brandinggel és önálló deployment útvonallal rendelkezik. Feladata:

- public onboarding
- dokumentumfeltöltés
- egyszerűsített case management
- core workflow futtatása ugyanazzal az üzleti logikával

Standalone követelmények:

- saját entrypoint
- saját konfigurációs réteg
- jövőbeli multi-tenant vagy több-ügyfél modellre alkalmas struktúra
- a BAS-tól független telepíthetőség

### 3.4 Cloudflare edge/backend opció

Ha technikailag kézenfekvő, a standalone útvonalhoz Cloudflare komponensek illeszthetők:

- **R2**: dokumentumok és mellékletek tárolása
- **D1**: metaadatok, workflow állapot és tranzakciós adatok
- **Workers**: edge API, auth és routing
- **KV / Durable Objects**: rövid életű vagy koordinált állapot, ha szükséges

Ez az opció nem kötelező, hanem preferált út ott, ahol egyszerűbbé teszi a nyilvános telepíthetőséget.

## 4. Workflow-folyamat

### 4.1 Intake és felmérés

1. A felhasználó feltölti az eladni kívánt ingatlan dokumentációját.
2. A felmérő ügynök meghatározza az ingatlantípushoz szükséges kötelező iratokat.
3. A rendszer hiánylistát és intake állapotot képez.

### 4.2 Kutatás és értékelés

1. A kutató ügynök külső forrásokból és hasonló ügyletekből gyűjt referenciákat.
2. A rendszer becsült értéktartományt, trendet és kockázati jelzéseket állít elő.
3. Az eredmény struktúrált riportként jelenik meg.

### 4.3 Stratégia és akcióterv

1. A stratégia-tervező ügynök csatornákat és végrehajtási opciókat javasol.
2. A rendszer összeveti a portálos, teaseres, kampányos és direkt megkereséses lehetőségeket.
3. A felhasználó jóváhagyási ponton dönt a folytatásról.

### 4.4 Értékesítési végrehajtás

1. A jóváhagyott terv végrehajtó szakaszba kerül.
2. Az értékesítő ügynök csatornánként naplózza a lépéseket.
3. A felhasználó visszajelzési pontokon újratervezést is kérhet.

## 5. Ügynöki szerepek

- **Felmérő ügynök**: dokumentumigény és hiánylista.
- **Kutató / értékelő ügynök**: piaci összehasonlítás, értéktartomány, források.
- **Stratégia-tervező ügynök**: csatorna-ajánlat, teaser, kampány, direkt outreach.
- **Értékesítő ügynök**: jóváhagyott lépések végrehajtása és logolása.
- **Orchestrator**: állapotkezelés, sorrendiség és approval gate koordináció.

## 6. Javasolt adatmodell

- `PropertyCase`
- `PropertyDocument`
- `RequiredDocument`
- `IntakeChecklistItem`
- `ResearchSource`
- `ResearchReport`
- `StrategyPlan`
- `ApprovalRecord`
- `ExecutionTask`
- `AuditEvent`

Ezek a domain objektumok közösek maradnak mindkét felszín számára.

## 7. Integrációs pontok

### BAS oldalon

- dashboard navigation registry
- enterprise panel komponens
- belső auth / RBAC
- meglévő audit és logging réteg

### Standalone oldalon

- önálló shell és entrypoint
- deployment packaging
- konfigurációs réteg
- nyilvános onboarding / intake felület

### Cloudflare oldalon

- Workers API gateway
- R2 dokumentum storage
- D1 workflow state
- opcionális edge-hosted frontend

## 8. Nem célok

- nem helyettesít jogi vagy hivatalos értékbecslési szakértőt
- nem publikál automatikusan külső hirdetést vagy kampányt jóváhagyás nélkül
- nem bontja meg a közös core-t UI-specifikus forkokra

## 9. Phase 0 kimenet

A Phase 0 eredménye jelenleg ez a dokumentum:

- `conductor/tracks/P-Sales20260327/architecture.md`

A következő logikus lépés az enterprise dashboard panel részletes felépítése.
