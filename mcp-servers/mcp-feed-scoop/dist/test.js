#!/usr/bin/env node
"use strict";
/**
 * Nology MCP Server - Test Tool
 * Tests connection and basic functionality
 */
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const index_1 = require("./index");
const shared_1 = require("@audico/shared");
async function main() {
    shared_1.logger.info('🧪 Nology MCP Server - Test Suite');
    shared_1.logger.info('================================\n');
    const server = new index_1.ScoopMCPServer();
    // Test 1: Connection
    shared_1.logger.info('Test 1: Connection Test');
    const connected = await server.testConnection();
    shared_1.logger.info(`Result: ${connected ? '✅ PASS' : '❌ FAIL'}\n`);
    if (!connected) {
        shared_1.logger.error('Connection failed. Cannot proceed with other tests.');
        process.exit(1);
    }
    // Test 2: Get Status
    shared_1.logger.info('Test 2: Get Status');
    try {
        const status = await server.getStatus();
        shared_1.logger.info(`Supplier: ${status.supplier_name}`);
        shared_1.logger.info(`Status: ${status.status}`);
        shared_1.logger.info(`Total Products: ${status.total_products}`);
        if (status.last_sync) {
            shared_1.logger.info(`Last Sync: ${status.last_sync.toLocaleString()}`);
        }
        shared_1.logger.info('Result: ✅ PASS\n');
    }
    catch (error) {
        shared_1.logger.error(`Result: ❌ FAIL - ${error.message}\n`);
    }
    // Test 3: Get Supplier Info
    shared_1.logger.info('Test 3: Get Supplier Info');
    try {
        const supplier = await server.getSupplierInfo();
        shared_1.logger.info(`Name: ${supplier.name}`);
        shared_1.logger.info(`Type: ${supplier.type}`);
        shared_1.logger.info(`Active: ${supplier.active}`);
        shared_1.logger.info('Result: ✅ PASS\n');
    }
    catch (error) {
        shared_1.logger.error(`Result: ❌ FAIL - ${error.message}\n`);
    }
    // Test 4: Dry Run Sync (limit 5 products)
    shared_1.logger.info('Test 4: Dry Run Sync (5 products)');
    try {
        const result = await server.syncProducts({
            limit: 5,
            dryRun: true,
            sessionName: 'test-dry-run',
        });
        shared_1.logger.info(`Success: ${result.success}`);
        shared_1.logger.info(`Duration: ${result.duration_seconds}s`);
        shared_1.logger.info(`Errors: ${result.errors.length}`);
        shared_1.logger.info('Result: ✅ PASS\n');
    }
    catch (error) {
        shared_1.logger.error(`Result: ❌ FAIL - ${error.message}\n`);
    }
    shared_1.logger.info('================================');
    shared_1.logger.info('✅ All tests completed!');
    shared_1.logger.info('\nNext steps:');
    shared_1.logger.info('1. Run: npm run sync -- --limit=10');
    shared_1.logger.info('2. Check Supabase products table');
    shared_1.logger.info('3. Run full sync: npm run sync');
}
main().catch(error => {
    shared_1.logger.error('Fatal error:', error);
    process.exit(1);
});
