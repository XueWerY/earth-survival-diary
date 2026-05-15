@echo off
chcp 65001 >nul
echo ========================================
echo Earth-Survival-Diary Manual Uninstall
echo ========================================
echo.

echo [1/4] Terminating running processes...
taskkill /F /IM "Earth-Survival-Diary.exe" /T >nul 2>&1
timeout /t 2 /nobreak >nul
taskkill /F /IM "Earth-Survival-Diary.exe" /T >nul 2>&1
timeout /t 2 /nobreak >nul
echo       Done.

echo [2/4] Removing installation directory...
if exist "C:\Program Files\Earth-Survival-Diary" (
    rd /s /q "C:\Program Files\Earth-Survival-Diary" >nul 2>&1
    if exist "C:\Program Files\Earth-Survival-Diary" (
        echo       Warning: Some files could not be deleted.
    ) else (
        echo       Installation directory removed.
    )
) else (
    echo       Installation directory not found, skipping.
)

echo [3/4] Cleaning registry...
reg delete "HKLM\Software\Microsoft\Windows\CurrentVersion\Uninstall\302f4125-b87c-51f8-aebe-24e8fdc371d8" /f >nul 2>&1
reg delete "HKCU\SOFTWARE\Earth-Survival-Diary" /f >nul 2>&1
echo       Registry cleaned.

echo.
echo [4/4] User data cleanup
set "dataDir=%APPDATA%\earth-survival-diary"
if exist "%dataDir%" (
    echo Found user data: %dataDir%
    set /p choice="Delete all user data? (Y/N): "
    if /i "%choice%"=="Y" (
        rd /s /q "%dataDir%" >nul 2>&1
        if exist "%dataDir%" (
            echo       Warning: Some data could not be deleted.
        ) else (
            echo       User data deleted.
        )
    ) else (
        echo       User data preserved.
    )
) else (
    echo       No user data found, skipping.
)

echo.
echo ========================================
echo Uninstall complete!
echo ========================================
echo.
pause
