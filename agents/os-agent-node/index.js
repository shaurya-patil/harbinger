// os-agent-node index.js
const path = require('path');
const os = require('os');
const fs = require('fs').promises;
const { exec } = require('child_process');
const { promisify } = require('util');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const cheerio = require('cheerio');

const execAsync = promisify(exec);

const PROTO_PATH = path.join(__dirname, '../../libs/proto/task.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
});
const taskProto = grpc.loadPackageDefinition(packageDefinition).jarvis;

// Resolve common folder names to actual paths
function resolvePath(inputPath, baseDir = null) {
    const lowerPath = inputPath.toLowerCase().trim();
    const userHome = os.homedir();

    // If baseDir is provided (from task metadata), use it as the root for relative paths
    if (baseDir) {
        // Resolve baseDir relative to home if it's not absolute
        const resolvedBaseDir = path.isAbsolute(baseDir) ? baseDir : path.join(userHome, baseDir);

        // If input path is absolute, return it (allow overriding if user explicitly asks for C:\...)
        if (path.isAbsolute(inputPath)) return inputPath;

        // Otherwise, join with baseDir
        return path.join(resolvedBaseDir, inputPath);
    }

    const commonFolders = {
        'desktop': path.join(userHome, 'Desktop'),
        'downloads': path.join(userHome, 'Downloads'),
        'documents': path.join(userHome, 'Documents'),
        'pictures': path.join(userHome, 'Pictures'),
        'videos': path.join(userHome, 'Videos'),
        'music': path.join(userHome, 'Music'),
        'onedrive': path.join(userHome, 'OneDrive')
    };

    // Auto-detect OneDrive Documents
    const oneDriveDocs = path.join(userHome, 'OneDrive', 'Documents');
    // We can't use fs.existsSync here because it's async, but we are in a sync function context if we want to keep it simple.
    // However, resolvePath is synchronous. Let's try to see if we can check it.
    // Actually, fs.existsSync is available in 'fs' module, but we imported 'fs.promises'.
    // Let's import 'fs' as well for sync operations if needed, or just assume the standard path.
    // Better yet, let's just check if the path string contains 'OneDrive' or if we should default 'documents' to OneDrive if it exists.
    // Since we can't easily do async checks here without refactoring everything to async, 
    // and the user explicitly asked for "Documents is in OneDrive folder, auto detect",
    // we will prioritize OneDrive/Documents if it exists.

    try {
        const fsSync = require('fs');
        if (fsSync.existsSync(oneDriveDocs)) {
            commonFolders['documents'] = oneDriveDocs;
            console.log(`[OS Agent] Auto-detected OneDrive Documents: ${oneDriveDocs}`);
        }
    } catch (e) {
        // Ignore error, fallback to default
    }

    if (commonFolders[lowerPath]) {
        return commonFolders[lowerPath];
    }
    for (const [folderName, folderPath] of Object.entries(commonFolders)) {
        if (lowerPath.includes(folderName)) {
            return inputPath.replace(new RegExp(folderName, 'i'), folderPath);
        }
    }
    return inputPath;
}

// File Operations
async function createFile(filePath, content, baseDir = null) {
    const resolvedPath = resolvePath(filePath, baseDir);
    console.log(`[OS Agent] Creating file: ${resolvedPath}`);
    await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
    await fs.writeFile(resolvedPath, content, 'utf8');
    return { success: true, path: resolvedPath };
}

async function deleteFile(filePath) {
    const resolvedPath = resolvePath(filePath);
    console.log(`[OS Agent] Deleting file: ${resolvedPath}`);
    await fs.unlink(resolvedPath);
    return { success: true, path: resolvedPath };
}

async function updateFile(filePath, content) {
    const resolvedPath = resolvePath(filePath);
    console.log(`[OS Agent] Updating file: ${resolvedPath}`);
    await fs.writeFile(resolvedPath, content, 'utf8');
    return { success: true, path: resolvedPath };
}

async function moveFile(source, destination) {
    const resolvedSource = resolvePath(source);
    const resolvedDest = resolvePath(destination);
    console.log(`[OS Agent] Moving file: ${resolvedSource} -> ${resolvedDest}`);
    try {
        const destStats = await fs.stat(resolvedDest);
        if (destStats.isDirectory()) {
            const filename = path.basename(resolvedSource);
            const finalDest = path.join(resolvedDest, filename);
            await fs.rename(resolvedSource, finalDest);
            return { success: true, from: resolvedSource, to: finalDest };
        }
    } catch (e) {
        // Not a directory, continue
    }
    await fs.rename(resolvedSource, resolvedDest);
    return { success: true, from: resolvedSource, to: resolvedDest };
}

