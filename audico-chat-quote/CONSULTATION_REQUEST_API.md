# Consultation Request API Documentation

## Overview

The Consultation Request system handles complex audio projects that require specialist attention. This system implements the AI Triage & Specialist Escalation strategy defined in CHAT_QUOTE_PLAN_X7.

## Database Schema

### Table: `consultation_requests`

```sql
CREATE TABLE consultation_requests (
  -- Primary identification
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_code TEXT UNIQUE NOT NULL,  -- "CQ-20250126-001" format
  session_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Customer Information
  customer_name TEXT,
  customer_email TEXT NOT NULL,
  customer_phone TEXT,
  company_name TEXT,

  -- Project Details
  project_type TEXT NOT NULL CHECK (project_type IN (
    'residential_multi_zone',
    'commercial',
    'home_cinema_premium',
    'whole_home_audio',
    'other'
  )),
  budget_total NUMERIC NOT NULL,
  timeline TEXT,
  zones JSONB NOT NULL DEFAULT '[]',  -- Array of zone objects

  -- Requirements
  requirements_summary TEXT NOT NULL,
  technical_notes TEXT,
  existing_equipment TEXT,

  -- Metrics
  complexity_score INTEGER,
  zone_count INTEGER,

  -- Status & Assignment
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending',
    'in_progress',
    'completed',
    'cancelled'
  )),
  assigned_to TEXT,
  assigned_at TIMESTAMPTZ,
  quote_id UUID REFERENCES quotes(id) ON DELETE SET NULL,
  notes TEXT,
  priority TEXT DEFAULT 'normal' CHECK (priority IN (
    'low',
    'normal',
    'high',
    'urgent'
  ))
);
```

### Indexes

- `idx_consultation_requests_session` - Fast lookup by session ID
- `idx_consultation_requests_reference` - Fast lookup by reference code
- `idx_consultation_requests_status` - Filter by status
- `idx_consultation_requests_created` - Sort by creation date
- `idx_consultation_requests_assigned` - Filter by assigned specialist
- `idx_consultation_requests_priority` - Filter by priority and status

## TypeScript Types

### Core Types

```typescript
// Project types
type ConsultationProjectType =
  | "residential_multi_zone"
  | "commercial"
  | "home_cinema_premium"
  | "whole_home_audio"
  | "other";

// Status lifecycle
type ConsultationStatus = "pending" | "in_progress" | "completed" | "cancelled";

// Priority levels
type ConsultationPriority = "low" | "normal" | "high" | "urgent";

// Zone definition
interface ConsultationZone {
  name: string;              // "Main Cinema", "Kitchen"
  location: string;          // "Basement", "Ground Floor"
  dimensions?: {             // Optional room dimensions
    length?: number;         // meters
    width?: number;          // meters
    height?: number;         // meters
  };
  useCase: string;           // "Home cinema", "Background music"
  ceilingType?: string;      // "drywall", "concrete", "suspended"
  budgetAllocation?: number; // Rand allocation for this zone
  notes?: string;            // Additional notes
}

// Main consultation request object
interface ConsultationRequest {
  // Identification
  id: string;
  referenceCode: string;     // "CQ-YYYYMMDD-XXX"
  sessionId: string;
  createdAt: string;
  updatedAt: string;

  // Customer info
  customerName?: string;
  customerEmail: string;
  customerPhone?: string;
  companyName?: string;

  // Project details
  projectType: ConsultationProjectType;
  budgetTotal: number;
  timeline?: string;
  zones: ConsultationZone[];

  // Requirements
  requirementsSummary: string;
  technicalNotes?: string;
  existingEquipment?: string;

  // Metrics
  complexityScore?: number;  // 0-100
  zoneCount?: number;

  // Status
  status: ConsultationStatus;
  assignedTo?: string;
  assignedAt?: string;
  quoteId?: string;
  notes?: string;
  priority: ConsultationPriority;
}
```

### Input/Output Types

```typescript
// Creating a new consultation request
interface CreateConsultationRequestData {
  sessionId: string;
  customerEmail: string;          // Required
  customerName?: string;
  customerPhone?: string;
  companyName?: string;
  projectType: ConsultationProjectType;  // Required
  budgetTotal: number;            // Required
  timeline?: string;
  zones: ConsultationZone[];      // Required, min 1
  requirementsSummary: string;    // Required, min 10 chars
  technicalNotes?: string;
  existingEquipment?: string;
  complexityScore?: number;
  priority?: ConsultationPriority;
}

// Updating an existing consultation request
interface UpdateConsultationRequestData {
  status?: ConsultationStatus;
  assignedTo?: string;
  quoteId?: string;
  notes?: string;
  priority?: ConsultationPriority;
  technicalNotes?: string;
}
```

## ConsultationRequestManager API

### Methods

#### `createRequest(data: CreateConsultationRequestData): Promise<ConsultationRequest>`

