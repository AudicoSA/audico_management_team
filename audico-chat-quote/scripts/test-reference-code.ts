/**
 * Unit Tests for Consultation Reference Code Generator
 * Run with: tsx scripts/test-reference-code.ts
 */

import {
  generateConsultationReferenceCode,
  parseConsultationReferenceCode,
} from "../src/lib/utils";

// Test colors for output
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const BLUE = "\x1b[34m";
const RESET = "\x1b[0m";

let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, message?: string) {
  if (condition) {
    console.log(`${GREEN}✓${RESET} ${testName}`);
    passedTests++;
  } else {
    console.log(`${RED}✗${RESET} ${testName}`);
    if (message) console.log(`  ${message}`);
    failedTests++;
  }
}

function testGenerateReferenceCode() {
  console.log(`\n${BLUE}Testing generateConsultationReferenceCode()${RESET}`);

  // Test 1: Basic generation with count 0
  const code1 = generateConsultationReferenceCode(0);
  assert(
    code1.startsWith("CQ-"),
    "Should start with CQ- prefix",
    `Got: ${code1}`
  );
  assert(
    code1.endsWith("-001"),
    "Should end with -001 for count 0",
    `Got: ${code1}`
  );
  assert(
    code1.length === 15,
    "Should be 15 characters long (CQ-YYYYMMDD-XXX)",
    `Got length: ${code1.length}, code: ${code1}`
  );

  // Test 2: Generation with count 5
  const code2 = generateConsultationReferenceCode(5);
  assert(
    code2.endsWith("-006"),
    "Should end with -006 for count 5",
    `Got: ${code2}`
  );

  // Test 3: Generation with count 99
  const code3 = generateConsultationReferenceCode(99);
  assert(
    code3.endsWith("-100"),
    "Should end with -100 for count 99",
    `Got: ${code3}`
  );

  // Test 4: Format validation using regex
  const formatRegex = /^CQ-\d{8}-\d{3}$/;
  assert(
    formatRegex.test(code1),
    "Should match format CQ-YYYYMMDD-XXX",
    `Got: ${code1}`
  );

  // Test 5: Date validation - should be today's date
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const expectedDate = `${year}${month}${day}`;

  assert(
    code1.includes(expectedDate),
    "Should include today's date",
    `Expected: ${expectedDate}, Got: ${code1}`
  );

  // Test 6: Two consecutive calls should have same date prefix
  const codeA = generateConsultationReferenceCode(0);
  const codeB = generateConsultationReferenceCode(1);
  const datePartA = codeA.substring(3, 11);
  const datePartB = codeB.substring(3, 11);
  assert(
    datePartA === datePartB,
    "Consecutive calls should have same date",
    `Code A: ${codeA}, Code B: ${codeB}`
  );
}

function testParseReferenceCode() {
  console.log(`\n${BLUE}Testing parseConsultationReferenceCode()${RESET}`);

  // Test 1: Valid code parsing
  const validCode = "CQ-20250126-001";
  const parsed1 = parseConsultationReferenceCode(validCode);
  assert(
    parsed1 !== null,
    "Should parse valid reference code",
    `Got: ${JSON.stringify(parsed1)}`
  );

  if (parsed1) {
    assert(
      parsed1.sequence === 1,
      "Should extract sequence number 1",
      `Got: ${parsed1.sequence}`
    );
    assert(
      parsed1.date instanceof Date,
      "Should return Date object",
      `Got: ${typeof parsed1.date}`
    );
    assert(
      parsed1.date.getFullYear() === 2025,
      "Should extract year 2025",
      `Got: ${parsed1.date.getFullYear()}`
    );
    assert(
      parsed1.date.getMonth() === 0,
      "Should extract month 0 (January)",
      `Got: ${parsed1.date.getMonth()}`
    );
    assert(
      parsed1.date.getDate() === 26,
      "Should extract day 26",
      `Got: ${parsed1.date.getDate()}`
    );
  }

  // Test 2: Another valid code with different sequence
  const validCode2 = "CQ-20251231-999";
  const parsed2 = parseConsultationReferenceCode(validCode2);
  assert(
    parsed2 !== null && parsed2.sequence === 999,
    "Should parse sequence 999",
    `Got: ${parsed2?.sequence}`
  );

  // Test 3: Invalid codes should return null
  const invalidCodes = [
    "INVALID",
    "CQ-2025126-001",    // Missing digit in date
    "CQ-20250126-12",    // Only 2 digits in sequence
    "CQ-20250126-1234",  // 4 digits in sequence
    "QC-20250126-001",   // Wrong prefix
    "20250126-001",      // Missing prefix
    "",
  ];

  invalidCodes.forEach((code) => {
    const parsed = parseConsultationReferenceCode(code);
    assert(
      parsed === null,
      `Should return null for invalid code: "${code}"`,
      `Got: ${JSON.stringify(parsed)}`
    );
  });
}

function testRoundTrip() {
  console.log(`\n${BLUE}Testing Round Trip (Generate -> Parse)${RESET}`);

  const generated = generateConsultationReferenceCode(42);
  const parsed = parseConsultationReferenceCode(generated);

  assert(
    parsed !== null,
    "Should be able to parse generated code",
    `Generated: ${generated}`
  );

  if (parsed) {
    assert(
      parsed.sequence === 43,
      "Should preserve sequence number (count 42 -> seq 43)",
      `Expected: 43, Got: ${parsed.sequence}`
    );

    const today = new Date();
    assert(
      parsed.date.getFullYear() === today.getFullYear(),
      "Should preserve year",
      `Expected: ${today.getFullYear()}, Got: ${parsed.date.getFullYear()}`
    );
    assert(
      parsed.date.getMonth() === today.getMonth(),
      "Should preserve month",
      `Expected: ${today.getMonth()}, Got: ${parsed.date.getMonth()}`
    );
    assert(
      parsed.date.getDate() === today.getDate(),
      "Should preserve day",
      `Expected: ${today.getDate()}, Got: ${parsed.date.getDate()}`
    );
  }
}

// Run all tests
console.log(`${BLUE}===============================================${RESET}`);
console.log(`${BLUE}Consultation Reference Code Generator Tests${RESET}`);
console.log(`${BLUE}===============================================${RESET}`);

testGenerateReferenceCode();
testParseReferenceCode();
testRoundTrip();

// Summary
console.log(`\n${BLUE}===============================================${RESET}`);
console.log(`${BLUE}Test Summary${RESET}`);
console.log(`${BLUE}===============================================${RESET}`);
console.log(`${GREEN}Passed:${RESET} ${passedTests}`);
console.log(`${RED}Failed:${RESET} ${failedTests}`);
console.log(`${BLUE}Total:${RESET}  ${passedTests + failedTests}`);

if (failedTests === 0) {
  console.log(`\n${GREEN}✓ All tests passed!${RESET}`);
  process.exit(0);
} else {
  console.log(`\n${RED}✗ Some tests failed${RESET}`);
  process.exit(1);
}
