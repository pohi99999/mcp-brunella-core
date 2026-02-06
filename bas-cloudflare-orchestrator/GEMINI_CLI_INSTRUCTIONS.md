# BAS (Brunella Agent System) - Telepítési és Tesztelési Útmutató
# Gemini CLI Agent számára - Önálló végrehajtáshoz

---

## 🎯 KÜLDETÉS

Te a Gemini CLI agent vagy. A feladatod a BAS (Brunella Agent System) hibrid architektúra telepítése, konfigurálása és tesztelése. Minden lépést hajts végre sorrendben, dokumentáld az eredményeket, és jelezd ha hiba történik.

**Fontos szabályok:**
1. Minden parancs után várd meg az eredményt
2. Hiba esetén próbáld meg javítani, ha nem sikerül, dokumentáld és folytasd
3. Minden teszt eredményét írd be a `C:\Projects\bas-cloudflare-orchestrator\TEST_RESULTS.md` fájlba
4. Ha egy szolgáltatás nem elérhető, próbáld újraindítani

---

## FÁZIS 0: ELŐFELTÉTELEK ELLENŐRZÉSE

### 0.1 Rendszerkövetelmények ellenőrzése

```powershell
# Ellenőrizd a szükséges eszközöket
Write-Host "=== BAS Előfeltételek Ellenőrzése ===" -ForegroundColor Cyan

# Node.js
$nodeVersion = node --version 2>$null
if ($nodeVersion) {
    Write-Host "✅ Node.js: $nodeVersion" -ForegroundColor Green
} else {
    Write-Host "❌ Node.js HIÁNYZIK - Telepítsd: https://nodejs.org" -ForegroundColor Red
}

# npm
$npmVersion = npm --version 2>$null
if ($npmVersion) {
    Write-Host "✅ npm: $npmVersion" -ForegroundColor Green
} else {
    Write-Host "❌ npm HIÁNYZIK" -ForegroundColor Red
}

# Python
$pythonVersion = python --version 2>$null
if ($pythonVersion) {
    Write-Host "✅ Python: $pythonVersion" -ForegroundColor Green
} else {
    Write-Host "❌ Python HIÁNYZIK - Telepítsd: https://python.org" -ForegroundColor Red
}

# Docker (opcionális)
$dockerVersion = docker --version 2>$null
if ($dockerVersion) {
    Write-Host "✅ Docker: $dockerVersion" -ForegroundColor Green
} else {
    Write-Host "⚠️ Docker nem elérhető (opcionális)" -ForegroundColor Yellow
}

# Ollama
$ollamaRunning = Test-NetConnection -ComputerName localhost -Port 11434 -WarningAction SilentlyContinue
if ($ollamaRunning.TcpTestSucceeded) {
    Write-Host "✅ Ollama fut (port 11434)" -ForegroundColor Green
} else {
    Write-Host "⚠️ Ollama nem fut - Indítsd el: ollama serve" -ForegroundColor Yellow
}

# Wrangler (Cloudflare CLI)
$wranglerVersion = npx wrangler --version 2>$null
if ($wranglerVersion) {
    Write-Host "✅ Wrangler: $wranglerVersion" -ForegroundColor Green
} else {
    Write-Host "⚠️ Wrangler telepítés szükséges (npm install)" -ForegroundColor Yellow
}
```

**Dokumentáld az eredményt:** Írd be a `TEST_RESULTS.md` fájlba melyik komponensek elérhetők.

### 0.2 Ollama modell ellenőrzése

```powershell
# Ellenőrizd, hogy a llama3.1:8b modell elérhető-e
ollama list

# Ha nincs meg, töltsd le:
# ollama pull llama3.1:8b

# Teszteld a modellt
$ollamaTest = Invoke-RestMethod -Uri "http://localhost:11434/api/generate" -Method Post -ContentType "application/json" -Body '{"model": "llama3.1:8b", "prompt": "Mondj egy magyar köszönést!", "stream": false}'
Write-Host "Ollama válasz: $($ollamaTest.response)"
```

---

## FÁZIS 1: PROJEKT TELEPÍTÉSE

### 1.1 Projekt mappa létrehozása

