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

console.log(`[Research Agent] Loading keys... Groq: ${groqApiKey ? 'Found' : 'Missing'}, Gemini: ${geminiApiKey ? 'Found' : 'Missing'}`);

if (geminiApiKey) {
    const genAI = new GoogleGenerativeAI(geminiApiKey);
    geminiModel = genAI.getGenerativeModel({ model: "gemini-pro" });
}
if (groqApiKey) {
    groqClient = new Groq({ apiKey: groqApiKey });
}

async function researchTopic(topic) {
    const prompt = `You are a Research Agent. Look up examples, patterns, and best practices for the following topic.\n\nTopic: ${topic}\n\nResearch Report:`;
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
    console.log(`[Research Agent] Task ${task.id}: ${task.type}`);

    if (task.type === 'research.research') {
        try {
            const result = await researchTopic(params.topic);
            callback(null, {
                id: task.id,
                status: "success",
                result_uri: `text://${task.id}/research`,
                result_data: JSON.stringify({ report: result })
            });
        } catch (error) {
            callback(null, { id: task.id, status: "fail", error_message: error.message });
        }
    } else {
        callback(null, { id: task.id, status: "fail", error_message: "Unknown task type" });
    }
}

function healthCheck(call, callback) {
    callback(null, { status: "ok", capabilities: ["research.research"] });
}

function main() {
    const server = new grpc.Server();
    server.addService(taskProto.Agent.service, { ExecuteTask: executeTask, HealthCheck: healthCheck });
    const address = '127.0.0.1:50065';
    server.bindAsync(address, grpc.ServerCredentials.createInsecure(), () => {
        console.log(`[Research Agent] Server running at ${address}`);
        server.start();
    });
}
main();
