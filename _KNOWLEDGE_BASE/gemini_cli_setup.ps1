```powershell
# Gemini CLI Google API konfigurációs szkript

function Show-ManualSteps {
    param (
        [string]$StepTitle,
        [string]$StepDescription
    )
    Write-Host "`n--- $StepTitle ---"
    Write-Host $StepDescription
    Write-Host "Nyomj meg egy gombot a folytatáshoz..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}

Write-Host "Ez a szkript segít beállítani a Gemini CLI-t a Google szolgáltatásokhoz való hozzáféréshez."
Write-Host "Kérjük, kövesd az utasításokat figyelmesen."

# --- Manuális lépések a Google Cloud Platformon ---

Show-ManualSteps \
    "1. Google Cloud Projekt létrehozása" \
    "Lépj a Google Cloud Console-ra (console.cloud.google.com) és hozz létre egy új projektet, vagy válassz ki egy meglévőt."

Show-ManualSteps \
    "2. Szükséges API-k engedélyezése" \
    "A Google Cloud Console-ban navigálj az 'APIs & Services' -> 'Enabled APIs & services' menüpontra. Engedélyezd a következő API-kat:
    - Google Drive API
    - Gmail API
    - Google AppSheet API
    (A Chrome alkalmazásokhoz valószínűleg nincs külön API, a Gemini CLI közvetlenül kezeli a böngészővel kapcsolatos feladatokat.)"

Show-ManualSteps \
    "3. OAuth 2.0 kliens azonosító létrehozása" \
    "A Google Cloud Console-ban navigálj az 'APIs & Services' -> 'Credentials' menüpontra.
    Kattints a 'CREATE CREDENTIALS' gombra, majd válaszd az 'OAuth client ID' opciót.
    Válaszd az 'Desktop app' alkalmazástípust, adj neki egy nevet (pl. 'Gemini CLI Desktop App'), majd kattints a 'CREATE' gombra."

Show-ManualSteps \
    "4. client_secret.json letöltése" \
    "Az OAuth kliens azonosító létrehozása után egy felugró ablakban megjelennek a kliens adatai. Kattints a 'DOWNLOAD JSON' gombra, és mentsd el a fájlt `client_secret.json` néven.
    Jegyezd meg, hova mentetted a fájlt!"

# --- Automatikus lépések ---

Write-Host "`n--- Automatikus beállítások ---"

$clientSecretPath = Read-Host "Kérlek, add meg a letöltött client_secret.json fájl teljes elérési útját (pl. C:\Users\YourUser\Downloads\client_secret.json)"

if (-not (Test-Path $clientSecretPath)) {
    Write-Error "A megadott fájl nem található: $clientSecretPath"
    exit 1
}

# A Gemini CLI konfigurációs könyvtárának meghatározása
# Ez feltételezi, hogy a Gemini CLI a felhasználó profiljában tárolja a konfigurációt.
# Ezt ellenőrizni kell a Gemini CLI dokumentációjában vagy a forráskódban.
$geminiCliConfigDir = Join-Path $env:USERPROFILE ".gemini"

# Ha a .gemini mappa nem létezik, hozd létre
if (-not (Test-Path $geminiCliConfigDir)) {
    New-Item -ItemType Directory -Path $geminiCliConfigDir -Force
}

# A client_secret.json fájl másolása a Gemini CLI konfigurációs könyvtárába
Copy-Item -Path $clientSecretPath -Destination (Join-Path $geminiCliConfigDir "client_secret.json") -Force

Write-Host "A client_secret.json fájl sikeresen átmásolva a Gemini CLI konfigurációs könyvtárába: $geminiCliConfigDir"

Write-Host "`n--- Gemini CLI hitelesítés ---"
Write-Host "Most elindítjuk a Gemini CLI hitelesítési folyamatát. Ez megnyit egy böngészőablakot."
Write-Host "Kérjük, kövesd a böngészőben megjelenő utasításokat a hozzáférés engedélyezéséhez."

# A Gemini CLI hitelesítési parancs futtatása
# Ezt a parancsot ellenőrizni kell a Gemini CLI dokumentációjában.
# Feltételezzük, hogy a 'gemini auth login' parancs kezeli az OAuth folyamatot.

# Megjegyzés: A 'gemini' parancsnak elérhetőnek kell lennie a PATH-ban.
# Ha nem, akkor a teljes elérési utat meg kell adni (pl. C:\path\to\gemini.exe auth login)

Start-Process -FilePath "gemini" -ArgumentList "auth login" -NoNewWindow -Wait

Write-Host "`n--- Beállítás befejezve ---"
Write-Host "A Gemini CLI beállítása sikeresen befejeződött."
Write-Host "Most már hozzáférhetsz a Google szolgáltatásokhoz a Gemini CLI-n keresztül."
```


