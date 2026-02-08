# Track Specifikáció: Átfogó Rendszerteszt és Hibajavítás

## 1. Célkitűzés
A Brunella CLI és az Ügynökök (Agents) minden funkciójának szisztematikus, mélyreható tesztelése. A cél a "harcedzett" állapot elérése. Minden hiba azonnali blokkoló tényezőnek minősül, amelyet a helyszínen javítani kell (Hotfix).

## 2. Tesztelési Mátrix

### A. CLI Core Parancsok
| Parancs | Elvárt Viselkedés |
| :--- | :--- |
| `brunella about` | Verzió és config útvonalak megjelenítése. |
| `brunella tools` | Az elérhető toolok listázása (Server + Local). |
| `brunella agents` | Az aktív ügynökök listázása és leírása. |
| `brunella run ping` | "Pong!" válasz a szervertől. |

### B. Ügynök Funkciók (End-to-End)
| Ügynök | Teszt Forgatókönyv | Elvárt Eredmény |
| :--- | :--- | :--- |
| **Orchestrator** | "Szia, ki vagy?" | Közvetlen, rövid válasz (Nincs tervkészítés). |
| **Data Scientist** | "Clean: { 'bad': 'json' }" | Strukturált, tisztított JSON válasz (Refiner logic). |
| **Python Dev** | "Számold ki a 50. Fibonacci számot" | Python kód futtatása és a helyes eredmény (12586269025). |
| **Node Dev** | "Írj egy Hello World függvényt" | Generált JS kód megjelenítése. |
| **Ops** | "Milyen a rendszer állapota?" | Metrikák vagy logok lekérdezése (Monitor tool). |
| **Researcher** | "Keress infót a projektben" | RAG találatok visszaadása (ha van adat). |

## 3. Protokoll
1. Teszt futtatása.
2. Siker esetén: ✅ Pipa, tovább.
3. Hiba esetén: 🛑 STOP.
    - Hibaok elemzése (Logok, Kód).
    - Javítás (Code Fix).
    - Újrafordítás (`npm run build`).
    - Újratesztelés.
4. Csak sikeres javítás után léphetünk a következő tesztre.
