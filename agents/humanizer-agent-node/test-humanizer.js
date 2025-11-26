const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

const PROTO_PATH = path.join(__dirname, '../../libs/proto/task.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
});
const taskProto = grpc.loadPackageDefinition(packageDefinition).jarvis;

function main() {
    const client = new taskProto.Agent('localhost:50055', grpc.credentials.createInsecure());

    const task = {
        id: 'test-task-1',
        type: 'humanizer.humanize_content',
        payload: Buffer.from(JSON.stringify({
            content: "The system is functioning within normal parameters. Efficiency is at 100%."
        }))
    };

    console.log('Sending task:', task);

    client.ExecuteTask(task, (err, response) => {
        if (err) {
            console.error('Error:', err);
        } else {
            console.log('Response:', response);
            if (response.result_data) {
                console.log('Result Data:', JSON.parse(response.result_data));
            }
        }
    });
}

main();
