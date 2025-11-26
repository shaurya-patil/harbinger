const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const WebSocket = require('ws');
const http = require('http');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const Groq = require('groq-sdk');
const { PLANNER_SYSTEM_PROMPT } = require('../orchestrator/src/prompts');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');
const memoryService = require('../libs/memory-service');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Load proto
const PROTO_PATH = path.join(__dirname, '../libs/proto/task.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
});
const taskProto = grpc.loadPackageDefinition(packageDefinition).jarvis;

// Initialize gRPC clients
const agents = {
    calendar: new taskProto.Agent('localhost:50051', grpc.credentials.createInsecure()),
    gmail: new taskProto.Agent('localhost:50052', grpc.credentials.createInsecure()),
    browser: new taskProto.Agent('localhost:50053', grpc.credentials.createInsecure()),
    os: new taskProto.Agent('localhost:50054', grpc.credentials.createInsecure()),
    humanizer: new taskProto.Agent('localhost:50055', grpc.credentials.createInsecure()),
    interpreter: new taskProto.Agent('localhost:50056', grpc.credentials.createInsecure()),
    planner: new taskProto.Agent('localhost:50057', grpc.credentials.createInsecure()),
    codegen: new taskProto.Agent('localhost:50058', grpc.credentials.createInsecure()),
    execution: new taskProto.Agent('localhost:50059', grpc.credentials.createInsecure()),
    debugger: new taskProto.Agent('localhost:50060', grpc.credentials.createInsecure()),
    qa: new taskProto.Agent('localhost:50061', grpc.credentials.createInsecure()),
    reviewer: new taskProto.Agent('localhost:50062', grpc.credentials.createInsecure()),
    dependency: new taskProto.Agent('localhost:50063', grpc.credentials.createInsecure()),
    docs: new taskProto.Agent('localhost:50064', grpc.credentials.createInsecure()),
    research: new taskProto.Agent('localhost:50065', grpc.credentials.createInsecure()),
    memory: new taskProto.Agent('localhost:50066', grpc.credentials.createInsecure()),
    excel: new taskProto.Agent('localhost:50067', grpc.credentials.createInsecure())
};

// Initialize Groq for orchestrator planning
const groqApiKey = process.env.GROQ_API_KEY;
const openai = groqApiKey ? new Groq({ apiKey: groqApiKey }) : null;

// Task storage (in-memory fallback if DB unavailable)
const tasks = new Map();
let taskIdCounter = 1;
let useDatabase = false;

// Test database connection on startup
(async () => {
    try {
        useDatabase = await memoryService.testConnection();
        if (useDatabase) {
            console.log('[API Gateway] Memory service connected - using database storage');
        } else {
            console.warn('[API Gateway] Database unavailable - using in-memory storage');
        }
    } catch (error) {
        console.error('[API Gateway] Database connection failed:', error.message);
        console.warn('[API Gateway] Falling back to in-memory storage');
    }
})();

// WebSocket clients
const wsClients = new Set();

// Helper: Plan tasks using orchestrator logic
async function plan(userInput) {
    if (!openai) {
        throw new Error('GROQ_API_KEY not configured');
    }
    try {
        const completion = await openai.chat.completions.create({
            messages: [
                { role: "system", content: PLANNER_SYSTEM_PROMPT + `\nCurrent Time: ${new Date().toISOString()}` },
                { role: "user", content: userInput }
            ],
            model: "llama-3.3-70b-versatile",
            response_format: { type: "json_object" },
        });
        return JSON.parse(completion.choices[0].message.content);
    } catch (error) {
        console.error("Error generating plan:", error);
        throw error;
    }
}

// Helper: Execute a single task
async function executeTask(task) {
    return new Promise((resolve, reject) => {
        const client = agents[task.agent];
        if (!client) {
            resolve({ id: task.id, status: "fail", error_message: `Unknown agent: ${task.agent}` });
            return;
        }

        const grpcTask = {
            id: task.id,
            type: task.action,
            metadata: {},
            payload: Buffer.from(JSON.stringify(task.params)),
            depends_on: task.depends_on || [],
            retry_count: 0
        };

        client.ExecuteTask(grpcTask, (err, response) => {
            if (err) {
                resolve({ id: task.id, status: "fail", error_message: err.message });
            } else {
                resolve(response);
            }
        });
    });
}

