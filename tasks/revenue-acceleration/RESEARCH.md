# Kutatási Jelentés: Gyors Bevétel Generálás és Trójai Faló Stratégia
**Készült:** 2026. február 27.
**Téma:** Az `mcp-brunella-core` képességeinek monetizálása, a Dashboard "Bevétel" menüjének fókuszálása, B2B szektorok célzása "Trójai faló" demókkal, hideg e-mail kézbesíthetőség javítása és a weboldal tökéletesítése.

---

## 1. Az `mcp-brunella-core` Rendszer Áttekintése
A Brunella Agent System (BAS) egy robusztus, hibrid (Node.js + Python + Cloudflare Edge) architektúra.
*   **Fő Erősségek:** 49 regisztrált AI ügynök, amelyek a böngésző automatizálásától (RobotkezV2) kezdve a B2B adatbányászatig (LeadMiningAgent, MarketIntelAgent) mindent lefednek.
*   **A "Bevétel" Menü Állapota:** A Dashboard V3 felületén (`src/dashboard/lib/navigation.tsx`) jelenleg egy általános "Bevétel" kategória van, ami magában foglalja a Kampány Stúdiót, a Lead Mastert, és az Innovációs Hidat. Ennek a szűkítése és célirányosítása ("Sales Dashboard") a következő logikus lépés a gyors pénztermelés érdekében.

## 2. A Legmagasabb ROI-t hozó B2B AI Célpiacok (2025-2026)
A kutatás alapján a következő szektorokban van jelenleg a legnagyobb kereslet és leggyorsabb megtérülés az AI automatizációra:
1.  **Egészségügy és Magánklinikák (B2B):** Adminisztráció, időpont-egyeztetés és számlázás automatizálása.
2.  **Fejvadászat és Toborzás:** Magas a jelöltenkénti profit, de hatalmas az adminisztratív teher. A Brunella `DigitalHeadhunterAgent`-je azonnal értéket tud teremteni.
3.  **B2B E-kereskedelem és Logisztika:** Árfigyelés, versenytárs-követés, és automatikus árazási stratégiák (a `MarketIntelAgent` és `PricingAgent` használatával).
4.  **Ingatlanközvetítők és Könyvelők:** Erre már a `demo_factory` el is kezdett épülni a kódbázisban.

## 3. A "Trójai Faló" (Trojan Horse) Értékesítési Stratégia
Ahelyett, hogy egy drága, nagy rendszert próbálnánk eladni, egy *specifikus, apró, de nagyon fájdalmas* problémát oldunk meg a cégnek ingyen, egy működő prototípussal.
*   **Kivitelezés a Brunellával:** A `myai/demo_factory/` sablonjainak (FastAPI) vagy a RobotkezV2 scripteknek a segítségével legyártunk egy olyan API-t vagy kis scriptet, ami az *adott cég* valós adatain fut (pl. beolvassa a saját PDF számlájukat vagy kikaparja a fő versenytársuk árait).
*   **A Megkeresés (Outreach):** "Észrevettem, hogy a csapatod ezzel a problémával küzd. Építettem nektek egy egyedi Python scriptet/API végpontot, amivel ez 200 ms alatt automatizálható. Nincs regisztráció, itt tudjátok tesztelni."
*   **Pszichológia:** Az ingyenes, már működő értékadás (reciprocitás) szinte azonnal egy értékesítési híváshoz ("Yes Ladder") vezet, ahol a teljes Brunella AI bérlése vagy nagyobb csomagja (SaaS) eladható.

## 4. Hideg E-mail Kézbesíthetőség (Deliverability) 2026-ban
A lead-ek monitorozásához és az emailek sikeres (pattanásmentes) kézbesítéséhez a következő szigorú szabályokat kell implementálni:
*   **Infrastruktúra:** **SOHA** ne a fő domainről (pl. pohankaestarsa.hu) küldjünk hideg e-mailt! Vásároljunk másodlagos domaineket (pl. *getpohanka.com, pohanka-ai.io*).
*   **Technikai Alapok (Kötelező):** SPF, DKIM és szigorú DMARC (`p=quarantine` vagy `p=reject`) beállítása a küldő domaineken. Érvényes PTR (Reverse DNS) rekord.
*   **Mennyiségi Korlátok és Inbox Rotáció:** Egy postafiókból szigorúan **max 30-50 email/nap**. Ha napi 500 lead-et akarunk megkeresni, 10-15 dedikált postafiókra van szükség, amelyeken pörgetjük (rotáljuk) a küldést.
*   **Lista Higiénia (A Bounce elkerülése):** A kikapart lead-eket a küldés előtt **kötelező** ellenőrizni (pl. ZeroBounce API vagy hasonló eszköz). Ha a bounce rate eléri a 2%-ot, a Google/Microsoft AI spam szűrői blokkolják a domaint. A "Catch-all" emaileket kezdetben hanyagoljuk.
*   **Személyre szabás (Personalization):** A Brunella AI képességeivel minden e-mail első sorát ("Icebreaker") tegyük egyedivé. Egyetlen link legyen az emailben (a "Trójai Faló" demó linkje). Szöveges, HTML formázás nélküli emailek konvertálnak és érkeznek célba a legjobban.

## 5. Fejlesztési Irányok (A Tervezési Fázis előkészítése)
A fenti kutatás alapján a következő fejlesztéseket érdemes betervezni a Blueprint következő (`plan`) lépésében:
1.  **Dashboard "Bevétel" Fókusz:** A Dashboardon belül létrehozni egy kimondottan a "Trójai Faló" kampányokat vezérlő felületet, amely összeköti a lead-bányászatot (`LeadMiningAgent`) a demo-generátorral (`demo_factory`) és a kimenő e-mail státusszal (Bounce rate monitor).
2.  **Lead Tisztító Pipeline:** Beépíteni a ZeroBounce (vagy alternatív) e-mail validációs lépést a lead-gyűjtő folyamat legvégére.
3.  **Weboldal (pohankaestarsa.netlify.app) Optimalizálás:** Az oldal fókuszát átállítani a konkrét esettanulmányokra és a "Trójai Faló" megközelítés demózására (pl. egy interaktív widget, ahol a látogató is kipróbálhat egy mini-demót).

---
*Készen áll a tervezési (Plan) fázisra.*