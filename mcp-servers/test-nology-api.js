require('dotenv').config({ path: '.env' });
const axios = require('axios');

const config = {
  username: process.env.NOLOGY_API_USERNAME,
  secret: process.env.NOLOGY_API_SECRET,
  baseUrl: process.env.NOLOGY_API_BASE_URL
};

console.log('Testing Nology API Connection...');
console.log('Base URL:', config.baseUrl);
console.log('Username:', config.username);
console.log('');

async function testAPI() {
  try {
    // Test the products endpoint (using the correct Nology API format)
    const response = await axios.get(`${config.baseUrl}/Products/View`, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      data: {
        Username: config.username,
        Secret: config.secret,
        ImageData: false,
      },
      timeout: 30000,
    });

    console.log('✅ API Response received');
    console.log('Status:', response.status);
    console.log('Total products returned:', response.data.length);
    console.log('');

    // Show first 5 products as sample
    console.log('Sample products:');
    response.data.slice(0, 5).forEach((p, i) => {
      console.log(`  ${i+1}. ${p.ShortDescription || p.Model}`);
      console.log(`     SKU: ${p.GlobalSKU}, Stock: ${p.Stock}`);
    });

    console.log('');
    console.log('Last 5 products:');
    response.data.slice(-5).forEach((p, i) => {
      console.log(`  ${i+1}. ${p.ShortDescription || p.Model}`);
      console.log(`     SKU: ${p.GlobalSKU}, Stock: ${p.Stock}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testAPI();