```powershell
# Hozd létre a projekt mappát
$projectRoot = "C:\Projects\bas-cloudflare-orchestrator"

if (-not (Test-Path $projectRoot)) {
    New-Item -ItemType Directory -Path $projectRoot -Force
    Write-Host "✅ Projekt mappa létrehozva: $projectRoot" -ForegroundColor Green
} else {
    Write-Host "⚠️ Projekt mappa már létezik" -ForegroundColor Yellow
}

Set-Location $projectRoot
```

### 1.2 ZIP kicsomagolása (ha letöltötted)

```powershell
# Ha a ZIP a Downloads mappában van
$zipPath = "$env:USERPROFILE\Downloads\bas-cloudflare-orchestrator.zip"
if (Test-Path $zipPath) {
    Expand-Archive -Path $zipPath -DestinationPath $projectRoot -Force
    Write-Host "✅ ZIP kicsomagolva" -ForegroundColor Green
} else {
    Write-Host "⚠️ ZIP nem található: $zipPath" -ForegroundColor Yellow
    Write-Host "Kérd meg Pétert, hogy töltse le a fájlt" -ForegroundColor Yellow
}
```

### 1.3 NPM függőségek telepítése

```powershell
Set-Location "C:\Projects\bas-cloudflare-orchestrator"

# Telepítsd a függőségeket
npm install

# Ellenőrizd a telepítést
if (Test-Path "node_modules") {
    Write-Host "✅ NPM csomagok telepítve" -ForegroundColor Green
    Write-Host "Telepített csomagok:" -ForegroundColor Cyan
    npm list --depth=0
} else {
    Write-Host "❌ NPM telepítés sikertelen" -ForegroundColor Red
}
```

### 1.4 Cloudflare KV Namespace létrehozása

```powershell
Set-Location "C:\Projects\bas-cloudflare-orchestrator"

# KV namespace létrehozása
Write-Host "KV Namespace létrehozása..." -ForegroundColor Cyan
$kvOutput = npx wrangler kv namespace create BAS_TASKS 2>&1

# Keresd meg a KV ID-t a kimenetben
Write-Host $kvOutput

# MANUÁLIS LÉPÉS: A kapott ID-t be kell írni a wrangler.jsonc fájlba!
Write-Host ""
Write-Host "⚠️ FONTOS: Másold be a fenti 'id' értéket a wrangler.jsonc fájlba!" -ForegroundColor Yellow
Write-Host "Fájl: C:\Projects\bas-cloudflare-orchestrator\wrangler.jsonc" -ForegroundColor Yellow
Write-Host 'Cseréld ki a "PLACEHOLDER_KV_ID" értéket a valódi ID-re!' -ForegroundColor Yellow
```

### 1.5 wrangler.jsonc frissítése (manuális vagy script)

```powershell
# Olvasd be a wrangler.jsonc tartalmát
$wranglerPath = "C:\Projects\bas-cloudflare-orchestrator\wrangler.jsonc"
$wranglerContent = Get-Content $wranglerPath -Raw

# Ha van KV ID a vágólapon, cseréld ki
# $newKvId = "your-kv-id-here"  # Írd be a valódi ID-t!
# $wranglerContent = $wranglerContent -replace "PLACEHOLDER_KV_ID", $newKvId
# Set-Content -Path $wranglerPath -Value $wranglerContent

Write-Host "wrangler.jsonc tartalma:" -ForegroundColor Cyan
Get-Content $wranglerPath
```

---

## FÁZIS 2: CLOUDFLARE WORKER DEPLOY

### 2.1 Worker deploy

```powershell
Set-Location "C:\Projects\bas-cloudflare-orchestrator"

Write-Host "=== Cloudflare Worker Deploy ===" -ForegroundColor Cyan

# Deploy
$deployOutput = npx wrangler deploy 2>&1
Write-Host $deployOutput

# Ellenőrizd a deploy eredményét
if ($deployOutput -match "https://.*\.workers\.dev") {
    $workerUrl = $Matches[0]
    Write-Host "✅ Worker sikeresen deployolva: $workerUrl" -ForegroundColor Green
} else {
    Write-Host "⚠️ Deploy kimenet ellenőrzése szükséges" -ForegroundColor Yellow
}
```

### 2.2 Worker health check

```powershell
# Várd meg pár másodpercet a propagálásra
Start-Sleep -Seconds 5

# Health check
$workerUrl = "https://bas-orchestrator.workers.dev"  # vagy a deploy kimenetéből

try {
    $healthCheck = Invoke-RestMethod -Uri $workerUrl -Method Get
    Write-Host "✅ Worker válasz:" -ForegroundColor Green
    $healthCheck | ConvertTo-Json -Depth 3
} catch {
    Write-Host "❌ Worker nem elérhető: $_" -ForegroundColor Red
}
```

