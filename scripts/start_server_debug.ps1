$env:PYTHONPATH = "F:\mcp-brunella-core"
Set-Location "F:\mcp-brunella-core"
& .\.venv\Scripts\python.exe -m uvicorn myai.server:app --reload --port 8000 > server_final.log 2>&1
