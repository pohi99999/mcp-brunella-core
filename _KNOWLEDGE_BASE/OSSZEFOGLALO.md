# Brunella Munkaterület Projekt Összefoglaló

**Utolsó frissítés:** 2025. november 25.

Ez a dokumentum a `G:\Brunella` munkaterületen található projektek és komponensek magas szintű összefoglalója, a 2025. novemberi nagy átszervezés és dokumentálás utáni állapot szerint.

---

## Új Struktúra Áttekintése

A munkaterület a következő, `_br_` előtagú logikai egységekre lett bontva:

| Könyvtár | Tartalma és Célja |
| :--- | :--- |
| **`_br_projects/`** | Aktív szoftverfejlesztési projektek. **Minden itt található projekthez tartozik egy `GEMINI.md` fájl**, amely részletesen leírja a projekt célját, technológiáit, állapotát és a javasolt következő lépéseket. |
| **`_br_scripts/`** | Újrafelhasználható, önálló scriptek, parancssori eszközök és kiterjesztések. |
| **`_br_knowledge_base/`** | A központi, hosszú távú tudásbázis (`Tudas` mappa), amely a kutatási anyagokat, elemzéseket és mélyebb technikai dokumentációkat tartalmazza. |
| **`_br_docs/`** | Általános, projekthez nem szorosan kötődő dokumentumok, jegyzetek, útmutatók. |
| **`_br_assets/`** | Képek, logók, PDF-ek, telepítők és egyéb nem-kód jellegű fájlok. |
| **`_br_config/`** | Munkaterület-szintű konfigurációs fájlok. |
| **`_br_secrets/`** | API kulcsok, SSH kulcsok és egyéb érzékeny adatok. |
| **`_ARCHIVUM/`** | Régi, félbehagyott, feleslegesnek ítélt projektek, letöltések és ideiglenes fájlok. Semmi sem törlődik, csak ide kerül áthelyezésre a későbbi visszakereshetőség érdekében. |

---

## Főbb Projektek (`_br_projects/`)

Az alábbi lista a `_br_projects` mappában található legfontosabb projekteket emeli ki. **A részletes információkért, kérlek, olvasd el az adott projekt mappájában található `GEMINI.md` fájlt.**

| Projekt | Leírás |
| :--- | :--- |
| **`BrunellaV4`** | MI-alapú projektmenedzsment és automatizációs platform (Flask, Gemini, Google Workspace). A munkaterület egyik központi, aktív projektje. |
| **`gemini-cli`** | A hivatalos, nyílt forráskódú Gemini parancssori eszköz (TypeScript, Node.js). A másik központi projekt, amely a munkaterület vezérlésére szolgál. |
| **`Chrome-DevTools-MCP`** | MCP szerver, amely AI-ügynökök számára teszi lehetővé a Chrome böngésző irányítását, AI-alapú elem-lokalizációval. |
| **`playwright-mcp`** | Hasonló a `Chrome-DevTools-MCP`-hez, de a Playwright keretrendszerre épül, és az akadálymentességi fát használja a böngésző automatizálásához. |
| **`github-mcp-server`** | Hivatalos GitHub MCP szerver, amely teljes körű hozzáférést biztosít a GitHub API-hoz AI-ügynökök számára. |
| **`A2A Ökoszisztéma`** (`a2a-go`, `a2a-js`, `a2a-python`, `a2a-inspector`) | Többnyelvű (Go, JS, Python) SDK-k és egy webes "inspector" eszköz az Agent-to-Agent (A2A) protokoll implementálásához. |
| **`AI/ML Kutatási Keretrendszerek`** (`acme`, `iree`, `LiteRT`) | Professzionális, nyílt forráskódú keretrendszerek a megerősítéses tanulás (acme), az ML modellek fordítására (iree) és az "on-device" futtatásra (LiteRT). |
| **`OpenAI & Anthropic Példatárak`** (`openai-cookbook`, `claude-cookbooks`, `openai-agents-js`, `openai-agents-python`) | Hivatalos "receptkönyvek" és SDK-k az OpenAI és a Claude modellekkel való fejlesztéshez. |
| **`Google Cloud & Workspace Példatárak`** (`generative-ai`, `vertex-ai-samples`, `python-docs-samples`, `python-samples`, stb.) | Hivatalos Google mintakód-gyűjtemények a Google Cloud és a Workspace szolgáltatások használatához. |

A `_br_projects` mappa a fentieken kívül még számos kisebb, kísérleti vagy specifikus célt szolgáló projektet tartalmaz, amelyek mindegyike a saját `GEMINI.md` fájljában van dokumentálva.