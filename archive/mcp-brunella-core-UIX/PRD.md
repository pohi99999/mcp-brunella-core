# MCP Brunella Core - Professzionális Irányítópult

Egy modern, interaktív webalkalmazás az MCP Brunella Core szerver folyamatainak valós idejű monitorozására és vezérlésére, amely könnyedén bővíthető moduláris architektúrával rendelkezik.

**Élménytulajdonságok**:
1. **Professzionális** - Tiszta, üzleti szintű felület, amely magabiztosságot sugároz és könnyű megértést biztosít
2. **Reaktív** - Azonnali visszajelzés minden műveletnél, valós idejű státuszfrissítések
3. **Intuitív** - Magyar nyelvű, logikus elrendezés, amely minimális tanulási időt igényel

**Komplexitási Szint**: Light Application (multiple features with basic state)
Ez egy irányítópult alkalmazás több funkcióval: szerver állapot monitorozás, folyamat vezérlés, log megtekintés, és konfigurációs lehetőségek, perzisztens állapotkezeléssel.

## Alapvető Funkciók

### Felhasználói Hitelesítés és Jogosultság Kezelés
- **Funkció**: Bejelentkezés különböző felhasználói szerepkörökkel (Admin, Operátor, Néző) és műveletek korlátozása szerepkörök alapján
- **Cél**: Biztonságos hozzáférés biztosítása a szerver funkcióihoz jogosultsági szintek szerint
- **Indítás**: Oldal betöltéskor automatikus
- **Folyamat**: Oldal betöltés → Bejelentkezési űrlap → Hitelesítés → Session létrehozás → Jogosultságok ellenőrzése → Dashboard megjelenítés
- **Siker kritérium**: Csak hitelesített felhasználók férnek hozzá a dashboardhoz, műveletek korlátozva vannak szerepkörök alapján
- **Szerepkörök**:
  - **Adminisztrátor**: Teljes hozzáférés - minden művelet engedélyezve (szerver vezérlés, naplók törlése, konfiguráció módosítás)
  - **Operátor**: Szerver vezérlési jogosultság - indítás, leállítás, újraindítás engedélyezve, de naplók törlése és konfiguráció szerkesztés tiltva
  - **Néző**: Csak olvasási jogosultság - csak megtekintés engedélyezve, minden módosítás tiltva

### Szerver Állapot Áttekintés
- **Funkció**: Valós idejű megjelenítés a szerver állapotáról, futási idejéről, CPU és memória használatról
- **Cél**: Azonnali vizuális visszajelzés a rendszer egészségéről
- **Indítás**: Automatikus betöltéskor
- **Folyamat**: Oldal betöltés → Állapot lekérés → Kártya megjelenítés → Automatikus frissítés
- **Siker kritérium**: Valós idejű metrikák pontosan megjelennek, státusz vizuálisan egyértelmű

### Folyamat Vezérlés
- **Funkció**: Start/Stop/Restart műveletek végrehajtása a szerverfolyamaton jogosultságellenőrzéssel
- **Cél**: Gyors beavatkozás lehetősége adminisztratív feladatokhoz jogosult felhasználók számára
- **Indítás**: Felhasználó gombnyomása
- **Folyamat**: Gomb kattintás → Jogosultság ellenőrzés → Megerősítő dialog → API hívás → Státusz frissítés → Toast visszajelzés
- **Siker kritérium**: Műveletek végrehajtódnak megfelelő jogosultságokkal, vizuális feedback azonnali, hibakezelés működik, jogosultság nélküli felhasználóknak tiltott gombok

### Napló Megtekintő
- **Funkció**: Valós idejű és történelmi log bejegyzések megjelenítése szűrési lehetőségekkel és jogosultságfüggő törlési funkcióval
- **Cél**: Hibakeresés és rendszer monitoring egyszerűsítése minden felhasználó számára
- **Indítás**: Tab váltás a napló nézethez
- **Folyamat**: Tab kattintás → Log betöltés → Szűrők alkalmazása → Lista megjelenítés → Auto-scroll új üzeneteknél → Jogosultság szerinti törlés engedélyezés
- **Siker kritérium**: Logok időrendben, színkódolva, szűrhetően jelennek meg, törlés csak adminisztrátorok számára elérhető