Creates a new consultation request with auto-generated reference code.

**Parameters:**
- `data` - Consultation request data (see `CreateConsultationRequestData`)

**Returns:** Complete consultation request object

**Throws:** Error if required fields are missing or invalid

**Example:**
```typescript
import { consultationRequestManager } from "@/lib/ai/consultation-request-manager";

const request = await consultationRequestManager.createRequest({
  sessionId: "session_123",
  customerEmail: "john@example.com",
  customerName: "John Smith",
  projectType: "residential_multi_zone",
  budgetTotal: 300000,
  zones: [
    {
      name: "Main Cinema",
      location: "Basement",
      useCase: "Dolby Atmos home theater",
      budgetAllocation: 200000,
    },
    {
      name: "Kitchen",
      location: "Ground Floor",
      useCase: "Background music",
      budgetAllocation: 50000,
    },
  ],
  requirementsSummary: "Multi-zone audio with premium home cinema",
  complexityScore: 75,
});

console.log(request.referenceCode); // "CQ-20250126-001"
```

#### `getRequest(requestId: string): Promise<ConsultationRequest | undefined>`

Retrieves a consultation request by ID. Uses in-memory cache for performance.

**Parameters:**
- `requestId` - UUID of the consultation request

**Returns:** Consultation request object or undefined if not found

**Example:**
```typescript
const request = await consultationRequestManager.getRequest("uuid-here");
if (request) {
  console.log(request.customerEmail);
}
```

#### `getRequestByReference(referenceCode: string): Promise<ConsultationRequest | undefined>`

Retrieves a consultation request by reference code (e.g., "CQ-20250126-001").

**Parameters:**
- `referenceCode` - Human-readable reference code

**Returns:** Consultation request object or undefined if not found

**Example:**
```typescript
const request = await consultationRequestManager.getRequestByReference("CQ-20250126-001");
```

#### `updateRequest(requestId: string, updates: UpdateConsultationRequestData): Promise<ConsultationRequest>`

Updates an existing consultation request.

**Parameters:**
- `requestId` - UUID of the consultation request
- `updates` - Fields to update (see `UpdateConsultationRequestData`)

**Returns:** Updated consultation request object

**Throws:** Error if request not found

**Example:**
```typescript
const updated = await consultationRequestManager.updateRequest("uuid-here", {
  status: "in_progress",
  assignedTo: "specialist@audico.co.za",
  priority: "high",
  notes: "Customer needs quote by Friday",
});
```

#### `listBySession(sessionId: string): Promise<ConsultationRequest[]>`

Lists all consultation requests for a given session.

**Parameters:**
- `sessionId` - Session ID to filter by

**Returns:** Array of consultation requests (ordered by creation date, newest first)

**Example:**
```typescript
const requests = await consultationRequestManager.listBySession("session_123");
console.log(`Found ${requests.length} consultation requests`);
```

#### `listByStatus(status: string): Promise<ConsultationRequest[]>`

Lists all consultation requests with a given status.

**Parameters:**
- `status` - Status to filter by ("pending", "in_progress", "completed", "cancelled")

**Returns:** Array of consultation requests (ordered by creation date, newest first)

**Example:**
```typescript
const pending = await consultationRequestManager.listByStatus("pending");
const inProgress = await consultationRequestManager.listByStatus("in_progress");
```

## AI Tool Integration

### Tool Definition

The `create_consultation_request` tool is defined in `src/lib/ai/tools.ts`:

```typescript
{
  name: "create_consultation_request",
  description: "Create a consultation request for complex audio projects...",
  input_schema: {
    type: "object",
    properties: {
      customer_email: { type: "string" },      // Required
      customer_name: { type: "string" },
      customer_phone: { type: "string" },
      company_name: { type: "string" },
      project_type: {                          // Required
        type: "string",
        enum: ["residential_multi_zone", "commercial", "home_cinema_premium", "whole_home_audio", "other"]
      },
      budget_total: { type: "number" },        // Required
      timeline: { type: "string" },
      zones: {                                 // Required, array
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            location: { type: "string" },
            dimensions: { type: "object" },
            use_case: { type: "string" },
            ceiling_type: { type: "string" },
            budget_allocation: { type: "number" },
            notes: { type: "string" }
          },
          required: ["name", "location", "use_case"]
        }
      },
      requirements_summary: { type: "string" }, // Required, min 10 chars
      technical_notes: { type: "string" },
      existing_equipment: { type: "string" },
      complexity_score: { type: "number" },
      priority: {
        type: "string",
        enum: ["low", "normal", "high", "urgent"]
      }
    },
    required: ["customer_email", "project_type", "budget_total", "zones", "requirements_summary"]
  }
}
```

### When AI Should Use This Tool

The AI should create a consultation request when it detects:

1. **Multi-Zone Projects (3+ zones)**
   - Whole-home audio
   - Multiple rooms/areas
   - Distributed audio systems

