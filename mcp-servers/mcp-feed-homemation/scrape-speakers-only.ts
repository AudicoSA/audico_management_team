/**
 * Homemation - Scrape SPEAKERS ONLY (focused sync)
 * Uses filtered URL for specific speaker manufacturers including Monitor Audio
 */

import 'dotenv/config';
import { HomemationMCPServer } from './src/index.js';

(async () => {
  console.log('🎵 Homemation - Speakers Only Sync');
  console.log('================================\n');

  // Override to use speaker-specific URL with manufacturer filters
  // This includes: Monitor Audio, Paradigm, B&W, Polk, SVS, etc.
  // 524 speaker products instead of 1000+ mixed products
  process.env.HOMEMATION_CATEGORY_URLS = 'https://www.homemation.co.za/products/browse/?manufacturerids=63_11_9_78_68_36_89_39';

  const server = new HomemationMCPServer();

  console.log('Step 1: Testing connection...');
  const ok = await server.testConnection();
  if (!ok) {
    console.error('❌ Connection failed. Aborting.');
    process.exit(1);
  }
  console.log('✅ Connected\n');

  console.log('Step 2: Checking current status...');
  const status = await server.getStatus();
  console.log(`Current products in database: ${status.total_products ?? 0}\n`);

  console.log('Step 3: Syncing speakers...');
  const res = await server.syncProducts({
    dryRun: false, // WRITE TO DATABASE
    limit: undefined // Get all speakers
  });

  console.log('\n📊 Sync Results:');
  console.log(`Status: ${res.success ? '✅ SUCCESS' : '❌ FAILED'}`);
  console.log(`Duration: ${Math.round((res.duration_seconds || 0))}s`);
  console.log(`Products Added: ${res.products_added}`);
  console.log(`Products Updated: ${res.products_updated}`);
  console.log(`Total Processed: ${res.products_added + res.products_updated}`);

  if (res.errors.length > 0) {
    console.log(`\n⚠️ Errors (${res.errors.length}):`);
    res.errors.slice(0, 10).forEach(err => console.error(`  - ${err}`));
  }

  console.log('\n✅ Speaker sync complete!');
  if (!res.success) process.exit(2);
})();
