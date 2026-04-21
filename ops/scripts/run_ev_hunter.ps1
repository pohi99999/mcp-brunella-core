# EV Hunter Runner Script
$pythonPath = "f:\mcp-brunella-core\agentenv\Scripts\python.exe"
$scriptPath = "f:\mcp-brunella-core\external_research\ev_hunter_bot\ev_hunter_bot.py"

Write-Host "Running EV Hunter in background..."
Start-Process $pythonPath -ArgumentList $scriptPath -WindowStyle Hidden
Write-Host "EV Hunter started! Check logs or email for output."
