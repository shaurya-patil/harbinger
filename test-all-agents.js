const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

const PROTO_PATH = path.join(__dirname, 'libs/proto/task.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
});
const taskProto = grpc.loadPackageDefinition(packageDefinition).jarvis;

const agents = [
    { name: 'Calendar', port: 50051 },
    { name: 'Gmail', port: 50052 },
    { name: 'Browser', port: 50053 },
    { name: 'OS', port: 50054 },
    { name: 'Humanizer', port: 50055 },
    { name: 'Interpreter', port: 50056 },
    { name: 'System Planner', port: 50057 },
    { name: 'Code Gen', port: 50058 },
    { name: 'Execution', port: 50059 },
    { name: 'Debugging', port: 50060 },
    { name: 'QA/Test', port: 50061 },
    { name: 'Reviewer', port: 50062 },
    { name: 'Dependency', port: 50063 },
    { name: 'Documentation', port: 50064 },
    { name: 'Research', port: 50065 },
    { name: 'Memory', port: 50066 },
    { name: 'Excel', port: 50067 }
];

async function checkAgent(agent) {
    return new Promise((resolve) => {
        const client = new taskProto.Agent(`localhost:${agent.port}`, grpc.credentials.createInsecure());
        const deadline = new Date();
        deadline.setSeconds(deadline.getSeconds() + 2);

        client.waitForReady(deadline, (err) => {
            if (err) {
                console.log(`[FAIL] ${agent.name} Agent (Port ${agent.port}) is NOT reachable.`);
                resolve(false);
            } else {
                client.HealthCheck({}, (err, response) => {
                    if (err) {
                        console.log(`[FAIL] ${agent.name} Agent (Port ${agent.port}) HealthCheck failed: ${err.message}`);
                        resolve(false);
                    } else {
                        console.log(`[OK] ${agent.name} Agent (Port ${agent.port}) is running. Capabilities: ${response.capabilities.join(', ')}`);
                        resolve(true);
                    }
                });
            }
        });
    });
}

async function main() {
    console.log('--- Verifying All Agents ---');
    const results = await Promise.all(agents.map(checkAgent));
    const successCount = results.filter(r => r).length;
    console.log(`\nSummary: ${successCount}/${agents.length} agents are running.`);
}

main();
