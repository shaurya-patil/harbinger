const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const OpenAI = require('openai');
const { PLANNER_SYSTEM_PROMPT } = require('./src/prompts');

const openai = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: "https://api.groq.com/openai/v1",
});

async function plan(userInput) {
    try {
        const completion = await openai.chat.completions.create({
            messages: [
                { role: "system", content: PLANNER_SYSTEM_PROMPT + `\nCurrent Time: ${new Date().toISOString()}` },
                { role: "user", content: userInput }
            ],
            model: "llama-3.3-70b-versatile",
            response_format: { type: "json_object" },
        });

        const plan = JSON.parse(completion.choices[0].message.content);
        return plan;
    } catch (error) {
        console.error("Error generating plan:", error);
        return null;
    }
}

const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

const PROTO_PATH = path.join(__dirname, '../libs/proto/task.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
});
const taskProto = grpc.loadPackageDefinition(packageDefinition).jarvis;

// Agent Clients
const calendarClient = new taskProto.Agent('localhost:50051', grpc.credentials.createInsecure());
const gmailClient = new taskProto.Agent('localhost:50052', grpc.credentials.createInsecure());
const browserClient = new taskProto.Agent('localhost:50053', grpc.credentials.createInsecure());
const osClient = new taskProto.Agent('localhost:50054', grpc.credentials.createInsecure());
const humanizerClient = new taskProto.Agent('localhost:50055', grpc.credentials.createInsecure());
const interpreterClient = new taskProto.Agent('localhost:50056', grpc.credentials.createInsecure());
const plannerClient = new taskProto.Agent('localhost:50057', grpc.credentials.createInsecure());
const codegenClient = new taskProto.Agent('localhost:50058', grpc.credentials.createInsecure());
const executionClient = new taskProto.Agent('localhost:50059', grpc.credentials.createInsecure());
const debuggerClient = new taskProto.Agent('localhost:50060', grpc.credentials.createInsecure());
const qaClient = new taskProto.Agent('localhost:50061', grpc.credentials.createInsecure());
const reviewerClient = new taskProto.Agent('localhost:50062', grpc.credentials.createInsecure());
const dependencyClient = new taskProto.Agent('localhost:50063', grpc.credentials.createInsecure());
const docsClient = new taskProto.Agent('localhost:50064', grpc.credentials.createInsecure());
const researchClient = new taskProto.Agent('localhost:50065', grpc.credentials.createInsecure());
const memoryClient = new taskProto.Agent('localhost:50066', grpc.credentials.createInsecure());
const excelClient = new taskProto.Agent('localhost:50067', grpc.credentials.createInsecure());

async function executeTask(task) {
    return new Promise((resolve, reject) => {
        let client;
        if (task.agent === 'calendar') {
            client = calendarClient;
        } else if (task.agent === 'gmail') {
            client = gmailClient;
        } else if (task.agent === 'browser') {
            client = browserClient;
        } else if (task.agent === 'os') {
            client = osClient;
        } else if (task.agent === 'humanizer') {
            client = humanizerClient;
        } else if (task.agent === 'interpreter') {
            client = interpreterClient;
        } else if (task.agent === 'planner') {
            client = plannerClient;
        } else if (task.agent === 'codegen') {
            client = codegenClient;
        } else if (task.agent === 'execution') {
            client = executionClient;
        } else if (task.agent === 'debugger') {
            client = debuggerClient;
        } else if (task.agent === 'qa') {
            client = qaClient;
        } else if (task.agent === 'reviewer') {
            client = reviewerClient;
        } else if (task.agent === 'dependency') {
            client = dependencyClient;
        } else if (task.agent === 'docs') {
            client = docsClient;
        } else if (task.agent === 'research') {
            client = researchClient;
        } else if (task.agent === 'memory') {
            client = memoryClient;
        } else if (task.agent === 'excel') {
            client = excelClient;
        }

        if (client) {
            console.log(`[Orchestrator] Dispatching task ${task.id} to ${task.agent} Agent...`);
            client.ExecuteTask({
                id: task.id,
                type: task.action,
                metadata: task.metadata || {},
                payload: Buffer.from(JSON.stringify(task.params || {}))
            }, (err, response) => {
                if (err) {
                    console.error(`[Orchestrator] Task ${task.id} failed:`, err);
                    reject(err);
                } else {
                    if (response.status === 'success') {
                        console.log(`[Orchestrator] Task ${task.id} completed. Result: ${response.result_uri}`);
                        resolve(response);
                    } else {
                        console.error(`[Orchestrator] Task ${task.id} failed: ${response.error_message}`);
                        reject(new Error(response.error_message));
                    }
                }
            });
        } else {
            console.log(`[Orchestrator] Simulating task ${task.id} for agent '${task.agent}'...`);
            setTimeout(() => {
                console.log(`[Orchestrator] Task ${task.id} completed (Simulated).`);
                resolve({ id: task.id, status: 'success', result_uri: 'simulated://result' });
            }, 500);
        }
    });
}