---

## FÁZIS 3: LANGFLOW TELEPÍTÉS ÉS KONFIGURÁCIÓ

### 3.1 Langflow telepítése

```powershell
Write-Host "=== Langflow Telepítés ===" -ForegroundColor Cyan

# Telepítés pip-pel
pip install langflow --upgrade

# Ellenőrzés
$langflowVersion = pip show langflow 2>$null
if ($langflowVersion) {
    Write-Host "✅ Langflow telepítve" -ForegroundColor Green
    $langflowVersion
} else {
    Write-Host "❌ Langflow telepítés sikertelen" -ForegroundColor Red
}
```

### 3.2 Langflow indítása (háttérben)

```powershell
# Indítsd el a Langflow-t egy új PowerShell ablakban
Write-Host "Langflow indítása..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "langflow run --host 0.0.0.0 --port 7860"

Write-Host "⏳ Várakozás a Langflow indulására (30 mp)..." -ForegroundColor Yellow
Start-Sleep -Seconds 30

# Ellenőrzés
$langflowRunning = Test-NetConnection -ComputerName localhost -Port 7860 -WarningAction SilentlyContinue
if ($langflowRunning.TcpTestSucceeded) {
    Write-Host "✅ Langflow fut: http://localhost:7860" -ForegroundColor Green
} else {
    Write-Host "❌ Langflow nem indult el" -ForegroundColor Red
}
```

### 3.3 Langflow API ellenőrzése

```powershell
try {
    $langflowHealth = Invoke-RestMethod -Uri "http://localhost:7860/health" -Method Get
    Write-Host "✅ Langflow API válasz:" -ForegroundColor Green
    $langflowHealth | ConvertTo-Json
} catch {
    Write-Host "⚠️ Langflow API nem elérhető (lehet, hogy még töltődik)" -ForegroundColor Yellow
}
```

### 3.4 Flow-k importálása (manuális utasítás)

```
=== MANUÁLIS LÉPÉS ===

1. Nyisd meg a böngészőben: http://localhost:7860
2. Jelentkezz be (ha kéri)
3. Kattints: "New Project" → "Import"
4. Importáld ezeket a fájlokat egyenként:
   - C:\Projects\bas-cloudflare-orchestrator\langflow\research-agent.json
   - C:\Projects\bas-cloudflare-orchestrator\langflow\code-agent.json
   - C:\Projects\bas-cloudflare-orchestrator\langflow\orchestrator-agent.json
5. Minden flow-ban ellenőrizd az Ollama beállításokat:
   - base_url: http://localhost:11434
   - model_name: llama3.1:8b
6. Aktiváld az API endpoint-okat minden flow-nál

Ha kész, folytasd a teszteléssel.
```

---

## FÁZIS 4: N8N TELEPÍTÉS ÉS KONFIGURÁCIÓ

### 4.1 n8n indítása

```powershell
Write-Host "=== n8n Indítás ===" -ForegroundColor Cyan

# Indítsd el az n8n-t egy új PowerShell ablakban
Start-Process powershell -ArgumentList "-NoExit", "-Command", "npx n8n"

Write-Host "⏳ Várakozás az n8n indulására (20 mp)..." -ForegroundColor Yellow
Start-Sleep -Seconds 20

# Ellenőrzés
$n8nRunning = Test-NetConnection -ComputerName localhost -Port 5678 -WarningAction SilentlyContinue
if ($n8nRunning.TcpTestSucceeded) {
    Write-Host "✅ n8n fut: http://localhost:5678" -ForegroundColor Green
} else {
    Write-Host "❌ n8n nem indult el" -ForegroundColor Red
}
```

### 4.2 n8n workflow importálása (manuális utasítás)

```
=== MANUÁLIS LÉPÉS ===

1. Nyisd meg a böngészőben: http://localhost:5678
2. Regisztrálj/Jelentkezz be
3. Kattints: "Add workflow" → "Import from file"
4. Válaszd ki: C:\Projects\bas-cloudflare-orchestrator\n8n\bas-task-handler-workflow.json
5. Aktiváld a workflow-t (toggle ON)
6. Jegyezd fel a webhook URL-t (pl. http://localhost:5678/webhook/bas-task)

Ha kész, folytasd a teszteléssel.
```

