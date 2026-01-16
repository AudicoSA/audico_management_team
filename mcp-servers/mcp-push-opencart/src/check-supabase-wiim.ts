#!/usr/bin/env tsx
/**
 * Check Supabase WiiM product data
 */

import { SupabaseService } from '@audico/shared';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env.local') });

async function checkWiiM() {
  const supabase = new SupabaseService();

  const { data, error } = await supabase
    .getClient()
    .from('products')
    .select('*')
    .eq('active', true)
    .ilike('product_name', '%WiiM%')
    .limit(5);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`\nFound ${data?.length || 0} WiiM products:\n`);
  data?.forEach((p: any) => {
    console.log(`Product: ${p.product_name}`);
    console.log(`  Brand: "${p.brand}"`);
    console.log(`  Model: "${p.model}"`);
    console.log(`  SKU: "${p.sku || 'none'}"`);
    console.log('');
  });
}

checkWiiM().catch(console.error);