async function resolveError(failedTask, error, context = {}) {
    console.log(`\n[Orchestrator] ⚠️ Task ${failedTask.id} failed. Attempting to resolve error...`);
    console.log(`[Orchestrator] Error: ${error.message}`);

    const prompt = `
    You are the Jarvis System Doctor. A task in the execution plan has failed.
    Your goal is to analyze the error and generate a "Fix Plan" to resolve it so the original task can be retried.

    Failed Task:
    ${JSON.stringify(failedTask, null, 2)}

    Error Message:
    ${error.message}

    Context (Previous Results):
    ${JSON.stringify(context, null, 2)}

    Available Agents:
    - calendar: Can create, list, and manage calendar events.
    - gmail: Can draft and send emails.
        - gmail.send_email(to: string, subject: string, body: string, ical?: { start: string, end: string, summary: string, location?: string })
    - browser: Can search the web and scrape pages.
        - browser.search(query: string)
        - browser.scrape(url: string)
    - os: Can perform file operations and launch applications.
        - os.create_file(path: string, content: string)
        - os.delete_file(path: string)
        - os.update_file(path: string, content: string)
        - os.move_file(source: string, destination: string)
        - os.read_file(path: string)
        - os.list_directory(path: string)
        - os.open_app(app_name: string, url?: string)
        - os.open_folder(path: string)
        - os.run_command(command: string)
    - humanizer: Can rewrite text to sound more human and natural.
        - humanizer.humanize_content(content: string)
    - interpreter: Converts user instructions into clear technical requirements.
        - interpreter.interpret(input: string)
    - planner: Designs architecture, workflow, and file structure.
        - planner.plan_system(requirements: string)
    - codegen: Writes high-quality code for each required module.
        - codegen.generate(spec: string)
    - execution: Runs the generated code and captures outputs or errors.
        - execution.run(command: string, cwd?: string)
    - debugger: Analyzes failures and automatically fixes code issues.
        - debugger.debug(code: string, error: string)
    - qa: Validates correctness using tests, edge cases, and scenarios.
        - qa.generate_tests(code: string)
    - reviewer: Improves code quality, structure, and performance.
        - reviewer.review(code: string)
    - dependency: Installs, updates, and manages project libraries.
        - dependency.manage(command: string, package: string, cwd?: string, manager?: string)
    - docs: Produces README, API docs, and usage guides.
        - docs.generate(code: string, type?: string)
    - research: Looks up examples, patterns, and best practices.
        - research.research(topic: string)
    - memory: Stores and retrieves information for later use.
        - memory.store(key?: string, value: any, context: string)
        - memory.retrieve(key: string)
        - memory.search(query: string, semantic?: boolean)
        - memory.list()
        - memory.forget(key: string)
    - excel: Comprehensive Excel automation and manipulation.
        - excel.create_workbook(name: string, path?: string, sheet_name?: string)
        - excel.read_range(file_path: string, sheet: string, range: string)
        - excel.write_range(file_path: string, sheet: string, range: string, values: array)
        - excel.add_sheet(file_path: string, sheet_name: string)
        - excel.create_table(file_path: string, sheet: string, range: string, table_name: string, columns?: array, rows?: array)
        - excel.add_chart(file_path: string, sheet: string, chart_type: string, data_range: string, position?: string)
        - excel.apply_formula(file_path: string, sheet: string, cell: string, formula: string)

    Instructions:
    1. Analyze the error.
    2. If it's a missing dependency, generate a 'dependency.manage' task.
    3. If it's a syntax error or code issue, generate a 'codegen.generate' task to fix the code, followed by 'os.create_file' to save it.
    4. Return a JSON object with a "tasks" array containing the fix steps.
    5. The "folder_name" should be the same as the original plan or "error_resolution".
    `;

    try {
        const completion = await openai.chat.completions.create({
            messages: [{ role: "system", content: prompt }],
            model: "llama-3.3-70b-versatile",
            response_format: { type: "json_object" },
        });

        let fixPlan;
        try {
            fixPlan = JSON.parse(completion.choices[0].message.content);
        } catch (parseError) {
            console.error("[Orchestrator] ❌ Failed to parse Fix Plan JSON:", completion.choices[0].message.content);
            return false;
        }

        if (!fixPlan.tasks || !Array.isArray(fixPlan.tasks)) {
            console.error("[Orchestrator] ❌ Fix Plan is missing 'tasks' array.");
            return false;
        }

        console.log(`[Orchestrator] 🚑 Generated Fix Plan with ${fixPlan.tasks.length} steps.`);

        // Inject output_dir from failed task if available
        if (failedTask.metadata && failedTask.metadata.output_dir) {
            fixPlan.tasks.forEach(task => {
                task.metadata = task.metadata || {};
                task.metadata.output_dir = failedTask.metadata.output_dir;
            });
        }

        displayWorkflow(fixPlan);
        await executePlan(fixPlan, context, true); // Recursive call, isFixPlan=true
        console.log(`[Orchestrator] ✅ Fix Plan executed successfully. Retrying original task...`);
        return true;
    } catch (e) {
        console.error(`[Orchestrator] ❌ Failed to resolve error: ${e.message}`);
        return false;
    }
}

