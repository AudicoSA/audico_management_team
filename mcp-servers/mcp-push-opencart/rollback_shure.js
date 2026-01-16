/**
 * Rollback script to delete the last batch of Shure products pushed to OpenCart
 */

const axios = require('axios');
require('dotenv').config({ path: '../.env.local' });

const OPENCART_BASE_URL = 'https://www.audicoonline.co.za';
const OPENCART_CLIENT_ID = process.env.OPENCART_CLIENT_ID || 'demo_oauth_client';
const OPENCART_CLIENT_SECRET = process.env.OPENCART_CLIENT_SECRET || 'demo_oauth_secret';
const OPENCART_ADMIN_USERNAME = process.env.OPENCART_ADMIN_USERNAME || 'admin';
const OPENCART_ADMIN_PASSWORD = process.env.OPENCART_ADMIN_PASSWORD;

// SKUs of products we just pushed (from the push log)
const PUSHED_SKUS = [
  'WH20QTR', 'VP89M', 'UA860SWB', 'UA825-RSMA', 'UA8100-RSMA',
  'UA506', 'UA440', 'TL45B/O-LEMO', 'SLXD5-G59', 'SE535LTD-EFS',
  'SBC10-903-E', 'RPW124', 'RPW114', 'RPM40TC/W', 'RPM40TC/T',
  'RPM40STC/W', 'RPM40STC/T', 'RPM40STC/B', 'RPM266', 'RK374',
  'RFV-CPB', 'P9TE-G7E', 'MXCWAPT-W', 'MXA310AL', 'MX392BE/C',
  'MX202W-A/C', 'MX184', 'IMX-RM8-SUB3', 'HPAEC840', 'DH5B/O-MTQG',
  'CVG12S-B/C-X', 'BETA 57A-X', 'BETA 52A-X', 'ADX5BP-DB25', 'ADX2/K8B-G56',
  'ADX1LEMO3-G56', 'ADTDE-G56', 'AD3-G56', 'AD2/K8B-G56', 'AD1-G56',
  'A98D', 'A89U', 'A58WS-RED', 'A53M', 'A412B', 'A310B-FM', 'A26X'
];

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

async function findProductBySku(bearer, sku) {
  // OpenCart REST API doesn't have SKU search, so we need to fetch and filter
  const url = `${OPENCART_BASE_URL}/index.php?route=rest/product_admin/products&limit=1000`;

  const response = await axios.get(url, {
    headers: { Authorization: `Bearer ${bearer}` },
    validateStatus: () => true,
  });

  if (response.status !== 200 || !response.data?.success) {
    return null;
  }

  const products = response.data.data || [];
  const product = products.find(p => p.sku === sku);

  return product ? product.product_id : null;
}

async function deleteProduct(bearer, productId) {
  const url = `${OPENCART_BASE_URL}/index.php?route=rest/product_admin/products&id=${productId}`;

  const response = await axios.delete(url, {
    headers: { Authorization: `Bearer ${bearer}` },
    validateStatus: () => true,
  });

  return response.status === 200 && response.data?.success;
}

async function main() {
  console.log('🔄 Starting Shure Products Rollback...\n');

  try {
    // Authenticate
    console.log('🔐 Authenticating with OpenCart...');
    const bearer = await getBearerToken();
    await adminLogin(bearer);
    console.log('✅ Authentication successful\n');

    console.log(`📦 Looking for ${PUSHED_SKUS.length} products to delete...\n`);

    let deleted = 0;
    let notFound = 0;
    let failed = 0;

    for (let i = 0; i < PUSHED_SKUS.length; i++) {
      const sku = PUSHED_SKUS[i];
      process.stdout.write(`[${i + 1}/${PUSHED_SKUS.length}] ${sku.padEnd(20)} `);

      try {
        // Find product ID by SKU
        const productId = await findProductBySku(bearer, sku);

        if (!productId) {
          console.log('⏭️  Not found');
          notFound++;
          continue;
        }

        // Delete the product
        const success = await deleteProduct(bearer, productId);

        if (success) {
          console.log(`✅ Deleted (ID: ${productId})`);
          deleted++;
        } else {
          console.log(`❌ Delete failed (ID: ${productId})`);
          failed++;
        }

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (error) {
        console.log(`❌ Error: ${error.message}`);
        failed++;
      }
    }

    console.log('\n================================');
    console.log('📊 ROLLBACK SUMMARY');
    console.log('================================');
    console.log(`✅ Deleted:   ${deleted}`);
    console.log(`⏭️  Not found: ${notFound}`);
    console.log(`❌ Failed:    ${failed}`);
    console.log('================================\n');

    if (deleted > 0) {
      console.log('✅ Rollback completed successfully!');
    } else {
      console.log('⚠️  No products were deleted.');
    }

  } catch (error) {
    console.error('\n❌ Rollback failed:', error.message);
    process.exit(1);
  }
}

main();
