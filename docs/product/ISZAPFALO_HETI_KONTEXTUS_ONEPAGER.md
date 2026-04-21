# Iszapfaló Kft. — Heti Kontextus Csomag
## 1 oldalas vezetői összefoglaló

**Mi ez?**  
Egy egyszerű, nagy értékű fejlesztés, amely minden hétfő reggel automatikusan összefoglalja az Iszapfaló Airtable adatait, és egy Claude által értelmezhető heti riportot készít belőlük.

---

## A probléma

Jelenleg az adatok megvannak, de nincsenek összekötve az elemző réteggel:

- az Airtable-ben ott vannak a projektek, feladatok, munkatársak és késések,
- az n8n képes automatizálni a lekérdezést és a fájlgenerálást,
- Claude viszont csak azt látja, amit manuálisan elé teszünk.

Ennek következménye:
- a heti prioritások nincsenek automatikusan összerendezve,
- a munkarend-javaslat nem adatalapú,
- a vezetői fókusz minden héten fejben és kézzel áll össze.

---

## A megoldás

Egy új n8n workflow:

**`07 - ISZ Heti Kontextus Csomag`**

ami minden hétfő 07:00-kor:
1. lekéri az Airtable releváns tábláit,
2. készít egy strukturált Markdown riportot,
3. feltölti azt Google Drive-ra,
4. így Claude már látja és elemezni tudja.

---

## Mit fog tartalmazni a heti riport?

- aktív projektek és státuszok,
- késésben lévő projektek,
- magas prioritású nyitott feladatok,
- munkatárs terheltség és elérhetőség,
- szabadságok,
- később: előző heti munkaidő,
- pénzügyi / pipeline fókuszok.

---

## Üzleti haszon

### Azonnali előnyök
- heti vezetői átlátás 5 perc alatt,
- objektív prioritási sorrend,
- jobb kapacitástervezés,
- pontosabb munkarend-javaslat,
- gyorsabb pénzügyi fókuszálás.

### Stratégiai előny
Ez a fejlesztés lesz a híd a meglévő operatív adatok és Claude döntéstámogató képessége között.

Vagyis:
- nem új rendszert építünk,
- hanem a meglévő rendszerből csinálunk intelligens rendszert.

---

## Mi kell hozzá?

### Már megvan
- Airtable adatok
- n8n rendszer
- Google Drive kapcsolat
- Claude Drive-hozzáférés

### Amit el kell készíteni
- 1 új n8n workflow
- 1 Code node riportgeneráló logika
- 1 Drive feltöltő lépés

---

## Becsült ráfordítás

**Fejlesztési idő:** kb. 2–3 óra MVP szinten  
**Kockázat:** alacsony  
**Értékteremtés:** magas

---

## MVP definíció

A projekt akkor tekinthető késznek, ha:
- létrejön egy heti `.md` riport,
- az felmegy Google Drive-ra,
- Claude abból képes heti fókuszlistát és munkarend-javaslatot adni.

---

## Következő lépés

A legjobb következő lépés egy kézi indítású tesztverzió építése:

- Airtable lekérdezések
- Code node
- Google Drive feltöltés

Ha ez működik, a heti automatikus futás már csak időzítés kérdése.

---

## Elkészült hozzá a teljes megvalósítási csomag

- Vízió dokumentum
- Akcióterv
- Node-by-node építési lista
- Beilleszthető Code node script
- Pohi brief
- Mintariport
- Workflow blueprint JSON

**Lényeg:**  
Ez a fejlesztés kicsi technikailag, de nagyon nagy hatású üzletileg.  
Pont ez az a réteg, amitől Claude valóban a rendszer agya tud lenni.
