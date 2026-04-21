# ADK Web - Hibaelhárítási Útmutató

## 🚨 Gyakori Problémák és Megoldások

### 1. Backend nem indul (port 8000)

**Tünetek:**
- A backend terminálban nincs kimenet
- Port 8000 nem foglalt
- Frontend nem tud csatlakozni

**Megoldások:**

#### A. Ellenőrizd az `uv` telepítését
```powershell
uv --version
```

Ha nincs telepítve:
```powershell
# Windows PowerShell
irm https://astral.sh/uv/install.ps1 | iex
```

#### B. Ellenőrizd az `adk` parancsot
```powershell
cd "G:\Brunella\[ACTIVE]_Agents\ready-agents\agents-chat"
uv run adk --help
```

Ha nem működik:
```powershell
# Telepítsd újra a függőségeket
uv sync
```

#### C. Manuális backend indítás
```powershell
cd "G:\Brunella\[ACTIVE]_Agents\ready-agents\agents-chat"

# .env fájl létrehozása, ha nincs
if (-not (Test-Path "app\.env")) {
    Set-Content -Path "app\.env" -Value 'GOOGLE_API_KEY=YOUR_GOOGLE_API_KEY_HERE'
}

$env:GOOGLE_API_KEY="YOUR_GOOGLE_API_KEY_HERE"
uv run adk api_server app --allow_origins="http://localhost:4200" --host=0.0.0.0 --port=8000
```

**Várt kimenet:**
```
INFO:     Uvicorn running on http://0.0.0.0:8000
```

---

### 2. Frontend nem indul (port 4200)

**Tünetek:**
- A frontend terminálban nincs kimenet
- Port 4200 nem foglalt
- `npm run serve` hibát ad

**Megoldások:**

#### A. Ellenőrizd a Node.js telepítését
```powershell
node --version
npm --version
```

#### B. Telepítsd újra a függőségeket
```powershell
cd "G:\Brunella\[ACTIVE]_Agents\adk-a2a\adk-web"
npm install
```

#### C. Ellenőrizd az Angular CLI-t
```powershell
ng version
```

Ha nincs telepítve:
```powershell
npm install -g @angular/cli
```

#### D. Manuális frontend indítás
```powershell
cd "G:\Brunella\[ACTIVE]_Agents\adk-a2a\adk-web"
npm run serve -- --backend=http://localhost:8000
```

**Várt kimenet:**
```
✔ Browser application bundle generation complete.
Angular Live Development Server is listening on localhost:4200
```

---

### 3. Frontend nem tud csatlakozni a backend-hez

**Tünetek:**
- Frontend betölt, de "Cannot connect to backend" hiba
- CORS hibák a böngésző konzolban

**Megoldások:**

#### A. Ellenőrizd, hogy a backend fut-e
```powershell
Get-NetTCPConnection -LocalPort 8000
```

#### B. Ellenőrizd a CORS beállításokat
A backend indításnál használd:
```powershell
--allow_origins="http://localhost:4200"
```

#### C. Próbáld meg újraindítani mindkettőt
1. Állítsd le a backend-et (Ctrl+C)
2. Állítsd le a frontend-et (Ctrl+C)
3. Indítsd újra a backend-et
4. Várj 5 másodpercet
5. Indítsd újra a frontend-et

---

### 4. Port már foglalt

**Tünetek:**
- "Port 8000 is already in use" hiba
- "Port 4200 is already in use" hiba

**Megoldások:**

#### A. Találd meg, mi használja a portot
```powershell
# Port 8000
Get-NetTCPConnection -LocalPort 8000 | Select-Object OwningProcess
Get-Process -Id (Get-NetTCPConnection -LocalPort 8000).OwningProcess

# Port 4200
Get-NetTCPConnection -LocalPort 4200 | Select-Object OwningProcess
Get-Process -Id (Get-NetTCPConnection -LocalPort 4200).OwningProcess
```

#### B. Állítsd le a folyamatot
```powershell
# Port 8000
Stop-Process -Id (Get-NetTCPConnection -LocalPort 8000).OwningProcess -Force

# Port 4200
Stop-Process -Id (Get-NetTCPConnection -LocalPort 4200).OwningProcess -Force
```

#### C. Vagy használj másik portot
```powershell
# Backend másik porton
uv run adk api_server app --allow_origins="http://localhost:4200" --host=0.0.0.0 --port=8001

# Frontend másik porton
npm run serve -- --backend=http://localhost:8001 --port=4201
```

---

### 5. "adk command not found" hiba

**Megoldás:**
```powershell
cd "G:\Brunella\[ACTIVE]_Agents\ready-agents\agents-chat"
uv sync
uv run adk --help
```

Ha még mindig nem működik:
```powershell
# Telepítsd az ADK-t globálisan
pip install google-adk
```

---

### 6. "npm run serve" nem működik

**Megoldás:**
```powershell
cd "G:\Brunella\[ACTIVE]_Agents\adk-a2a\adk-web"

# Töröld a node_modules-t és telepítsd újra
Remove-Item -Recurse -Force node_modules
npm install

# Próbáld meg újra
npm run serve -- --backend=http://localhost:8000
```

---

## 🔄 Teljes Újraindítás

Ha semmi sem működik, próbáld meg teljesen újraindítani:

```powershell
# 1. Állítsd le minden folyamatot
Get-Process | Where-Object {$_.ProcessName -like "*node*" -or $_.ProcessName -like "*uvicorn*"} | Stop-Process -Force

# 2. Backend újraindítás
cd "G:\Brunella\[ACTIVE]_Agents\ready-agents\agents-chat"
$env:GOOGLE_API_KEY="YOUR_GOOGLE_API_KEY_HERE"
uv sync
uv run adk api_server app --allow_origins="http://localhost:4200" --host=0.0.0.0 --port=8000

# 3. Frontend újraindítás (új terminálban)
cd "G:\Brunella\[ACTIVE]_Agents\adk-a2a\adk-web"
npm install
npm run serve -- --backend=http://localhost:8000
```

---

## 💡 Alternatív: Egyszerűbb Megoldás

Ha az ADK Web túl bonyolult, használd az **agents-chat** beépített web UI-ját:

```powershell
cd "G:\Brunella\[ACTIVE]_Agents\ready-agents\agents-chat"
$env:GOOGLE_API_KEY="YOUR_GOOGLE_API_KEY_HERE"
uv run adk web --port=8501
```

Ez egy egyszerűbb, beépített UI, ami azonnal működik.

**URL**: http://localhost:8501

---

## 📞 További Segítség

Ha még mindig nem működik:
1. Ellenőrizd a terminál kimeneteket (milyen hibák jelennek meg?)
2. Ellenőrizd a böngésző konzolt (F12 → Console)
3. Ellenőrizd a hálózati kéréseket (F12 → Network)

