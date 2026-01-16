#!/usr/bin/env tsx
/**
 * Load OpenCart products from Excel file for fast matching
 */

import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

const EXCEL_PATH = path.join(__dirname, '../../../products-2025-10-04.xlsx');
const CACHE_PATH = path.join(__dirname, '../opencart-products-cache.json');

export interface OpenCartCachedProduct {
  product_id: string;
  name: string;
  model: string;
  sku: string;
  price: number;
  quantity: number;
}

export function loadOpenCartCache(): Map<string, OpenCartCachedProduct> {
  // Try to load from cache file first
  if (fs.existsSync(CACHE_PATH)) {
    console.log('📂 Loading from cache file...');
    const data = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf-8'));
    const cache = new Map<string, OpenCartCachedProduct>();
    data.forEach((p: OpenCartCachedProduct) => cache.set(p.product_id, p));
    console.log(`✅ Loaded ${cache.size} products from cache`);
    return cache;
  }

  // Check if Excel file exists
  if (!fs.existsSync(EXCEL_PATH)) {
    console.log('⚠️ No Excel cache file found - will use direct API matching');
    return new Map<string, OpenCartCachedProduct>();
  }

  console.log('📊 Parsing Excel file (first time)...');
  const workbook = XLSX.readFile(EXCEL_PATH);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

  const headers = rows[0];
  const products: OpenCartCachedProduct[] = [];

  // Show all headers for debugging
  console.log('📋 Excel Headers:', headers.slice(0, 20));

  // Find column indices (flexible matching)
  const idIdx = headers.findIndex((h: string) => h && h.toString().toLowerCase().includes('id'));
  const nameIdx = headers.findIndex((h: string) => h && h.toString().toLowerCase().includes('name'));
  const modelIdx = headers.findIndex((h: string) => h && h.toString().toLowerCase().includes('model'));
  const skuIdx = headers.findIndex((h: string) => h && (h.toString().toLowerCase().includes('sku') || h.toString().toLowerCase() === 'model'));
  const priceIdx = headers.findIndex((h: string) => h && h.toString().toLowerCase().includes('price'));
  const qtyIdx = headers.findIndex((h: string) => h && (h.toString().toLowerCase().includes('quantity') || h.toString().toLowerCase().includes('qty')));

  console.log(`Detected columns: ID=${idIdx}, Name=${nameIdx}, Model=${modelIdx}, SKU=${skuIdx}, Price=${priceIdx}, Qty=${qtyIdx}`);

  // Parse rows
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const product: OpenCartCachedProduct = {
      product_id: String(row[idIdx] || ''),
      name: String(row[nameIdx] || row[modelIdx] || ''),
      model: String(row[modelIdx] || ''),
      sku: String(row[skuIdx] || ''),
      price: parseFloat(row[priceIdx]) || 0,
      quantity: parseInt(row[qtyIdx]) || 0,
    };

    if (product.product_id && product.product_id !== 'undefined') {
      products.push(product);
    }
  }

  console.log(`✅ Parsed ${products.length} products from Excel`);

  // Save to cache
  fs.writeFileSync(CACHE_PATH, JSON.stringify(products, null, 2));
  console.log(`💾 Saved cache to: ${CACHE_PATH}`);

  const cache = new Map<string, OpenCartCachedProduct>();
  products.forEach(p => cache.set(p.product_id, p));

  return cache;
}

// Run directly if called
if (require.main === module) {
  const cache = loadOpenCartCache();
  console.log(`\n📊 Cache Statistics:`);
  console.log(`   Total products: ${cache.size}`);
  console.log(`   Products with SKU: ${Array.from(cache.values()).filter(p => p.sku).length}`);
  console.log(`   Products with stock: ${Array.from(cache.values()).filter(p => p.quantity > 0).length}`);

  // Show sample
  console.log(`\n📦 Sample products:`);
  Array.from(cache.values()).slice(0, 5).forEach(p => {
    console.log(`   - ${p.name} (ID: ${p.product_id}, SKU: ${p.sku})`);
  });
}