async function readFile(filePath) {
    const resolvedPath = resolvePath(filePath);
    console.log(`[OS Agent] Reading file: ${resolvedPath}`);
    const content = await fs.readFile(resolvedPath, 'utf8');
    return { success: true, path: resolvedPath, content };
}

async function listDirectory(dirPath) {
    const resolvedPath = resolvePath(dirPath);
    console.log(`[OS Agent] Listing directory: ${resolvedPath}`);
    const files = await fs.readdir(resolvedPath);
    return { success: true, path: resolvedPath, files };

}

// Web Search Helper
async function searchWeb(query) {
    console.log(`[OS Agent] Searching web for: ${query}`);
    try {
        // Search DuckDuckGo using curl to avoid bot detection
        const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
        const command = `curl -s -L -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36" "${searchUrl}"`;

        const { stdout } = await execAsync(command, { maxBuffer: 1024 * 1024 * 10 });

        const $ = cheerio.load(stdout);
        // Extract the first result link
        const firstResult = $('.result__a').first().attr('href');

        if (firstResult) {
            console.log(`[OS Agent] Found URL: ${firstResult}`);
            return firstResult;
        }
    } catch (error) {
        console.error(`[OS Agent] Search failed: ${error.message}`);
    }
    return null;
}

// App/Folder Operations
async function openApp(appName, url = null) {
    console.log(`[OS Agent] Opening app: ${appName} with url: ${url}`);
    const lowerAppName = appName.toLowerCase();
    const directLaunchApps = ['notepad', 'calc', 'mspaint', 'explorer', 'cmd', 'powershell', 'excel', 'word', 'chrome'];
    if (directLaunchApps.some(app => lowerAppName.includes(app))) {
        try {
            // Use start "" "app" "args" syntax to avoid title issues and ensure args are passed
            const command = url ? `start "" "${appName}" "${url}"` : `start "" "${appName}"`;
            console.log(`[OS Agent] Executing direct command: ${command}`);
            await execAsync(command);
            return { success: true, app: appName, url, method: 'direct' };
        } catch (e) {
            // fall through to other methods
        }
    }
    // Special handling for Microsoft Teams
    if (lowerAppName.includes('teams')) {
        try {
            const teamsPath = path.join(process.env.LOCALAPPDATA, 'Microsoft', 'Teams', 'current', 'Teams.exe');
            await execAsync(`powershell -Command "Start-Process -FilePath '${teamsPath}'"`);
            return { success: true, app: appName, path: teamsPath, method: 'direct_teams' };
        } catch (e) {
            // fall through
        }
    }
    // Fallback: search for .lnk shortcut
    try {
        const searchCommand = `powershell -Command "$ErrorActionPreference='SilentlyContinue'; Get-ChildItem -Path 'C:\\ProgramData\\Microsoft\\Windows\\Start Menu\\Programs', '$env:APPDATA\\Microsoft\\Windows\\Start Menu\\Programs' -Recurse -Filter '*.lnk' -ErrorAction SilentlyContinue | Where-Object { $_.Name -like '*${appName}*' } | Select-Object -First 1 -ExpandProperty FullName"`;
        const { stdout } = await execAsync(searchCommand);
        const appPath = stdout.trim();
        if (appPath) {
            console.log(`[OS Agent] Found shortcut at: ${appPath}`);
            await execAsync(`powershell -Command "Start-Process -FilePath '${appPath}'"`);
            return { success: true, app: appName, path: appPath, method: 'shortcut' };
        }
    } catch (e) {
        // ignore and try web fallback
    }
    // Web fallback: search for the app online
    const targetUrl = url || await searchWeb(appName);
    if (targetUrl) {
        try {
            await execAsync(`start "" "${targetUrl}"`);
            return { success: true, app: appName, url: targetUrl, method: 'web_search' };
        } catch (e) {
            throw new Error(`Failed to open web URL for ${appName}: ${e.message}`);
        }
    }
    // If nothing worked, report not installed
    throw new Error(`Application '${appName}' not found on this PC`);
}

