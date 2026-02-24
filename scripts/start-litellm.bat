@echo off
REM LiteLLM Proxy Startup Script (Windows)
REM Usage: scripts\start-litellm.bat [port]

SET PORT=%1
IF "%PORT%"=="" SET PORT=4000

echo.
echo ================================================
echo   LiteLLM Proxy Startup
echo ================================================
echo   Port: %PORT%
echo   Config: litellm_config.yaml
echo ================================================
echo.

REM Check if litellm is installed
where litellm >nul 2>nul
IF %ERRORLEVEL% NEQ 0 (
    echo [ERROR] LiteLLM not found. Installing...
    pip install "litellm[proxy]"
)

REM Check if config exists
IF NOT EXIST "litellm_config.yaml" (
    echo [ERROR] litellm_config.yaml not found!
    exit /b 1
)

REM Check environment variables
IF "%GITHUB_PAT%"=="" (
    echo [WARN] GITHUB_PAT not set - GitHub Models unavailable
)

IF "%GEMINI_API_KEY%"=="" (
    echo [WARN] GEMINI_API_KEY not set - Gemini unavailable
)

echo.
echo [OK] Starting proxy...
echo    Access: http://localhost:%PORT%
echo    Health: http://localhost:%PORT%/health
echo.

REM Start LiteLLM proxy
litellm --config litellm_config.yaml --port %PORT%
