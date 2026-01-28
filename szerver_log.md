# mcp-brunella-core v3.0 - Használati Útmutató (Command Center Edition)

Ez a dokumentum a **Brunella Core MCP Szerver 3.0** bővített képességeit mutatja be. A rendszer egy teljes értékű **AI Irányítópulttá (Command Center)** fejlődött, amely integrálja a projektmenedzsmentet, a kódgenerálást, a Google szolgáltatásokat és a rendszerfelügyeletet.

## 🚀 Újdonságok a 3.0-ban
- **Visual Command Center:** Professzionális, sötét módos webes felület (Dashboard) hárompaneles elrendezéssel.
- **SQLite Adatbázis:** Perzisztens memória – a beszélgetések és feladatok állapota megmarad újraindítás után is.
- **Google Workspace Integráció:** Gmail és Google Calendar olvasása közvetlenül az MCP szerverről.
- **Valós Idejű Monitorozás:** Rendszererőforrások (CPU, RAM) és Pipeline állapot vizualizáció.

---

## 🖥️ 1. Brunella Mission Control (Web UI)
Az új irányítópult a rendszer központja.
**Elérés:** `http://localhost:3000`

### Felépítés:
1.  **Bal Panel (Munkaterület):** A `workspace_root` fájljainak áttekintése.
2.  **Középső Panel (Chat & Pipeline):**
    *   **Chat:** Kommunikáció Brunellával.
    *   **Pipeline Státusz:** A fejlécben lévő indikátorok mutatják, hol tart a kódgenerálás (Tervezés -> Generálás -> Tesztelés -> Kész).
3.  **Jobb Panel (Widgetek):**
    *   **Naptár:** Következő események.
    *   **Gmail:** Olvasatlan üzenetek.
    *   **Rendszer:** Hardver statisztikák (Ryzen 7 5800X, RTX 3060).

### Működés:
*   **Chat:** Írj be bármit, az Ollama válaszol.
*   **Kódolás:** Ha kódolási feladatot adsz (pl. "Írj egy scriptet..."), a rendszer automatikusan átvált "CODING_TASK" módba, és elindítja az önjavító pipeline-t.

---

## 💾 2. Adatbázis és Memória
A rendszer egy `better-sqlite3` adatbázist használ a `logs/brunella.db` fájlban.

*   **Mentett adatok:**
    *   Teljes chat előzmény (`messages` tábla).
    *   Feladatok állapota és eredménye (`tasks` tábla).
    *   Munkamenetek (`chats` tábla).
*   **Előny:** Ha bezárod a böngészőt vagy újraindítod a szervert, a beszélgetés ott folytatódik, ahol abbahagytad.

---

## 📧 3. Google Workspace Eszközök
A rendszer képes kommunikálni a Google fiókoddal a `09_SECRETS` mappában lévő hitelesítő adatok segítségével.

### A) Gmail (`gmail_list_messages`)
**Mire jó:** E-mailek áttekintése.
*   **Tool Hívás:** `gmail_list_messages(maxResults=5)`
*   **Kimenet:** Feladó, Tárgy, Részlet.

### B) Naptár (`calendar_list_events`)
**Mire jó:** Napi program ellenőrzése.
*   **Tool Hívás:** `calendar_list_events(maxResults=10)`
*   **Kimenet:** Esemény neve, időpontja, helyszíne.

---

## 🌐 4. Fejlett Böngésző (Playwright)
*   **Tool:** `browser_navigate`
*   **Képesség:** Modern weboldalak (SPA) renderelése, JavaScript futtatása, képernyőkép készítése.

---

## ⚙️ 5. Önjavító Pipeline (Self-Healing)
*   **Tool:** `pipeline_self_healing_gen`
*   **Képesség:** Kódgenerálás -> Sandbox futtatás -> Hiba esetén automatikus javítás (max 3 körben).

---

## 🛡️ 6. Biztonság (Security)
*   **Node.js:** `vm2` sandboxban fut, elzárva a fájlrendszertől.
*   **Python:** Izolált processz, környezeti változók nélkül.
*   **Web:** Csak a `workspace_root` fájljai érhetők el.

---

## 🏁 Indítás
A legegyszerűbb módja a rendszer indításának:
Kattints duplán a **`start_brunella.bat`** fájlra a gyökérkönyvtárban!
Ez elindítja az Ollama-t, az MCP szervert és megnyitja a böngészőt.

Felhő Archi.:

✅ MCP szerver (localhost:3000)
✅ SQL
✅ Google Workspace integráció
✅ Self-healing pipeline
✅ Web UI Dashboard
✅ Playwright
✅ Ollama LLM
   Amit EZ a platform tud:
✅ Cloud-based agent orchest
✅ Scheduled triggers (cron)
✅ Multi
✅ Web
✅ Integration with external MCP servers (mint a ti

┌─────────────────────────────────────────────────────┐
│         CLOUD PLATFORM (Ez a rendszer)              │
│                                                     │
│  ┌──────────────────────────────────────────┐     │
│  │   ORCHESTRATOR AGENT                     │     │
│  │   - Napi 08:00 trigger                   │     │
│  │   - Delegálja a feladatokat              │     │
│  └──┬────────────┬─────────────┬────────────┘     │
│     │            │             │                   │
│  ┌──▼────┐  ┌───▼──────┐  ┌──▼────────┐          │
│  │RESEAR-│  │DATA SCI- │  │KNOWLEDGE  │          │
│  │CHER   │  │ENTIST    │  │MANAGER    │          │
│  │       │  │          │  │           │          │
│  │Web    │  │Tisztít   │  │Strukturál │          │
│  │Search │  │JSON      │  │Tárol      │          │
│  └───┬───┘  └────┬─────┘  └─────┬─────┘          │
│      │           │              │                 │
│      └───────────┴──────────────┘                 │
│                  │                                 │
│                  │ MCP Protocol                    │
└──────────────────┼─────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────┐
│    HELYI RENDSZER (Brunella Core 3.0)               │
│    http://localhost:3000/mcp                        │
│                                                      │
│  ┌────────────────────────────────────────┐         │
│  │  CODER AGENT (Brunella)                │         │
│  │  - Self-healing pipeline               │         │
│  │  - Kódgenerálás                        │         │
│  │  - Sandbox futtatás                    │         │
│  │  - SQLite memória                      │         │
│  └────────────────────────────────────────┘         │
│                                                      │
│  Google Workspace, Playwright, Ollama LLM           │
└──────────────────────────────────────────────────────┘
