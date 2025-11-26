# Memory & Alias System - Usage Examples

## Overview
The agent memory system supports flexible aliases beyond just email mappings. Agents can remember and resolve various types of information about you.

---

## Alias Types & Examples

### 1. Email Aliases
Map multiple email addresses to descriptive names:

```bash
# Add personal email
curl -X POST http://localhost:3000/api/memory/alias \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "shaurya",
    "type": "email",
    "value": "shauryap71412@gmail.com",
    "description": "personal email"
  }'

# Add educational email
curl -X POST http://localhost:3000/api/memory/alias \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "shaurya",
    "type": "email",
    "value": "shaurya.patil226@nmims.edu.in",
    "description": "educational email (NMIMS)"
  }'
```

**Agent Usage:**
- "Send email to my educational mail" → resolves to `shaurya.patil226@nmims.edu.in`
- "Email my personal account" → resolves to `shauryap71412@gmail.com`

---

### 2. Name Aliases
Multiple name variations that refer to you:

```bash
# Full name
curl -X POST http://localhost:3000/api/memory/alias \
  -d '{
    "userId": "shaurya",
    "type": "name",
    "value": "Shaurya Patil",
    "description": "full name"
  }'

# Nickname
curl -X POST http://localhost:3000/api/memory/alias \
  -d '{
    "userId": "shaurya",
    "type": "nickname",
    "value": "SP",
    "description": "initials"
  }'
```

**Agent Usage:**
- All references to "Shaurya", "SP", or "Shaurya Patil" map to the same user

---

### 3. Location Aliases
Shortcuts for frequently used places:

```bash
# Home address
curl -X POST http://localhost:3000/api/memory/alias \
  -d '{
    "userId": "shaurya",
    "type": "location",
    "value": "home",
    "description": "123 Main St, Mumbai, Maharashtra 400001",
    "metadata": {"coordinates": {"lat": 19.0760, "lng": 72.8777}}
  }'

# College
curl -X POST http://localhost:3000/api/memory/alias \
  -d '{
    "userId": "shaurya",
    "type": "location",
    "value": "college",
    "description": "NMIMS Campus, Mumbai"
  }'

# Office
curl -X POST http://localhost:3000/api/memory/alias \
  -d '{
    "userId": "shaurya",
    "type": "location",
    "value": "office",
    "description": "Tech Park, Powai"
  }'
```

**Agent Usage:**
- "Navigate to home" → uses full address
- "What's the weather at college?" → uses NMIMS location

---

### 4. Preference Aliases
Store user preferences and favorites:

```bash
# Favorite IDE
curl -X POST http://localhost:3000/api/memory/alias \
  -d '{
    "userId": "shaurya",
    "type": "preference",
    "value": "favorite_ide",
    "description": "VS Code"
  }'

# Preferred programming language
curl -X POST http://localhost:3000/api/memory/alias \
  -d '{
    "userId": "shaurya",
    "type": "preference",
    "value": "preferred_language",
    "description": "JavaScript"
  }'

# Default browser
curl -X POST http://localhost:3000/api/memory/alias \
  -d '{
    "userId": "shaurya",
    "type": "preference",
    "value": "default_browser",
    "description": "Chrome"
  }'
```

**Agent Usage:**
- "Open my favorite IDE" → opens VS Code
- "Create a new project in my preferred language" → uses JavaScript

---

### 5. Contact Aliases
Phone numbers, social handles, etc.:

```bash
# Phone number
curl -X POST http://localhost:3000/api/memory/alias \
  -d '{
    "userId": "shaurya",
    "type": "contact",
    "value": "phone",
    "description": "+91-9876543210"
  }'

# GitHub
curl -X POST http://localhost:3000/api/memory/alias \
  -d '{
    "userId": "shaurya",
    "type": "contact",
    "value": "github",
    "description": "shaurya-patil"
  }'
```

**Agent Usage:**
- "Call my phone" → uses stored number
- "Open my GitHub profile" → navigates to github.com/shaurya-patil

---

### 6. Custom Aliases
Any other user-defined mappings:

