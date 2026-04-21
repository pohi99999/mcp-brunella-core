# Iszapfaló Heti Kontextus — Node-by-node n8n építési lista

**Cél:** kattintásról kattintásra megépíthető legyen a heti kontextus workflow  
**Workflow név:** `07 - ISZ Heti Kontextus Csomag`  
**Kapcsolódó fájlok:**
- `docs/ISZAPFALO_CLAUDE_VIZIO_2026.md`
- `docs/ISZAPFALO_HETI_KONTEXTUS_AKCIOPLAN.md`
- `docs/ISZAPFALO_HETI_KONTEXTUS_CODE_NODE_GUIDE.md`
- `docs/snippets/n8n/iszapfalo_heti_kontextus_code_node.js`
- `docs/templates/HETI_KONTEXTUS_TEMPLATE.md`

---

## 0. Mielőtt elkezded

### Kelleni fog
- működő **Airtable credential**
- működő **Google Drive credential**
- hozzáférés az Iszapfaló Airtable base-hez
- egy Google Drive mappa: **`Airtable Kontextus`**

### Amit előtte érdemes ellenőrizni
- a `Folyamatok` táblában legyen kitöltve minél több **Felelős** és **Határidő**
- a `Feladatok` táblában legyen **Prioritás**, **Státusz**, **Felelős**
- a `Munkatársak` táblában legyen **Feladat leterheltség (%)** és lehetőleg **Telegram Chat ID**

---

## 1. Új workflow létrehozása

1. Menj az n8n-ben a Workflows oldalra.
2. Kattints: **New Workflow**.
3. Workflow neve:

```text
07 - ISZ Heti Kontextus Csomag
```

4. Mentsd el rögtön.

---

## 2. Node #1 — Schedule Trigger

### Node típusa
`Schedule Trigger`

### Javasolt név
```text
Schedule - Hétfő 07:00
```

### Beállítás
- **Trigger Interval:** Cron
- **Mode:** Every Week
- **Day of Week:** Monday
- **Hour:** 7
- **Minute:** 0

### MVP teszthez
Az első tesztnél nyugodtan használhatsz **Manual Trigger**-t is, és csak a végén cseréld Schedule Triggerre.

---

## 3. Node #2 — Airtable: Folyamatok lekérdezés

### Node típusa
`Airtable`

### Javasolt név
```text
Airtable - Folyamatok lekérdezés
```

### Beállítási irány
- **Resource:** Record
- **Operation:** List
- **Base:** Iszapfaló base
- **Table:** `Folyamatok`

### Javasolt mezők / célmezők
A script ezekből dolgozik a legjobban:
- `Folyamat neve`
- `Státusz`
- `Késés napokban`
- `Felelős`
- `Határidő`
- `Feladatok száma`
- `Kiajánlott Ár` vagy `Ár`
- `Késés oka` *(ha van)*

### Javasolt szűrés
Ha van Formula/Filter lehetőség, akkor valami ilyesmi logika kell:

```text
OR(
  {Státusz} = 'Folyamatban',
  {Státusz} = 'Számlázásra vár',
  {Státusz} = 'Ajánlat alatt'
)
```

### Ha nincs kész formula
Első körben listázz mindent, és a Code node-ban is lehet szűrni.

---

## 4. Node #3 — Airtable: Feladatok lekérdezés

### Node típusa
`Airtable`

### Javasolt név
```text
Airtable - Feladatok lekérdezés
```

### Beállítási irány
- **Resource:** Record
- **Operation:** List
- **Table:** `Feladatok`

### Fontos mezők
- `Feladat neve`
- `Prioritás`
- `Státusz`
- `Felelős`
- `Folyamat kapcsolat` vagy `Projekt`
- `Határidő`

### Javasolt szűrés
```text
AND(
  {Prioritás} = 'Magas',
  OR(
    {Státusz} = 'Új',
    {Státusz} = 'Folyamatban'
  )
)
```

### Megjegyzés
Ha túl kevés rekord jön, vedd ki a státuszszűrést tesztre.

---

## 5. Node #4 — Airtable: Munkatársak lekérdezés

### Node típusa
`Airtable`

### Javasolt név
```text
Airtable - Munkatársak lekérdezés
```

### Beállítási irány
- **Resource:** Record
- **Operation:** List
- **Table:** `Munkatársak`

### Fontos mezők
- `Név`
- `Beosztás`
- `Feladat leterheltség (%)`
- `Telegram Chat ID`
- `Kapcsolódó folyamatok`

### Szűrés
Nem feltétlen kell. Itt az összes aktív munkatárs jöhet.

---

## 6. Node #5 — Airtable: Szabadságok lekérdezés

### Node típusa
`Airtable`

### Javasolt név
```text
Airtable - Szabadságok lekérdezés
```

### Beállítási irány
- **Resource:** Record
- **Operation:** List
- **Table:** `Szabadságok`

### Fontos mezők
- `Munkatárs neve`
- `Szabadság kezdete`
- `Szabadság vége`
- `Típus`

### Javasolt szűrés
Első MVP-nél mehet szűrés nélkül is.

Ha van jó dátum formula lehetőség, akkor a jelenlegi hét + következő 7 nap környéke a cél.

