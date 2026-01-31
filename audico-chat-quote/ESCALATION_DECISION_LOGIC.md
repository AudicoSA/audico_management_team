# Escalation Decision Logic

**Document Version**: 1.0
**Date**: 2026-01-26
**Status**: Implemented ✅

## Overview

The AI Triage & Specialist Escalation System automatically detects complex audio projects and routes them to specialist consultants while handling simple projects autonomously.

## Decision Tree

```
Customer Message Received
    ↓
[Is this the first message?]
    ↓ YES
    ├─→ Analyze Complexity
    │   ↓
    │   [Complexity Score Calculation]
    │   ↓
    │   [Score ≥ 50 OR High Budget OR Multi-Zone?]
    │   ↓
    │   ├─→ YES: ESCALATE TO SPECIALIST
    │   │   ↓
    │   │   1. Show escalation message
    │   │   2. Gather structured requirements
    │   │   3. Create consultation request
    │   │   4. Return reference code
    │   │
    │   └─→ NO: HANDLE AUTONOMOUSLY
    │       ↓
    │       Continue with normal quote workflow
    │       (Search → Recommend → Build Quote)
    │
    ↓ NO
    Continue conversation
```

## Complexity Scoring Algorithm

### Score Components

| Factor | Condition | Points | Notes |
|--------|-----------|--------|-------|
| **Single Zone** | 1 zone detected | 0 pts | Simple, AI can handle |
| **Two Zones** | 2 zones detected | 20 pts | Moderate, still manageable |
| **Multi-Zone** | 3+ zones detected | 50 pts | ⚠️ **Triggers escalation** |
| **High Budget** | R150,000+ | 30 pts | ⚠️ **Triggers escalation** |
| **Complex Keywords** | Technical terms detected | 20 pts | Dolby Atmos, integration, etc. |
| **Customer Uncertainty** | Customer unsure | 20 pts | Needs guidance |

### Escalation Thresholds

**IMMEDIATE ESCALATION** (any one triggers):
- ✅ **3+ zones detected** (zones ≥ 3)
- ✅ **Multi-zone keywords** ("whole home", "distributed", "large house")
- ✅ **High budget** (≥ R150,000)
- ✅ **Combined score** ≥ 50 points

## Detection Methods

### 1. Zone Count Detection

**Explicit Numeric Patterns:**
```typescript
/(\d+)\s+zones?/i        // "5 zones", "3 zone"
/(\d+)\s+rooms?/i        // "8 rooms", "4 room"
/(\d+)\s+areas?/i        // "6 areas"
/(\d+)\s+spaces?/i       // "4 spaces"
/(\d+)\s+other\s+zones?/i // "4 other zones"
```

**Room Name Counting:**
If no explicit count, count unique room mentions:
- living room, lounge, tv room, family room
- bedroom, master, guest room
- kitchen, dining, dining room
- bathroom
- office, study, den, library
- patio, outdoor, deck, veranda, balcony
- garage, basement, attic, loft
- cinema, theater, media room
- bar, restaurant, cafe, shop
- conference room, meeting room, boardroom
- gym, workout room
- hallway, corridor, entrance, foyer

**Example:**
```
"I need speakers for living room and bedroom"
→ Detects 2 unique rooms → zones = 2 → score = 20pts
```

### 2. Budget Detection

**Budget Patterns:**
```typescript
/r\s*(\d{1,3}(?:[,\s]?\d{3})*(?:\.\d{2})?)\s*k?/gi  // R150k, R 150000
/(\d{1,3}(?:[,\s]?\d{3})*)\s*rand/gi                 // 150000 rand
/budget[:\s]+r?\s*(\d{1,3}(?:[,\s]?\d{3})*)/gi      // budget: R150000
```

**Handles Variations:**
- `R150k` → R150,000
- `R 150,000` → R150,000
- `150000 rand` → R150,000
- `budget: R180k` → R180,000

**Threshold:**
- Budget ≥ R150,000 → **ESCALATE** (isHighBudget = true)

### 3. Multi-Zone Keyword Detection

```typescript
"whole home"           // Whole-home audio system
"multiple rooms"       // Multiple rooms mentioned
"distributed audio"    // Distributed audio system
"entire house"         // Entire house coverage
"all rooms"           // All rooms in property
"throughout the house" // Throughout the property
"every room"          // Every room coverage
"several rooms"       // Several rooms
"different rooms"     // Different rooms
"various rooms"       // Various rooms
"large house"         // Large house (implies multi-zone)
"big house"           // Big house
"large property"      // Large property
```

### 4. Complex Keyword Detection

```typescript
"dolby atmos"         // Dolby Atmos system
"outdoor speakers"    // Outdoor integration
"commercial"          // Commercial installation
"multiple zones"      // Multiple zones
"integration"         // System integration
"whole house"         // Whole house system
"distributed"         // Distributed system
"multi-zone"          // Multi-zone (hyphenated)
"wiring"             // Wiring considerations
"installation"       // Professional installation
"professional install" // Professional installation
```

### 5. Uncertainty Detection

