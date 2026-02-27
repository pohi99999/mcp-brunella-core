# ÁRAJÁNLAT KÉSZÍTŐ SKILL - HASZNÁLATI ÚTMUTATÓ

## 📦 Skill Telepítése

1. Töltsd le a `arajanlat-keszito.skill` fájlt
2. Claude.ai-ban nyisd meg a **Settings > Skills** menüt
3. Kattints az **"Upload Skill"** gombra
4. Válaszd ki az `arajanlat-keszito.skill` fájlt
5. A skill automatikusan aktiválódik

## 🚀 Gyors Kezdés

### 1. Árajánlat Kérése

Egyszerűen kérd Claude-tól:

```
"Készíts árajánlatot a Balatonakali tóra, biológiai kezelésre"
```

vagy

```
"Kérek egy árajánlatot iszapkotrásra egy 5 hektáros tavunkra"
```

### 2. Claude Adatokat Kér

Claude automatikusan végigkérdezi az összes szükséges információt:
- Ügyfél adatai (név, cím, adószám)
- Projekt helyszíne
- Vízterület mérete
- Védettségek, speciális tényezők
- Projekt típusa

### 3. Árkalkuláció

Claude automatikusan:
1. Generál egy Excel kalkulátort
2. Kitölti a projekt adataival
3. Kiszámolja az árakat
4. Beilleszti az árajánlatba

### 4. Kész Árajánlat

Claude létrehoz egy professzionális, 4-8 oldalas DOCX dokumentumot, amit le tudsz tölteni.

## 📋 Mit Tartalmaz a Skill?

### ✅ Automatikus Tartalom Generálás

- **Címlap:** Logo, projekt neve, helyszín
- **Alapadatok:** Ügyfél és Iszapfaló Kft. adatai
- **Projekt leírás:** Vízterület bemutatása, igények
- **Műszaki javaslatok:** Releváns technológiák leírása
- **Árajánlat:** Részletes árazás táblázattal
- **Céginformációk:** Rövid bemutatkozás, referenciák

### 💰 Árkalkuláció

A skill tartalmazza az aktuális egységárakat:

**Felmérés:**
- 0-3 ha: 175.000 Ft+ÁFA
- 4-6 ha: 225.000 Ft+ÁFA

**Biológiai kezelés:**
- Szuper-intenzív: 670.000 Ft+ÁFA/ha/év
- Intenzív: 380.000 Ft+ÁFA/ha/év
- Fenntartó: 130.000 Ft+ÁFA/ha/év

**Hidromechanizációs kotrás:**
- Felvonulás: 340.000 Ft+ÁFA
- Kotrás: 2.700 Ft+ÁFA/m³

**Eszközök:**
- Áramoltatók: 435.000-560.000 Ft+ÁFA/db

### 🛠️ Támogatott Projekt Típusok

1. **Biológiai iszapkezelés** - szuper-intenzív, intenzív, fenntartó
2. **Hidromechanizációs kotrás** - Truxor, pelyhesítés
3. **Felmérés** - ultrahangos, mechanikus mérések
4. **Partvédelem** - geotextil, akác, vörösfenyő
5. **Eszközbeszerzés** - áramoltatók, levegőztetők
6. **Kombinált projektek** - több szolgáltatás együtt

## 🎨 Vizuális Megjelenés

- **Logo:** Iszapfaló Kft. logo minden oldalon
- **Színvilág:** Zöld-sárga (#70AD47, #FFC000)
- **Formátum:** Professzionális, strukturált, könnyen olvasható
- **Terjedelem:** 4-8 oldal (tömör, lényegretörő)

## 🔧 Excel Kalkulátor Használata

Ha manuálisan szeretnéd módosítani az árakat:

1. Claude generál egy Excel fájlt
2. Letöltöd és megnyitod
3. Módosítod a mennyiségeket/árakat
4. Visszatöltöd Claude-nak
5. Claude beilleszti az árajánlatba

## 💡 Tippek és Trükkök

### ✅ Legjobb Gyakorlatok

1. **Adj meg minél több adatot kezdetben** - kevesebb kérdés-válasz kör
2. **Légy specifikus a projekt típusánál** - pontosabb tartalom
3. **Említsd meg a speciális igényeket** - személyre szabottabb ajánlat
4. **Ha van fotód a helyszínről** - töltsd fel, szebb lesz az ajánlat

### ⚠️ Kerülendő

1. **Túl általános kérések** - "készíts árajánlatot" (mire?)
2. **Hiányos adatok** - Claude végig fog kérdezni
3. **Több projekt egyszerre** - külön árajánlat kell mindhez

## 📞 Kapcsolat és Támogatás

Ha kérdésed van a skill használatával kapcsolatban, vagy módosítást szeretnél:

**Iszapfaló Kft.**
- Email: kovasznai.gergely@iszapfalo.hu
- Telefon: +36-20/228 7484
- Cím: 2100 Gödöllő, Ősz utca 20.

## 📝 Példa Párbeszéd

```
Te: Készíts árajánlatot a Szilas-patak horgásztó biológiai kezelésére

Claude: Rendben! Készítek egy árajánlatot a Szilas-patak horgásztó 
biológiai kezelésére. Kérem, add meg az alábbi adatokat:

1. Megrendelő neve:
2. Megrendelő címe:
3. Megrendelő adószáma:
4. Projekt pontos helyszíne:
5. Vízterület mérete (hektár):
6. Van-e valamilyen védettség a területen?
7. Milyen intenzitású kezelést szeretnél? (szuper-intenzív/intenzív)

Te: [megadod az adatokat]

Claude: [generálja az árajánlatot]

Elkészítettem az árajánlatot! Letöltheted innen: 
[link a DOCX fájlhoz]

Az árajánlat tartalmazza:
- Részletes projekt leírást
- Biológiai kezelés műszaki bemutatását
- Árkalkulációt
- Fizetési ütemezést
- Cégbemutatkozást

Összesen: 2.698.000 Ft+ÁFA (7,1 ha × 380.000 Ft/ha intenzív kezelés)
```

## 🔄 Frissítések

A skill automatikusan használja a legfrissebb:
- Egységárakat
- Technológiai leírásokat
- Céginformációkat
- Referenciákat

Ha bármi változik, csak frissítsd a skill fájlokat és töltsd fel újra.

## ✅ Checklist Árajánlat Készítéshez

- [ ] Megrendelő adatai megvannak
- [ ] Projekt helyszíne tisztázva
- [ ] Vízterület mérete ismert
- [ ] Projekt típusa eldöntve
- [ ] Speciális igények megbeszélve
- [ ] Árak ellenőrizve
- [ ] Dokumentum letöltve
- [ ] Ügyfélnek elküldve

---

**Készítette:** Iszapfaló Kft.  
**Utolsó frissítés:** 2025.11.11.  
**Verzió:** 1.0