---

## FÁZIS 5: BROWSER-USE API TELEPÍTÉS

### 5.1 Python környezet létrehozása

```powershell
Set-Location "C:\Projects\bas-cloudflare-orchestrator\local"

Write-Host "=== Browser-Use API Setup ===" -ForegroundColor Cyan

# Virtuális környezet létrehozása
if (-not (Test-Path "venv")) {
    python -m venv venv
    Write-Host "✅ Python venv létrehozva" -ForegroundColor Green
}

# Aktiválás
.\venv\Scripts\Activate.ps1

# Függőségek telepítése
pip install -r requirements.txt

Write-Host "✅ Python függőségek telepítve" -ForegroundColor Green
```

### 5.2 Browser-Use API indítása

```powershell
Set-Location "C:\Projects\bas-cloudflare-orchestrator\local"

# Indítsd el az API-t egy új PowerShell ablakban
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd C:\Projects\bas-cloudflare-orchestrator\local; .\venv\Scripts\Activate.ps1; python browser_use_api.py"

Write-Host "⏳ Várakozás az API indulására (10 mp)..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Ellenőrzés
$browserUseRunning = Test-NetConnection -ComputerName localhost -Port 8000 -WarningAction SilentlyContinue
if ($browserUseRunning.TcpTestSucceeded) {
    Write-Host "✅ Browser-Use API fut: http://localhost:8000" -ForegroundColor Green
} else {
    Write-Host "❌ Browser-Use API nem indult el" -ForegroundColor Red
}
```

### 5.3 Browser-Use API health check

```powershell
try {
    $browserUseHealth = Invoke-RestMethod -Uri "http://localhost:8000/" -Method Get
    Write-Host "✅ Browser-Use API válasz:" -ForegroundColor Green
    $browserUseHealth | ConvertTo-Json -Depth 3
} catch {
    Write-Host "❌ Browser-Use API nem elérhető: $_" -ForegroundColor Red
}
```

---

## FÁZIS 6: INTEGRÁCIÓS TESZTEK

### 6.1 Teszt eredmény fájl létrehozása

```powershell
$testResultsPath = "C:\Projects\bas-cloudflare-orchestrator\TEST_RESULTS.md"
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

$initialContent = @"
# BAS Tesztelési Eredmények
**Tesztelés időpontja:** $timestamp
**Tesztelő:** Gemini CLI Agent

---

## Szolgáltatások Állapota

| Szolgáltatás | Port | Állapot | Megjegyzés |
|--------------|------|---------|------------|
| Cloudflare Worker | - | ⏳ | |
| Langflow | 7860 | ⏳ | |
| n8n | 5678 | ⏳ | |
| Browser-Use API | 8000 | ⏳ | |
| Ollama | 11434 | ⏳ | |

---

## Teszt Eredmények

"@

Set-Content -Path $testResultsPath -Value $initialContent
Write-Host "✅ Teszt eredmény fájl létrehozva: $testResultsPath" -ForegroundColor Green
```

### 6.2 TESZT 1: Cloudflare Worker - Egyszerű health check

```powershell
Write-Host "=== TESZT 1: Cloudflare Worker Health ===" -ForegroundColor Cyan

$testName = "Cloudflare Worker Health Check"
$workerUrl = "https://bas-orchestrator.workers.dev"

try {
    $response = Invoke-RestMethod -Uri $workerUrl -Method Get -TimeoutSec 30
    $status = "✅ SIKERES"
    $details = $response | ConvertTo-Json -Compress
    Write-Host "$status" -ForegroundColor Green
    Write-Host "Válasz: $details"
} catch {
    $status = "❌ SIKERTELEN"
    $details = $_.Exception.Message
    Write-Host "$status - $details" -ForegroundColor Red
}

# Eredmény hozzáfűzése
Add-Content -Path "C:\Projects\bas-cloudflare-orchestrator\TEST_RESULTS.md" -Value @"

### Teszt 1: $testName
- **Eredmény:** $status
- **URL:** $workerUrl
- **Válasz:** ``$details``

"@
```

### 6.3 TESZT 2: Task beküldés - Research típus

