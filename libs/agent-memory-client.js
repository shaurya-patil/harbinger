const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

/**
 * Unified Memory Client for Agents
 * Provides access to both mainstream (shared) memory and agent-specific memory
 */
class AgentMemoryClient {
    constructor(agentName, memoryServiceHost = 'localhost:50066') {
        this.agentName = agentName;
        this.memoryServiceHost = memoryServiceHost;
        this.client = null;
        this.localMemory = new Map(); // Agent-specific in-memory cache

        this.initializeClient();
    }

    /**
     * Initialize gRPC client for memory service
     */
    initializeClient() {
        try {
            const PROTO_PATH = path.join(__dirname, '../proto/task.proto');
            const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
                keepCase: true,
                longs: String,
                enums: String,
                defaults: true,
                oneofs: true
            });
            const taskProto = grpc.loadPackageDefinition(packageDefinition).jarvis;

            this.client = new taskProto.Agent(
                this.memoryServiceHost,
                grpc.credentials.createInsecure()
            );

            console.log(`[${this.agentName}] Memory client initialized`);
        } catch (error) {
            console.error(`[${this.agentName}] Failed to initialize memory client:`, error.message);
            console.warn(`[${this.agentName}] Falling back to local memory only`);
        }
    }

    /**
     * Store data in mainstream (shared) memory
     */
    async storeMainstream(key, value, context = '') {
        if (!this.client) {
            console.warn(`[${this.agentName}] Memory service unavailable, cannot store mainstream memory`);
            return { success: false, error: 'Memory service unavailable' };
        }

        return new Promise((resolve) => {
            const task = {
                id: `memory-store-${Date.now()}`,
                type: 'memory.store',
                payload: Buffer.from(JSON.stringify({
                    userId: 'system', // Mainstream memory uses 'system' user
                    key: `${this.agentName}:${key}`,
                    value,
                    context: context || `Stored by ${this.agentName}`
                }))
            };

            this.client.ExecuteTask(task, (err, response) => {
                if (err) {
                    console.error(`[${this.agentName}] Failed to store mainstream memory:`, err.message);
                    resolve({ success: false, error: err.message });
                } else if (response.status === 'success') {
                    console.log(`[${this.agentName}] Stored in mainstream memory: ${key}`);
                    resolve({ success: true, data: JSON.parse(response.result_data || '{}') });
                } else {
                    resolve({ success: false, error: response.error_message });
                }
            });
        });
    }

    /**
     * Search mainstream (shared) memory
     */
    async searchMainstream(query) {
        if (!this.client) {
            console.warn(`[${this.agentName}] Memory service unavailable, cannot search mainstream memory`);
            return { success: false, results: [] };
        }

        return new Promise((resolve) => {
            const task = {
                id: `memory-search-${Date.now()}`,
                type: 'memory.search',
                payload: Buffer.from(JSON.stringify({
                    query,
                    userId: 'system'
                }))
            };

            this.client.ExecuteTask(task, (err, response) => {
                if (err) {
                    console.error(`[${this.agentName}] Failed to search mainstream memory:`, err.message);
                    resolve({ success: false, results: [] });
                } else if (response.status === 'success') {
                    const data = JSON.parse(response.result_data || '{"results":[]}');
                    console.log(`[${this.agentName}] Found ${data.results?.length || 0} results in mainstream memory`);
                    resolve({ success: true, results: data.results || [] });
                } else {
                    resolve({ success: false, results: [] });
                }
            });
        });
    }

    /**
     * Get specific value from mainstream memory
     */
    async getMainstream(key) {
        if (!this.client) {
            return null;
        }

        return new Promise((resolve) => {
            const task = {
                id: `memory-get-${Date.now()}`,
                type: 'memory.get',
                payload: Buffer.from(JSON.stringify({
                    userId: 'system',
                    key: `${this.agentName}:${key}`
                }))
            };

            this.client.ExecuteTask(task, (err, response) => {
                if (err || response.status !== 'success') {
                    resolve(null);
                } else {
                    const data = JSON.parse(response.result_data || '{}');
                    resolve(data.value || null);
                }
            });
        });
    }

    /**
     * Store data in agent-specific (local) memory
     */
    storeLocal(key, value) {
        this.localMemory.set(key, {
            value,
            timestamp: new Date().toISOString(),
            agent: this.agentName
        });
        console.log(`[${this.agentName}] Stored in local memory: ${key}`);
        return { success: true };
    }

    /**
     * Get data from agent-specific (local) memory
     */
    getLocal(key) {
        const data = this.localMemory.get(key);
        return data ? data.value : null;
    }

    /**
     * Search agent-specific (local) memory
     */
    searchLocal(query) {
        const results = [];
        const lowerQuery = query.toLowerCase();

        this.localMemory.forEach((data, key) => {
            const keyMatch = key.toLowerCase().includes(lowerQuery);
            const valueMatch = JSON.stringify(data.value).toLowerCase().includes(lowerQuery);

            if (keyMatch || valueMatch) {
                results.push({
                    key,
                    value: data.value,
                    timestamp: data.timestamp,
                    source: 'local'
                });
            }
        });

        return results;
    }

    /**
     * Unified search across both mainstream and local memory
     */
    async searchAll(query) {
        const [mainstreamResults, localResults] = await Promise.all([
            this.searchMainstream(query),
            Promise.resolve(this.searchLocal(query))
        ]);

        const combined = [
            ...(mainstreamResults.results || []).map(r => ({ ...r, source: 'mainstream' })),
            ...localResults
        ];

        console.log(`[${this.agentName}] Unified search found ${combined.length} results (${mainstreamResults.results?.length || 0} mainstream, ${localResults.length} local)`);

        return combined;
    }

    /**
     * Get value from either mainstream or local memory (checks both)
     */
    async get(key) {
        // Check local first (faster)
        const localValue = this.getLocal(key);
        if (localValue !== null) {
            console.log(`[${this.agentName}] Retrieved from local memory: ${key}`);
            return { value: localValue, source: 'local' };
        }

        // Check mainstream
        const mainstreamValue = await this.getMainstream(key);
        if (mainstreamValue !== null) {
            console.log(`[${this.agentName}] Retrieved from mainstream memory: ${key}`);
            return { value: mainstreamValue, source: 'mainstream' };
        }

        return null;
    }

    /**
     * Store value in both mainstream and local memory
     */
    async storeBoth(key, value, context = '') {
        const [mainstreamResult, localResult] = await Promise.all([
            this.storeMainstream(key, value, context),
            Promise.resolve(this.storeLocal(key, value))
        ]);

        return {
            mainstream: mainstreamResult.success,
            local: localResult.success,
            success: mainstreamResult.success || localResult.success
        };
    }

    /**
     * Clear local memory
     */
    clearLocal() {
        this.localMemory.clear();
        console.log(`[${this.agentName}] Cleared local memory`);
    }

    /**
     * Get memory statistics
     */
    getStats() {
        return {
            agent: this.agentName,
            localEntries: this.localMemory.size,
            memoryServiceConnected: this.client !== null
        };
    }
}

module.exports = AgentMemoryClient;
