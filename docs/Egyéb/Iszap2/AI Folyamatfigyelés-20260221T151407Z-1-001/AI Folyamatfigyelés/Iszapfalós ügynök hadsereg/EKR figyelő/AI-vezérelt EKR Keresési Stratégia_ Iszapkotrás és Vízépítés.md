# AI-vezérelt EKR Keresési Stratégia: Iszapkotrás és Vízépítés

**Készült:** 2025. december 3. 
**Szerző:** Manus AI

## 1. Célmeghatározás

A stratégia elsődleges célja, hogy egy AI ügynököt képessé tegyen az **Iszapfaló Kft. profiljába vágó, aktív közbeszerzési lehetőségek automatizált és szisztematikus felkutatására** az Elektronikus Közbeszerzési Rendszerben (EKR). A folyamat végén az ügynöknek egy strukturált, ember által könnyen feldolgozható riportot kell generálnia a releváns találatokról.

## 2. Működési Környezet és Alapelvek

- **Platform:** Elektronikus Közbeszerzési Rendszer (EKR)
- **URL:** `https://ekr.gov.hu`
- **Alapvető szűrő:** A keresések során **kizárólag az "Aktuális üzleti lehetőség" szűrőt** kell alkalmazni. Ez biztosítja, hogy csak az ajánlattételi vagy részvételi szakaszban lévő, tehát még megpályázható eljárások kerüljenek a látótérbe.
- **Adatpontosság:** Minden kinyert adatot (határidő, EKR azonosító) validálni kell, és a riportban a közvetlen linket is szerepeltetni kell az eljáráshoz.

## 3. Keresési Folyamat: Egy Többlépcsős Modell

Az AI ügynöknek egy kétszintű, párhuzamosan futtatható keresési ciklust kell implementálnia a maximális lefedettség érdekében. A két fő ág a kulcsszavas keresés és az ajánlatkérő-specifikus keresés.

### 3.1. Kulcsszavas Keresési Ciklus

Ebben a ciklusban az ügynök egy előre definiált, prioritással ellátott kulcsszólistán iterál végig.

| Prioritás | Kategória | Kulcsszavak | Keresési Logika |
|---|---|---|---|
| **Magas** | **Alaptevékenység** | `iszapkotrás`, `mederkotrás`, `tókotrás`, `kotrás` | Minden egyes kulcsszóra külön keresést kell indítani. A "kotrás" általánosabb, ezért több, de kevésbé specifikus találatot adhat. |
| **Közepes** | **Vízépítés** | `vízépítés`, `vízrendezés`, `csapadékvíz` | Ezek a kulcsszavak tágabb körben keresnek, de gyakran tartalmaznak kotrási vagy iszapkezelési feladatokat. |
| **Alacsony** | **Speciális tevékenységek** | `iszapkezelés`, `víztelenített iszap`, `szennyvíziszap` | Specifikus, de ritkábban előforduló eljárások azonosítására szolgálnak. |

**Végrehajtási utasítás az ügynök számára:**
1. Lépj be a kulcsszólistán szereplő első kulcsszóval.
2. Alkalmazd az "Aktuális üzleti lehetőség" szűrőt.
3. Indítsd el a keresést.
4. Mentsd el a találatok számát és az eljárások alapadatait.
5. Ismételd meg a folyamatot a lista összes kulcsszavával.

### 3.2. Ajánlatkérő-specifikus Keresési Ciklus

Ebben a ciklusban az ügynök a kulcsszó mezőt üresen hagyja, és egy előre definiált, releváns ajánlatkérői listán iterál végig.

| Kategória | Ajánlatkérők | Keresési Logika |
|---|---|---|
| **Kiemelt Vízművek** | `Fővárosi Vízművek`, `Dunántúli Regionális Vízmű (DRV)`, `Tiszamenti Regionális Vízművek`, `Alföldvíz`, `Északdunántúli Vízmű` | Ezek a legnagyobb potenciális megrendelők. A nevükre keresve az összes aktív eljárásuk megjelenik, amelyeket utána lehet szűrni relevancia szerint. |
| **Állami Szervek** | `Vízügyi igazgatóságok (KÖVIZIG)`, `Nemzeti Park Igazgatóságok` | Gyakran írnak ki vízrendezési, tórehabilitációs és mederkarbantartási munkákat. |

**Végrehajtási utasítás az ügynök számára:**
1. Nyisd meg a részletes keresőt.
2. Az "Ajánlatkérő" mezőbe írd be a lista első szereplőjének nevét.
3. Győződj meg róla, hogy a kulcsszó mező üres.
4. Alkalmazd az "Aktuális üzleti lehetőség" szűrőt.
5. Indítsd el a keresést és mentsd el a találatokat.
6. Ismételd meg a folyamatot a lista összes ajánlatkérőjével.

## 4. Adatkinyerés és Kiértékelés

A találati listák feldolgozása során az ügynöknek minden egyes eljárás adatlapját meg kell nyitnia, és a következő adatokat kell strukturált formában kinyernie:

- **Ajánlatkérő neve**
- **Eljárás tárgya**
- **EKR azonosító** és **közvetlen link** az eljárás adatlapjára
- **Becsült érték** (ha nyilvános)
- **Ajánlattételi/részvételi határidő**
- **Hátralévő idő (napokban):** Ezt a riport generálásának napjához képest dinamikusan kell kiszámolni.
- **Relevancia-értékelés:** Az ügynöknek meg kell vizsgálnia az eljárás részleteit (pl. CPV kódok, műszaki leírás, részekre bontás), és egy rövid megjegyzésben értékelnie kell a relevanciát (pl. "Közvetlenül releváns, kotrási munkát tartalmaz", "Potenciálisan releváns, víziközmű fejlesztés").

## 5. Riportolás és Eredmény-prezentáció

A keresési ciklusok lefutása és az adatok kiértékelése után az ügynöknek egy Markdown formátumú összefoglaló riportot kell készítenie, amely a következő elemeket tartalmazza:

1. **Összefoglaló:** A keresés dátuma, a legfontosabb statisztikák (pl. összes talált aktív eljárás, ebből közvetlenül releváns). 
2. **Részletes táblázat:** A kinyert adatok táblázatos formában, sürgősség vagy relevancia szerint csoportosítva.
3. **Ajánlások:** Konkrét cselekvési javaslatok (pl. "Azonnal cselekvést igénylő eljárások", "Folyamatos csatlakozási lehetőségek").
4. **Melléklet:** A riportot csatolmányként kell átadni a felhasználónak.

Ez a stratégia biztosítja, hogy az AI ügynök ne csak adatokat gyűjtsön, hanem azokat kontextusba helyezze, értékelje, és egy könnyen használható, döntéstámogató dokumentumot állítson elő.
