/**
 * Ongoing sync script for Google Merchant Feed
 *
 * USAGE: npm run sync
 *
 * PURPOSE: Catches new products added manually to OpenCart
 * - Skips products managed by real suppliers
 * - Only syncs Manual Upload products
 */
import 'dotenv/config';
import { GoogleMerchantFeedMCPServer } from './index.js';
import { logger } from '@audico/shared';
async function main() {
    logger.info('🔄 Google Merchant Feed - Ongoing Sync');
    logger.info('======================================\n');
    const server = new GoogleMerchantFeedMCPServer();
    try {
        // Test connection
        logger.info('Step 1: Testing connection...');
        const connected = await server.testConnection();
        if (!connected)
            throw new Error('Connection failed');
        logger.info('✅ Connected\n');
        // Get status
        logger.info('Step 2: Checking current status...');
        const status = await server.getStatus();
        logger.info(`Current Manual Upload products: ${status.total_products}`);
        if (status.last_sync) {
            logger.info(`Last sync: ${status.last_sync.toLocaleString()}`);
        }
        logger.info('');
        // Parse command line args
        const args = process.argv.slice(2);
        const limitArg = args.find(arg => arg.startsWith('--limit='));
        const dryRun = args.includes('--dry-run');
        const limit = limitArg ? parseInt(limitArg.split('=')[1]) : undefined;
        // Sync
        logger.info('Step 3: Syncing products...');
        logger.info('🛡️  Loop prevention enabled - skipping supplier products\n');
        const result = await server.syncProducts({
            limit,
            dryRun,
            sessionName: 'ongoing-sync',
        });
        // Display results
        logger.info('\n======================================');
        logger.info('📊 Sync Results:');
        logger.info('======================================');
        logger.info(`Status: ${result.success ? '✅ SUCCESS' : '❌ FAILED'}`);
        logger.info(`Duration: ${result.duration_seconds}s`);
        logger.info(`Products Added: ${result.products_added}`);
        logger.info(`Products Updated: ${result.products_updated}`);
        logger.info(`Products Skipped (suppliers): ${result.products_unchanged}`);
        if (result.errors.length > 0) {
            logger.info(`\nErrors: ${result.errors.length}`);
            result.errors.slice(0, 5).forEach(err => logger.error(`  - ${err}`));
            if (result.errors.length > 5) {
                logger.error(`  ... and ${result.errors.length - 5} more`);
            }
        }
        // Get updated status
        const newStatus = await server.getStatus();
        logger.info(`\nTotal Manual Upload products: ${newStatus.total_products}`);
        process.exit(result.success ? 0 : 1);
    }
    catch (error) {
        logger.error(`❌ Sync failed: ${error.message}`);
        process.exit(1);
    }
}
main();
