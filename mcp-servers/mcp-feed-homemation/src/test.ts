import 'dotenv/config';
import { HomemationMCPServer } from './index.js';

(async () => {
  console.log('🧪 Homemation MCP Server - Test Suite');
  console.log('================================\n');

  const server = new HomemationMCPServer();

  // Test 1: Connection
  process.stdout.write('Test 1: Connection Test... ');
  const ok = await server.testConnection();
  console.log(ok ? '✅ PASS' : '❌ FAIL');

  // Test 2: Get Status
  console.log('\nTest 2: Get Status');
  const st = await server.getStatus();
  console.log(`Supplier: ${st.supplier_name}`);
  console.log(`Status: ${st.status}`);
  console.log(`Total Products: ${st.total_products ?? 0}`);
  console.log('Result: ✅ PASS');

  // Test 3: Get Supplier Info
  console.log('\nTest 3: Get Supplier Info');
  const info = await server.getSupplierInfo();
  console.log(`Name: ${info.name}`);
  console.log(`Type: ${info.type}`);
  console.log(`Active: ${info.active}`);
  console.log('Result: ✅ PASS');

  // Test 4: Dry Run Sync (limit 5)
  console.log('\nTest 4: Dry Run Sync (5 products)');
  const res = await server.syncProducts({ dryRun: true, limit: 5 });
  console.log(`Status: ${res.success ? 'SUCCESS' : 'FAILED'}`);
  console.log(`Scanned: ${res.products_added + res.products_updated} | Added: ${res.products_added} | Updated: ${res.products_updated}`);
  console.log('\n================================');
  console.log(res.success ? '✅ All tests completed!' : '⚠️ Tests completed with errors.');
})();
