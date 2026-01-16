// Check if Klipsch products exist and how they would appear in chat
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../../audico-chat-quote/.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function checkKlipsch() {
  try {
    console.log('🔍 Checking Klipsch products in database...\n');

    // Check total Klipsch products
    const { data: klipschProducts, error } = await supabase
      .from('products')
      .select('id, product_name, brand, sku, retail_price, total_stock, active, supplier_id')
      .ilike('brand', '%Klipsch%')
      .eq('active', true);

    if (error) throw error;

    console.log(`Found ${klipschProducts.length} Klipsch products in database\n`);

    if (klipschProducts.length > 0) {
      console.log('First 5 Klipsch products:');
      klipschProducts.slice(0, 5).forEach((p, i) => {
        console.log(`${i + 1}. ${p.product_name}`);
        console.log(`   SKU: ${p.sku} | Price: R${p.retail_price} | Stock: ${p.total_stock}`);
      });

      // Check which supplier
      const supplierIds = [...new Set(klipschProducts.map(p => p.supplier_id))];
      console.log(`\nSuppliers: ${supplierIds.length}`);

      for (const supplierId of supplierIds) {
        const { data: supplier } = await supabase
          .from('suppliers')
          .select('name')
          .eq('id', supplierId)
          .single();

        const count = klipschProducts.filter(p => p.supplier_id === supplierId).length;
        console.log(`  - ${supplier?.name || 'Unknown'}: ${count} products`);
      }
    }

    // Check Planet World supplier
    console.log('\n📦 Checking Planet World supplier...');
    const { data: pwSupplier } = await supabase
      .from('suppliers')
      .select('*')
      .ilike('name', '%Planet%')
      .single();

    if (pwSupplier) {
      console.log(`✅ Planet World supplier found: ${pwSupplier.name}`);
      console.log(`   ID: ${pwSupplier.id}`);
      console.log(`   Status: ${pwSupplier.status}`);
      console.log(`   Last sync: ${pwSupplier.last_sync || 'Never'}`);

      // Check products from Planet World
      const { data: pwProducts, count } = await supabase
        .from('products')
        .select('id', { count: 'exact' })
        .eq('supplier_id', pwSupplier.id)
        .eq('active', true);

      console.log(`   Products: ${count} total`);
    } else {
      console.log('❌ Planet World supplier not found in database');
      console.log('   Need to create supplier record first');
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkKlipsch();
