const { spawn } = require('child_process');
const path = require('path');

const serverPath = path.join(__dirname, 'mcp-server/index.js');
const server = spawn('node', [serverPath], {
    stdio: ['pipe', 'pipe', 'inherit']
});

let buffer = '';

server.stdout.on('data', (data) => {
    const chunk = data.toString();
    buffer += chunk;

    const lines = buffer.split('\n');
    buffer = lines.pop();

    for (const line of lines) {
        if (!line.trim()) continue;

        try {
            const message = JSON.parse(line);
            if (message.id === 2) {
                console.log('Result:', JSON.stringify(message, null, 2));
                process.exit(0);
            }
        } catch (e) {
            // ignore
        }
    }
});

// Initialize
server.stdin.write(JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "test", version: "1" } }
}) + '\n');

server.stdin.write(JSON.stringify({
    jsonrpc: "2.0",
    method: "notifications/initialized"
}) + '\n');

// Call Tool: os_open_folder
console.log('Calling os_open_folder...');
server.stdin.write(JSON.stringify({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: {
        name: "os_open_folder",
        arguments: {
            path: "C:\\Users\\shaur\\OneDrive\\Desktop\\DL_Projects\\Agentic AI\\harbinger"
        }
    }
}) + '\n');
