/**
 * Check products in LiveFeed category (967)
 */

const axios = require('axios');
require('dotenv').config({ path: '../../../.env' });
// Also try local .env just in case
require('dotenv').config({ path: '../../.env' });

const OPENCART_BASE_URL = 'https://www.audicoonline.co.za';
const OPENCART_CLIENT_ID = process.env.OPENCART_CLIENT_ID || 'demo_oauth_client';
const OPENCART_CLIENT_SECRET = process.env.OPENCART_CLIENT_SECRET || 'demo_oauth_secret';
const OPENCART_ADMIN_USERNAME = process.env.OPENCART_ADMIN_USERNAME || 'admin';
const OPENCART_ADMIN_PASSWORD = process.env.OPENCART_ADMIN_PASSWORD;

console.log('Debug Env:', {
  path_1: '../../../.env',
  username: OPENCART_ADMIN_USERNAME,
  password_len: OPENCART_ADMIN_PASSWORD ? OPENCART_ADMIN_PASSWORD.length : 0
});

async function getBearerToken() {
  const basic = Buffer.from(`${OPENCART_CLIENT_ID}:${OPENCART_CLIENT_SECRET}`).toString('base64');
  const url = `${OPENCART_BASE_URL}/index.php?route=rest/admin_security/gettoken&grant_type=client_credentials`;

  const response = await axios.post(url, null, {
    headers: { Authorization: `Basic ${basic}` },
    validateStatus: () => true,
  });

  if (response.status !== 200) {
    throw new Error(`Token failed (${response.status}): ${JSON.stringify(response.data)}`);
  }

  const token = response.data?.data?.access_token || response.data?.access_token;
  if (!token) throw new Error('Missing access_token in response');

  return token;
}

async function adminLogin(bearer) {
  const url = `${OPENCART_BASE_URL}/index.php?route=rest/admin_security/login`;

  const response = await axios.post(
    url,
    { username: OPENCART_ADMIN_USERNAME, password: OPENCART_ADMIN_PASSWORD },
    {
      headers: { Authorization: `Bearer ${bearer}` },
      validateStatus: () => true,
    }
  );

  if (response.status !== 200 || !response.data?.success) {
    throw new Error(`Admin login failed (${response.status}): ${JSON.stringify(response.data)}`);
  }
}

async function fetchProducts(bearer, page = 1, limit = 100) {
  const start = (page - 1) * limit;
  const url = `${OPENCART_BASE_URL}/index.php?route=rest/product_admin/products&start=${start}&limit=${limit}`;

  const response = await axios.get(url, {
    headers: { Authorization: `Bearer ${bearer}` },
    validateStatus: () => true,
  });

  if (response.status !== 200 || !response.data?.success) {
    return [];
  }

  return response.data.data || [];
}

async function main() {
  console.log('🔍 Checking LiveFeed Category Products...\n');

  try {
    // Authenticate
    console.log('🔐 Authenticating...');
    const bearer = await getBearerToken();
    await adminLogin(bearer);
    console.log('✅ Authenticated\n');

    // Fetch first page of products
    console.log('📦 Fetching recent products...');
    const products = await fetchProducts(bearer, 1, 100);

    console.log(`✅ Found ${products.length} products\n`);

    // Filter for recent products (last 30 minutes)
    const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000);
    const recentProducts = products.filter(p => {
      const dateAdded = new Date(p.date_added || 0);
      return dateAdded > thirtyMinsAgo;
    });

    console.log(`🆕 Recent products (last 30 min): ${recentProducts.length}\n`);

    if (recentProducts.length > 0) {
      console.log('Recent products:');
      recentProducts.forEach((p, i) => {
        console.log(`${i + 1}. ID: ${p.product_id} | SKU: ${p.sku} | Name: ${p.name}`);
        console.log(`   Qty: ${p.quantity || 'N/A'} | Price: R${p.price || 'N/A'} | Added: ${p.date_added}`);
        console.log('');
      });
    }

    // Check for Shure products by SKU pattern
    const shureProducts = products.filter(p => {
      const sku = (p.sku || '').toUpperCase();
      return sku.match(/^(WH|VP|UA|TL|SL|SE|SBC|RPW|RPM|RK|RFV|P9|MXC|MXA|MX|IMX|HP|DH|CVG|BETA|AMVL|ADX|ADTD|AD\d|A\d)/);
    });

    console.log(`🎤 Shure-pattern products found: ${shureProducts.length}\n`);

    if (shureProducts.length > 0) {
      console.log('Shure products (to delete):');
      shureProducts.forEach((p, i) => {
        const name = (p.name || 'N/A').substring(0, 60);
        console.log(`${i + 1}. ID: ${p.product_id} | SKU: ${p.sku} | ${name}`);
      });
    }

  } catch (error) {
    console.error('\n❌ Failed:', error.message);
    process.exit(1);
  }
}

main();
