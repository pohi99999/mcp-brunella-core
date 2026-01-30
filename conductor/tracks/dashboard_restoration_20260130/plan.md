# Implementation Plan: Dashboard UI & Functionality Restoration

## Phase 1: Diagnostics & API Discovery
- [ ] **Analyze Backend Routes:** Megvizsgálni az `src/server` (pl. `web.ts`, `server.ts`) fájlokat, hogy milyen API végpontok léteznek a Chat és Agents funkciókhoz.
- [ ] **Analyze Frontend Requests:** Megvizsgálni a frontend kódját (`src/dashboard` vagy `src/client`), különösen a Chat és Agents komponenseket, hogy hova próbálnak kéréseket küldeni.
- [ ] **Identify Mismatch:** Összehasonlítani a backend által nyújtott és a frontend által várt végpontokat/adatstruktúrákat.

## Phase 2: Backend Implementation (Fixing the API)
- [ ] **Implement/Fix Agents API:** Biztosítani, hogy a `GET /api/agents` (vagy hasonló) végpont visszaadja a regisztrált ügynökök listáját.
- [ ] **Implement/Fix Chat API:** Biztosítani a `POST /api/chat` és az üzenetek lekérésére szolgáló végpontok működését. Ha SSE-t használ, annak ellenőrzése.

## Phase 3: Frontend Connection (Fixing the UI)
- [ ] **Update Frontend Fetch Logic:** Ha a végpontok változtak vagy hibásak, javítani a frontend oldali hívásokat.
- [ ] **Fix Data Display:** Biztosítani, hogy a kapott JSON adatok helyesen jelenjenek meg a komponensekben.

## Phase 4: Verification
- [ ] **API Testing:** `curl` vagy script segítségével tesztelni a javított végpontokat.
- [ ] **Build Check:** Lefuttatni a `npm run build` parancsot a dashboardhoz, hogy biztosan ne legyen fordítási hiba.
