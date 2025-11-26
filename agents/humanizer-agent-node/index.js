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

// Initialize LLM Clients
const geminiApiKey = process.env.GEMINI_API_KEY;
const groqApiKey = process.env.GROQ_API_KEY;

let geminiModel = null;
let groqClient = null;

if (geminiApiKey) {
    const genAI = new GoogleGenerativeAI(geminiApiKey);
    geminiModel = genAI.getGenerativeModel({ model: "gemini-pro" });
    console.log('[Humanizer Agent] Gemini initialized');
} else {
    console.warn('[Humanizer Agent] GEMINI_API_KEY not found');
}

if (groqApiKey) {
    groqClient = new Groq({ apiKey: groqApiKey });
    console.log('[Humanizer Agent] Groq initialized');
} else {
    console.warn('[Humanizer Agent] GROQ_API_KEY not found');
}

async function humanizeWithGemini(content) {
    if (!geminiModel) throw new Error("Gemini not configured");
    console.log('[Humanizer Agent] Attempting with Gemini...');
    const prompt = `Rewrite the following text to sound more human, natural, and engaging. Avoid robotic or overly formal language. Keep the meaning the same.\n\nText: ${content}`;
    const result = await geminiModel.generateContent(prompt);
    const response = await result.response;
    return response.text();
}

async function humanizeWithGroq(content) {
    if (!groqClient) throw new Error("Groq not configured");
    console.log('[Humanizer Agent] Attempting with Groq (llama-3.3-70b-versatile)...');
    const completion = await groqClient.chat.completions.create({
        messages: [
            {
                role: "system",
                content: "You are a helpful assistant that rewrites text to sound more human, natural, and engaging."
            },
            {
                role: "user",
                content: `Rewrite the following text to sound more human, natural, and engaging. Avoid robotic or overly formal language. Keep the meaning the same.\n\nText: ${content}`
            }
        ],
        model: "llama-3.3-70b-versatile",
    });
    return completion.choices[0]?.message?.content || "";
}

async function humanizeContent(content) {
    // Hybrid Approach: Try Gemini first, then Groq
    try {
        return await humanizeWithGemini(content);
    } catch (geminiError) {
        console.error(`[Humanizer Agent] Gemini failed: ${geminiError.message}`);
        try {
            return await humanizeWithGroq(content);
        } catch (groqError) {
            console.error(`[Humanizer Agent] Groq failed: ${groqError.message}`);
            throw new Error("All LLM providers failed to humanize content.");
        }
    }
}

async function executeTask(call, callback) {
    const task = call.request;
    const params = task.payload ? JSON.parse(task.payload.toString()) : {};
    console.log(`[Humanizer Agent] Task ${task.id}: ${task.type}`);

    if (task.type === 'humanizer.humanize_content') {
        try {
            const content = params.content;
            if (!content) throw new Error("Content is required");

            const humanized = await humanizeContent(content);

            callback(null, {
                id: task.id,
                status: "success",
                result_uri: `text://${task.id}/humanized`,
                result_data: JSON.stringify({ original: content, humanized: humanized })
            });
        } catch (error) {
            console.error(`[Humanizer Agent] Task failed:`, error.message);
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
        capabilities: ["humanizer.humanize_content"]
    });
}

function main() {
    const server = new grpc.Server();
    server.addService(taskProto.Agent.service, {
        ExecuteTask: executeTask,
        HealthCheck: healthCheck
    });

    const address = '0.0.0.0:50055';
    server.bindAsync(address, grpc.ServerCredentials.createInsecure(), () => {
        console.log(`[Humanizer Agent] Server running at ${address}`);
        server.start();
    });
}

main();
