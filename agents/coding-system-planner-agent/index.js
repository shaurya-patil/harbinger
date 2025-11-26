const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Groq = require('groq-sdk');

const PROTO_PATH = path.join(__dirname, '../../libs/proto/task.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
});
const taskProto = grpc.loadPackageDefinition(packageDefinition).jarvis;

const geminiApiKey = process.env.GEMINI_API_KEY;
const groqApiKey = process.env.GROQ_API_KEY;
let geminiModel = null;
let groqClient = null;

if (geminiApiKey) {
    const genAI = new GoogleGenerativeAI(geminiApiKey);
    geminiModel = genAI.getGenerativeModel({ model: "gemini-pro" });
}
if (groqApiKey) {
    groqClient = new Groq({ apiKey: groqApiKey });
}

async function planSystem(requirements) {
    const prompt = `You are a System Planner Agent. Design the architecture, workflow, and file structure for the following requirements.\n\nRequirements: ${requirements}\n\nSystem Plan:`;
    if (groqClient) {
        const completion = await groqClient.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: "llama-3.3-70b-versatile",
        });
        return completion.choices[0]?.message?.content || "";
    } else if (geminiModel) {
        const result = await geminiModel.generateContent(prompt);
        return (await result.response).text();
    }
    throw new Error("No LLM configured");
}

async function executeTask(call, callback) {
    const task = call.request;
    const params = task.payload ? JSON.parse(task.payload.toString()) : {};
    console.log(`[System Planner Agent] Task ${task.id}: ${task.type}`);

    if (task.type === 'planner.plan_system') {
        try {
            const result = await planSystem(params.requirements);
            callback(null, {
                id: task.id,
                status: "success",
                result_uri: `text://${task.id}/system_plan`,
                result_data: JSON.stringify({ plan: result })
            });
        } catch (error) {
            callback(null, { id: task.id, status: "fail", error_message: error.message });
        }
    } else {
        callback(null, { id: task.id, status: "fail", error_message: "Unknown task type" });
    }
}

function healthCheck(call, callback) {
    callback(null, { status: "ok", capabilities: ["planner.plan_system"] });
}

function main() {
    const server = new grpc.Server();
    server.addService(taskProto.Agent.service, { ExecuteTask: executeTask, HealthCheck: healthCheck });
    const address = '127.0.0.1:50057';
    server.bindAsync(address, grpc.ServerCredentials.createInsecure(), () => {
        console.log(`[System Planner Agent] Server running at ${address}`);
        server.start();
    });
}
main();
