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
    buffer = lines.pop(); // Keep the last incomplete line

    for (const line of lines) {
        if (!line.trim()) continue;

        try {
            const message = JSON.parse(line);
            console.log('Received:', JSON.stringify(message, null, 2));

            if (message.result && message.result.tools) {
                console.log('Tools listed successfully!');
                console.log('Found tools:', message.result.tools.map(t => t.name).join(', '));

                // We are done
                process.exit(0);
            }
        } catch (e) {
            console.log('Non-JSON output:', line);
        }
    }
});

// Send Initialize Request
const initRequest = {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: {
            name: "test-client",
            version: "1.0.0"
        }
    }
};

console.log('Sending Initialize...');
server.stdin.write(JSON.stringify(initRequest) + '\n');

// Send Initialized Notification
const initializedNotification = {
    jsonrpc: "2.0",
    method: "notifications/initialized"
};
server.stdin.write(JSON.stringify(initializedNotification) + '\n');

// Send List Tools Request
const listToolsRequest = {
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list"
};

console.log('Sending List Tools...');
server.stdin.write(JSON.stringify(listToolsRequest) + '\n');

// Handle exit
server.on('close', (code) => {
    console.log(`Server exited with code ${code}`);
});
