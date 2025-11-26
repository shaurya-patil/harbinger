const { app, BrowserWindow, screen, globalShortcut, ipcMain, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
let tray = null;

function createWindow() {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;

    mainWindow = new BrowserWindow({
        width: 400,
        height: 100,
        x: width - 420,
        y: height - 120,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        resizable: false,
        skipTaskbar: true,
        show: false, // Start hidden
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            backgroundThrottling: false // Keep running in background
        }
    });

    mainWindow.loadFile('index.html');

    mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    mainWindow.setAlwaysOnTop(true, 'screen-saver');
}

app.whenReady().then(() => {
    createWindow();

    console.log("---------------------------------------------------");
    console.log("  Harbinger Desktop is RUNNING!");
    console.log("  Press 'Alt + Space' to toggle the Assistant.");
    console.log("  Check System Tray for icon.");
    console.log("---------------------------------------------------");

    // --- System Tray Setup ---
    const iconPath = path.join(__dirname, 'icon.png');
    try {
        const icon = nativeImage.createFromPath(iconPath);
        tray = new Tray(icon);
        const contextMenu = Menu.buildFromTemplate([
            { label: 'Show/Hide Assistant', click: toggleWindow },
            { type: 'separator' },
            { label: 'Quit', click: () => app.quit() }
        ]);
        tray.setToolTip('Harbinger Assistant');
        tray.setContextMenu(contextMenu);

        tray.on('click', toggleWindow);
    } catch (e) {
        console.error("Failed to create tray icon:", e);
    }

    function toggleWindow() {
        if (mainWindow.isVisible()) {
            mainWindow.hide();
        } else {
            mainWindow.show();
            mainWindow.webContents.send('focus-input');
        }
    }

    // Global Shortcut: Alt+Space to toggle
    globalShortcut.register('Alt+Space', toggleWindow);

    // IPC: Wake up on noise
    ipcMain.on('wake-up', () => {
        if (!mainWindow.isVisible()) {
            mainWindow.show();
            mainWindow.webContents.send('focus-input');
        }
    });

    // IPC: Run Orchestrator
    ipcMain.on('run-orchestrator', (event, command) => {
        const logFile = path.join(__dirname, 'debug.log');
        const log = (msg) => {
            try {
                fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${msg}\n`);
            } catch (e) {
                console.error("Logging failed:", e);
            }
        };

        log(`Received command: ${command}`);
        console.log(`[Main] Received command: ${command}`);

        // Notify renderer that execution started
        event.sender.send('orchestrator-start');

        const { exec } = require('child_process');
        const projectRoot = path.resolve(__dirname, '..'); // Go up one level to project root

        // Escape quotes in command to prevent shell injection/errors
        const safeCommand = command.replace(/"/g, '\\"');
        const execCommand = `node orchestrator/index.js "${safeCommand}"`;

        log(`Executing: ${execCommand} in ${projectRoot}`);
        console.log(`[Main] Executing: ${execCommand} in ${projectRoot}`);

        exec(execCommand, { cwd: projectRoot }, (error, stdout, stderr) => {
            if (error) {
                log(`Error: ${error.message}`);
                console.error(`[Orchestrator Error]: ${error.message}`);
                event.sender.send('orchestrator-error', error.message);
                return;
            }
            if (stderr) {
                log(`Stderr: ${stderr}`);
                console.error(`[Orchestrator Stderr]: ${stderr}`);
            }
            log(`Stdout: ${stdout}`);
            console.log(`[Orchestrator Output]:\n${stdout}`);
            event.sender.send('orchestrator-result', stdout);
        });
    });

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
