import 'dotenv/config';
import axios from 'axios';

const OPENCART_BASE_URL = process.env.OPENCART_BASE_URL || 'https://www.audicoonline.co.za';
const OPENCART_ADMIN_USER = process.env.OPENCART_ADMIN_USER;
const OPENCART_ADMIN_PASS = process.env.OPENCART_ADMIN_PASS;
const BEARER_TOKEN = process.env.OPENCART_BEARER_TOKEN;

// Axios instance with bearer token
const api = axios.create({
  baseURL: `${OPENCART_BASE_URL}/index.php?route=api`,
  headers: {
    'Authorization': `Bearer ${BEARER_TOKEN}`,
    'Content-Type': 'application/json'
  }
});

async function loginAdmin() {
  console.log('🔐 Logging in as admin...');
  const response = await api.post('/sale/customer/login', {
    username: OPENCART_ADMIN_USER,
    password: OPENCART_ADMIN_PASS
  });

  if (response.data.api_token) {
    console.log('✅ Admin login successful');
    return response.data.api_token;
  }
  throw new Error('Admin login failed');
}

async function getAllProducts() {
  console.log('📦 Fetching all products from OpenCart...');
  const response = await api.get('/catalog/product', {
    params: { limit: 10000 }
  });
  return response.data.products || [];
}

async function deleteProduct(productId) {
  console.log(`🗑️  Deleting product ID: ${productId}`);
  await api.delete(`/catalog/product/${productId}`);
}

async function findAndDeleteDuplicates() {
  try {
    // Login first
    await loginAdmin();

    // Get all products
    const products = await getAllProducts();
    console.log(`📊 Found ${products.length} total products`);

    // Group by model (SKU)
    const grouped = {};
    for (const product of products) {
      const model = product.model || '';
      if (!grouped[model]) {
        grouped[model] = [];
      }
      grouped[model].push(product);
    }

    // Find duplicates (keep first, delete rest)
    let duplicatesFound = 0;
    let duplicatesDeleted = 0;

    for (const [model, items] of Object.entries(grouped)) {
      if (items.length > 1) {
        duplicatesFound += items.length - 1;
        console.log(`\n🔍 Found ${items.length} copies of "${model}"`);

        // Sort by product_id (keep oldest)
        items.sort((a, b) => a.product_id - b.product_id);

        console.log(`   ✅ Keeping: ${items[0].name} (ID: ${items[0].product_id})`);

        // Delete duplicates (skip first)
        for (let i = 1; i < items.length; i++) {
          console.log(`   ❌ Deleting: ${items[i].name} (ID: ${items[i].product_id})`);
          try {
            await deleteProduct(items[i].product_id);
            duplicatesDeleted++;
          } catch (error) {
            console.error(`   ⚠️  Failed to delete ID ${items[i].product_id}: ${error.message}`);
          }
        }
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log(`✅ Summary:`);
    console.log(`   Total products: ${products.length}`);
    console.log(`   Duplicates found: ${duplicatesFound}`);
    console.log(`   Duplicates deleted: ${duplicatesDeleted}`);
    console.log('='.repeat(50));

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
    process.exit(1);
  }
}

findAndDeleteDuplicates();
