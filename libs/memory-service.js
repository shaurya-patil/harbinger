/**
 * Memory Service Module
 * Provides database-backed memory for agents
 * Supports task history, user aliases, and generic memory storage
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../database/.env') });
const { Pool } = require('pg');

// Database connection pool
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'harbinger',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    min: parseInt(process.env.DB_POOL_MIN || '2'),
    max: parseInt(process.env.DB_POOL_MAX || '10'),
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
});

// Test connection on startup
pool.on('connect', () => {
    console.log('[Memory Service] Connected to PostgreSQL database');
});

pool.on('error', (err) => {
    console.error('[Memory Service] Unexpected database error:', err);
});

// ============================================
// Task History Methods
// ============================================

/**
 * Save task execution to database
 * @param {Object} taskData - Task data
 * @param {string} taskData.taskId - Unique task ID
 * @param {string} taskData.userId - User ID
 * @param {string} taskData.input - Original user input
 * @param {Object} taskData.plan - LLM-generated plan
 * @param {string} taskData.status - Task status
 * @param {Object} taskData.results - Execution results
 * @returns {Promise<Object>} Saved task
 */
async function saveTask(taskData) {
    const { taskId, userId, input, plan, status, results } = taskData;

    try {
        const query = `
            INSERT INTO tasks (task_id, user_id, input, plan, status, results, completed_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (task_id) 
            DO UPDATE SET 
                status = EXCLUDED.status,
                results = EXCLUDED.results,
                completed_at = EXCLUDED.completed_at
            RETURNING *
        `;

        const completedAt = (status === 'completed' || status === 'failed') ? new Date() : null;
        const values = [taskId, userId, input, JSON.stringify(plan), status, JSON.stringify(results), completedAt];

        const result = await pool.query(query, values);
        return result.rows[0];
    } catch (error) {
        console.error('[Memory Service] Error saving task:', error);
        throw error;
    }
}

/**
 * Get task history for a user
 * @param {string} userId - User ID
 * @param {number} limit - Number of tasks to retrieve
 * @returns {Promise<Array>} Task history
 */
async function getTaskHistory(userId, limit = 10) {
    try {
        const query = `
            SELECT * FROM tasks 
            WHERE user_id = $1 
            ORDER BY created_at DESC 
            LIMIT $2
        `;

        const result = await pool.query(query, [userId, limit]);
        return result.rows;
    } catch (error) {
        console.error('[Memory Service] Error getting task history:', error);
        throw error;
    }
}

/**
 * Search tasks by query
 * @param {string} query - Search query
 * @param {string} userId - User ID (optional)
 * @returns {Promise<Array>} Matching tasks
 */
async function searchTasks(query, userId = null) {
    try {
        let sqlQuery, values;

        if (userId) {
            sqlQuery = `
                SELECT * FROM tasks 
                WHERE user_id = $1 AND (
                    input ILIKE $2 OR 
                    plan::text ILIKE $2 OR 
                    results::text ILIKE $2
                )
                ORDER BY created_at DESC
                LIMIT 20
            `;
            values = [userId, `%${query}%`];
        } else {
            sqlQuery = `
                SELECT * FROM tasks 
                WHERE input ILIKE $1 OR 
                      plan::text ILIKE $1 OR 
                      results::text ILIKE $1
                ORDER BY created_at DESC
                LIMIT 20
            `;
            values = [`%${query}%`];
        }

        const result = await pool.query(sqlQuery, values);
        return result.rows;
    } catch (error) {
        console.error('[Memory Service] Error searching tasks:', error);
        throw error;
    }
}

// ============================================
// Alias Management Methods
// ============================================

/**
 * Add a new alias
 * @param {string} userId - User ID
 * @param {string} type - Alias type (email, name, location, etc.)
 * @param {string} value - Alias value
 * @param {string} description - Human-readable description
 * @param {Object} metadata - Additional metadata (optional)
 * @returns {Promise<Object>} Created alias
 */
async function addAlias(userId, type, value, description, metadata = null) {
    try {
        const query = `
            INSERT INTO user_aliases (user_id, alias_type, alias_value, description, metadata)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (alias_type, alias_value) 
            DO UPDATE SET 
                description = EXCLUDED.description,
                metadata = EXCLUDED.metadata
            RETURNING *
        `;

        const values = [userId, type, value, description, metadata ? JSON.stringify(metadata) : null];
        const result = await pool.query(query, values);
        return result.rows[0];
    } catch (error) {
        console.error('[Memory Service] Error adding alias:', error);
        throw error;
    }
}

/**
 * Resolve an alias to get user info
 * @param {string} aliasValue - Alias to resolve
 * @returns {Promise<Object|null>} Alias data or null if not found
 */
async function resolveAlias(aliasValue) {
    try {
        const query = `
            SELECT * FROM user_aliases 
            WHERE alias_value = $1
            LIMIT 1
        `;

        const result = await pool.query(query, [aliasValue]);
        return result.rows[0] || null;
    } catch (error) {
        console.error('[Memory Service] Error resolving alias:', error);
        throw error;
    }
}

