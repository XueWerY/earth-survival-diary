@echo off
setlocal EnableDelayedExpansion

echo(
echo ====================================
echo    Earth Survival Diary
echo    Project Startup Script
echo ====================================
echo(

echo [STEP] Checking Node.js environment...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed!
    echo Please download and install Node.js from https://nodejs.org/
    echo Recommended version: v18.0.0 or higher
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo [SUCCESS] Node.js version: !NODE_VERSION!

set NODE_VERSION_NO_V=!NODE_VERSION:v=!
for /f "tokens=1,2,3 delims=." %%a in ("!NODE_VERSION_NO_V!") do (
    set NODE_MAJOR=%%a
    set NODE_MINOR=%%b
    set NODE_PATCH=%%c
)

set REQ_MAJOR=18
set REQ_MINOR=0
set REQ_PATCH=0

set VERSION_OK=0
if !NODE_MAJOR! GTR !REQ_MAJOR! (
    set VERSION_OK=1
) else if !NODE_MAJOR! EQU !REQ_MAJOR! (
    if !NODE_MINOR! GTR !REQ_MINOR! (
        set VERSION_OK=1
    ) else if !NODE_MINOR! EQU !REQ_MINOR! (
        if !NODE_PATCH! GEQ !REQ_PATCH! (
            set VERSION_OK=1
        )
    )
)

if !VERSION_OK! EQU 0 (
    echo [ERROR] Node.js version is too old! Current: !NODE_VERSION!
    echo Required: v18.0.0 or higher
    echo Please upgrade Node.js: https://nodejs.org/
    pause
    exit /b 1
)

echo [STEP] Checking pnpm package manager...
where pnpm >nul 2>&1
if !errorlevel! neq 0 (
    echo [WARN] pnpm not found, trying to install with npm...
    npm install -g pnpm
    if !errorlevel! neq 0 (
        echo [ERROR] Failed to install pnpm!
        echo Please install manually: npm install -g pnpm
        pause
        exit /b 1
    )
    echo [SUCCESS] pnpm installed successfully!
)

echo [SUCCESS] pnpm is available

echo [STEP] Checking project dependencies...
if not exist "node_modules" (
    echo [WARN] node_modules directory not found
    echo [INFO] Installing project dependencies...
    call pnpm install
    if !errorlevel! neq 0 (
        echo [ERROR] Failed to install dependencies!
        echo Please check network connection or run manually: pnpm install
        pause
        exit /b 1
    )
    echo [SUCCESS] Dependencies installed successfully!
) else (
    echo [SUCCESS] Dependencies already installed
)

echo(
echo ====================================
echo    Select Startup Mode
echo ====================================
echo(
echo a^) Development Mode
echo b^) Production Mode
echo(

:choice_mode
set /p MODE_CHOICE="Enter option (a/b): "

if /i "!MODE_CHOICE!"=="a" (
    set RUN_MODE=dev
    echo [INFO] Selected: Development Mode
) else if /i "!MODE_CHOICE!"=="b" (
    set RUN_MODE=prod
    echo [INFO] Selected: Production Mode
) else (
    echo [WARN] Invalid option, please try again
    goto choice_mode
)

echo(
set /p TUNNEL_CHOICE="Start tunnel service? (y/n): "

if /i "!TUNNEL_CHOICE!"=="y" (
    set ENABLE_TUNNEL=true
    echo [INFO] Enabled: Tunnel Service
    
    if not exist "ngrok.exe" (
        echo [ERROR] ngrok.exe not found!
        echo Please place ngrok.exe in project root directory
        echo Download: https://ngrok.com/download
        echo(
        set /p CONTINUE="Continue without tunnel? (y/n): "
        if /i "!CONTINUE!"=="y" (
            set ENABLE_TUNNEL=false
        ) else (
            exit /b 1
        )
    )
) else if /i "!TUNNEL_CHOICE!"=="n" (
    set ENABLE_TUNNEL=false
    echo [INFO] Disabled: Tunnel Service
) else (
    echo [WARN] Invalid option, please try again
    goto choice_tunnel
)

echo(
echo ====================================
echo    Starting Project
echo ====================================
echo(

if "!RUN_MODE!"=="dev" (
    echo [STEP] Starting development mode...
    echo(
    echo Note: Development mode starts both frontend and backend
    echo Press Ctrl+C to stop all services
    echo(
    echo [SUCCESS] Starting frontend server...
    start "Frontend Dev" cmd /k "pnpm run dev"
    echo [SUCCESS] Starting backend server...
    start "Backend Server" cmd /k "pnpm run server"
) else if "!RUN_MODE!"=="prod" (
    echo [STEP] Starting production mode...
    echo [INFO] Building project...
    
    call pnpm run build
    if !errorlevel! neq 0 (
        echo [ERROR] Build failed!
        echo Please fix code errors and try again
        pause
        exit /b 1
    )
    
    echo [SUCCESS] Build completed!
    echo(
    echo [INFO] Starting production server...
    start "Production Server" cmd /k "pnpm run start"
)

if "!ENABLE_TUNNEL!"=="true" (
    echo(
    echo [STEP] Starting tunnel service (ngrok^)...
    start "Ngrok Tunnel" cmd /k ".\ngrok.exe http 5000"
    echo [SUCCESS] ngrok tunnel started!
    echo Check ngrok window for public URL
)

echo(
echo ====================================
echo    Startup Complete
echo ====================================
echo(
echo [SUCCESS] Project started successfully!
echo(
echo ====================================
echo   Access URL:
echo   http://localhost:5000/
echo ====================================
echo(
echo   Mode: !RUN_MODE!
echo   Tunnel: !ENABLE_TUNNEL!
echo ====================================
echo(
echo [INFO] Project running in new windows
echo [INFO] Close all service windows to stop project
echo(

start "" "http://localhost:5000/"

exit /b 0
