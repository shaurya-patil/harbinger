const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { google } = require('googleapis');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

// Paths
const PROTO_PATH = path.join(__dirname, '../../libs/proto/task.proto');
const CREDENTIALS_PATH = path.join(__dirname, '../../credentials.json');
const TOKEN_PATH = path.join(__dirname, 'token.json');
const SCOPES = ['https://www.googleapis.com/auth/calendar'];

// Load Proto
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
});
const taskProto = grpc.loadPackageDefinition(packageDefinition).jarvis;

// OAuth Client
let oAuth2Client;

function loadCredentials() {
    const content = fs.readFileSync(CREDENTIALS_PATH);
    const credentials = JSON.parse(content);
    const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
    oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
}

function authorize(callback) {
    fs.readFile(TOKEN_PATH, (err, token) => {
        if (err) return getAccessToken(oAuth2Client, callback);
        oAuth2Client.setCredentials(JSON.parse(token));
        callback(oAuth2Client);
    });
}

function getAccessToken(oAuth2Client, callback) {
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
    });
    console.log('Authorize this app by visiting this url:', authUrl);
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    rl.question('Enter the code from that page here: ', (code) => {
        rl.close();
        oAuth2Client.getToken(code, (err, token) => {
            if (err) return console.error('Error retrieving access token', err);
            oAuth2Client.setCredentials(token);
            fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
                if (err) return console.error(err);
                console.log('Token stored to', TOKEN_PATH);
            });
            callback(oAuth2Client);
        });
    });
}

async function createEvent(auth, params) {
    const calendar = google.calendar({ version: 'v3', auth });

    // Parse time (e.g., "tomorrow 3pm") - for MVP we'll just use a fixed time if parsing fails or simple logic
    // In a real app, use a library like chrono-node. For now, let's assume ISO string or simple offset.
    // To keep it robust for the demo, let's default to "tomorrow at 3pm" relative to now if input is vague.

    const event = {
        summary: params.title,
        description: params.description || 'Created by Jarvis',
        start: {
            dateTime: new Date(new Date().setDate(new Date().getDate() + 1)).toISOString(), // Default to tomorrow same time
            timeZone: 'Asia/Kolkata', // Hardcoded for now, can be parameterized
        },
        end: {
            dateTime: new Date(new Date().setDate(new Date().getDate() + 1)).toISOString(), // Default 1 hour duration
            timeZone: 'Asia/Kolkata',
        },
        attendees: params.attendees ? params.attendees.map(email => ({ email })) : [],
    };

    // Simple heuristic for "tomorrow 3pm"
    if (params.time && params.time.includes('tomorrow 3pm')) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(15, 0, 0, 0);
        event.start.dateTime = tomorrow.toISOString();

        const end = new Date(tomorrow);
        end.setHours(16, 0, 0, 0);
        event.end.dateTime = end.toISOString();
    }

    try {
        const res = await calendar.events.insert({
            calendarId: 'primary',
            resource: event,
            sendUpdates: 'all',
        });
        return res.data.htmlLink;
    } catch (err) {
        throw new Error('There was an error contacting the Calendar service: ' + err);
    }
}

function executeTask(call, callback) {
    const task = call.request;
    const params = task.payload ? JSON.parse(task.payload.toString()) : {};
    console.log(`[Calendar Agent] Received task: ${task.id} - ${task.type}`);
    console.log(`[Calendar Agent] Params:`, { ...params, description: '***REDACTED***' });

    if (task.type === 'calendar.create_event') {
        authorize(async (auth) => {
            try {
                const link = await createEvent(auth, params);
                console.log(`[Calendar Agent] Event created: ${link}`);
                callback(null, {
                    id: task.id,
                    status: "success",
                    result_uri: link
                });
            } catch (error) {
                console.error(`[Calendar Agent] Failed to create event:`, error);
                callback(null, {
                    id: task.id,
                    status: "fail",
                    error_message: error.message
                });
            }
        });
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
        capabilities: ["calendar.create_event"]
    });
}

function main() {
    loadCredentials();

    const server = new grpc.Server();
    server.addService(taskProto.Agent.service, {
        ExecuteTask: executeTask,
        HealthCheck: healthCheck
    });

    const address = '0.0.0.0:50051';
    server.bindAsync(address, grpc.ServerCredentials.createInsecure(), () => {
        console.log(`[Calendar Agent] Server running at ${address}`);
        // Check auth on startup to prompt user if needed
        authorize((auth) => {
            console.log('[Calendar Agent] Authenticated with Google Calendar.');
        });
        server.start();
    });
}

main();
