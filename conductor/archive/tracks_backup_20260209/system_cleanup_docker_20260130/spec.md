# Specifikáció: Rendszerszintű Leltár, Dockerizálás és Brunella CLI Integráció

## 1. Áttekintés (Overview)
A projekt célja az `mcp-brunella-core` munkaterület teljes megtisztítása, a dokumentáció centralizálása, a hibrid (Node.js/Python) környezet Dockerbe költöztetése, valamint a két új kulcsfontosságú ügynök (`Project Organizer`, `Agent Architect`) integrálása a natív Brunella CLI-be.

## 2. Funkcionális Követelmények (Functional Requirements)

### 2.1 Leltár és Intelligens Dokumentáció
- **MD Fájl Analízis:** A gyökérkönyvtár összes `.md` fájljának beolvasása és tartalom szerinti elemzése.
- **Könyvtár Audit:** `myai/agents`, `01_AI_ML_Projects` és `_KNOWLEDGE_BASE` mappák felmérése.
- **Intelligens Archiválás:** 
    - A használhatatlan fájlok automatikus archiválása (egy központi `_archive` mappába).
    - A hasznos fájlok megtartása és logikus helyre mozgatása (pl. `01_AI_ML_Projects` -> `projects/`).
- **Centralizáció:** Minden releváns információ beolvasztása a `Brunella.md` (rendszerleírás) és `konyvtarfa.md` (struktúra) fájlokba.
- **Tisztítás:** A szétszórt `.md` és `GEMINI.md` fájlok eltávolítása a gyökérből a beolvasztás után.

### 2.2 Docker Migráció
- **Hibrid Docker Környezet:** A meglévő `Dockerfile.node` és `Dockerfile.python` fájlok felhasználásával egy működő `docker-compose.yml` összeállítása.
- **Kezelhetőség:** A rendszer indítása egyetlen parancsal (`docker-compose up`).
- **Kötések:** A helyi fájlrendszer felcsatolása (bind mount) a folyamatos fejlesztés biztosításához.

### 2.3 Ügynök Integráció (Brunella CLI)
- **Natív Integráció:** A `Project Organizer` és `Agent Architect` ügynökök regisztrálása a Brunella CLI-be (nem a Gemini CLI-be).
- **Aktiválás:** Az ügynökök teljes körű beállítása és tesztelése a saját parancssori felületünkön keresztül.
- **Smoke Test:** Automatikus tesztfeladat futtatása mindkét ügynökkel a helyes működés igazolására.

## 3. Nem-funkcionális Követelmények (Non-functional Requirements)
- **Zajmentesség:** A projekt szerkezete legyen letisztult és átlátható.
- **Egységesség:** Minden projektinformáció egy helyen legyen elérhető.
- **Függetlenség:** A Brunella CLI legyen az elsődleges interfész.

## 4. Elfogadási Kritériumok (Acceptance Criteria)
- [ ] A gyökérkönyvtár "MD mentesített" (kivéve a főbb dokumentumokat).
- [ ] A `Brunella.md` és `konyvtarfa.md` tartalmazza az összes korábban szétszórt tudást.
- [ ] A `docker-compose up` hiba nélkül elindítja a Node.js és Python szolgáltatásokat.
- [ ] A `npm run cli project_organizer` és `npm run cli agent_architect` parancsok sikeresen lefutnak.
- [ ] Az auditált mappákban csak a releváns fájlok maradtak meg, a többi archiválásra került.

## 5. Hatókörön kívül (Out of Scope)
- Külső függőségek (pl. Ollama, AnythingLLM) konténerbe kényszerítése (feltételezzük, hogy ezek host-szinten elérhetők).
- Az ügynökök belső logikájának alapvető átírása (csak az integráció a cél).
