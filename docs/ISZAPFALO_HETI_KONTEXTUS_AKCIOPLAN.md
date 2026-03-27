# Iszapfaló Kft. — Heti Kontextus Csomag
## Akcióterv és megvalósítási terv

**Kapcsolódó dokumentum:** `docs/ISZAPFALO_CLAUDE_VIZIO_2026.md`  
**Code node guide:** `docs/ISZAPFALO_HETI_KONTEXTUS_CODE_NODE_GUIDE.md`  
**Beilleszthető script:** `docs/snippets/n8n/iszapfalo_heti_kontextus_code_node.js`  
**Node-by-node építési lista:** `docs/ISZAPFALO_HETI_KONTEXTUS_NODE_BY_NODE.md`  
**Workflow blueprint JSON:** `docs/blueprints/iszapfalo_heti_kontextus_workflow_blueprint.json`  
**Vezetői one-pager:** `docs/ISZAPFALO_HETI_KONTEXTUS_ONEPAGER.md`  
**Státusz:** Tervezett / Megvalósításra előkészítve  
**Cél:** A vízióból közvetlenül végrehajtható n8n workflow terv készítése  

---

## 1. Mit építünk meg pontosan?

Egy olyan **n8n workflow-t**, amely:

1. minden hétfő reggel automatikusan lefut,
2. összegyűjti az Airtable legfontosabb heti operatív adatait,
3. ebből készít egy **Claude-kompatibilis Markdown összefoglalót**, majd
4. feltölti azt Google Drive-ra egy fix mappába.

Ez lesz a **Heti Kontextus Csomag**, amit Claude már értelmezni tud, így pontos heti javaslatokat, prioritásokat és összefoglalókat tud adni.

---

## 2. MVP scope — első körben mi kötelező?

### Kötelező elemek az első verzióban
- Schedule Trigger — hétfő 07:00
- Airtable lekérdezés: **Folyamatok**
- Airtable lekérdezés: **Feladatok**
- Airtable lekérdezés: **Munkatársak**
- Airtable lekérdezés: **Szabadságok**
- Code node: Markdown generálás
- Google Drive Upload

### Opcionális elemek az első verzióban
- Airtable lekérdezés: **Munkaidő Nyilvántartás**
- Telegram értesítés, hogy elkészült a heti csomag
- E-mail értesítés a vezetőnek / adminnak

**Fontos döntés:**
Az első verzió célja nem a tökéletesség, hanem az, hogy **Claude minden hétfőn lássa a cég heti állapotát**.

---

## 3. Javasolt workflow név

**Ajánlott n8n workflow név:**  
`07 - ISZ Heti Kontextus Csomag`

Ez illeszkedik a jelenlegi névadási logikához, és később is könnyen bővíthető.

---

## 4. Javasolt n8n node-lánc

### Minimális node sorrend
1. **Schedule Trigger**
2. **Airtable - Folyamatok lekérdezés**
3. **Airtable - Feladatok lekérdezés**
4. **Airtable - Munkatársak lekérdezés**
5. **Airtable - Szabadságok lekérdezés**
6. **Code - Markdown összeállítás**
7. **Google Drive - Upload file**
8. **(Opcionális) Telegram - Küldés adminnak**

### Bővített node sorrend
1. Schedule Trigger
2. Airtable: Folyamatok
3. Airtable: Feladatok
4. Airtable: Munkatársak
5. Airtable: Szabadságok
6. Airtable: Munkaidő Nyilvántartás
7. Code: adattisztítás / normalizálás
8. Code: Markdown generálás
9. Google Drive: feltöltés
10. Telegram / Gmail értesítés

---

## 5. Pontos adatforrások

## 5.1. Folyamatok
### Javasolt szűrés
- Státusz: `Folyamatban`, `Számlázásra vár`, esetleg `Ajánlat alatt`
- vagy minden aktív státusz, ami nem lezárt