// Helper: Broadcast to WebSocket clients
function broadcast(data) {
    const message = JSON.stringify(data);
    wsClients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Serve raw OpenAPI spec
app.get('/swagger.json', (req, res) => {
    res.json(swaggerSpec);
});

// Root redirect to Swagger UI
app.get('/', (req, res) => {
    res.redirect('/api-docs');
});

// Routes

/**
 * @swagger
 * /health:
 *   get:
 *     tags:
 *       - Health
 *     summary: Health check
 *     description: Check if the API Gateway is running
 *     responses:
 *       200:
 *         description: API Gateway is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * @swagger
 * /api/agents:
 *   get:
 *     tags:
 *       - Agents
 *     summary: List all agents
 *     description: Get a list of all available agents and their ports
 *     responses:
 *       200:
 *         description: List of agents
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 agents:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       name:
 *                         type: string
 *                       port:
 *                         type: integer
 */
app.get('/api/agents', (req, res) => {
    const agentList = Object.keys(agents).map(name => ({
        name,
        port: 50051 + Object.keys(agents).indexOf(name)
    }));
    res.json({ agents: agentList });
});

/**
 * @swagger
 * /api/agents/{agentName}/health:
 *   get:
 *     tags:
 *       - Agents
 *     summary: Check agent health
 *     description: Check the health status of a specific agent
 *     parameters:
 *       - in: path
 *         name: agentName
 *         required: true
 *         schema:
 *           type: string
 *         description: Name of the agent (e.g., calendar, gmail, humanizer)
 *     responses:
 *       200:
 *         description: Agent health status
 *       404:
 *         description: Agent not found
 *       500:
 *         description: Agent health check failed
 */
app.get('/api/agents/:agentName/health', async (req, res) => {
    const { agentName } = req.params;
    const client = agents[agentName];

    if (!client) {
        return res.status(404).json({ error: 'Agent not found' });
    }

    client.HealthCheck({}, (err, response) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json({ agent: agentName, ...response });
        }
    });
});

/**
 * @swagger
 * /api/agents/{agentName}/execute:
 *   post:
 *     tags:
 *       - Agents
 *     summary: Execute task on specific agent
 *     description: Execute a task directly on a specific agent
 *     parameters:
 *       - in: path
 *         name: agentName
 *         required: true
 *         schema:
 *           type: string
 *         description: Name of the agent
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - action
 *             properties:
 *               action:
 *                 type: string
 *                 description: Action to perform (e.g., calendar.create_event)
 *               params:
 *                 type: object
 *                 description: Parameters for the action
 *     responses:
 *       200:
 *         description: Task executed successfully
 *       400:
 *         description: Missing required fields
 *       404:
 *         description: Agent not found
 */
