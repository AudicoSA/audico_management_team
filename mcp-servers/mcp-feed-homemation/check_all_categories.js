import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Get all Homemation products grouped by category
const { data: products } = await supabase
  .from('products')
  .select('category_name, product_name, brand')
  .eq('active', true)
  .ilike('brand', '%homemation%')
  .order('category_name', { ascending: true });

// Group by category
const byCategory = {};
products.forEach(p => {
  if (!byCategory[p.category_name]) {
    byCategory[p.category_name] = [];
  }
  byCategory[p.category_name].push(p);
});

console.log('Homemation products by category:\n');
Object.keys(byCategory).sort().forEach(cat => {
  console.log(`${cat}: ${byCategory[cat].length} products`);
});

console.log(`\nTotal: ${products.length} products`);

// Check for "Paradigm" in product names (speakers)
const paradigmProducts = products.filter(p =>
  p.product_name.toLowerCase().includes('paradigm')
);
console.log(`\nParadigm speakers: ${paradigmProducts.length} products`);
