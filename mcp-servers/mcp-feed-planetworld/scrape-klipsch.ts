/**
 * Klipsch Speakers Scraper for Planet World
 * Specialized scraper for: https://www.planetworld.co.za/products/browse/?categoryids=690&manufacturerids=99
 */

import 'dotenv/config';
import { PlanetWorldMCPServer } from './src/index';
import { logger } from '@audico/shared';

async function scrapeKlipschSpeakers() {
  logger.info('🔊 Starting Klipsch speakers scrape from Planet World...\n');

  const server = new PlanetWorldMCPServer();

  // Test connection first
  logger.info('🔌 Testing connection...');
  const connected = await server.testConnection();

  if (!connected) {
    logger.error('❌ Connection failed. Aborting.');
    process.exit(1);
  }

  logger.info('✅ Connection successful!\n');

  // Sync products with custom URL for Klipsch
  logger.info('📦 Starting Klipsch product sync...');
  logger.info('   URL: https://www.planetworld.co.za/products/browse/?categoryids=690&manufacturerids=99');
  logger.info('   Expected: ~156 Klipsch speakers\n');

  // Override the products URL for this specific scrape
  process.env.PLANETWORLD_PRODUCTS_URL = '/products/browse/?categoryids=690&manufacturerids=99';

  const result = await server.syncProducts({
    limit: 200, // Fetch up to 200 products to ensure we get all 156
    dryRun: false, // Set to true for testing without database writes
    sessionName: 'klipsch-speakers-import',
  });

  if (result.success) {
    logger.info('\n✅ Klipsch scrape completed successfully!');
    logger.info(`   Products added: ${result.products_added}`);
    logger.info(`   Products updated: ${result.products_updated}`);
    logger.info(`   Duration: ${result.duration_seconds}s`);
    logger.info(`   Session ID: ${result.session_id}`);

    if (result.errors.length > 0) {
      logger.warn(`\n⚠️  Errors encountered: ${result.errors.length}`);
      result.errors.slice(0, 5).forEach(err => logger.warn(`   - ${err}`));
    }
  } else {
    logger.error('\n❌ Scrape failed!');
    logger.error(`   Error: ${result.errors[0] || 'Unknown error'}`);
    process.exit(1);
  }

  logger.info('\n🎉 Done! Klipsch speakers should now be available in chat.');
}

// Run the scraper
scrapeKlipschSpeakers().catch(error => {
  logger.error(`Fatal error: ${error.message}`);
  process.exit(1);
});