app.post('/api/agents/:agentName/execute', async (req, res) => {
    const { agentName } = req.params;
    const { action, params } = req.body;

    if (!action) {
        return res.status(400).json({ error: 'Missing required field: action' });
    }

    const client = agents[agentName];
    if (!client) {
        return res.status(404).json({ error: 'Agent not found' });
    }

    const taskId = `task-${taskIdCounter++}`;
    const task = {
        id: taskId,
        agent: agentName,
        action,
        params: params || {}
    };

    try {
        const result = await executeTask(task);
        res.json({ taskId, result });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/orchestrator/task:
 *   post:
 *     tags:
 *       - Orchestrator
 *     summary: Submit orchestrator task
 *     description: Submit a natural language task to the orchestrator for multi-agent execution
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - input
 *             properties:
 *               input:
 *                 type: string
 *                 description: Natural language task description
 *                 example: Create a meeting tomorrow at 3pm and send an email about it
 *     responses:
 *       200:
 *         description: Task planned and execution started
 *       400:
 *         description: Missing required fields
 *       500:
 *         description: Planning failed
 */
app.post('/api/orchestrator/task', async (req, res) => {
    const { input, userId = 'default' } = req.body;

    if (!input) {
        return res.status(400).json({ error: 'Missing required field: input' });
    }

    const taskId = `orchestrator-${taskIdCounter++}`;

    try {
        // Plan the task
        const planResult = await plan(input);

        // Store task in database (with fallback to in-memory)
        const taskData = {
            taskId,
            userId,
            input,
            plan: planResult,
            status: 'planned',
            results: []
        };

        if (useDatabase) {
            try {
                await memoryService.saveTask(taskData);
            } catch (dbError) {
                console.error('[API Gateway] Failed to save to database:', dbError);
                tasks.set(taskId, { ...taskData, createdAt: new Date().toISOString() });
            }
        } else {
            tasks.set(taskId, { ...taskData, createdAt: new Date().toISOString() });
        }

        // Broadcast to WebSocket clients
        broadcast({ type: 'task_planned', taskId, plan: planResult });

        // Execute tasks asynchronously
        (async () => {
            const taskGraph = planResult.tasks || [];
            const results = [];

            for (const task of taskGraph) {
                broadcast({ type: 'task_executing', taskId, currentTask: task.id });
                const result = await executeTask(task);
                results.push(result);
                broadcast({ type: 'task_completed', taskId, taskResult: result });
            }

            // Update task status
            const updatedTask = {
                taskId,
                userId,
                input,
                plan: planResult,
                status: 'completed',
                results
            };

            if (useDatabase) {
                try {
                    await memoryService.saveTask(updatedTask);
                } catch (dbError) {
                    console.error('[API Gateway] Failed to update task in database:', dbError);
                    const taskData = tasks.get(taskId);
                    if (taskData) {
                        taskData.status = 'completed';
                        taskData.results = results;
                        taskData.completedAt = new Date().toISOString();
                        tasks.set(taskId, taskData);
                    }
                }
            } else {
                const taskData = tasks.get(taskId);
                if (taskData) {
                    taskData.status = 'completed';
                    taskData.results = results;
                    taskData.completedAt = new Date().toISOString();
                    tasks.set(taskId, taskData);
                }
            }

            broadcast({ type: 'orchestrator_completed', taskId, results });
        })();

        res.json({ taskId, status: 'planned', plan: planResult });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/orchestrator/task/{taskId}:
 *   get:
 *     tags:
 *       - Orchestrator
 *     summary: Get task status
 *     description: Get the status and results of a previously submitted task
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *         description: Task ID
 *     responses:
 *       200:
 *         description: Task details
 *       404:
 *         description: Task not found
 */
app.get('/api/orchestrator/task/:taskId', (req, res) => {
    const { taskId } = req.params;
    const task = tasks.get(taskId);

    if (!task) {
        return res.status(404).json({ error: 'Task not found' });
    }

    res.json(task);
});

/**
 * @swagger
 * /api/orchestrator/tasks:
 *   get:
 *     tags:
 *       - Orchestrator
 *     summary: List all tasks
 *     description: Get a list of all orchestrator tasks
 *     responses:
 *       200:
 *         description: List of tasks
 */
app.get('/api/orchestrator/tasks', (req, res) => {
    const allTasks = Array.from(tasks.values());
    res.json({ tasks: allTasks });
});

// ============================================
// Memory API Endpoints
// ============================================

/**
 * @swagger
 * /api/memory/alias:
 *   post:
 *     tags:
 *       - Memory
 *     summary: Add user alias
 *     description: Add a new alias (email, name, location, preference, etc.)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - type
 *               - value
 *             properties:
 *               userId:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [email, name, nickname, location, preference, contact, identifier, custom]
 *               value:
 *                 type: string
 *               description:
 *                 type: string
 *               metadata:
 *                 type: object
 *     responses:
 *       200:
 *         description: Alias added successfully
 *       500:
 *         description: Database error
 */
app.post('/api/memory/alias', async (req, res) => {
    const { userId, type, value, description, metadata } = req.body;

    if (!userId || !type || !value) {
        return res.status(400).json({ error: 'Missing required fields: userId, type, value' });
    }

    try {
        const alias = await memoryService.addAlias(userId, type, value, description, metadata);
        res.json({ success: true, alias });
    } catch (error) {
        console.error('[API Gateway] Error adding alias:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/memory/alias/{value}:
 *   get:
 *     tags:
 *       - Memory
 *     summary: Resolve alias
 *     description: Get user info for an alias value
 *     parameters:
 *       - in: path
 *         name: value
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Alias resolved
 *       404:
 *         description: Alias not found
 */
app.get('/api/memory/alias/:value', async (req, res) => {
    const { value } = req.params;

    try {
        const alias = await memoryService.resolveAlias(value);
        if (!alias) {
            return res.status(404).json({ error: 'Alias not found' });
        }
        res.json(alias);
    } catch (error) {
        console.error('[API Gateway] Error resolving alias:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/memory/aliases/{userId}:
 *   get:
 *     tags:
 *       - Memory
 *     summary: Get all aliases for user
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User aliases
 */
app.get('/api/memory/aliases/:userId', async (req, res) => {
    const { userId } = req.params;

    try {
        const aliases = await memoryService.getUserAliases(userId);
        res.json({ userId, aliases });
    } catch (error) {
        console.error('[API Gateway] Error getting aliases:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/memory/tasks:
 *   get:
 *     tags:
 *       - Memory
 *     summary: Get task history
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Task history
 */
app.get('/api/memory/tasks', async (req, res) => {
    const { userId = 'default', limit = 10 } = req.query;

    try {
        const tasks = await memoryService.getTaskHistory(userId, parseInt(limit));
        res.json({ userId, tasks });
    } catch (error) {
        console.error('[API Gateway] Error getting task history:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/memory/search:
 *   post:
 *     tags:
 *       - Memory
 *     summary: Search tasks and memory
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - query
 *             properties:
 *               query:
 *                 type: string
 *               userId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Search results
 */
app.post('/api/memory/search', async (req, res) => {
    const { query, userId } = req.body;

    if (!query) {
        return res.status(400).json({ error: 'Missing required field: query' });
    }

    try {
        const tasks = await memoryService.searchTasks(query, userId);
        const memories = userId ? await memoryService.searchMemory(userId, query) : [];
        res.json({ query, tasks, memories });
    } catch (error) {
        console.error('[API Gateway] Error searching:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/memory/set:
 *   post:
 *     tags:
 *       - Memory
 *     summary: Store memory
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - key
 *               - value
 *             properties:
 *               userId:
 *                 type: string
 *               key:
 *                 type: string
 *               value:
 *                 type: object
 *               context:
 *                 type: string
 *     responses:
 *       200:
 *         description: Memory stored
 */
app.post('/api/memory/set', async (req, res) => {
    const { userId, key, value, context } = req.body;

    if (!userId || !key || value === undefined) {
        return res.status(400).json({ error: 'Missing required fields: userId, key, value' });
    }

    try {
        const memory = await memoryService.setMemory(userId, key, value, context);
        res.json({ success: true, memory });
    } catch (error) {
        console.error('[API Gateway] Error setting memory:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/memory/get/{key}:
 *   get:
 *     tags:
 *       - Memory
 *     summary: Retrieve memory
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Memory value
 *       404:
 *         description: Memory not found
 */
app.get('/api/memory/get/:key', async (req, res) => {
    const { key } = req.params;
    const { userId } = req.query;

    if (!userId) {
        return res.status(400).json({ error: 'Missing required query parameter: userId' });
    }

    try {
        const value = await memoryService.getMemory(userId, key);
        if (value === null) {
            return res.status(404).json({ error: 'Memory not found' });
        }
        res.json({ key, value });
    } catch (error) {
        console.error('[API Gateway] Error getting memory:', error);
        res.status(500).json({ error: error.message });
    }
});


// Create HTTP server
const server = http.createServer(app);

// WebSocket server
const wss = new WebSocket.Server({ server, path: '/ws' });

wss.on('connection', (ws) => {
    console.log('[API Gateway] WebSocket client connected');
    wsClients.add(ws);

    ws.on('close', () => {
        console.log('[API Gateway] WebSocket client disconnected');
        wsClients.delete(ws);
    });

    ws.on('error', (error) => {
        console.error('[API Gateway] WebSocket error:', error);
        wsClients.delete(ws);
    });

    // Send welcome message
    ws.send(JSON.stringify({ type: 'connected', message: 'Connected to Jarvis API Gateway' }));
});

// Start server
server.listen(PORT, () => {
    console.log(`[API Gateway] Server running on http://localhost:${PORT}`);
    console.log(`[API Gateway] WebSocket available at ws://localhost:${PORT}/ws`);
    console.log(`[API Gateway] Swagger UI: http://localhost:${PORT}/api-docs`);
});
