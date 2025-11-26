const path = require('path');
const os = require('os');
const fs = require('fs').promises;
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

function resolvePath(inputPath) {
    return path.resolve(inputPath);
}

async function smartResolveFolder(folderName) {
    console.log(`Testing resolution for: ${folderName}`);

    // 1. Check if it's a direct path that exists
    const directPath = resolvePath(folderName);
    try {
        const stats = await fs.stat(directPath);
        if (stats.isDirectory()) {
            console.log(`Found direct path: ${directPath}`);
            return directPath;
        }
    } catch (e) {
        // Not a direct path or doesn't exist
    }

    console.log(`[OS Agent] Smart resolving folder: ${folderName}`);

    const searchName = path.basename(folderName);
    const userHome = os.homedir();

    const command = `powershell -Command "$ErrorActionPreference='SilentlyContinue'; Get-ChildItem -Path '${userHome}' -Directory -Recurse -Depth 3 -ErrorAction SilentlyContinue | Where-Object { $_.Name -eq '${searchName}' } | Select-Object -First 1 -ExpandProperty FullName"`;

    console.log(`Running command: ${command}`);
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

    throw new Error(`Folder '${folderName}' not found.`);
}

smartResolveFolder('harbinger').then(p => console.log('Resolved:', p)).catch(e => console.error(e));