async function executePlan(plan, existingResults = {}, isFixPlan = false) {
    if (!isFixPlan) console.log("\n--- Starting Execution ---");
    const results = existingResults; // Shared results object
    const resultData = {};

    for (const task of plan.tasks) {
        // Check dependencies (skip if fix plan, usually sequential)
        if (!isFixPlan && task.depends_on) {
            const allDepsMet = task.depends_on.every(depId => results[depId] && results[depId].status === 'success');
            if (!allDepsMet) {
                console.log(`[Orchestrator] Skipping task ${task.id} due to missing dependencies.`);
                continue;
            }
        }

        // Substitute placeholders
        if (task.depends_on && task.depends_on.length > 0) {
            for (const depId of task.depends_on) {
                if (results[depId] && results[depId].result_data) {
                    let data = results[depId].result_data;

                    // Try to parse if it's a JSON string, otherwise use raw
                    try {
                        const parsed = JSON.parse(data);
                        // If the result is an object with a 'result' or 'output' field, use that
                        if (parsed.result) data = parsed.result;
                        else if (parsed.output) data = parsed.output;
                        // Otherwise keep the full object (will be stringified if inserted into string)
                    } catch (e) {
                        // Not JSON, use as is
                    }

                    const replacePlaceholders = (obj) => {
                        for (const key in obj) {
                            if (typeof obj[key] === 'string') {
                                const placeholder = `{{${depId}}}`;
                                if (obj[key].includes(placeholder)) {
                                    // If data is an object and we are replacing a full string, we might want to replace with the object
                                    // But usually placeholders are part of a string.
                                    // For now, simple string replacement.
                                    const replacement = typeof data === 'object' ? JSON.stringify(data) : data;
                                    obj[key] = obj[key].split(placeholder).join(replacement);
                                }
                            } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                                replacePlaceholders(obj[key]);
                            }
                        }
                    };
                    replacePlaceholders(task.params);
                }
            }
        }

        console.log(`[Orchestrator] Dispatching task ${task.id} to ${task.agent} Agent...`);

        let retryCount = 0;
        const maxRetries = 1;
        let success = false;

        while (retryCount <= maxRetries && !success) {
            try {
                const result = await executeTask(task);
                results[task.id] = result;
                if (result.result_data) {
                    resultData[task.id] = result.result_data;
                }
                success = true;
            } catch (error) {
                console.error(`[Orchestrator] Execution failed for task ${task.id}.`);
                if (retryCount < maxRetries && !isFixPlan) { // Don't retry recursively in a fix plan to avoid infinite depth
                    const resolved = await resolveError(task, error, results);
                    if (resolved) {
                        retryCount++;
                    } else {
                        break; // Resolution failed
                    }
                } else {
                    break; // Retries exhausted
                }
            }
        }

        if (!success) {
            console.error(`[Orchestrator] Task ${task.id} failed permanently.`);
            if (!isFixPlan) break; // Stop main execution
        }
    }

    if (!isFixPlan) console.log("\n--- Execution Finished ---");

    // Display results
    if (Object.keys(resultData).length > 0 && !isFixPlan) {
        console.log("\n=== RESULTS ===");
        for (const [taskId, data] of Object.entries(resultData)) {
            console.log(`\nTask ${taskId}:`);
            try {
                const parsed = JSON.parse(data);
                console.log(JSON.stringify(parsed, null, 2));
            } catch {
                console.log(data);
            }
        }
        console.log("\n===============\n");
    }
}