### Konfiguráció Kezelő
- **Funkció**: Szerver konfigurációs paraméterek megtekintése és módosítása jogosultságfüggően
- **Cél**: Központi hely a beállítások kezelésére, adminisztrátorok számára szerkeszthető
- **Indítás**: Beállítások tab megnyitása
- **Folyamat**: Tab kattintás → Konfig betöltés → Űrlap megjelenítés → Jogosultság ellenőrzés → Módosítás (ha van jog) → Mentés → Validáció → Visszajelzés
- **Siker kritérium**: Konfigurációk perzisztensek, validáció működik, változások életbe lépnek, szerkesztés csak adminisztrátorok számára engedélyezett

### AI Chat Interfész és LlamaIndex Integráció
- **Funkció**: Valós idejű chat interfész lokális Ollama környezetben futó LlamaIndex-szel való kommunikációhoz, Agent tool konfigurációval, előzmény keresési, dátum szűrési és exportálási funkciókkal. Az AI képes Agent Tool-ok végrehajtására természetes nyelvű kérések alapján.
- **Cél**: Természetes nyelvű interakció a szerverrel és AI-alapú műveletek végrehajtása, teljes chat előzmény kezelés és szűrés. A workflow.md-ben leírt MCP Brunella Core logika szerint az AI automatikusan felismeri és végrehajtja a megfelelő műveleteket.
- **Indítás**: Chat tab megnyitása
- **Folyamat**: Tab kattintás → Chat felület betöltés → Ollama kapcsolat ellenőrzés → Üzenet küldés → System prompt építés (engedélyezett tool-okkal) → Ollama/LlamaIndex kommunikáció (streaming) → AI válasz feldolgozás → Tool pattern felismerés `[TOOL:toolName](params)` → Jogosultság ellenőrzés → Tool végrehajtás → Eredmény visszaadás AI-nak → Válasz folytatása → Keresés üzenetekben → Dátum szűrés alkalmazása → Szűrt előzmény exportálás
- **Siker kritérium**: Üzenetek valós időben továbbítódnak, válaszok streamelve jelennek meg chunk-by-chunk, Agent toolok automatikusan végrehajtódnak jogosultság ellenőrzéssel, lokális Ollama kapcsolat működik és real-time status badge mutatja, keresés azonnal szűr valós időben, dátum szűrés precíz (kezdő/záró dátum vagy kombinált), export JSON és TXT formátumban elérhető szűrt eredményekkel, tool végrehajtás naplózódik

### Agent Tool Konfiguráció és Külső API Integráció
- **Funkció**: Agent tool-ok megtekintése, hozzáadása, szerkesztése és engedélyezése/tiltása az AI asszisztens számára. Kategorizált tool rendszer (Server, Monitoring, Configuration, Custom) jogosultság-alapú végrehajtással. **Külső API integráció támogatás**: Tool-ok konfigurálhatók külső REST API-khoz való automatikus kapcsolódásra, hitelesítéssel, paraméterek behelyettesítésével, és válasz leképezéssel.
- **Cél**: Testreszabható AI képességek, amelyek műveletek végrehajtására jogosultak. A workflow.md szerint minden tool jogosultság ellenőrzésen megy keresztül, és a végrehajtás automatikusan naplózódik. Külső szolgáltatásokkal (időjárás API, adatbázis API, monitoring szolgáltatások stb.) való integrációval bővíthető az AI asszisztens képességei programozói beavatkozás nélkül.
- **Indítás**: Agent Tool tab megnyitása
- **Folyamat**: Tab kattintás → Tool lista betöltés kategóriák szerint → Jogosultság ellenőrzés (csak Admin szerkeszthet) → Tool hozzáadás/szerkesztés dialog (Alapbeállítások és API Integráció tabok) → Név, leírás, kategória, paraméterek definiálása → API konfiguráció: URL (paraméter interpolációval `{{param}}`), HTTP metódus, hitelesítés (Bearer, API Key, Basic Auth), timeout, request body template, response mapping → API teszt végrehajtás → Engedélyezés/tiltás toggle → Perzisztálás (useKV) → AI system prompt automatikus frissítése → Tool használat chat során `[TOOL:name](params)` formátummal → Külső API hívás végrehajtása (ha van API konfiguráció) vagy beépített handler → Eredmény visszaadás → API válasz és hibák automatikus naplózása
- **Siker kritérium**: Tool-ok perzisztensek (useKV), dinamikusan betölthetők, kategorizáltak, chat során automatikusan használhatók AI által, jogosultságfüggők (requiresPermission mező), végrehajtás naplózódik, csak Admin konfigurálhat, built-in tool-ok (get_server_status, start_server, stop_server, get_logs, update_config, get_metrics) működnek, custom tool-ok hozzáadhatók, külső API-val rendelkező tool-ok automatikusan végrehajtják az API hívást paraméterekkel, API hibák és válaszok naplózódnak külön forrással (external-api), API teszt funkció működik, hitelesítési módszerek (none, bearer, apikey, basic) támogatottak, paraméterek interpolálódnak az URL-ben és body-ban, response mapping képes kivonni részadatokat a válaszból

