# Spec: n8n és Langflow Indítás Automatizálása

## Áttekintés
A cél a Brunella ökoszisztémában lévő n8n (lokális npm telepítés) és Langflow (Docker alapú) szolgáltatások indításának egyszerűsítése. Egyetlen gombnyomással a Dashboardról elindíthatóvá tesszük a folyamatokat, biztosítva, hogy az első alkalommal minden "kulcsrakész" állapotba kerüljön (frissítés/telepítés utáni indítás).

## Funkcionális Követelmények
1. **Szolgáltatás Indító Gomb:** Elhelyezése a Dashboard meglévő, n8n-t és Langflow-t tartalmazó megosztott felületén.
2. **n8n Kezelés:** 
   - Helyszín: `f:\mcp-brunella-core\n8nv2`
   - Első indításkor: `npm install` ellenőrzése/futtatása.
   - Indítás aszinkron módon a háttérben.
3. **Langflow Kezelés:**
   - Docker konténer indítása (pl. `docker compose up -d` vagy `docker start`).
   - Indítás aszinkron módon a háttérben.
4. **Visszajelzés:** 
   - A Dashboard jelezze az indítási folyamat sikerességét (Toast értesítés) és az aktuális állapotot.
5. **Konfiguráció:** Meglévő MCP és REST API kulcsok használata a zökkenőmentes kommunikációhoz.

## Technikai Megvalósítás
- **Backend:** Új Express API végpontok az indítási parancsok (shell execution) kezelésére.
- **Frontend:** React komponens bővítése a vezérlő gombokkal.
- **Folyamatkezelés:** `child_process` vagy `spawn` használata a háttérben futó szálakhoz.

## Elfogadási Kritériumok
- A gomb megnyomására az n8n szerver elindul a megadott porton.
- A Langflow Docker konténer elindul és elérhető.
- A folyamatok nem blokkolják a Dashboard UI-t (aszinkron futás).

## Hatókörön kívül
- A szolgáltatások leállítása vagy monitorozása az első sikeres indítás utáni életszakaszban (felhasználói feladat).