```bash
# Favorite color
curl -X POST http://localhost:3000/api/memory/alias \
  -d '{
    "userId": "shaurya",
    "type": "custom",
    "value": "favorite_color",
    "description": "blue"
  }'

# Project path
curl -X POST http://localhost:3000/api/memory/alias \
  -d '{
    "userId": "shaurya",
    "type": "custom",
    "value": "harbinger_project",
    "description": "C:/Users/shaur/OneDrive/Desktop/DL_Projects/Agentic AI/harbinger"
  }'
```

---

## Resolving Aliases

### API Endpoint
```bash
# Resolve any alias
curl http://localhost:3000/api/memory/alias/shauryap71412@gmail.com

# Response:
{
  "userId": "shaurya",
  "type": "email",
  "value": "shauryap71412@gmail.com",
  "description": "personal email"
}
```

### In Agent Code
```javascript
const memoryService = require('../libs/memory-service');

// Resolve email
const emailAlias = await memoryService.resolveAlias('shauryap71412@gmail.com');
console.log(emailAlias.userId); // "shaurya"
console.log(emailAlias.description); // "personal email"

// Get all aliases for user
const aliases = await memoryService.getUserAliases('shaurya');
// Returns all emails, names, locations, preferences, etc.
```

---

## Task History

### Store Task
```javascript
await memoryService.saveTask({
  taskId: 'task-123',
  userId: 'shaurya',
  input: 'Send email to my educational mail about project update',
  plan: { /* LLM-generated plan */ },
  status: 'completed',
  results: { /* execution results */ }
});
```

### Retrieve History
```bash
# Get recent tasks
curl http://localhost:3000/api/memory/tasks?userId=shaurya&limit=10

# Search tasks
curl -X POST http://localhost:3000/api/memory/search \
  -d '{
    "userId": "shaurya",
    "query": "emails sent last week"
  }'
```

---

## Generic Memory Storage

### Store Custom Memory
```bash
curl -X POST http://localhost:3000/api/memory/set \
  -d '{
    "userId": "shaurya",
    "key": "meeting_notes_2024_11_24",
    "value": {
      "topic": "Project Review",
      "attendees": ["Shaurya", "Team Lead"],
      "action_items": ["Update documentation", "Fix bugs"]
    },
    "context": "Meeting notes from project review on November 24, 2024"
  }'
```

### Retrieve Memory
```bash
curl http://localhost:3000/api/memory/get/meeting_notes_2024_11_24?userId=shaurya
```

---

## Real-World Examples

### Example 1: Smart Email Sending
**User:** "Send an email to my educational mail about the assignment"

**Agent Resolution:**
1. Resolves "educational mail" → `shaurya.patil226@nmims.edu.in`
2. Sends email to the correct address
3. Stores task in history

---

### Example 2: Location-Based Tasks
**User:** "What's the weather at home?"

**Agent Resolution:**
1. Resolves "home" → "123 Main St, Mumbai"
2. Fetches weather for that location
3. Returns result

---

### Example 3: Preference-Based Actions
**User:** "Open my favorite IDE and create a new project"

**Agent Resolution:**
1. Resolves "favorite IDE" → "VS Code"
2. Opens VS Code
3. Creates project in preferred language (JavaScript)

---

## Benefits

✅ **Natural Language**: Speak naturally without remembering exact details  
✅ **Context Aware**: Agents remember your preferences and history  
✅ **Flexible**: Add any type of alias or memory  
✅ **Persistent**: Survives restarts, stored in database  
✅ **Searchable**: Query past tasks and memories  

---

## API Reference

### Alias Endpoints
- `POST /api/memory/alias` - Add alias
- `GET /api/memory/alias/:value` - Resolve alias
- `GET /api/memory/aliases/:userId` - List all aliases
- `DELETE /api/memory/alias/:id` - Remove alias

### Task History Endpoints
- `GET /api/memory/tasks` - Get task history
- `POST /api/memory/search` - Search tasks

### Generic Memory Endpoints
- `POST /api/memory/set` - Store memory
- `GET /api/memory/get/:key` - Retrieve memory
- `DELETE /api/memory/:key` - Delete memory
