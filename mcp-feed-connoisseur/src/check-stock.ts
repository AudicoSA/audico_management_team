import axios from 'axios';

const client = axios.create({
  timeout: 30000,
  headers: {
    'User-Agent': 'AudicoResearchBot/1.0',
    Accept: 'application/json',
  },
});

async function checkStock() {
  const url = 'https://www.connoisseur.co.za/collections/all/products.json?limit=5';
  const response = await client.get(url);
  const products = response.data.products;

  console.log('📦 Stock Information for First 5 Products:\n');

  products.forEach((p: any, i: number) => {
    const v = p.variants[0];
    console.log(`${i + 1}. ${p.title}`);
    console.log(`   SKU: ${v.sku}`);
    console.log(`   Price: R ${v.price}`);
    console.log(`   Available: ${v.available}`);
    console.log(`   Inventory Quantity: ${v.inventory_quantity}`);
    console.log(`   Inventory Management: ${v.inventory_management || 'None'}`);
    console.log(`   Inventory Policy: ${v.inventory_policy}`);
    console.log();
  });
}

checkStock();
