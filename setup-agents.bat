@echo off
echo Installing dependencies for all agents...

cd agents/coding-interpreter-agent && call npm install && cd ../..
cd agents/coding-system-planner-agent && call npm install && cd ../..
cd agents/coding-code-gen-agent && call npm install && cd ../..
cd agents/coding-execution-agent && call npm install && cd ../..
cd agents/coding-debugging-agent && call npm install && cd ../..
cd agents/coding-qa-test-agent && call npm install && cd ../..
cd agents/coding-reviewer-agent && call npm install && cd ../..
cd agents/coding-dependency-agent && call npm install && cd ../..
cd agents/coding-documentation-agent && call npm install && cd ../..
cd agents/coding-research-agent && call npm install && cd ../..
cd agents/excel-agent-node && call npm install && cd ../..

echo Done installing dependencies.
pause
