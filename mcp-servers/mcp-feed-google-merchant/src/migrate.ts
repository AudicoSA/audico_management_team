/**
 * ONE-TIME migration script for Google Merchant Feed
 *
 * USAGE: npm run migrate
 *
 * PURPOSE: Import all 7,000+ existing OpenCart products into Supabase
 * - Run this ONCE to populate Supabase with existing store products
 * - After this, use npm run sync for ongoing updates
 *
 * WARNING: This will import ALL products from the feed
 */

import 'dotenv/config';
import { GoogleMerchantFeedMCPServer } from './index.js';
import { logger } from '@audico/shared';
import * as readline from 'readline';

async function askConfirmation(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
    });
  });
}

async function main() {
  logger.info('🚨 Google Merchant Feed - ONE-TIME MIGRATION');
  logger.info('============================================\n');

  logger.info('⚠️  WARNING: This script will import ALL products from your Google Feed.');
  logger.info('⚠️  This should only be run ONCE for initial migration.');
  logger.info('⚠️  After migration, use "npm run sync" for ongoing updates.\n');

  const server = new GoogleMerchantFeedMCPServer();

  try {
    // Test connection first
    logger.info('Step 1: Testing connection...');
    const connected = await server.testConnection();
    if (!connected) throw new Error('Connection failed');
    logger.info('✅ Connected\n');

    // Get current status
    logger.info('Step 2: Checking current status...');
    const status = await server.getStatus();
    logger.info(`Current Manual Upload products: ${status.total_products}\n`);

    // Confirm before proceeding
    const confirmed = await askConfirmation(
      '❓ Are you sure you want to proceed with full migration? (yes/no): '
    );

    if (!confirmed) {
      logger.info('❌ Migration cancelled by user');
      process.exit(0);
    }

    logger.info('\n🚀 Starting full migration...');
    logger.info('🛡️  Loop prevention enabled - will skip supplier products\n');

    const startTime = Date.now();

    // Run full sync (no limit)
    const result = await server.syncProducts({
      sessionName: 'one-time-migration',
    });

    const durationMinutes = Math.floor(result.duration_seconds / 60);

    // Display results
    logger.info('\n============================================');
    logger.info('📊 Migration Results:');
    logger.info('============================================');
    logger.info(`Status: ${result.success ? '✅ SUCCESS' : '❌ FAILED'}`);
    logger.info(`Duration: ${durationMinutes}m ${result.duration_seconds % 60}s`);
    logger.info(`Products Added: ${result.products_added}`);
    logger.info(`Products Updated: ${result.products_updated}`);
    logger.info(`Products Skipped (suppliers): ${result.products_unchanged}`);

    if (result.errors.length > 0) {
      logger.info(`\n⚠️  Errors: ${result.errors.length}`);
      result.errors.slice(0, 10).forEach(err => logger.error(`  - ${err}`));
      if (result.errors.length > 10) {
        logger.error(`  ... and ${result.errors.length - 10} more`);
      }
    }

    // Get final status
    const finalStatus = await server.getStatus();
    logger.info(`\n✅ Total Manual Upload products in Supabase: ${finalStatus.total_products}`);

    logger.info('\n📋 Next Steps:');
    logger.info('   1. Verify products in Supabase');
    logger.info('   2. Use "npm run sync" for ongoing updates (catches new manual products)');
    logger.info('   3. Chat AI can now query all products from Supabase');

    process.exit(result.success ? 0 : 1);
  } catch (error: any) {
    logger.error(`❌ Migration failed: ${error.message}`);
    process.exit(1);
  }
}

main();
