const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const express = require('express');
const bodyParser = require('body-parser');
const WebSocket = require('ws');
const http = require('http');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const Groq = require('groq-sdk');
const helmet = require('helmet');
const { PLANNER_SYSTEM_PROMPT } = require('../orchestrator/src/prompts');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');
const memoryService = require('../libs/memory-service');

// Import middleware
const { authenticate, authenticateJWT, registerUser, loginUser, createAPIKey, revokeAPIKey, listAPIKeys } = require('./middleware/auth');
const { apiLimiter, authLimiter, orchestratorLimiter, agentLimiter } = require('./middleware/rateLimiter');
const { validateOrchestratorTask, validateAgentExecution, validateUserRegistration, validateUserLogin, validateMemoryAlias, validateMemorySet, validateAPIKeyCreation, sanitizeInput } = require('./middleware/validation');
const { logger, requestLogger, errorLogger } = require('./middleware/logger');
const { requireRole, requireAnyRole, requirePermissions } = require('./middleware/rbac');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware (helmet)
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    },
}));

// CORS configuration
const cors = require('cors');
const corsOptions = {
    origin: process.env.CORS_ORIGIN || '*', // Configure allowed origins in production
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
    credentials: true,
    maxAge: 86400 // 24 hours
};
app.use(cors(corsOptions));

// Body parsing middleware
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use(requestLogger);

