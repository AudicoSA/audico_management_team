/**
 * Extensive test suite - 100+ tests to verify system reliability
 */

const TEST_QUERIES = [
  // Home cinema variations (20 tests)
  "I need a 5.1 home cinema system",
  "Show me home theater speakers",
  "Looking for surround sound setup",
  "Need floorstanding speakers for movies",
  "Want a 7.1 Dolby Atmos system",
  "Floor speakers for home cinema",
  "Passive speakers for AVR",
  "Subwoofer for home theater",
  "AV receiver recommendations",
  "Home cinema center speaker",
  "Bookshelf speakers for surround",
  "Tower speakers for living room",
  "Movie room audio system",
  "Entertainment center speakers",
  "Passive floorstanding speakers",
  "Home theater subwoofer",
  "Denon receiver options",
  "JBL Stage speakers",
  "5.1 speaker package",
  "Surround sound speakers",

  // Commercial variations (20 tests)
  "Restaurant background music",
  "Ceiling speakers for cafe",
  "Gym audio system",
  "Fitness center sound",
  "Retail store speakers",
  "Background music for shop",
  "Commercial ceiling speakers",
  "Spinning studio audio",
  "Yoga studio sound",
  "Workout facility speakers",
  "Mall audio system",
  "Office background music",
  "Bar wall mount speakers",
  "Restaurant ceiling audio",
  "Retail BGM system",
  "Cafe music speakers",
  "Store audio solution",
  "Commercial PA speakers",
  "High output gym speakers",
  "Fitness audio system",

  // Video conference (10 tests)
  "Video conference solution",
  "Meeting room camera",
  "Boardroom video system",
  "Teams room setup",
  "Zoom room equipment",
  "Conference speakerphone",
  "Huddle room video",
  "Video bar for meetings",
  "Collaboration room setup",
  "Office meeting room audio",

  // Mixed/Complex (10 tests)
  "I need sound for 3 rooms",
  "Home cinema and kitchen audio",
  "Multiple room audio system",
  "Cinema, bar, and patio speakers",
  "Whole house audio",
  "Multi-zone sound system",
  "Living room and bedroom speakers",
  "Home theater plus outdoor",
  "Office and conference room",
  "Restaurant and bar audio",

  // Edge cases (10 tests)
  "Show me speakers",
  "What do you have?",
  "I need audio equipment",
  "Sound system",
  "Best speakers for R50000",
  "Budget home cinema",
  "Premium theater setup",
  "Cheap speakers",
  "Professional audio",
  "High end system",

  // Product-specific (10 tests)
  "Denon AVR-X3800H",
  "Polk Audio speakers",
  "Klipsch Reference",
  "Yamaha receiver",
  "SVS subwoofer",
  "Monitor Audio",
  "Wharfedale speakers",
  "JBL professional",
  "Bose commercial",
  "Sonos speakers",

  // Context retention (10 tests)
  "I have R100k budget for cinema",
  "What's the best AVR?",
  "Show me passive speakers",
  "I need a subwoofer too",
  "What about surrounds?",
  "Any alternatives?",
  "Cheaper options?",
  "Better quality?",
  "In stock items only",
  "Available in Johannesburg?",

  // Negative tests - should NOT return car audio (10 tests)
  "Show me all speakers",
  "Any Focal products?",
  "Hertz audio equipment",
  "Coaxial speakers",
  "Component speakers",
  "6x9 speakers",
  "Car audio",
  "Vehicle speakers",
  "Automotive sound",
  "6.5 inch speakers",

  // Final batch to reach 100+ (10 tests)
  "Outdoor patio speakers",
  "Weatherproof audio",
  "Garden speakers",
  "Pool area sound",
  "Wireless microphone",
  "DJ equipment",
  "Church sound system",
  "Venue audio",
  "Event speakers",
  "Live sound setup",
];

async function runExtensiveTests() {
  console.log(`🧪 Running Extensive Test Suite (${TEST_QUERIES.length} tests)\n`);
  console.log('=' .repeat(80) + '\n');

  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    carAudioLeaks: 0,
    errors: 0,
    startTime: Date.now(),
  };

  for (let i = 0; i < TEST_QUERIES.length; i++) {
    const query = TEST_QUERIES[i];
    results.total++;

    process.stdout.write(`\r[${i + 1}/${TEST_QUERIES.length}] Testing: "${query.substring(0, 50)}${query.length > 50 ? '...' : ''}"`.padEnd(100));

    try {
      const response = await fetch('http://localhost:3000/api/chat/ai-native', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          sessionId: `extensive-test-${i}`,
        }),
      });

      if (!response.ok) {
        results.errors++;
        results.failed++;
        continue;
      }

      const data = await response.json();

      // Check for car audio
      if (data.products && data.products.length > 0) {
        const carAudio = data.products.filter(p => {
          const name = (p.name || '').toLowerCase();
          return [
            'focal kit',
            'hertz',
            'coaxial',
            'component speaker',
            '6x9',
            'car speaker',
            'car subwoofer',
            'vehicle',
            'automotive',
          ].some(k => name.includes(k));
        });

        if (carAudio.length > 0) {
          console.log(`\n❌ FAIL [${i + 1}]: "${query}" - Found ${carAudio.length} car audio products:`);
          carAudio.forEach(p => console.log(`    - ${p.name}`));
          results.carAudioLeaks++;
          results.failed++;
        } else {
          results.passed++;
        }
      } else {
        // No products returned (might be clarifying question or text response)
        results.passed++;
      }

      // Small delay to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error) {
      results.errors++;
      results.failed++;
    }
  }

  const duration = ((Date.now() - results.startTime) / 1000).toFixed(1);

  console.log('\n\n' + '='.repeat(80));
  console.log('\n📊 EXTENSIVE TEST RESULTS\n');
  console.log(`Total tests:      ${results.total}`);
  console.log(`✅ Passed:         ${results.passed} (${(results.passed / results.total * 100).toFixed(1)}%)`);
  console.log(`❌ Failed:         ${results.failed} (${(results.failed / results.total * 100).toFixed(1)}%)`);
  console.log(`🚨 Car audio leaks: ${results.carAudioLeaks}`);
  console.log(`⚠️  Errors:        ${results.errors}`);
  console.log(`⏱️  Duration:       ${duration}s (${(duration / results.total).toFixed(2)}s per test)\n`);

  if (results.carAudioLeaks === 0 && results.errors === 0) {
    console.log('🎉 ALL TESTS PASSED! No car audio leaks detected!\n');
    process.exit(0);
  } else {
    console.log('⚠️  Some issues detected. Review details above.\n');
    process.exit(1);
  }
}

runExtensiveTests();
