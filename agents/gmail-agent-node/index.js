const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const nodemailer = require('nodemailer');

const PROTO_PATH = path.join(__dirname, '../../libs/proto/task.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
});
const taskProto = grpc.loadPackageDefinition(packageDefinition).jarvis;

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

const imap = require('imap-simple');

async function executeTask(call, callback) {
    const task = call.request;
    const params = task.payload ? JSON.parse(task.payload.toString()) : {};
    const userId = params.userId || 'default';

    console.log(`[Gmail Agent] Received task: ${task.id} - ${task.type}`);
    // Sanitized logging
    console.log(`[Gmail Agent] Params:`, { ...params, body: '***REDACTED***', subject: params.subject ? params.subject.substring(0, 20) + '...' : undefined });

    if (task.type === 'gmail.read_emails') {
        try {
            const config = {
                imap: {
                    user: process.env.GMAIL_USER,
                    password: process.env.GMAIL_PASS,
                    host: 'imap.gmail.com',
                    port: 993,
                    tls: true,
                    tlsOptions: { rejectUnauthorized: false },
                    authTimeout: 3000
                }
            };

            const connection = await imap.connect(config);
            await connection.openBox('INBOX');

            const searchCriteria = ['UNSEEN'];
            const fetchOptions = {
                bodies: ['HEADER', 'TEXT'],
                markSeen: false
            };

            const limit = params.limit || 5;
            const messages = await connection.search(searchCriteria, fetchOptions);

            // Sort by date descending and take top N
            messages.sort((a, b) => new Date(b.attributes.date) - new Date(a.attributes.date));
            const recentMessages = messages.slice(0, limit);

            const results = recentMessages.map(item => {
                const header = item.parts.find(p => p.which === 'HEADER');
                const text = item.parts.find(p => p.which === 'TEXT');
                return {
                    from: header.body.from[0],
                    subject: header.body.subject[0],
                    date: header.body.date[0],
                    body: text.body.substring(0, 200) + '...' // Preview
                };
            });

            connection.end();

            console.log(`[Gmail Agent] Retrieved ${results.length} emails`);
            callback(null, {
                id: task.id,
                status: "success",
                result: JSON.stringify(results)
            });

        } catch (error) {
            console.error(`[Gmail Agent] Failed to read emails:`, error);
            callback(null, {
                id: task.id,
                status: "fail",
                error_message: error.message
            });
        }
    } else if (task.type === 'gmail.send_email') {
        try {
            let recipient = params.to;

            // Check if recipient is a valid email
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(recipient)) {
                console.log(`[Gmail Agent] '${recipient}' is not a valid email. Searching memory...`);

                // 1. Try exact alias match first
                const alias = await memoryService.resolveAlias(recipient);
                if (alias) {
                    recipient = alias.description; // Assuming description holds the email for aliases
                    console.log(`[Gmail Agent] Resolved alias '${params.to}' to '${recipient}'`);
                } else {
                    // 2. Search memory for "email" and the name
                    const memories = await memoryService.searchMemory(userId, recipient);

                    // Simple heuristic: look for an email in the memory value or context
                    const foundEmail = memories.find(m => {
                        const val = typeof m.memory_value === 'string' ? m.memory_value : JSON.stringify(m.memory_value);
                        return emailRegex.test(val.replace(/"/g, ''));
                    });

                    if (foundEmail) {
                        recipient = (typeof foundEmail.memory_value === 'string' ? foundEmail.memory_value : JSON.stringify(foundEmail.memory_value)).replace(/"/g, '');
                        console.log(`[Gmail Agent] Found email in memory for '${params.to}': '${recipient}'`);
                    } else {
                        console.log(`[Gmail Agent] Could not resolve email for '${recipient}' from memory.`);
                    }
                }
            }

            const mailOptions = {
                from: process.env.GMAIL_USER,
                to: recipient,
                subject: params.subject,
                text: params.body
            };

            if (params.ical) {
                try {
                    console.log('[Gmail Agent] Generating ICS invite...', params.ical);
                    const calendar = ical({ name: 'Meeting' });
                    const startTime = new Date(params.ical.start || Date.now());
                    const endTime = new Date(params.ical.end || startTime.getTime() + 3600000);

                    calendar.createEvent({
                        start: startTime,
                        end: endTime,
                        summary: params.ical.summary || params.subject,
                        description: params.body,
                        location: params.ical.location
                    });

                    mailOptions.icalEvent = {
                        filename: 'invite.ics',
                        method: 'request',
                        content: calendar.toString()
                    };
                    console.log(`[Gmail Agent] Generated ICS content:`, calendar.toString());
                    console.log(`[Gmail Agent] Attached ICS invite: ${params.ical.summary}`);
                } catch (icalError) {
                    console.error('[Gmail Agent] Failed to generate ICS:', icalError);
                }
            }

            const info = await transporter.sendMail(mailOptions);
            console.log(`[Gmail Agent] Email sent: ${info.messageId}`);
            callback(null, {
                id: task.id,
                status: "success",
                result_uri: `email://${info.messageId}`
            });
        } catch (error) {
            console.error(`[Gmail Agent] Failed to send email:`, error);
            callback(null, {
                id: task.id,
                status: "fail",
                error_message: error.message
            });
        }
    } else {
        callback(null, {
            id: task.id,
            status: "fail",
            error_message: "Unknown task type"
        });
    }
}

function healthCheck(call, callback) {
    callback(null, {
        status: "ok",
        capabilities: ["gmail.send_email"]
    });
}

function main() {
    const server = new grpc.Server();
    server.addService(taskProto.Agent.service, {
        ExecuteTask: executeTask,
        HealthCheck: healthCheck
    });

    const address = '0.0.0.0:50052'; // Port 50052 for Gmail Agent
    server.bindAsync(address, grpc.ServerCredentials.createInsecure(), () => {
        console.log(`[Gmail Agent] Server running at ${address}`);
        server.start();
    });
}

main();
