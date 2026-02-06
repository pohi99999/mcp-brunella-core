# GitHub Self-hosted Runner Telepítés

Ez a dokumentum leírja, hogyan telepítheted a GitHub Actions self-hosted runnert a lokális gépedre a BAS Hybrid Cloud szinkronizációhoz.

## Miért kell Self-hosted Runner?

A BAS Cloud Sync workflow-nak hozzá kell férnie a lokális fájlokhoz:
- `F:\mcp-brunella-core\.lancedb` - LanceDB adatbázis
- `F:\mcp-brunella-core\conductor\tracks.md` - Fejlesztési szálak

A GitHub-hosted runnerek nem férnek hozzá ezekhez, ezért lokális runnert kell használni.

## Telepítési Lépések

### 1. Runner mappa létrehozása

```powershell
mkdir G:\Brunella\actions-runner
cd G:\Brunella\actions-runner
```

### 2. Runner letöltése

Menj a GitHub repo beállításokhoz:
1. `Settings` → `Actions` → `Runners`
2. Kattints `New self-hosted runner`
3. Válaszd ki: **Windows** / **x64**
4. Kövesd a megjelenő utasításokat

Vagy manuálisan:

```powershell
# Legújabb verzió letöltése (ellenőrizd a GitHub-on)
Invoke-WebRequest -Uri https://github.com/actions/runner/releases/download/v2.311.0/actions-runner-win-x64-2.311.0.zip -OutFile actions-runner-win-x64.zip

# Kicsomagolás
Expand-Archive -Path actions-runner-win-x64.zip -DestinationPath .
```

### 3. Runner konfigurálása

```powershell
# Konfiguráció (a tokent a GitHub-ról másold)
.\config.cmd --url https://github.com/YOUR_USERNAME/mcp-brunella-core --token YOUR_TOKEN

# Kérdésekre válaszok:
# - Runner group: [Enter] (default)
# - Runner name: bas-local-runner
# - Labels: self-hosted,Windows,X64,bas
# - Work folder: [Enter] (default: _work)
```

### 4. Futtatás szolgáltatásként

```powershell
# Szolgáltatás telepítése (Admin PowerShell!)
.\svc.cmd install

# Szolgáltatás indítása
.\svc.cmd start

# Státusz ellenőrzése
.\svc.cmd status
```

Vagy manuális futtatás (teszteléshez):

```powershell
.\run.cmd
```

### 5. GitHub Secrets beállítása

A repo Settings → Secrets and variables → Actions oldalon add hozzá:

| Secret neve | Leírás |
|-------------|--------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token (R2, D1, Workers jogosultságokkal) |

#### Cloudflare API Token létrehozása:

1. Cloudflare Dashboard → My Profile → API Tokens
2. Create Token → Custom token
3. Permissions:
   - Account / Workers R2 Storage / Edit
   - Account / Workers Scripts / Edit
   - Account / D1 / Edit
4. Account Resources: Your account
5. Create Token → Másold ki

### 6. Workflow tesztelése

```powershell
# GitHub CLI-vel
gh workflow run bas-cloud-sync.yml --field sync_type=full

# Vagy a GitHub webes felületen:
# Actions → BAS Cloud Sync → Run workflow
```

## Hibaelhárítás

### Runner nem csatlakozik

```powershell
# Logok megtekintése
Get-Content .\_diag\Runner_*.log -Tail 50

# Újrakonfigurálás
.\config.cmd remove
.\config.cmd --url ... --token ...
```

### Wrangler nem található

A runner PATH-jában kell lennie a Node.js-nek:

```powershell
# Ellenőrzés
$env:PATH -split ';' | Where-Object { $_ -like '*node*' }

# Ha hiányzik, add hozzá a runner .env fájlhoz
echo "PATH=$env:PATH;C:\Program Files\nodejs" >> .\.env
```

### Permissions hiba

Ha a runner nem fér hozzá a fájlokhoz:

```powershell
# Runner felhasználó jogosultságai
icacls "F:\mcp-brunella-core" /grant "NT AUTHORITY\NETWORK SERVICE:(OI)(CI)F"
```

## Runner Frissítése

```powershell
# Szolgáltatás leállítása
.\svc.cmd stop

# Új verzió letöltése és kicsomagolása
# (a config megmarad)

# Szolgáltatás újraindítása
.\svc.cmd start
```

## Eltávolítás

```powershell
# Szolgáltatás eltávolítása
.\svc.cmd uninstall

# Konfiguráció törlése
.\config.cmd remove

# Mappa törlése
cd ..
Remove-Item -Recurse -Force actions-runner
```

## Kapcsolódó Fájlok

- `.github/workflows/bas-cloud-sync.yml` - Sync workflow
- `myai/sync_to_r2.py` - Python sync script
- `bas-cloudflare-orchestrator/wrangler.jsonc` - Cloudflare konfiguráció
