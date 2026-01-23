#!/usr/bin/env node
"use strict";
/**
 * Esquire Sync CLI
 * Usage: npm run sync [-- --limit=10] [-- --dry-run]
 */
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const index_1 = require("./index");
const shared_1 = require("@audico/shared");
async function main() {
    const args = process.argv.slice(2);
    // Parse options
    const options = {
        limit: undefined,
        dryRun: false,
        sessionName: 'cli-sync',
    };
    args.forEach(arg => {
        if (arg.startsWith('--limit=')) {
            options.limit = parseInt(arg.split('=')[1], 10);
        }
        if (arg === '--dry-run') {
            options.dryRun = true;
        }
    });
    shared_1.logger.info('🚀 Esquire MCP Server - Sync Tool');
    shared_1.logger.info('================================\n');
    if (options.dryRun) {
        shared_1.logger.info('⚠️  DRY RUN MODE - No changes will be made\n');
    }
    const server = new index_1.EsquireMCPServer();
    // Test connection first
    shared_1.logger.info('Step 1: Testing connection...');
    const connected = await server.testConnection();
    if (!connected) {
        shared_1.logger.error('❌ Connection failed. Aborting sync.');
        process.exit(1);
    }
    // Get current status
    shared_1.logger.info('\nStep 2: Checking current status...');
    const status = await server.getStatus();
    shared_1.logger.info(`Current products in database: ${status.total_products}`);
    if (status.last_sync) {
        shared_1.logger.info(`Last sync: ${status.last_sync.toLocaleString()}`);
    }
    // Sync products
    shared_1.logger.info('\nStep 3: Syncing products...');
    const result = await server.syncProducts(options);
    // Display results
    shared_1.logger.info('\n================================');
    shared_1.logger.info('📊 Sync Results:');
    shared_1.logger.info('================================');
    shared_1.logger.info(`Status: ${result.success ? '✅ SUCCESS' : '❌ FAILED'}`);
    shared_1.logger.info(`Duration: ${result.duration_seconds}s`);
    shared_1.logger.info(`Products Added: ${result.products_added}`);
    shared_1.logger.info(`Products Updated: ${result.products_updated}`);
    shared_1.logger.info(`Products Unchanged: ${result.products_unchanged}`);
    if (result.errors.length > 0) {
        shared_1.logger.info(`\n⚠️  Errors (${result.errors.length}):`);
        result.errors.slice(0, 10).forEach(err => shared_1.logger.error(`  - ${err}`));
        if (result.errors.length > 10) {
            shared_1.logger.info(`  ... and ${result.errors.length - 10} more`);
        }
    }
    if (result.warnings.length > 0) {
        shared_1.logger.info(`\n⚠️  Warnings (${result.warnings.length}):`);
        result.warnings.slice(0, 10).forEach(warn => shared_1.logger.warn(`  - ${warn}`));
    }
    // Get updated status
    const updatedStatus = await server.getStatus();
    shared_1.logger.info(`\nTotal products in database: ${updatedStatus.total_products}`);
    process.exit(result.success ? 0 : 1);
}
main().catch(error => {
    shared_1.logger.error('Fatal error:', error);
    process.exit(1);
});
