const swaggerJsdoc = require('swagger-jsdoc');

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Jarvis API Gateway',
            version: '1.0.0',
            description: 'REST API Gateway for the Jarvis Agent System. Provides access to 16 specialized agents (including Excel automation) and an intelligent orchestrator for complex multi-agent tasks.',
            contact: {
                name: 'API Support',
            },
        },
        servers: [
            {
                url: 'http://localhost:3000',
                description: 'Development server',
            },
        ],
        tags: [
            {
                name: 'Health',
                description: 'Health check endpoints',
            },
            {
                name: 'Agents',
                description: 'Direct agent access and management',
            },
            {
                name: 'Orchestrator',
                description: 'Multi-agent task orchestration',
            },
            {
                name: 'Memory',
                description: 'Memory, aliases, and task history management',
            },
        ],
    },
    apis: [__dirname + '/index.js'], // Path to the API routes
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
