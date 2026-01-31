/**
 * Test different Claude model IDs to find one that works
 */

require('dotenv').config({ path: '.env.local' });
const Anthropic = require('@anthropic-ai/sdk');

async function testModels() {
  console.log('🔍 Testing Claude model IDs...\n');

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('❌ ANTHROPIC_API_KEY not set');
    process.exit(1);
  }

  const anthropic = new Anthropic({ apiKey });

  // List of potential model IDs to try
  const modelsToTry = [
    'claude-3-5-sonnet-20241022',
    'claude-3-5-sonnet-20240620',
    'claude-3-sonnet-20240229',
    'claude-3-opus-20240229',
    'claude-3-haiku-20240307',
    'claude-sonnet-4-20250514',
    'claude-3-5-sonnet-latest',
    'claude-3-sonnet-latest',
  ];

  for (const model of modelsToTry) {
    try {
      console.log(`Testing: ${model}...`);

      const response = await anthropic.messages.create({
        model: model,
        max_tokens: 100,
        messages: [{ role: 'user', content: 'Say "test successful"' }]
      });

      if (response.content && response.content.length > 0) {
        console.log(`✅ SUCCESS! Model "${model}" works!`);
        console.log(`   Response: ${response.content[0].text}\n`);

        console.log(`\n🎉 Use this model ID in claude-handler.ts:`);
        console.log(`   model: "${model}"`);
        process.exit(0);
      }
    } catch (error) {
      if (error.status === 404) {
        console.log(`   ❌ Not found (404)\n`);
      } else {
        console.log(`   ❌ Error: ${error.message}\n`);
      }
    }
  }

  console.log('\n❌ No working model found. Checking API key access...');
  process.exit(1);
}

testModels();
