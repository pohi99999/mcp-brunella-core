# Initial Concept
Az Épített Szingularitás: A Tökéletes MCP Protokoll Szerver a Brunella Agent System számára. Egy proaktív Gateway, amely egyesíti a Google Workspace, az n8n automatizáció és a biztonságos kódvégrehajtás (Innovation Sandbox) képességeit, átalakítva a "fekete doboz" működést átlátható "üvegdobozzá".

# Termék Definíció: Cogella Core (Brunella Core MCP)

## Víziónk
A Cogella Core a Brunella Agent System (BAS) "digitális idegrendszere". Egy olyan univerzális átjáró (Gateway), amely szabványosított Model Context Protocol (MCP) révén kapcsolja össze a kognitív kapacitásokat (LLM-ek) a végrehajtó eszközökkel és a helyi tudásbázissal. A cél a tízszeres hatékonyságnövelés és egy piacképes "Expertise-as-a-Service" platform létrehozása.

## Célközönség
1. **Elsődleges:** A fejlesztő (József), aki egy integrált, automatizált munkaterületet épít.
2. **Másodlagos:** AI ügynökök (Brunella, Researcher, Developer), akiknek strukturált hozzáférésre van szükségük a rendszererőforrásokhoz.
3. **Jövőbeni:** Vállalkozások és cégek, akiknek skálázható, biztonságos AI ügynök-infrastruktúrára van szükségük.

## Kulcsfontosságú Funkciók (MVP)
- **Brunella Orchestrator:** Hierarchikus ügynök-vezérlés, ahol Brunella delegálja a feladatokat a specializált ügynököknek.
- **Hibrid DevOps Partner (Jules):** Külső ágens integráció White Box hozzáféréssel a forráskódhoz, automatizált teszteléshez és öngyógyító folyamatokhoz.
- **Fejlett Tudásbázis (RAG):** Vektoros keresés a `07_KNOWLEDGE_BASE` és `03_LIBRARY` mappákban LanceDB segítségével.
- **Innovációs Homokozó (Sandbox):** Biztonságos Python és Node.js kódvégrehajtás izolált Docker környezetben.
- **Google Workspace Nexus:** Szemantikus naptárkezelés és Gmail RAG alapú keresés.
- **n8n Kétirányú Híd:** Automatizációs munkafolyamatok indítása és az ágens visszahívása az n8n folyamatokból.
- **Böngésző Vezérlés:** Playwright alapú webes navigáció és adatgyűjtés.
- **Központi Irányítópult (Dashboard):** Modern webes felület (React/Vite) a rendszer felügyeletére, az ügynökök menedzselésére és a tudásbázis vizualizációjára.

## Működési Környezet
- A rendszer az `F:\OneDrive\Desktop\Brunella_es_en` munkaterületen belül működik, szigorúan betartva a könyvtárfa szabályait.
- **Infrastruktúra:** Windows + WSL 2 + Docker Desktop (ellenőrzött és működő állapotban).
- **Modellek:** Hibrid megközelítés - helyi Ollama (Gemma 3.4b) és felhő alapú Gemini/Claude modellek.

## Stratégiai Irányelvek
- **Black Box to Glass Box:** Teljes transzparencia a naplózás és az MCP Inspector révén.
- **Standardizáció:** Az MCP használata minden külső és belső integrációhoz a technikai adósság csökkentése érdekében.
- **Monetizációs Felkészültség:** Stripe-kompatibilis mérés és jogosultságkezelés (OAuth 2.1) az alapoktól beépítve.
