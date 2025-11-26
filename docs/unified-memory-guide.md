# Unified Memory Access for Agents

## Overview

All agents now have access to **two types of memory**:

1. **Mainstream Memory** (Shared) - Accessible by all agents via the memory service
2. **Local Memory** (Agent-specific) - Fast, in-memory cache specific to each agent

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Agent (e.g., Gmail)                  │
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │      AgentMemoryClient                            │ │
│  │                                                   │ │
│  │  ┌──────────────┐        ┌──────────────┐        │ │
│  │  │  Mainstream  │        │    Local     │        │ │
│  │  │    Memory    │        │   Memory     │        │ │
│  │  │  (via gRPC)  │        │  (in-memory) │        │ │
│  │  └──────────────┘        └──────────────┘        │ │
│  └───────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
         │                              │
         │                              │
         ▼                              ▼
┌─────────────────┐          ┌──────────────────┐
│ Memory Service  │          │  Agent's RAM     │
│  (PostgreSQL)   │          │  (Fast Access)   │
└─────────────────┘          └──────────────────┘
```

## Usage

### 1. Initialize Memory Client

```javascript
const AgentMemoryClient = require('../../libs/agent-memory-client');

// Initialize with agent name
const memory = new AgentMemoryClient('gmail');
```

### 2. Store in Mainstream Memory (Shared)

```javascript
// Store data accessible by all agents
await memory.storeMainstream('user_preference', {
    theme: 'dark',
    language: 'en'
}, 'User preferences');

// Stored as: "gmail:user_preference" in system memory
```

### 3. Store in Local Memory (Fast)

```javascript
// Store data specific to this agent instance
memory.storeLocal('last_email_sent', {
    to: 'user@example.com',
    timestamp: Date.now()
});
```

### 4. Search Both Memories

```javascript
// Unified search across mainstream + local
const results = await memory.searchAll('john');

// Returns:
// [
//   { key: 'contact:john', value: {...}, source: 'mainstream' },
//   { key: 'last_contact', value: {...}, source: 'local' }
// ]
```

### 5. Get Value from Either Memory

```javascript
// Checks local first (faster), then mainstream
const result = await memory.get('user_email');

if (result) {
    console.log(`Found in ${result.source}: ${result.value}`);
}
```

### 6. Store in Both Memories

```javascript
// Store in both for redundancy and speed
await memory.storeBoth('important_data', {
    value: 'critical info'
}, 'Important context');
```

## API Reference

### AgentMemoryClient

#### Constructor
```javascript
new AgentMemoryClient(agentName, memoryServiceHost = 'localhost:50066')
```

#### Mainstream Memory Methods

| Method | Description | Returns |
|--------|-------------|---------|
| `storeMainstream(key, value, context)` | Store in shared memory | `Promise<{success, data}>` |
| `getMainstream(key)` | Get from shared memory | `Promise<value \| null>` |
| `searchMainstream(query)` | Search shared memory | `Promise<{success, results}>` |

#### Local Memory Methods

| Method | Description | Returns |
|--------|-------------|---------|
| `storeLocal(key, value)` | Store in agent memory | `{success}` |
| `getLocal(key)` | Get from agent memory | `value \| null` |
| `searchLocal(query)` | Search agent memory | `Array<results>` |
| `clearLocal()` | Clear agent memory | `void` |

#### Unified Methods

| Method | Description | Returns |
|--------|-------------|---------|
| `searchAll(query)` | Search both memories | `Promise<Array<results>>` |
| `get(key)` | Get from either memory | `Promise<{value, source} \| null>` |
| `storeBoth(key, value, context)` | Store in both | `Promise<{mainstream, local, success}>` |
| `getStats()` | Get memory statistics | `{agent, localEntries, memoryServiceConnected}` |

## Integration Examples

### Gmail Agent with Memory

```javascript
const AgentMemoryClient = require('../../libs/agent-memory-client');
const memory = new AgentMemoryClient('gmail');

async function sendEmail(params) {
    let recipient = params.to;
    
    // If not an email, search memory
    if (!isEmail(recipient)) {
        const results = await memory.searchAll(recipient);
        const emailResult = results.find(r => r.value?.email);
        
        if (emailResult) {
            recipient = emailResult.value.email;
            console.log(`Resolved from ${emailResult.source} memory`);
            
            // Cache for next time
            memory.storeLocal(`resolved:${params.to}`, recipient);
        }
    }
    
    // Send email...
    
    // Store send event in mainstream memory
    await memory.storeMainstream(`email_sent_${Date.now()}`, {
        to: recipient,
        subject: params.subject,
        timestamp: new Date().toISOString()
    }, 'Email audit trail');
}
```

### Calendar Agent with Memory

```javascript
const memory = new AgentMemoryClient('calendar');

