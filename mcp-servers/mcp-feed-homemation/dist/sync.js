import 'dotenv/config';
import { HomemationMCPServer } from './index.js';
function parseArgs() {
    const args = process.argv.slice(2);
    const out = {};
    for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (a === '--dry-run')
            out.dryRun = true;
        if (a.startsWith('--limit='))
            out.limit = Number(a.split('=')[1] || '0') || undefined;
    }
    return out;
}
(async () => {
    console.log('🚀 Homemation MCP Server - Sync Tool');
    console.log('================================\n');
    const opts = parseArgs();
    const server = new HomemationMCPServer();
    console.log('Step 1: Testing connection...');
    const ok = await server.testConnection();
    if (!ok) {
        console.error('❌ Connection/login failed. Aborting.');
        process.exit(1);
    }
    console.log('✅ Connected and logged in\n');
    console.log('Step 2: Checking current status...');
    const status = await server.getStatus();
    console.log(`Current products in database: ${status.total_products ?? 0}\n`);
    console.log('Step 3: Syncing products...');
    const res = await server.syncProducts(opts);
    console.log('\n📊 Sync Results:');
    console.log(`Status: ${res.success ? '✅ SUCCESS' : '❌ FAILED'}`);
    console.log(`Duration: ${Math.round((res.duration_seconds || 0))}s`);
    console.log(`Products Added: ${res.products_added}`);
    console.log(`Products Updated: ${res.products_updated}`);
    if (res.errors.length > 0) {
        console.log(`\nErrors (${res.errors.length}):`);
        res.errors.slice(0, 5).forEach(err => console.error(`  - ${err}`));
    }
    if (!res.success)
        process.exit(2);
})();
