# Specifikacio: KKV uzleti automatizalas masterplan

## Hatter
A business automation stream jelenleg tobb kulon trackben fut. Ez a masterplan egyesiti a penzugyi, keszlet, leltar, szamla, hazi penztar es bankintegracios fejlesztesek allapotat, es koordinalja a kovetkezo koroket.

## Scope
- Bankfeed import es reconciliation
- Hazi penztar / petty cash nyilvantartas
- Szamla teljes eletciklus
- Keszletmozgas, reorder, leltar
- Globalis statusz dashboard
- Kovetkezo child trackek kijelolese

## Outside scope
- CRM, HR es marketing automatikus kiterjesztesek
- Nem kapcsolodo business automations
- Kulso integraciok, ha nem a penzugyi vagy keszlet folyamhoz tartoznak

## Future evolution
- Kezdetben Brunella feluleten, n8n-nel es mas local megoldasokkal marad az operativ use case.
- A domain boundary-ket ugy kell tartani, hogy kesobb kulon service/app legyen belole.
- A kesobbi termekesites tamogassa az ertekesitest, az embedded integraciot es a mas cegekhez valo beillesztest.
- A migralhatosagot strangler fig elvvel kell megtervezni, hogy a lokalis megoldasokrol fokozatosan lehessen levagni a publikus szolgaltatast.

## Acceptance kriteriumok
- Minden fo domainhez van state, owner, dependency es kovetkezo lepes.
- A track a korabbi finance, inventory es invoice work baseline-jara epul.
- A globalis dashboard egyben mutatja a business automation progresszt.
- A scope split szabaly szerint csak a nagyobb implementacios feluletekbol lesz child track.
- A roadmap szovegesen is jelzi, hogy a kezdeti Brunella-local forma kesobb standalone szolgaltatassa alakulhat.

## Rollout
- Elso korben roadmap baseline es gap analysis.
- Masodik korben finance es bankintegracios reszletek.
- Harmadik korben inventory es leltar reszletek.
- Negyedik korben unified reporting es cutover.