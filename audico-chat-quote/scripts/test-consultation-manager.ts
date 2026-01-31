/**
 * Integration Tests for ConsultationRequestManager
 * Run with: tsx scripts/test-consultation-manager.ts
 *
 * NOTE: These tests require the database migration to be run first.
 * Run: supabase/migrations/005_consultation_requests.sql
 */

// Load environment variables from .env.local
import { config } from "dotenv";
import { resolve } from "path";

const envPath = resolve(__dirname, "../.env.local");
config({ path: envPath });

import { ConsultationRequestManager } from "../src/lib/ai/consultation-request-manager";
import type { CreateConsultationRequestData } from "../src/lib/types";

// Test colors for output
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const BLUE = "\x1b[34m";
const YELLOW = "\x1b[33m";
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

async function testCreateRequest() {
  console.log(`\n${BLUE}Testing createRequest()${RESET}`);

  const manager = new ConsultationRequestManager();

  const testData: CreateConsultationRequestData = {
    sessionId: `test_session_${Date.now()}`,
    customerEmail: "test@example.com",
    customerName: "Test Customer",
    customerPhone: "+27123456789",
    companyName: "Test Company",
    projectType: "residential_multi_zone",
    budgetTotal: 250000,
    timeline: "2-3 months",
    zones: [
      {
        name: "Main Cinema",
        location: "Basement",
        dimensions: {
          length: 6,
          width: 4.5,
          height: 2.8,
        },
        useCase: "Home cinema with Dolby Atmos",
        ceilingType: "drywall",
        budgetAllocation: 150000,
      },
      {
        name: "Kitchen",
        location: "Ground Floor",
        useCase: "Background music",
        ceilingType: "concrete",
        budgetAllocation: 50000,
      },
      {
        name: "Outdoor Patio",
        location: "Backyard",
        useCase: "Outdoor entertaining",
        budgetAllocation: 50000,
      },
    ],
    requirementsSummary: "Multi-zone audio system with main Dolby Atmos cinema, kitchen background music, and outdoor speakers",
    technicalNotes: "Existing CAT6 cabling in place. Need wireless control via app.",
    existingEquipment: "Samsung TV (65 inch), existing receiver to replace",
    complexityScore: 75,
    priority: "normal",
  };

  try {
    const request = await manager.createRequest(testData);

    assert(
      request.id !== undefined && request.id.length > 0,
      "Should generate UUID for request ID",
      `Got: ${request.id}`
    );

    assert(
      request.referenceCode.startsWith("CQ-"),
      "Should generate reference code with CQ- prefix",
      `Got: ${request.referenceCode}`
    );

    assert(
      request.sessionId === testData.sessionId,
      "Should preserve session ID",
      `Expected: ${testData.sessionId}, Got: ${request.sessionId}`
    );

    assert(
      request.customerEmail === testData.customerEmail,
      "Should preserve customer email"
    );

    assert(
      request.projectType === testData.projectType,
      "Should preserve project type"
    );

    assert(
      request.budgetTotal === testData.budgetTotal,
      "Should preserve budget total"
    );

    assert(
      request.zones.length === 3,
      "Should preserve all zones",
      `Expected: 3, Got: ${request.zones.length}`
    );

    assert(
      request.zoneCount === 3,
      "Should calculate zone count",
      `Expected: 3, Got: ${request.zoneCount}`
    );

    assert(
      request.status === "pending",
      "Should default to pending status",
      `Got: ${request.status}`
    );

    assert(
      request.priority === "normal",
      "Should preserve priority"
    );

    assert(
      request.complexityScore === 75,
      "Should preserve complexity score"
    );

    console.log(`${YELLOW}Created request: ${request.referenceCode}${RESET}`);
    return request;
  } catch (error: any) {
    console.log(`${RED}✗ Failed to create request: ${error.message}${RESET}`);
    failedTests++;
    return null;
  }
}

async function testGetRequest(requestId: string) {
  console.log(`\n${BLUE}Testing getRequest()${RESET}`);

  const manager = new ConsultationRequestManager();

  try {
    const request = await manager.getRequest(requestId);

    assert(
      request !== undefined,
      "Should retrieve existing request",
      `Request ID: ${requestId}`
    );

    if (request) {
      assert(
        request.id === requestId,
        "Should return correct request",
        `Expected: ${requestId}, Got: ${request.id}`
      );

      assert(
        request.customerEmail === "test@example.com",
        "Should preserve data from database"
      );
    }

    return request;
  } catch (error: any) {
    console.log(`${RED}✗ Failed to get request: ${error.message}${RESET}`);
    failedTests++;
    return null;
  }
}

async function testGetRequestByReference(referenceCode: string) {
  console.log(`\n${BLUE}Testing getRequestByReference()${RESET}`);

  const manager = new ConsultationRequestManager();

  try {
    const request = await manager.getRequestByReference(referenceCode);

    assert(
      request !== undefined,
      "Should retrieve request by reference code",
      `Reference: ${referenceCode}`
    );

    if (request) {
      assert(
        request.referenceCode === referenceCode,
        "Should return correct request",
        `Expected: ${referenceCode}, Got: ${request.referenceCode}`
      );
    }

    return request;
  } catch (error: any) {
    console.log(`${RED}✗ Failed to get by reference: ${error.message}${RESET}`);
    failedTests++;
    return null;
  }
}

