@echo off
echo Starting all Jarvis agents silently...

REM Kill any existing node processes
taskkill /F /IM node.exe 2>nul
timeout /t 1 /nobreak >nul

REM Start agents in background without windows
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

start /B node agents/excel-agent-node/index.js >nul 2>&1
timeout /t 1 /nobreak >nul

start /B node api-gateway/index.js >nul 2>&1
timeout /t 2 /nobreak >nul

echo.
echo ✓ All agents started in background!
echo.
echo Agent Status:
echo - Calendar Agent: localhost:50051
echo - Gmail Agent:    localhost:50052
echo - Browser Agent:  localhost:50053
echo - OS Agent:       localhost:50054
echo - Humanizer Agent: localhost:50055
echo - Memory Agent:    localhost:50066
echo - Excel Agent:     localhost:50067
echo - API Gateway:     http://localhost:3000
echo.
echo To stop agents, run: stop-agents.bat
pause
