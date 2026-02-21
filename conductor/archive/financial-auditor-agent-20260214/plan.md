📝 MEGVALÓSÍTÁSI TERV: Onboarding \& Tudásmenedzser

Track: onboarding-knowledge-manager-20260214





Architektúra: Data Flywheel (Self-Learning Loop)

+2



🛠️ Megvalósítási Fázisok

Phase 1: Adatbányászat (Harvest) \& Indexelés



Helyi Források: A Python-alapú knowledge\_integrator.py segítségével indexeljük a projekt összes .md fájlját (különösen a README.md, product.md, és tech-stack.md fájlokat).

+2





Vektor Adatbázis: Az adatokat a LanceDB-be mentjük, szemantikus lenyomatként (embedding).

+1





Git Integráció: Egy új ágensfigyelő (GitWatcher) beállítása, amely minden commit után elemzi az üzeneteket és a módosított fájlokat.

+1



Phase 2: "Neural Link" RAG Motor



Kognitív Memória: A ResearcherAgent felkészítése a LanceDB-ben való keresésre.

+2





Válaszgenerálás: A Gemini 1.5 Pro vagy GPT-4o használata a kontextusfüggő válaszokhoz, biztosítva a 2M tokenes ablak kihasználását.

+1



Phase 3: Dashboard \& CLI (EPP v2 Compliance)

+1





Dashboard Tab: Egy új "Onboarding Center" fül létrehozása a Mission Control felületen.

+2





Interaktív CLI: A brunella tudas "kérdés" parancs implementálása magyar nyelvű menüvel.

+2



🚀 Bevetési Parancs a Jules AI számára

Ezt a promptot másold be Jules-nak, hogy elinduljon a fejlesztés:





Feladat: Implementáld az onboarding-knowledge-manager-20260214 track Phase 1-et az EPP v2 szerint.

+1



Részletek:



Hozz létre egy új ágat: feat/onboarding-rag-setup.

2\. Frissítsd a myai/utils/dataset\_manager.py fájlt, hogy képes legyen a projekt .md fájljait automatikusan beolvasni és a LanceDB-be indexelni.

3\. Implementálj egy alapvető KnowledgeAgent-et a src/agents/ mappában, amely képes a rag.ts segédprogramon keresztül keresni az adatbázisban.

4\. Fontos: Minden lépés után futtasd az npm test parancsot, és biztosítsd a 100%-os sikert.

+3



🎨 Neural Link UI Specifikáció (ui\_spec.md)

Ezt az utasítást másold be a conductor/tracks/onboarding-knowledge-manager-20260214/ui\_spec.md fájlba:



📋 UI SPECIFIKÁCIÓ: Neural Link Onboarding Chat

Komponens: NeuralLinkChat.tsx





Stílus: Futurisztikus, minimalista, sötét módra optimalizált (Next-themes).



1\. Vizuális Felépítés (Layout)



Chat Konténer: Üveg-effektus (backdrop-blur-md), lebegő hatás.

+1



Üzenetbuborékok: \* User: Jobb oldalon, diszkrét szürke szegéllyel.



AI (Knowledge Manager): Bal oldalon, enyhe kék derengéssel.





Szemantikus Forrásjelzők (Source Chips): Minden AI válasz alatt meg kell jelenniük kis „chipeknek”, amik jelzik, melyik GitHub fájlból származik az információ (pl. README.md, product.md).

+2



2\. Funkcionális Követelmények (EPP v2 szerint)



Üzenet Perzisztencia: A korábbi hiba (nincs message persistence) javítása: az üzeneteket menteni kell a helyi adatbázisba, hogy frissítés után is megmaradjanak.





Gondolkodási Fázis Vizuál: Amíg az ágens a LanceDB-ben keres, egy finom animációt (Skeleton vagy Pulse) kell mutatni a „Thinking...” felirat helyett.

+1





Git-Esemény Feed: A chat ablak mellett egy keskeny sávban (vagy dropdown-ban) látszódjanak a legutóbbi Git események, amikre az ágens alapozza a tudását.

+1



3\. Interakciós Logika

A felhasználó kérdez (pl. „Mi a Phoenix Protocol lényege?”).



A UI egy agent\_status eseményt kap WebSocketen keresztül: „Knowledge Manager is searching in LanceDB...”.

+2



A válasz megérkezik, a forrásjelzők kattinthatóvá válnak, és megnyitják a megfelelő fájlt a Dashboard fájlkezelőjében.



🚀 Utasítás a Fejlesztő Ügynöknek (Truck/Jules)

Ezt a parancsot add ki a kódoláshoz:



Task: Refaktoráld a NeuralLinkChat.tsx komponenst az onboarding-knowledge-manager-20260214/ui\_spec.md alapján.



Kritériumok:

1\. Használj Radix UI ScrollArea-t és Tailwind glassmorphism osztályokat.

2\. Implementáld a válaszok alatti Source Chips rendszert, ami a knowledge\_integrator.py kimenetéből (metaadatok: source) táplálkozik.

3\. Add hozzá a hiányzó üzenetmentési logikát (Persistence).

4\. Biztosítsd, hogy a komponens hiba esetén (pl. WebSocket szakadás) a Phoenix Protocol szerint automatikusan próbálkozzon az újracsatlakozással.

+3

