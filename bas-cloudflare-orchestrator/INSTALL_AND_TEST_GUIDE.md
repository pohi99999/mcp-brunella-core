# BAS (Brunella Agent System) - Telepítési és Tesztelési Útmutató
# Gemini CLI Agent számára - Önálló végrehajtáshoz

> **Megjegyzés:** A projekt elérési útja: `f:\mcp-brunella-core\bas-cloudflare-orchestrator`

---

## 🎯 KÜLDETÉS

Te a Gemini CLI agent vagy. A feladatod a BAS (Brunella Agent System) hibrid architektúra telepítése, konfigurálása és tesztelése.

**Fontos szabályok:**
1. Minden parancs után várd meg az eredményt
2. Hiba esetén próbáld meg javítani, ha nem sikerül, dokumentáld és folytasd
3. Minden teszt eredményét írd be a `TEST_RESULTS.md` fájlba

---

## FÁZISOK ÖSSZEFOGLALVA

- **0:** Előfeltételek (Node, npm, Python, Docker, Ollama, Wrangler)
- **1:** Projekt telepítés (npm install, KV namespace)
- **2:** Cloudflare Worker deploy
- **3:** Langflow telepítés és konfiguráció
- **4:** n8n telepítés és konfiguráció
- **5:** Browser-Use API telepítés
- **6:** Integrációs tesztek
- **7:** Összefoglaló jelentés

---

*Teljes útmutató: lásd a megosztott dokumentumot*