// Input sanitization
app.use(sanitizeInput);

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
            logger.info('Memory service connected - using database storage');
        } else {
            logger.warn('Database unavailable - using in-memory storage');
        }
    } catch (error) {
        logger.error('Database connection failed:', error);
        logger.warn('Falling back to in-memory storage');
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
                { role: "system", content: PLANNER_SYSTEM_PROMPT + `\\nCurrent Time: ${new Date().toISOString()}` },
                { role: "user", content: userInput }
            ],
            model: "llama-3.3-70b-versatile",
            response_format: { type: "json_object" },
        });
        return JSON.parse(completion.choices[0].message.content);
    } catch (error) {
        logger.error("Error generating plan:", error);
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

// ============================================
// PUBLIC ROUTES (No Authentication Required)
// ============================================

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

// Health check (public)
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============================================
// AUTHENTICATION ROUTES
// ============================================

// User registration
app.post('/auth/register', authLimiter, validateUserRegistration, async (req, res) => {
    try {
        const { username, password, role } = req.body;
        const user = await registerUser(username, password, role);
        logger.info(`User registered: ${username}`);
        res.json({ success: true, user });
    } catch (error) {
        logger.error('Registration failed:', error);
        res.status(400).json({ error: error.message });
    }
});

// User login
app.post('/auth/login', authLimiter, validateUserLogin, async (req, res) => {
    try {
        const { username, password } = req.body;
        const result = await loginUser(username, password);
        logger.info(`User logged in: ${username}`);
        res.json(result);
    } catch (error) {
        logger.error('Login failed:', error);
        res.status(401).json({ error: error.message });
    }
});

// ============================================
// PROTECTED ROUTES (Authentication Required)
// ============================================

// List all agents
app.get('/api/agents', authenticate, apiLimiter, (req, res) => {
    const agentList = Object.keys(agents).map(name => ({
        name,
        port: 50051 + Object.keys(agents).indexOf(name)
    }));
    res.json({ agents: agentList });
});

// Check agent health
app.get('/api/agents/:agentName/health', authenticate, apiLimiter, async (req, res) => {
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

// Execute task on specific agent
app.post('/api/agents/:agentName/execute', authenticate, agentLimiter, validateAgentExecution, async (req, res) => {
    const { agentName } = req.params;
    const { action, params } = req.body;

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
        logger.info(`Agent task completed: ${agentName}.${action}`);
        res.json({ taskId, result });
    } catch (error) {
        logger.error(`Agent task failed: ${agentName}.${action}`, error);
        res.status(500).json({ error: error.message });
    }
});

// Submit orchestrator task
app.post('/api/orchestrator/task', authenticate, orchestratorLimiter, validateOrchestratorTask, async (req, res) => {
    const { input, userId = 'default' } = req.body;
    const taskId = `orchestrator-${taskIdCounter++}`;

    try {
        const planResult = await plan(input);

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
                logger.error('Failed to save to database:', dbError);
                tasks.set(taskId, { ...taskData, createdAt: new Date().toISOString() });
            }
        } else {
            tasks.set(taskId, { ...taskData, createdAt: new Date().toISOString() });
        }

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
                    logger.error('Failed to update task in database:', dbError);
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

        logger.info(`Orchestrator task created: ${taskId}`);
        res.json({ taskId, status: 'planned', plan: planResult });
    } catch (error) {
        logger.error('Orchestrator task failed:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get task status
app.get('/api/orchestrator/task/:taskId', authenticate, apiLimiter, (req, res) => {
    const { taskId } = req.params;
    const task = tasks.get(taskId);

    if (!task) {
        return res.status(404).json({ error: 'Task not found' });
    }

    res.json(task);
});

// List all tasks
app.get('/api/orchestrator/tasks', authenticate, apiLimiter, (req, res) => {
    const allTasks = Array.from(tasks.values());
    res.json({ tasks: allTasks });
});

// Memory API endpoints (with authentication)
app.post('/api/memory/alias', authenticate, apiLimiter, validateMemoryAlias, async (req, res) => {
    const { userId, type, value, description, metadata } = req.body;

    try {
        const alias = await memoryService.addAlias(userId, type, value, description, metadata);
        res.json({ success: true, alias });
    } catch (error) {
        logger.error('Error adding alias:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/memory/alias/:value', authenticate, apiLimiter, async (req, res) => {
    const { value } = req.params;

    try {
        const alias = await memoryService.resolveAlias(value);
        if (!alias) {
            return res.status(404).json({ error: 'Alias not found' });
        }
        res.json(alias);
    } catch (error) {
        logger.error('Error resolving alias:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/memory/aliases/:userId', authenticate, apiLimiter, async (req, res) => {
    const { userId } = req.params;

    try {
        const aliases = await memoryService.getUserAliases(userId);
        res.json({ userId, aliases });
    } catch (error) {
        logger.error('Error getting aliases:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/memory/tasks', authenticate, apiLimiter, async (req, res) => {
    const { userId = 'default', limit = 10 } = req.query;

    try {
        const tasks = await memoryService.getTaskHistory(userId, parseInt(limit));
        res.json({ userId, tasks });
    } catch (error) {
        logger.error('Error getting task history:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/memory/search', authenticate, apiLimiter, async (req, res) => {
    const { query, userId } = req.body;

    if (!query) {
        return res.status(400).json({ error: 'Missing required field: query' });
    }

    try {
        const tasks = await memoryService.searchTasks(query, userId);
        const memories = userId ? await memoryService.searchMemory(userId, query) : [];
        res.json({ query, tasks, memories });
    } catch (error) {
        logger.error('Error searching:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/memory/set', authenticate, apiLimiter, validateMemorySet, async (req, res) => {
    const { userId, key, value, context } = req.body;

    try {
        const memory = await memoryService.setMemory(userId, key, value, context);
        res.json({ success: true, memory });
    } catch (error) {
        logger.error('Error setting memory:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/memory/get/:key', authenticate, apiLimiter, async (req, res) => {
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
        logger.error('Error getting memory:', error);
        res.status(500).json({ error: error.message });
    }
});

// API Key management (admin only)
app.post('/api/admin/api-keys', authenticate, requireRole('admin'), validateAPIKeyCreation, async (req, res) => {
    const { name, permissions } = req.body;

    try {
        const apiKey = createAPIKey(name, permissions);
        logger.info(`API key created: ${name}`);
        res.json({ success: true, apiKey, name, permissions });
    } catch (error) {
        logger.error('Error creating API key:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/admin/api-keys', authenticate, requireRole('admin'), async (req, res) => {
    try {
        const keys = listAPIKeys();
        res.json({ keys });
    } catch (error) {
        logger.error('Error listing API keys:', error);
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/admin/api-keys/:keyPreview', authenticate, requireRole('admin'), async (req, res) => {
    const { keyPreview } = req.params;

    try {
        const revoked = revokeAPIKey(keyPreview);
        if (revoked) {
            logger.info(`API key revoked: ${keyPreview}`);
            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'API key not found' });
        }
    } catch (error) {
        logger.error('Error revoking API key:', error);
        res.status(500).json({ error: error.message });
    }
});

// Error handling middleware
app.use(errorLogger);
app.use((err, req, res, next) => {
    res.status(err.status || 500).json({
        error: err.message || 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

// Create HTTP server
const server = http.createServer(app);

// WebSocket server
const wss = new WebSocket.Server({ server, path: '/ws' });

wss.on('connection', (ws) => {
    logger.info('WebSocket client connected');
    wsClients.add(ws);

    ws.on('close', () => {
        logger.info('WebSocket client disconnected');
        wsClients.delete(ws);
    });

    ws.on('error', (error) => {
        logger.error('WebSocket error:', error);
        wsClients.delete(ws);
    });

    ws.send(JSON.stringify({ type: 'connected', message: 'Connected to Jarvis API Gateway' }));
});

// Graceful shutdown
process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');
    server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down gracefully');
    server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
    });
});

// Start server
server.listen(PORT, () => {
    logger.info(`API Gateway running on port ${PORT}`);
    logger.info(`Swagger UI available at http://localhost:${PORT}/api-docs`);
    logger.info(`WebSocket available at ws://localhost:${PORT}/ws`);
});
