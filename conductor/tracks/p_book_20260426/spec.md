# P-book (Könyvelés) Specifikáció

## Áttekintés
A P-book egy modern, KKV könyvelési automatizálásra fókuszáló alkalmazás, amely a Brunella Agent System motorjára épül, de különálló projektként fut (`Z:\001_Workspace\Könyvelés\`). A cél egy gyors, operátor-fókuszú, "Dark FinTech" stílusú dashboard létrehozása, amely az AI ügynökökkel (A2UI protokollon keresztül) kollaborálva minimalizálja a manuális adatvitelt.

## Funkcionális Követelmények
- **Számlázás:** Kimenő és bejövő számlák rögzítése, automatikus feldolgozása.
- **Riportok és Analitika:** Költség- és bevétel-elemzések, valós idejű dashboard.
- **Banki Integráció:** Bankszámlakivonatok automatikus importálása és párosítása a számlákkal.
- **ÁFA és Adók:** ÁFA számítás és bevallások előkészítése.
- **Kivételkezelés (Exception Queue):** AI által azonosított anomáliák (pl. hiányzó bizonylat, gyanús tranzakció) kezelése dedikált, A2UI által generált widgeteken keresztül.

## Nem-funkcionális Követelmények
- **Frontend Stack:** React + Vite + TailwindCSS (Glassmorphism, Dark FinTech UI).
- **Generatív UI:** Az A2UI v0.9 szabvány használata a kivételkezelési és workflow-monitor funkciókhoz (az alap dashboard statikus/hagyományos marad).
- **Backend / Motor:** Brunella (FastAPI/Express, SQLite/LanceDB) szolgálja ki az üzleti logikát és az ügynököket.
- **Kommunikáció:** REST API az alapműveletekhez, WebSocket a streamelt A2UI komponensekhez és valós idejű frissítésekhez.

## Hatókörön kívül (Out of Scope)
- A Brunella core rendszer módosítása (kizárólag motorként használjuk).
- Bérszámfejtési funkciók (az a p-ber track feladata lesz).

## Elfogadási Kritériumok
- Az alkalmazás önállóan elindítható a saját repository-jából.
- Sikeres bejelentkezés és a fő műszerfal (Dashboard) megjelenítése.
- Sikeres kommunikáció a Brunella backenddel (pl. számlalista lekérése).
- Egy A2UI widget (pl. Exception Card) sikeres renderelése a Brunella ügynök válasza alapján.
