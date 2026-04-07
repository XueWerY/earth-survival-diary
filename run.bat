@echo off
title Earth Survival Diary

cd /d "%~dp0"

cls
echo.
echo ================================================
echo    Earth Survival Diary
echo ================================================
echo.

node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js not found
    echo Please install from: https://nodejs.org/
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo [INFO] Installing dependencies...
    call pnpm install
)

taskkill /F /IM node.exe >nul 2>&1
timeout /t 1 /nobreak >nul

echo [INFO] Starting server...
echo.
echo ================================================
echo   Local: http://localhost:5000
echo   Network: http://YOUR_IP:5000
echo ================================================
echo.

call pnpm run dev:all

pause
