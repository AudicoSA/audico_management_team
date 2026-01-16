#!/usr/bin/env node
/**
 * Planet World MCP Server - Test Tool
 */

import 'dotenv/config';
import { PlanetWorldMCPServer } from './index';
import { logger } from '@audico/shared';

async function main() {
  logger.info('🧪 Planet World MCP Server - Test Suite');
  logger.info('================================\n');

  const server = new PlanetWorldMCPServer();

  // Test 1: Connection
  logger.info('Test 1: Connection Test');
  const connected = await server.testConnection();
  logger.info(`Result: ${connected ? '✅ PASS' : '❌ FAIL'}\n`);

  if (!connected) {
    logger.error('Connection failed. Cannot proceed with other tests.');
    process.exit(1);
  }

  // Test 2: Get Status
  logger.info('Test 2: Get Status');
  try {
    const status = await server.getStatus();
    logger.info(`Supplier: ${status.supplier_name}`);
    logger.info(`Status: ${status.status}`);
    logger.info(`Total Products: ${status.total_products}`);
    if (status.last_sync) {
      logger.info(`Last Sync: ${status.last_sync.toLocaleString()}`);
    }
    logger.info('Result: ✅ PASS\n');
  } catch (error: any) {
    logger.error(`Result: ❌ FAIL - ${error.message}\n`);
  }

  // Test 3: Get Supplier Info
  logger.info('Test 3: Get Supplier Info');
  try {
    const supplier = await server.getSupplierInfo();
    logger.info(`Name: ${supplier.name}`);
    logger.info(`Type: ${supplier.type}`);
    logger.info(`Active: ${supplier.active}`);
    logger.info('Result: ✅ PASS\n');
  } catch (error: any) {
    logger.error(`Result: ❌ FAIL - ${error.message}\n`);
  }

  // Test 4: Dry Run Sync (limit 5 products)
  logger.info('Test 4: Dry Run Sync (5 products)');
  try {
    const result = await server.syncProducts({
      limit: 5,
      dryRun: true,
      sessionName: 'test-dry-run',
    });

    logger.info(`Success: ${result.success}`);
    logger.info(`Duration: ${result.duration_seconds}s`);
    logger.info(`Errors: ${result.errors.length}`);
    logger.info('Result: ✅ PASS\n');
  } catch (error: any) {
    logger.error(`Result: ❌ FAIL - ${error.message}\n`);
  }

  logger.info('================================');
  logger.info('✅ All tests completed!');
  logger.info('\nNext steps:');
  logger.info('1. Ensure Planet World supplier exists in Supabase');
  logger.info('2. Run: npm run sync -- --limit=10');
  logger.info('3. Check Supabase products table');
  logger.info('4. Run full sync: npm run sync');
}

main().catch(error => {
  logger.error('Fatal error:', error);
  process.exit(1);
});
