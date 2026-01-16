#!/usr/bin/env tsx
/**
 * Test Product Matching Logic
 */

import { OpenCartPushServer } from './index';
import { SupabaseService } from '@audico/shared';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env.local') });

async function testMatching() {
  console.log('🔍 Testing Product Matching');
  console.log('===========================\n');

  const server = new OpenCartPushServer();
  const supabase = new SupabaseService();

  // Authenticate
  await server.testConnection();

  // Fetch products
  const ocProducts = await (server as any).fetchOpenCartProducts();
  console.log(`Fetched ${ocProducts.length} OpenCart products\n`);

  // Get WiiM products from Supabase
  const { data: supabaseProducts } = await supabase.getClient()
    .from('products')
    .select('*')
    .eq('active', true)
    .ilike('product_name', '%WiiM%')
    .limit(5);

  console.log(`Found ${supabaseProducts?.length || 0} WiiM products in Supabase\n`);

  if (supabaseProducts && supabaseProducts.length > 0) {
    // Build normalized OpenCart cache
    const ocCache = new Map();
    ocProducts.forEach((ocp: any) => {
      const productDesc = ocp.product_description?.[0];
      ocCache.set(ocp.id, {
        product_id: ocp.id,
        name: productDesc?.name || ocp.model || 'Unknown',
        model: ocp.model,
        sku: ocp.sku,
      });
    });

    console.log('Testing matches for each Supabase product:\n');

    for (const sp of supabaseProducts) {
      console.log(`\n📦 Supabase: ${sp.product_name}`);
      console.log(`   SKU: "${sp.sku || 'NONE'}"`);
      console.log(`   Model: "${sp.model || 'NONE'}"`);
      console.log(`   Brand: "${sp.brand || 'NONE'}"`);

      // Check for SKU matches
      let skuMatches = Array.from(ocCache.values()).filter((oc: any) =>
        oc.sku && sp.sku && oc.sku.toLowerCase() === sp.sku.toLowerCase()
      );
      console.log(`   SKU matches: ${skuMatches.length}`);

      // Check for model matches
      let modelMatches = Array.from(ocCache.values()).filter((oc: any) =>
        oc.model && sp.model && oc.model.toLowerCase().includes(sp.model.toLowerCase())
      );
      console.log(`   Model matches: ${modelMatches.length}`);
      if (modelMatches.length > 0) {
        modelMatches.forEach((m: any) => console.log(`      - ${m.name} (Model: ${m.model})`));
      }

      // Check for name similarity
      let nameMatches = Array.from(ocCache.values()).filter((oc: any) => {
        const ocName = oc.name.toLowerCase();
        const spName = sp.product_name.toLowerCase();
        const spWords = spName.split(/[\s\-]/).filter((w: string) => w.length > 3);
        return spWords.some((word: string) => ocName.includes(word));
      });
      console.log(`   Name similarity matches: ${nameMatches.length}`);
      if (nameMatches.length > 0 && nameMatches.length < 10) {
        nameMatches.slice(0, 3).forEach((m: any) => console.log(`      - ${m.name}`));
      }
    }

    // Search for any "WiiM" in OpenCart
    console.log('\n\n🔍 Searching OpenCart for "WiiM" or "Rotel":');
    const wiimOrRotel = Array.from(ocCache.values()).filter((oc: any) => {
      const name = oc.name.toLowerCase();
      return name.includes('wiim') || name.includes('rotel');
    });
    console.log(`Found ${wiimOrRotel.length} products:`);
    wiimOrRotel.slice(0, 10).forEach((p: any) => {
      console.log(`   - ${p.name} (ID: ${p.product_id}, Model: ${p.model}, SKU: ${p.sku})`);
    });
  }
}

testMatching().catch(console.error);
