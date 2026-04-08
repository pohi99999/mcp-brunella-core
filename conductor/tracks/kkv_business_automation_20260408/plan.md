# Implementacios Terv: KKV uzleti automatizalas masterplan

## Cel
Egyetlen koordinalo roadmap alatt osszehangolni a penzugyi, keszlet, leltar, szamla, hazi penztar es bankintegracios fejleszteseket, hogy a teljes business automatizacios vektor allasa egyben kovetheto legyen.

## Kiindulasi alap
- A `kkv_finance_automation_20260404` es `kkv_inventory_automation_20260404` trackek mar lefutottak.
- A szamlakezelesi es bank/penzugyi pipeline alapok is rendelkezesre allnak.
- A kovetkezo lepes a hianyok koordinalasa es a globalis statusz-kep letrehozasa.

## Fazisok
### 1. Penzugyi reszletezes
- Bankfeed import es bankegyeztetes.
- Hazi penztar / petty cash nyilvantartas.
- Szamla eletciklus: bejovo, egyeztetett, jovahagyott, fizetett, eskalalt.
- Exception queue es audit trail.

### 2. Keszlet es leltar reszletezes
- Mozgasok, minimum keszlet, reorder.
- Leltar / cycle count es eltereskezeles.
- Beszallitoi draft vagy automatikus rendeles.
- Raktar es egyenleg eltérések.

### 3. Globalis control plane
- Egy dashboard/CLI/Sheets nezettel lathato statusz.
- Track csoportok, dependency graph, kockazati jelzok.
- Heti es havi osszegzo reportok.
- Egyseges progress mezok: status, progress, owner, kovetkezo lepes.

### 4. Scope gate
- A CRM/HR/marketing vonal maradjon ezen a roadmapon kivul.
- Child track csak akkor kell, ha egy tema onallo implementacios felszinnel vagy kulso integracioval novelodik.
- A masterplan maradjon az egyetlen hely, ahol a teljes KKV backoffice allasa egyben latszik.

### 5. Productization path
- Kezdetben Brunella feluleten, n8n-nel es mas local megoldasokkal marad az operativ use case.
- A domain boundary-ket ugy kell tartani, hogy kesobb kulon service/app legyen belole.
- A kesobbi termekesites tamogassa az ertekesitest, az embedded integraciot es a mas cegekhez valo beillesztest.
- Evolution pattern: strangler fig, hogy a lokalis megoldasokrol fokozatosan lehessen levagni a publikus szolgaltatast.

### 6. Validacio es rollout
- End-to-end szcenariok.
- Havi zaras / month-end szimulacio.
- Cutover kriteriumok es release gate.
