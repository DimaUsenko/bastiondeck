@echo off
setlocal enabledelayedexpansion

set "REPO=DimaUsenko/bastiondeck"
set "INSTALL_ROOT=%LOCALAPPDATA%\BastionDeck"
set "APP_DIR=%INSTALL_ROOT%\app"
set "BIN_DIR=%INSTALL_ROOT%\bin"
set "ZIP_FILE=%TEMP%\bastiondeck-windows.zip"
set "DOWNLOAD_URL=https://github.com/%REPO%/releases/latest/download/bastiondeck-windows.zip"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 22 or newer is required.
  echo Install it from https://nodejs.org/ and run this installer again.
  exit /b 1
)

where curl >nul 2>nul
if errorlevel 1 (
  echo curl.exe is required and should be available on modern Windows.
  exit /b 1
)

echo Downloading BastionDeck from %DOWNLOAD_URL%
curl.exe -L -o "%ZIP_FILE%" "%DOWNLOAD_URL%"
if errorlevel 1 exit /b 1

if exist "%APP_DIR%" rmdir /s /q "%APP_DIR%"
mkdir "%APP_DIR%" "%BIN_DIR%" >nul 2>nul

powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -Path '%ZIP_FILE%' -DestinationPath '%APP_DIR%' -Force"
if errorlevel 1 exit /b 1

echo Installing runtime dependencies...
pushd "%APP_DIR%"
call npm ci --omit=dev
if errorlevel 1 exit /b 1
popd

> "%BIN_DIR%\bastiondeck.cmd" echo @echo off
>> "%BIN_DIR%\bastiondeck.cmd" echo node "%%LOCALAPPDATA%%\BastionDeck\app\bin\bastiondeck.mjs" %%*

echo %PATH% | find /I "%BIN_DIR%" >nul
if errorlevel 1 (
  echo Adding %BIN_DIR% to the user PATH.
  powershell -NoProfile -ExecutionPolicy Bypass -Command "$bin='%BIN_DIR%'; $path=[Environment]::GetEnvironmentVariable('Path','User'); if (-not $path) { $path='' }; $parts=$path -split ';' | Where-Object { $_ }; if ($parts -notcontains $bin) { [Environment]::SetEnvironmentVariable('Path', (($parts + $bin) -join ';'), 'User') }"
)

echo.
echo BastionDeck installed.
echo Run in a new cmd window:
echo   bastiondeck
echo.
echo Settings are stored in %%USERPROFILE%%\.bastiondeck and survive uninstall/reinstall.
