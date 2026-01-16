// Push all Planet World products to OpenCart
require('dotenv').config({ path: '../.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function getAllBrands() {
  console.log('🔍 Finding all Planet World brands...\n');

  // Get Planet World supplier ID
  const { data: supplier } = await supabase
    .from('suppliers')
    .select('id')
    .eq('name', 'Planet World')
    .single();

  if (!supplier) {
    console.error('❌ Planet World supplier not found');
    return;
  }

  console.log('✅ Planet World supplier ID:', supplier.id);

  // Get all brands from Planet World products
  const { data: products } = await supabase
    .from('products')
    .select('brand')
    .eq('supplier_id', supplier.id)
    .gt('total_stock', 0);

  if (!products) {
    console.error('❌ No products found');
    return;
  }

  // Get unique brands
  const brands = [...new Set(products.map(p => p.brand).filter(b => b))];

  console.log(`\n✅ Found ${products.length} products across ${brands.length} brands:\n`);

  brands.sort().forEach((brand, i) => {
    const count = products.filter(p => p.brand === brand).length;
    console.log(`${i + 1}. ${brand.padEnd(20)} - ${count} products`);
  });

  console.log('\n' + '='.repeat(80));
  console.log('📦 PUSH COMMANDS:');
  console.log('='.repeat(80));
  console.log('\nPush all brands (run this):');
  console.log('cd D:\\AudicoAI\\audico_quotes_modern\\audico-mcp-servers\\mcp-push-opencart');

  brands.forEach(brand => {
    const count = products.filter(p => p.brand === brand).length;
    console.log(`npm run push -- --brand="${brand}" --limit=${count}`);
  });

  console.log('\nOr push all in one go (slower):');
  console.log(`npm run push -- --limit=${products.length}`);
}

getAllBrands();
