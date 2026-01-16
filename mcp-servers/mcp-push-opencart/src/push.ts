#!/usr/bin/env tsx
/**
 * OpenCart Push CLI
 * Usage: npm run push -- [options]
 */

import { OpenCartPushServer } from './index';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

async function main() {
  const args = process.argv.slice(2);

  // Parse command line arguments
  const options: any = {
    dryRun: args.includes('--dry-run'),
    limit: undefined,
    brand: undefined,
    supplierId: undefined,
    sessionName: 'manual',
  };

  // Parse limit
  const limitArg = args.find((arg) => arg.startsWith('--limit='));
  if (limitArg) {
    options.limit = parseInt(limitArg.split('=')[1]);
  }

  // Parse brand filter
  const brandArg = args.find((arg) => arg.startsWith('--brand='));
  if (brandArg) {
    options.brand = brandArg.split('=')[1];
  }

  // Parse supplier filter
  const supplierArg = args.find((arg) => arg.startsWith('--supplier='));
  if (supplierArg) {
    options.supplierId = supplierArg.split('=')[1];
  }

  console.log('🚀 OpenCart Push MCP Server');
  console.log('===========================\n');

  if (options.dryRun) {
    console.log('⚠️  DRY RUN MODE - No actual changes will be made\n');
  }

  console.log('Configuration:');
  console.log(`  Base URL: ${process.env.OPENCART_BASE_URL}`);
  console.log(`  LiveFeed Category: ${process.env.OPENCART_LIVEFEED_CATEGORY_ID || '967'}`);
  console.log(`  Brand Filter: ${options.brand || 'All brands'}`);
  console.log(`  Supplier Filter: ${options.supplierId || 'All suppliers'}`);
  console.log(`  Limit: ${options.limit || 'All products'}`);
  console.log(`  Dry Run: ${options.dryRun ? 'Yes' : 'No'}`);
  console.log();

  const server = new OpenCartPushServer();

  try {
    // Test connection first
    console.log('🔌 Testing OpenCart connection...');
    const connected = await server.testConnection();

    if (!connected) {
      console.error('❌ Connection test failed. Please check your credentials.');
      process.exit(1);
    }

    console.log('✅ Connection successful\n');

    // Push products
    console.log('📦 Starting product push...\n');
    const result = await server.pushProducts(options);

    console.log('\n================================');
    console.log('📊 PUSH SESSION SUMMARY');
    console.log('================================');
    console.log(`Status: ${result.success ? '✅ SUCCESS' : '❌ FAILED'}`);
    console.log(`Session ID: ${result.session_id}`);
    console.log(`Duration: ${result.duration_seconds}s`);
    console.log();
    console.log('Results:');
    console.log(`  ✅ Created: ${result.products_created}`);
    console.log(`  ♻️  Updated: ${result.products_updated}`);
    console.log(`  ⏭️  Skipped: ${result.products_skipped}`);
    console.log(`  ❌ Failed: ${result.products_failed}`);
    console.log();

    if (result.products_failed > 0) {
      console.log('❌ Failed Products:');
      result.results
        .filter((r) => !r.success)
        .forEach((r) => {
          console.log(`   - ${r.product_name}: ${r.error}`);
        });
      console.log();
    }

    if (result.products_created > 0) {
      console.log('✅ Created Products (first 5):');
      result.results
        .filter((r) => r.action === 'created')
        .slice(0, 5)
        .forEach((r) => {
          console.log(`   - ${r.product_name} (ID: ${r.opencart_id})`);
        });
      console.log();
    }

    console.log('🎉 Push session complete!');
    console.log();

    if (options.dryRun) {
      console.log('💡 This was a dry run. Run without --dry-run to actually push products.');
    } else {
      console.log('💡 Check your OpenCart admin panel to see the new products in LiveFeed category.');
    }

    process.exit(result.success ? 0 : 1);
  } catch (error: any) {
    console.error('\n❌ Push failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
