#!/usr/bin/env tsx
/**
 * Find WiiM products in Excel cache
 */

import { loadOpenCartCache } from './load-excel-cache';

const cache = loadOpenCartCache();
const wiim = Array.from(cache.values()).filter(p =>
  p.name.toLowerCase().includes('wiim')
);

console.log(`\nFound ${wiim.length} WiiM products:\n`);
wiim.forEach(p => {
  console.log(`  - ${p.name}`);
  console.log(`    ID: ${p.product_id}, SKU: ${p.sku || 'none'}, Model: ${p.model || 'none'}`);
  console.log('');
});