```powershell
Write-Host "=== TESZT 2: Research Task Beküldés ===" -ForegroundColor Cyan

$testName = "Research Task Submission"
$workerUrl = "https://bas-orchestrator.workers.dev/task"

$body = @{
    instruction = "Mi a Cloudflare Workers és mire használható?"
    context = @{
        priority = "normal"
        language = "hu"
    }
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri $workerUrl -Method Post -ContentType "application/json" -Body $body -TimeoutSec 60
    $status = "✅ SIKERES"
    $taskId = $response.taskId
    $taskType = $response.type
    $details = $response | ConvertTo-Json -Compress
    Write-Host "$status" -ForegroundColor Green
    Write-Host "Task ID: $taskId"
    Write-Host "Task Type: $taskType"
    
    # Mentsd el a task ID-t későbbi tesztekhez
    $env:BAS_LAST_TASK_ID = $taskId
} catch {
    $status = "❌ SIKERTELEN"
    $details = $_.Exception.Message
    Write-Host "$status - $details" -ForegroundColor Red
}

Add-Content -Path "C:\Projects\bas-cloudflare-orchestrator\TEST_RESULTS.md" -Value @"

### Teszt 2: $testName
- **Eredmény:** $status
- **Instruction:** "Mi a Cloudflare Workers és mire használható?"
- **Válasz:** ``$details``

"@
```

### 6.4 TESZT 3: Task beküldés - Browser típus

```powershell
Write-Host "=== TESZT 3: Browser Task Beküldés ===" -ForegroundColor Cyan

$testName = "Browser Task Submission"
$workerUrl = "https://bas-orchestrator.workers.dev/task"

$body = @{
    instruction = "Nyisd meg a google.com oldalt és keresd meg: Anthropic Claude"
    context = @{
        priority = "high"
        timeout = 60
    }
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri $workerUrl -Method Post -ContentType "application/json" -Body $body -TimeoutSec 60
    $status = "✅ SIKERES"
    $taskId = $response.taskId
    $taskType = $response.type
    Write-Host "$status" -ForegroundColor Green
    Write-Host "Task ID: $taskId"
    Write-Host "Task Type: $taskType (várt: browser)"
    
    if ($taskType -eq "browser") {
        Write-Host "✅ Helyesen osztályozva browser task-ként" -ForegroundColor Green
    } else {
        Write-Host "⚠️ Nem browser-ként osztályozva: $taskType" -ForegroundColor Yellow
    }
} catch {
    $status = "❌ SIKERTELEN"
    $details = $_.Exception.Message
    Write-Host "$status - $details" -ForegroundColor Red
}

Add-Content -Path "C:\Projects\bas-cloudflare-orchestrator\TEST_RESULTS.md" -Value @"

### Teszt 3: $testName
- **Eredmény:** $status
- **Instruction:** "Nyisd meg a google.com oldalt..."
- **Várt típus:** browser
- **Kapott típus:** $taskType

"@
```

### 6.5 TESZT 4: Task beküldés - Code típus

```powershell
Write-Host "=== TESZT 4: Code Task Beküldés ===" -ForegroundColor Cyan

$testName = "Code Task Submission"
$workerUrl = "https://bas-orchestrator.workers.dev/task"

$body = @{
    instruction = "Írj egy Python függvényt ami kiszámolja a Fibonacci sorozat n-edik elemét"
    context = @{
        language = "python"
        style = "clean"
    }
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri $workerUrl -Method Post -ContentType "application/json" -Body $body -TimeoutSec 60
    $status = "✅ SIKERES"
    $taskId = $response.taskId
    $taskType = $response.type
    Write-Host "$status" -ForegroundColor Green
    Write-Host "Task ID: $taskId"
    Write-Host "Task Type: $taskType (várt: code)"
} catch {
    $status = "❌ SIKERTELEN"
    $details = $_.Exception.Message
    Write-Host "$status - $details" -ForegroundColor Red
}

Add-Content -Path "C:\Projects\bas-cloudflare-orchestrator\TEST_RESULTS.md" -Value @"

### Teszt 4: $testName
- **Eredmény:** $status
- **Instruction:** "Írj egy Python függvényt..."
- **Várt típus:** code
- **Kapott típus:** $taskType

"@
```

### 6.6 TESZT 5: Task státusz lekérdezés

