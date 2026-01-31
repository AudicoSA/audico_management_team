/**
 * Test Runner - Loads environment variables before running tests
 *
 * This wrapper ensures .env.local is loaded BEFORE any modules
 * that depend on environment variables are imported.
 */

// STEP 1: Load environment variables FIRST (before ANY imports)
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

const envLocalPath = path.join(process.cwd(), ".env.local");
const envPath = path.join(process.cwd(), ".env");

if (fs.existsSync(envLocalPath)) {
  console.log(`[Test Runner] Loading environment from .env.local`);
  dotenv.config({ path: envLocalPath });
} else if (fs.existsSync(envPath)) {
  console.log(`[Test Runner] Loading environment from .env`);
  dotenv.config({ path: envPath });
} else {
  console.error(`[Test Runner] ❌ Error: No .env.local or .env file found`);
  console.error(`Please create .env.local with required environment variables`);
  process.exit(1);
}

// STEP 2: Verify required environment variables
const requiredEnvVars = [
  "ANTHROPIC_API_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
];

const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);
if (missingVars.length > 0) {
  console.error(`[Test Runner] ❌ Missing required environment variables:`);
  missingVars.forEach((varName) => console.error(`  - ${varName}`));
  console.error(`\nPlease ensure these are set in .env.local`);
  process.exit(1);
}

console.log(`[Test Runner] ✅ Environment variables loaded successfully`);
console.log(`[Test Runner] Supabase URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL}`);
console.log(`[Test Runner] Anthropic API: ${process.env.ANTHROPIC_API_KEY?.substring(0, 20)}...`);
console.log("");

// STEP 3: Now it's safe to import and run the test suite
async function runTests() {
  try {
    // Dynamic import to ensure env vars are loaded first
    const testModule = await import("./test-ai-native");

    // Check if this is a single test run
    const args = process.argv.slice(2);
    if (args.length > 0) {
      const testIndex = parseInt(args[0], 10);
      if (isNaN(testIndex)) {
        console.error("Usage: npm run test:ai [test_index]");
        console.error(`Available tests: 0-${testModule.TEST_SCENARIOS.length - 1}`);
        process.exit(1);
      }
      await testModule.runTest(testModule.TEST_SCENARIOS[testIndex], testIndex);
    } else {
      await testModule.runAllTests();
    }
  } catch (error: any) {
    console.error("[Test Runner] ❌ Fatal error:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the tests
runTests();