2. **High Budget (R150,000+)**
   - Premium equipment
   - Custom integration
   - Professional design needed

3. **Complex Requirements**
   - Dolby Atmos + distributed audio + outdoor
   - Commercial installations
   - Integration with existing systems
   - Architectural constraints

4. **Uncertain Customer**
   - "I don't know what I need"
   - Multiple conflicting requirements
   - Budget unclear

5. **Special Use Cases**
   - Worship venues
   - Large commercial spaces
   - Custom home theaters

## Reference Code Format

### Format: `CQ-YYYYMMDD-XXX`

- **CQ** - Consultation Quote prefix
- **YYYYMMDD** - Date (e.g., 20250126)
- **XXX** - Sequential number for that day (001, 002, etc.)

### Utility Functions

```typescript
// Generate reference code
import { generateConsultationReferenceCode } from "@/lib/utils";

const code = generateConsultationReferenceCode(0);  // First of the day
// Returns: "CQ-20250126-001"

const code2 = generateConsultationReferenceCode(5); // 6th of the day
// Returns: "CQ-20250126-006"

// Parse reference code
import { parseConsultationReferenceCode } from "@/lib/utils";

const parsed = parseConsultationReferenceCode("CQ-20250126-001");
// Returns: { date: Date(2025-01-26), sequence: 1 }

const invalid = parseConsultationReferenceCode("INVALID");
// Returns: null
```

## Workflow Example

### AI Detects Complex Project

```typescript
// 1. AI detects multi-zone project during conversation
// Complexity score: 75 (3 zones, R300k budget)

// 2. AI gathers information from customer
const zones = [
  { name: "Main Cinema", location: "Basement", useCase: "Dolby Atmos" },
  { name: "Kitchen", location: "Ground Floor", useCase: "Background music" },
  { name: "Patio", location: "Outdoor", useCase: "Entertaining" },
];

// 3. AI creates consultation request via tool
const request = await consultationRequestManager.createRequest({
  sessionId: context.sessionId,
  customerEmail: "customer@example.com",
  customerName: "John Smith",
  projectType: "residential_multi_zone",
  budgetTotal: 300000,
  zones,
  requirementsSummary: "Multi-zone audio system with Dolby Atmos cinema, kitchen, and outdoor",
  complexityScore: 75,
  priority: "normal",
});

// 4. AI provides reference code to customer
console.log(`Your consultation reference: ${request.referenceCode}`);
// "Your consultation reference: CQ-20250126-001"
```

### Specialist Reviews and Assigns

```typescript
// 5. Specialist views pending consultations
const pending = await consultationRequestManager.listByStatus("pending");

// 6. Specialist reviews request
const request = await consultationRequestManager.getRequestByReference("CQ-20250126-001");

// 7. Specialist assigns to themselves
const updated = await consultationRequestManager.updateRequest(request.id, {
  status: "in_progress",
  assignedTo: "specialist@audico.co.za",
  notes: "Reviewed requirements. Will prepare CAD layouts and quote.",
  priority: "high",
});
```

### Specialist Completes Quote

```typescript
// 8. Specialist creates professional quote
// ... quote creation logic ...

// 9. Link quote to consultation request
await consultationRequestManager.updateRequest(request.id, {
  status: "completed",
  quoteId: "quote-uuid-here",
  notes: "Quote sent to customer. CAD layouts included.",
});
```

## Testing

### Unit Tests

Run reference code generator tests:
```bash
tsx scripts/test-reference-code.ts
```

### Integration Tests

Run consultation manager tests (requires database migration):
```bash
tsx scripts/test-consultation-manager.ts
```

## Migration

Apply the database migration:

1. Open Supabase SQL Editor
2. Run `supabase/migrations/005_consultation_requests.sql`
3. Verify table creation with:
   ```sql
   SELECT * FROM consultation_requests LIMIT 1;
   ```

## Next Steps (Week 2)

1. Integrate tool handler in `claude-handler.ts`
2. Implement complexity detection algorithm
3. Update system prompts with escalation messaging
4. Add AI workflow for information gathering
5. Test end-to-end escalation flow

## Related Files

- Database: `supabase/migrations/005_consultation_requests.sql`
- Manager: `src/lib/ai/consultation-request-manager.ts`
- Types: `src/lib/types.ts`
- Supabase Types: `src/lib/supabase.ts`
- Utils: `src/lib/utils.ts` (reference code generator)
- AI Tools: `src/lib/ai/tools.ts`
- Tests: `scripts/test-reference-code.ts`, `scripts/test-consultation-manager.ts`
- Plan: `CHAT_QUOTE_PLAN_X7.md`

## Support

For questions or issues:
- Review `CHAT_QUOTE_PLAN_X7.md` for context
- Check migration file for database schema
- Run tests to verify functionality
- Consult TypeScript types for API contracts
