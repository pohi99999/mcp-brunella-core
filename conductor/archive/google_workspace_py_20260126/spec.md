# Specification: Google Workspace Integráció (Python)

## 1. Overview
Ez a track a Google Workspace (Gmail, Drive) funkciók integrálását célozza a Brunella Core rendszerbe. A Python alapú `fastmcp` könyvtárat használjuk fel arra, hogy MCP eszközöket (tools) hozzunk létre, amelyek képesek e-maileket küldeni/olvasni és fájlokat kezelni a Google Drive-on.

## 2. Goals
- Python környezet felkészítése Google API hívásokra.
- Biztonságos hitelesítési mechanizmus implementálása (OAuth2 vagy Service Account).
- Új MCP szerver modul létrehozása: `src/servers/google_workspace.py`.
- MCP eszközök implementálása:
    - `gmail_send_email`: Email küldése.
    - `gmail_read_emails`: Beérkező levelek listázása/olvasása.
    - `drive_list_files`: Fájlok keresése Drive-on.
- Integráció ellenőrzése tesztekkel.

## 3. Requirements
- **Dependencies:** `google-api-python-client`, `google-auth-httplib2`, `google-auth-oauthlib`.
- **Authentication:**
    - A hitelesítő adatok (`credentials.json` vagy `service_account.json`) kezelése biztonságosan (környezeti változók vagy titkosított fájlok).
    - Token kezelés és megújítás.
- **MCP Server:**
    - `fastmcp` használata a szerver definiálására.
    - Eszközök megfelelő típusdefiníciókkal (Type Hints) és leírásokkal (Docstrings).
- **Error Handling:**
    - API hiba (pl. kvóta túllépés, jogosultság hiánya) megfelelő kezelése és MCP hibaüzenetté konvertálása.

## 4. Out of Scope
- Google Calendar integráció (egyelőre).
- Teljes körű fájl szinkronizáció.
- UI komponensek fejlesztése a Dashboard-hoz.
