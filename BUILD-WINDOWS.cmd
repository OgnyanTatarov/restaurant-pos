@echo off
cd /d "%~dp0"
call npm ci
if errorlevel 1 goto failed
call npm run dist:win
if errorlevel 1 goto failed
echo Installer created in the release folder.
pause
exit /b 0
:failed
echo Build failed. Read the error above.
pause
exit /b 1
