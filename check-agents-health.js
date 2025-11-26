const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');
require('dotenv').config();

// Load proto
const PROTO_PATH = path.join(__dirname, 'libs/proto/task.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
});
const taskProto = grpc.loadPackageDefinition(packageDefinition).jarvis;

const agents = {
    calendar: { port: 50051 },
    gmail: { port: 50052 },
    browser: { port: 50053 },
    os: { port: 50054 },
    humanizer: { port: 50055 },
    interpreter: { port: 50056 },
    planner: { port: 50057 },
    codegen: { port: 50058 },
    execution: { port: 50059 },
    debugger: { port: 50060 },
    qa: { port: 50061 },
    reviewer: { port: 50062 },
    dependency: { port: 50063 },
    docs: { port: 50064 },
    research: { port: 50065 },
    memory: { port: 50066 },
    excel: { port: 50067 }
};

async function checkAgent(name, port) {
    return new Promise((resolve) => {
        const client = new taskProto.Agent(`localhost:${port}`, grpc.credentials.createInsecure());
        const deadline = new Date();
        deadline.setSeconds(deadline.getSeconds() + 2); // 2 second timeout

        client.waitForReady(deadline, (err) => {
            if (err) {
                resolve({ name, status: 'DOWN', error: err.message });
                return;
            }

            client.HealthCheck({}, (err, response) => {
                if (err) {
                    resolve({ name, status: 'ERROR', error: err.message });
                } else {
                    resolve({ name, status: 'UP', capabilities: response.capabilities });
                }
            });
        });
    });
}

async function main() {
    console.log('Checking agent connections...\n');
    console.log('Agent'.padEnd(15) + 'Status'.padEnd(10) + 'Port'.padEnd(10) + 'Details');
    console.log('-'.repeat(60));

    const results = [];
    for (const [name, config] of Object.entries(agents)) {
        const result = await checkAgent(name, config.port);
        results.push(result);

        let details = '';
        if (result.status === 'UP') {
            details = `Capabilities: ${result.capabilities ? result.capabilities.join(', ') : 'None'}`;
        } else {
            details = result.error ? `Error: ${result.error}` : '';
        }

        console.log(
            name.padEnd(15) +
            result.status.padEnd(10) +
            config.port.toString().padEnd(10) +
            details
        );
    }
}

main().catch(console.error);
