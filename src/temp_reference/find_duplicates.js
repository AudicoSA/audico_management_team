import { loadOpenCartCache } from './dist/excel-cache.js';

console.log('🔍 Finding duplicate products in OpenCart...\n');

const products = loadOpenCartCache();
console.log(`📊 Loaded ${products.size} products from cache\n`);

// Group by SKU/Model
const grouped = new Map();
for (const [id, product] of products.entries()) {
  const key = product.model || product.sku || product.name;
  if (!grouped.has(key)) {
    grouped.set(key, []);
  }
  grouped.get(key).push({ id, ...product });
}

// Find duplicates
const duplicates = [];
for (const [key, items] of grouped.entries()) {
  if (items.length > 1) {
    duplicates.push({ key, items });
  }
}

console.log(`🔍 Found ${duplicates.length} products with duplicates\n`);
console.log('='.repeat(80));

for (const { key, items } of duplicates) {
  console.log(`\n📦 SKU/Model: ${key} (${items.length} copies)`);
  items.forEach((item, i) => {
    console.log(`   ${i + 1}. ID: ${item.id} | Name: ${item.name} | Qty: ${item.quantity} | Price: R${item.price}`);
  });
}

console.log('\n' + '='.repeat(80));
console.log(`\n💡 To delete duplicates:`);
console.log(`   1. Go to OpenCart Admin → Catalog → Products`);
console.log(`   2. Search for the product name/SKU`);
console.log(`   3. Keep the first one (oldest ID), delete the rest\n`);
