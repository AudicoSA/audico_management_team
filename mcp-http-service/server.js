import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import { randomUUID } from 'crypto';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Track active sync sessions
const activeSyncs = new Map(); // sessionId -> sync status object

// Middleware
app.use(cors());
app.use(express.json());

// Logging middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

// MCP server configurations
const MCP_SERVERS = {
    'nology': { path: 'mcp-feed-nology', name: 'Nology' },
    'stock2shop': { path: 'mcp-feed-stock2shop', name: 'Stock2Shop' },
    'solution-technologies': { path: 'mcp-feed-solution-technologies', name: 'Solution Technologies' },
    'esquire': { path: 'mcp-feed-esquire', name: 'Esquire' },
    'scoop': { path: 'mcp-feed-scoop', name: 'Scoop' },
    'smart-homes': { path: 'mcp-feed-smart-homes', name: 'Smart Homes' },
    'connoisseur': { path: 'mcp-feed-connoisseur', name: 'Connoisseur' },
    'proaudio': { path: 'mcp-feed-proaudio', name: 'ProAudio' },
    'planetworld': { path: 'mcp-feed-planetworld', name: 'Planet World' },
};

/**
 * Execute sync script for a specific MCP server
 * Directly runs node instead of npm to avoid shell dependency
 */
async function runMCPSync(serverKey, sessionId = null) {
    const server = MCP_SERVERS[serverKey];
    if (!server) {
        throw new Error(`Unknown server: ${serverKey}`);
    }

    // Fix path to point to mcp-servers directory in Monorepo
    const serverPath = join(__dirname, '..', 'mcp-servers', server.path);
    const syncScriptPath = join(serverPath, 'dist', 'sync.js');

    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        let stdout = '';
        let stderr = '';

        console.log(`[${server.name}] Starting sync: node ${syncScriptPath}`);

        // Execute node directly without shell
        const child = spawn('node', [syncScriptPath], {
            cwd: serverPath,
            shell: false,  // Don't use shell - avoids /bin/sh dependency
            env: { ...process.env }
        });

        child.stdout.on('data', (data) => {
            const output = data.toString();
            stdout += output;
            console.log(`[${server.name}] ${output.trim()}`);

            // Update progress if session exists
            if (sessionId && activeSyncs.has(sessionId)) {
                const status = activeSyncs.get(sessionId);
                status.lastOutput = output.trim();
            }
        });

        child.stderr.on('data', (data) => {
            const output = data.toString();
            stderr += output;
            console.error(`[${server.name}] ERROR: ${output.trim()}`);
        });

        child.on('close', (code) => {
            const duration = ((Date.now() - startTime) / 1000).toFixed(2);

            if (code === 0) {
                console.log(`[${server.name}] ✅ Sync completed in ${duration}s`);
                resolve({
                    success: true,
                    supplier: server.name,
                    duration: parseFloat(duration),
                    output: stdout.slice(-500), // Last 500 chars
                    error: null
                });
            } else {
                console.error(`[${server.name}] ❌ Sync failed with code ${code}`);
                reject({
                    success: false,
                    supplier: server.name,
                    duration: parseFloat(duration),
                    output: null,
                    error: stderr.slice(-500) || `Process exited with code ${code}`
                });
            }
        });

        child.on('error', (error) => {
            console.error(`[${server.name}] ❌ Failed to start: ${error.message}`);
            reject({
                success: false,
                supplier: server.name,
                duration: 0,
                output: null,
                error: error.message
            });
        });
    });
}

/**
 * Start sync asynchronously and return session ID immediately
 */
