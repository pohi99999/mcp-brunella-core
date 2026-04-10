# Specifikáció: Dashboard conductor monitor láthatósági javítás

## 🎯 Célkitűzés
A dashboardon korábban elkészült conductor track monitor nézet legyen újra könnyen elérhető, külön menüpontként, magyar nyelvű feliratozással. A felhasználó lássa egy helyen az aktív, javasolt, befejezett és archivált trackeket, a százalékos készültséget és a részletes dokumentációt.

## ⚠️ Jelenlegi Probléma
- A `ConductorTracksMonitor` komponens létezik és a backend adatforrások is működnek.
- A sidebar mégsem jeleníti meg külön menüpontként a nézetet.
- Emiatt a funkció gyakorlatilag rejtett, csak közvetett módon található meg.

## ✅ Elvárt Állapot
- A conductor track monitor külön menüpontként megjelenik a dashboard oldalsávjában.
- A menüpont magyar nyelvű és a track generálótól egyértelműen elkülönül.
- A monitor oldal fejlécében is magyar, érthető elnevezés jelenik meg.
- Regressziós teszt védi, hogy a menüpont a jövőben se essen ki a sidebar group-konfigurációból.

## 🛠️ Technikai Követelmények
- `src/dashboard/lib/navigation.tsx` oldalsáv-csoport konfiguráció frissítése.
- `src/dashboard/components/dashboard/ConductorTracksMonitor.tsx` fejléc magyarítása.
- `src/dashboard/i18n/locales/hu.json` és `en.json` nav label finomhangolása.
- Új dashboard teszt, amely ellenőrzi, hogy a `conductor-monitor` a projektmenedzsment csoport része.