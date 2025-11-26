const { exec } = require('child_process');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const command = "Say hello";
const safeCommand = command.replace(/"/g, '\\"');
const execCommand = `node orchestrator/index.js "${safeCommand}"`;

console.log(`[Test] Project Root: ${projectRoot}`);
console.log(`[Test] Executing: ${execCommand}`);

exec(execCommand, { cwd: projectRoot }, (error, stdout, stderr) => {
    if (error) {
        console.error(`[Error]: ${error.message}`);
        return;
    }
    if (stderr) {
        console.error(`[Stderr]: ${stderr}`);
    }
    console.log(`[Output]:\n${stdout}`);
});
