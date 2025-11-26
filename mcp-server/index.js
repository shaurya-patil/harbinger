const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} = require("@modelcontextprotocol/sdk/types.js");
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// Redirect console.log to console.error to avoid breaking MCP JSON-RPC on stdout
const originalLog = console.log;
console.log = (...args) => {
    console.error(...args);
};


// Load proto
const PROTO_PATH = path.join(__dirname, '../libs/proto/task.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
});
const taskProto = grpc.loadPackageDefinition(packageDefinition).jarvis;

// Initialize gRPC clients
// We map the agent name to its gRPC client
const agents = {
    calendar: new taskProto.Agent('localhost:50051', grpc.credentials.createInsecure()),
    gmail: new taskProto.Agent('localhost:50052', grpc.credentials.createInsecure()),
    browser: new taskProto.Agent('localhost:50053', grpc.credentials.createInsecure()),
    os: new taskProto.Agent('localhost:50054', grpc.credentials.createInsecure()),
    humanizer: new taskProto.Agent('localhost:50055', grpc.credentials.createInsecure()),
    interpreter: new taskProto.Agent('localhost:50056', grpc.credentials.createInsecure()),
    planner: new taskProto.Agent('localhost:50057', grpc.credentials.createInsecure()),
    codegen: new taskProto.Agent('localhost:50058', grpc.credentials.createInsecure()),
    execution: new taskProto.Agent('localhost:50059', grpc.credentials.createInsecure()),
    debugger: new taskProto.Agent('localhost:50060', grpc.credentials.createInsecure()),
    qa: new taskProto.Agent('localhost:50061', grpc.credentials.createInsecure()),
    reviewer: new taskProto.Agent('localhost:50062', grpc.credentials.createInsecure()),
    dependency: new taskProto.Agent('localhost:50063', grpc.credentials.createInsecure()),
    docs: new taskProto.Agent('localhost:50064', grpc.credentials.createInsecure()),
    research: new taskProto.Agent('localhost:50065', grpc.credentials.createInsecure()),
    memory: new taskProto.Agent('localhost:50066', grpc.credentials.createInsecure()),
    excel: new taskProto.Agent('localhost:50067', grpc.credentials.createInsecure())
};

// Helper: Execute a single task via gRPC
async function executeTask(agentName, action, params) {
    return new Promise((resolve, reject) => {
        const client = agents[agentName];
        if (!client) {
            reject(new Error(`Unknown agent: ${agentName}`));
            return;
        }

        const grpcTask = {
            id: `mcp-${Date.now()}`,
            type: action,
            metadata: {},
            payload: Buffer.from(JSON.stringify(params || {})),
            depends_on: [],
            retry_count: 0
        };

        client.ExecuteTask(grpcTask, (err, response) => {
            if (err) {
                reject(err);
            } else {
                resolve(response);
            }
        });
    });
}

// Create MCP Server
const server = new Server(
    {
        name: "harbinger-mcp-bridge",
        version: "1.0.0",
    },
    {
        capabilities: {
            tools: {},
        },
    }
);

