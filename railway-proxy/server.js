// Jamango Sync Public WebSocket Proxy for Railway
// This bridges HTTPS websites to localhost WebSocket servers

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

// Track proxy connections
const proxyConnections = new Map();

wss.on('connection', (ws, req) => {
    console.log('🔗 New proxy connection from:', req.headers.origin);
    
    let localConnection = null;
    let connectionId = Date.now() + Math.random();
    
    proxyConnections.set(connectionId, { ws, localConnection });
    
    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data);
            
            if (message.type === 'connect_local') {
                // Website wants to connect to localhost
                console.log('🔗 Connecting to localhost:', message.localhost);
                
                localConnection = new WebSocket(message.localhost);
                
                localConnection.on('open', () => {
                    console.log('✅ Connected to localhost WebSocket');
                    ws.send(JSON.stringify({ type: 'local_connected' }));
                });
                
                localConnection.on('message', (localData) => {
                    // Forward local data to website
                    ws.send(localData);
                });
                
                localConnection.on('close', () => {
                    console.log('❌ Localhost connection closed');
                    ws.send(JSON.stringify({ type: 'local_disconnected' }));
                });
                
                localConnection.on('error', (error) => {
                    console.error('❌ Localhost connection error:', error);
                    ws.send(JSON.stringify({ type: 'local_error', error: error.message }));
                });
                
            } else if (localConnection && localConnection.readyState === WebSocket.OPEN) {
                // Forward website data to localhost
                localConnection.send(data);
            }
            
        } catch (error) {
            console.error('Error processing message:', error);
        }
    });
    
    ws.on('close', () => {
        console.log('❌ Proxy connection closed');
        if (localConnection) {
            localConnection.close();
        }
        proxyConnections.delete(connectionId);
    });
    
    ws.on('error', (error) => {
        console.error('❌ Proxy connection error:', error);
        if (localConnection) {
            localConnection.close();
        }
        proxyConnections.delete(connectionId);
    });
});

console.log('🔐 HTTPS WebSocket proxy ready for GitHub Pages compatibility');
console.log('🚂 Deployed on Railway - always online!'); 