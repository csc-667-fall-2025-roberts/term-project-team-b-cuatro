@echo off
echo Killing existing node processes (if any)...
taskkill /IM node.exe /F >nul 2>&1

cd /d "%~dp0"
echo Starting dev server...
call npm run dev
pause
