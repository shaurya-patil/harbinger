const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const PROTO_PATH = path.join(__dirname, '../../libs/proto/task.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
});
const taskProto = grpc.loadPackageDefinition(packageDefinition).jarvis;

async function manageDependency(command, pkg, cwd, manager = 'npm') {
    let cmd = '';
    if (manager === 'npm') {
        if (command === 'install') {
            cmd = `npm install ${pkg}`;
        } else if (command === 'uninstall') {
            cmd = `npm uninstall ${pkg}`;
        }
    } else if (manager === 'pip') {
        if (command === 'install') {
            cmd = `pip install ${pkg}`;
        } else if (command === 'uninstall') {
            cmd = `pip uninstall ${pkg}`;
        }
    } else {
        throw new Error(`Unknown package manager: ${manager}`);
    }

    if (!cmd) throw new Error(`Unknown command: ${command}`);

    console.log(`[Dependency Agent] Running: ${cmd} in ${cwd || '.'}`);
    try {
        const { stdout, stderr } = await execAsync(cmd, { cwd });
        return { stdout, stderr, exitCode: 0 };
    } catch (error) {
        return { stdout: error.stdout, stderr: error.stderr, exitCode: error.code || 1 };
    }
}

async function executeTask(call, callback) {
    const task = call.request;
    const params = task.payload ? JSON.parse(task.payload.toString()) : {};
    console.log(`[Dependency Agent] Task ${task.id}: ${task.type}`);

    if (task.type === 'dependency.manage') {
        try {
            const result = await manageDependency(params.command, params.package, params.cwd, params.manager);
            callback(null, {
                id: task.id,
                status: result.exitCode === 0 ? "success" : "fail",
                result_uri: `dependency://${task.id}/output`,
                result_data: JSON.stringify(result)
            });
        } catch (error) {
            callback(null, { id: task.id, status: "fail", error_message: error.message });
        }
    } else {
        callback(null, { id: task.id, status: "fail", error_message: "Unknown task type" });
    }
}

function healthCheck(call, callback) {
    callback(null, { status: "ok", capabilities: ["dependency.manage"] });
}

function main() {
    const server = new grpc.Server();
    server.addService(taskProto.Agent.service, { ExecuteTask: executeTask, HealthCheck: healthCheck });
    const address = '127.0.0.1:50063';
    server.bindAsync(address, grpc.ServerCredentials.createInsecure(), () => {
        console.log(`[Dependency Agent] Server running at ${address}`);
        server.start();
    });
}
main();
