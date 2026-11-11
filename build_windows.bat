@echo off
setlocal EnableExtensions
cd /d "%~dp0"

where node.exe >nul 2>nul || (echo ERROR: Install 64-bit Node.js 22 or newer. & exit /b 1)
where npm.cmd >nul 2>nul || (echo ERROR: npm was not found. Reinstall Node.js with npm. & exit /b 1)
for /f %%A in ('node -p "process.arch"') do set "NODE_ARCH=%%A"
if /i not "%NODE_ARCH%"=="x64" (echo ERROR: This bundled runtime requires 64-bit x64 Node.js. & exit /b 1)
if defined WINDOWS_CERTIFICATE_FILE if not defined WINDOWS_CERTIFICATE_PASSWORD (echo ERROR: WINDOWS_CERTIFICATE_PASSWORD is required when signing. & exit /b 1)
if defined WINDOWS_CERTIFICATE_PASSWORD if not defined WINDOWS_CERTIFICATE_FILE (echo ERROR: WINDOWS_CERTIFICATE_FILE is required when signing. & exit /b 1)

echo [1/6] Installing the locked Node dependencies...
call npm ci || goto :failed

echo [2/6] Checking TypeScript and domain behavior...
call npm run typecheck || goto :failed
call npm run check || goto :failed

echo [3/6] Verifying the bundled Windows runtime...
set "RUNTIME=%CD%\runtime\win32-x64"
"%RUNTIME%\ffmpeg.exe" -version >nul 2>nul || goto :runtime_failed
"%RUNTIME%\ffprobe.exe" -version >nul 2>nul || goto :runtime_failed
"%RUNTIME%\yt-dlp.exe" --version >nul 2>nul || goto :runtime_failed
set "PATH=%RUNTIME%\Lib\site-packages\vapoursynth;%RUNTIME%;%PATH%"
set "PYTHONHOME=%RUNTIME%"
set "PYTHONPATH=%RUNTIME%\Lib\site-packages"
"%RUNTIME%\Lib\site-packages\vapoursynth\vspipe.exe" --info scripts\runtime-probe.vpy - >nul 2>nul || goto :runtime_failed

echo [4/6] Removing previous build output...
if exist "out" rmdir /s /q "out"
if exist "dist" rmdir /s /q "dist"

echo [5/6] Building the Windows installer...
call npm run make || goto :failed

echo [6/6] Creating the distribution folder and checksums...
mkdir "dist" || goto :failed
copy /y "out\make\squirrel.windows\x64\*" "dist\" >nul || goto :failed
move /y "dist\LQsCuttingFloorSetup.exe" "dist\LQ's Cutting Floor.exe" >nul || goto :failed
copy /y "README_WINDOWS.txt" "dist\" >nul || goto :failed
copy /y "README_FIRST_USE.txt" "dist\" >nul || goto :failed
copy /y "CHANGELOG.md" "dist\" >nul || goto :failed
copy /y "update_windows.ps1" "dist\" >nul || goto :failed
copy /y "update_windows.bat" "dist\" >nul || goto :failed
node -e "const fs=require('node:fs'),c=require('node:crypto'),p='dist/';const files=fs.readdirSync(p).filter(x=>x!=='SHA256SUMS.txt');fs.writeFileSync(p+'SHA256SUMS.txt',files.map(x=>c.createHash('sha256').update(fs.readFileSync(p+x)).digest('hex').toUpperCase()+'  '+x).join('\r\n')+'\r\n')" || goto :failed

echo.
echo Build complete: %CD%\dist\LQ's Cutting Floor.exe
exit /b 0

:runtime_failed
echo ERROR: The bundled FFmpeg, FFprobe, yt-dlp, VSPipe, or VapourSynth plugin probe failed.
exit /b 1

:failed
echo ERROR: Windows build failed. Review the command output above.
exit /b 1
