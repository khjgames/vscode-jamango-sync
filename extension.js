// Jamango Sync VS Code Extension
// Real-time file sync between VS Code and Jamango website
// Based on the VS Code extensibility API

const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');
const WebSocket = require('ws');

// Global variables
let syncStatusBarItem;
let fileWatcher = null;
let websocketServer = null;
let isSyncActive = false;
let currentWorkspacePath = null;
let connectedClients = new Set();

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    console.log('🎮 Jamango Sync extension is now active!');

    // Create status bar item
    syncStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    syncStatusBarItem.text = '$(sync) Jamango Sync';
    syncStatusBarItem.tooltip = 'Click to start/stop Jamango file sync';
    syncStatusBarItem.command = 'jamango-sync.toggleSync';
    context.subscriptions.push(syncStatusBarItem);

    // Register commands
    let startSyncCommand = vscode.commands.registerCommand('jamango-sync.startSync', () => {
        startSync();
    });

    let stopSyncCommand = vscode.commands.registerCommand('jamango-sync.stopSync', () => {
        stopSync();
    });

    let syncNowCommand = vscode.commands.registerCommand('jamango-sync.syncNow', () => {
        syncFilesNow();
    });

    let toggleSyncCommand = vscode.commands.registerCommand('jamango-sync.toggleSync', () => {
        if (isSyncActive) {
            stopSync();
        } else {
            startSync();
        }
    });

    context.subscriptions.push(startSyncCommand, stopSyncCommand, syncNowCommand, toggleSyncCommand);

    // Update status bar
    updateStatusBar();

    // Auto-start sync if workspace is available
    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
        currentWorkspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
        vscode.window.showInformationMessage('🎮 Jamango Sync ready! Use Command Palette to start syncing.');
    }
}

function startSync() {
    if (isSyncActive) {
        vscode.window.showInformationMessage('🔄 Jamango Sync is already active!');
        return;
    }

    if (!currentWorkspacePath) {
        vscode.window.showErrorMessage('❌ No workspace folder found. Please open a folder in VS Code.');
        return;
    }

    try {
        // Get configuration
        const config = vscode.workspace.getConfiguration('jamango-sync');
        const websiteUrl = config.get('websiteUrl', 'http://localhost:3000');
        const watchExtensions = config.get('watchExtensions', ['.json', '.css', '.html', '.txt', '.ts', '.tsx']);

        // Start file watcher
        startFileWatcher(currentWorkspacePath, watchExtensions);

        // Connect to website
        connectToWebsite(websiteUrl);

        isSyncActive = true;
        updateStatusBar();
        
        vscode.window.showInformationMessage('✅ Jamango Sync started! Watching for file changes...');
        
        // Set context for command palette
        vscode.commands.executeCommand('setContext', 'jamango-sync.isActive', true);

    } catch (error) {
        vscode.window.showErrorMessage(`❌ Failed to start Jamango Sync: ${error.message}`);
        console.error('Jamango Sync error:', error);
    }
}

function stopSync() {
    if (!isSyncActive) {
        vscode.window.showInformationMessage('🔄 Jamango Sync is not active!');
        return;
    }

    try {
        // Stop file watcher
        if (fileWatcher) {
            fileWatcher.close();
            fileWatcher = null;
        }

        // Close WebSocket connection
        if (websocketServer) {
            websocketServer.close();
            websocketServer = null;
        }

        isSyncActive = false;
        updateStatusBar();
        
        vscode.window.showInformationMessage('🛑 Jamango Sync stopped.');
        
        // Set context for command palette
        vscode.commands.executeCommand('setContext', 'jamango-sync.isActive', false);

    } catch (error) {
        vscode.window.showErrorMessage(`❌ Error stopping Jamango Sync: ${error.message}`);
        console.error('Jamango Sync error:', error);
    }
}

function startFileWatcher(workspacePath, extensions) {
    // Create glob pattern for file extensions
    const patterns = extensions.map(ext => `**/*${ext}`);
    
    fileWatcher = chokidar.watch(patterns, {
        cwd: workspacePath,
        ignored: /(^|[\/\\])\../, // ignore dotfiles
        persistent: true,
        ignoreInitial: false
    });

    // Handle file changes
    fileWatcher.on('change', (filePath) => {
        console.log(`📝 File changed: ${filePath}`);
        sendFileUpdate('change', filePath);
    });

    fileWatcher.on('add', (filePath) => {
        console.log(`➕ File added: ${filePath}`);
        sendFileUpdate('add', filePath);
    });

    fileWatcher.on('unlink', (filePath) => {
        console.log(`➖ File deleted: ${filePath}`);
        sendFileUpdate('delete', filePath);
    });

    // Send initial file list
    getFileList(workspacePath, extensions).then(files => {
        sendFileList(files);
    });
}

