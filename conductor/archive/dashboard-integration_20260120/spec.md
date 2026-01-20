# Track Specifikáció: Irányítópult Integráció és Fejlesztés

## 1. Áttekintés
A `mcp-brunella-core-ir` repository-ban található irányítópult (Dashboard) teljes körű forráskód-integrációja a `mcp-brunella-core` projektbe. A cél egy központi, webes felület biztosítása a rendszer felügyeletére, az ügynökök (Agents) menedzselésére és a rendszerállapot vizualizációjára. A fejlesztés része egy "Semantic Test Book" létrehozása is, amely alapján Jules (AI ügynök) rendszeres, önálló validálást végez.

## 2. Funkcionális Követelmények

### 2.1 Integráció és Architektúra
- **Monorepo Struktúra:** A külső dashboard forráskódjának integrálása a fő projekt könyvtárstruktúrájába (pl. `src/dashboard` vagy hasonló).
- **Egységes Build:** A backend és frontend build folyamatok összefésülése a `package.json`-ben.
- **Kommunikáció:** A kliens és szerver közötti kommunikáció kizárólag szabványos MCP protokollon (JSON-RPC) keresztül valósul meg.

### 2.2 Irányítópult Funkciók
- **Rendszer Egészség (Health Check):**
  - CPU, Memória használat kijelzése.
  - Külső függőségek állapota (Docker Sandbox, Ollama kapcsolat, Adatbázisok).
- **MCP Eszközvezérlő (Tool Inspector):**
  - Elérhető eszközök listázása.
  - Eszközök interaktív tesztelése (input megadása, output megjelenítése).
- **RAG Vizualizáció:**
  - Tudásbázis (LanceDB) állapotának megjelenítése.
  - Vektoros keresések tesztelése és eredményeinek vizualizációja.
- **Jules Report UI:**
  - Dedikált felület a Jules által végzett tesztek eredményeinek (jegyzőkönyvek, hibák) megjelenítésére.

### 2.3 Ügynök Menedzsment (Agent Management)
- **Ügynök Lista:** Az összes regisztrált ügynök megjelenítése kártyás vagy listás nézetben.
- **Eszközök Vizualizációja:** Melyik ügynök milyen eszközökhöz fér hozzá.
- **Konfiguráció:** Ügynökök eszközkészletének dinamikus beállítása/szerkesztése.
- **Kompozíció:** Ügynökök "összeállítása" (pl. melyik ügynök hívhatja a másikat, hierarchia vizualizáció).
- **Vezérlés:** Ügynökök indítása, leállítása, vagy direkt utasítás küldése.

### 2.4 Tesztelés (Jules & Semantic Testing)
- **Teszt Könyv (Test Book):** Egy strukturált Markdown dokumentum (`testing/TEST_BOOK.md`) létrehozása, amely emberi nyelven írt tesztforgatókönyveket tartalmaz.
- **Önálló Végrehajtás:** Jules képessé tétele arra, hogy olvassa ezt a könyvet, és az MCP eszközökön keresztül végrehajtsa a teszteket.

## 3. Nem-Funkcionális Követelmények
- **UX/UI:** Modern, reszponzív felület (a hozott kód alapján, szükség esetén igazítva a Brunella stílushoz).
- **Teljesítmény:** Gyors betöltés, minimális késleltetés az MCP hívásoknál.
- **Stabilitás:** A dashboard hibái nem akaszthatják meg a Core szerver működését.

## 4. Hatókörön Kívül (Out of Scope)
- Új backend funkciók fejlesztése (kivéve ami a dashboard kiszolgálásához elengedhetetlen).
- Mobil applikáció fejlesztése.
