# Week 2 Handover: AI Integration

## Context

This is the handover document for **Week 2: AI Integration** of the AI Triage & Specialist Escalation System (CHAT_QUOTE_PLAN_X7).

**Week 1 Status**: ✅ **COMPLETE** - All backend infrastructure is built, tested, and verified.

---

## What Was Completed in Week 1

### ✅ Database Infrastructure
- **Migration file**: `supabase/migrations/005_consultation_requests.sql`
  - Applied successfully to database
  - Table `consultation_requests` created with all required fields
  - 6 performance indexes added
  - Auto-updating timestamp triggers

### ✅ Reference Code Generator
- **Location**: `src/lib/utils.ts`
- Functions:
  - `generateConsultationReferenceCode(count)` - Generates `CQ-YYYYMMDD-XXX`
  - `parseConsultationReferenceCode(code)` - Parses and validates codes
- **Tests**: `scripts/test-reference-code.ts` - **27/27 passing** ✅

### ✅ ConsultationRequestManager Class
- **Location**: `src/lib/ai/consultation-request-manager.ts`
- Complete CRUD operations:
  - `createRequest()` - Creates with auto-generated reference code
  - `getRequest()` - Get by ID
  - `getRequestByReference()` - Get by reference code
  - `updateRequest()` - Update status, assignment, notes
  - `listBySession()` - List all for a session
  - `listByStatus()` - Filter by status
- In-memory caching + Supabase persistence
- **Tests**: `scripts/test-consultation-manager.ts` - **28/28 passing** ✅

### ✅ Type Definitions
- **Locations**:
  - `src/lib/types.ts` - TypeScript interfaces + Zod schemas
  - `src/lib/supabase.ts` - Database table types

### ✅ AI Tool Definition
- **Location**: `src/lib/ai/tools.ts`
- Tool name: `create_consultation_request`
- Complete input schema with validation
- Clear usage guidelines for AI

### ✅ Documentation
- **API Documentation**: `CONSULTATION_REQUEST_API.md`
  - Complete API reference
  - Usage examples
  - Workflow documentation

---

## Week 2 Goals

**Goal**: Enable AI to detect complexity and escalate appropriately

### Tasks Breakdown

1. **Implement complexity scoring algorithm**
   - Create utility function to calculate complexity score (0-100)
   - Scoring factors:
     - Zone count: 1 zone = 0pts, 2 zones = 20pts, 3+ zones = 50pts
     - Budget: R150k+ = 30pts
     - Complex keywords = 20pts
     - Customer uncertain = 20pts
   - Threshold: 50+ points = ESCALATE

2. **Create complexity detector utility with test cases**
   - File: `src/lib/ai/complexity-detector.ts`
   - Test file: `scripts/test-complexity-detector.ts`
   - Should analyze customer message for complexity indicators

3. **Update system prompts with escalation messaging**
   - File: `src/lib/ai/system-prompts.ts`
   - Add guidance on when to escalate
   - Add template responses for escalation scenarios
   - Include information gathering questions

4. **Add complexity detection to chat route**
   - File: `src/app/api/chat/ai-native/route.ts`
   - Integrate complexity detector
   - Trigger escalation flow when threshold met

5. **Implement create_consultation_request tool handler**
   - File: `src/lib/ai/claude-handler.ts`
   - Add handler for `create_consultation_request` tool
   - Connect to ConsultationRequestManager
   - Return reference code to customer

6. **Add structured information gathering prompts**
   - Update system prompts with questions for:
     - Contact info (name, email, phone)
     - Project overview (type, budget, timeline)
     - Zone details (per zone: name, location, use case, dimensions)
     - Technical requirements
     - Existing equipment

7. **Test escalation flow end-to-end with various scenarios**
   - Simple project (should NOT escalate)
   - 3+ zones (should escalate)
   - High budget R200k+ (should escalate)
   - Complex requirements (should escalate)

8. **Validate AI correctly gathers all required information**
   - Ensure all required fields are collected
   - Test missing information handling

9. **Test simple vs complex project differentiation**
   - Verify false positive rate is low
   - Verify false negative rate is low

10. **Document escalation decision logic**
    - Create decision tree diagram
    - Document edge cases

---

## Key Files to Modify

### 1. Create New Files

**`src/lib/ai/complexity-detector.ts`**
```typescript
// Complexity detection logic
export interface ComplexityAnalysis {
  zones: number;
  budget: number | null;
  hasMultiZone: boolean;
  isHighBudget: boolean;
  hasComplexKeywords: boolean;
  customerUncertain: boolean;
  score: number;
  shouldEscalate: boolean;
  reasons: string[];
}

export function analyzeComplexity(message: string, budget?: number): ComplexityAnalysis;
```

**`scripts/test-complexity-detector.ts`**
- Unit tests for complexity detection
- Test cases for various scenarios

### 2. Modify Existing Files

**`src/lib/ai/system-prompts.ts`**
- Add escalation guidance
- Add information gathering templates

**`src/lib/ai/claude-handler.ts`**
- Add tool handler for `create_consultation_request`
- Import consultationRequestManager
- Handle tool execution and response

**`src/app/api/chat/ai-native/route.ts`**
- Import complexity detector
- Run complexity analysis on initial message
- Adjust AI behavior based on complexity

---

## Complexity Detection Algorithm

Based on CHAT_QUOTE_PLAN_X7 (lines 122-129):

