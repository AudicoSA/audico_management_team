"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const client = axios_1.default.create({
    timeout: 30000,
    headers: {
        'User-Agent': 'AudicoResearchBot/1.0',
        Accept: 'application/json',
    },
});
async function checkDetailedProduct() {
    // Get first product
    const url = 'https://www.connoisseur.co.za/collections/all/products.json?limit=1';
    const response = await client.get(url);
    const product = response.data.products[0];
    console.log('📦 Detailed Product Data:\n');
    console.log('Product:', product.title);
    console.log('SKU:', product.variants[0].sku);
    console.log('\n=== All Variant Fields ===');
    console.log(JSON.stringify(product.variants[0], null, 2));
    console.log('\n=== All Product Fields ===');
    console.log('Tags:', product.tags);
    console.log('Body HTML length:', product.body_html?.length || 0);
    // Check if body_html contains stock info
    if (product.body_html && product.body_html.includes('stock')) {
        console.log('\n⚠️ Found "stock" in body_html:');
        const stockMatch = product.body_html.match(/stock[^<>]*?(\d+)/i);
        if (stockMatch) {
            console.log('Stock number found:', stockMatch[1]);
        }
    }
    // Try to fetch individual product page JSON
    console.log('\n=== Trying Individual Product JSON ===');
    try {
        const productUrl = `https://www.connoisseur.co.za/products/${product.handle}.json`;
        console.log('URL:', productUrl);
        const productResponse = await client.get(productUrl);
        console.log('\nVariant inventory_quantity:', productResponse.data.product.variants[0].inventory_quantity);
        console.log('Variant inventory_management:', productResponse.data.product.variants[0].inventory_management);
        console.log('\nAll variant fields:');
        console.log(JSON.stringify(productResponse.data.product.variants[0], null, 2));
    }
    catch (error) {
        console.log('Error fetching individual product:', error.message);
    }
}
checkDetailedProduct();
//# sourceMappingURL=check-detailed-product.js.map