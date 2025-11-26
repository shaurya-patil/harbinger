@echo off
echo Restarting all Jarvis agents...

REM Kill any existing node processes
taskkill /F /IM node.exe 2>nul
timeout /t 1 /nobreak >nul

echo Starting agents in background...

REM Start agents silently
start /B node agents/calendar-agent-node/index.js >nul 2>&1
timeout /t 2 /nobreak >nul

start /B node agents/gmail-agent-node/index.js >nul 2>&1
timeout /t 2 /nobreak >nul

start /B node agents/browser-agent-node/index.js >nul 2>&1
timeout /t 2 /nobreak >nul

start /B node agents/os-agent-node/index.js >nul 2>&1
timeout /t 2 /nobreak >nul

start /B node agents/humanizer-agent-node/index.js >nul 2>&1
timeout /t 2 /nobreak >nul

start /B node agents/coding-interpreter-agent/index.js >nul 2>&1
timeout /t 1 /nobreak >nul
start /B node agents/coding-system-planner-agent/index.js >nul 2>&1
timeout /t 1 /nobreak >nul
start /B node agents/coding-code-gen-agent/index.js >nul 2>&1
timeout /t 1 /nobreak >nul
start /B node agents/coding-execution-agent/index.js >nul 2>&1
timeout /t 1 /nobreak >nul
start /B node agents/coding-debugging-agent/index.js >nul 2>&1
timeout /t 1 /nobreak >nul
start /B node agents/coding-qa-test-agent/index.js >nul 2>&1
timeout /t 1 /nobreak >nul
start /B node agents/coding-reviewer-agent/index.js >nul 2>&1
timeout /t 1 /nobreak >nul
start /B node agents/coding-dependency-agent/index.js >nul 2>&1
timeout /t 1 /nobreak >nul
start /B node agents/coding-documentation-agent/index.js >nul 2>&1
timeout /t 1 /nobreak >nul
start /B node agents/coding-research-agent/index.js >nul 2>&1
timeout /t 1 /nobreak >nul

start /B node agents/memory-agent-node/index.js >nul 2>&1
timeout /t 1 /nobreak >nul

start /B node api-gateway/index.js >nul 2>&1
timeout /t 2 /nobreak >nul

echo.
echo ✓ All agents restarted!
echo.
pause
