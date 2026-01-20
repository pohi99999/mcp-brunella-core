# Track Specifikáció: Jules Ágens Integráció és QA Szerepkör

## 1. Áttekintés
A cél a GitHub Jules ágens formális integrálása a fejlesztési folyamatba, mint hibrid DevOps partner és minőségbiztosítási (QA) felelős. Jules feladata a rendszer folyamatos tesztelése, hibajavítása és karbantartása a `TEST_BOOK.md` és a forráskódhoz való teljes (White Box) hozzáférés alapján.

## 2. Funkcionális Követelmények

### 2.1 Ágens Instrukciók (AGENTS.md)
- **Központi definíció:** Létrehozunk egy gyökérszintű `AGENTS.md` fájlt, amely leírja Jules szerepét, felelősségeit és a rendszer architektúráját.
- **Működési protokollok:** Rögzítjük a tesztelési parancsokat, a hibajelentési formátumot és a javítási folyamatot.
- **Környezeti kontextus:** Jules számára láthatóvá tesszük az elérhető MCP végpontokat és a `logs/` mappát.

### 2.2 QA és Tesztelési folyamat
- **Semantic Testing:** Jules képessé tétele a `testing/TEST_BOOK.md` szcenárióinak önálló végrehajtására.
- **Log Elemzés:** Jules rendszeresen ellenőrzi a `logs/web_ui.log` és `logs/agent-manager.log` fájlokat anomáliák után kutatva.
- **Automatizált visszacsatolás:** Definiáljuk, hogyan kapjon Jules értesítést a kritikus hibákról (pl. GitHub Issues vagy speciális log fájl).

### 2.3 White Box hozzáférés
- **Kód-szintű mélység:** Jules felhatalmazása a `src/` mappa módosítására a hibák elhárítása érdekében.
- **Adatbázis integritás:** Jules ellenőrizheti és javíthatja a `logs/brunella.db` (SQLite) állapotát.

## 3. Nem-Funkcionális Követelmények
- **Transzparencia:** Jules minden tevékenységét naplóznia kell a `szerver_log.md` vagy egy dedikált `jules_activity.log` fájlba.
- **Biztonság:** Jules nem módosíthatja a `.env` titkos fájlokat (API kulcsok).

## 4. Hatókörön Kívül (Out of Scope)
- Új infrastruktúra (pl. CI/CD szerver) kiépítése.
- Más külső ágensek (pl. Claude) integrálása ebben a körben.
