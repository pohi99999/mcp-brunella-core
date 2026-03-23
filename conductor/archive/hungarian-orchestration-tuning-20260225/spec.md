# Spec: Magyar Nyelvű Orkesztráció

**Cél:** Biztosítani, hogy a BAS rendszer minden rétege (Dashboard, CLI, Ügynökök, LLM-ek) a magyar nyelvet preferálja és mélyen megértse, lehetővé téve a felhasználó számára a természetes, magyar nyelvű feladatkiosztást és koordinációt.

## Követelmények:
1.  **Rendszer-szintű Utasítás:** A központi LLM-ek (GPT-4o, Gemini) egyértelmű, magyar nyelvű rendszer-utasítást (System Prompt) kapjanak, ami definiálja a szerepüket (BAS Master Orchestrator) és az elvárt kommunikációs stílust.
2.  **Szándékfelismerés:** Az `intentAnalyzer` modult fel kell készíteni a magyar nyelvű kulcsszavak és kifejezések ("keress rá", "írj kódot") felismerésére a helyes (Local vs. Edge) feladatirányításhoz.
3.  **Felhő Kommunikáció:** A Cloudflare Worker-eknek küldött kéréseknek és az onnan kapott válaszoknak is támogatniuk kell a magyar nyelvet.
4.  **UI Lokalizáció:** A Dashboardon megjelenő üzeneteknek, hibáknak és tájékoztató szövegeknek magyarul kell megjelenniük.
5.  **Verifikáció:** Tesztekkel kell igazolni, hogy a magyar nyelvű promptokra a rendszer a megfelelő (magyar nyelvű és logikailag helyes) választ adja.
