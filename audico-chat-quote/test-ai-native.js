/**
 * Test script for AI-Native endpoint
 * Verifies the endpoint works before user testing
 */

async function testAINative() {
  console.log('🧪 Testing AI-Native endpoint...\n');

  const testMessage = "I need sound for my 5.1.2 dolby cinema";

  try {
    console.log(`📤 Sending: "${testMessage}"`);

    const response = await fetch('http://localhost:3000/api/chat/ai-native', {
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

    console.log('\n✅ SUCCESS!');
    console.log(`📝 Message: ${data.message?.substring(0, 200)}...`);
    console.log(`🛍️  Products: ${data.products?.length || 0}`);
    console.log(`⏱️  Processing time: ${data.processingTime}ms`);

    if (data.products && data.products.length > 0) {
      console.log('\n📦 Sample products:');
      data.products.slice(0, 3).forEach((p, i) => {
        console.log(`  ${i + 1}. ${p.name} - R${p.price}`);
      });
    }

    console.log('\n🎉 AI-Native endpoint is working correctly!');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testAINative();
