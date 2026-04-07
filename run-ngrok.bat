@echo off
title Earth Survival - ngrok Tunnel

cd /d "%~dp0"

cls
echo.
echo ================================================
echo    Earth Survival - ngrok Tunnel
echo ================================================
echo.

:: Check ngrok
where ngrok >nul 2>&1
if errorlevel 1 (
    echo [ERROR] ngrok not found!
    echo.
    echo Please download from: https://ngrok.com/download
    echo Then extract ngrok.exe to this folder or add to PATH
    echo.
    pause
    exit /b 1
)

:: Check if ngrok is configured
echo [INFO] Checking ngrok configuration...
ngrok config check 2>&1 | findstr /C:"Authtoken" >nul
if errorlevel 1 (
    echo.
    echo [WARNING] ngrok not configured yet!
    echo.
    echo Step 1: Sign up at https://ngrok.com (free)
    echo Step 2: Get token from: https://dashboard.ngrok.com/get-started/your-authtoken
    echo Step 3: Run this command:
    echo.
    echo         ngrok config add-authtoken YOUR_TOKEN_HERE
    echo.
    pause
    exit /b 1
)

echo [OK] ngrok is configured!

if not exist "node_modules" (
    echo [INFO] Installing dependencies...
    call pnpm install
)

echo [INFO] Building...
call pnpm run build
if errorlevel 1 (
    echo [ERROR] Build failed
    pause
    exit /b 1
)

:: Kill existing processes
taskkill /F /IM node.exe >nul 2>&1
taskkill /F /IM ngrok.exe >nul 2>&1
timeout /t 1 /nobreak >nul

echo [INFO] Starting server on port 5000...
start /b node server/index.js

timeout /t 2 /nobreak >nul

echo.
echo ================================================
echo   Server is running!
echo   Local: http://localhost:5000
echo ================================================
echo.
echo [INFO] Starting ngrok tunnel...
echo [INFO] Look for "Forwarding" line below:
echo.

:: Run ngrok in foreground so we can see the URL
ngrok http 5000
