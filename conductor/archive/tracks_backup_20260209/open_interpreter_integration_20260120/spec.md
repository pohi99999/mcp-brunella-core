# Track Specifikáció: Open Interpreter Integráció

## 1. Áttekintés
Integráljuk a lokális Open Interpreter instance-t (`F:\OneDrive\Desktop\Brunella_es_en\open-interpreter`) a Cogella Core Gateway-be. Ez lehetővé teszi az ágensek számára, hogy komplex operációs rendszer szintű feladatokat hajtsanak végre biztonságos, megerősítést kérő módon.

## 2. Funkcionális Követelmények
- **Query Végrehajtás:** Kérés küldése az Open Interpreter-nek.
- **Válasz Beolvasása:** Az interpreter kimenetének (STDOUT/STDERR) visszaküldése az MCP-n keresztül.
- **Konfiguráció:** A lokális `config.yaml` használata.

## 3. Technikai Részletek
- **Elérési út:** `F:\OneDrive\Desktop\Brunella_es_en\open-interpreter`
- **Végrehajtás:** `.venv\Scripts\python.exe` hívása az `interpreter` modulon keresztül.
- **Mód:** Non-interactive mód (`-y` flag) használata ott, ahol biztonságos, vagy kézi jóváhagyás.

## 4. MCP Eszköz
- `interpreter_open_query(prompt: string)`
