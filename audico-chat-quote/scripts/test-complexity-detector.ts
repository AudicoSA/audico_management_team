/**
 * Test Suite: Complexity Detector
 *
 * Tests the complexity scoring algorithm and escalation logic
 * for the AI Triage & Specialist Escalation System.
 */

import { analyzeComplexity, explainComplexity } from '../src/lib/ai/complexity-detector';

interface TestCase {
  name: string;
  message: string;
  budget?: number;
  expectedEscalate: boolean;
  expectedMinScore?: number;
  description: string;
}

// Test scenarios from WEEK_2_HANDOVER.md
const TEST_CASES: TestCase[] = [
  // ========== SIMPLE PROJECTS (Should NOT Escalate) ==========
  {
    name: 'Simple: Soundbar',
    message: 'Need soundbar for TV lounge, budget R30k',
    expectedEscalate: false,
    expectedMinScore: 0,
    description: 'Single zone, low budget, clear requirements',
  },
  {
    name: 'Simple: Conference Room',
    message: 'Conference room video bar for 8 people',
    expectedEscalate: false,
    expectedMinScore: 0,
    description: 'Single zone, standard use case',
  },
  {
    name: 'Simple: Home Cinema',
    message: '5.1 home cinema system, budget R80k',
    expectedEscalate: false,
    expectedMinScore: 0,
    description: 'Single zone, moderate budget',
  },
  {
    name: 'Simple: Background Music',
    message: 'Background music for small restaurant',
    expectedEscalate: false,
    expectedMinScore: 0,
    description: 'Single zone, commercial but simple',
  },
  {
    name: 'Simple: Two Zones Low Budget',
    message: 'Need speakers for living room and bedroom, budget R60k',
    expectedEscalate: false,
    expectedMinScore: 20,
    description: '2 zones = 20 points, below threshold',
  },

  // ========== MULTI-ZONE PROJECTS (Should Escalate) ==========
  {
    name: 'Complex: 5 Zones High Budget',
    message: '5.1 cinema + 4 other zones, budget R300k',
    expectedEscalate: true,
    expectedMinScore: 50,
    description: '5 zones (50pts) + high budget (30pts) + complex (20pts)',
  },
  {
    name: 'Complex: Whole Home Audio',
    message: 'Whole home audio, 8 zones',
    expectedEscalate: true,
    expectedMinScore: 50,
    description: '8 zones detected, multi-zone keywords',
  },
  {
    name: 'Complex: 3 Zones Explicit',
    message: 'I need audio in 3 rooms: living room, kitchen, and patio',
    expectedEscalate: true,
    expectedMinScore: 50,
    description: '3 zones = 50 points exactly',
  },
  {
    name: 'Complex: Multiple Rooms Keyword',
    message: 'Need distributed audio system for multiple rooms in my house',
    expectedEscalate: true,
    expectedMinScore: 50,
    description: 'Multi-zone keywords trigger escalation',
  },
  {
    name: 'Complex: Entire House',
    message: 'Want music throughout the entire house',
    expectedEscalate: true,
    expectedMinScore: 50,
    description: 'Whole-home keywords',
  },

  // ========== HIGH BUDGET PROJECTS (Should Escalate) ==========
  {
    name: 'Complex: High Budget Single Zone',
    message: 'Home cinema system, budget R250k',
    expectedEscalate: true,
    expectedMinScore: 30,
    description: 'High budget alone triggers escalation',
  },
  {
    name: 'Complex: Budget R150k Threshold',
    message: 'Looking for premium home theater, budget is R150000',
    expectedEscalate: true,
    expectedMinScore: 30,
    description: 'Exactly at R150k threshold',
  },
  {
    name: 'Complex: Budget R200k',
    message: 'Corporate headquarters meeting room, R200k budget',
    expectedEscalate: true,
    expectedMinScore: 30,
    description: 'High budget commercial project',
  },

  // ========== COMPLEX REQUIREMENTS (Should Escalate) ==========
  {
    name: 'Complex: Dolby Atmos Multi-Zone',
    message: 'Dolby Atmos cinema + outdoor speakers + kitchen music',
    expectedEscalate: true,
    expectedMinScore: 50,
    description: 'Complex keywords + multiple zones',
  },
  {
    name: 'Complex: Commercial Multi-Zone',
    message: 'Restaurant + bar + patio, need zoned control, budget R180k',
    expectedEscalate: true,
    expectedMinScore: 50,
    description: '3 zones + high budget + complex',
  },
  {
    name: 'Complex: Integration Requirements',
    message: 'Need to integrate with existing Sonos system across 4 zones',
    expectedEscalate: true,
    expectedMinScore: 50,
    description: 'Integration + multi-zone',
  },

  // ========== CUSTOMER UNCERTAINTY (Should Escalate) ==========
  {
    name: 'Complex: Not Sure Large House',
    message: "Not sure what I need, large house, good budget available",
    expectedEscalate: true,
    expectedMinScore: 20,
    description: 'Customer uncertainty + implicit complexity',
  },
  {
    name: 'Complex: Need Advice Multiple Rooms',
    message: "I don't know what speakers to get for my 5 rooms, help me decide",
    expectedEscalate: true,
    expectedMinScore: 50,
    description: 'Uncertainty (20pts) + 5 zones (50pts)',
  },
  {
    name: 'Complex: What Do I Need',
    message: 'What do I need for whole home audio system?',
    expectedEscalate: true,
    expectedMinScore: 50,
    description: 'Uncertainty + whole home keywords',
  },

  // ========== EDGE CASES ==========
  {
    name: 'Edge: 2 Zones + Complex Keywords',
    message: 'Living room Dolby Atmos + bedroom speakers, budget R95k',
    expectedEscalate: false,
    expectedMinScore: 40,
    description: '2 zones (20pts) + complex (20pts) = 40pts, below threshold',
  },
  {
    name: 'Edge: 2 Zones + Uncertainty',
    message: "Need speakers for 2 rooms, not sure which ones to get, budget R70k",
    expectedEscalate: false,
    expectedMinScore: 40,
    description: '2 zones (20pts) + uncertainty (20pts) = 40pts, below threshold',
  },
  {
    name: 'Edge: High Budget Format Variations',
    message: 'Home theater with budget of R 180,000',
    expectedEscalate: true,
    expectedMinScore: 30,
    description: 'Budget extraction with spaces',
  },
  {
    name: 'Edge: Zone Detection Various Terms',
    message: 'Need audio in 4 areas: lounge, dining, kitchen, patio',
    expectedEscalate: true,
    expectedMinScore: 50,
    description: '"areas" keyword for zone detection',
  },
];