### Szükséges mezők
- Folyamat neve
- Státusz
- Késés napokban
- Felelős
- Határidő
- Kiajánlott Ár / Ár
- Nyitott feladatok száma

### Miért kell?
Ez adja a heti projekt-áttekintő gerincét.

---

## 5.2. Feladatok
### Javasolt szűrés
- Prioritás = `Magas`
- Státusz = `Új` vagy `Folyamatban`

### Szükséges mezők
- Feladat neve
- Prioritás
- Státusz
- Felelős
- Kapcsolódó folyamat
- Határidő

### Miért kell?
Ez adja a heti fókuszlista alapját.

---

## 5.3. Munkatársak
### Szükséges mezők
- Név
- Beosztás
- Feladat leterheltség (%)
- Telegram Chat ID
- Kapcsolódó folyamatok száma vagy listája

### Miért kell?
Ez alapján lehet munkarendet, terhelést és elérhetőséget értelmezni.

---

## 5.4. Szabadságok
### Javasolt szűrés
- aktuális hét + következő 7 nap

### Szükséges mezők
- Munkatárs neve
- Szabadság kezdete
- Szabadság vége
- Típus

### Miért kell?
Ez nélkül nem lehet valós heti kapacitást becsülni.

---

## 5.5. Munkaidő Nyilvántartás (2. fázis)
### Javasolt szűrés
- előző hét

### Szükséges mezők
- Munkatárs
- Dátum
- Ledolgozott órák
- Projekt / feladat kapcsolat

### Miért kell?
Ez teszi igazán intelligenssé a heti munkarend-javaslatot.

---

## 6. A Markdown kimenet javasolt szerkezete

Az output legyen egyszerre:
- emberileg olvasható,
- Claude számára értelmezhető,
- strukturált,
- tömör.

### Javasolt fájlnév
`Heti_Kontextus_YYYYMMDD.md`

### Javasolt mappanév Google Drive-on
`Airtable Kontextus`

### Javasolt Markdown váz
```md
# Heti Kontextus Csomag
Dátum: 2026-03-30
Időszak: 2026-03-30 → 2026-04-05

## 1. Vezetői összkép
- Aktív projektek száma:
- Késésben lévő projektek száma:
- Magas prioritású nyitott feladatok száma:
- Szabadságon lévő munkatársak:
- Előző heti össz munkaidő:

## 2. Aktív projektek
| Projekt | Státusz | Késés (nap) | Felelős | Nyitott feladat | Határidő |
|---|---:|---:|---|---:|---|

## 3. Kritikus projektek
- 30+ napos késések
- Számlázásra váró, bevételhez kötött elemek
- Blokkolt vagy gazdátlan projektek

## 4. Magas prioritású feladatok
| Feladat | Felelős | Projekt | Státusz | Határidő |
|---|---|---|---|---|

## 5. Munkatárs elérhetőség
| Név | Beosztás | Leterheltség % | Szabadság | Megjegyzés |
|---|---|---:|---|---|

## 6. Előző heti munkaidő
| Név | Óraszám | Fő projekt |
|---|---:|---|

## 7. Pénzügyi pipeline
- Ajánlati pipeline összérték:
- Számlázásra váró tételek:
- Gyorsan zárható bevételi lehetőségek:

## 8. Claude számára javasolt kérdések
- Milyen legyen a jövő heti munkarend?
- Melyik projektekre fókuszáljunk ezen a héten?
- Ki túlterhelt, ki vállalhat még feladatot?
- Milyen bevételi prioritások vannak most?
```

---

## 7. Code node — logikai feladatok

A Code node feladatai:

1. több Airtable lekérdezésből érkező adatok egyesítése,
2. hiányzó mezők biztonságos kezelése,
3. projektek sorrendbe rendezése késés szerint,
4. magas prioritású feladatok kiválogatása,
5. szabadságadatok beillesztése a munkatárs nézetbe,
6. Markdown string előállítása,
7. fájlnév generálása dátum alapján.

