# Specifikáció: P-Sales20260327
**Track ID:** `P-Sales20260327`
**Státusz:** proposed
**Prioritás:** HIGH

## 1. Termékvízió
A termék egy modern, letisztult ingatlan- és iparterület-értékesítési platform, amely ugyanazzal a domain core-ral két külön felszínt szolgál ki:
- a BAS enterprise dashboard modulját
- egy külön telepíthető standalone alkalmazást

A felhasználó dokumentumfeltöltéstől jut el a felmérésen, piackutatáson és stratégiatervezésen át a jóváhagyott értékesítési végrehajtásig.

## 2. Szállítási modell

### 2.1 Enterprise dashboard modul
- A megoldás beépül a BAS dashboard Enterprise részébe.
- Belső felhasználók számára gyors intake, kutatás, riport és approval nézeteket ad.
- A modul a közös core-ra támaszkodik, nem másolja a domain logikát.

### 2.2 Standalone alkalmazás
- Külön telepíthető, saját márkázással és deployment útvonallal.
- Külső felhasználók is tudják használni, anélkül hogy a teljes BAS rendszert telepíteni kellene.
- A standalone shell ugyanazokat a core szolgáltatásokat és agent workflow-kat használja.

### 2.3 Cloudflare ajánlás
- A public edge, storage és API réteg Cloudflare-szolgáltatásokkal megoldható, ha ez technikailag kézenfekvő.
- R2, D1, Workers, KV és Durable Objects közül a projekt igényei szerint lehet választani.
- A Cloudflare opció támogatja a standalone app nyilvános, telepíthető útvonalát.

## 3. Felhasználói út
1. A felhasználó feltölti az eladni kívánt ingatlan dokumentációját.
2. A felmérő ügynök az ingatlantípus alapján megmondja, milyen bejegyzett, hatósági és egyéb iratok szükségesek.
3. A kutató/értékelő ügynök internetes kutatást végez, összeveti a hasonló ingatlanok korábbi eladásait, és becsült értéktartományt készít.
4. A stratégia-tervező ügynök kialakítja az értékesítési irányt, a csatornákat és az akciótervet.
5. A felhasználó jóváhagyja az ajánlott irányt.
6. Az értékesítő ügynök végrehajtja a kiválasztott sales folyamatot és naplózza az eredményeket.

## 4. Ügynöki szerepek
- **Felmérő ügynök:** az ingatlantípushoz kötött kötelező dokumentumok és hiányok feltárása.
- **Kutató / értékelő ügynök:** piaci összehasonlítás, becsült eladási ár-tartomány, releváns referenciák.
- **Stratégia-tervező ügynök:** csatornaajánlat, teaser, kampány, direkt megkeresés vagy portálfeltöltés közötti döntés.
- **Értékesítő ügynök:** a jóváhagyott terv lépéseinek végrehajtása és naplózása.
- **Orchestrator:** a teljes folyamat koordinációja és állapotkezelése.

## 5. Funkcionális követelmények
- Ingatlan-adatlap és dokumentumfeltöltés.
- Dokumentumok automatikus kategorizálása és hiánylista.
- Ingatlantípus alapján generált iratigény.
- Piaci kutatási riport hasonló paraméterekkel.
- Ár-tartomány, kockázati jelzés és érvelés a stratégiához.
- Akcióterv jóváhagyási kapuval.
- Sales végrehajtás csak explicit felhasználói jóváhagyással.
- Teljes audit napló a feltöltéstől a végrehajtásig.
- Az enterprise panel és a standalone app ugyanazon core eredményeket mutassa, de saját UI-szerkezettel.

## 6. Nem funkcionális követelmények
- Modern, letisztult, professzionális UI.
- Érzékeny dokumentumok biztonságos kezelése.
- Minden külső interakció naplózva legyen.
- A rendszer ne tegyen jogilag kötelező lépéseket felhasználói jóváhagyás nélkül.
- A kutatási források később cserélhetők / bővíthetők legyenek.
- A megoldás legyen alkalmas enterprise beágyazásra és különálló telepíthetőségre is.

## 7. Cloudflare ajánlás
- **R2:** dokumentumok tárolása.
- **D1:** metaadatok, workflow állapot és tranzakciós adatok.
- **Workers:** edge API, auth és routing.
- **KV vagy Durable Objects:** rövid életű vagy koordinált állapot, ha szükséges.
- **Pages / Workers-hosted frontend:** a standalone app nyilvános útvonala.

## 8. Kizárások
- Nem helyettesíti a jogi tanácsadót vagy hivatalos értékbecslőt.
- Nem indít automatikusan publikált hirdetést vagy kampányt jóváhagyás nélkül.
- Nem zár ki emberi validációt az érzékeny vagy vitás esetekben.
- A Cloudflare nem kötelező, hanem ajánlott választás ott, ahol technikailag kézenfekvő.

## 9. Sikerkritériumok
- Az enterprise panel elérhető a BAS dashboard Enterprise részében.
- A standalone app külön telepíthető és önállóan is használható.
- A felmérő ügynök elkészíti a kötelező dokumentumok listáját.
- A kutató ügynök használható piaci érték riportot készít.
- A stratégia-tervező ügynök világos sales stratégiát és akciótervet ad.
- A felhasználó jóváhagyási ponton keresztül irányítja a végrehajtást.
- Az értékesítő ügynök a választott csatornán végrehajtja a tervet.
- A Cloudflare útvonal opcionálisan támogatja a standalone telepítést és az edge szolgáltatásokat.