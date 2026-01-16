import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Check total Homemation products
const { data: all, count: totalCount } = await supabase
  .from('products')
  .select('*', { count: 'exact', head: false })
  .eq('active', true)
  .ilike('brand', '%homemation%');

console.log(`Total Homemation products: ${totalCount}`);

// Check speakers category
const { data: speakers, count: speakerCount } = await supabase
  .from('products')
  .select('*', { count: 'exact', head: false })
  .eq('active', true)
  .eq('category_name', 'speakers-for-sale-in-johannesburg');

console.log(`Speakers in speakers-for-sale-in-johannesburg: ${speakerCount}`);

// Show some speaker names
console.log('\nFirst 10 speakers:');
speakers.slice(0, 10).forEach(s => {
  console.log(`  - ${s.product_name} (R${s.selling_price})`);
});
