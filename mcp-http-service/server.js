import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

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
async function runMCPSync(serverKey) {
    const server = MCP_SERVERS[serverKey];
    if (!server) {
        throw new Error(`Unknown server: ${serverKey}`);
    }

    const serverPath = join(__dirname, '..', server.path);
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

// Sync endpoint for individual supplier
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
        const result = await runMCPSync(supplier);
        res.json(result);
    } catch (error) {
        res.status(500).json(error);
    }
});

// Sync all suppliers sequentially
app.post('/sync-all', async (req, res) => {
    const results = [];
    const startTime = Date.now();

    console.log('🚀 Starting sync for all suppliers...');

    for (const [key, config] of Object.entries(MCP_SERVERS)) {
        try {
            console.log(`\n📦 Syncing ${config.name}...`);
            const result = await runMCPSync(key);
            results.push(result);
        } catch (error) {
            results.push(error);
        }
    }

    const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log(`\n✅ Sync all completed in ${totalDuration}s`);
    console.log(`   Success: ${successful}, Failed: ${failed}`);

    res.json({
        success: failed === 0,
        total: results.length,
        successful,
        failed,
        duration: parseFloat(totalDuration),
        results
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
