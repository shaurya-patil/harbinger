const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const Groq = require('groq-sdk');
const memoryService = require('../../libs/memory-service');

// Load Proto
const PROTO_PATH = path.join(__dirname, '../../libs/proto/task.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
});
const taskProto = grpc.loadPackageDefinition(packageDefinition).jarvis;

// Initialize Groq for semantic search
const groqApiKey = process.env.GROQ_API_KEY;
const groq = groqApiKey ? new Groq({ apiKey: groqApiKey }) : null;

/**
 * Semantic search using LLM
 */
async function semanticSearch(query, memories, userId) {
    if (!groq || memories.length === 0) {
        return memories;
    }

    try {
        const memoriesText = memories.map((m, i) =>
            `${i + 1}. Key: ${m.memory_key}\n   Context: ${m.context || 'N/A'}\n   Value: ${JSON.stringify(m.memory_value)}`
        ).join('\n\n');

        const prompt = `Given the search query: "${query}"

And these memories:
${memoriesText}

Return a JSON array of memory indices (1-based) ranked by relevance to the query.
Only return the array, nothing else.
Example: [3, 1, 5]`;

        const completion = await groq.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: "llama-3.3-70b-versatile",
            temperature: 0.3
        });

        const indices = JSON.parse(completion.choices[0].message.content);
        return indices.map(i => memories[i - 1]).filter(Boolean);
    } catch (error) {
        console.error('[Memory Agent] Semantic search failed:', error);
        return memories; // Fallback to original order
    }
}

/**
 * Extract key from natural language context
 */
async function extractKey(context) {
    if (!groq) {
        // Fallback: use first few words
        return context.toLowerCase().replace(/[^a-z0-9]+/g, '_').substring(0, 50);
    }

    try {
        const prompt = `Extract a short, descriptive key (2-4 words, snake_case) from this context:
"${context}"

Return only the key, nothing else.
Examples:
- "User's favorite color is blue" → "favorite_color"
- "Boss's name is Sarah" → "boss_name"
- "Prefers meetings in the morning" → "meeting_preference"`;

        const completion = await groq.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: "llama-3.3-70b-versatile",
            temperature: 0.1
        });

        return completion.choices[0].message.content.trim().toLowerCase();
    } catch (error) {
        console.error('[Memory Agent] Key extraction failed:', error);
        return context.toLowerCase().replace(/[^a-z0-9]+/g, '_').substring(0, 50);
    }
}

/**
 * Execute task handler
 */