```typescript
"not sure"            // Customer uncertain
"don't know"          // Customer doesn't know
"help me decide"      // Needs help deciding
"what do i need"      // Needs recommendation
"don't understand"    // Doesn't understand
"confused"           // Customer confused
"uncertain"          // Explicitly uncertain
"advice"             // Seeking advice
"recommend"          // Wants recommendation
"suggest"            // Wants suggestion
```

## Example Scenarios

### Simple Projects (AI Handles)

| Message | Zones | Budget | Score | Decision |
|---------|-------|--------|-------|----------|
| "Need soundbar for TV lounge, budget R30k" | 1 | R30,000 | 0 | ✅ AI handles |
| "Conference room video bar for 8 people" | 1 | N/A | 0 | ✅ AI handles |
| "5.1 home cinema system, budget R80k" | 1 | R80,000 | 0 | ✅ AI handles |
| "Need speakers for living room and bedroom, R60k" | 2 | R60,000 | 20 | ✅ AI handles |

### Complex Projects (Escalate)

| Message | Zones | Budget | Score | Decision | Trigger |
|---------|-------|--------|-------|----------|---------|
| "5.1 cinema + 4 other zones, budget R300k" | 4 | R300,000 | 80 | ⚠️ Escalate | Multi-zone + High budget |
| "Whole home audio, 8 zones" | 8 | N/A | 50 | ⚠️ Escalate | Multi-zone (≥3) |
| "Home cinema system, budget R250k" | 1 | R250,000 | 30 | ⚠️ Escalate | High budget |
| "Not sure what I need, large house" | 1 | N/A | 70 | ⚠️ Escalate | Uncertainty + Multi-zone keywords |
| "Dolby Atmos + outdoor + kitchen music" | 3 | N/A | 70 | ⚠️ Escalate | 3 zones + Complex |

## Escalation Workflow

### Step 1: Detection (Automatic)

On first customer message:
```typescript
const analysis = analyzeComplexity(customerMessage);

if (analysis.shouldEscalate) {
  // Inject escalation context into AI prompt
  // AI will follow escalation workflow
}
```

### Step 2: AI Response

**Template Response:**
```
"This is a comprehensive [multi-zone/high-value/custom] audio project that will
benefit from our specialist team. They'll design the optimal system with professional
CAD layouts, detailed specifications, and installation planning.

Let me capture your requirements, and we'll have an AV specialist create a detailed
proposal within 24-48 hours. This ensures you get the best system design for your
investment.

Can I ask you some questions about your project?"
```

### Step 3: Information Gathering

AI gathers (conversationally, not interrogation-style):

**Contact Information:**
- Customer name
- Email address (required)
- Phone number
- Company name (if commercial)

**Project Overview:**
- Property type (residential/commercial)
- Total budget
- Timeline/urgency
- Primary use case

**Zone Details** (for each zone):
- Zone name and location
- Room dimensions (if available)
- Use case (cinema, background music, etc.)
- Existing equipment (if any)

**Technical Requirements:**
- Existing equipment to integrate
- Wiring/infrastructure status
- Control preferences (app, wall panels)
- Special constraints

**Additional Context:**
- Why now? (renovation, new build, upgrade)
- DIY vs professional installation
- Brand preferences
- Other details

### Step 4: Create Consultation Request

```typescript
const request = await consultationRequestManager.createRequest({
  sessionId,
  customerEmail,
  projectType: "residential_multi_zone",
  budgetTotal: 300000,
  zones: [
    { name: "Main Cinema", location: "Basement", use_case: "5.1.2 Dolby Atmos" },
    { name: "Kitchen", location: "Ground Floor", use_case: "Background music" },
    { name: "Patio", location: "Outdoor", use_case: "Outdoor speakers" },
  ],
  requirementsSummary: "Multi-zone system with Dolby Atmos cinema...",
  complexityScore: 80,
});
```

Returns reference code: `CQ-20260126-001`

### Step 5: Confirmation

**Template Confirmation:**
```
"Perfect! I've created consultation request **CQ-20260126-001** for your project.

Here's what happens next:
✅ Our AV specialist team will review your requirements within 24 hours
✅ They'll design a complete system with CAD layouts and specifications
✅ You'll receive a detailed proposal via email within 24-48 hours
✅ The specialist will be available for a call to discuss the design

You'll receive a confirmation email at customer@example.com with your reference code.

Is there anything else you'd like me to note for the specialist team?"
```

## Edge Cases

### Edge Case 1: 2 Zones + Complexity

```
Message: "Living room Dolby Atmos + bedroom speakers, budget R95k"
Analysis:
  - Zones: 2 (20 pts)
  - Budget: R95,000 (0 pts, below R150k threshold)
  - Complex keywords: Dolby Atmos (20 pts)
  - Total score: 40 pts
Decision: ✅ AI handles (below 50pt threshold, not 3+ zones, not high budget)
```

### Edge Case 2: High Budget at Threshold

```
Message: "Looking for premium home theater, budget is R150000"
Analysis:
  - Zones: 1 (0 pts)
  - Budget: R150,000 (30 pts)
  - isHighBudget: true (≥ R150,000)
Decision: ⚠️ Escalate (high budget threshold met)
```