function startSyncAsync(serverKey) {
    const sessionId = randomUUID();
    const server = MCP_SERVERS[serverKey];

    if (!server) {
        throw new Error(`Unknown server: ${serverKey}`);
    }

    // Initialize sync status
    activeSyncs.set(sessionId, {
        sessionId,
        supplier: serverKey,
        supplierName: server.name,
        status: 'running',
        startedAt: new Date().toISOString(),
        completedAt: null,
        duration: null,
        result: null,
        error: null,
        lastOutput: null
    });

    // Run sync in background
    runMCPSync(serverKey, sessionId)
        .then(result => {
            const status = activeSyncs.get(sessionId);
            if (status) {
                status.status = 'completed';
                status.completedAt = new Date().toISOString();
                status.duration = result.duration;
                status.result = result;
            }
        })
        .catch(error => {
            const status = activeSyncs.get(sessionId);
            if (status) {
                status.status = 'failed';
                status.completedAt = new Date().toISOString();
                status.duration = error.duration || 0;
                status.error = error.error || error.message;
            }
        });

    return sessionId;
}

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'mcp-http-service',
        timestamp: new Date().toISOString(),
        available_suppliers: Object.keys(MCP_SERVERS)
    });
});

// List available suppliers
app.get('/suppliers', (req, res) => {
    res.json({
        suppliers: Object.entries(MCP_SERVERS).map(([key, config]) => ({
            key,
            name: config.name,
            endpoint: `/sync/${key}`
        }))
    });
});

// Sync endpoint for individual supplier (async)
app.post('/sync/:supplier', async (req, res) => {
    const { supplier } = req.params;

    if (!MCP_SERVERS[supplier]) {
        return res.status(404).json({
            success: false,
            error: `Unknown supplier: ${supplier}`,
            available_suppliers: Object.keys(MCP_SERVERS)
        });
    }

    try {
        const sessionId = startSyncAsync(supplier);
        res.json({
            success: true,
            sessionId,
            supplier,
            message: 'Sync started in background',
            statusEndpoint: `/sync-status/${sessionId}`
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get status of a specific sync session
app.get('/sync-status/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    const status = activeSyncs.get(sessionId);

    if (!status) {
        return res.status(404).json({
            success: false,
            error: 'Session not found'
        });
    }

    res.json(status);
});

// Sync all suppliers (async)
app.post('/sync-all', async (req, res) => {
    console.log('🚀 Starting async sync for all suppliers...');

    const sessions = {};

    for (const [key, config] of Object.entries(MCP_SERVERS)) {
        try {
            const sessionId = startSyncAsync(key);
            sessions[key] = {
                sessionId,
                supplier: key,
                name: config.name
            };
        } catch (error) {
            console.error(`Failed to start sync for ${config.name}:`, error);
            sessions[key] = {
                error: error.message,
                supplier: key,
                name: config.name
            };
        }
    }

    res.json({
        success: true,
        message: 'All syncs started in background',
        sessions,
        statusEndpoint: '/sync-all-status'
    });
});

// Get status of all active syncs
app.get('/sync-all-status', (req, res) => {
    const allStatuses = {};

    for (const [key, config] of Object.entries(MCP_SERVERS)) {
        // Find the most recent session for this supplier
        let latestSession = null;
        let latestTime = 0;

        for (const [sessionId, status] of activeSyncs.entries()) {
            if (status.supplier === key) {
                const time = new Date(status.startedAt).getTime();
                if (time > latestTime) {
                    latestTime = time;
                    latestSession = status;
                }
            }
        }

        allStatuses[key] = latestSession || {
            supplier: key,
            supplierName: config.name,
            status: 'idle',
            message: 'No recent sync'
        };
    }

    res.json({
        suppliers: allStatuses,
        timestamp: new Date().toISOString()
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: err.message
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`\n🚀 MCP HTTP Service running on port ${PORT}`);
    console.log(`📍 Health check: http://localhost:${PORT}/health`);
    console.log(`📋 Suppliers: http://localhost:${PORT}/suppliers`);
    console.log(`\n Available sync endpoints:`);
    Object.entries(MCP_SERVERS).forEach(([key, config]) => {
        console.log(`   POST /sync/${key} - ${config.name}`);
    });
    console.log(`\n🔄 Sync all: POST /sync-all\n`);
});
