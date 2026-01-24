#!/usr/bin/env node
/**
 * Stage-One Connection Test
 * Tests authentication and API access
 */

import 'dotenv/config';
import { StageOneMCPServer } from './index';
import { logger } from '@audico/shared';

async function main() {
  logger.info('Stage-One MCP Server - Connection Test');
  logger.info('======================================\n');

  // Check environment variables
  const username = process.env.STAGEONE_USERNAME;
  const password = process.env.STAGEONE_PASSWORD;

  if (!username || !password) {
    logger.error('Missing credentials!');
    logger.info('Please set STAGEONE_USERNAME and STAGEONE_PASSWORD in .env');
    process.exit(1);
  }

  logger.info(`Username: ${username}`);
  logger.info(`Password: ${'*'.repeat(password.length)}`);

  const server = new StageOneMCPServer();

  // Test connection
  logger.info('\nTesting connection...');
  const connected = await server.testConnection();

  if (connected) {
    logger.info('Connection successful!');

    // Get status
    try {
      const status = await server.getStatus();
      logger.info('\nSupplier Status:');
      logger.info(`  Name: ${status.supplier_name}`);
      logger.info(`  Total Products: ${status.total_products}`);
      logger.info(`  Status: ${status.status}`);
      if (status.last_sync) {
        logger.info(`  Last Sync: ${status.last_sync.toLocaleString()}`);
      }
    } catch (error: any) {
      logger.warn(`Could not get status: ${error.message}`);
      logger.info('This is expected if Stage-One is not yet in the suppliers table.');
    }
  } else {
    logger.error('Connection failed!');
    process.exit(1);
  }
}

main().catch(error => {
  logger.error('Fatal error:', error);
  process.exit(1);
});
