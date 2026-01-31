# Brunella Munkapad - Telepítési és Használati Útmutató

Üdvözlünk a Brunella Munkapadon! Ez az útmutató segít beüzemelni és hatékonyan használni az alkalmazást.

## 1. Mi ez az alkalmazás?

A Brunella Munkapad egy webes felületű irányítópult, amely a Gemini alapú AI ügynök, Brunella központi kommunikációs és monitorozó platformja. Itt tudsz beszélgetni Brunellával, nyomon követni az al-ügynökök (mint Jules) állapotát, és ellenőrizni a rendelkezésre álló eszközök (pl. Google Keresés) erőforrásait.

## 2. Telepítés és Előkészületek

### Előfeltételek
- **Git:** A projekt letöltéséhez.
- **Node.js és npm:** A függőségek telepítéséhez és a futtatáshoz. (Javasolt verzió: Node.js 20 vagy újabb)

### Lépések

1.  **Projekt Letöltése:**
    Klónozd a projektet a számítógépedre egy terminál segítségével:
    ```bash
    git clone <repository_url>
    cd <repository_mappa>
    ```

2.  **Függőségek Telepítése:**
    Telepítsd a szükséges csomagokat az npm segítségével:
    ```bash
    npm install
    ```

3.  **API Kulcs Beállítása (Kritikus Lépés):**
    Az alkalmazásnak szüksége van egy érvényes Google Gemini API kulcsra a működéshez.
    - Hozz létre egy új fájlt a projekt gyökérkönyvtárában `.env` néven.
    - Nyisd meg a `.env` fájlt, és másold bele a következő sort, a `YOUR_GEMINI_API_KEY` részt a saját kulcsodra cserélve:
      ```
      API_KEY=YOUR_GEMINI_API_KEY
      ```
    - Mentsd el a fájlt. Az alkalmazás automatikusan be fogja olvasni ezt a kulcsot.

## 3. Az Alkalmazás Indítása

A beállítások után indítsd el a fejlesztői szervert a következő paranccsal:

```bash
npm start
```

Ez elindít egy helyi webszervert, és a terminálban megjelenik egy URL (általában `http://localhost:XXXX`). Nyisd meg ezt a linket a böngésződben az alkalmazás eléréséhez.

## 4. A Felület Használata

### Fő Csevegőfelület
- **Üzenetküldés:** Írd be az üzenetedet az alsó beviteli mezőbe, és nyomj Entert vagy kattints a "Küldés" gombra.
- **Kép Csatolása (📎):** A gemkapocs ikonra kattintva kiválaszthatsz egy képet a számítógépedről, amit a szöveggel együtt elküldhetsz Brunellának.

### Memória Panel (🧠)
- **Megnyitás:** Kattints a jobb felső sarokban lévő agy ikonra.
- **Funkció:** Itt láthatod Brunella hosszú távú memóriájának tartalmát (`brunella_memoria.md`), beleértve a képességeit, a tanultakat és a projekt-összefoglalókat.
- **Kezelés:** A "Frissítés" gombbal újra betöltheted a memória tartalmát, a "Bezárás" gombbal pedig elrejtheted a panelt.

### Eszköztár Panel (🛠️)
- **Megnyitás:** Kattints a bal felső sarokban lévő szerszámosláda ikonra.
- **Funkció:** Ez a panel az ügynökök és eszközök állapotát monitorozza.
- **Widgetek:**
  - **Google Search Credits:** Megmutatja, hány keresési kredit áll rendelkezésre (a `Serper_credits...csv` fájl alapján).
  - **Jules Agent:** Jelzi Jules, a kódoló ügynök állapotát.
    - **Feladat delegálása:** Ezzel a gombbal szimulálhatsz egy feladatkiadást Jules-nak. Az ügynök állapota "Elfoglalt"-ra vált, majd a feladat "befejezése" után visszaáll "Kész"-re.
  - **Gyors Műveletek:**
    - **Memória összegzése:** Automatikusan elküldi a memória-összefoglaló parancsot Brunellának.
    - **Eszközök állapotának frissítése:** Újratölti a panelen lévő adatokat.

### Alsó Állapotsáv
A láblécben folyamatosan láthatod a rendszer aktuális állapotát (pl. `Status: Idle`, `Status: Generating...`, `Status: Jules dolgozik...`).
