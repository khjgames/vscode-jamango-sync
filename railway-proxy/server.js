// Jamango Sync Public WebSocket Proxy for Railway
// This bridges HTTPS websites to local VS Code extension WebSocket servers

const express = require('express');
const WebSocket = require('ws');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS
app.use(cors());

// Status endpoint
app.get('/', (req, res) => {
    res.json({
        status: 'Jamango Sync WebSocket Proxy Running',
        connections: proxyConnections.size,
        extensions: registeredExtensions.size,
        timestamp: new Date().toISOString(),
        message: 'WebSocket proxy ready for GitHub Pages compatibility',
        platform: 'Railway'
    });
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        uptime: process.uptime(),
        connections: proxyConnections.size,
        extensions: registeredExtensions.size,
        memory: process.memoryUsage()
    });
});

// Create HTTP server
const server = app.listen(PORT, () => {
    console.log(`🚀 Jamango Sync Proxy running on port ${PORT}`);
    console.log(`🔗 WebSocket proxy ready for HTTPS connections`);
});

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Track proxy connections and registered extensions
const proxyConnections = new Map();
const registeredExtensions = new Map();

wss.on('connection', (ws, req) => {
    console.log('🔗 New proxy connection from:', req.headers.origin);
    
    let localConnection = null;
    let connectionId = Date.now() + Math.random();
    let isExtension = false;
    
    proxyConnections.set(connectionId, { ws, localConnection, isExtension });
    
    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data);
            
            if (message.type === 'register_extension') {
                // VS Code extension is registering itself
                console.log('🔗 VS Code extension registered:', message.localhost);
                isExtension = true;
                registeredExtensions.set(connectionId, {
                    ws,
                    localhost: message.localhost
                });
                proxyConnections.get(connectionId).isExtension = true;
                
                ws.send(JSON.stringify({ type: 'extension_registered' }));
                
            } else if (message.type === 'connect_local') {
                // Website wants to connect to a local extension
                console.log('🔗 Website requesting connection to localhost');
                
                // Find an available extension
                const availableExtension = Array.from(registeredExtensions.values())[0];
                if (availableExtension) {
                    console.log('🔗 Connecting to extension at:', availableExtension.localhost);
                    
                    localConnection = new WebSocket(availableExtension.localhost);
                    
                    localConnection.on('open', () => {
                        console.log('✅ Connected to VS Code extension');
                        ws.send(JSON.stringify({ type: 'local_connected' }));
                    });
                    
                    localConnection.on('message', (localData) => {
                        // Forward extension data to website
                        ws.send(localData);
                    });
                    
                    localConnection.on('close', () => {
                        console.log('❌ VS Code extension connection closed');
                        ws.send(JSON.stringify({ type: 'local_disconnected' }));
                    });
                    
                    localConnection.on('error', (error) => {
                        console.error('❌ VS Code extension connection error:', error);
                        ws.send(JSON.stringify({ type: 'local_error', error: error.message }));
                    });
                    
                    // Notify the extension that a website connected
                    availableExtension.ws.send(JSON.stringify({ type: 'website_connected' }));
                    
                } else {
                    console.log('❌ No VS Code extensions available');
                    ws.send(JSON.stringify({ 
                        type: 'local_error', 
                        error: 'No VS Code extensions available. Please start the extension first.' 
                    }));
                }
                
            } else if (localConnection && localConnection.readyState === WebSocket.OPEN) {
                // Forward website data to VS Code extension
                localConnection.send(data);
            }
            
        } catch (error) {
            console.error('Error processing message:', error);
        }
    });
    
    // Add ping/pong to detect stale connections
    let pingTimeout = null;
    
    function resetPingTimeout() {
        if (pingTimeout) {
            clearTimeout(pingTimeout);
        }
        pingTimeout = setTimeout(() => {
            console.log('⏰ Connection timeout, closing stale connection');
            ws.close();
        }, 30000); // 30 second timeout
    }
    
    resetPingTimeout();
    
    ws.on('pong', () => {
        resetPingTimeout();
    });
    
    ws.on('close', () => {
        console.log('❌ Proxy connection closed');
        if (pingTimeout) {
            clearTimeout(pingTimeout);
        }
        if (localConnection) {
            localConnection.close();
        }
        proxyConnections.delete(connectionId);
        if (isExtension) {
            registeredExtensions.delete(connectionId);
        }
    });
    
    ws.on('error', (error) => {
        console.error('❌ Proxy connection error:', error);
        if (pingTimeout) {
            clearTimeout(pingTimeout);
        }
        if (localConnection) {
            localConnection.close();
        }
        proxyConnections.delete(connectionId);
        if (isExtension) {
            registeredExtensions.delete(connectionId);
        }
    });
});

// Periodic ping to keep connections alive
setInterval(() => {
    proxyConnections.forEach((connection, id) => {
        if (connection.ws.readyState === WebSocket.OPEN) {
            connection.ws.ping();
        }
    });
}, 15000); // Ping every 15 seconds

console.log('🔐 HTTPS WebSocket proxy ready for GitHub Pages compatibility');
console.log('🚂 Deployed on Railway - always online!'); 