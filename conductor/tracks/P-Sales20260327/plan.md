# Implementációs terv: P-Sales20260327
**Track ID:** `P-Sales20260327`

## Cél
Egy közös domain-core-ra épülő ingatlan- és iparterület-értékesítési megoldás létrehozása három jól elkülönített szállítási réteggel:
1. a BAS enterprise dashboard modulja
2. egy külön telepíthető standalone alkalmazás
3. ahol praktikus, Cloudflare-alapú edge/backend réteg

A megoldás a dokumentumfeltöltéstől a piackutatáson és stratégiatervezésen át az emberi jóváhagyással vezérelt értékesítési végrehajtásig segíti a felhasználót.

## Phase 0: Architektúra és szállítási modell
- [x] Közös domain-core és agent szerepkörök meghatározása.
- [x] A három szállítási réteg közötti felelősségi határok rögzítése.
- [x] Shared core és UI shell szétválasztási szabályok meghatározása.
- [x] Cloudflare használati döntési pontok (ha praktikus, akkor edge/backend).
- [x] Phase 0 formális output: `architecture.md`.

## Phase 1: Enterprise dashboard integráció
- [x] Panel helyének kijelölése a BAS dashboard Enterprise részében.
- [x] Beágyazott modern belépőfelület és gyors áttekintő nézet.
- [x] Ingatlanprofil, dokumentumcsomag és státuszmodell kialakítása.
- [ ] Dokumentumfeltöltés, hiánylista és felmérési állapot panel.
- [ ] Kutatási riport, stratégia és approval nézetek az Enterprise felületen.
- [x] Shared core összehangolása a dashboard registry-vel.

## Phase 2: Standalone alkalmazás
- [x] Különálló app shell és saját entrypoint létrehozása.
- [ ] Telepíthető csomagolási stratégia és deployment útvonal.
- [ ] Saját branding, onboarding és alap auth modell.
- [ ] A standalone app és az enterprise modul közös logikai rétegének kialakítása.
- [ ] Public-facing landing / intake flow, amely más felhasználóknak is telepíthetővé teszi a megoldást.
- [ ] Konfigurációs modell a jövőbeli több-tenant vagy több-ügyfél használathoz.

## Phase 3: Intake és felmérő ügynök
- [ ] Dokumentumfeltöltési folyam és hiánylista.
- [ ] Ingatlantípus alapján kötelező iratok generálása.
- [ ] Felmérő ügynök, amely kérdez és dokumentumokat ellenőriz.
- [ ] Különböző ingatlantípusokhoz igazított checklist szabályok.
- [ ] Feltöltött anyagokból ingatlan-profil és intake státusz előállítása.

## Phase 4: Kutató és értékelő ügynök
- [ ] Piaci összehasonlítások és korábbi eladások gyűjtése.
- [ ] Értéktartomány, trendek és kockázati jelzések számítása.
- [ ] Kutatási riport generálása referenciákkal.
- [ ] Külső adatforrások későbbi cserélhetőségének biztosítása.
- [ ] A kutatási eredmények átadási formátuma mind az enterprise, mind a standalone felülethez.

## Phase 5: Stratégia és akcióterv
- [ ] Stratégia-tervező ügynök kialakítása.
- [ ] Csatornaajánlat: portál, célzott kampány, teaser, direkt megkeresés.
- [ ] Döntéshozói és érdeklődői targetlista javaslata.
- [ ] Jóváhagyási kapu és végrehajtási összefoglaló.
- [ ] A stratégiai ajánlás külön nézetben megjeleníthető legyen az enterprise felületen.

## Phase 6: Értékesítési végrehajtás
- [ ] A jóváhagyott akcióterv végrehajtási flow-ja.
- [ ] Csatornánkénti státusz- és eredménykövetés.
- [ ] Felhasználói visszajelzés és újratervezési pontok.
- [ ] Záró riport és audit napló.
- [ ] Egységes végrehajtási napló a dashboard és a standalone app számára.

## Phase 7: Cloudflare opció
- [ ] R2 a dokumentumok tárolására.
- [ ] D1 a metadatákhoz, workflow állapothoz és tranzakciós adatokhoz.
- [ ] Workers mint edge API / auth / routing réteg.
- [ ] KV vagy Durable Objects a rövid életű állapothoz, ha szükséges.
- [ ] Nyilvánosan telepíthető app útvonal kialakítása.
- [ ] Preview / staging útvonalak és edge konfiguráció.

## Megjegyzések
- Minden külső publikálás vagy megkeresés előtt explicit felhasználói jóváhagyás kell.
- A rendszer támogatja az értékesítési döntést, de nem helyettesíti a jogi vagy értékbecslési szakértőt.
- Ha új BAS-szintű képesség jelenik meg, a dashboard és a CLI útját is meg kell tervezni.
- A Phase 0 architektúra kimenete: `architecture.md`.
- A Phase 1 shell és CLI belépő: `PropertySalesWidget` + `ingatlan-ertekesites`.
