/**
 * Task Logger - Automatically logs task execution to memory
 * Creates comprehensive logs with context, parameters, results, and timing
 */

class TaskLogger {
    constructor(memoryClient, agentName) {
        this.memory = memoryClient;
        this.agentName = agentName;
        this.taskHistory = [];
    }

    /**
     * Log task start
     */
    logTaskStart(taskId, taskType, params) {
        const logEntry = {
            taskId,
            taskType,
            agent: this.agentName,
            params,
            startTime: new Date().toISOString(),
            startTimestamp: Date.now(),
            status: 'started'
        };

        this.taskHistory.push(logEntry);
        console.log(`[${this.agentName}] Task started: ${taskId} - ${taskType}`);

        return logEntry;
    }

    /**
     * Log task completion with full context
     */
    async logTaskComplete(taskId, result, error = null) {
        const logEntry = this.taskHistory.find(t => t.taskId === taskId);

        if (!logEntry) {
            console.warn(`[${this.agentName}] No start log found for task ${taskId}`);
            return;
        }

        const endTime = Date.now();
        const duration = endTime - logEntry.startTimestamp;

        // Update log entry
        logEntry.endTime = new Date().toISOString();
        logEntry.endTimestamp = endTime;
        logEntry.duration = duration;
        logEntry.status = error ? 'failed' : 'success';
        logEntry.result = result;
        logEntry.error = error;

        // Create comprehensive context
        const context = this.buildContext(logEntry);

        // Store in both mainstream and local memory
        const memoryKey = `task_log:${this.agentName}:${taskId}`;

        // Store in mainstream memory (shared across all agents)
        await this.memory.storeMainstream(memoryKey, {
            ...logEntry,
            context
        }, `Task execution log for ${logEntry.taskType}`);

        // Also store in local memory for quick access
        this.memory.storeLocal(memoryKey, {
            ...logEntry,
            context
        });

        // Store a summary in a searchable format
        await this.storeSearchableSummary(logEntry, context);

        console.log(`[${this.agentName}] Task completed: ${taskId} - ${logEntry.status} (${duration}ms)`);

        return logEntry;
    }

    /**
     * Build rich context from task execution
     */
    buildContext(logEntry) {
        const context = {
            // What was done
            action: logEntry.taskType,
            agent: this.agentName,

            // When it happened
            timestamp: logEntry.startTime,
            date: new Date(logEntry.startTime).toLocaleDateString(),
            time: new Date(logEntry.startTime).toLocaleTimeString(),

            // How long it took
            duration: `${logEntry.duration}ms`,

            // What was the input
            input: this.extractKeyInfo(logEntry.params),

            // What was the output
            output: this.extractKeyInfo(logEntry.result),

            // Success or failure
            success: logEntry.status === 'success',

            // Natural language summary
            summary: this.generateSummary(logEntry)
        };

        return context;
    }

    /**
     * Extract key information from params/results
     */
    extractKeyInfo(data) {
        if (!data) return null;

        const keyInfo = {};

        // Extract important fields
        const importantFields = [
            'to', 'from', 'subject', 'title', 'name', 'path', 'file_path',
            'query', 'url', 'email', 'message', 'body', 'content',
            'recipient', 'sender', 'filename', 'sheet', 'range'
        ];

        importantFields.forEach(field => {
            if (data[field] !== undefined) {
                keyInfo[field] = data[field];
            }
        });

        return Object.keys(keyInfo).length > 0 ? keyInfo : data;
    }

    /**
     * Generate natural language summary
     */
    generateSummary(logEntry) {
        const { taskType, params, result, status, agent } = logEntry;

        if (status === 'failed') {
            return `${agent} failed to execute ${taskType}: ${logEntry.error?.message || 'Unknown error'}`;
        }

        // Generate task-specific summaries
        switch (taskType) {
            case 'gmail.send_email':
                return `Sent email to ${params.to} with subject "${params.subject}"`;

            case 'calendar.create_event':
                return `Created calendar event "${params.title}" at ${params.start}`;

            case 'excel.create_workbook':
                return `Created Excel workbook "${params.name}" at ${result?.file_path}`;

            case 'excel.write_range':
                return `Wrote data to ${params.sheet}!${params.range} in ${params.file_path}`;

            case 'browser.navigate':
                return `Navigated to ${params.url}`;

            case 'os.open_app':
                return `Opened application "${params.app_name}"`;

            case 'memory.store':
                return `Stored "${params.key}" in memory`;

            case 'memory.search':
                return `Searched memory for "${params.query}" - found ${result?.results?.length || 0} results`;

            default:
                return `Executed ${taskType} successfully`;
        }
    }

    /**
     * Store searchable summary for easy retrieval
     */
    async storeSearchableSummary(logEntry, context) {
        const summaryKey = `summary:${this.agentName}:${Date.now()}`;

        const searchableData = {
            agent: this.agentName,
            action: logEntry.taskType,
            summary: context.summary,
            timestamp: logEntry.startTime,
            duration: logEntry.duration,
            status: logEntry.status,
            // Extract searchable terms
            terms: this.extractSearchTerms(logEntry, context)
        };

        await this.memory.storeMainstream(summaryKey, searchableData, context.summary);
    }

    /**
     * Extract searchable terms from task
     */
    extractSearchTerms(logEntry, context) {
        const terms = new Set();

        // Add agent name
        terms.add(this.agentName);

        // Add task type
        terms.add(logEntry.taskType);

        // Add key values from input
        if (context.input) {
            Object.values(context.input).forEach(val => {
                if (typeof val === 'string') {
                    terms.add(val.toLowerCase());
                }
            });
        }

        // Add status
        terms.add(logEntry.status);

        return Array.from(terms);
    }

    /**
     * Get recent task history
     */
    getRecentTasks(limit = 10) {
        return this.taskHistory
            .slice(-limit)
            .reverse()
            .map(task => ({
                taskId: task.taskId,
                type: task.taskType,
                status: task.status,
                duration: task.duration,
                timestamp: task.startTime
            }));
    }

    /**
     * Get task statistics
     */
    getStats() {
        const total = this.taskHistory.length;
        const successful = this.taskHistory.filter(t => t.status === 'success').length;
        const failed = this.taskHistory.filter(t => t.status === 'failed').length;
        const avgDuration = total > 0
            ? this.taskHistory.reduce((sum, t) => sum + (t.duration || 0), 0) / total
            : 0;

        return {
            agent: this.agentName,
            totalTasks: total,
            successful,
            failed,
            successRate: total > 0 ? (successful / total * 100).toFixed(2) + '%' : '0%',
            averageDuration: `${avgDuration.toFixed(0)}ms`
        };
    }

    /**
     * Search task history
     */
    async searchTaskHistory(query) {
        // Search mainstream memory for task logs
        const results = await this.memory.searchAll(`task_log ${query}`);

        return results
            .filter(r => r.key?.startsWith('task_log:'))
            .map(r => ({
                taskId: r.value?.taskId,
                type: r.value?.taskType,
                summary: r.value?.context?.summary,
                timestamp: r.value?.startTime,
                status: r.value?.status,
                source: r.source
            }));
    }
}

module.exports = TaskLogger;
