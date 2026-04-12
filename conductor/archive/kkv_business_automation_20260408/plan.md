# Implementacios Terv: KKV uzleti automatizalas masterplan

## Cel
Egyetlen koordinalo roadmap alatt osszehangolni a penzugyi, keszlet, leltar, szamla, hazi penztar es bankintegracios fejleszteseket, hogy a teljes business automatizacios vektor allasa egyben kovetheto legyen.

## Kiindulasi alap
- A `kkv_finance_automation_20260404` es `kkv_inventory_automation_20260404` trackek mar lefutottak.
- A szamlakezelesi es bank/penzugyi pipeline alapok is rendelkezesre allnak.
- A kovetkezo lepes a hianyok koordinalasa es a globalis statusz-kep letrehozasa.

## Fazisok
### 1. Penzugyi reszletezes
- [x] Bankfeed import es bankegyeztetes (BankAgent & AccountingPipeline).
- [x] Hazi penztar / petty cash nyilvantartas (PettyCashAgent).
- [x] Szamla eletciklus formalizalas (TransactionStatus frissites).
- [x] Exception queue es audit trail alapok.


### 2. Keszlet es leltar reszletezes
- [x] `InventoryPipelineAgent` letrehozasa a keszletfolyamatok koordinálására.
- [x] Statisztikai ROP/SS kalkuláció integrálása a pipeline-ba.
- [x] Keszletmozgas eletciklus formalizalas (IN, OUT, SCRAP, ADJUSTMENT, status: COMPLETED/PENDING).
- [x] Beszallitoi PO folyamat human-in-the-loop jovahagyassal (POST /approve-order).
- [x] Leltar / cycle count es eltereskezeles (StocktakeReconciliationAgent integráció: POST /investigate-stocktake).

### 3. Globalis control plane
- [x] Egy dashboard/CLI/Sheets nezettel lathato statusz (`brunella conductor masterplan`, Dashboard `ConductorTracksMonitor`).
- [x] Track csoportok, dependency graph, kockazati jelzok (riskLevel integrálva, track csoportok dashboardon).
- [x] Heti es havi osszegzo reportok (`brunella conductor report`).
- [x] Egyseges progress mezok: status, progress, owner, kovetkezo lepes (nextStep bevezetve).

### 4. Scope gate
- [x] A CRM/HR/marketing vonal maradjon ezen a roadmapon kivul.
- [x] Child track csak akkor kell, ha egy tema onallo implementacios felszinnel vagy kulso integracioval novelodik.
- [x] A masterplan maradjon az egyetlen hely, ahol a teljes KKV backoffice allasa egyben latszik.

### 5. Productization path
- [x] Kezdetben Brunella feluleten, n8n-nel es mas local megoldasokkal marad az operativ use case.
- [x] A domain boundary-ket ugy kell tartani, hogy kesobb kulon service/app legyen belole.
- [x] A kesobbi termekesites tamogassa az ertekesitest, az embedded integraciot es a mas cegekhez valo beillesztest.
- [x] Evolution pattern: strangler fig, hogy a lokalis megoldasokrol fokozatosan lehessen levagni a publikus szolgaltatast.

### 6. Validacio es rollout
- [x] End-to-end szcenariok (npm test sikeresen lefutott).
- [x] Havi zaras / month-end szimulacio (WAC/FIFO agentek stabilizálása).
- [x] Cutover kriteriumok es release gate (Státusz riportok, CLI reportok implementálva).
