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

async function generateCode(spec) {
    const prompt = `You are a Code Generation Agent. Write high-quality code for the following specification. Provide ONLY the code.\n\nSpecification: ${spec}\n\nCode:`;
    let content = "";
    if (groqClient) {
        const completion = await groqClient.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: "llama-3.3-70b-versatile",
        });
        content = completion.choices[0]?.message?.content || "";
    } else if (geminiModel) {
        const result = await geminiModel.generateContent(prompt);
        content = (await result.response).text();
    } else {
        throw new Error("No LLM configured");
    }

    // Strip markdown code blocks if present
    // Matches ```language ... ``` or just ``` ... ```
    const codeBlockRegex = /```(?:\w+)?\n([\s\S]*?)```/;
    const match = content.match(codeBlockRegex);
    if (match) {
        console.log("[Code Gen Agent] Stripped markdown code block.");
        return match[1].trim();
    }

    // Also handle cases where it might just be the code but with some leading/trailing text (less likely with the prompt, but possible)
    return content.trim();
}

async function executeTask(call, callback) {
    const task = call.request;
    const params = task.payload ? JSON.parse(task.payload.toString()) : {};
    console.log(`[Code Gen Agent] Task ${task.id}: ${task.type}`);

    if (task.type === 'codegen.generate') {
        try {
            const result = await generateCode(params.spec);
            callback(null, {
                id: task.id,
                status: "success",
                result_uri: `code://${task.id}/generated`,
                result_data: JSON.stringify({ code: result })
            });
        } catch (error) {
            callback(null, { id: task.id, status: "fail", error_message: error.message });
        }
    } else {
        callback(null, { id: task.id, status: "fail", error_message: "Unknown task type" });
    }
}

function healthCheck(call, callback) {
    callback(null, { status: "ok", capabilities: ["codegen.generate"] });
}

function main() {
    const server = new grpc.Server();
    server.addService(taskProto.Agent.service, { ExecuteTask: executeTask, HealthCheck: healthCheck });
    const address = '127.0.0.1:50058';
    server.bindAsync(address, grpc.ServerCredentials.createInsecure(), () => {
        console.log(`[Code Gen Agent] Server running at ${address}`);
        server.start();
    });
}
main();
