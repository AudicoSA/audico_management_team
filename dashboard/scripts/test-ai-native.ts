/**
 * AI-Native System Test Suite
 *
 * This script demonstrates the AI-native system's ability to handle
 * natural language variations without regex patterns.
 *
 * Run: npx tsx scripts/test-ai-native.ts
 */

// Load environment variables from .env.local
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

// Try to load .env.local first, then .env
const envLocalPath = path.join(process.cwd(), ".env.local");
const envPath = path.join(process.cwd(), ".env");

if (fs.existsSync(envLocalPath)) {
  console.log(`[Test] Loading environment from .env.local`);
  dotenv.config({ path: envLocalPath });
} else if (fs.existsSync(envPath)) {
  console.log(`[Test] Loading environment from .env`);
  dotenv.config({ path: envPath });
} else {
  console.warn(`[Test] Warning: No .env.local or .env file found`);
}

// Verify required environment variables
const requiredEnvVars = [
  "ANTHROPIC_API_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
];

const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);
if (missingVars.length > 0) {
  console.error(`[Test] ❌ Missing required environment variables:`);
  missingVars.forEach((varName) => console.error(`  - ${varName}`));
  console.error(`\nPlease ensure these are set in .env.local`);
  process.exit(1);
}

console.log(`[Test] ✅ Environment variables loaded successfully`);
console.log(`[Test] Supabase URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL}`);
console.log(`[Test] Anthropic API Key: ${process.env.ANTHROPIC_API_KEY?.substring(0, 20)}...`);
console.log("");

import { ClaudeConversationHandler } from "../src/lib/ai/claude-handler";

interface TestScenario {
  name: string;
  category: string;
  message: string;
  expectedBehavior: string;
}

const TEST_SCENARIOS: TestScenario[] = [
  // Home Cinema Variations
  {
    name: "Home Cinema - Direct",
    category: "home_cinema",
    message: "I want a 7.1 home cinema system, budget R150,000",
    expectedBehavior: "Should create home cinema quote and search for AVR, speakers, subwoofer",
  },
  {
    name: "Home Cinema - Natural Language",
    category: "home_cinema",
    message: "Looking to set up a movie room with surround sound",
    expectedBehavior: "Should ask clarifying questions about channels and budget",
  },
  {
    name: "Home Cinema - Casual",
    category: "home_cinema",
    message: "Want to upgrade my lounge with proper audio for movies",
    expectedBehavior: "Should understand this is home cinema and ask follow-up questions",
  },

  // Gym/Fitness Variations - THE CRITICAL TEST
  {
    name: "Gym - Workout Facility",
    category: "commercial_loud",
    message: "Need audio for my workout facility",
    expectedBehavior: "Should recognize 'workout facility' = gym and ask about size, classes, mics",
  },
  {
    name: "Gym - Spinning Studio",
    category: "commercial_loud",
    message: "Setting up sound system for spinning classes",
    expectedBehavior: "Should understand spinning classes = gym class studio",
  },
  {
    name: "Gym - Fitness Center",
    category: "commercial_loud",
    message: "Need speakers for my fitness center with spin studio",
    expectedBehavior: "Should recognize fitness center = gym and note spin studio",
  },
  {
    name: "Gym - Training Facility",
    category: "commercial_loud",
    message: "Audio setup for training facility, 200m2, need wireless mics",
    expectedBehavior: "Should understand training facility context and process requirements",
  },
  {
    name: "Gym - CrossFit Box",
    category: "commercial_loud",
    message: "CrossFit box needs loud music, R40k budget",
    expectedBehavior: "Should understand CrossFit = gym and recommend high-output system",
  },

  // Commercial BGM Variations
  {
    name: "Restaurant - Direct",
    category: "commercial_bgm",
    message: "Need background music for my restaurant",
    expectedBehavior: "Should ask about venue size, zones, outdoor",
  },
  {
    name: "Restaurant - Casual",
    category: "commercial_bgm",
    message: "Want music in my cafe, inside and patio areas",
    expectedBehavior: "Should understand 2 zones (inside + patio/outdoor)",
  },
  {
    name: "Retail - Mall",
    category: "commercial_bgm",
    message: "Audio for my retail store in the mall",
    expectedBehavior: "Should recommend retail background music solution",
  },

  // Video Conference Variations
  {
    name: "Video Conference - Teams",
    category: "video_conference",
    message: "Need Microsoft Teams setup for boardroom",
    expectedBehavior: "Should ask about room size and existing equipment",
  },
  {
    name: "Video Conference - Casual",
    category: "video_conference",
    message: "Setting up meeting room for video calls, seats 8 people",
    expectedBehavior: "Should recommend medium room video bar solution",
  },
  {
    name: "Video Conference - Huddle",
    category: "video_conference",
    message: "Small huddle room needs Zoom camera",
    expectedBehavior: "Should recommend small room video bar",
  },

  // Specific Product Requests
  {
    name: "Product - Specific Model",
    category: "simple",
    message: "How much for the Denon AVR-X3800H?",
    expectedBehavior: "Should search for specific product and provide price",
  },
  {
    name: "Product - Brand Search",
    category: "simple",
    message: "Show me Yamaha receivers under R30k",
    expectedBehavior: "Should search Yamaha with price filter",
  },
  {
    name: "Product - Type Request",
    category: "simple",
    message: "Need a subwoofer for home cinema",
    expectedBehavior: "Should search for subwoofers suitable for home use",
  },

  // Edge Cases and Ambiguity
  {
    name: "Ambiguous - Training",
    category: "ambiguous",
    message: "Need audio for training center",
    expectedBehavior: "Should ask: fitness training or corporate training?",
  },
  {
    name: "Vague Request",
    category: "question",
    message: "I need speakers",
    expectedBehavior: "Should ask clarifying questions about use case",
  },
];

