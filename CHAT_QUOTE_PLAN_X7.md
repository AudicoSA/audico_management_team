# CHAT_QUOTE_PLAN_X7: AI Triage & Specialist Escalation System

## Executive Summary

**The Problem**: Complex multi-zone audio projects (5+ zones, R200k+ budgets) exceed AI capabilities, resulting in:
- Poor product recommendations (wall mounts for bedroom speakers)
- Inappropriate selections (R40k THX speakers for bedrooms)
- Confused multi-zone planning (discovering zones one-by-one)
- Token waste and customer frustration

**The Solution**: Implement intelligent triage system where:
- AI handles simple, single-zone quotes autonomously (80% of inquiries)
- AI detects complex projects and escalates to specialist consultants (20% of inquiries)
- AI acts as intake specialist for complex projects, gathering structured requirements
- Specialists receive detailed briefs and create professional proposals

**Business Impact**:
- ✅ Better customer experience (right solution, right person)
- ✅ Reduced token waste on complex conversations
- ✅ Specialists focus on high-value projects
- ✅ AI handles volume efficiently
- ✅ No bad recommendations damaging trust

---

## Complexity Detection Criteria

### **SIMPLE QUOTES** (AI Handles Solo)

AI provides full quote autonomously when ALL these conditions are met:

1. **Single Zone/Room**
   - TV lounge soundbar
   - Conference room video bar
   - Single home cinema system
   - One office/retail space

2. **Budget < R100,000**
   - Modest investment
   - Standard product selection
   - No custom integration

3. **Clear Requirements**
   - Customer knows what they want
   - Standard use case (cinema, conference, background music)
   - No unusual constraints

4. **Standard Products**
   - Off-the-shelf solutions
   - No custom installation complexity
   - No architectural considerations

**Examples**:
- "Need soundbar for TV lounge, budget R30k"
- "Conference room video bar for 8 people"
- "5.1 home cinema system, budget R80k"
- "Background music for small restaurant"

---

### **COMPLEX PROJECTS** (Escalate to Specialist)

AI escalates when ANY of these conditions are met:

1. **Multi-Zone (3+ Zones)**
   - Whole-home audio
   - Multiple rooms/areas
   - Distributed audio systems
   - Requires zone coordination

2. **High Budget (R150,000+)**
   - Premium equipment
   - Custom integration
   - Installation complexity
   - Professional design needed

3. **Complex Requirements**
   - Dolby Atmos + distributed audio + outdoor
   - Commercial installations
   - Integration with existing systems
   - Architectural/wiring constraints

4. **Uncertain Customer**
   - "I don't know what I need"
   - Multiple conflicting requirements
   - Needs consultation/advice
   - Budget unclear

5. **Special Use Cases**
   - Worship venues
   - Large commercial spaces
   - Outdoor stadiums/events
   - Custom home theaters

**Examples**:
- "5.1 cinema + 4 other zones, budget R300k" ⚠️
- "Whole home audio, 8 zones" ⚠️
- "Corporate headquarters, multiple conference rooms" ⚠️
- "Restaurant + bar + patio, need zoned control" ⚠️
- "Not sure what I need, large house" ⚠️

---

## System Architecture

### **Phase 1: Detection**

AI analyzes initial message for complexity indicators:

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
```

**Scoring Logic**:
- 1 zone = 0 points
- 2 zones = 20 points
- 3+ zones = 50 points ⚠️
- Budget R150k+ = 30 points ⚠️
- Complex keywords = 20 points
- Customer uncertain = 20 points
- **Threshold: 50+ points = ESCALATE**

---

### **Phase 2: Escalation Response**

When complexity score ≥ 50, AI responds:

```
"This is a comprehensive [multi-zone/high-value/custom] audio project that will
benefit from our specialist team. They'll design the optimal system with professional
CAD layouts, detailed specifications, and installation planning.

Let me capture your requirements, and we'll have an AV specialist create a detailed
proposal within 24-48 hours. This ensures you get the best system design for your
investment.

