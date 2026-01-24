#!/usr/bin/env node
"use strict";
/**
 * Stage-One Connection Test
 * Tests authentication and API access
 */
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const index_1 = require("./index");
const shared_1 = require("@audico/shared");
async function main() {
    shared_1.logger.info('Stage-One MCP Server - Connection Test');
    shared_1.logger.info('======================================\n');
    // Check environment variables
    const username = process.env.STAGEONE_USERNAME;
    const password = process.env.STAGEONE_PASSWORD;
    if (!username || !password) {
        shared_1.logger.error('Missing credentials!');
        shared_1.logger.info('Please set STAGEONE_USERNAME and STAGEONE_PASSWORD in .env');
        process.exit(1);
    }
    shared_1.logger.info(`Username: ${username}`);
    shared_1.logger.info(`Password: ${'*'.repeat(password.length)}`);
    const server = new index_1.StageOneMCPServer();
    // Test connection
    shared_1.logger.info('\nTesting connection...');
    const connected = await server.testConnection();
    if (connected) {
        shared_1.logger.info('Connection successful!');
        // Get status
        try {
            const status = await server.getStatus();
            shared_1.logger.info('\nSupplier Status:');
            shared_1.logger.info(`  Name: ${status.supplier_name}`);
            shared_1.logger.info(`  Total Products: ${status.total_products}`);
            shared_1.logger.info(`  Status: ${status.status}`);
            if (status.last_sync) {
                shared_1.logger.info(`  Last Sync: ${status.last_sync.toLocaleString()}`);
            }
        }
        catch (error) {
            shared_1.logger.warn(`Could not get status: ${error.message}`);
            shared_1.logger.info('This is expected if Stage-One is not yet in the suppliers table.');
        }
    }
    else {
        shared_1.logger.error('Connection failed!');
        process.exit(1);
    }
}
main().catch(error => {
    shared_1.logger.error('Fatal error:', error);
    process.exit(1);
});
//# sourceMappingURL=test.js.map