### Moduláris Bővíthetőség
- **Funkció**: Kártya alapú dashboard ahol egyszerűen hozzáadhatók új monitoring modulok
- **Cél**: Jövőbeli funkciók könnyű integrálása
- **Indítás**: Fejlesztői bővítés
- **Folyamat**: Új komponens létrehozás → Dashboard regisztráció → Automatikus megjelenítés
- **Siker kritérium**: Új modulok hozzáadása nem igényli a core kód átírását

## Élkezelés

- **Nincs bejelentkezés**: Automatikus átirányítás bejelentkezési oldalra tiszta instrukcióval és demo fiókokkal
- **Hibás bejelentkezési adatok**: Egyértelmű hibaüzenet inline megjelenítéssel
- **Jogosultság hiány**: Műveleti gombok letiltva tooltippel magyarázattal
- **Nincs adat**: Üres állapotok egyértelmű üzenetekkel és utasításokkal ("Még nincsenek naplóbejegyzések", "Kezdj el chattelni az AI asszisztenssel")
- **Hálózati hiba**: Újrapróbálkozás gomb megjelenítése, offline mód jelzése, Ollama elérhetőség ellenőrzés
- **Ollama nem elérhető**: Egyértelmű hibaüzenet kapcsolódási instrukcióval és helyi Ollama indítási utasítással
- **Érvénytelen bemenet**: Inline validáció azonnali visszajelzéssel
- **Hosszú AI válasz**: Streaming válaszok progresszív megjelenítéssel, loading indikátor AI gondolkodáskor
- **Hosszú műveletek**: Loading állapotok skeleton screen-ekkel és progress indikátorokkal
- **Agent tool hiba**: Részletes hibaüzenet tool végrehajtás során, hibanapló mentése
- **Keresés nincs találat**: Egyértelmű "Nincs találat" üzenet keresési feltétel megjelenítésével
- **Dátum szűrés nincs találat**: Egyértelmű üzenet a dátumtartományról amelyre nincs üzenet
- **Export nagy előzmény**: Automatikus fájl letöltés böngésző alapértelmezett mappa használatával, szűrt eredmények exportálása
- **Kombinált szűrők**: Keresés és dátum szűrés együttes alkalmazása, aktív szűrők megjelenítése, gyors szűrő törlés
- **Külső API timeout**: Timeout kezelés beállítható időkorláttal (alapértelmezett 30s), egyértelmű hibaüzenet időtúllépéskor
- **Külső API hitelesítési hiba**: API kulcs vagy token hiba esetén részletes hibaüzenet, hitelesítési típus magyarázattal
- **Érvénytelen API konfiguráció**: Validáció API tool létrehozásakor (URL formátum, HTTP metódus, body és GET konfliktus), egyértelmű hibaüzenetek
- **API teszt sikertelen**: API teszt gomb külső endpoint ellenőrzéséhez, státuszkód és hibaüzenet megjelenítése, sikeres teszt visszajelzés
- **API válasz feldolgozási hiba**: Response mapping hibák kezelése, hibanapló mentése, részletes API hiba információk
- **Külső API nem elérhető**: Hálózati hibák kezelése, CORS problémák jelzése, újrapróbálkozás lehetősége
- **Session lejárat**: Automatikus kijelentkezés toast értesítéssel

