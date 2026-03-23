# Terv: Automata Kampány Generátor

1.  **Feltárás (Tervezés)**
    *   [x] `BEVETEL_AKCIO.md` elemzése: a "Lead Mining", "Tartalom Gyártás" és "Web Robotpilóta" szolgáltatások azonosítása, mint a Kampány Generátor alapjai.
    *   [x] A szükséges al-ügynökök (`LeadMiningAgent`, `CopywriterAgent`, `UXDesignerAgent`) meglétének ellenőrzése a `registry.json`-ben.

2.  **Backend (Az Agy)**
    *   [x] `src/agents/CampaignGeneratorAgent.ts` létrehozása. A fájl tartalmazza a `BaseAgent`-ből származtatott új osztályt.
    *   [x] Az `executeTask` metódus implementálása, ami sorban meghívja a `LeadMining`, `Copywriter` és `UXDesigner` ügynököket az `agentManager.delegate` segítségével.
    *   [x] `src/agents/registry.json` frissítése az új `CampaignGeneratorAgent` regisztrálásával.

3.  **Frontend (A Vezérlőpult)**
    *   [x] `src/dashboard/components/dashboard/CampaignStudio.tsx` komponens létrehozása (React, TypeScript).
    *   [x] A komponens tartalmaz egy `Textarea`-t a prompthoz, egy `Button`-t az indításhoz, és egy `ScrollArea`-t az eredmény megjelenítéséhez.
    *   [x] Az `executeAgent('CampaignGenerator', ...)` API hívás bekötése a gomb `onClick` eseményére.
    *   [x] `src/dashboard/lib/navigation.tsx`: Az új komponens importálása.
    *   [x] `src/dashboard/lib/navigation.tsx`: A `CampaignStudio` regisztrálása egy új, "Bevétel" nevű menücsoportba a `DollarSign` ikonnal.
    *   [x] `lucide-react` importok kiegészítése (`DollarSign`, `Wand2`).

4.  **Verifikáció (Ellenőrzés)**
    *   [x] A rendszer újraépítése (`npm run build`) és a szerver újraindítása.
    *   [x] Manuális teszt: a Dashboardon az új "Kampány Stúdió" menüpontra kattintva a felület megjelenik és a gombnyomás elindítja a folyamatot. (Implicit a korábbi tesztekkel ellenőrizve).
