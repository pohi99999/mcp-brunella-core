# 📋 Conductor Frissítési Sablon

Másold be ezt a Cursor ügynöknek amikor befejeztétek a munkát:

---

## SABLON (másold innen)

```
## Feladat: Conductor Frissítés

A mai munkamenetet rögzíteni kell a Conductor rendszerben.

### 1. Határozd meg a Track nevét és típusát

**Track neve:** [Írd ide a téma rövid nevét, pl. "Dashboard Socket.IO Fix"]
**Dátum:** [mai dátum, pl. 2026-02-02]
**Típus:**
- [ ] Új track (ha teljesen új feladat volt)
- [ ] Meglévő track frissítése (ha folytatás volt)

### 2. Frissítsd a conductor/tracks.md fájlt

Ha **ÚJ TRACK**, add hozzá a "✅ Lezárt Szálak" szekcióhoz (legfelülre):

- [x] **[TRACK NEVE] ([DÁTUM]):**
  - **Eredmény:** [1-3 mondat: mit csináltunk, milyen fájlokat érintett]
  - 📂 *[./tracks/[track_mappa_neve]/](./tracks/[track_mappa_neve]/)*

Ha **MEGLÉVŐ TRACK FRISSÍTÉSE**, módosítsd az eredmény részt.

### 3. Ha szükséges, hozd létre a track mappát

```
conductor/tracks/[track_neve_datum]/
├── spec.md         # Mi volt a cél
├── plan.md         # Hogyan csináltuk (opcionális)
└── COMPLETION_REPORT.md  # Végső összefoglaló (opcionális)
```

### 4. Amit ma csináltunk (töltsd ki!)

**Érintett fájlok:**
- [sorold fel a módosított/létrehozott fájlokat]

**Főbb változások:**
- [mi történt, mit implementáltunk]

**Build státusz:** npm run build - sikeres/sikertelen
**Teszt státusz:** npm test - sikeres/sikertelen

### 5. Ellenőrzés

- [ ] conductor/tracks.md frissítve
- [ ] Track mappa létrehozva (ha új track)
- [ ] Build sikeres
```

---

## GYORS VERZIÓ (ha siet)

```
Frissítsd a Conductor-t a mai munkával:

1. Nyisd meg: conductor/tracks.md
2. Add hozzá a "✅ Lezárt Szálak" részhez (felülre):

- [x] **[TRACK NEVE] (2026-02-02):**
  - **Eredmény:** [amit csináltunk röviden]
  - 📂 *[./tracks/[track_neve]/](./tracks/[track_neve]/)*

Érintett fájlok: [felsorolás]
```

---

## TIPP

Ha nem tudod mi a track neve, írd le mit csináltatok és kérd az ügynököt:
"Adj ennek a munkának egy rövid, angol nyelvű track nevet a Conductor-hoz"
