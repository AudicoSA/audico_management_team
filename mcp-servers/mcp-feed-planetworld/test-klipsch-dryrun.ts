/**
 * DRY RUN Test - Klipsch Speakers
 * Tests the scraper without writing to database
 */

import 'dotenv/config';
import { PlanetWorldMCPServer } from './src/index';
import { logger } from '@audico/shared';

async function testKlipschDryRun() {
  logger.info('🧪 DRY RUN: Testing Planet World scraper - ALL PRODUCTS (no database writes)\n');

  // Get ALL products by using the browse page with just category filter (no manufacturer filter)
  // This shows all products in category 690 which includes speakers, audio equipment, etc.
  // The API tracking will discover all product IDs in this category
  process.env.PLANETWORLD_PRODUCTS_URL = '/products/browse/?categoryids=690';

  const server = new PlanetWorldMCPServer();

  const result = await server.syncProducts({
    limit: 10000, // No limit - get all products
    dryRun: true, // NO DATABASE WRITES
    sessionName: 'all-products-test-dryrun',
  });

  logger.info('\n📊 DRY RUN RESULTS:');
  logger.info(`   Success: ${result.success}`);
  logger.info(`   Duration: ${result.duration_seconds}s`);
  logger.info(`   Products found: ${result.products_added + result.products_updated}`);

  if (result.errors.length > 0) {
    logger.warn(`\n⚠️  Errors: ${result.errors.length}`);
    result.errors.forEach(err => logger.warn(`   - ${err}`));
  }

  logger.info('\n✅ Dry run complete - no data was written to database');
  logger.info('   Review the output above to verify product data looks correct');
  logger.info('   If it looks good, run: npm run scrape:klipsch');
}

testKlipschDryRun().catch(error => {
  logger.error(`Fatal error: ${error.message}`);
  process.exit(1);
});
