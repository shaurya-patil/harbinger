# Memory Agent Usage Examples

## Natural Language Commands

The memory agent responds to natural language commands through the orchestrator:

### Store Information

**User:** "Remember that my favorite color is blue"
```json
{
  "tasks": [{
    "id": "1",
    "agent": "memory",
    "action": "memory.store",
    "params": {
      "context": "User's favorite color is blue",
      "value": "blue"
    }
  }]
}
```
→ Key "favorite_color" is auto-extracted

**User:** "Remember that my boss's name is Sarah"
→ Stores: `boss_name` = "Sarah"

**User:** "Remember I prefer meetings in the morning"
→ Stores: `meeting_preference` = "morning"

---

### Retrieve Information

**User:** "What's my favorite color?"
```json
{
  "tasks": [{
    "id": "1",
    "agent": "memory",
    "action": "memory.search",
    "params": {
      "query": "favorite color",
      "semantic": true
    }
  }]
}
```
→ Returns: "blue"

**User:** "What do you remember about my boss?"
→ Searches for "boss" → Returns "Sarah"

---

### Complex Scenarios

**User:** "Send an email to my boss about the project"

Plan:
1. Search memory for "boss" → finds "Sarah"
2. Resolve alias for Sarah's email
3. Send email

**User:** "Schedule a meeting"

Plan:
1. Search memory for "meeting_preference" → finds "morning"
2. Create calendar event with morning time slot

---

## Direct API Usage

### Store Memory
```bash
curl -X POST http://localhost:3000/api/agents/memory/execute \
  -H "Content-Type: application/json" \
  -d '{
    "action": "memory.store",
    "params": {
      "userId": "shaurya",
      "context": "My favorite IDE is VS Code",
      "value": "VS Code"
    }
  }'
```

### Retrieve Memory
```bash
curl -X POST http://localhost:3000/api/agents/memory/execute \
  -H "Content-Type: application/json" \
  -d '{
    "action": "memory.retrieve",
    "params": {
      "userId": "shaurya",
      "key": "favorite_ide"
    }
  }'
```

### Search Memory
```bash
curl -X POST http://localhost:3000/api/agents/memory/execute \
  -H "Content-Type: application/json" \
  -d '{
    "action": "memory.search",
    "params": {
      "userId": "shaurya",
      "query": "preferences",
      "semantic": true
    }
  }'
```

### List All Memories
```bash
curl -X POST http://localhost:3000/api/agents/memory/execute \
  -H "Content-Type: application/json" \
  -d '{
    "action": "memory.list",
    "params": {
      "userId": "shaurya"
    }
  }'
```

### Forget Memory
```bash
curl -X POST http://localhost:3000/api/agents/memory/execute \
  -H "Content-Type: application/json" \
  -d '{
    "action": "memory.forget",
    "params": {
      "userId": "shaurya",
      "key": "favorite_color"
    }
  }'
```

---

## Agent-to-Agent Access

Other agents can query memory during task execution:

### Gmail Agent Example
```javascript
// In gmail-agent-node/index.js
const memoryService = require('../../libs/memory-service');

// Before sending email, check memory for recipient
async function sendEmail(params) {
  // Try to resolve "boss" from memory
  const memories = await memoryService.searchMemory(params.userId, 'boss');
  if (memories.length > 0) {
    const bossName = memories[0].memory_value;
    // Resolve email alias
    const alias = await memoryService.resolveAlias(bossName);
    if (alias) {
      params.to = alias.description;
    }
  }
  // Send email...
}
```

### Calendar Agent Example
```javascript
// Check for meeting preferences
const pref = await memoryService.getMemory(userId, 'meeting_preference');
if (pref && pref.value === 'morning') {
  // Suggest morning time slots
  suggestedTime = '10:00 AM';
}
```

---

## Features

✅ **Auto Key Extraction** - LLM extracts keys from context  
✅ **Semantic Search** - LLM ranks results by relevance  
✅ **Natural Language** - "Remember X" works naturally  
✅ **Cross-Agent Access** - Any agent can query memory  
✅ **Persistent** - Database-backed storage  
✅ **User-Scoped** - Isolated per user  

---

## Common Patterns

### Store User Preferences
```
"Remember that I prefer dark mode"
"Remember my default browser is Chrome"
"Remember I like concise responses"
```

### Store Personal Information
```
"Remember my boss's name is Sarah"
"Remember my dentist appointment is next Tuesday at 2pm"
"Remember my gym membership expires in March"
```

### Query Memory
```
"What do you remember about my preferences?"
"What's my boss's name?"
"When is my dentist appointment?"
```

### Use in Tasks
```
"Send email to my boss" → Queries memory for boss's email
"Schedule a meeting" → Uses meeting preference from memory
"Open my favorite IDE" → Retrieves IDE preference
```
