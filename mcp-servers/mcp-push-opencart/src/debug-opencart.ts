#!/usr/bin/env tsx
/**
 * Debug OpenCart Products Structure
 */

import { OpenCartPushServer } from './index';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env.local') });

async function debug() {
  console.log('🔍 Debugging OpenCart Products');
  console.log('================================\n');

  const server = new OpenCartPushServer();

  // Authenticate
  await server.testConnection();

  // Fetch products using direct access
  const ocProducts = await (server as any).fetchOpenCartProducts();

  console.log(`Total products fetched: ${ocProducts.length}\n`);

  if (ocProducts.length > 0) {
    console.log('First 3 products structure:');
    ocProducts.slice(0, 3).forEach((p: any, i: number) => {
      console.log(`\n${i + 1}. Product:`);
      console.log(`   product_id: ${p.product_id}`);
      console.log(`   name: ${p.name}`);
      console.log(`   model: ${p.model}`);
      console.log(`   sku: ${p.sku}`);
      console.log(`   price: ${p.price}`);
      console.log(`   quantity: ${p.quantity}`);
      console.log(`   manufacturer_id: ${p.manufacturer_id}`);
      console.log(`   Keys: ${Object.keys(p).join(', ')}`);
    });

    // Look for WiiM products
    console.log('\n🔍 Searching for WiiM products...');
    const wiimProducts = ocProducts.filter((p: any) => {
      const productName = p.product_description?.[0]?.name || '';
      return productName.toLowerCase().includes('wiim') ||
             p.model?.toLowerCase().includes('wiim');
    });

    console.log(`Found ${wiimProducts.length} WiiM products:`);
    wiimProducts.forEach((p: any) => {
      const productName = p.product_description?.[0]?.name || p.model;
      console.log(`   - ${productName} (ID: ${p.id}, Model: ${p.model}, SKU: ${p.sku})`);
    });

    // Show last 5 products (likely the most recently added)
    console.log('\n📅 Last 5 products added:');
    ocProducts.slice(-5).forEach((p: any) => {
      const productName = p.product_description?.[0]?.name || p.model;
      console.log(`   - ${productName} (ID: ${p.id})`);
    });
  }
}

debug().catch(console.error);
