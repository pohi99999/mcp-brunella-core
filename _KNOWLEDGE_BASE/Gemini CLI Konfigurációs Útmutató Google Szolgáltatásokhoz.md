# Gemini CLI Konfigurációs Útmutató Google Szolgáltatásokhoz

Ez az útmutató részletesen bemutatja, hogyan konfigurálhatja a Gemini parancssori eszközt (CLI) a Google szolgáltatásokhoz, mint a Gmail, Google Drive és AppSheet. A folyamat magában foglalja a Google Cloud Platform (GCP) beállításait és egy PowerShell szkript futtatását, amely automatizálja a Gemini CLI hitelesítését.

## Tartalomjegyzék

1.  [Előfeltételek](#előfeltételek)
2.  [Áttekintés](#áttekintés)
3.  [Google Cloud Platform (GCP) beállítások (Manuális lépések)](#google-cloud-platform-gcp-beállítások-manuális-lépések)
    *   [1.1 Google Cloud Projekt létrehozása](#11-google-cloud-projekt-létrehozása)
    *   [1.2 Szükséges API-k engedélyezése](#12-szükséges-api-k-engedélyezése)
    *   [1.3 OAuth 2.0 kliens azonosító létrehozása](#13-oauth-20-kliens-azonosító-létrehozása)
    *   [1.4 `client_secret.json` letöltése](#14-client_secretjson-letöltése)
4.  [A PowerShell szkript használata](#a-powershell-szkript-használata)
    *   [2.1 A szkript letöltése](#21-a-szkript-letöltése)
    *   [2.2 A szkript futtatása](#22-a-szkript-futtatása)
5.  [Hibaelhárítás](#hibaelhárítás)
6.  [Gyakran Ismételt Kérdések (GYIK)](#gyakran-ismételt-kérdések-gyik)




## 1. Előfeltételek

Ahhoz, hogy sikeresen konfigurálja a Gemini CLI-t a Google szolgáltatásokhoz, a következő előfeltételeknek kell megfelelnie:

*   **Windows operációs rendszer:** Ez az útmutató Windows környezetre készült, és PowerShell szkriptet használ.
*   **Google fiók:** Rendelkeznie kell egy aktív Google fiókkal, amellyel hozzáfér a Gmailhez, Google Drive-hoz, AppSheethoz és más Google szolgáltatásokhoz.
*   **Google Cloud Platform (GCP) hozzáférés:** A Google fiókjának rendelkeznie kell a szükséges engedélyekkel a GCP projektek létrehozásához és az API-k kezeléséhez. Ha még nincs GCP fiókja, látogasson el a [Google Cloud Platform weboldalára](https://cloud.google.com/) és regisztráljon.
*   **Gemini CLI telepítve:** A Gemini parancssori eszköznek már telepítve kell lennie a rendszerén. Ha még nem tette meg, kövesse a [Gemini CLI telepítési útmutatóját](https://cloud.google.com/gemini/docs/codeassist/gemini-cli) a hivatalos dokumentációban.
*   **PowerShell:** A Windows operációs rendszer alapértelmezetten tartalmazza a PowerShellt. Győződjön meg róla, hogy a PowerShell futtatási házirendje lehetővé teszi a szkriptek futtatását. Ezt ellenőrizheti a `Get-ExecutionPolicy` paranccsal a PowerShellben. Ha `Restricted` (Korlátozott), akkor futtassa a `Set-ExecutionPolicy RemoteSigned -Scope CurrentUser` parancsot, hogy engedélyezze a letöltött szkriptek futtatását.




## 2. Áttekintés

A Gemini CLI Google szolgáltatásokkal való integrációja az OAuth 2.0 hitelesítési protokollon keresztül történik. Ez a protokoll lehetővé teszi, hogy a Gemini CLI biztonságosan hozzáférjen a Google fiókjához anélkül, hogy megosztaná a jelszavát. A folyamat lényege, hogy a Google Cloud Platformon létrehoz egy „alkalmazást” (egy OAuth 2.0 kliens azonosítót), amely képviseli a Gemini CLI-t. Ez az azonosító lehetővé teszi, hogy a Gemini CLI engedélyt kérjen a Google-tól a Gmail, Google Drive és AppSheet adataihoz való hozzáférésre.

A konfigurációs folyamat két fő részből áll:

1.  **Manuális lépések a Google Cloud Platformon (GCP):** Ezek a lépések magukban foglalják egy GCP projekt létrehozását, a szükséges Google API-k engedélyezését, és egy OAuth 2.0 kliens azonosító generálását. Ez utóbbi egy `client_secret.json` fájlt eredményez, amely tartalmazza az alkalmazás hitelesítési adatait.
2.  **Automatikus lépések a PowerShell szkripttel:** Miután letöltötte a `client_secret.json` fájlt, a mellékelt PowerShell szkript segít annak elhelyezésében a megfelelő Gemini CLI konfigurációs könyvtárban, majd elindítja a Gemini CLI beépített hitelesítési folyamatát, amely egy böngészőn keresztül kéri az Ön engedélyét a hozzáféréshez.

Fontos megjegyezni, hogy a Chrome alkalmazásokhoz való hozzáférés a Gemini CLI-n keresztül valószínűleg nem igényel külön Google API-t. A Gemini CLI valószínűleg közvetlenül a böngészővel kapcsolatos feladatokat kezeli, vagy a Chrome-hoz való hozzáférés a Google fiók általános engedélyezésén keresztül történik, nem pedig egy specifikus Chrome API-n keresztül. Ezért a Chrome API engedélyezése nem szerepel a szükséges API-k listáján.




## 3. Google Cloud Platform (GCP) beállítások (Manuális lépések)

Ezeket a lépéseket a Google Cloud Platform konzolján kell elvégeznie. Győződjön meg róla, hogy be van jelentkezve a megfelelő Google fiókjával.

### 3.1 Google Cloud Projekt létrehozása

1.  Nyissa meg a [Google Cloud Console-t](https://console.cloud.google.com/) egy webböngészőben.
2.  A felső menüsorban, a Google Cloud logó mellett kattintson a projektválasztó legördülő menüre (általában a projekt neve vagy „Select a project” felirat látható).
3.  A megjelenő ablakban kattintson a „NEW PROJECT” (Új projekt) gombra.
4.  Adjon egy értelmes nevet a projektnek (pl. „Gemini CLI Integráció”). A projekt azonosítója automatikusan generálódik, de módosíthatja, ha szükséges. Jegyezze fel a projekt azonosítóját, szüksége lehet rá később.
5.  Válassza ki a számlázási fiókot, ha még nem tette meg.
6.  Kattintson a „CREATE” (Létrehozás) gombra. A projekt létrehozása eltarthat néhány másodpercig.
7.  Miután a projekt létrejött, győződjön meg róla, hogy az újonnan létrehozott projekt van kiválasztva a projektválasztó legördülő menüben.

### 3.2 Szükséges API-k engedélyezése

Most engedélyeznie kell azokat a Google API-kat, amelyekhez a Gemini CLI hozzáférni fog.

1.  A Google Cloud Console bal oldali navigációs menüjében navigáljon az „APIs & Services” (API-k és szolgáltatások) -> „Enabled APIs & services” (Engedélyezett API-k és szolgáltatások) menüpontra.
2.  Kattintson az „+ ENABLE APIS AND SERVICES” (+ API-k és szolgáltatások engedélyezése) gombra a lap tetején.
3.  A keresőmezőbe írja be az alábbi API-k nevét, és engedélyezze őket egyenként:
    *   **Google Drive API:** Keresse meg a „Google Drive API” kifejezést, kattintson rá, majd kattintson az „ENABLE” (Engedélyezés) gombra.
    *   **Gmail API:** Keresse meg a „Gmail API” kifejezést, kattintson rá, majd kattintson az „ENABLE” (Engedélyezés) gombra.
    *   **Google AppSheet API:** Keresse meg a „Google AppSheet API” kifejezést, kattintson rá, majd kattintson az „ENABLE” (Engedélyezés) gombra.

    *Megjegyzés:* Ahogy korábban említettük, a Chrome alkalmazásokhoz valószínűleg nincs külön API, amelyet engedélyezni kellene. A Gemini CLI valószínűleg közvetlenül kezeli a böngészővel kapcsolatos feladatokat, vagy a hozzáférés a Google fiók általános engedélyezésén keresztül történik.

### 3.3 OAuth 2.0 kliens azonosító létrehozása

Ez a lépés hozza létre azt a hitelesítési fájlt, amelyet a Gemini CLI használni fog a Google fiókjához való hozzáféréshez.

1.  A Google Cloud Console bal oldali navigációs menüjében navigáljon az „APIs & Services” (API-k és szolgáltatások) -> „Credentials” (Hitelesítő adatok) menüpontra.
2.  Ha még nem tette meg, konfigurálnia kell az OAuth hozzájárulási képernyőt (OAuth consent screen). Kattintson az „CONFIGURE CONSENT SCREEN” (Hozzájárulási képernyő konfigurálása) gombra.
    *   Válassza az „External” (Külső) felhasználói típust, majd kattintson a „CREATE” (Létrehozás) gombra.
    *   Adja meg az „App name” (Alkalmazás neve) mezőben (pl. „Gemini CLI Integráció”).
    *   Adja meg a „User support email” (Felhasználói támogatási e-mail) mezőben az e-mail címét.
    *   Adja meg a „Developer contact information” (Fejlesztői kapcsolattartási információk) mezőben az e-mail címét.
    *   Kattintson a „SAVE AND CONTINUE” (Mentés és folytatás) gombra.
    *   A „Scopes” (Hatókörök) oldalon kattintson az „ADD OR REMOVE SCOPES” (Hatókörök hozzáadása vagy eltávolítása) gombra. Itt kell kiválasztania azokat az engedélyeket, amelyeket a Gemini CLI kérni fog. Keresse meg és jelölje be a következőket (vagy azokat, amelyek a leginkább illeszkednek a Gemini CLI által igényelt funkciókhoz):
        *   `.../auth/drive` (Google Drive)
        *   `.../auth/gmail.readonly` (Gmail olvasási hozzáférés, ha írási hozzáférésre is szüksége van, válassza a `.../auth/gmail.modify` vagy `.../auth/gmail.compose` opciót)
        *   `.../auth/appsheet` (Google AppSheet)
        *   `.../auth/userinfo.email` (E-mail cím)
        *   `.../auth/userinfo.profile` (Profil információk)
        *   Kattintson az „ADD TO TABLE” (Hozzáadás a táblázathoz) gombra, majd a „SAVE AND CONTINUE” (Mentés és folytatás) gombra.
    *   A „Test users” (Teszt felhasználók) oldalon adja hozzá a saját Google fiókját tesztfelhasználóként, ha az alkalmazás még „Testing” (Tesztelés) állapotban van. Kattintson az „ADD USERS” (Felhasználók hozzáadása) gombra, adja meg az e-mail címét, majd kattintson az „ADD” (Hozzáadás) gombra.
    *   Kattintson a „SAVE AND CONTINUE” (Mentés és folytatás) gombra.
    *   Tekintse át az összefoglalót, majd kattintson a „BACK TO DASHBOARD” (Vissza az irányítópulthoz) gombra.
3.  Miután az OAuth hozzájárulási képernyő konfigurálva van, térjen vissza a „Credentials” (Hitelesítő adatok) oldalra.
4.  Kattintson a „+ CREATE CREDENTIALS” (+ Hitelesítő adatok létrehozása) gombra, majd válassza az „OAuth client ID” (OAuth kliens azonosító) opciót.
5.  Az „Application type” (Alkalmazástípus) legördülő menüből válassza a „Desktop app” (Asztali alkalmazás) lehetőséget.
6.  Adjon egy értelmes nevet a kliens azonosítónak (pl. „Gemini CLI Desktop Client”).
7.  Kattintson a „CREATE” (Létrehozás) gombra.

### 3.4 `client_secret.json` letöltése

1.  Az OAuth kliens azonosító létrehozása után egy felugró ablakban megjelennek a kliens adatai (Client ID és Client Secret).
2.  Kattintson a „DOWNLOAD JSON” (JSON letöltése) gombra.
3.  Mentse el a fájlt `client_secret.json` néven egy könnyen megjegyezhető helyre a számítógépén (pl. a `Letöltések` mappába vagy egy dedikált mappába). **Ez a fájl tartalmazza az alkalmazás titkos kulcsait, ezért kezelje biztonságosan, és ne ossza meg senkivel!**
4.  Jegyezze meg a fájl teljes elérési útját, szüksége lesz rá a PowerShell szkript futtatásakor.




## 4. A PowerShell szkript használata

Miután elvégezte a manuális lépéseket a Google Cloud Platformon, és letöltötte a `client_secret.json` fájlt, használhatja a mellékelt PowerShell szkriptet a Gemini CLI konfigurálásának automatizálásához.

### 4.1 A szkript letöltése

1.  Töltse le a `gemini_cli_setup.ps1` nevű PowerShell szkriptet a következő helyről: [link a szkripthez, amit majd megadok].
2.  Mentse el a szkriptet egy tetszőleges mappába a számítógépén (pl. `C:\Scripts`).

### 4.2 A szkript futtatása

1.  Nyissa meg a PowerShellt **rendszergazdaként**. Ehhez kattintson a Start menüre, írja be a „PowerShell” kifejezést, majd kattintson a jobb gombbal a „Windows PowerShell” elemre, és válassza a „Run as administrator” (Futtatás rendszergazdaként) lehetőséget.
2.  Navigáljon ahhoz a mappához, ahová a szkriptet mentette. Például, ha a `C:\Scripts` mappába mentette, írja be a következő parancsot, majd nyomja meg az Entert:
    ```powershell
    cd C:\Scripts
    ```
3.  Futtassa a szkriptet a következő paranccsal:
    ```powershell
    .\gemini_cli_setup.ps1
    ```
4.  A szkript végigvezeti Önt a manuális lépéseken, amelyeket már elvégzett a GCP konzolon. Minden lépés után nyomjon meg egy gombot a folytatáshoz.
5.  Amikor a szkript kéri, adja meg a letöltött `client_secret.json` fájl teljes elérési útját. Például: `C:\Users\Az_Ön_Felhasználóneve\Downloads\client_secret.json`.
6.  A szkript átmásolja a `client_secret.json` fájlt a Gemini CLI konfigurációs könyvtárába (általában `C:\Users\Az_Ön_Felhasználóneve\.gemini`).
7.  Ezután a szkript elindítja a Gemini CLI hitelesítési folyamatát. Ez automatikusan megnyit egy böngészőablakot. Kövesse a böngészőben megjelenő utasításokat a Google fiókjához való hozzáférés engedélyezéséhez. Győződjön meg róla, hogy a megfelelő Google fiókkal jelentkezik be, és engedélyezi az összes kért hozzáférést.
8.  Miután a böngészőben befejeződött a hitelesítés, térjen vissza a PowerShell ablakhoz. A szkript jelzi, ha a beállítás sikeresen befejeződött.




## 5. Hibaelhárítás

Ez a szakasz a gyakori problémákat és azok megoldásait tartalmazza a Gemini CLI konfigurálása során.

### 5.1 „A szkript nem futtatható, mert a rendszer letiltotta” hibaüzenet

**Probléma:** Amikor megpróbálja futtatni a PowerShell szkriptet, a következő hibaüzenetet kapja: „File C:\path\to\gemini_cli_setup.ps1 cannot be loaded because running scripts is disabled on this system.”

**Megoldás:** Ez a hiba azt jelzi, hogy a PowerShell végrehajtási házirendje megakadályozza a szkriptek futtatását. A probléma megoldásához nyissa meg a PowerShellt **rendszergazdaként**, és futtassa a következő parancsot:

```powershell
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
```

Ez a parancs lehetővé teszi a helyi gépen létrehozott, valamint az internetről letöltött, megbízható kiadó által aláírt szkriptek futtatását. A változtatás csak az aktuális felhasználóra vonatkozik. A parancs futtatása után próbálja meg újra a szkriptet.

### 5.2 „A megadott fájl nem található” hiba a `client_secret.json` fájlnál

**Probléma:** A szkript futtatása során hibaüzenetet kap, miszerint a `client_secret.json` fájl nem található, annak ellenére, hogy megadta az elérési útját.

**Megoldás:** Ellenőrizze a következőket:

*   **Elérési út pontossága:** Győződjön meg róla, hogy a `client_secret.json` fájl teljes elérési útját adta meg, beleértve a meghajtóbetűjelet és az összes mappanevet. Például: `C:\Users\Az_Ön_Felhasználóneve\Downloads\client_secret.json`.
*   **Fájlnév:** Győződjön meg róla, hogy a fájl neve pontosan `client_secret.json` (kis- és nagybetűk érzékenyek lehetnek bizonyos rendszereken, bár Windows alatt általában nem). Ne legyen benne extra kiterjesztés, mint például `.txt`.
*   **Fájl létezése:** Ellenőrizze, hogy a fájl valóban létezik-e a megadott helyen. Használja a Fájlkezelőt a fájl megkereséséhez.

### 5.3 A böngészőben nem nyílik meg a hitelesítési oldal

**Probléma:** A szkript futtatása után a Gemini CLI hitelesítési folyamata nem nyitja meg automatikusan a böngészőben a Google hitelesítési oldalát.

**Megoldás:** Ez több okból is előfordulhat:

*   **`gemini` parancs nem található a PATH-ban:** Győződjön meg róla, hogy a `gemini` parancs elérhető a rendszer PATH környezeti változójában. Ha nem, akkor a PowerShell szkriptben a `Start-Process -FilePath "gemini"` sort módosítania kell a `gemini.exe` teljes elérési útjára (pl. `Start-Process -FilePath "C:\Program Files\Gemini CLI\gemini.exe"`).
*   **Tűzfal vagy proxy beállítások:** A tűzfal vagy proxy beállításai blokkolhatják a Gemini CLI számára a külső kapcsolatok kezdeményezését. Ideiglenesen próbálja meg kikapcsolni a tűzfalat, vagy konfigurálja a proxy beállításokat.
*   **Internetkapcsolat:** Ellenőrizze, hogy van-e aktív internetkapcsolata.

### 5.4 Hozzáférési problémák a Google szolgáltatásokhoz a hitelesítés után

**Probléma:** A hitelesítés sikeresnek tűnik, de a Gemini CLI továbbra sem tud hozzáférni a Gmailhez, Google Drive-hoz vagy AppSheethoz.

**Megoldás:**

*   **API-k engedélyezése:** Győződjön meg róla, hogy a Google Cloud Platformon engedélyezte az összes szükséges API-t (Gmail API, Google Drive API, Google AppSheet API). Lásd a 3.2 szakaszt.
*   **Hatókörök (Scopes):** Ellenőrizze, hogy az OAuth 2.0 kliens azonosító létrehozásakor a megfelelő hatóköröket (scopes) adta-e hozzá. Ha például csak olvasási hozzáférést engedélyezett a Gmailhez, akkor a Gemini CLI nem fog tudni e-maileket küldeni. Lásd a 3.3 szakaszt.
*   **Teszt felhasználók:** Ha az OAuth hozzájárulási képernyő még „Testing” (Tesztelés) állapotban van, győződjön meg róla, hogy a Google fiókja hozzá van adva a teszt felhasználókhoz. Lásd a 3.3 szakaszt.
*   **Engedélyek visszavonása és újraengedélyezése:** Néha segíthet, ha visszavonja a Gemini CLI számára adott engedélyeket a Google fiókjában, majd újra végigfuttatja a hitelesítési folyamatot. Ezt megteheti a [Google fiók biztonsági beállításaiban](https://myaccount.google.com/permissions).




## 6. Gyakran Ismételt Kérdések (GYIK)

### 6.1 Miért van szükségem Google Cloud Platform projektre?

A Google Cloud Platform (GCP) projekt biztosítja a keretrendszert a Google API-k és szolgáltatások használatához. Ez az a hely, ahol engedélyezi a szükséges API-kat, és létrehozza az OAuth 2.0 kliens azonosítót, amely lehetővé teszi a Gemini CLI számára, hogy biztonságosan kommunikáljon a Google szolgáltatásokkal a nevében.

### 6.2 Biztonságos a `client_secret.json` fájl használata?

Igen, a `client_secret.json` fájl biztonságos, amennyiben megfelelően kezeli. Ez a fájl tartalmazza az alkalmazás hitelesítési adatait, és kulcsfontosságú a Gemini CLI és a Google szolgáltatások közötti biztonságos kapcsolat létrehozásához. **Soha ne ossza meg ezt a fájlt senkivel, és ne töltse fel nyilvános helyekre (pl. GitHub)!** A szkript átmásolja ezt a fájlt a Gemini CLI konfigurációs könyvtárába, amely általában a felhasználói profiljában található, és védett helyen van.

### 6.3 Miért kell engedélyeznem az API-kat a GCP-ben?

A Google szigorú biztonsági intézkedéseket alkalmaz az adatok védelme érdekében. Az API-k engedélyezése a GCP projektben jelzi a Google-nak, hogy az Ön projektje (és így a Gemini CLI) jogosult hozzáférni az adott szolgáltatásokhoz. Ez egy szükséges lépés a Google ökoszisztémájában való működéshez.

### 6.4 Mi az az OAuth 2.0, és miért használja a Gemini CLI?

Az OAuth 2.0 egy ipari szabványos protokoll az engedélyezéshez. Lehetővé teszi, hogy egy alkalmazás (ebben az esetben a Gemini CLI) korlátozott hozzáférést kapjon egy felhasználó (Ön) védett erőforrásaihoz (pl. Gmail, Google Drive) anélkül, hogy megosztaná a felhasználó jelszavát. A Gemini CLI az OAuth 2.0-t használja, hogy biztonságosan és felhasználóbarát módon hitelesítse magát a Google szolgáltatásokkal, egy böngésző alapú engedélyezési folyamaton keresztül.

### 6.5 Miért nem kell külön API-t engedélyezni a Chrome alkalmazásokhoz?

A kutatásaink szerint a Gemini CLI valószínűleg nem egy dedikált Google Chrome API-n keresztül kommunikál a Chrome alkalmazásokkal, hanem inkább a böngészővel kapcsolatos feladatokat kezeli közvetlenül, vagy a Google fiók általános engedélyezésén keresztül történik a hozzáférés. Ezért nincs szükség külön Chrome API engedélyezésére a GCP-ben ehhez a célhoz. Ha a jövőben a Gemini CLI funkciói bővülnek, és szükségessé válik egy specifikus Chrome API, akkor az útmutató frissítésre kerül.

### 6.6 Mi van, ha több Google fiókom van?

Amikor a Gemini CLI hitelesítési folyamata megnyitja a böngészőt, győződjön meg róla, hogy azzal a Google fiókkal jelentkezik be, amelyhez a Gemini CLI-nek hozzá kell férnie. A GCP projektet és az OAuth kliens azonosítót is azzal a fiókkal kell létrehoznia, amelyet használni szeretne.