async function executeTask(call, callback) {
    const task = call.request;
    const params = task.payload ? JSON.parse(task.payload.toString()) : {};
    const userId = params.userId || 'default';

    console.log(`[Memory Agent] Received task: ${task.id} - ${task.type}`);
    console.log(`[Memory Agent] Params:`, params);

    try {
        switch (task.type) {
            case 'memory.store': {
                // Store memory
                let key = params.key;

                // Auto-extract key if not provided
                if (!key && params.context) {
                    key = await extractKey(params.context);
                    console.log(`[Memory Agent] Auto-extracted key: ${key}`);
                }

                if (!key) {
                    throw new Error('Missing required parameter: key or context');
                }

                const result = await memoryService.setMemory(
                    userId,
                    key,
                    params.value,
                    params.context || null
                );

                console.log(`[Memory Agent] Stored memory: ${key}`);
                callback(null, {
                    id: task.id,
                    status: "success",
                    result_data: JSON.stringify({ key, stored: true }),
                    result_uri: `memory://${userId}/${key}`
                });
                break;
            }

            case 'memory.retrieve': {
                // Retrieve specific memory
                if (!params.key) {
                    throw new Error('Missing required parameter: key');
                }

                const value = await memoryService.getMemory(userId, params.key);

                if (value === null) {
                    callback(null, {
                        id: task.id,
                        status: "fail",
                        error_message: `Memory not found: ${params.key}`
                    });
                } else {
                    console.log(`[Memory Agent] Retrieved memory: ${params.key}`);
                    callback(null, {
                        id: task.id,
                        status: "success",
                        result_data: JSON.stringify({ key: params.key, value }),
                        result_uri: `memory://${userId}/${params.key}`
                    });
                }
                break;
            }

            case 'memory.search': {
                // Search memories
                if (!params.query) {
                    throw new Error('Missing required parameter: query');
                }

                let memories = [];

                // Smart Search Strategy:
                // 1. Try exact search first
                // 2. If semantic enabled, extract keywords and search broadly
                // 3. Rank results with LLM

                // 1. Exact search
                memories = await memoryService.searchMemory(userId, params.query);

                // 2. Broaden search if semantic enabled
                if (params.semantic !== false && groq) {
                    try {
                        // Extract keywords
                        const keywordPrompt = `Extract 1-3 core keywords from this search query to find relevant database records.
Query: "${params.query}"
Return ONLY a JSON array of strings.
Example: ["shaurya", "email"]`;

                        const completion = await groq.chat.completions.create({
                            messages: [{ role: "user", content: keywordPrompt }],
                            model: "llama-3.3-70b-versatile",
                            temperature: 0.1
                        });

                        const keywords = JSON.parse(completion.choices[0].message.content);
                        console.log(`[Memory Agent] Extracted keywords:`, keywords);

                        // Search for each keyword in parallel
                        const searchPromises = keywords.map(kw => memoryService.searchMemory(userId, kw));
                        const results = await Promise.all(searchPromises);

                        // Merge and deduplicate
                        const memoryMap = new Map();

                        // Add original exact matches first
                        memories.forEach(m => memoryMap.set(m.memory_key, m));

                        // Add keyword matches
                        results.flat().forEach(m => {
                            if (!memoryMap.has(m.memory_key)) {
                                memoryMap.set(m.memory_key, m);
                            }
                        });

                        memories = Array.from(memoryMap.values());
                        console.log(`[Memory Agent] Broadened search candidates: ${memories.length}`);

                        // 3. Semantic Ranking
                        if (memories.length > 0) {
                            memories = await semanticSearch(params.query, memories, userId);
                        }
                    } catch (error) {
                        console.error('[Memory Agent] Smart search failed, falling back to simple search:', error);
                    }
                }

                console.log(`[Memory Agent] Search found ${memories.length} results for: ${params.query}`);
                callback(null, {
                    id: task.id,
                    status: "success",
                    result_data: JSON.stringify({
                        query: params.query,
                        count: memories.length,
                        memories: memories.map(m => ({
                            key: m.memory_key,
                            value: m.memory_value,
                            context: m.context
                        }))
                    }),
                    result_uri: `memory://${userId}/search?q=${params.query}`
                });
                break;
            }

            case 'memory.list': {
                // List all memories
                const memories = await memoryService.pool.query(
                    'SELECT memory_key, memory_value, context, created_at FROM agent_memory WHERE user_id = $1 ORDER BY created_at DESC',
                    [userId]
                );

                console.log(`[Memory Agent] Listed ${memories.rows.length} memories`);
                callback(null, {
                    id: task.id,
                    status: "success",
                    result_data: JSON.stringify({
                        count: memories.rows.length,
                        memories: memories.rows
                    }),
                    result_uri: `memory://${userId}/list`
                });
                break;
            }

            case 'memory.forget': {
                // Delete memory
                if (!params.key) {
                    throw new Error('Missing required parameter: key');
                }

                await memoryService.deleteMemory(userId, params.key);

                console.log(`[Memory Agent] Deleted memory: ${params.key}`);
                callback(null, {
                    id: task.id,
                    status: "success",
                    result_data: JSON.stringify({ key: params.key, deleted: true }),
                    result_uri: `memory://${userId}/${params.key}`
                });
                break;
            }

            default:
                callback(null, {
                    id: task.id,
                    status: "fail",
                    error_message: `Unknown task type: ${task.type}`
                });
        }
    } catch (error) {
        console.error(`[Memory Agent] Task failed:`, error);
        callback(null, {
            id: task.id,
            status: "fail",
            error_message: error.message
        });
    }
}

/**
 * Health check handler
 */
function healthCheck(call, callback) {
    callback(null, {
        status: "ok",
        capabilities: [
            "memory.store",
            "memory.retrieve",
            "memory.search",
            "memory.list",
            "memory.forget"
        ]
    });
}

/**
 * Main function
 */
function main() {
    const server = new grpc.Server();
    server.addService(taskProto.Agent.service, {
        ExecuteTask: executeTask,
        HealthCheck: healthCheck
    });

    const address = '0.0.0.0:50066';
    server.bindAsync(address, grpc.ServerCredentials.createInsecure(), () => {
        console.log(`[Memory Agent] Server running at ${address}`);
        console.log(`[Memory Agent] Groq API: ${groqApiKey ? 'Enabled' : 'Disabled (no semantic search)'}`);

        // Test database connection
        memoryService.testConnection().then(connected => {
            if (connected) {
                console.log('[Memory Agent] Database connected');
            } else {
                console.warn('[Memory Agent] Database unavailable - agent will not function');
            }
        });

        server.start();
    });
}

main();