### Fontos technikai elv
A node ne legyen "okos döntéshozó", hanem **megbízható összefoglaló-generátor**.
Az elemzés és döntéstámogatás Claude feladata lesz.

---

## 8. Elfogadási kritériumok

A workflow akkor tekinthető késznek, ha:

- [ ] hétfői trigger működik,
- [ ] az Airtable lekérdezések hibamentesen lefutnak,
- [ ] a Markdown fájl minden héten létrejön,
- [ ] a fájl felkerül a Google Drive megfelelő mappájába,
- [ ] Claude a fájlból képes értelmes heti összefoglalót készíteni,
- [ ] a kimenetből megválaszolható legalább ez a 4 kérdés:
  - [ ] Milyen legyen a jövő heti munkarend?
  - [ ] Melyik projektek a legsürgősebbek?
  - [ ] Ki túlterhelt / ki ér rá?
  - [ ] Hol vannak a pénzügyi prioritások?

---

## 9. Előkészítési checklist még fejlesztés előtt

### Airtable oldal
- [ ] Folyamatok táblában a **Felelős** mezők kitöltése
- [ ] Folyamatok táblában a **Határidő** mezők kitöltése
- [ ] Feladatok táblában a **Felelős** mezők kitöltése
- [ ] Munkatársak táblában a **Telegram Chat ID** mezők kitöltése
- [ ] 30 napnál nagyobb késéseknél rövid ok / blokk megadása

### n8n oldal
- [ ] működő Airtable credential
- [ ] működő Google Drive credential
- [ ] jogosultság ellenőrzése a workflow tulajdonosánál
- [ ] tesztfuttatás kézzel

### Claude oldal
- [ ] Google Drive kapcsolat él
- [ ] a célmappa látható Claude számára
- [ ] a fájlnév-konvenció fix

---

## 10. Ajánlott megvalósítási sorrend

### 1. lépés — adatmezők rendbetétele
A rendszer értelme ezen múlik. Ha nincs felelős és határidő, Claude csak részben tud jól javasolni.

### 2. lépés — n8n MVP workflow megépítése
Első körben a 4 Airtable tábla + Drive feltöltés bőven elég.

### 3. lépés — első hétfői teszt
A generált fájlt kézzel is ellenőrizni kell:
- olvasható-e,
- nem túl hosszú-e,
- valóban döntéstámogató-e.

### 4. lépés — Claude próbák
Tesztdélszöveg:
- "Adj heti prioritási listát."
- "Készíts munkarend-javaslatot."
- "Mondd meg, ki van túlterhelve."
- "Mutasd meg a bevételi fókuszokat."

### 5. lépés — munkaidő modul bekapcsolása
Ha a Pohi-féle munkaidő modul él, azonnal rá lehet kötni a workflow-ra.

---

## 11. Miért éri meg ez rögtön?

Mert ez nem egy új rendszer.
Ez egy **összekötő réteg** a már meglévő rendszered és Claude között.

Az értéke azonnal megjelenik:
- heti vezetői átlátás,
- jobb kapacitástervezés,
- pontosabb prioritáskezelés,
- gyorsabb döntéshozatal,
- kisebb mentális terhelés.

---

## 12. Következő reális lépés

Ha ezt tényleg megcsináljuk, akkor a **legjobb első konkrét feladat** ez:

> építsünk meg egy kézi indítású teszt workflow-t, ami egyszer lefut,
> készít egy `Heti_Kontextus_teszt.md` fájlt,
> és feltölti a Google Drive-ra.

Ha ez működik, onnantól az időzítés és a finomhangolás már egyszerű.

---

**Röviden:**  
Igen — ezt érdemes tényleg megcsinálni.  
Nem nagy fejlesztés, de nagyon nagy stratégiai hozadéka van.