// Tool Definitions
const TOOLS = [
    {
        name: "gmail_read_emails",
        description: "Read recent emails from your Gmail inbox.",
        inputSchema: {
            type: "object",
            properties: {
                limit: { type: "number", description: "Number of emails to fetch (default: 5)" }
            }
        }
    },
    {
        name: "gmail_send_email",
        description: "Send an email using Gmail.",
        inputSchema: {
            type: "object",
            properties: {
                to: { type: "string", description: "Recipient email address" },
                subject: { type: "string", description: "Email subject" },
                body: { type: "string", description: "Email body content" }
            },
            required: ["to", "subject", "body"]
        }
    },
    {
        name: "calendar_create_event",
        description: "Create a new event in your Google Calendar.",
        inputSchema: {
            type: "object",
            properties: {
                summary: { type: "string", description: "Event title" },
                start: { type: "string", description: "Start time (ISO string or description)" },
                end: { type: "string", description: "End time (ISO string or description)" },
                description: { type: "string", description: "Event description" }
            },
            required: ["summary", "start", "end"]
        }
    },
    {
        name: "browser_open",
        description: "Open a URL in the browser.",
        inputSchema: {
            type: "object",
            properties: {
                url: { type: "string", description: "The URL to open" }
            },
            required: ["url"]
        }
    },
    {
        name: "os_open_app",
        description: "Open a desktop application.",
        inputSchema: {
            type: "object",
            properties: {
                appName: { type: "string", description: "Name of the application to open (e.g., 'Notepad', 'Spotify')" }
            },
            required: ["appName"]
        }
    },
    {
        name: "os_list_dir",
        description: "List contents of a directory.",
        inputSchema: {
            type: "object",
            properties: {
                path: { type: "string", description: "Directory path to list" }
            },
            required: ["path"]
        }
    },
    {
        name: "os_open_folder",
        description: "Open a folder in the file explorer.",
        inputSchema: {
            type: "object",
            properties: {
                path: { type: "string", description: "Path to the folder to open" }
            },
            required: ["path"]
        }
    },
    {
        name: "excel_read",
        description: "Read data from an Excel file.",
        inputSchema: {
            type: "object",
            properties: {
                filePath: { type: "string", description: "Path to the Excel file" },
                sheetName: { type: "string", description: "Sheet name (optional)" }
            },
            required: ["filePath"]
        }
    },
    {
        name: "excel_write",
        description: "Write data to an Excel file.",
        inputSchema: {
            type: "object",
            properties: {
                filePath: { type: "string", description: "Path to the Excel file" },
                data: { type: "array", description: "2D array of data to write" }
            },
            required: ["filePath", "data"]
        }
    },
    {
        name: "memory_store",
        description: "Store information in long-term memory.",
        inputSchema: {
            type: "object",
            properties: {
                key: { type: "string", description: "Key or topic" },
                value: { type: "string", description: "Information to store" }
            },
            required: ["key", "value"]
        }
    },
    {
        name: "memory_retrieve",
        description: "Retrieve information from long-term memory.",
        inputSchema: {
            type: "object",
            properties: {
                query: { type: "string", description: "Search query" }
            },
            required: ["query"]
        }
    }
];

// List Tools Handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: TOOLS };
});

// Call Tool Handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const toolName = request.params.name;
    const args = request.params.arguments || {};

    try {
        let result;

        switch (toolName) {
            case "gmail_read_emails":
                result = await executeTask("gmail", "gmail.read_emails", args);
                break;
            case "gmail_send_email":
                result = await executeTask("gmail", "gmail.send_email", args);
                break;
            case "calendar_create_event":
                result = await executeTask("calendar", "calendar.create_event", args);
                break;
            case "browser_open":
                result = await executeTask("browser", "browser.open", args);
                break;
            case "os_open_app":
                result = await executeTask("os", "os.open_app", { app_name: args.appName });
                break;
            case "os_list_dir":
                result = await executeTask("os", "os.list_directory", args);
                break;
            case "os_open_folder":
                result = await executeTask("os", "os.open_folder", args);
                break;
            case "excel_read":
                result = await executeTask("excel", "excel.read", args);
                break;
            case "excel_write":
                result = await executeTask("excel", "excel.write", args);
                break;
            case "memory_store":
                result = await executeTask("memory", "memory.store", args);
                break;
            case "memory_retrieve":
                result = await executeTask("memory", "memory.retrieve", args);
                break;
            default:
                throw new Error(`Unknown tool: ${toolName}`);
        }

        // Parse the result payload if possible, otherwise return as string
        let content = "";
        if (result.result) {
            content = result.result;
        } else if (result.error_message) {
            content = `Error: ${result.error_message}`;
            return {
                content: [{ type: "text", text: content }],
                isError: true,
            };
        } else {
            content = JSON.stringify(result);
        }

        return {
            content: [
                {
                    type: "text",
                    text: content,
                },
            ],
        };
    } catch (error) {
        return {
            content: [
                {
                    type: "text",
                    text: `Execution failed: ${error.message}`,
                },
            ],
            isError: true,
        };
    }
});

// Start Server
async function run() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Harbinger MCP Bridge running on Stdio");
}

run().catch((error) => {
    console.error("Fatal error running server:", error);
    process.exit(1);
});
