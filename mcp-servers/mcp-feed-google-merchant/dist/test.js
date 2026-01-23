/**
 * Test script for Google Merchant Feed MCP Server
 */
import 'dotenv/config';
import { GoogleMerchantFeedMCPServer } from './index.js';
async function runTests() {
    console.log('🧪 Google Merchant Feed MCP Server - Test Suite');
    console.log('================================================\n');
    const server = new GoogleMerchantFeedMCPServer();
    try {
        // Test 1: Connection
        console.log('Test 1: Connection Test...');
        const connected = await server.testConnection();
        console.log(connected ? '✅ PASS\n' : '❌ FAIL\n');
        if (!connected) {
            console.log('⚠️  Cannot proceed - connection failed');
            process.exit(1);
        }
        // Test 2: Get Status
        console.log('Test 2: Get Status...');
        const status = await server.getStatus();
        console.log(`✅ PASS - ${status.total_products} products\n`);
        // Test 3: Get Supplier Info
        console.log('Test 3: Get Supplier Info...');
        const supplier = await server.getSupplierInfo();
        console.log(`✅ PASS - Supplier: ${supplier.name}\n`);
        // Test 4: Dry Run Sync (5 products)
        console.log('Test 4: Dry Run Sync (5 products)...');
        const result = await server.syncProducts({ limit: 5, dryRun: true });
        console.log(result.success ? '✅ PASS\n' : '❌ FAIL\n');
        console.log('================================================');
        console.log('✅ All tests completed!');
        console.log('\n📋 Next Steps:');
        console.log('   1. One-time migration: npm run migrate');
        console.log('   2. Ongoing sync: npm run sync');
    }
    catch (error) {
        console.error('❌ Test failed:', error.message);
        process.exit(1);
    }
}
runTests();
