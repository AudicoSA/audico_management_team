require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function checkWiiM() {
  const { data, error } = await supabase
    .from('products')
    .select('product_name, brand, sku')
    .ilike('product_name', '%WiiM%')
    .limit(5);

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('WiiM Products in Supabase:');
    console.log(JSON.stringify(data, null, 2));
  }
}

checkWiiM();
