# Invoice Automation Phase 5 - UI Spec (Mission Control Widget)

## 🎯 Cél
Mission Control felületen jelenjen meg egy **„Invoice Sync”** widget, ami:

- Megmutatja a legutóbbi szinkron státuszát
- Egy kattintással képes indítani a teljes sync folyamatot
- Rövid, világos visszajelzést ad (mennyi számla került be, hány duplikátum volt)

---

## 📍 Elhelyezés
- **Mission Control** dashboard jobb oldali oszlop
- **SystemHealthCard** alatt, **TrackProgressWidget** fölött

---

## 🧩 Megjelenített adatok
| Mező | Leírás | Megjegyzés |
|------|--------|-----------|
| Státusz | `IDLE` / `RUNNING` / `SUCCESS` / `ERROR` | Badge színnel |
| Utolsó futás | ISO timestamp → emberi formátum | `N/A` ha nincs |
| Lekért számlák | `fetched` | 0 ha nincs |
| Írt sorok | `row_count` | Google Sheets visszajelzés |
| Duplikátumok | `duplicates_skipped` | (Phase 4) |
| Forrás mód | API / Gmail Fallback | rövid label |

---

## 🎛️ Interakciók (UI Controls)

**Alap:**
- `Szinkron indítása` gomb
- Futás közben disabled + loader

**Haladó opciók (collapsed panel):**
- `Dátumtól` (YYYY-MM-DD, optional)
- `Limit` (default: 100)
- `Csak nem fizetett` (bool)
- `Csak lejárt` (bool)
- `Cache bypass` (force_refresh)
- `Append mode` (default: true)
- `Clear first` (append=false esetén)
- `Skip duplicates` (default: true)
- `Batch size` (default: 75)

---

## ✅ UX Szabályok

- Hibák esetén `toast.error` + státusz `ERROR`
- Sikeres futásnál `toast.success` + státusz `SUCCESS`
- UI mindig mutassa az utolsó futás adatait (session state)
- Ha nincs adat → `N/A`, `0`, vagy dimmed placeholder

---

## 📌 EPP v2 Compliance

- Nincs inline console.log
- Reusable `apiService.executeTool` használat
- Minimal UI footprint (glass-card stílus)
