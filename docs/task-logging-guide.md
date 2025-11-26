# Automatic Task Logging System

## Overview

Every task executed by any agent is now **automatically logged to memory** with comprehensive context, timing, and execution details. This creates a rich, searchable history that all agents can reference.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Agent Execution                       │
│                                                          │
│  1. Task Start  ──────────────────────────────────────┐ │
│     │                                                  │ │
│     ├─► TaskLogger.logTaskStart()                     │ │
│     │   - Capture params                              │ │
│     │   - Record start time                           │ │
│     │                                                  │ │
│  2. Task Execution                                     │ │
│     │                                                  │ │
│  3. Task Complete ────────────────────────────────────┤ │
│     │                                                  │ │
│     ├─► TaskLogger.logTaskComplete()                  │ │
│         - Capture result                              │ │
│         - Calculate duration                          │ │
│         - Build context                               │ │
│         - Generate summary                            │ │
│         │                                             │ │
│         ├─► Store in Mainstream Memory                │ │
│         │   (shared across all agents)                │ │
│         │                                             │ │
│         └─► Store in Local Memory                     │ │
│             (fast agent-specific access)              │ │
└─────────────────────────────────────────────────────────┘
```

## What Gets Logged

### Task Log Entry Structure

```javascript
{
  // Identification
  taskId: "task-123",
  taskType: "gmail.send_email",
  agent: "gmail",
  
  // Timing
  startTime: "2025-11-24T17:30:00.000Z",
  endTime: "2025-11-24T17:30:02.500Z",
  duration: 2500, // milliseconds
  
  // Execution
  status: "success", // or "failed"
  params: { to: "john@example.com", subject: "Hello" },
  result: { messageId: "abc123", recipient: "john@example.com" },
  error: null,
  
  // Rich Context
  context: {
    action: "gmail.send_email",
    agent: "gmail",
    timestamp: "2025-11-24T17:30:00.000Z",
    date: "11/24/2025",
    time: "5:30:00 PM",
    duration: "2500ms",
    input: { to: "john@example.com", subject: "Hello" },
    output: { messageId: "abc123" },
    success: true,
    summary: "Sent email to john@example.com with subject \"Hello\"",
    terms: ["gmail", "send_email", "john@example.com", "success"]
  }
}
```

## Usage

### 1. Initialize Task Logger

```javascript
const AgentMemoryClient = require('../../libs/agent-memory-client');
const TaskLogger = require('../../libs/task-logger');

const memory = new AgentMemoryClient('gmail');
const taskLogger = new TaskLogger(memory, 'gmail');
```

### 2. Log Task Start

```javascript
async function executeTask(call, callback) {
    const task = call.request;
    const params = JSON.parse(task.payload.toString());
    
    // Log task start
    taskLogger.logTaskStart(task.id, task.type, params);
    
    // ... execute task
}
```

### 3. Log Task Completion

```javascript
try {
    // Execute task
    const result = await sendEmail(params);
    
    // Log success
    await taskLogger.logTaskComplete(task.id, result);
    
    callback(null, { status: 'success', result_data: JSON.stringify(result) });
} catch (error) {
    // Log failure
    await taskLogger.logTaskComplete(task.id, null, error);
    
    callback(null, { status: 'fail', error_message: error.message });
}
```

## Natural Language Summaries

The logger automatically generates human-readable summaries:

### Email Tasks
```
"Sent email to john@example.com with subject \"Meeting Tomorrow\""
"Failed to send email: Invalid recipient address"
```

### Calendar Tasks
```
"Created calendar event \"Team Meeting\" at 2025-11-25T14:00:00Z"
"Updated event \"Project Review\" - changed time to 3pm"
```

### Excel Tasks
```
"Created Excel workbook \"Sales_Report\" at C:/Users/.../Sales_Report.xlsx"
"Wrote data to Sheet1!A1:C10 in monthly_data.xlsx"
```

### Browser Tasks
```
"Navigated to https://example.com"
"Clicked element #submit-button on login page"
```

### Memory Tasks
```
"Stored \"user_preferences\" in memory"
"Searched memory for \"john\" - found 5 results"
```

## Searching Task History

### Search All Task Logs

```javascript
// Search for tasks related to "john"
const results = await taskLogger.searchTaskHistory('john');

