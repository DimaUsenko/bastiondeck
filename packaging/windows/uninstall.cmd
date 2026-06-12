@echo off
setlocal

set "INSTALL_ROOT=%LOCALAPPDATA%\BastionDeck"

if exist "%INSTALL_ROOT%" (
  rmdir /s /q "%INSTALL_ROOT%"
  echo Removed %INSTALL_ROOT%
) else (
  echo BastionDeck install directory was not found.
)

echo.
echo User settings were intentionally kept in:
echo   %USERPROFILE%\.bastiondeck
echo Delete that folder manually only if you want to reset all saved tunnels and settings.
