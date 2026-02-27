# Az Intelligens Ügynöksereg Gyártási Stratégiája és Gyakorlati Útmutatója

**Szerző:** Manus AI  
**Dátum:** 2026. január 8.  
**Címzett:** Kovásznai-Szász Gergely, Ügyvezető Igazgató, Iszapfaló Kft.

---

### Bevezetés

Tisztelt Gergő!

Ez a dokumentum a korábban átadott stratégiai tervek gyakorlati megvalósítását szolgálja. Egy konkrét, lépésről lépésre követhető „gyártási” útmutatót ad az Intelligens Ügynöksereg felépítéséhez, a kezdeti prototípustól a teljesen autonóm, intelligens rendszerig. A cél, hogy a lehető leggyorsabban kézzelfogható eredményeket érjünk el, miközben egy robusztus és skálázható alapot teremtünk a jövőbeli fejlesztésekhez.

A stratégia a **„Gyors Győzelem” (Quick Win)** elvére épül: már az első 1-2 hétben egy működő, értéket termelő prototípust hozunk létre, amely motivációt és azonnali visszacsatolást biztosít a további fázisokhoz.

---

### Nulladik Lépés: Az Alapok Megteremtése (Előkészületek)

Mielőtt a fejlesztésbe kezdenénk, elengedhetetlen a megfelelő környezet és a felelősök kijelölése.

| Teendő | Javaslat és Részletek |
| :--- | :--- |
| **1. Felelős Kiválasztása** | **Opció A (Belső):** Jelölj ki egy belső munkatársat, aki rendelkezik alapvető programozási (ideális esetben Python) ismeretekkel és van kapacitása a projekttel foglalkozni. **Opció B (Külső):** Bízz meg egy szabadúszó fejlesztőt vagy egy kisebb szoftverfejlesztő céget. A feladat jól definiált, így könnyen kiszervezhető. |
| **2. Infrastruktúra Előkészítése** | **Javaslat:** Bérelj egy virtuális magánszervert (VPS). **Ajánlott szolgáltatók:** DigitalOcean (Droplet), Hetzner (Cloud Server), AWS (EC2). **Specifikáció:** Legalább 2 vCPU, 4 GB RAM, 40 GB SSD. **Operációs rendszer:** Ubuntu 22.04 LTS. Ez a környezet kb. 15-25 EUR/hó költséggel jár. |
| **3. Szoftver Telepítése** | A kiválasztott szerverre telepíteni kell a `Docker` és `Docker Compose` szoftvereket. Ezek teszik lehetővé, hogy a rendszer komponensei (adatbázis, scriptek) izoláltan, de egymással kommunikálva fussanak. A telepítéshez számos online útmutató elérhető. |
| **4. Verziókezelés Beállítása** | Hozz létre egy privát repository-t a `GitHub`-on vagy `GitLab`-on. Ez biztosítja, a kód biztonságos tárolását, a változások követését és a közös munkát. |

---

### 1. Fázis: A Prototípus – A Gyors Győzelem (1-2 hét)

**Cél:** Egy működő, de még manuálisan indított rendszer, amely naponta összegyűjti a legfontosabb pályázatokat és közbeszerzéseket, és elküldi őket egy egyszerű e-mailben. **Ez a fázis a legfontosabb, mert azonnali értéket teremt!**

| Lépés | Részletes Útmutató |
| :--- | :--- |
| **1. Adatbázis Létrehozása** | A szerveren, `Docker Compose` segítségével indíts el egy `PostgreSQL` konténert. Hozd létre az `opportunities` táblát a korábban definiált séma alapján. |
| **2. PFA Ügynök (Scraper) v1.0** | Írj egy Python scriptet (`pfa_scraper.py`), ami a `requests` és `BeautifulSoup` könyvtárakkal a **palyazat.gov.hu** oldalt célozza. A script keressen rá az Iszapfaló Kft. számára releváns kulcsszavakra (pl. „vízgazdálkodás”, „szennyvíz”, „agrár”, „innováció”), és a találatokat (cím, link, kiírás dátuma) mentse el az adatbázisba. |
| **3. PKA Ügynök (Scraper) v1.0** | Írj egy másik Python scriptet (`pka_scraper.py`), ami a **kozbeszerzes.hu** oldalt célozza hasonló kulcsszavakkal. A találatokat ez is mentse az adatbázisba. Ügyelj a duplikáció elkerülésére (a `source_url` legyen egyedi). |
| **4. RKA Ügynök (Riport) v1.0** | Készíts egy harmadik Python scriptet (`report_generator.py`), ami:
   1. Lekérdezi az adatbázisból az aznap bekerült új lehetőségeket.
   2. Formáz egy egyszerű szöveges e-mailt a találatok listájával.
   3. Az `smtplib` könyvtár segítségével elküldi az e-mailt a te címedre. |
| **5. Tesztelés és Indítás** | Futtasd le a scripteket manuálisan a szerverről: `python3 pfa_scraper.py`, majd `python3 pka_scraper.py`, végül `python3 report_generator.py`. Ellenőrizd az adatbázis tartalmát és a beérkezett e-mailt. |