async function main() {
    const userInput = process.argv[2];
    if (!userInput) {
        console.log("Please provide a user request.");
        return;
    }

    console.log(`Planning for: "${userInput}"...`);
    const taskGraph = await plan(userInput);

    if (taskGraph) {
        console.log("Generated Plan:");
        console.log(JSON.stringify(taskGraph, null, 2));

        // Determine output directory based on LLM plan or user input
        const taskTitle = taskGraph.folder_name || (process.argv[2] ? process.argv[2].replace(/[^a-z0-9]/gi, '_').substring(0, 50) : 'default_task');
        const outputDir = `Documents/Harbinger/${taskTitle}`;

        console.log(`[Orchestrator] Using output directory: ${outputDir}`);

        // Inject output_dir into tasks (skip for agents that don't need folders)
        taskGraph.tasks.forEach(task => {
            if (['os', 'calendar', 'browser'].includes(task.agent)) {
                return;
            }
            task.metadata = task.metadata || {};
            task.metadata.output_dir = outputDir;
        });

        displayWorkflow(taskGraph);

        await executePlan(taskGraph);
    } else {
        console.log("Failed to generate plan.");
    }
}

function displayWorkflow(plan) {
    console.log("\n╔════════════════════════════════════════════════════════════════╗");
    console.log("║                   PROPOSED WORKFLOW                            ║");
    console.log("╠════════════════════════════════════════════════════════════════╣");
    if (plan.folder_name) {
        console.log(`║ Goal: ${plan.folder_name.padEnd(56)} ║`);
    }
    console.log("╠════╤══════════════╤══════════════════════════════════════════╣");
    console.log("║ ID │ Agent        │ Action                                   ║");
    console.log("╟────┼──────────────┼──────────────────────────────────────────╢");

    if (plan.tasks && Array.isArray(plan.tasks)) {
        plan.tasks.forEach(task => {
            const id = task.id.toString().padEnd(2);
            const agent = task.agent.padEnd(12);
            const action = task.action.length > 40 ? task.action.substring(0, 37) + "..." : task.action.padEnd(40);
            console.log(`║ ${id} │ ${agent} │ ${action} ║`);
        });
    } else {
        console.log("║    │ System       │ No tasks generated in plan               ║");
    }
    console.log("╚════╧══════════════╧══════════════════════════════════════════╝\n");
}

if (require.main === module) {
    main();
}

module.exports = { plan };
