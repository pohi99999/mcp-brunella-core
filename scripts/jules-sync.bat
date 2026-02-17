@echo off
:: Jules Auto-Sync Manual Trigger
:: Lehuzza Jules branch-eket es LLM dontese alapjan auto-merge

echo ========================================
echo Jules Auto-Sync ^& Auto-Merge
echo ========================================
echo.

call .venv\Scripts\python.exe myai\tools\jules_auto_sync.py

echo.
echo ========================================
echo Kesz!
echo ========================================
pause