---

## 7. Node #6 — Airtable: Munkaidő Nyilvántartás *(opcionális)*

### Node típusa
`Airtable`

### Javasolt név
```text
Airtable - Munkaidő Nyilvántartás
```

### Mikor kell?
Akkor, ha a munkaidő modul már tényleg tölti az adatot.

### Fontos mezők
- `Munkatárs`
- `Dátum`
- `Ledolgozott órák`
- `Projekt`

### Ha még nincs kész
Nyugodtan hagyd ki az első verzióból — a Code script ezt tolerálja.

---

## 8. Node #7 — Code: Heti Kontextus Generátor

### Node típusa
`Code`

### Javasolt név
```text
Code - Heti Kontextus Generátor
```

### Beállítások
- **Language:** JavaScript
- **Mode:** Run once for all items

### Script forrása
Másold be teljes egészében ezt a fájlt:

```text
docs/snippets/n8n/iszapfalo_heti_kontextus_code_node.js
```

### Fontos
A script a node-nevekre hivatkozik.
Ha nálad nem pontosan ezek a node-nevek vannak, írd át a script elején a `NODE_NAMES` objektumot.

### Kimenet
A node ezt adja vissza:
- `json.fileName`
- `json.markdown`
- `binary.report`

---

## 9. Node #8 — Google Drive Upload

### Node típusa
`Google Drive`

### Javasolt név
```text
Google Drive - Heti Kontextus Upload
```

### Beállítások
- **Operation:** Upload
- **Input Data Field Name / Binary Property:** `report`
- **File Name:** `={{ $json.fileName }}`
- **Parent Folder:** `Airtable Kontextus`

### Elvárt eredmény
A Drive-ba felkerül egy ilyen fájl:

```text
Heti_Kontextus_20260330.md
```

---

## 10. Node #9 — Telegram értesítés *(opcionális)*

### Node típusa
`Telegram`

### Javasolt név
```text
Telegram - Heti Kontextus kész
```

### Minta üzenet
```text
Elkészült a heti kontextus riport: {{$json.fileName}}
```

### Mikor érdemes?
Akkor, ha szeretnéd, hogy admin/chat szinten jelezze a rendszer, hogy elkészült a heti snapshot.

---

## 11. Ajánlott összekötés

### Minimál kapcsolási sorrend
```text
Schedule - Hétfő 07:00
  -> Airtable - Folyamatok lekérdezés
  -> Airtable - Feladatok lekérdezés
  -> Airtable - Munkatársak lekérdezés
  -> Airtable - Szabadságok lekérdezés
  -> Code - Heti Kontextus Generátor
  -> Google Drive - Heti Kontextus Upload
```

### Fontos gyakorlati megjegyzés
n8n-ben több Airtable node-ot nem mindig sorban akarsz futtatni úgy, hogy a Code node mindegyik outputját lássa. Emiatt a legegyszerűbb MVP megoldás ez:

- a triggerből ágasd szét a lekérdezéseket,
- majd vezesd őket vissza egy olyan pontra, ahonnan a Code node már látja a teljes futást,
- vagy használj olyan mintát, ahol a Code node közvetlenül név alapján olvassa a korábbi node-ok outputját.

A mellékelt script pontosan erre van felkészítve, mert a `$(nodeName).all()` mintát használja.

---

## 12. Első teszt — pontos ellenőrzési sorrend

1. Futtasd le kézzel a workflow-t.
2. Nézd meg, hogy mind az Airtable node-ok adnak-e vissza rekordokat.
3. Nyisd meg a Code node outputját.
4. Ellenőrizd:
   - van-e `fileName`,
   - van-e `markdown`,
   - van-e `binary.report`.
5. Nézd meg a Drive node-ot.
6. Nyisd meg a feltöltött `.md` fájlt.
7. Ellenőrizd, hogy olvasható-e és logikus-e.

---

## 13. Hibakeresési mini guide

### Ha a Code node hibát dob
Leggyakoribb ok:
- eltérő node-nevek
- más mezőnév az Airtable-ben
- üres rekordlista

### Ha a Drive node nem tölt fel
Leggyakoribb ok:
- rossz binary property név
- nincs jogosultság a célmappára
- credential probléma

### Ha a riport üres
Leggyakoribb ok:
- túl szigorú Airtable filter
- rossz tábla vagy mezőnév

---

## 14. Legjobb MVP-stratégia

A leggyorsabb sikerhez ezt csináld:

### Első kör
- Manual Trigger
- 4 Airtable node
- Code node
- Google Drive Upload

### Második kör
- Schedule Trigger
- Szabadság finomítás
- Munkaidő tábla bekötése

### Harmadik kör
- Telegram értesítés
- Pénteki heti záró snapshot
- finomabb prioritási logika

---

## 15. Röviden

Ha ezt a dokumentumot követed, akkor a Heti Kontextus workflow **kézzel összekattintható**.

A legfontosabb fájl továbbra is ez a beilleszthető script:

```text
docs/snippets/n8n/iszapfalo_heti_kontextus_code_node.js
```

Ez adja a workflow "agyát" a riportgeneráláshoz.
