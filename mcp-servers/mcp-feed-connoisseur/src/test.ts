#!/usr/bin/env tsx
/**
 * Connoisseur Connection Test
 */

import { ConnoisseurMCPServer } from './index';

async function main() {
  console.log('🧪 Connoisseur Connection Test');
  console.log('================================\n');

  const server = new ConnoisseurMCPServer();

  try {
    console.log('🔌 Testing API connection...');
    const connected = await server.testConnection();

    if (!connected) {
      console.error('❌ Connection test failed');
      process.exit(1);
    }

    console.log('✅ Connection successful\n');

    console.log('📊 Fetching supplier status...');
    const status = await server.getStatus();

    console.log('\nSupplier Status:');
    console.log(`  Name: ${status.supplier_name}`);
    console.log(`  Status: ${status.status}`);
    console.log(`  Total Products: ${status.total_products}`);
    console.log(`  Last Sync: ${status.last_sync || 'Never'}`);

    if (status.error_message) {
      console.log(`  Error: ${status.error_message}`);
    }

    console.log('\n✅ All tests passed!');
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