// Returns:
// [
//   {
//     taskId: "task-123",
//     type: "gmail.send_email",
//     summary: "Sent email to john@example.com...",
//     timestamp: "2025-11-24T17:30:00.000Z",
//     status: "success",
//     source: "mainstream"
//   }
// ]
```

### Get Recent Tasks

```javascript
const recent = taskLogger.getRecentTasks(10);

// Returns last 10 tasks:
// [
//   { taskId: "task-125", type: "gmail.send_email", status: "success", duration: 2500 },
//   { taskId: "task-124", type: "calendar.create_event", status: "success", duration: 1200 },
//   ...
// ]
```

### Get Task Statistics

```javascript
const stats = taskLogger.getStats();

// Returns:
// {
//   agent: "gmail",
//   totalTasks: 150,
//   successful: 145,
//   failed: 5,
//   successRate: "96.67%",
//   averageDuration: "1850ms"
// }
```

## Memory Storage

### Mainstream Memory (Shared)

Task logs are stored in mainstream memory with keys:
```
task_log:gmail:task-123
task_log:calendar:task-456
task_log:excel:task-789
```

All agents can search and read these logs.

### Local Memory (Agent-Specific)

Logs are also cached locally for fast access by the same agent.

### Searchable Summaries

Additional summary entries are stored for efficient searching:
```
summary:gmail:1732467000000
summary:calendar:1732467001000
```

## Benefits

### 1. **Complete Audit Trail**
Every action is logged with full context:
- What was done
- When it happened
- Who did it (which agent)
- What was the input
- What was the output
- How long it took
- Success or failure

### 2. **Cross-Agent Learning**
Agents can learn from each other's history:
```javascript
// Calendar agent can see what emails were sent
const emailLogs = await memory.searchAll('gmail send_email john');

// Excel agent can see what files were created
const fileLogs = await memory.searchAll('excel create_workbook');
```

### 3. **Debugging & Troubleshooting**
Easily find failed tasks and their errors:
```javascript
const failedTasks = await memory.searchAll('task_log failed');
```

### 4. **Performance Monitoring**
Track task durations and success rates:
```javascript
const stats = taskLogger.getStats();
console.log(`Success rate: ${stats.successRate}`);
console.log(`Average duration: ${stats.averageDuration}`);
```

### 5. **Context-Aware Responses**
Agents can reference past actions:
```
User: "Did you send that email to John?"
Agent: *searches task logs* "Yes, I sent an email to john@example.com 
       at 5:30 PM with subject 'Meeting Tomorrow'"
```

## Integration Examples

### Gmail Agent

```javascript
const memory = new AgentMemoryClient('gmail');
const taskLogger = new TaskLogger(memory, 'gmail');

async function sendEmail(task, params) {
    taskLogger.logTaskStart(task.id, 'gmail.send_email', params);
    
    try {
        const result = await transporter.sendMail({...});
        await taskLogger.logTaskComplete(task.id, result);
        return result;
    } catch (error) {
        await taskLogger.logTaskComplete(task.id, null, error);
        throw error;
    }
}
```

### Excel Agent

```javascript
const memory = new AgentMemoryClient('excel');
const taskLogger = new TaskLogger(memory, 'excel');

async function createWorkbook(task, params) {
    taskLogger.logTaskStart(task.id, 'excel.create_workbook', params);
    
    try {
        const filePath = await createExcelFile(params);
        const result = { file_path: filePath, name: params.name };
        await taskLogger.logTaskComplete(task.id, result);
        return result;
    } catch (error) {
        await taskLogger.logTaskComplete(task.id, null, error);
        throw error;
    }
}
```

### Calendar Agent

```javascript
const memory = new AgentMemoryClient('calendar');
const taskLogger = new TaskLogger(memory, 'calendar');