```typescript
interface ComplexityScore {
  zones: number;           // How many zones mentioned
  budget: number | null;   // Budget amount
  hasMultiZone: boolean;   // 3+ zones detected
  isHighBudget: boolean;   // R150k+ detected
  hasComplexKeywords: boolean; // "whole home", "distributed", "multiple"
  customerUncertain: boolean;  // "not sure", "help me decide"
  score: number;           // 0-100 complexity score
}

// Scoring Logic:
// - 1 zone = 0 points
// - 2 zones = 20 points
// - 3+ zones = 50 points ⚠️
// - Budget R150k+ = 30 points ⚠️
// - Complex keywords = 20 points
// - Customer uncertain = 20 points
// - THRESHOLD: 50+ points = ESCALATE
```

**Keywords to detect**:
- Multi-zone: "whole home", "multiple rooms", "distributed", "entire house", "all rooms"
- Uncertainty: "not sure", "don't know", "help me decide", "what do I need"
- Complex: "Dolby Atmos", "outdoor", "commercial", "multiple zones", "integration"

---

## Escalation Response Template

From CHAT_QUOTE_PLAN_X7 (lines 137-147):

```
"This is a comprehensive [multi-zone/high-value/custom] audio project that will
benefit from our specialist team. They'll design the optimal system with professional
CAD layouts, detailed specifications, and installation planning.

Let me capture your requirements, and we'll have an AV specialist create a detailed
proposal within 24-48 hours. This ensures you get the best system design for your
investment.

Can I ask you some questions about your project?"
```

---

## Information Gathering Questions

From CHAT_QUOTE_PLAN_X7 (lines 161-193):

### Core Questions
1. **Contact Information**
   - Name, Email, Phone
   - Company (if commercial)

2. **Project Overview**
   - Property type (residential/commercial)
   - Total budget
   - Timeline/urgency
   - Primary use case

3. **Zone Details** (for each zone)
   - Zone name/location
   - Room dimensions (LxWxH)
   - Use case (cinema, background music, etc.)
   - Ceiling height/type
   - Budget allocation preference

4. **Technical Requirements**
   - Existing equipment to integrate
   - Wiring/infrastructure status
   - Control preferences (app, wall panels)
   - Special constraints

5. **Additional Context**
   - Why now? (renovation, new build, upgrade)
   - Installer preference (DIY vs professional)
   - Brands/preferences
   - Any other details

---

## Testing Strategy

### Test Scenarios

**1. Simple Projects (Should NOT Escalate)**
- "Need soundbar for TV lounge, budget R30k"
- "Conference room video bar for 8 people"
- "5.1 home cinema system, budget R80k"
- Expected: AI provides quote, does not escalate

**2. Multi-Zone Projects (Should Escalate)**
- "5.1 cinema + 4 other zones, budget R300k"
- "Whole home audio, 8 zones"
- Expected: Complexity score ≥50, AI escalates

**3. High Budget (Should Escalate)**
- "Home cinema system, budget R250k"
- Expected: Complexity score ≥30 from budget alone

**4. Complex Requirements (Should Escalate)**
- "Dolby Atmos + outdoor speakers + kitchen music"
- "Not sure what I need, large house, good budget"
- Expected: AI detects complexity and escalates

### Test Commands

```bash
# Run reference code tests
npx tsx scripts/test-reference-code.ts

# Run consultation manager tests
npx tsx -r dotenv/config scripts/test-consultation-manager.ts dotenv_config_path=.env.local

# Run complexity detector tests (to be created)
npx tsx scripts/test-complexity-detector.ts
```

---

## Success Criteria for Week 2

- [ ] Complexity detector accurately identifies simple vs complex projects
- [ ] AI escalates multi-zone projects (3+ zones)
- [ ] AI escalates high-budget projects (R150k+)
- [ ] AI gathers all required information before creating consultation request
- [ ] Consultation requests are successfully created in database
- [ ] Reference codes are returned to customers
- [ ] AI does NOT escalate simple single-zone projects
- [ ] End-to-end test scenarios all pass

---

## Resources

### Documentation
- **Plan**: `CHAT_QUOTE_PLAN_X7.md` (lines 320-354 for Week 2 details)
- **API Docs**: `CONSULTATION_REQUEST_API.md`

### Code Files
- **Manager**: `src/lib/ai/consultation-request-manager.ts`
- **Types**: `src/lib/types.ts`
- **Tools**: `src/lib/ai/tools.ts` (tool already defined)
- **Utils**: `src/lib/utils.ts` (reference code generator)

### Test Files
- **Reference codes**: `scripts/test-reference-code.ts` (27/27 ✅)
- **Manager**: `scripts/test-consultation-manager.ts` (28/28 ✅)

### Database
- **Migration**: `supabase/migrations/005_consultation_requests.sql` (applied ✅)
- **Test data**: Created via test suite, reference code: `CQ-20260126-001`

---

## Notes for Next Agent

1. **Week 1 is fully complete and tested** - all backend infrastructure is ready
2. **Database migration is applied** - consultation_requests table exists
3. **All tests passing** - 55/55 tests green ✅
4. **The create_consultation_request tool is defined** - just needs handler
5. **Focus on AI integration** - detection, escalation, and information gathering
6. **Don't modify Week 1 code** unless you find bugs - it's tested and working

Good luck with Week 2! The foundation is solid. 🚀
