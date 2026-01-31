/**
 * Test script for old endpoint with new filtering
 */

async function testOldEndpoint() {
  console.log('🧪 Testing /api/chat endpoint (with filtering improvements)...\n');

  const testMessage = "Show me floorstanding speakers for home cinema";

  try {
    console.log(`📤 Sending: "${testMessage}"`);

    const response = await fetch('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: testMessage,
        sessionId: 'test-' + Date.now()
      })
    });

    console.log(`📊 Status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Error response:', errorText);
      process.exit(1);
    }

    const data = await response.json();

    console.log('\n✅ RESPONSE RECEIVED');
    console.log(`📝 Message length: ${data.message?.length || 0} chars`);
    console.log(`🛍️  Products: ${data.products?.length || 0}`);

    if (data.products && data.products.length > 0) {
      console.log('\n📦 Products returned:');
      data.products.forEach((p, i) => {
        const carIndicators = ['focal', 'hertz', 'coaxial', '6x9', 'car'].filter(keyword =>
          p.name.toLowerCase().includes(keyword)
        );
        const indicator = carIndicators.length > 0 ? `⚠️  (CAR AUDIO: ${carIndicators.join(', ')})` : '✅';
        console.log(`  ${i + 1}. ${indicator} ${p.name} - R${p.price}`);
      });

      const carAudioCount = data.products.filter(p => {
        const name = p.name.toLowerCase();
        return ['focal', 'hertz', 'coaxial', '6x9', 'car'].some(k => name.includes(k));
      }).length;

      if (carAudioCount > 0) {
        console.log(`\n❌ FAIL: ${carAudioCount} car audio products found (should be 0)`);
        process.exit(1);
      } else {
        console.log('\n✅ SUCCESS: No car audio products found!');
      }
    }

    console.log('\n🎉 Endpoint working with filtering!');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

testOldEndpoint();