Can I ask you some questions about your project?"
```

**Key Messaging**:
- ✅ Honest about complexity
- ✅ Positions specialist as benefit (not failure)
- ✅ Sets expectation (24-48 hours)
- ✅ Still provides immediate value (requirement capture)

---

### **Phase 3: Structured Information Gathering**

AI asks targeted questions to build comprehensive brief:

#### **Core Questions**

1. **Contact Information**
   - Name
   - Email
   - Phone
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
   - Control preferences (app, wall panels, etc.)
   - Special constraints

5. **Additional Context**
   - Why now? (renovation, new build, upgrade)
   - Installer preference (DIY vs professional)
   - Brands/preferences
   - Any other details

---

### **Phase 4: Save Consultation Request**

AI calls new tool: `create_consultation_request`

**Tool Definition**:
```typescript
{
  name: "create_consultation_request",
  description: "Save complex project requirements for specialist review",
  input_schema: {
    type: "object",
    properties: {
      customer_name: { type: "string" },
      customer_email: { type: "string" },
      customer_phone: { type: "string" },
      company_name: { type: "string" },
      project_type: {
        type: "string",
        enum: ["residential_multi_zone", "commercial", "home_cinema_premium", "whole_home_audio", "other"]
      },
      budget_total: { type: "number" },
      zones: { type: "array" },
      requirements_summary: { type: "string" },
      technical_notes: { type: "string" },
      timeline: { type: "string" },
      complexity_score: { type: "number" }
    },
    required: ["customer_email", "project_type", "budget_total", "zones", "requirements_summary"]
  }
}
```

---

### **Phase 5: Confirmation & Handoff**

AI provides confirmation with reference number and next steps.

---

## Database Schema

```sql
CREATE TABLE consultation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_code TEXT UNIQUE NOT NULL,  -- "CQ-20250126-001"
  session_id TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Customer Info
  customer_name TEXT,
  customer_email TEXT NOT NULL,
  customer_phone TEXT,
  company_name TEXT,

  -- Project Details
  project_type TEXT NOT NULL,
  budget_total NUMERIC NOT NULL,
  timeline TEXT,
  zones JSONB NOT NULL,

  -- Requirements
  requirements_summary TEXT NOT NULL,
  technical_notes TEXT,
  existing_equipment TEXT,

  -- Metrics
  complexity_score INTEGER,
  zone_count INTEGER,

  -- Status & Assignment
  status TEXT DEFAULT 'pending',
  assigned_to TEXT,
  assigned_at TIMESTAMP,
  quote_id UUID REFERENCES quotes(id),
  notes TEXT,
  priority TEXT DEFAULT 'normal'
);
```

---

## Implementation Phases

### **Phase A: Backend Foundation** (4-6 hours)
- Database table
- Reference code generator
- Consultation Request Manager
- Tool definition

### **Phase B: AI Integration** (3-4 hours)
- Complexity detector
- System prompt updates
- Route integration
- Tool handler

### **Phase C: Frontend Updates** (2-3 hours)
- Escalation status display
- API response updates

### **Phase D: Admin Panel** (4-6 hours)
- List view for consultants
- Detail view with full requirements
- Status management
- API endpoints

### **Phase E: Email Notifications** (2-3 hours)
- Sales team notifications
- Customer confirmations
- Status updates

---

## Success Metrics

1. **Escalation Rate**: 15-25% of inquiries
2. **Simple Quote Success**: 90%+ completion
3. **Consultant Efficiency**: Time saved per consultation
4. **Customer Satisfaction**: NPS for escalated vs non-escalated
5. **Token Cost Reduction**: 30-40% on complex conversations

---

## Rollout Plan

### **Week 1: Backend Foundation** ✅ COMPLETE (Phase A)

**Goal**: Build database infrastructure and core business logic

- [x] Create consultation_requests database table with all required fields
- [x] Implement reference code generator (CQ-YYYYMMDD-XXX format)
- [x] Build ConsultationRequestManager class with CRUD operations
- [x] Define create_consultation_request tool schema
- [x] Write unit tests for reference code generation (27/27 passed)
- [x] Write unit tests for ConsultationRequestManager (28/28 passed)
- [x] Create database migration files
- [x] Document API contracts and data structures

**Deliverable**: ✅ Working backend that can save and retrieve consultation requests

---

### **Week 2: AI Integration** (Phase B)

**Goal**: Enable AI to detect complexity and escalate appropriately

- [ ] Implement complexity scoring algorithm
- [ ] Create complexity detector utility with test cases
- [ ] Update system prompts with escalation messaging
- [ ] Add complexity detection to chat route
- [ ] Implement create_consultation_request tool handler
- [ ] Add structured information gathering prompts
- [ ] Test escalation flow end-to-end with various scenarios
- [ ] Validate AI correctly gathers all required information
- [ ] Test simple vs complex project differentiation
- [ ] Document escalation decision logic

**Deliverable**: AI can detect complex projects and gather requirements

---

### **Week 3: Frontend & Admin Panel** (Phases C & D)

**Goal**: Build user-facing updates and consultant dashboard

**Frontend Updates (2-3 hours):**

- [ ] Add escalation status indicator to chat UI
- [ ] Display reference code when consultation is created
- [ ] Update API response handling for escalation scenarios
- [ ] Add loading states for consultation creation
- [ ] Test UI with both simple and escalated conversations

**Admin Panel (4-6 hours):**

- [ ] Create consultation requests list view (table with filters)
- [ ] Build detail view showing full customer requirements
- [ ] Add status management (pending → in-progress → completed)
- [ ] Implement assignment functionality (assign to specialist)
- [ ] Add priority flagging
- [ ] Create API endpoints: GET /consultations, GET /consultations/:id, PATCH /consultations/:id
- [ ] Add search and filter capabilities (by status, date, budget)
- [ ] Test admin workflows thoroughly

**Deliverable**: Complete UI for customers and internal team

---

### **Week 4: Notifications & Polish** (Phase E + Testing)

**Goal**: Complete the feedback loop and prepare for launch

**Email Notifications (2-3 hours):**

- [ ] Design email templates (sales notification, customer confirmation)
- [ ] Implement sales team notification on new consultation
- [ ] Implement customer confirmation email with reference code
- [ ] Add status update notifications
- [ ] Test all email scenarios
- [ ] Configure email settings in environment

**Polish & Testing:**

- [ ] End-to-end testing: simple quote flow
- [ ] End-to-end testing: escalation flow
- [ ] Edge case testing (incomplete info, invalid data)
- [ ] Performance testing (database queries, API response times)
- [ ] Security review (input validation, authentication)
- [ ] Review all user-facing messaging
- [ ] Create internal documentation for sales team
- [ ] Set up monitoring/logging for escalations

**Deliverable**: Production-ready system with all integrations

---

### **Week 5: Pilot Launch & Monitoring**

**Goal**: Deploy to production and gather initial feedback

- [ ] Deploy to production environment
- [ ] Monitor first 10 conversations closely
- [ ] Track escalation rate (target: 15-25%)
- [ ] Collect feedback from sales team on consultation briefs
- [ ] Check email deliverability and formatting
- [ ] Verify database performance under real load
- [ ] Document any issues or unexpected behaviors
- [ ] Quick fixes for critical issues
- [ ] Begin tracking success metrics

**Deliverable**: Live system handling real customer inquiries

---

### **Week 6: Optimization & Iteration**

**Goal**: Refine based on real-world data

- [ ] Review escalation accuracy (false positives/negatives)
- [ ] Analyze customer feedback and satisfaction
- [ ] Tune complexity scoring thresholds if needed
- [ ] Improve AI prompts based on actual conversations
- [ ] Optimize information gathering flow
- [ ] Enhance admin panel based on consultant feedback
- [ ] Update documentation with learnings
- [ ] Create final metrics report
- [ ] Plan next iteration improvements

**Deliverable**: Optimized system ready for full rollout

---

## Success Metrics (Track Weekly)

1. **Escalation Rate**: 15-25% of inquiries *(Target)*
2. **Simple Quote Success**: 90%+ completion without escalation *(Target)*
3. **Information Completeness**: 95%+ of escalations have all required fields *(Target)*
4. **Response Time**: Consultations acknowledged within 4 hours *(Target)*
5. **Customer Satisfaction**: Track feedback on escalated vs non-escalated
6. **Token Cost Reduction**: 30-40% on complex conversations *(Target)*

**Total Estimated Time**: 15-20 hours of development + 2 weeks monitoring/optimization

---

## Key Insight

**AI doesn't need to be perfect at everything. It needs to be honest about its limits and orchestrate the right resources for each customer.**

This is how real sales teams work. This is how AI should work too.
