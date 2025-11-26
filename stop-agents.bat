@echo off
echo Stopping all Jarvis agents...
taskkill /F /IM node.exe 2>nul
if %errorlevel% == 0 (
    echo All agents stopped.
) else (
    echo No agents were running.
)
pause
