# Spec: Automata Kampány Generátor

**Cél:** A `BEVETEL_AKCIO.md` tervben felvázolt marketing szolgáltatások automatizálása egyetlen, magas szintű "Szuper-Orkesztrátor" ügynökön keresztül, ami egy egyszerű szöveges promptból komplett marketing kampányt generál.

## Követelmények:
1.  **Új Ügynök (`CampaignGeneratorAgent`):** Létre kell hozni egy új ügynököt, ami képes más, specializált ügynököket (pl. `LeadMiningAgent`, `CopywriterAgent`, `UXDesignerAgent`) vezényelni egy előre definiált munkafolyamat mentén.
2.  **Munkafolyamat:** Az ügynöknek a következő lépéseket kell tudnia végrehajtani:
    *   Lead-ek gyűjtése a megadott témában.
    *   Közösségi média posztok írása.
    *   Egyoldalas weboldal tervének elkészítése.
    *   Marketing akcióterv összeállítása.
3.  **Ügynök Regisztráció:** Az új ügynököt regisztrálni kell a `registry.json`-ben, hogy a rendszer lássa és használni tudja.
4.  **Dashboard UI (`CampaignStudio`):** Létre kell hozni egy dedikált, felhasználóbarát felületet a Dashboardon, ahol a felhasználó:
    *   Megadhatja a kampány alapötletét egy szöveges mezőben.
    *   Egy gombnyomással elindíthatja a teljes generálási folyamatot.
    *   Láthatja a végeredményt (a legenerált riportot).
5.  **Navigációs Integráció:** Az új "Kampány Stúdió" panelt be kell integrálni a Dashboard főmenüjébe egy új, "Bevétel" nevű csoportba.
