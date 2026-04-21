# Iszapfaló Heti Kontextus — n8n Code Node Guide

**Kapcsolódó fájlok:**
- `docs/ISZAPFALO_CLAUDE_VIZIO_2026.md`
- `docs/ISZAPFALO_HETI_KONTEXTUS_AKCIOPLAN.md`
- `docs/templates/HETI_KONTEXTUS_TEMPLATE.md`
- `docs/snippets/n8n/iszapfalo_heti_kontextus_code_node.js`

---

## Mi ez?

Ez a guide azt mutatja meg, hogyan kell az elkészült JavaScriptet betenni egy **n8n Code node**-ba, hogy abból egy Google Drive-ra feltölthető heti Markdown riport keletkezzen.

---

## 1. Ajánlott workflow struktúra

1. Schedule Trigger
2. Airtable - Folyamatok lekérdezés
3. Airtable - Feladatok lekérdezés
4. Airtable - Munkatársak lekérdezés
5. Airtable - Szabadságok lekérdezés
6. Airtable - Munkaidő Nyilvántartás *(opcionális, de támogatott)*
7. Code - Heti Kontextus Generátor
8. Google Drive - Upload
9. *(opcionális)* Telegram értesítés

---

## 2. Nagyon fontos: node-nevek

A script alapértelmezetten ezekre a node-nevekre hivatkozik:

- `Airtable - Folyamatok lekérdezés`
- `Airtable - Feladatok lekérdezés`
- `Airtable - Munkatársak lekérdezés`
- `Airtable - Szabadságok lekérdezés`
- `Airtable - Munkaidő Nyilvántartás`

Ha nálatok a workflow-ban más név van, akkor a script elején a `NODE_NAMES` objektumban kell átírni.

---

## 3. Mit csinál a script?

A Code node script:

- összegyűjti az összes Airtable node outputját,
- egységes formára hozza a mezőket,
- kiszámolja a heti kulcsmutatókat,
- létrehozza a következő blokkokat:
  - vezetői összkép,
  - aktív projektek,
  - kritikus projektek,
  - magas prioritású feladatok,
  - munkatárs elérhetőség,
  - előző heti munkaidő,
  - pénzügyi pipeline,
- végül előállít egy `.md` fájlt bináris formában is.

---

## 4. Code node beállítás

### Node neve
**Ajánlott:** `Code - Heti Kontextus Generátor`

### Language
`JavaScript`

### Mode
`Run once for all items`

Ez fontos, mert több node teljes outputját egyszerre kell összefésülni.

---

## 5. Google Drive node beállítás

A Code node után javasolt egy Google Drive feltöltő node.

### Ajánlott alapbeállítások
- **Operation:** Upload
- **Binary Data:** bekapcsolva
- **Input Binary Field:** `report`
- **File Name:** `={{ $json.fileName }}`
- **Parent Folder:** `Airtable Kontextus`

Ha a Drive node külön mezőben kéri a fájlnevet, akkor a Code node ezt már előállítja a `json.fileName` mezőben.

---

## 6. Airtable mezőnevek — rugalmas kezelés

A script többféle mezőnév-változatot is próbál kezelni. Például:

- `Folyamat neve` / `Projekt` / `Name`
- `Státusz` / `Status`
- `Felelős` / `Owner` / `Assignee`
- `Késés napokban` / `Késés`

Ez azért jó, mert nem kell első körben tökéletesen egységes Airtable schema.

Viszont hosszú távon az egységesítés így is ajánlott.

---

## 7. Első tesztfuttatás

Az első tesztnél ezt érdemes ellenőrizni:

- létrejön-e a `Heti_Kontextus_YYYYMMDD.md` fájl,
- a Markdown emberileg olvasható-e,
- a kritikus projektek valóban a legnagyobb késésekből jönnek-e,
- a magas prioritású feladatlista nem üres-e,
- a munkatárs szekció mutatja-e a szabadságokat,
- a pipeline összegzés értelmes-e.

---

## 8. Ha valami hiányzik a riportból

### Ha nincs munkaidő adat
Nem hiba. A script ilyenkor is működik, csak a heti munkaidő blokk alap üzenetet fog mutatni.

### Ha nincs szabadság adat
Nem hiba. A szabadság oszlop egyszerűen üres / "Nem" lesz.

### Ha egyes mezők más néven futnak
A `pick()` és `normalize...()` részekben lehet bővíteni a kulcslistát.

---

## 9. Következő logikus bővítés

Ha az első verzió működik, akkor utána jöhet:

1. Telegram értesítés: "A heti kontextus elkészült"
2. Pénteki heti záró riport
3. Claude-kérdés sablon automatikus beírása
4. valós idejű Airtable MCP kapcsolat

---

## 10. Röviden

Ez a Code node már nem csak koncepció, hanem **beilleszthető workflow-elem**.

Ha beteszitek a megfelelő Airtable node-ok mögé, akkor képes lesz egy olyan heti snapshotot generálni, amit Claude már stratégiai elemzésre tud használni.
