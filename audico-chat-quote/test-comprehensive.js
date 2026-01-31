/**
 * Comprehensive test suite for AI-Native endpoint
 */

async function runTests() {
  console.log('🧪 Running Comprehensive Test Suite\n');
  console.log('=' .repeat(80) + '\n');

  const tests = [
    {
      name: 'Test 1: Multi-room Request',
      message: 'I need sound for 5.1 cinema, kitchen ceiling speakers, and bar wall mount',
      expectations: [
        'Should acknowledge all 3 rooms',
        'Should NOT show car audio',
        'Should ask clarifying questions'
      ]
    },
    {
      name: 'Test 2: Simple Floorstanding Request',
      message: 'Show me floorstanding speakers for home',
      expectations: [
        'Should return products',
        'Should NOT include Focal car audio',
        'Should NOT include Hertz'
      ]
    },
    {
      name: 'Test 3: Context Retention',
      sessionId: 'context-test',
      messages: [
        'I need a 5.1 home cinema system',
        'Show me the floor speakers'
      ],
      expectations: [
        'Second message should remember cinema context',
        'Should show passive speakers suitable for AVR'
      ]
    }
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    console.log(`\n📋 ${test.name}`);
    console.log('-'.repeat(80));

    try {
      const sessionId = test.sessionId || `test-${Date.now()}`;

      if (test.messages) {
        // Multi-message test
        for (let i = 0; i < test.messages.length; i++) {
          const msg = test.messages[i];
          console.log(`\n  Message ${i + 1}: "${msg}"`);

          const response = await fetch('http://localhost:3000/api/chat/ai-native', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: msg, sessionId })
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          const data = await response.json();
          console.log(`  ✓ Response: ${data.message?.substring(0, 150)}...`);
          console.log(`  ✓ Products: ${data.products?.length || 0}`);

          // Check for car audio
          if (data.products && data.products.length > 0) {
            const carAudio = data.products.filter(p => {
              const name = p.name.toLowerCase();
              return ['focal', 'hertz', 'coaxial', '6x9'].some(k => name.includes(k));
            });

            if (carAudio.length > 0) {
              console.log(`  ❌ FAIL: Found ${carAudio.length} car audio products`);
              carAudio.forEach(p => console.log(`      - ${p.name}`));
              failed++;
            } else {
              console.log(`  ✓ No car audio found`);
            }
          }
        }
        passed++;
      } else {
        // Single message test
        console.log(`  Message: "${test.message}"`);

        const response = await fetch('http://localhost:3000/api/chat/ai-native', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: test.message, sessionId })
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        const msg = data.message || '';

        console.log(`  ✓ Response length: ${msg.length} chars`);
        console.log(`  ✓ Products: ${data.products?.length || 0}`);
        console.log(`  ✓ Preview: ${msg.substring(0, 200)}...`);

        // Check expectations
        let testPassed = true;

        if (test.expectations.includes('Should acknowledge all 3 rooms')) {
          const mentions = ['cinema', 'kitchen', 'bar'].filter(room =>
            msg.toLowerCase().includes(room)
          );
          if (mentions.length >= 2) {
            console.log(`  ✓ Mentions ${mentions.length}/3 rooms: ${mentions.join(', ')}`);
          } else {
            console.log(`  ⚠️  Only mentions ${mentions.length}/3 rooms`);
          }
        }

        // Check for car audio
        if (data.products && data.products.length > 0) {
          const carAudio = data.products.filter(p => {
            const name = p.name.toLowerCase();
            return ['focal', 'hertz', 'coaxial', '6x9', 'car'].some(k => name.includes(k));
          });

          if (carAudio.length > 0) {
            console.log(`  ❌ FAIL: Found ${carAudio.length} car audio products`);
            carAudio.forEach(p => console.log(`      - ${p.name}`));
            testPassed = false;
            failed++;
          } else {
            console.log(`  ✓ No car audio found`);
          }
        }

        if (testPassed) passed++;
      }

      console.log(`  ✅ Test completed`);

    } catch (error) {
      console.log(`  ❌ Test failed: ${error.message}`);
      failed++;
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed\n`);

  if (failed === 0) {
    console.log('🎉 All tests passed! AI-Native system is ready!\n');
    process.exit(0);
  } else {
    console.log('⚠️  Some tests failed. Review above for details.\n');
    process.exit(1);
  }
}

runTests();
