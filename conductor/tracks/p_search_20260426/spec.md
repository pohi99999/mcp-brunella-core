# P-SEARCH (Pályázat- és hitelkereső) Specifikáció

## Áttekintés
A P-SEARCH egy intelligens pályázat- és hitelkereső alkalmazás, amely a Brunella Agent System motorjára épül (`Z:\001_Workspace\p-search\`). Az alkalmazás az A2UI v0.9 szabványt használja a dinamikus, kontextusfüggő pályázati és hitelajánlatok megjelenítésére, valamint a dokumentumcsomagok összeállításának támogatására.

## Funkcionális Követelmények
- **Pályázatkeresés:** Valós idejű keresés a palyazat.gov.hu és egyéb forrásokból scraper adapterekkel.
- **Hitelkeresés:** MFB és banki (pl. OTP Széchenyi) hitelkonstrukciók szűrése cégprofil alapján.
- **Illeszkedési Pontszám (Match Score):** AI alapú pontozás a cégadatok és a pályázati feltételek összevetésével.
- **Határidő Figyelés:** Automatikus értesítések és sürgősségi riasztások a lejáró pályázatoknál.
- **Dokumentumcsomag Összeállító:** Az igényléshez szükséges dokumentumok listázása és feltöltésének követése.

## Nem-funkcionális Követelmények
- **Frontend:** React + Vite + TailwindCSS, teljes mértékben A2UI v0.9 alapú generatív UI-val (streamelt widgetek).
- **Backend / Motor:** Brunella (FastAPI) a scraper adapterekkel és az ügynök runtime-mal.
- **Kommunikáció:** WebSocket (Socket.IO) a streamelt UI-parts modellhez.
- **Cache:** In-memory (MVP) és Cloudflare KV (Production) a gyors válaszidőkhöz.

## Hatókörön kívül (Out of Scope)
- Pénzügyi tanácsadás (az alkalmazás csak információszolgáltató).
- Könyvelési funkciók (P-book feladata).

## Elfogadási Kritériumok
- Sikeres pályázat- és hitelkeresés a Brunella ügynök által mock adatokkal (Phase 1).
- A2UI widgetek (pl. Grant Card, Deadline Alert) sikeres streamelt renderelése a frontenden.
- Sikeres adatgyűjtés a palyazat.gov.hu scraper-rel (Phase 2).