async function createEvent(params) {
    // Check if user has preferred meeting duration
    const prefs = await memory.get('user_preferences');
    const defaultDuration = prefs?.value?.defaultMeetingDuration || 60;
    
    // Create event...
    
    // Store recent event in local memory
    memory.storeLocal('last_event', {
        title: params.title,
        start: params.start,
        created: Date.now()
    });
    
    // Store in mainstream for other agents to see
    await memory.storeMainstream('recent_calendar_activity', {
        action: 'created_event',
        title: params.title
    }, 'Calendar activity log');
}
```

### Excel Agent with Memory

```javascript
const memory = new AgentMemoryClient('excel');

async function createWorkbook(params) {
    // Check mainstream memory for user's preferred template
    const template = await memory.getMainstream('excel_template');
    
    // Create workbook...
    
    // Store file path in local memory for quick access
    memory.storeLocal(`workbook:${params.name}`, {
        path: filePath,
        created: Date.now()
    });
    
    // Store in mainstream so other agents know about it
    await memory.storeMainstream(`file_created:${params.name}`, {
        type: 'excel',
        path: filePath,
        agent: 'excel'
    }, 'File creation log');
}
```

## Benefits

### 1. **Shared Context**
All agents can access mainstream memory to share information:
- User preferences
- Recent activities
- Contact information
- File locations

### 2. **Fast Local Access**
Agents cache frequently used data locally:
- Recent lookups
- Resolved aliases
- Temporary state

### 3. **Automatic Fallback**
If memory service is unavailable, agents still have local memory.

### 4. **Audit Trail**
Mainstream memory provides a shared audit log of all agent activities.

### 5. **Cross-Agent Coordination**
Agents can coordinate by reading each other's mainstream memory entries.

## Memory Key Naming Convention

### Mainstream Memory
Use prefixed keys to avoid conflicts:
```javascript
// Format: "agentName:keyName"
memory.storeMainstream('user_email', ...)  // Stored as "gmail:user_email"
```

### Local Memory
No prefix needed (agent-specific):
```javascript
memory.storeLocal('cache:last_lookup', ...)
```

## Performance Considerations

### When to Use Mainstream Memory
- Shared data needed by multiple agents
- Persistent data that survives restarts
- Audit trails and logs
- User preferences and settings

### When to Use Local Memory
- Temporary cache
- Frequently accessed data
- Agent-specific state
- Performance-critical lookups

### Best Practice: Hybrid Approach
```javascript
// Check local cache first
let value = memory.getLocal('cached_data');

if (!value) {
    // Fetch from mainstream
    value = await memory.getMainstream('data');
    
    // Cache locally for next time
    if (value) {
        memory.storeLocal('cached_data', value);
    }
}
```

## Migration Guide

### Updating Existing Agents

1. **Install memory client**:
```javascript
const AgentMemoryClient = require('../../libs/agent-memory-client');
const memory = new AgentMemoryClient('your-agent-name');
```

2. **Replace direct memory service calls**:
```javascript
// Old
const alias = await memoryService.resolveAlias(name);

// New
const results = await memory.searchAll(name);
const alias = results.find(r => r.value?.email);
```

3. **Add local caching**:
```javascript
// Cache frequently used data
memory.storeLocal('frequent_data', value);
```

4. **Update health check**:
```javascript
function healthCheck(call, callback) {
    const stats = memory.getStats();
    callback(null, {
        status: 'ok',
        capabilities: [...],
        metadata: JSON.stringify(stats)
    });
}
```

## Monitoring

### Check Memory Stats

```javascript
const stats = memory.getStats();
console.log(stats);
// {
//   agent: 'gmail',
//   localEntries: 15,
//   memoryServiceConnected: true
// }
```

### Clear Local Memory

```javascript
// Clear agent's local cache
memory.clearLocal();
```

## Troubleshooting

### Memory Service Unavailable

If the memory service is down, agents automatically fall back to local memory only:

```
[gmail] Memory service unavailable, cannot store mainstream memory
[gmail] Falling back to local memory only
```

### No Results Found

```javascript
const results = await memory.searchAll('query');
if (results.length === 0) {
    console.log('No results in mainstream or local memory');
    // Handle fallback
}
```

## Next Steps

1. Update all agents to use `AgentMemoryClient`
2. Define shared memory keys convention
3. Implement memory cleanup policies
4. Add memory usage monitoring
5. Create memory backup strategy

## See Also

- [Memory Service Documentation](../database/SETUP.md)
- [Agent Development Guide](../docs/agent-development.md)
- [Memory Usage Examples](../examples/memory-usage.md)
