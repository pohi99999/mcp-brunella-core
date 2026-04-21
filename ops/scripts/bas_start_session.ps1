# Fájl neve: bas_start_session.ps1
# Hely: F:\mcp-brunella-core\Scripts\

Write-Host "🔵 Brunella Agent System (BAS) Inicializálása..." -ForegroundColor Cyan

# 1. MCP Szerverek ellenőrzése (opcionális, ha futnak háttérben)
# Itt hívhatnád meg a node brunella-core indítást

# 2. Chrome indítása a Gemini-vel és a Drive mappával
$chromePath = "${Env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe"
$geminiUrl = "https://gemini.google.com/app"
$driveUrl = "https://drive.google.com/drive/folders/15ArDrVabYPX3bDmFp6uPnDqcGslMkevv"

Start-Process $chromePath -ArgumentList $geminiUrl, $driveUrl

Write-Host "✅ Munkamenet elindítva. A Kibernetikus Csapattárs készen áll." -ForegroundColor Green