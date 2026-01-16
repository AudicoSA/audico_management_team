#!/usr/bin/env tsx
/**
 * OpenCart Push MCP Server - Test Suite
 */

import { OpenCartPushServer } from './index';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

async function runTests() {
  console.log('🧪 OpenCart Push MCP Server - Test Suite');
  console.log('=========================================\n');

  const server = new OpenCartPushServer();

  let passed = 0;
  let failed = 0;

  // Test 1: Connection Test
  console.log('Test 1: OpenCart API Connection');
  try {
    const connected = await server.testConnection();
    if (connected) {
      console.log('✅ PASS - Connected to OpenCart API\n');
      passed++;
    } else {
      console.log('❌ FAIL - Connection failed\n');
      failed++;
    }
  } catch (error: any) {
    console.log(`❌ FAIL - ${error.message}\n`);
    failed++;
  }

  // Test 2: Dry Run Push
  console.log('Test 2: Dry Run Push (5 products)');
  try {
    const result = await server.pushProducts({
      limit: 5,
      dryRun: true,
      sessionName: 'test',
    });

    if (result.success && result.products_skipped === 5) {
      console.log('✅ PASS - Dry run completed successfully\n');
      passed++;
    } else {
      console.log(`❌ FAIL - Unexpected result: ${JSON.stringify(result)}\n`);
      failed++;
    }
  } catch (error: any) {
    console.log(`❌ FAIL - ${error.message}\n`);
    failed++;
  }

  // Test 3: Environment Configuration
  console.log('Test 3: Environment Configuration');
  const requiredVars = [
    'OPENCART_BASE_URL',
    'OPENCART_CLIENT_ID',
    'OPENCART_CLIENT_SECRET',
    'OPENCART_ADMIN_USERNAME',
    'OPENCART_ADMIN_PASSWORD',
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_KEY',
  ];

  const missing = requiredVars.filter((v) => !process.env[v]);

  if (missing.length === 0) {
    console.log('✅ PASS - All required environment variables set\n');
    passed++;
  } else {
    console.log(`❌ FAIL - Missing variables: ${missing.join(', ')}\n`);
    failed++;
  }

  // Summary
  console.log('=========================================');
  console.log('TEST SUMMARY');
  console.log('=========================================');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`Total: ${passed + failed}`);
  console.log();

  if (failed === 0) {
    console.log('🎉 All tests passed!');
    console.log('\n💡 Next steps:');
    console.log('   1. Run: npm run push -- --dry-run --limit=5');
    console.log('   2. Verify output looks correct');
    console.log('   3. Run: npm run push -- --limit=5 (actual push)');
    console.log('   4. Check OpenCart admin for new products in LiveFeed');
    console.log();
  } else {
    console.log('❌ Some tests failed. Please fix the issues above.');
    process.exit(1);
  }
}

runTests().catch((error) => {
  console.error('Fatal test error:', error);
  process.exit(1);
});