## Tervezési Irány

A dizájn egy modern, high-tech vezérlőközpont érzést kell közvetítsen - professzionális, technológiai orientált, mégis meleg és hozzáférhető. Olyan mintha egy űrállomás irányítópultját néznénk, de barátságos magyar feliratokkal.

## Színválasztás

Technológiai, megbízható színpaletta sötét háttérrel és éles kontrasztokkal.

- **Primary Color**: Mély kék-lila (oklch(0.45 0.15 270)) - Technológiai megbízhatóságot, professzionalizmust közvetít
- **Secondary Colors**: 
  - Sötét háttér (oklch(0.12 0.01 270)) - Modern, fókuszált munkakörnyezet
  - Világos panel (oklch(0.18 0.02 270)) - Kiemelkedő felületek
- **Accent Color**: Élénk cyan (oklch(0.75 0.15 195)) - Figyelem irányítás CTA-khoz és aktív elemekhez, élénk technológiai érzet
- **Foreground/Background Pairings**:
  - Background (oklch(0.12 0.01 270)): Light text (oklch(0.95 0.01 270)) - Ratio 15.8:1 ✓
  - Primary (oklch(0.45 0.15 270)): White text (oklch(1 0 0)) - Ratio 5.2:1 ✓
  - Accent (oklch(0.75 0.15 195)): Dark text (oklch(0.12 0.01 270)) - Ratio 10.1:1 ✓
  - Card (oklch(0.18 0.02 270)): Light text (oklch(0.95 0.01 270)) - Ratio 11.4:1 ✓

## Font Kiválasztás

Technikai, tiszta, olvasható betűtípusok amelyek modern IT környezetet sugallnak.

- **Elsődleges**: Space Grotesk - Karakteres, geometrikus sans-serif amely tech-forward de barátságos
- **Másodlagos**: JetBrains Mono - Monospace adatokhoz és metrikákhoz, kód-szerű érzet

- **Tipográfiai Hierarchia**:
  - H1 (Oldal cím): Space Grotesk Bold / 32px / tight tracking
  - H2 (Szekció címek): Space Grotesk SemiBold / 24px / normal tracking
  - H3 (Kártya címek): Space Grotesk Medium / 18px / normal tracking
  - Body (Általános szöveg): Space Grotesk Regular / 16px / relaxed line-height
  - Metrikák: JetBrains Mono Medium / 20px / tabular numbers
  - Kód/Logok: JetBrains Mono Regular / 14px / monospace

## Animációk

Animációk precízek és gyorsak, mint egy professzionális dashboard - megerősítik a műveletet anélkül, hogy lassítanák. Subtle pulse effektek élő adatoknál, smooth transitions panel váltásoknál, és satisfying feedback gomb interakcióknál.

## Komponens Kiválasztás

- **Komponensek**:
  - Card: Főbb szekciókhoz (státusz, vezérlés, metrikák, bejelentkezés, chat) - sötét háttér, subtle border glow
  - Tabs: Nézetek váltásához (Áttekintés, Chat, Naplók, Beállítások, Agent Tools), API konfiguráció tabok (Alapbeállítások, API Integráció)
  - Button: Vezérlő műveletek - primary variant action-höz, outline secondary-hez, disabled state jogosultság hiányhoz, API teszt gomb
  - Badge: Státusz indikátorok, szerepkör megjelenítés, Agent tool státusz - színkódolt (zöld=fut, piros=leállt, sárga=betöltés, cyan=AI aktív), Külső API badge, HTTP metódus badge
  - Progress: Betöltés és erőforrás használat
  - Dialog/Alert Dialog: Megerősítő dialógok kritikus műveletekhez, Agent tool konfiguráció kibővített 2-tabes modal (Alapbeállítások + API Integráció)
  - DropdownMenu: Felhasználói profil menü
  - Avatar: Felhasználó képviselet
  - Table: Log bejegyzések, konfig táblázatok, Agent tool lista
  - Input/Textarea: Konfiguráció szerkesztés, bejelentkezési űrlap, chat üzenet input, API URL, API timeout, API auth token, API body template (monospace)
  - Switch: Toggle beállítások, Agent tool engedélyezés/tiltás
  - Select: Kategória választó, HTTP metódus választó, Auth típus választó
  - Scroll Area: Log tárolók, chat üzenetek, Agent tool lista
  - Toast (Sonner): Művelet visszajelzések, bejelentkezési értesítések, AI tool végrehajtási visszajelzés, API teszt eredmények
  - Alert: Hibaüzenetek (hibás bejelentkezés, Ollama kapcsolat hiba), API konfigurációs útmutató
  - Tooltip: Jogosultság hiány magyarázat, Agent tool leírás
  - Skeleton: Loading állapot AI válaszokhoz