### Edge Case 3: Uncertainty Only

```
Message: "Not sure what I need, small apartment"
Analysis:
  - Zones: 1 (0 pts)
  - Uncertainty: true (20 pts)
  - "small apartment" → implies single space, not multi-zone
  - Total score: 20 pts
Decision: ✅ AI handles (uncertainty alone doesn't trigger escalation)
```

### Edge Case 4: Uncertainty + Large Property

```
Message: "Not sure what I need, large house, good budget available"
Analysis:
  - Zones: 1 (0 pts)
  - Multi-zone keywords: "large house" (50 pts)
  - Uncertainty: true (20 pts)
  - Total score: 70 pts
Decision: ⚠️ Escalate (multi-zone keywords + uncertainty suggests complexity)
```

## Testing & Validation

### Test Coverage

**23/23 Complexity Detector Tests** ✅
- Simple projects (5 tests)
- Multi-zone projects (6 tests)
- High budget projects (3 tests)
- Complex requirements (3 tests)
- Customer uncertainty (3 tests)
- Edge cases (3 tests)

**28/28 Consultation Manager Tests** ✅
- Reference code generation
- CRUD operations
- Database persistence
- Status management

### False Positive Rate

Target: < 10% (no more than 1 in 10 simple projects escalated incorrectly)

**Strategy:**
- Conservative scoring (50pt threshold)
- Multiple factors must align for low-zone escalation
- 2 zones = 20pts (needs 30pts more to trigger)
- Single zone needs either high budget OR multi-zone keywords to escalate

### False Negative Rate

Target: < 5% (no more than 1 in 20 complex projects missed)

**Strategy:**
- Any single major factor triggers escalation (3+ zones, R150k+)
- Multi-zone keywords override explicit count
- "Large house" + uncertainty = escalation
- Better to over-escalate than provide poor recommendations

## Implementation Files

| File | Purpose |
|------|---------|
| [complexity-detector.ts](src/lib/ai/complexity-detector.ts) | Core scoring algorithm |
| [system-prompts.ts](src/lib/ai/system-prompts.ts) | AI escalation guidance |
| [claude-handler.ts](src/lib/ai/claude-handler.ts) | Complexity detection integration |
| [tools.ts](src/lib/ai/tools.ts) | `create_consultation_request` tool |
| [consultation-request-manager.ts](src/lib/ai/consultation-request-manager.ts) | Request management |
| [test-complexity-detector.ts](scripts/test-complexity-detector.ts) | Test suite |

## Monitoring & Metrics

### Key Metrics to Track

1. **Escalation Rate**: 15-25% of inquiries (target)
2. **Simple Quote Success**: 90%+ completion without escalation
3. **Information Completeness**: 95%+ of escalations have all required fields
4. **Specialist Satisfaction**: Quality of requirements gathered
5. **Customer Satisfaction**: NPS for escalated vs non-escalated
6. **False Positive Rate**: < 10%
7. **False Negative Rate**: < 5%

### Logging

Every first message logs:
```
[ClaudeHandler] 🔍 Complexity Analysis:
Complexity Score: 80/100
Zones: 4
Budget: R300 000
Decision: ⚠️ ESCALATE TO SPECIALIST

Reasons:
  - 4 zones detected (multi-zone project)
  - High budget detected (R300 000)
```

## Future Enhancements

### Phase 1 (Completed) ✅
- ✅ Complexity scoring algorithm
- ✅ Automatic detection on first message
- ✅ AI prompt integration
- ✅ Consultation request creation
- ✅ Information gathering workflow

### Phase 2 (Planned)
- [ ] Email notifications to sales team
- [ ] Customer confirmation emails
- [ ] Admin panel for consultants
- [ ] Status tracking and updates
- [ ] Quote linking (consultation → final quote)

### Phase 3 (Future)
- [ ] Machine learning refinement
- [ ] Historical data analysis
- [ ] Complexity score tuning based on outcomes
- [ ] Customer feedback integration
- [ ] Specialist workload balancing

## Troubleshooting

### Issue: Simple project escalated incorrectly

**Diagnostic:**
1. Check complexity analysis logs
2. Review which factor triggered escalation
3. Verify keyword patterns aren't too aggressive

**Solution:**
- Adjust scoring thresholds
- Refine keyword patterns
- Add negative keywords (e.g., "single room" overrides "large")

### Issue: Complex project not escalated

**Diagnostic:**
1. Check if message matches patterns
2. Verify zone count detection
3. Review budget extraction

**Solution:**
- Add missing keywords
- Improve pattern matching
- Lower threshold if consistently missing projects

### Issue: Poor information gathering

**Diagnostic:**
1. Review conversation transcripts
2. Check which fields are missing
3. Verify AI is using escalation prompts

**Solution:**
- Enhance system prompts
- Add more specific question templates
- Improve context injection

## Conclusion

The escalation decision logic balances automation and quality:

✅ **Simple projects** (80%): AI handles autonomously, fast quotes
⚠️ **Complex projects** (20%): Specialist consultation, premium service

This ensures customers get the right solution with the right level of expertise, maximizing satisfaction while optimizing resources.