// Smart Folder Resolution
async function smartResolveFolder(folderName) {
    // 1. Check if it's a direct path that exists
    const directPath = resolvePath(folderName);
    try {
        const stats = await fs.stat(directPath);
        if (stats.isDirectory()) {
            return directPath;
        }
    } catch (e) {
        // Not a direct path or doesn't exist
    }

    console.log(`[OS Agent] Smart resolving folder: ${folderName}`);

    // 2. Search in User Home Directory (depth 3 to be fast)
    // We filter for Directory and Name matching the input
    const searchName = path.basename(folderName); // In case they passed "Documents/Harbinger", we search for "Harbinger"
    const userHome = os.homedir();

    const command = `powershell -Command "$ErrorActionPreference='SilentlyContinue'; Get-ChildItem -Path '${userHome}' -Directory -Recurse -Depth 3 -ErrorAction SilentlyContinue | Where-Object { $_.Name -eq '${searchName}' } | Select-Object -First 1 -ExpandProperty FullName"`;

    try {
        const { stdout } = await execAsync(command);
        const foundPath = stdout.trim();
        if (foundPath) {
            console.log(`[OS Agent] Found folder at: ${foundPath}`);
            return foundPath;
        }
    } catch (e) {
        console.error(`[OS Agent] Smart search failed: ${e.message}`);
    }

    throw new Error(`Folder '${folderName}' not found. Tried direct path and smart search in ${userHome}`);
}

async function openFolder(folderPath) {
    try {
        const resolvedPath = await smartResolveFolder(folderPath);
        console.log(`[OS Agent] Opening folder: ${resolvedPath}`);
        // Use start command which is more reliable than explorer directly
        await execAsync(`start "" "${resolvedPath}"`);
        return { success: true, path: resolvedPath };
    } catch (error) {
        throw new Error(`Failed to open folder: ${error.message}`);
    }
}

async function runCommand(cmd) {
    console.log(`[OS Agent] Running command: ${cmd}`);
    const { stdout, stderr } = await execAsync(cmd);
    return { success: true, stdout, stderr };
}

async function executeTask(call, callback) {
    const task = call.request;
    const params = task.payload ? JSON.parse(task.payload.toString()) : {};
    console.log(`[OS Agent] Task ${task.id}: ${task.type}`);
    try {
        let result;
        const outputDir = task.metadata?.output_dir;

        switch (task.type) {
            case 'os.create_file':
                result = await createFile(params.path, params.content || '', outputDir);
                break;
            case 'os.delete_file':
                result = await deleteFile(params.path); // Deletion might need care, but for now let's leave it
                break;
            case 'os.update_file':
                result = await updateFile(params.path, params.content); // Should probably support outputDir too
                break;
            case 'os.move_file':
                result = await moveFile(params.source, params.destination);
                break;
            case 'os.read_file':
                result = await readFile(params.path);
                break;
            case 'os.list_directory':
                result = await listDirectory(params.path);
                break;
            case 'os.open_app':
                result = await openApp(params.app_name, params.url || null);
                break;
            case 'os.open_folder':
                result = await openFolder(params.path);
                break;
            case 'os.run_command':
                // For run_command, we might want to set CWD to outputDir?
                // For now, let's keep it simple.
                result = await runCommand(params.command);
                break;
            default:
                throw new Error(`Unknown task type: ${task.type}`);
        }
        callback(null, {
            id: task.id,
            status: "success",
            result_uri: `os://${task.type}/result`,
            result_data: JSON.stringify(result)
        });
    } catch (error) {
        console.error(`[OS Agent] Task failed:`, error.message);
        callback(null, {
            id: task.id,
            status: "fail",
            error_message: error.message
        });
    }
}

function healthCheck(call, callback) {
    callback(null, {
        status: "ok",
        capabilities: [
            "os.create_file",
            "os.delete_file",
            "os.update_file",
            "os.move_file",
            "os.read_file",
            "os.list_directory",
            "os.open_app",
            "os.open_folder",
            "os.run_command"
        ]
    });
}

function main() {
    const server = new grpc.Server();
    server.addService(taskProto.Agent.service, { ExecuteTask: executeTask, HealthCheck: healthCheck });
    const address = '0.0.0.0:50054';
    server.bindAsync(address, grpc.ServerCredentials.createInsecure(), () => {
        console.log(`[OS Agent] Server running at ${address}`);
        console.log(`[OS Agent] No error dialogs - using PowerShell Start-Process`);
        server.start();
    });
}

main();
