# Jarvis API Gateway Documentation

The API Gateway provides REST and WebSocket access to the Jarvis agent system.

## Base URL
```
http://localhost:3000
```

## WebSocket URL
```
ws://localhost:3000/ws
```

---

## REST API Endpoints

### Health Check

**GET** `/health`

Check if the API Gateway is running.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-11-24T05:00:00.000Z"
}
```

---

### List All Agents

**GET** `/api/agents`

Get a list of all available agents.

**Response:**
```json
{
  "agents": [
    { "name": "calendar", "port": 50051 },
    { "name": "gmail", "port": 50052 },
    { "name": "browser", "port": 50053 },
    ...
  ]
}
```

---

### Check Agent Health

**GET** `/api/agents/:agentName/health`

Check the health status of a specific agent.

**Parameters:**
- `agentName` (path) - Name of the agent (e.g., "calendar", "gmail")

**Example:**
```bash
curl http://localhost:3000/api/agents/calendar/health
```

**Response:**
```json
{
  "agent": "calendar",
  "status": "ok",
  "capabilities": ["calendar.create_event", "calendar.list_events"]
}
```

---

### Execute Task on Specific Agent

**POST** `/api/agents/:agentName/execute`

Execute a task directly on a specific agent.

**Parameters:**
- `agentName` (path) - Name of the agent

**Request Body:**
```json
{
  "action": "calendar.create_event",
  "params": {
    "summary": "Team Meeting",
    "start": "2025-11-25T10:00:00Z",
    "end": "2025-11-25T11:00:00Z"
  }
}
```

**Example:**
```bash
curl -X POST http://localhost:3000/api/agents/calendar/execute \
  -H "Content-Type: application/json" \
  -d '{
    "action": "calendar.create_event",
    "params": {
      "summary": "Team Meeting",
      "start": "2025-11-25T10:00:00Z",
      "end": "2025-11-25T11:00:00Z"
    }
  }'
```

**Response:**
```json
{
  "taskId": "task-1",
  "result": {
    "id": "task-1",
    "status": "success",
    "result_data": "{\"eventId\":\"abc123\"}"
  }
}
```

---

### Submit Orchestrator Task

**POST** `/api/orchestrator/task`

Submit a natural language task to the orchestrator. The orchestrator will plan and execute the task using multiple agents.

**Request Body:**
```json
{
  "input": "Create a meeting tomorrow at 3pm and send an email to john@example.com about it"
}
```

**Example:**
```bash
curl -X POST http://localhost:3000/api/orchestrator/task \
  -H "Content-Type: application/json" \
  -d '{
    "input": "Create a meeting tomorrow at 3pm and send an email to john@example.com about it"
  }'
```

**Response:**
```json
{
  "taskId": "orchestrator-1",
  "status": "planned",
  "plan": {
    "tasks": [
      {
        "id": "1",
        "action": "calendar.create_event",
        "agent": "calendar",
        "params": { ... }
      },
      {
        "id": "2",
        "action": "gmail.send_email",
        "agent": "gmail",
        "params": { ... },
        "depends_on": ["1"]
      }
    ]
  }
}
```

---

### Get Task Status

**GET** `/api/orchestrator/task/:taskId`

Get the status and results of a previously submitted orchestrator task.

**Parameters:**
- `taskId` (path) - Task ID returned from POST /api/orchestrator/task

**Example:**
```bash
curl http://localhost:3000/api/orchestrator/task/orchestrator-1
```

**Response:**
```json
{
  "id": "orchestrator-1",
  "input": "Create a meeting tomorrow at 3pm...",
  "plan": { ... },
  "status": "completed",
  "results": [
    {
      "id": "1",
      "status": "success",
      "result_data": "..."
    },
    {
      "id": "2",
      "status": "success",
      "result_data": "..."
    }
  ],
  "createdAt": "2025-11-24T05:00:00.000Z",
  "completedAt": "2025-11-24T05:00:15.000Z"
}
```

---

### List All Tasks

**GET** `/api/orchestrator/tasks`

Get a list of all orchestrator tasks.

**Response:**
```json
{
  "tasks": [
    {
      "id": "orchestrator-1",
      "input": "...",
      "status": "completed",
      "createdAt": "2025-11-24T05:00:00.000Z"
    },
    ...
  ]
}
```

---

## WebSocket API

Connect to `ws://localhost:3000/ws` to receive real-time updates about task execution.

### Connection

```javascript
const ws = new WebSocket('ws://localhost:3000/ws');

ws.onopen = () => {
  console.log('Connected to Jarvis API Gateway');
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received:', data);
};
```

### Message Types

#### Connected
```json
{
  "type": "connected",
  "message": "Connected to Jarvis API Gateway"
}
```

#### Task Planned
```json
{
  "type": "task_planned",
  "taskId": "orchestrator-1",
  "plan": { ... }
}
```

#### Task Executing
```json
{
  "type": "task_executing",
  "taskId": "orchestrator-1",
  "currentTask": "1"
}
```

#### Task Completed
```json
{
  "type": "task_completed",
  "taskId": "orchestrator-1",
  "taskResult": {
    "id": "1",
    "status": "success",
    "result_data": "..."
  }
}
```

#### Orchestrator Completed
```json
{
  "type": "orchestrator_completed",
  "taskId": "orchestrator-1",
  "results": [ ... ]
}
```

---

## Error Responses

All endpoints may return error responses in the following format:

```json
{
  "error": "Error message description"
}
```

Common HTTP status codes:
- `400` - Bad Request (missing required fields)
- `404` - Not Found (agent or task not found)
- `500` - Internal Server Error

---

## Setup

1. Install dependencies:
```bash
cd api-gateway
npm install
```

2. Configure environment:
```bash
cp .env.example .env
# Edit .env and add your GROQ_API_KEY
```

3. Start the server:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

---

## Example Usage

### Python Client
```python
import requests

# Submit a task
response = requests.post('http://localhost:3000/api/orchestrator/task', json={
    'input': 'Search for the latest AI news and summarize it'
})
task_id = response.json()['taskId']

# Check status
status = requests.get(f'http://localhost:3000/api/orchestrator/task/{task_id}')
print(status.json())
```

### JavaScript Client
```javascript
// Submit a task
const response = await fetch('http://localhost:3000/api/orchestrator/task', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    input: 'Create a Python calculator app with tests'
  })
});

const { taskId } = await response.json();

// Listen for updates via WebSocket
const ws = new WebSocket('ws://localhost:3000/ws');
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.taskId === taskId) {
    console.log('Task update:', data);
  }
};
```

### cURL Examples
```bash
# Health check
curl http://localhost:3000/health

# List agents
curl http://localhost:3000/api/agents

# Execute on specific agent
curl -X POST http://localhost:3000/api/agents/humanizer/execute \
  -H "Content-Type: application/json" \
  -d '{"action":"humanizer.humanize_content","params":{"content":"AI is cool"}}'

# Submit orchestrator task
curl -X POST http://localhost:3000/api/orchestrator/task \
  -H "Content-Type: application/json" \
  -d '{"input":"humanize the content in ai-written.txt"}'
```
