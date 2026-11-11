@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0update_windows.ps1" %*
if errorlevel 1 (
  echo.
  echo Update failed. Read the message above; your projects were not changed.
  pause
  exit /b 1
)