/**
 * Get all aliases for a user
 * @param {string} userId - User ID
 * @returns {Promise<Array>} User aliases
 */
async function getUserAliases(userId) {
    try {
        const query = `
            SELECT * FROM user_aliases 
            WHERE user_id = $1 
            ORDER BY alias_type, created_at DESC
        `;

        const result = await pool.query(query, [userId]);
        return result.rows;
    } catch (error) {
        console.error('[Memory Service] Error getting user aliases:', error);
        throw error;
    }
}

/**
 * Get alias by type and value
 * @param {string} type - Alias type
 * @param {string} value - Alias value
 * @returns {Promise<Object|null>} Alias data
 */
async function getAliasByType(type, value) {
    try {
        const query = `
            SELECT * FROM user_aliases 
            WHERE alias_type = $1 AND alias_value = $2
            LIMIT 1
        `;

        const result = await pool.query(query, [type, value]);
        return result.rows[0] || null;
    } catch (error) {
        console.error('[Memory Service] Error getting alias by type:', error);
        throw error;
    }
}

/**
 * Delete an alias
 * @param {number} aliasId - Alias ID
 * @returns {Promise<boolean>} Success status
 */
async function deleteAlias(aliasId) {
    try {
        const query = 'DELETE FROM user_aliases WHERE id = $1';
        await pool.query(query, [aliasId]);
        return true;
    } catch (error) {
        console.error('[Memory Service] Error deleting alias:', error);
        throw error;
    }
}

// ============================================
// Generic Memory Methods
// ============================================

/**
 * Set a memory value
 * @param {string} userId - User ID
 * @param {string} key - Memory key
 * @param {any} value - Memory value (will be JSON stringified)
 * @param {string} context - Context for semantic search (optional)
 * @returns {Promise<Object>} Stored memory
 */
async function setMemory(userId, key, value, context = null) {
    try {
        const query = `
            INSERT INTO agent_memory (user_id, memory_key, memory_value, context)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (user_id, memory_key) 
            DO UPDATE SET 
                memory_value = EXCLUDED.memory_value,
                context = EXCLUDED.context,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *
        `;

        const values = [userId, key, JSON.stringify(value), context];
        const result = await pool.query(query, values);
        return result.rows[0];
    } catch (error) {
        console.error('[Memory Service] Error setting memory:', error);
        throw error;
    }
}

/**
 * Get a memory value
 * @param {string} userId - User ID
 * @param {string} key - Memory key
 * @returns {Promise<any|null>} Memory value or null
 */
async function getMemory(userId, key) {
    try {
        const query = `
            SELECT memory_value FROM agent_memory 
            WHERE user_id = $1 AND memory_key = $2
        `;

        const result = await pool.query(query, [userId, key]);
        return result.rows[0] ? result.rows[0].memory_value : null;
    } catch (error) {
        console.error('[Memory Service] Error getting memory:', error);
        throw error;
    }
}

/**
 * Search memory by context
 * @param {string} userId - User ID
 * @param {string} query - Search query
 * @returns {Promise<Array>} Matching memories
 */
async function searchMemory(userId, query) {
    try {
        const sqlQuery = `
            SELECT * FROM agent_memory 
            WHERE user_id = $1 AND (
                memory_key ILIKE $2 OR 
                context ILIKE $2 OR 
                memory_value::text ILIKE $2
            )
            ORDER BY updated_at DESC
            LIMIT 20
        `;

        const result = await pool.query(sqlQuery, [userId, `%${query}%`]);
        return result.rows;
    } catch (error) {
        console.error('[Memory Service] Error searching memory:', error);
        throw error;
    }
}

/**
 * Delete a memory
 * @param {string} userId - User ID
 * @param {string} key - Memory key
 * @returns {Promise<boolean>} Success status
 */
async function deleteMemory(userId, key) {
    try {
        const query = 'DELETE FROM agent_memory WHERE user_id = $1 AND memory_key = $2';
        await pool.query(query, [userId, key]);
        return true;
    } catch (error) {
        console.error('[Memory Service] Error deleting memory:', error);
        throw error;
    }
}

// ============================================
// Utility Methods
// ============================================

/**
 * Test database connection
 * @returns {Promise<boolean>} Connection status
 */
async function testConnection() {
    try {
        const result = await pool.query('SELECT NOW()');
        console.log('[Memory Service] Database connection successful:', result.rows[0].now);
        return true;
    } catch (error) {
        console.error('[Memory Service] Database connection failed:', error);
        return false;
    }
}

/**
 * Close database connection pool
 */
async function close() {
    await pool.end();
    console.log('[Memory Service] Database connection pool closed');
}

// ============================================
// Exports
// ============================================

module.exports = {
    // Task history
    saveTask,
    getTaskHistory,
    searchTasks,

    // Alias management
    addAlias,
    resolveAlias,
    getUserAliases,
    getAliasByType,
    deleteAlias,

    // Generic memory
    setMemory,
    getMemory,
    searchMemory,
    deleteMemory,

    // Utility
    testConnection,
    close,
    pool
};
