# Memory Agent

Centralized knowledge storage agent for the Harbinger system.

## Port
50066

## Capabilities

1. **memory.store** - Store information
   - Auto-extracts key from context using LLM
   - Stores value with optional context
   
2. **memory.retrieve** - Get specific memory
   - Retrieves by exact key match
   
3. **memory.search** - Search memories
   - Full-text search with optional LLM semantic ranking
   
4. **memory.list** - List all memories
   - Returns all memories for user
   
5. **memory.forget** - Delete memory
   - Removes specific memory by key

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment:
   ```bash
   cp .env.example .env
   # Edit .env with your GROQ_API_KEY
   ```

3. Start agent:
   ```bash
   npm start
   ```

## Usage Examples

### Store Memory
```javascript
{
  action: "memory.store",
  params: {
    userId: "shaurya",
    context: "My favorite color is blue",
    value: "blue"
    // key will be auto-extracted as "favorite_color"
  }
}
```

### Retrieve Memory
```javascript
{
  action: "memory.retrieve",
  params: {
    userId: "shaurya",
    key: "favorite_color"
  }
}
```

### Search Memory
```javascript
{
  action: "memory.search",
  params: {
    userId: "shaurya",
    query: "preferences",
    semantic: true  // Enable LLM ranking
  }
}
```

## Natural Language Commands

The orchestrator will automatically route these commands to the memory agent:

- "Remember that X" → memory.store
- "What do you remember about X?" → memory.search
- "What's my X?" → memory.retrieve
- "Forget about X" → memory.forget

## Features

- **LLM-Powered**: Automatic key extraction and semantic search
- **Database-Backed**: Persistent storage via memory-service
- **User-Scoped**: Isolated memories per user
- **Cross-Agent Access**: Other agents can query memories