function connectToWebsite(websiteUrl) {
    try {
        // Create a local WebSocket server for the website to connect to
        websocketServer = new WebSocket.Server({ port: 8080 });
        
        websocketServer.on('connection', (ws) => {
            console.log('🔗 Website connected to VS Code extension');
            connectedClients.add(ws);
            
            // Send initial connection confirmation
            ws.send(JSON.stringify({
                type: 'connection',
                message: 'Connected to VS Code extension',
                timestamp: new Date().toISOString()
            }));

            ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data);
                    handleWebsiteMessage(message, ws);
                } catch (error) {
                    console.error('Error parsing website message:', error);
                }
            });

            ws.on('close', () => {
                console.log('❌ Website disconnected from VS Code extension');
                connectedClients.delete(ws);
            });

            ws.on('error', (error) => {
                console.error('WebSocket error:', error);
                connectedClients.delete(ws);
            });
        });

        console.log('🔗 Local WebSocket server listening on ws://localhost:8080');
        vscode.window.showInformationMessage('🔗 WebSocket server ready! Website can connect to ws://localhost:8080');

    } catch (error) {
        console.error('Error creating WebSocket server:', error);
        throw error;
    }
}

function sendFileUpdate(action, filePath) {
    if (websocketServer) {
        // Read file content for changes and additions
        let fileContent = null;
        if ((action === 'change' || action === 'add') && currentWorkspacePath) {
            try {
                const fullPath = path.join(currentWorkspacePath, filePath);
                fileContent = fs.readFileSync(fullPath, 'utf8');
            } catch (error) {
                console.error('Error reading file content:', error);
                fileContent = null;
            }
        }

        const message = {
            type: 'fileUpdate',
            action: action,
            filePath: filePath,
            fileContent: fileContent,
            timestamp: new Date().toISOString()
        };
        
        // Broadcast to all connected clients
        connectedClients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(message));
            }
        });
    }
}

function sendFileList(fileData) {
    if (websocketServer) {
        // Read content for all files
        const filesWithContent = [];
        
        for (const filePath of fileData.files) {
            try {
                const fullPath = path.join(currentWorkspacePath, filePath);
                const content = fs.readFileSync(fullPath, 'utf8');
                filesWithContent.push({
                    path: filePath,
                    content: content
                });
            } catch (error) {
                console.error(`Error reading file ${filePath}:`, error);
                filesWithContent.push({
                    path: filePath,
                    content: null
                });
            }
        }

        const message = {
            type: 'fileList',
            files: filesWithContent,
            folders: fileData.folders,
            structure: fileData.structure,
            timestamp: new Date().toISOString()
        };
        
        // Broadcast to all connected clients
        connectedClients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(message));
            }
        });
    }
}

function handleWebsiteMessage(message, ws) {
    switch (message.type) {
        case 'syncRequest':
            // Website is requesting a file sync
            syncFilesNow();
            break;
        case 'ping':
            // Website is checking if we're still connected
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'pong' }));
            }
            break;
        default:
            console.log('Received message from website:', message);
    }
}

function syncFilesNow() {
    if (!currentWorkspacePath) {
        vscode.window.showErrorMessage('❌ No workspace folder found.');
        return;
    }

    try {
        const config = vscode.workspace.getConfiguration('jamango-sync');
        const watchExtensions = config.get('watchExtensions', ['.json', '.css', '.html', '.txt', '.ts', '.tsx']);

        getFileList(currentWorkspacePath, watchExtensions).then(fileData => {
            sendFileList(fileData);
            vscode.window.showInformationMessage(`✅ Synced ${fileData.files.length} files and ${fileData.folders.length} folders with Jamango website.`);
        });

    } catch (error) {
        vscode.window.showErrorMessage(`❌ Sync failed: ${error.message}`);
        console.error('Sync error:', error);
    }
}

function getFileList(workspacePath, extensions) {
    return new Promise((resolve, reject) => {
        const files = [];
        const folders = new Set();
        
        function scanDirectory(dirPath) {
            try {
                const items = fs.readdirSync(dirPath);
                
                for (const item of items) {
                    const fullPath = path.join(dirPath, item);
                    const relativePath = path.relative(workspacePath, fullPath);
                    const stat = fs.statSync(fullPath);
                    
                    if (stat.isDirectory()) {
                        // Skip node_modules and other common ignored directories
                        if (!['node_modules', '.git', '.vscode'].includes(item)) {
                            // Add folder to the set
                            folders.add(relativePath);
                            scanDirectory(fullPath);
                        }
                    } else if (stat.isFile()) {
                        const ext = path.extname(item).toLowerCase();
                        if (extensions.includes(ext)) {
                            files.push(relativePath);
                        }
                    }
                }
            } catch (error) {
                console.error('Error scanning directory:', error);
            }
        }
        
        scanDirectory(workspacePath);
        
        // Return both files and folder structure
        resolve({
            files: files,
            folders: Array.from(folders),
            structure: {
                workspacePath: workspacePath,
                totalFiles: files.length,
                totalFolders: folders.size
            }
        });
    });
}

function updateStatusBar() {
    if (isSyncActive) {
        syncStatusBarItem.text = '$(sync~spin) Jamango Sync';
        syncStatusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.prominentBackground');
    } else {
        syncStatusBarItem.text = '$(sync) Jamango Sync';
        syncStatusBarItem.backgroundColor = undefined;
    }
    
    syncStatusBarItem.show();
}

// This method is called when your extension is deactivated
function deactivate() {
    stopSync();
    
    if (syncStatusBarItem) {
        syncStatusBarItem.dispose();
    }
    
    console.log('🎮 Jamango Sync extension deactivated.');
}

module.exports = {
    activate,
    deactivate
}; 