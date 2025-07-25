// Jamango Sync VS Code Extension
// Real-time file sync between VS Code and Jamango website
// Based on the VS Code extensibility API

const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');
const WebSocket = require('ws');
const https = require('https');
const http = require('http');
const crypto = require('crypto');
const os = require('os');

// Global variables
let syncStatusBarItem;
let fileWatcher = null;
let websocketServer = null;
let isSyncActive = false;
let currentWorkspacePath = null;
let connectedClients = new Set();
let publicWebSocketClient = null;

// Use a public WebSocket proxy service for HTTPS compatibility
const PUBLIC_PROXY_URL = 'wss://jamango-sync-proxy-private-production.up.railway.app'; // Railway HTTPS WebSocket proxy
const LOCAL_WEBSOCKET_PORT = 8080;

// SSL Certificate generation
function generateSelfSignedCert() {
    const certPath = path.join(os.tmpdir(), 'jamango-sync-cert');
    
    // Generate private key
    const privateKey = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: {
            type: 'spki',
            format: 'pem'
        },
        privateKeyEncoding: {
            type: 'pkcs8',
            format: 'pem'
        }
    });

    // Generate certificate
    const cert = crypto.createCertificate();
    cert.setPublicKey(privateKey.publicKey);
    cert.setPrivateKey(privateKey.privateKey);
    cert.setSerial('01');
    cert.setSubject([
        { shortName: 'CN', value: 'localhost' },
        { shortName: 'O', value: 'Jamango Sync' },
        { shortName: 'OU', value: 'VS Code Extension' }
    ]);
    cert.setIssuer([
        { shortName: 'CN', value: 'localhost' },
        { shortName: 'O', value: 'Jamango Sync' },
        { shortName: 'OU', value: 'VS Code Extension' }
    ]);
    cert.sign(privateKey.privateKey, 'sha256');

    return {
        key: privateKey.privateKey,
        cert: cert.getPEM()
    };
}

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

        // Close Railway proxy connection
        if (publicWebSocketClient) {
            try {
                console.log('🔗 Disconnecting from Railway proxy...');
                publicWebSocketClient.close();
                publicWebSocketClient = null;
            } catch (error) {
                console.error('Error closing Railway proxy connection:', error);
            }
        }

        // Close WebSocket connections
        if (websocketServer) {
            if (Array.isArray(websocketServer)) {
                // Multiple servers
                websocketServer.forEach(server => {
                    try {
                        server.close();
                    } catch (error) {
                        console.error('Error closing server:', error);
                    }
                });
            } else {
                // Single server (backward compatibility)
                websocketServer.close();
            }
            websocketServer = null;
        }

        // Clear connected clients
        connectedClients.clear();

        isSyncActive = false;
        updateStatusBar();
        
        vscode.window.showInformationMessage('🛑 Jamango Sync stopped.');
        
        // Set context for command palette (with error handling)
        try {
            vscode.commands.executeCommand('setContext', 'jamango-sync.isActive', false);
        } catch (error) {
            // Ignore errors during shutdown
            console.log('Note: Could not set context during shutdown');
        }

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
        // Create HTTP WebSocket server for local connections
        const servers = [];
        
        // HTTP WebSocket server (for local development)
        try {
            const httpServer = new WebSocket.Server({ port: LOCAL_WEBSOCKET_PORT });
            servers.push(httpServer);
            console.log(`🔗 HTTP WebSocket server listening on ws://localhost:${LOCAL_WEBSOCKET_PORT}`);
        } catch (error) {
            console.log(`⚠️ HTTP WebSocket server port ${LOCAL_WEBSOCKET_PORT} already in use`);
        }
        
        // If no servers were created, try alternative ports
        if (servers.length === 0) {
            try {
                const fallbackServer = new WebSocket.Server({ port: 8081 });
                servers.push(fallbackServer);
                console.log('🔗 Fallback WebSocket server listening on ws://localhost:8081');
            } catch (error) {
                throw new Error('No available ports for WebSocket servers');
            }
        }
        
        // Set up connection handling for all servers
        servers.forEach(server => {
            server.on('connection', (ws) => {
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
        });
        
        // Store all servers for cleanup
        websocketServer = servers;
        
        const serverInfo = servers.map((_, i) => {
            const port = i === 0 ? 8080 : i === 1 ? 8443 : 8081;
            const protocol = i === 1 ? 'wss' : 'ws';
            return `${protocol}://localhost:${port}`;
        }).join(', ');
        
        vscode.window.showInformationMessage(`🔗 WebSocket servers ready! Website can connect to: ${serverInfo}`);
        
        // Also connect to Railway proxy for GitHub Pages compatibility
        try {
            console.log('🔗 Connecting to Railway proxy for GitHub Pages compatibility...');
            publicWebSocketClient = new WebSocket(PUBLIC_PROXY_URL);
            
            publicWebSocketClient.on('open', () => {
                console.log('✅ Connected to Railway proxy');
                // Register this extension with the proxy
                publicWebSocketClient.send(JSON.stringify({
                    type: 'register_extension',
                    localhost: `ws://localhost:${LOCAL_WEBSOCKET_PORT}`
                }));
            });
            
            publicWebSocketClient.on('message', (data) => {
                try {
                    const message = JSON.parse(data);
                    console.log('📥 Extension received message from Railway proxy:', JSON.stringify(message));
                    
                    if (message.type === 'website_connected') {
                        console.log('🌐 Website connected through Railway proxy');
                        // Add the proxy connection as a client
                        connectedClients.add(publicWebSocketClient);
                    } else if (message.type === 'syncRequest') {
                        // Website is requesting file sync through proxy
                        console.log('📁 Website requested file sync through proxy');
                        const config = vscode.workspace.getConfiguration('jamango-sync');
                        const watchExtensions = config.get('watchExtensions', ['.json', '.css', '.html', '.txt', '.ts', '.tsx']);
                        
                        getFileList(currentWorkspacePath, watchExtensions).then(fileData => {
                            console.log('📤 Sending file list through Railway proxy:', fileData.files.length, 'files');
                            sendFileList(fileData);
                        });
                    } else {
                        // Forward other messages to local clients
                        connectedClients.forEach(client => {
                            if (client !== publicWebSocketClient && client.readyState === WebSocket.OPEN) {
                                client.send(JSON.stringify(message));
                            }
                        });
                    }
                } catch (error) {
                    console.error('Error parsing proxy message:', error);
                }
            });
            
            publicWebSocketClient.on('close', () => {
                console.log('❌ Railway proxy connection closed');
            });
            
            publicWebSocketClient.on('error', (error) => {
                console.error('❌ Railway proxy connection error:', error);
            });
            
        } catch (error) {
            console.error('Error connecting to Railway proxy:', error);
        }

    } catch (error) {
        console.error('Error creating WebSocket servers:', error);
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
    console.log('📤 sendFileList called with:', fileData.files.length, 'files,', fileData.folders.length, 'folders');
    console.log('📤 connectedClients size:', connectedClients.size);
    
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
        
        console.log('📤 Broadcasting fileList to', connectedClients.size, 'clients');
        
        // Broadcast to all connected clients
        connectedClients.forEach((client, index) => {
            console.log(`📤 Sending to client ${index}, readyState:`, client.readyState);
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(message));
                console.log(`📤 Sent fileList to client ${index}`);
            } else {
                console.log(`📤 Client ${index} not ready, state:`, client.readyState);
            }
        });
    } else {
        console.log('❌ No websocketServer available');
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
    try {
        stopSync();
    } catch (error) {
        console.log('Note: Error during stopSync in deactivate:', error.message);
    }
    
    if (syncStatusBarItem) {
        try {
            syncStatusBarItem.dispose();
        } catch (error) {
            console.log('Note: Error disposing status bar item:', error.message);
        }
    }
    
    console.log('🎮 Jamango Sync extension deactivated.');
}

module.exports = {
    activate,
    deactivate
}; 