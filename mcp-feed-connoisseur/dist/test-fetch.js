#!/usr/bin/env tsx
"use strict";
/**
 * Simple test to fetch Connoisseur products via Shopify JSON API
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const BASE_URL = 'https://www.connoisseur.co.za';
const API_ENDPOINT = '/collections/all/products.json';
const PAGE_LIMIT = 250;
async function fetchProducts() {
    console.log('🧪 Connoisseur Product Fetch Test');
    console.log('================================\n');
    let allProducts = [];
    let page = 1;
    let hasMore = true;
    const client = axios_1.default.create({
        timeout: 30000,
        headers: {
            'User-Agent': 'AudicoResearchBot/1.0 (+contact: hello@audico.co.za)',
            Accept: 'application/json',
        },
    });
    console.log(`📡 Fetching from: ${BASE_URL}${API_ENDPOINT}\n`);
    while (hasMore && page <= 10) {
        try {
            const url = `${BASE_URL}${API_ENDPOINT}?limit=${PAGE_LIMIT}&page=${page}`;
            console.log(`📄 Page ${page}...`);
            const response = await client.get(url);
            const products = response.data?.products || [];
            if (products.length === 0) {
                console.log(`   ✓ Page ${page}: No products (stopping)`);
                hasMore = false;
                break;
            }
            console.log(`   ✓ Page ${page}: ${products.length} products found`);
            for (const product of products) {
                if (!allProducts.some(p => p.id === product.id)) {
                    allProducts.push(product);
                }
            }
            if (products.length < PAGE_LIMIT) {
                console.log(`   ℹ️ Fewer than ${PAGE_LIMIT} products - likely last page`);
                hasMore = false;
            }
            page++;
            // Polite delay
            if (hasMore) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        catch (error) {
            console.error(`   ❌ Error on page ${page}:`, error.message);
            hasMore = false;
        }
    }
    console.log('\n================================');
    console.log('📊 RESULTS');
    console.log('================================');
    console.log(`Total Products: ${allProducts.length}`);
    console.log(`Pages Fetched: ${page - 1}`);
    if (allProducts.length > 0) {
        console.log('\n📦 Sample Products (first 5):');
        allProducts.slice(0, 5).forEach((p, i) => {
            const variant = p.variants[0];
            const price = parseFloat(variant.price);
            const cost = price * 0.8;
            console.log(`\n${i + 1}. ${p.title}`);
            console.log(`   SKU: ${variant.sku || 'N/A'}`);
            console.log(`   Brand: ${p.vendor}`);
            console.log(`   Retail Price: R ${price.toFixed(2)}`);
            console.log(`   Cost Price: R ${cost.toFixed(2)} (retail × 0.8)`);
            console.log(`   Available: ${variant.available ? 'Yes' : 'No'}`);
        });
    }
    console.log('\n✅ Fetch complete!');
}
fetchProducts().catch(error => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
});
//# sourceMappingURL=test-fetch.js.map