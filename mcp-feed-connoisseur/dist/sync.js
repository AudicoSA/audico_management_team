#!/usr/bin/env tsx
"use strict";
/**
 * Connoisseur Sync CLI
 * Usage: npm run sync -- [options]
 * Options:
 *   --dry-run: Preview changes without saving
 *   --limit=N: Limit to N products
 */
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const index_1 = require("./index");
async function main() {
    const args = process.argv.slice(2);
    const options = {
        dryRun: args.includes('--dry-run'),
        limit: undefined,
        sessionName: 'manual',
    };
    const limitArg = args.find(arg => arg.startsWith('--limit='));
    if (limitArg) {
        options.limit = parseInt(limitArg.split('=')[1]);
    }
    console.log('🔄 Connoisseur Product Sync');
    console.log('================================\n');
    if (options.dryRun) {
        console.log('⚠️  DRY RUN MODE - No changes will be saved\n');
    }
    console.log('Configuration:');
    console.log(`  Base URL: ${process.env.CONNOISSEUR_BASE_URL || 'https://www.connoisseur.co.za'}`);
    console.log(`  Limit: ${options.limit || 'All products'}`);
    console.log(`  Dry Run: ${options.dryRun ? 'Yes' : 'No'}`);
    console.log();
    const server = new index_1.ConnoisseurMCPServer();
    try {
        console.log('🔌 Testing connection...');
        const connected = await server.testConnection();
        if (!connected) {
            console.error('❌ Connection test failed');
            process.exit(1);
        }
        console.log('✅ Connection successful\n');
        console.log('📦 Starting product sync...\n');
        const result = await server.syncProducts(options);
        console.log('\n================================');
        console.log('📊 SYNC SUMMARY');
        console.log('================================');
        console.log(`Status: ${result.success ? '✅ SUCCESS' : '❌ FAILED'}`);
        console.log(`Session ID: ${result.session_id}`);
        console.log(`Duration: ${result.duration_seconds}s`);
        console.log();
        console.log('Results:');
        console.log(`  ✅ Added: ${result.products_added}`);
        console.log(`  ♻️  Updated: ${result.products_updated}`);
        console.log(`  ⏭️  Unchanged: ${result.products_unchanged}`);
        console.log();
        if (result.errors.length > 0) {
            console.log(`❌ Errors (${result.errors.length}):`);
            result.errors.slice(0, 5).forEach(err => console.log(`   - ${err}`));
            if (result.errors.length > 5) {
                console.log(`   ... and ${result.errors.length - 5} more`);
            }
            console.log();
        }
        if (result.warnings.length > 0) {
            console.log(`⚠️  Warnings (${result.warnings.length}):`);
            result.warnings.slice(0, 5).forEach(warn => console.log(`   - ${warn}`));
            if (result.warnings.length > 5) {
                console.log(`   ... and ${result.warnings.length - 5} more`);
            }
            console.log();
        }
        console.log('🎉 Sync complete!');
        process.exit(result.success ? 0 : 1);
    }
    catch (error) {
        console.error('\n❌ Sync failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}
main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
//# sourceMappingURL=sync.js.map