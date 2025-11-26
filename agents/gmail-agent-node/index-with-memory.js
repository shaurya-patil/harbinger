const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const nodemailer = require('nodemailer');
const AgentMemoryClient = require('../../libs/agent-memory-client');
const TaskLogger = require('../../libs/task-logger');

const PROTO_PATH = path.join(__dirname, '../../libs/proto/task.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
});
const taskProto = grpc.loadPackageDefinition(packageDefinition).jarvis;

// Initialize memory client and task logger
const memory = new AgentMemoryClient('gmail');
const taskLogger = new TaskLogger(memory, 'gmail');

// Nodemailer Transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS
    }
});

console.log(`[Gmail Agent] Loaded credentials for user: ${process.env.GMAIL_USER ? process.env.GMAIL_USER.substring(0, 3) + '***' : 'undefined'}`);

const ical = require('ical-generator').default;
const memoryService = require('../../libs/memory-service');

async function executeTask(call, callback) {
    const task = call.request;
    const params = task.payload ? JSON.parse(task.payload.toString()) : {};
    const userId = params.userId || 'default';

    console.log(`[Gmail Agent] Received task: ${task.id} - ${task.type}`);
    console.log(`[Gmail Agent] Params:`, params);

    // LOG TASK START
    taskLogger.logTaskStart(task.id, task.type, params);

    if (task.type === 'gmail.send_email') {
        try {
            let recipient = params.to;

            // Check if recipient is a valid email
            const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
            if (!emailRegex.test(recipient)) {
                console.log(`[Gmail Agent] Recipient "${recipient}" is not a valid email. Attempting to resolve from memory...`);

                // UNIFIED MEMORY SEARCH: Check both mainstream and local memory
                const memoryResults = await memory.searchAll(recipient);

                if (memoryResults.length > 0) {
                    const emailResult = memoryResults.find(r =>
                        r.value?.email ||
                        (typeof r.value === 'string' && emailRegex.test(r.value))
                    );

                    if (emailResult) {
                        recipient = emailResult.value?.email || emailResult.value;
                        console.log(`[Gmail Agent] Resolved "${params.to}" to ${recipient} from ${emailResult.source} memory`);
                        memory.storeLocal(`resolved:${params.to}`, recipient);
                    } else {
                        throw new Error(`Could not find email address for "${params.to}" in memory`);
                    }
                } else {
                    const alias = await memoryService.resolveAlias(recipient);
                    if (alias && alias.alias_value) {
                        recipient = alias.alias_value;
                        console.log(`[Gmail Agent] Resolved "${params.to}" to ${recipient} from database`);
                    } else {
                        throw new Error(`Could not resolve recipient "${params.to}" to an email address`);
                    }
                }
            }

            const mailOptions = {
                from: process.env.GMAIL_USER,
                to: recipient,
                subject: params.subject || 'No Subject',
                text: params.body || '',
                html: params.html || undefined
            };

            // Add calendar invite if requested
            if (params.calendar_invite) {
                const calendar = ical({ name: params.calendar_invite.title || 'Event' });
                calendar.createEvent({
                    start: new Date(params.calendar_invite.start),
                    end: new Date(params.calendar_invite.end),
                    summary: params.calendar_invite.title || 'Event',
                    description: params.calendar_invite.description || ''
                });

                mailOptions.icalEvent = {
                    method: 'REQUEST',
                    content: calendar.toString()
                };
            }

            const info = await transporter.sendMail(mailOptions);
            console.log(`[Gmail Agent] Email sent: ${info.messageId}`);

            const result = {
                messageId: info.messageId,
                recipient,
                subject: params.subject,
                sentAt: new Date().toISOString()
            };

            // LOG TASK COMPLETION
            await taskLogger.logTaskComplete(task.id, result);

            callback(null, {
                id: task.id,
                status: 'success',
                result_uri: `mailto:${recipient}`,
                result_data: JSON.stringify(result)
            });
        } catch (error) {
            console.error(`[Gmail Agent] Failed to send email:`, error);

            // LOG TASK FAILURE
            await taskLogger.logTaskComplete(task.id, null, error);

            callback(null, {
                id: task.id,
                status: 'fail',
                error_message: error.message
            });
        }
    } else {
        const error = new Error('Unknown task type');
        await taskLogger.logTaskComplete(task.id, null, error);

        callback(null, {
            id: task.id,
            status: 'fail',
            error_message: 'Unknown task type'
        });
    }
}

function healthCheck(call, callback) {
    const memoryStats = memory.getStats();
    const taskStats = taskLogger.getStats();

    callback(null, {
        status: 'ok',
        capabilities: ['gmail.send_email'],
        metadata: JSON.stringify({
            memory: memoryStats,
            tasks: taskStats
        })
    });
}

function main() {
    const server = new grpc.Server();
    server.addService(taskProto.Agent.service, {
        ExecuteTask: executeTask,
        HealthCheck: healthCheck
    });

    const address = '0.0.0.0:50052';
    server.bindAsync(address, grpc.ServerCredentials.createInsecure(), () => {
        console.log(`[Gmail Agent] Server running at ${address}`);
        console.log(`[Gmail Agent] Memory stats:`, memory.getStats());
        console.log(`[Gmail Agent] Task logger initialized`);
        server.start();
    });
}

main();
