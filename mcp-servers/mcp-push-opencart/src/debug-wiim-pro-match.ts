#!/usr/bin/env tsx
/**
 * Debug why "WiiM Pro - Streaming Pre-Amplifier" isn't matching
 */

import { loadOpenCartCache } from './load-excel-cache';

const cache = loadOpenCartCache();

// Supabase product
const sbName = 'wiim pro streamer';
const sbWords = sbName.split(/[\s\-]/).filter((w: string) => w.length > 3);
console.log(`\nSupabase: "${sbName}"`);
console.log(`Filter words (>3 chars): [${sbWords.join(', ')}]`);

// Find all candidates (using same logic as matching)
const candidates = Array.from(cache.values()).filter((ocp) => {
  const ocName = ocp.name.toLowerCase();
  return sbWords.some((word: string) => ocName.includes(word));
});

console.log(`\nFound ${candidates.length} candidates\n`);

// Check if "WiiM Pro - Streaming Pre-Amplifier" is in candidates
const wiimProExact = candidates.find(c =>
  c.name.toLowerCase().includes('wiim pro -') &&
  c.name.toLowerCase().includes('streaming pre-amplifier')
);

if (wiimProExact) {
  console.log(`✅ FOUND: "${wiimProExact.name}" (ID: ${wiimProExact.product_id})`);
} else {
  console.log(`❌ NOT FOUND in candidates`);

  // Check if it exists in full cache
  const wiimProInCache = Array.from(cache.values()).find(c =>
    c.name.toLowerCase() === 'wiim pro - streaming pre-amplifier'
  );

  if (wiimProInCache) {
    console.log(`⚠️  But it EXISTS in cache: "${wiimProInCache.name}"`);
    console.log(`   Checking filter words:`);
    const ocName = wiimProInCache.name.toLowerCase();
    sbWords.forEach(word => {
      const matches = ocName.includes(word);
      console.log(`     - "${word}": ${matches ? '✅' : '❌'} included`);
    });
  }
}

// Show all WiiM Pro products
console.log(`\n📦 All WiiM Pro products in cache:`);
Array.from(cache.values())
  .filter(p => p.name.toLowerCase().match(/^wiim pro\b/i))
  .forEach(p => console.log(`  - ${p.name} (ID: ${p.product_id})`));
