// Push only the 852 Planet World PRO products (from SOH + Pricelist import)
// These are the ones that have correct stock levels and came from the fixed import

require('dotenv').config({ path: '../.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function getProProducts() {
  console.log('🔍 Finding Planet World PRO products (852 from import)...\n');

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

  // Get products that have needs_embedding = true (these are from the recent import)
  const { data: products } = await supabase
    .from('products')
    .select('brand')
    .eq('supplier_id', supplier.id)
    .eq('needs_embedding', true)
    .gt('total_stock', 0);

  if (!products) {
    console.error('❌ No products found');
    return;
  }

  // Get unique brands
  const brands = [...new Set(products.map(p => p.brand).filter(b => b))];

  console.log(`✅ Found ${products.length} Planet World PRO products across ${brands.length} brands:\n`);

  brands.sort().forEach((brand, i) => {
    const count = products.filter(p => p.brand === brand).length;
    console.log(`${i + 1}. ${brand.padEnd(20)} - ${count} products`);
  });

  console.log('\n' + '='.repeat(80));
  console.log('🚀 PUSH COMMAND:');
  console.log('='.repeat(80));
  console.log('\nPush all Planet World PRO products:');
  console.log('cd D:\\AudicoAI\\audico_quotes_modern\\audico-mcp-servers\\mcp-push-opencart');

  brands.forEach(brand => {
    const count = products.filter(p => p.brand === brand).length;
    console.log(`npm run push -- --brand="${brand}" --limit=${count + 50}`);
  });
}

getProProducts();