async function createEvent(task, params) {
    taskLogger.logTaskStart(task.id, 'calendar.create_event', params);
    
    try {
        const event = await calendar.events.insert({...});
        const result = { eventId: event.id, link: event.htmlLink };
        await taskLogger.logTaskComplete(task.id, result);
        return result;
    } catch (error) {
        await taskLogger.logTaskComplete(task.id, null, error);
        throw error;
    }
}
```

## Advanced Features

### Custom Summary Generation

Override the summary generator for custom messages:

```javascript
taskLogger.generateSummary = function(logEntry) {
    // Custom logic
    return `My custom summary for ${logEntry.taskType}`;
};
```

### Extract Custom Search Terms

Add domain-specific search terms:

```javascript
taskLogger.extractSearchTerms = function(logEntry, context) {
    const terms = new Set();
    // Add custom terms
    if (logEntry.params.projectId) {
        terms.add(`project:${logEntry.params.projectId}`);
    }
    return Array.from(terms);
};
```

## Health Check Integration

Task statistics are included in agent health checks:

```javascript
function healthCheck(call, callback) {
    const memoryStats = memory.getStats();
    const taskStats = taskLogger.getStats();
    
    callback(null, {
        status: 'ok',
        capabilities: ['gmail.send_email'],
        metadata: JSON.stringify({
            memory: memoryStats,
            tasks: taskStats
        })
    });
}
```

## Querying Task Logs

### Find All Tasks by Agent

```javascript
const gmailTasks = await memory.searchAll('task_log:gmail');
```

### Find Tasks by Type

```javascript
const emailTasks = await memory.searchAll('send_email');
```

### Find Tasks by Date

```javascript
const todayTasks = await memory.searchAll('2025-11-24');
```

### Find Failed Tasks

```javascript
const failures = await memory.searchAll('task_log failed');
```

### Find Tasks by Duration

```javascript
const slowTasks = taskLogger.taskHistory.filter(t => t.duration > 5000);
```

## Best Practices

### 1. **Always Log Both Start and Complete**
```javascript
taskLogger.logTaskStart(taskId, type, params);
try {
    const result = await execute();
    await taskLogger.logTaskComplete(taskId, result);
} catch (error) {
    await taskLogger.logTaskComplete(taskId, null, error);
}
```

### 2. **Include Meaningful Context**
```javascript
// Good
params = { to: 'john@example.com', subject: 'Meeting' }

// Bad
params = { data: {...} }  // Too generic
```

### 3. **Use Consistent Task Types**
```javascript
// Good
'gmail.send_email', 'calendar.create_event'

// Bad
'send', 'create'  // Too vague
```

### 4. **Clean Up Old Logs Periodically**
```javascript
// Implement log rotation
if (taskLogger.taskHistory.length > 1000) {
    taskLogger.taskHistory = taskLogger.taskHistory.slice(-500);
}
```

## Migration Guide

### Update Existing Agents

1. **Add imports**:
```javascript
const AgentMemoryClient = require('../../libs/agent-memory-client');
const TaskLogger = require('../../libs/task-logger');
```

2. **Initialize**:
```javascript
const memory = new AgentMemoryClient('your-agent-name');
const taskLogger = new TaskLogger(memory, 'your-agent-name');
```

3. **Wrap task execution**:
```javascript
async function executeTask(call, callback) {
    const task = call.request;
    const params = JSON.parse(task.payload.toString());
    
    taskLogger.logTaskStart(task.id, task.type, params);
    
    try {
        const result = await yourTaskLogic(params);
        await taskLogger.logTaskComplete(task.id, result);
        callback(null, { status: 'success', result_data: JSON.stringify(result) });
    } catch (error) {
        await taskLogger.logTaskComplete(task.id, null, error);
        callback(null, { status: 'fail', error_message: error.message });
    }
}
```

## See Also

- [Unified Memory Guide](./unified-memory-guide.md)
- [Agent Development Guide](./agent-development.md)
- [Memory Service Documentation](../database/SETUP.md)
