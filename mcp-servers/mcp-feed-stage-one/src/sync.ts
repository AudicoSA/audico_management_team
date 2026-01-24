#!/usr/bin/env node
/**
 * Stage-One Sync CLI
 * Usage: npm run sync [-- --limit=10] [-- --dry-run]
 */

import 'dotenv/config';
import { StageOneMCPServer } from './index';
import { logger } from '@audico/shared';

async function main() {
  const args = process.argv.slice(2);

  // Parse options
  const options = {
    limit: undefined as number | undefined,
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

  logger.info('Stage-One MCP Server - Sync Tool');
  logger.info('================================\n');

  if (options.dryRun) {
    logger.info('DRY RUN MODE - No changes will be made\n');
  }

  const server = new StageOneMCPServer();

  // Test connection first
  logger.info('Step 1: Testing connection & authenticating...');
  const connected = await server.testConnection();

  if (!connected) {
    logger.error('Connection/authentication failed. Aborting sync.');
    process.exit(1);
  }

  // Get current status
  logger.info('\nStep 2: Checking current status...');
  const status = await server.getStatus();
  logger.info(`Current products in database: ${status.total_products}`);
  if (status.last_sync) {
    logger.info(`Last sync: ${status.last_sync.toLocaleString()}`);
  }

  // Sync products
  logger.info('\nStep 3: Syncing products...');
  const result = await server.syncProducts(options);

  // Display results
  logger.info('\n================================');
  logger.info('Sync Results:');
  logger.info('================================');
  logger.info(`Status: ${result.success ? 'SUCCESS' : 'FAILED'}`);
  logger.info(`Duration: ${result.duration_seconds}s`);
  logger.info(`Products Added: ${result.products_added}`);
  logger.info(`Products Updated: ${result.products_updated}`);
  logger.info(`Products Unchanged: ${result.products_unchanged}`);

  if (result.errors.length > 0) {
    logger.info(`\nErrors (${result.errors.length}):`);
    result.errors.slice(0, 10).forEach(err => logger.error(`  - ${err}`));
    if (result.errors.length > 10) {
      logger.info(`  ... and ${result.errors.length - 10} more`);
    }
  }

  if (result.warnings.length > 0) {
    logger.info(`\nWarnings (${result.warnings.length}):`);
    result.warnings.slice(0, 10).forEach(warn => logger.warn(`  - ${warn}`));
  }

  // Get updated status
  const updatedStatus = await server.getStatus();
  logger.info(`\nTotal products in database: ${updatedStatus.total_products}`);

  process.exit(result.success ? 0 : 1);
}

main().catch(error => {
  logger.error('Fatal error:', error);
  process.exit(1);
});