```powershell
Write-Host "=== TESZT 5: Task Státusz Lekérdezés ===" -ForegroundColor Cyan

$testName = "Task Status Query"

# Használd az előző tesztből mentett task ID-t
$taskId = $env:BAS_LAST_TASK_ID
if (-not $taskId) {
    $taskId = "bas-test-12345"  # Fallback
}

$statusUrl = "https://bas-orchestrator.workers.dev/status/$taskId"

try {
    $response = Invoke-RestMethod -Uri $statusUrl -Method Get -TimeoutSec 30
    $status = "✅ SIKERES"
    $taskStatus = $response.status
    Write-Host "$status" -ForegroundColor Green
    Write-Host "Task státusz: $taskStatus"
    $response | ConvertTo-Json -Depth 3
} catch {
    if ($_.Exception.Response.StatusCode -eq 404) {
        $status = "⚠️ Task nem található (404)"
        Write-Host $status -ForegroundColor Yellow
    } else {
        $status = "❌ SIKERTELEN"
        Write-Host "$status - $($_.Exception.Message)" -ForegroundColor Red
    }
}

Add-Content -Path "C:\Projects\bas-cloudflare-orchestrator\TEST_RESULTS.md" -Value @"

### Teszt 5: $testName
- **Eredmény:** $status
- **Task ID:** $taskId
- **URL:** $statusUrl

"@
```

### 6.7 TESZT 6: Langflow Research Agent (ha fut)

```powershell
Write-Host "=== TESZT 6: Langflow Research Agent ===" -ForegroundColor Cyan

$testName = "Langflow Research Agent"
$langflowUrl = "http://localhost:7860/api/v1/run/research-agent"

$body = @{
    input_value = "Mi az a Model Context Protocol (MCP)?"
    output_type = "chat"
    input_type = "chat"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri $langflowUrl -Method Post -ContentType "application/json" -Body $body -TimeoutSec 120
    $status = "✅ SIKERES"
    Write-Host "$status" -ForegroundColor Green
    Write-Host "Langflow válasz:"
    $response | ConvertTo-Json -Depth 5
} catch {
    if ($_.Exception.Message -match "Unable to connect") {
        $status = "⚠️ Langflow nem elérhető"
        Write-Host $status -ForegroundColor Yellow
    } else {
        $status = "❌ SIKERTELEN"
        Write-Host "$status - $($_.Exception.Message)" -ForegroundColor Red
    }
}

Add-Content -Path "C:\Projects\bas-cloudflare-orchestrator\TEST_RESULTS.md" -Value @"

### Teszt 6: $testName
- **Eredmény:** $status
- **URL:** $langflowUrl
- **Input:** "Mi az a Model Context Protocol (MCP)?"

"@
```

### 6.8 TESZT 7: Browser-Use API direkt teszt

```powershell
Write-Host "=== TESZT 7: Browser-Use API Direkt Teszt ===" -ForegroundColor Cyan

$testName = "Browser-Use API Direct Test"
$browserUseUrl = "http://localhost:8000/api/task"

$body = @{
    taskId = "test-$(Get-Date -Format 'yyyyMMddHHmmss')"
    type = "browser"
    payload = @{
        instruction = "Teszt feladat - csak health check"
    }
    callbackUrl = "https://bas-orchestrator.workers.dev/webhook/browser-use"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri $browserUseUrl -Method Post -ContentType "application/json" -Body $body -TimeoutSec 30
    $status = "✅ SIKERES"
    Write-Host "$status" -ForegroundColor Green
    $response | ConvertTo-Json
} catch {
    if ($_.Exception.Message -match "Unable to connect") {
        $status = "⚠️ Browser-Use API nem elérhető"
        Write-Host $status -ForegroundColor Yellow
    } else {
        $status = "❌ SIKERTELEN"
        Write-Host "$status - $($_.Exception.Message)" -ForegroundColor Red
    }
}

Add-Content -Path "C:\Projects\bas-cloudflare-orchestrator\TEST_RESULTS.md" -Value @"

### Teszt 7: $testName
- **Eredmény:** $status
- **URL:** $browserUseUrl

"@
```

---

## FÁZIS 7: ÖSSZEFOGLALÓ JELENTÉS

### 7.1 Szolgáltatások végső állapota

