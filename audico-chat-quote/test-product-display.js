/**
 * Test if AI is using provide_final_recommendation to show products
 */

async function testProductDisplay() {
  console.log('🧪 Testing Product Display...\n');

  const tests = [
    {
      name: 'Simple product request',
      message: 'Show me floorstanding speakers for home',
      expectProducts: true,
    },
    {
      name: 'AVR search',
      message: 'I need an AVR for home cinema, budget R30k',
      expectProducts: true,
    },
  ];

  for (const test of tests) {
    console.log(`\n📋 ${test.name}`);
    console.log(`   Query: "${test.message}"`);

    try {
      const response = await fetch('http://localhost:3000/api/chat/ai-native', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: test.message,
          sessionId: `test-${Date.now()}`,
        }),
      });

      const data = await response.json();

      const productCount = data.products?.length || 0;
      console.log(`   Products returned: ${productCount}`);
      console.log(`   Message preview: ${data.message?.substring(0, 100)}...`);

      if (test.expectProducts && productCount === 0) {
        console.log(`   ❌ FAIL: Expected products but got 0`);
      } else if (test.expectProducts && productCount > 0) {
        console.log(`   ✅ PASS: Got ${productCount} products`);
        data.products.forEach((p, i) => {
          console.log(`      ${i + 1}. ${p.name} - R${p.price.toLocaleString()}`);
        });
      }

    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
  }
}

testProductDisplay();
