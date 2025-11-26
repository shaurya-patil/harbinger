# Agent Memory System - Setup Guide

## Prerequisites

1. **PostgreSQL 12+** installed and running
2. **Node.js** and npm installed
3. Harbinger project dependencies installed

---

## Step-by-Step Setup

### 1. Install PostgreSQL

#### Windows (using Chocolatey)
```bash
choco install postgresql
```

#### Windows (Manual Download)
Download from: https://www.postgresql.org/download/windows/

#### Verify Installation
```bash
psql --version
```

---

### 2. Create Database

Open PostgreSQL command line:
```bash
psql -U postgres
```

Create the database:
```sql
CREATE DATABASE harbinger;
\q
```

---

### 3. Initialize Schema

Navigate to your project directory and run:
```bash
cd "c:/Users/shaur/OneDrive/Desktop/DL_Projects/Agentic AI/harbinger"

# Initialize schema
psql -U postgres -d harbinger -f database/schema.sql

# Load initial data (your email aliases)
psql -U postgres -d harbinger -f database/init.sql
```

---

### 4. Configure Database Connection

Copy the example environment file:
```bash
cp database/.env.example database/.env
```

Edit `database/.env` with your PostgreSQL credentials:
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=harbinger
DB_USER=postgres
DB_PASSWORD=your_actual_password

DB_POOL_MIN=2
DB_POOL_MAX=10
DB_IDLE_TIMEOUT=30000
```

---

### 5. Install Dependencies

```bash
npm install
```

This will install:
- `pg` - PostgreSQL client
- `dotenv` - Environment variable management

---

### 6. Test Database Connection

```bash
node database/test-connection.js
```

Expected output:
```
=== Testing Database Connection ===

1. Testing connection...
✅ Connection successful!

2. Checking tables...
Found tables: [ 'tasks', 'user_aliases', 'agent_memory' ]
✅ All tables exist!

3. Testing alias operations...
✅ Added alias: test@example.com
✅ Resolved alias: test_user
✅ Found 1 alias(es) for test_user

4. Testing memory operations...
✅ Set memory
✅ Retrieved memory: { data: 'test value' }
✅ Search found 1 result(s)

5. Cleaning up test data...
✅ Cleanup complete

=== All Tests Passed! ===
Database is ready for use.
```

---

### 7. Restart API Gateway

The API Gateway will automatically connect to the database on startup.

```bash
# Stop current API Gateway (Ctrl+C)
# Restart it
node api-gateway/index.js
```

Look for this message:
```
[API Gateway] Memory service connected - using database storage
```

If you see this instead, check your database configuration:
```
[API Gateway] Database unavailable - using in-memory storage
```

---

## Verify Installation

### Test 1: Add an Alias

```bash
curl -X POST http://localhost:3000/api/memory/alias \
  -H "Content-Type: application/json" \
  -d "{\"userId\":\"shaurya\",\"type\":\"email\",\"value\":\"test@example.com\",\"description\":\"test email\"}"
```

### Test 2: Resolve Alias

```bash
curl http://localhost:3000/api/memory/alias/shauryap71412@gmail.com
```

Expected response:
```json
{
  "id": 1,
  "user_id": "shaurya",
  "alias_type": "email",
  "alias_value": "shauryap71412@gmail.com",
  "description": "personal email",
  "metadata": null,
  "created_at": "2024-11-24T..."
}
```

### Test 3: Get All Aliases

```bash
curl http://localhost:3000/api/memory/aliases/shaurya
```

### Test 4: View in Swagger UI

Open: http://localhost:3000/api-docs

Navigate to the **Memory** section to see all available endpoints.

---

## Pre-loaded Aliases

The `init.sql` script pre-loads these aliases for user "shaurya":

### Emails
- `shauryap71412@gmail.com` → "personal email"
- `shaurya.patil226@nmims.edu.in` → "educational email (NMIMS)"

### Names
- `Shaurya` → "first name"
- `Shaurya Patil` → "full name"
- `SP` → "initials"

### Preferences
- `favorite_ide` → "VS Code"
- `preferred_language` → "JavaScript"
- `default_browser` → "Chrome"

---

## Adding More Aliases

Use the API or add directly to the database:

### Via API
```bash
curl -X POST http://localhost:3000/api/memory/alias \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "shaurya",
    "type": "location",
    "value": "home",
    "description": "123 Main St, Mumbai",
    "metadata": {"coordinates": {"lat": 19.0760, "lng": 72.8777}}
  }'
```

### Via SQL
```sql
INSERT INTO user_aliases (user_id, alias_type, alias_value, description)
VALUES ('shaurya', 'contact', 'phone', '+91-9876543210');
```

---

## Troubleshooting

### Error: "Database connection failed"

**Check:**
1. PostgreSQL is running: `pg_ctl status`
2. Database exists: `psql -U postgres -l | grep harbinger`
3. Credentials in `database/.env` are correct
4. Port 5432 is not blocked by firewall

### Error: "relation does not exist"

**Solution:** Run the schema initialization:
```bash
psql -U postgres -d harbinger -f database/schema.sql
```

### Error: "password authentication failed"

**Solution:** Update your PostgreSQL password or edit `database/.env`

### Fallback Mode

If the database is unavailable, the API Gateway will automatically fall back to in-memory storage. This means:
- ✅ System continues to work
- ❌ Data is lost on restart
- ⚠️ No persistent memory

---

## Database Management

### View Tables
```bash
psql -U postgres -d harbinger
\dt
```

### View Aliases
```sql
SELECT * FROM user_aliases WHERE user_id = 'shaurya';
```

### View Task History
```sql
SELECT task_id, status, created_at FROM tasks ORDER BY created_at DESC LIMIT 10;
```

### Clear All Data
```sql
TRUNCATE TABLE tasks, user_aliases, agent_memory RESTART IDENTITY CASCADE;
```

### Backup Database
```bash
pg_dump -U postgres harbinger > harbinger_backup.sql
```

### Restore Database
```bash
psql -U postgres -d harbinger < harbinger_backup.sql
```

---

## Next Steps

1. ✅ Database is set up and running
2. ✅ Aliases are pre-loaded
3. ✅ API endpoints are available
4. 🔄 Test with orchestrator: Submit a task and verify it's stored in database
5. 🔄 Add more aliases as needed
6. 🔄 Integrate alias resolution into agents (future enhancement)

---

## API Endpoints Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/memory/alias` | POST | Add alias |
| `/api/memory/alias/:value` | GET | Resolve alias |
| `/api/memory/aliases/:userId` | GET | List all aliases |
| `/api/memory/tasks` | GET | Get task history |
| `/api/memory/search` | POST | Search tasks/memory |
| `/api/memory/set` | POST | Store memory |
| `/api/memory/get/:key` | GET | Retrieve memory |

Full API documentation: http://localhost:3000/api-docs

---

## Support

For issues or questions, refer to:
- [Implementation Plan](file:///C:/Users/shaur/.gemini/antigravity/brain/8a306953-673c-4cb7-b50d-2c5f34bd69fa/implementation_plan.md)
- [Usage Examples](file:///c:/Users/shaur/OneDrive/Desktop/DL_Projects/Agentic%20AI/harbinger/examples/memory-usage.md)
- PostgreSQL Documentation: https://www.postgresql.org/docs/