```powershell
Write-Host "=== Végső Állapot Ellenőrzés ===" -ForegroundColor Cyan

$services = @(
    @{Name="Ollama"; Port=11434; Url="http://localhost:11434"},
    @{Name="Langflow"; Port=7860; Url="http://localhost:7860"},
    @{Name="n8n"; Port=5678; Url="http://localhost:5678"},
    @{Name="Browser-Use API"; Port=8000; Url="http://localhost:8000"}
)

$statusTable = @()

foreach ($service in $services) {
    $running = Test-NetConnection -ComputerName localhost -Port $service.Port -WarningAction SilentlyContinue
    $status = if ($running.TcpTestSucceeded) { "✅ FUT" } else { "❌ NEM FUT" }
    Write-Host "$($service.Name): $status"
    $statusTable += "| $($service.Name) | $($service.Port) | $status |"
}

# Cloudflare Worker (külön ellenőrzés)
try {
    $null = Invoke-RestMethod -Uri "https://bas-orchestrator.workers.dev" -Method Get -TimeoutSec 10
    $cfStatus = "✅ FUT"
} catch {
    $cfStatus = "❌ NEM ELÉRHETŐ"
}
Write-Host "Cloudflare Worker: $cfStatus"
```

### 7.2 Jelentés véglegesítése

```powershell
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

Add-Content -Path "C:\Projects\bas-cloudflare-orchestrator\TEST_RESULTS.md" -Value @"

---

## Összefoglaló

**Tesztelés befejezve:** $timestamp

### Szolgáltatások Végső Állapota

| Szolgáltatás | Állapot |
|--------------|---------|
| Cloudflare Worker | $cfStatus |
| Ollama | $(if((Test-NetConnection localhost -Port 11434 -WarningAction SilentlyContinue).TcpTestSucceeded){"✅ FUT"}else{"❌"}) |
| Langflow | $(if((Test-NetConnection localhost -Port 7860 -WarningAction SilentlyContinue).TcpTestSucceeded){"✅ FUT"}else{"❌"}) |
| n8n | $(if((Test-NetConnection localhost -Port 5678 -WarningAction SilentlyContinue).TcpTestSucceeded){"✅ FUT"}else{"❌"}) |
| Browser-Use API | $(if((Test-NetConnection localhost -Port 8000 -WarningAction SilentlyContinue).TcpTestSucceeded){"✅ FUT"}else{"❌"}) |

### Következő Lépések

1. [ ] Langflow flow-k finomhangolása
2. [ ] n8n workflow aktiválása és tesztelése
3. [ ] End-to-end integráció validálása
4. [ ] Production URL-ek beállítása

---

*Generálta: Gemini CLI Agent*
"@

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  TESZTELÉS BEFEJEZVE!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Eredmények elmentve:" -ForegroundColor Cyan
Write-Host "C:\Projects\bas-cloudflare-orchestrator\TEST_RESULTS.md" -ForegroundColor White
Write-Host ""
Write-Host "Nyisd meg a fájlt a részletes eredményekért." -ForegroundColor Yellow
```

---

## 🆘 HIBAELHÁRÍTÁS

Ha bármelyik lépésnél hiba történik, próbáld ezeket:

### Ollama nem válaszol
```powershell
# Indítsd újra az Ollama-t
taskkill /IM ollama.exe /F
Start-Process ollama -ArgumentList "serve"
Start-Sleep -Seconds 10
```

### Langflow nem indul
```powershell
# Töröld a cache-t
Remove-Item -Recurse -Force "$env:USERPROFILE\.cache\langflow" -ErrorAction SilentlyContinue
# Indítsd újra
langflow run --host 0.0.0.0 --port 7860
```

### Cloudflare deploy sikertelen
```powershell
# Ellenőrizd a bejelentkezést
npx wrangler whoami
# Ha nincs bejelentkezve:
npx wrangler login
```

### Port foglalt
```powershell
# Keresd meg mi foglalja a portot
netstat -ano | findstr ":7860"
# Öld meg a folyamatot
taskkill /PID <PID> /F
```

---

## ✅ ELLENŐRZŐLISTA

Mielőtt befejezed, győződj meg róla:

- [ ] Cloudflare Worker deployolva és elérhető
- [ ] KV namespace létrehozva és konfigurálva
- [ ] Langflow fut és a flow-k importálva
- [ ] n8n fut és a workflow aktiválva
- [ ] Browser-Use API fut
- [ ] Ollama fut és a modell elérhető
- [ ] Legalább egy sikeres end-to-end teszt
- [ ] TEST_RESULTS.md kitöltve

---

**Készen állsz! Kezd a FÁZIS 0-val és haladj végig minden lépésen.**