// Run tests
function runTests(): void {
  console.log('🧪 COMPLEXITY DETECTOR TEST SUITE\n');
  console.log('=' .repeat(80));
  console.log('\n');

  let passed = 0;
  let failed = 0;
  const failures: string[] = [];

  TEST_CASES.forEach((testCase, index) => {
    const result = analyzeComplexity(testCase.message, testCase.budget);
    const escalationMatch = result.shouldEscalate === testCase.expectedEscalate;
    const scoreMatch = testCase.expectedMinScore === undefined || result.score >= testCase.expectedMinScore;
    const success = escalationMatch && scoreMatch;

    if (success) {
      passed++;
      console.log(`✅ Test ${index + 1}: ${testCase.name}`);
    } else {
      failed++;
      console.log(`❌ Test ${index + 1}: ${testCase.name}`);
      failures.push(`
Test: ${testCase.name}
Message: "${testCase.message}"
Description: ${testCase.description}
Expected: ${testCase.expectedEscalate ? 'ESCALATE' : 'NO ESCALATE'} (min score: ${testCase.expectedMinScore ?? 0})
Got: ${result.shouldEscalate ? 'ESCALATE' : 'NO ESCALATE'} (score: ${result.score})
Analysis:
${explainComplexity(result)}
      `);
    }

    // Show details for all tests
    console.log(`   Score: ${result.score}/100 | Zones: ${result.zones} | Budget: ${result.budget ? `R${result.budget.toLocaleString()}` : 'N/A'}`);
    if (result.reasons.length > 0) {
      console.log(`   Reasons: ${result.reasons.join(', ')}`);
    }
    console.log('');
  });

  console.log('=' .repeat(80));
  console.log(`\n📊 RESULTS: ${passed}/${TEST_CASES.length} tests passed\n`);

  if (failed > 0) {
    console.log('❌ FAILURES:\n');
    failures.forEach(failure => console.log(failure));
    process.exit(1);
  } else {
    console.log('✅ ALL TESTS PASSED!\n');
    console.log('🎉 Complexity detector is working correctly.\n');
  }
}

// Additional validation tests
function runValidationTests(): void {
  console.log('🔍 VALIDATION TESTS\n');
  console.log('=' .repeat(80));
  console.log('\n');

  // Test 1: Budget extraction variations
  console.log('Test: Budget Extraction Variations');
  const budgetTests = [
    { text: 'budget R150k', expected: 150000 },
    { text: 'budget R 150,000', expected: 150000 },
    { text: 'R150000', expected: 150000 },
    { text: '200000 rand', expected: 200000 },
    { text: 'budget: R180k', expected: 180000 },
  ];

  budgetTests.forEach(test => {
    const result = analyzeComplexity(test.text);
    const match = result.budget === test.expected;
    console.log(`  ${match ? '✅' : '❌'} "${test.text}" → ${result.budget === null ? 'null' : `R${result.budget.toLocaleString()}`} (expected: R${test.expected.toLocaleString()})`);
  });

  console.log('\n');

  // Test 2: Zone detection variations
  console.log('Test: Zone Detection Variations');
  const zoneTests = [
    { text: '5 zones', expected: 5 },
    { text: '3 rooms', expected: 3 },
    { text: '8 areas', expected: 8 },
    { text: 'single room', expected: 1 },
    { text: 'whole home audio', expected: 1 }, // Keywords don't affect count, only hasMultiZone flag
  ];

  zoneTests.forEach(test => {
    const result = analyzeComplexity(test.text);
    const match = result.zones === test.expected;
    console.log(`  ${match ? '✅' : '❌'} "${test.text}" → ${result.zones} zones (expected: ${test.expected})`);
  });

  console.log('\n');
  console.log('=' .repeat(80));
  console.log('\n');
}

// Run all tests
console.log('\n');
runTests();
runValidationTests();
