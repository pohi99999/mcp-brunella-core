# Implementációs Terv: Error Handling Standardization

## 📋 Fázisok

### 1. Fázis: "Silent Swallow" elimináció
- [ ] Keresés a kódban az üres vagy csak kommentet tartalmazó catch blokkokra.
- [ ] Legalább egy `logDebug` hívás beillesztése minden ilyen helyre.

### 2. Fázis: catch(any) refaktor
- [ ] `src/server/routes/` fájlok átnézése és javítása.
- [ ] `src/utils/globalDb.ts` és adatbázis réteg javítása.

### 3. Fázis: Error Helper bevezetése
- [ ] `ensureError` utility létrehozása az `utils` mappában.
- [ ] Az új helper bevezetése a komplexebb hibakezelési helyeken.

### 4. Fázis: Verifikáció
- [ ] Tesztfuttatás (`npm test`).
- [ ] Szándékos hiba kiváltása egy API végponton és a log formátum ellenőrzése.

## 🎨 Dashboard Integráció
- [ ] Ellenőrizni, hogy a javítás után a hibaüzenetek szebben jelennek-e meg a Dashboard Toast értesítéseiben.

## 🖥️ CLI Integráció
- [ ] CLI hibaüzenetek konzisztenciájának ellenőrzése.