**Fázis Eredménye:** Egy naponta manuálisan lefuttatható folyamat, ami egy e-mailben szállítja a legfrissebb, releváns pályázati és közbeszerzési linkeket. **Már ez önmagában órákat spórolhat meg.**

---

### 2. Fázis: Az Automatizált Rendszer – A Skálázás (2-4 hét)

**Cél:** A manuális folyamat teljes automatizálása, a stratégiai értékelés bevezetése és a riportok minőségének javítása.

| Lépés | Részletes Útmutató |
| :--- | :--- |
| **1. Automatizálás (Airflow)** | Telepítsd az `Apache Airflow`-t Docker segítségével. Hozz létre egy új munkafolyamatot (DAG), amely a 1. fázisban megírt scripteket automatikusan, ütemezetten (pl. naponta kétszer) futtatja a megfelelő sorrendben. |
| **2. STA Ügynök v1.0 (Pontozás)** | Bővítsd a riport generáló scriptet egy egyszerű pontozási logikával. Adj pontot minden lehetőségnek a kulcsszavak alapján (pl. „iszap” = +10 pont, „innováció” = +5 pont, „határidő 7 napon belül” = +20 pont). Ez lesz a `relevance_score`. |
| **3. Riportok Fejlesztése** | A riport generátor e-mailje már ne csak egy link-lista legyen. Használj HTML formázást, hogy a riport olvashatóbb legyen. A lehetőségeket a `relevance_score` szerint csökkenő sorrendbe rendezd. A legmagasabb pontszámúakat emeld ki. |
| **4. ILD Ügynök v1.0 (Implicit)** | Adj hozzá egy új scraper scriptet az Airflow folyamathoz, ami specifikusabb forrásokat figyel, pl. a Kormány.hu közleményeit vagy egy-egy minisztérium híreit, keresve a jövőbeli tervekre utaló kulcskifejezéseket (pl. „stratégia kerül kidolgozásra”, „támogatási program indul”). |

**Fázis Eredménye:** Egy önjáró rendszer, ami emberi beavatkozás nélkül gyűjti, szűri, priorizálja a lehetőségeket és egy formázott, rangsorolt listát küld e-mailben. **Itt már nem csak időt spórolsz, hanem a legfontosabb lehetőségekre fókuszálsz.**

---

### 3. Fázis: Az Intelligens Ökoszisztéma – A Finomhangolás (4-8 hét)

**Cél:** A rendszer intelligenciájának növelése, a mélyebb elemzések lehetővé tétele és egy felhasználóbarát vizuális felület létrehozása.

| Lépés | Részletes Útmutató |
| :--- | :--- |
| **1. STA Ügynök v2.0 (LLM)** | Integrálj egy nagy nyelvi modell (LLM) API-t (pl. OpenAI) az értékelési folyamatba. Ahelyett, hogy csak kulcsszavakat számolnál, küldd el a lehetőség szövegét az LLM-nek egy specifikus prompttal, pl.: `„Elemezd az alábbi pályázati kiírást az Iszapfaló Kft. szempontjából (fókusz: iszapkezelés, biotechnológia). Adj egy 0-100 közötti relevancia pontszámot és egy 2 mondatos vezetői összefoglalót.”` Az LLM válaszát mentsd az adatbázisba. |
| **2. Dashboard Létrehozása** | Használd a `Streamlit` vagy `Dash` Python keretrendszert egy egyszerű, jelszóval védett webes dashboard létrehozására. A dashboard jelenítse meg az adatbázisban lévő lehetőségeket táblázatos formában, tegye lehetővé a szűrést, keresést és a részletek megtekintését. |
| **3. Monitorozás és Riasztás** | Állíts be alapvető monitorozást az Airflow-ban. Ha egy feladat (pl. egy scraper) hibára fut, a rendszer küldjön automatikus e-mailt a fejlesztőnek/operátornak. |
| **4. Folyamatos Tanulás** | A dashboardon tegyél lehetővé egy egyszerű visszajelzési mechanizmust (pl. egy „Hasznos” / „Nem hasznos” gomb minden lehetőségnél). Az itt gyűjtött adatokat később fel lehet használni az STA pontozási modelljének finomítására (gépi tanulás). |

**Fázis Eredménye:** Egy kifinomult, intelligens ökoszisztéma, amely nemcsak azonosítja, de mélyen elemzi is a lehetőségeket, proaktív javaslatokat tesz, és egy interaktív felületen keresztül teszi elérhetővé az információt. **Ez a rendszer már nem egy eszköz, hanem egy stratégiai partner.**

---

### Záró Javaslat

Kezdd kicsiben, de gondolkodj nagyban. A legfontosabb, hogy az **1. Fázist a lehető leggyorsabban valósítsd meg**. Az első, kézzelfogható eredmények fogják biztosítani a lendületet és a támogatást a további, komplexebb fázisokhoz. A felvázolt út egyértelmű, a technológia rendelkezésre áll. Sok sikert a „gyártáshoz”!
