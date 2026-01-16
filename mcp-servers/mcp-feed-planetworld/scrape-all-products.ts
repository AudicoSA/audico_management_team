/**
 * Planet World - Scrape ALL Products (PRODUCTION)
 * This writes to the database!
 */

import 'dotenv/config';
import { PlanetWorldMCPServer } from './src/index';
import { logger } from '@audico/shared';

async function scrapeAllProducts() {
  logger.info('🚀 PRODUCTION: Scraping ALL Planet World products (WRITING TO DATABASE)\n');

  // Get ALL products in category 690 (speakers, audio equipment, etc.)
  // This will discover and scrape all ~1871 products via API
  process.env.PLANETWORLD_PRODUCTS_URL = '/products/browse/?categoryids=690';

  const server = new PlanetWorldMCPServer();

  const result = await server.syncProducts({
    limit: 10000, // No limit - get all products
    dryRun: false, // WRITES TO DATABASE
    sessionName: 'all-products-production-sync',
  });

  logger.info('\n📊 PRODUCTION RESULTS:');
  logger.info(`   Success: ${result.success}`);
  logger.info(`   Duration: ${result.duration_seconds}s`);
  logger.info(`   Products added: ${result.products_added}`);
  logger.info(`   Products updated: ${result.products_updated}`);
  logger.info(`   Products unchanged: ${result.products_unchanged}`);

  if (result.errors.length > 0) {
    logger.warn(`\n⚠️  Errors: ${result.errors.length}`);
    result.errors.forEach(err => logger.warn(`   - ${err}`));
  }

  logger.info('\n✅ Production sync complete - data written to database');
  logger.info(`   Total products in database: ${result.products_added + result.products_updated + result.products_unchanged}`);
}

scrapeAllProducts().catch(error => {
  logger.error(`Fatal error: ${error.message}`);
  process.exit(1);
});