/**
 * Run a single test scenario
 */
async function runTest(scenario: TestScenario, index: number): Promise<void> {
  console.log("\n" + "=".repeat(80));
  console.log(`TEST ${index + 1}/${TEST_SCENARIOS.length}: ${scenario.name}`);
  console.log("=".repeat(80));
  console.log(`Category: ${scenario.category}`);
  console.log(`Message: "${scenario.message}"`);
  console.log(`Expected: ${scenario.expectedBehavior}`);
  console.log("-".repeat(80));

  try {
    const handler = new ClaudeConversationHandler(`test-session-${index}`);
    const startTime = Date.now();

    const response = await handler.chat(scenario.message);

    const duration = Date.now() - startTime;

    console.log("\n✅ RESPONSE:");
    console.log(`Duration: ${duration}ms`);
    console.log(`Message:\n${response.message}\n`);

    if (response.products && response.products.length > 0) {
      console.log(`Products Found: ${response.products.length}`);
      response.products.slice(0, 3).forEach((p) => {
        console.log(`  - ${p.name} (${p.sku}): R${p.price.toLocaleString()}`);
      });
      if (response.products.length > 3) {
        console.log(`  ... and ${response.products.length - 3} more`);
      }
    }

    if (response.quoteId) {
      console.log(`Quote Created: ${response.quoteId}`);
    }

    if (response.needsMoreInfo) {
      console.log(`Status: Needs more information`);
    }

    console.log("\n✅ TEST PASSED");
  } catch (error: any) {
    console.error("\n❌ TEST FAILED");
    console.error(`Error: ${error.message}`);
    console.error(`Stack: ${error.stack}`);
  }

  console.log("=".repeat(80));
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log("\n");
  console.log("🚀 AI-NATIVE SYSTEM TEST SUITE");
  console.log("=".repeat(80));
  console.log(`Running ${TEST_SCENARIOS.length} test scenarios...`);
  console.log("=".repeat(80));

  const startTime = Date.now();
  let passed = 0;
  let failed = 0;

  for (let i = 0; i < TEST_SCENARIOS.length; i++) {
    try {
      await runTest(TEST_SCENARIOS[i], i);
      passed++;
    } catch (error) {
      failed++;
    }

    // Small delay between tests to avoid rate limiting
    if (i < TEST_SCENARIOS.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  const totalDuration = Date.now() - startTime;

  console.log("\n");
  console.log("=".repeat(80));
  console.log("📊 TEST SUMMARY");
  console.log("=".repeat(80));
  console.log(`Total Tests: ${TEST_SCENARIOS.length}`);
  console.log(`Passed: ${passed} ✅`);
  console.log(`Failed: ${failed} ❌`);
  console.log(`Success Rate: ${((passed / TEST_SCENARIOS.length) * 100).toFixed(1)}%`);
  console.log(`Total Duration: ${(totalDuration / 1000).toFixed(1)}s`);
  console.log(`Average per Test: ${(totalDuration / TEST_SCENARIOS.length / 1000).toFixed(1)}s`);
  console.log("=".repeat(80));
  console.log("\n");
}

/**
 * Run specific test by index
 */
async function runSpecificTest(index: number) {
  if (index < 0 || index >= TEST_SCENARIOS.length) {
    console.error(`Invalid test index. Must be between 0 and ${TEST_SCENARIOS.length - 1}`);
    process.exit(1);
  }

  await runTest(TEST_SCENARIOS[index], index);
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length > 0) {
    // Run specific test
    const testIndex = parseInt(args[0], 10);
    if (isNaN(testIndex)) {
      console.error("Usage: npx tsx scripts/test-ai-native.ts [test_index]");
      console.error(`Available tests: 0-${TEST_SCENARIOS.length - 1}`);
      process.exit(1);
    }

    await runSpecificTest(testIndex);
  } else {
    // Run all tests
    await runAllTests();
  }
}

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}

export { TEST_SCENARIOS, runTest, runAllTests };