async function testUpdateRequest(requestId: string) {
  console.log(`\n${BLUE}Testing updateRequest()${RESET}`);

  const manager = new ConsultationRequestManager();

  try {
    const updated = await manager.updateRequest(requestId, {
      status: "in_progress",
      assignedTo: "john@audico.co.za",
      notes: "Reviewed by specialist. Need to follow up on ceiling types.",
      priority: "high",
    });

    assert(
      updated.status === "in_progress",
      "Should update status",
      `Expected: in_progress, Got: ${updated.status}`
    );

    assert(
      updated.assignedTo === "john@audico.co.za",
      "Should update assigned_to"
    );

    assert(
      updated.assignedAt !== undefined,
      "Should set assigned_at timestamp when assigning"
    );

    assert(
      updated.priority === "high",
      "Should update priority"
    );

    assert(
      updated.notes === "Reviewed by specialist. Need to follow up on ceiling types.",
      "Should update notes"
    );

    console.log(`${YELLOW}Updated request status and assignment${RESET}`);
    return updated;
  } catch (error: any) {
    console.log(`${RED}✗ Failed to update request: ${error.message}${RESET}`);
    failedTests++;
    return null;
  }
}

async function testListBySession(sessionId: string) {
  console.log(`\n${BLUE}Testing listBySession()${RESET}`);

  const manager = new ConsultationRequestManager();

  try {
    const requests = await manager.listBySession(sessionId);

    assert(
      Array.isArray(requests),
      "Should return array of requests"
    );

    assert(
      requests.length > 0,
      "Should find at least one request for session",
      `Session: ${sessionId}, Found: ${requests.length}`
    );

    if (requests.length > 0) {
      assert(
        requests[0].sessionId === sessionId,
        "Should filter by session ID correctly"
      );
    }

    return requests;
  } catch (error: any) {
    console.log(`${RED}✗ Failed to list by session: ${error.message}${RESET}`);
    failedTests++;
    return [];
  }
}

async function testListByStatus() {
  console.log(`\n${BLUE}Testing listByStatus()${RESET}`);

  const manager = new ConsultationRequestManager();

  try {
    const pendingRequests = await manager.listByStatus("pending");

    assert(
      Array.isArray(pendingRequests),
      "Should return array for pending status"
    );

    const inProgressRequests = await manager.listByStatus("in_progress");

    assert(
      Array.isArray(inProgressRequests),
      "Should return array for in_progress status"
    );

    assert(
      inProgressRequests.length > 0,
      "Should find at least one in_progress request (from our test)",
      `Found: ${inProgressRequests.length}`
    );

    if (inProgressRequests.length > 0) {
      assert(
        inProgressRequests[0].status === "in_progress",
        "Should filter by status correctly"
      );
    }

    return { pendingRequests, inProgressRequests };
  } catch (error: any) {
    console.log(`${RED}✗ Failed to list by status: ${error.message}${RESET}`);
    failedTests++;
    return null;
  }
}

// Run all tests
async function runTests() {
  console.log(`${BLUE}===============================================${RESET}`);
  console.log(`${BLUE}Consultation Request Manager Integration Tests${RESET}`);
  console.log(`${BLUE}===============================================${RESET}`);
  console.log(`${YELLOW}NOTE: Database migration must be run first!${RESET}`);

  try {
    // Test 1: Create request
    const createdRequest = await testCreateRequest();
    if (!createdRequest) {
      console.log(`${RED}Cannot continue tests - creation failed${RESET}`);
      return;
    }

    // Test 2: Get request by ID
    await testGetRequest(createdRequest.id);

    // Test 3: Get request by reference code
    await testGetRequestByReference(createdRequest.referenceCode);

    // Test 4: Update request
    await testUpdateRequest(createdRequest.id);

    // Test 5: List by session
    await testListBySession(createdRequest.sessionId);

    // Test 6: List by status
    await testListByStatus();

    // Summary
    console.log(`\n${BLUE}===============================================${RESET}`);
    console.log(`${BLUE}Test Summary${RESET}`);
    console.log(`${BLUE}===============================================${RESET}`);
    console.log(`${GREEN}Passed:${RESET} ${passedTests}`);
    console.log(`${RED}Failed:${RESET} ${failedTests}`);
    console.log(`${BLUE}Total:${RESET}  ${passedTests + failedTests}`);

    if (failedTests === 0) {
      console.log(`\n${GREEN}✓ All tests passed!${RESET}`);
      console.log(`${YELLOW}Test data created with reference: ${createdRequest.referenceCode}${RESET}`);
      process.exit(0);
    } else {
      console.log(`\n${RED}✗ Some tests failed${RESET}`);
      process.exit(1);
    }
  } catch (error: any) {
    console.log(`\n${RED}✗ Test suite failed with error: ${error.message}${RESET}`);
    console.error(error);
    process.exit(1);
  }
}

runTests();
