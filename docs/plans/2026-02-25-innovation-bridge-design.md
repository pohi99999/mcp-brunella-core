# 🌉 BAS Design: Innovation Bridge (8. Pillér)
**Dátum:** 2026-02-25 | **Státusz:** Validált Terv | **Verzió:** 1.0

## 1. Összefoglaló
Az Innovation Bridge a Brunella Agent System (BAS) kreatív problémamegoldó motorja. Célja, hogy technikai akadályokra ne csak a szakterületen belüli, hanem kereszt-iparági (biológia, űrkutatás, anyagtudomány stb.) analógiákat és megoldásokat találjon a TRIZ (Feltalálói Problémamegoldás Elmélete) módszertanával.

## 2. Architektúra (Kereszt-beporzó Raj)
A rendszer egy "Swarm" (Raj) logikára épül, amely párhuzamosan több irányba kutat:

1.  **Decomposer Unit (TRIZ Engine):** A GPT-4o által vezérelt modul, amely a problémát 3-4 technikai ellentmondás-párra (Contradiction Matrix) bontja le.
2.  **Research Swarm (Iparági Ugrók):** Dedikált `ResearcherAgent` példányok, amelyek az ellentmondások alapján kiválasztott TRIZ-alapelveket kutatják távoli szakterületeken (tiltólistázva a forrás-iparágat).
3.  **Synthesis Engine:** Egy speciális `EvaluatorAgent`, amely a talált mintákat szűri, validálja és "visszafordítja" a felhasználó konkrét technikai környezetére.

## 3. Adatfolyam és Memória
*   **LanceDB Integráció:** A rendszer minden talált analógiát vektoros formában tárol az `innovation_analogies` táblában.
*   **Instant Inspiration:** Új probléma esetén az ágens először a vektoros adatbázisban keres hasonló elméleti ellentmondásokat.
*   **Task Queue:** A párhuzamos kutatási folyamatokat a BAS központi SQLite feladatlistája kezeli.

## 4. Minőségbiztosítás (EPP v2)
*   **Multi-Model Verification:** A talált megoldások forrását (ArXiv, szabadalom) a Gemini 2.0 Flash validálja.
*   **Constraint-Check Loop:** Minden javaslatot egy szigorú fizikai és környezeti korlát-szűrőn futtatunk keresztül.
*   **Blind Test:** A rendszer pontosságát történelmi technikai sikertörténetek (pl. ciklon-technológia) reprodukálásával mérjük.

## 5. Implementációs Ütemterv (Draft)
1.  TRIZ Contradiction Matrix JSON alapú leképezése.
2.  Párhuzamos `Researcher` delegáló logika fejlesztése.
3.  `innovation_analogies` tábla inicializálása a LanceDB-ben.
4.  Synthesis Engine (analógia-fordító) prompt tuningja.