- **Testreszabások**:
  - Státusz Kártya: Egyedi komponens nagy számok megjelenítésével és trend indikátorokkal
  - Live Indicator: Pulsing dot aktív állapot jelzésére
  - Metric Display: Formázott számok percentage/memory egységekkel
  - Login Form: Bejelentkezési űrlap demo fiók gyors választókkal
  - User Profile: Avatar-alapú felhasználói profil dropdown menüvel
  - Permission Guard: Jogosultság-alapú UI elem korlátozás komponens
  - Chat Interface: Üzenet buborékok (user/assistant), streaming válaszok, markdown támogatás, keresés szűrés, dátum szűrés, export funkciók
  - Agent Tool Card: Tool név, leírás, paraméterek, engedélyezés kapcsoló, külső API konfiguráció megjelenítés (URL, metódus, auth típus badge-ekkel)
  - Agent Tool Dialog: 2-tabes modal (Alapbeállítások: név, leírás, kategória, engedélyezés | API Integráció: URL, metódus, auth, timeout, body template, response mapping), API teszt gomb integrálva
  - External API Service: Külső API hívások kezelése fetch API-val, timeout, auth headers (Bearer, API Key, Basic), paraméter interpoláció `{{param}}`, response mapping pont-notációval
  - Ollama Status Indicator: Kapcsolat státusz indikátor real-time ellenőrzéssel
  - Chat Search Bar: Valós idejű szűrés keresési query alapján, találatok számláló
  - Date Range Filter: Dátum választó popover kezdő és záró dátummal, aktív dátum szűrő jelzése, gyors törlés
  - Export Dropdown: JSON és TXT formátum választás, automatikus letöltés, szűrt eredmények támogatása

- **Állapotok**:
  - Buttons: Subtle glow hover-nél, pressed state scale transform, disabled opacity 50% jogosultság hiányhoz
  - Inputs: Cyan ring focus-nál, error state piros border, disabled state jogosultság hiányhoz
  - Cards: Hover elevation subtle shadow növeléssel
  
- **Ikon Kiválasztás**: Phosphor icons - Play/Pause/Stop vezérléshez, ChartLine metrikákhoz, Terminal logokhoz, Gear beállításokhoz, Warning figyelmeztetésekhez, SignIn/SignOut hitelesítéshez, UserCircle felhasználói profilhoz, ChatCircle chat-hez, Robot AI-hoz, Toolbox tool konfigurációhoz, PaperPlaneRight üzenet küldéshez, MagnifyingGlass kereséshez, Download exportáláshoz, FileText/FileJs export formátumokhoz, X keresés törléshez, CalendarBlank dátum szűréshez, Globe külső API-hoz, Code API body template-hez, Key hitelesítéshez, Clock timeout-hoz, Lock jogosultság szükséges badge-hez

- **Távolságok**: Konzisztens 4/6/8/12/16/24 Tailwind spacing, cards p-6, sections gap-4, nagy lélegzőtér tiszta vizuális szeparációval

- **Mobil**: Tabs vízszintes scrollozással, cards vertical stack, metrics 2-column grid, drawer navigation kicsi képernyőkön
