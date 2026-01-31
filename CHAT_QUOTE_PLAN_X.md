# CHAT QUOTE PLAN X - Complete Rebuild

## The Truth

After 14 months, the current system is fundamentally broken because it was built on wrong assumptions:

1. **AI cannot track state** - GPT forgets, hallucinates, ignores instructions
2. **AI cannot make decisions** - It will search for wrong products, skip steps, repeat steps
3. **Complexity breeds bugs** - 10+ steps, 2 zones, follow-up messages, brand tracking = chaos
4. **"Smart" features fail** - Package detection, quantity inference, brand matching = unreliable

## The Solution: Dumb It Down

The new system must be **deterministic**, **simple**, and **AI-minimal**.

---

## Single Entry Point → AI Routes to Flow

**ONE chat interface.** User starts talking. AI detects intent and routes to the correct vertical.

```
┌─────────────────────────────────────────────────────────────────┐
│                     UNIFIED CHAT ENTRY                           │
│                                                                  │
│  "Hi! I'm your Audico assistant. How can I help today?"         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     AI INTENT DETECTION                          │
│                                                                  │
│  User: "I need a 7.1 home cinema"                               │
│        → Routes to: SYSTEM DESIGN (home_cinema_7_1)             │
│                                                                  │
│  User: "Background music for my restaurant"                     │
│        → Routes to: SYSTEM DESIGN (commercial_bgm)              │
│                                                                  │
│  User: "Price on a Denon X2800H?"                               │
│        → Routes to: SIMPLE QUOTE                                │
│                                                                  │
│  User: "I have a tender document to quote"                      │
│        → Routes to: TENDER QUOTE                                │
│                                                                  │
│  User: "I need to replace my JBL speaker for insurance"         │
│        → Routes to: SIMPLE QUOTE                                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
      ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
      │   SYSTEM    │ │   SIMPLE    │ │   TENDER    │
      │   DESIGN    │ │   QUOTE     │ │   QUOTE     │
      │   FLOW      │ │   FLOW      │ │   FLOW      │
      └─────────────┘ └─────────────┘ └─────────────┘
```

---

## The Three Flows

### Flow 1: System Design

**Triggers**: "home cinema", "surround sound", "restaurant audio", "gym speakers", "church PA", "background music", "distributed audio", or any system-level request

**Supported Verticals** (AI auto-detects from conversation):

| Vertical | Trigger Words | Component Flow |
|----------|--------------|----------------|
| Home Cinema 5.1 | "5.1", "surround", "lounge" | AVR → Fronts → Center → Surrounds → Sub |
| Home Cinema 7.1 | "7.1", "cinema room", "atmos" | AVR → Fronts → Center → Surrounds (4) → Sub |
| Commercial BGM | "restaurant", "cafe", "retail", "background" | Amp → Ceiling speakers → Source |
| Gym/Club | "gym", "club", "loud", "dance" | Power amp → PA speakers → Sub → Source |
| Worship | "church", "worship", "hall" | Mixer → Mains → Monitors → Mics |
| Education | "classroom", "lecture", "school" | Amp → Ceiling/Wall → Wireless mic |

### Flow 2: Simple Quote

**Triggers**: "price on", "how much", "quote for", "insurance claim", "need to replace", "buy", "purchase", specific product names/SKUs

**Use cases**:

- Insurance replacement quotes
- EFT payment for known products
- Quick price lookups

### Flow 3: Tender Quote

**Triggers**: "tender", "upload", "document", "spec sheet", "RFQ", "bid"

**Features**:

- Parse uploaded tender documents (PDF/Excel/Word)
- Extract product specifications and quantities
- Match to inventory with alternatives
- Generate formal compliant quote

---

## Flow Details

### System Design Flow

```
AI routes user to System Design
        │
        ▼
┌─────────────────────────────────────────┐
│  DISCOVERY PHASE                         │
│  AI asks max 3 questions:                │
│  1. What type? (home cinema/commercial)  │
│  2. Budget?                              │
│  3. Room details?                        │
│                                          │
│  Backend auto-detects scenario:          │
│  - "7.1 home cinema" → home_cinema_7_1   │
│  - "restaurant BGM" → commercial_bgm     │
│  - "gym speakers" → commercial_loud      │
└─────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────┐
│  COMPONENT SELECTION PHASE               │
│  Backend controls step progression       │
│  Shows products for each component       │
│  User clicks to select                   │
│  Packages auto-skip covered components   │
└─────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────┐
│  QUOTE GENERATION                        │
│  Summary of selected products            │
│  Total price                             │
│  Generate PDF / Send to email            │
└─────────────────────────────────────────┘
```

### Simple Quote Flow

```
AI routes user to Simple Quote
        │
        ▼
┌─────────────────────────────────────────┐
│  SEARCH MODE (No discovery)              │
│                                          │
│  User: "Denon X2800H"                    │
│  System: Shows matching products         │
│  User: Clicks "Add to Quote"             │
│                                          │
│  User: "2x JBL Flip 6"                   │
│  System: Shows JBL Flip 6, qty 2         │
│  User: Clicks "Add to Quote"             │
│                                          │
│  User: "Generate quote"                  │
│  System: Creates quote with all items    │
└─────────────────────────────────────────┘
```

**Simple Quote Features:**

- No discovery questions
- Direct product search
- Quantity parsing from input ("2x", "pair of", "3 units")
- Running total visible
- One-click quote generation

### Tender Quote Flow

```
AI routes user to Tender Quote (or user uploads document)
        │
        ▼
┌─────────────────────────────────────────┐
│  UPLOAD PHASE                            │
│  User uploads: PDF, Excel, Word, Image   │
│  AI extracts:                            │
│  - Product specifications                │
│  - Required quantities                   │
│  - Brand preferences                     │
│  - Budget constraints                    │
└─────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────┐
│  MATCHING PHASE                          │
│  System searches for each line item      │
│  Shows best matches with alternatives    │
│  User confirms/swaps products            │
└─────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────┐
│  FORMAL QUOTE GENERATION                 │
│  Professional tender response format     │
│  Includes compliance statements          │
│  PDF with company letterhead             │
└─────────────────────────────────────────┘
```

---

## Core Principles

### 1. AI Does ONE Thing: Talk
- AI generates friendly text responses
- AI does NOT decide what products to show
- AI does NOT track what was added
- AI does NOT choose next steps

### 2. Backend Controls Everything
- Backend decides which component is next
- Backend searches for products
- Backend tracks quote state
- Backend validates selections

### 3. Single Source of Truth
- ONE quote object on backend
- ONE step counter
- NO frontend state that matters
- NO AI memory required

### 4. Minimal Steps
- 7.1 system = exactly 5 steps (AVR, Fronts, Center, Surrounds, Sub)
- NO splitting into zones
- NO duplicate steps
- Packages auto-complete multiple steps

---

## New Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
│  - Displays messages and product cards                          │
│  - Sends: "start quote" / "select product X" / "user typed Y"   │
│  - Receives: { message, products[], currentStep, totalSteps }   │
│  - NO STATE MANAGEMENT (except display)                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    API: /api/quote                               │
│                                                                  │
│  POST /api/quote/start                                          │
│    Input: { requirements }                                       │
│    Output: { quoteId, step1Products, message }                  │
│                                                                  │
│  POST /api/quote/select                                         │
│    Input: { quoteId, productId }                                │
│    Output: { nextStepProducts, message, quoteState }            │
│                                                                  │
│  POST /api/quote/chat                                           │
│    Input: { quoteId, userMessage }                              │
│    Output: { aiResponse }  (for questions only)                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    QUOTE ENGINE (lib/quote-engine.ts)           │
│                                                                  │
│  class QuoteEngine {                                            │
│    quoteId: string                                              │
│    requirements: Requirements                                    │
│    steps: Step[]           // Exactly what needs to be selected │
│    currentStepIndex: number                                     │
│    selectedProducts: Product[]                                  │
│                                                                  │
│    getNextStep(): Step                                          │
│    selectProduct(productId): { success, nextProducts }          │
│    isComplete(): boolean                                        │
│    getSummary(): QuoteSummary                                   │
│  }                                                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PRODUCT SEARCH (lib/search.ts)               │
│                                                                  │
│  searchForComponent(component: Component, requirements): Product[] │
│                                                                  │
│  Components are FIXED:                                          │
│    - "avr_7_1" | "avr_5_1" | "avr_9_1"                         │
│    - "floorstanding_pair" | "bookshelf_pair"                   │
│    - "center_channel"                                           │
│    - "surround_pair_ceiling" | "surround_pair_bookshelf"       │
│    - "subwoofer"                                                │
│                                                                  │
│  Each component has FIXED search queries, no AI involved        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Step Definition

For a 7.1 Home Cinema with ceiling surrounds:

```typescript
const STEPS_7_1_CEILING: Step[] = [
  {
    id: 1,
    component: "avr",
    label: "AV Receiver",
    description: "7.1+ channel receiver with room correction",
    searchQuery: "denon marantz yamaha av receiver 7.1 surround atmos",
    budget: { min: 15000, max: 60000 },
    quantity: 1,
  },
  {
    id: 2,
    component: "fronts",
    label: "Front Speakers",
    description: "Floorstanding speakers (sold as pair)",
    searchQuery: "floorstanding speakers home cinema pair",
    budget: { min: 15000, max: 60000 },
    quantity: 1, // 1 pair
    packageCovers: ["fronts", "center", "surrounds"], // If package selected, skip these
  },
  {
    id: 3,
    component: "center",
    label: "Center Channel",
    description: "Matches front speaker brand",
    searchQuery: "{brand} center channel speaker", // {brand} replaced dynamically
    budget: { min: 5000, max: 25000 },
    quantity: 1,
    skipIfPackage: true, // Skip if step 2 was a package
  },
  {
    id: 4,
    component: "surrounds",
    label: "Surround Speakers",
    description: "Ceiling-mounted for rear channels",
    searchQuery: "in-ceiling speaker home cinema surround",
    budget: { min: 3000, max: 15000 },
    quantity: 2, // 2 pairs for 7.1
    skipIfPackage: true,
  },
  {
    id: 5,
    component: "subwoofer",
    label: "Subwoofer",
    description: "Powered subwoofer for bass",
    searchQuery: "subwoofer home cinema powered",
    budget: { min: 8000, max: 30000 },
    quantity: 1,
  },
];
```

---

## Discovery Simplification

Current discovery asks 10+ questions. New discovery:

```
User: "I need home cinema, 7.1 setup, cinema room 35sqm, ceiling rear speakers, budget R200k"

System extracts:
{
  type: "home_cinema",
  channels: "7.1",
  room_sqm: 35,
  surround_mounting: "ceiling",
  front_type: "floorstanding", // default
  budget_total: 200000,
}

That's it. No zones. No ceiling height questions. No control method questions.
```

### Discovery Questions (MAX 3):

1. **If channels not specified**: "5.1, 7.1, or Atmos?"
2. **If budget not specified**: "What's your total budget?"
3. **If surround mounting not specified**: "Ceiling or bookshelf surrounds?"

Everything else has sensible defaults.

---

## Package Handling

When user selects a package that includes multiple components:

```typescript
function handlePackageSelection(product: Product, currentStep: Step) {
  // Detect if product is a package
  const packageContents = detectPackageContents(product);
  // e.g., { fronts: true, center: true, surrounds: true }

  // Mark covered steps as complete
  for (const step of remainingSteps) {
    if (packageContents[step.component]) {
      step.status = "covered_by_package";
      step.coveredBy = product.id;
    }
  }

  // Jump to next uncovered step
  return getNextUncoveredStep();
}
```

---

## AI Usage (Minimal)

AI is ONLY used for:

1. **Intent routing** - Detect which flow the user needs (system-design / simple-quote / tender)
2. **Discovery conversation** - Extract requirements from natural language
3. **Answering questions** - "Is this AVR good for Atmos?"
4. **Final summary** - Generate a nice quote summary
5. **Tender parsing** - Extract line items from uploaded documents

AI is NEVER used for:

- Deciding what to search (backend uses fixed queries)
- Deciding what step is next (backend controls flow)
- Remembering what was selected (database is source of truth)
- Tracking quantities (backend calculates)

---

## Database Schema

```sql
-- Quotes table
CREATE TABLE quotes (
  id UUID PRIMARY KEY,
  session_id TEXT NOT NULL,
  requirements JSONB NOT NULL,
  steps JSONB NOT NULL,          -- The step definitions for this quote
  current_step_index INT DEFAULT 0,
  selected_products JSONB DEFAULT '[]',
  status TEXT DEFAULT 'in_progress', -- in_progress, complete, abandoned
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- No need for complex conversation tracking
-- The quote object IS the state
```

---

## API Endpoints

### Shared Endpoints

#### POST /api/search
```typescript
// Universal product search
// Input
{ query: "denon av receiver", filters: { min_price: 0, max_price: 50000 }, k: 10 }

// Output
{ success: true, items: [...], count: 10 }
```

#### POST /api/quote/generate
```typescript
// Generate PDF quote from any chat type
// Input
{ quoteId: "uuid", format: "pdf" | "email", customerEmail?: "..." }

// Output
{ success: true, pdfUrl: "...", quoteNumber: "AUD-2025-001" }
```

---

### System Design Endpoints

#### POST /api/system-design/start
```typescript
// Input
{
  requirements: {
    type: "home_cinema",      // auto-detected or explicit
    channels: "7.1",
    surround_mounting: "ceiling",
    budget_total: 200000
  }
}

// Output
{
  quoteId: "uuid",
  scenario: "home_cinema_7_1",
  currentStep: { index: 0, label: "AV Receiver", budget: { min: 15000, max: 60000 } },
  totalSteps: 5,
  products: [...],
  message: "Let's start with the AV Receiver. Here are my top recommendations:"
}
```

#### POST /api/system-design/select
```typescript
// Input
{ quoteId: "uuid", productId: "product-uuid" }

// Output
{
  success: true,
  addedProduct: { name, price, quantity },
  currentStep: { index: 1, label: "Front Speakers" },
  products: [...],
  message: "Great choice! Now for the front speakers:",
  quoteTotal: 20990,
  skippedSteps: []  // Populated if package covers multiple components
}
```

---

### Simple Quote Endpoints

#### POST /api/simple-quote/start
```typescript
// Input (minimal - just creates a quote session)
{ sessionId: "browser-session-id" }

// Output
{ quoteId: "uuid", items: [], total: 0 }
```

#### POST /api/simple-quote/add
```typescript
// Input
{ quoteId: "uuid", productId: "product-uuid", quantity: 2 }

// Output
{
  success: true,
  item: { name: "JBL Flip 6", price: 2499, quantity: 2, lineTotal: 4998 },
  quoteTotal: 4998,
  itemCount: 1
}
```

#### POST /api/simple-quote/remove
```typescript
// Input
{ quoteId: "uuid", productId: "product-uuid" }

// Output
{ success: true, quoteTotal: 0, itemCount: 0 }
```

---

### Tender Quote Endpoints

#### POST /api/tender/upload
```typescript
// Input: FormData with file
// Accepts: PDF, Excel, Word, Images

// Output
{
  tenderId: "uuid",
  extractedItems: [
    { description: "8-channel AV receiver", quantity: 1, specs: "Dolby Atmos, HDMI 2.1" },
    { description: "Floorstanding speakers", quantity: 2, specs: "150W, 8-inch woofer" }
  ],
  confidence: 0.85,
  warnings: ["Could not parse line 15"]
}
```

#### POST /api/tender/match
```typescript
// Input
{ tenderId: "uuid", itemIndex: 0 }

// Output
{
  matches: [
    { product: {...}, matchScore: 0.92, reason: "Matches all specs" },
    { product: {...}, matchScore: 0.78, reason: "Missing HDMI 2.1" }
  ]
}
```

#### POST /api/tender/confirm
```typescript
// Input
{ tenderId: "uuid", selections: [{ itemIndex: 0, productId: "uuid" }, ...] }

// Output
{ quoteId: "uuid", total: 125000, itemCount: 5 }
```

---

## Frontend Simplification

```tsx
function QuoteBuilder() {
  const [quoteId, setQuoteId] = useState(null);
  const [currentStep, setCurrentStep] = useState(null);
  const [products, setProducts] = useState([]);
  const [messages, setMessages] = useState([]);
  const [quoteTotal, setQuoteTotal] = useState(0);

  // Start quote
  async function startQuote(requirements) {
    const res = await fetch('/api/quote/start', {
      method: 'POST',
      body: JSON.stringify({ requirements })
    });
    const data = await res.json();
    setQuoteId(data.quoteId);
    setCurrentStep(data.currentStep);
    setProducts(data.products);
    addMessage('assistant', data.message);
  }

  // Select product
  async function selectProduct(productId) {
    const res = await fetch('/api/quote/select', {
      method: 'POST',
      body: JSON.stringify({ quoteId, productId })
    });
    const data = await res.json();
    setCurrentStep(data.currentStep);
    setProducts(data.products);
    setQuoteTotal(data.quoteTotal);
    addMessage('assistant', data.message);
  }

  // That's basically it. No complex state management.
}
```

---

## File Structure

```
lib/
  router/
    intent-detector.ts   # AI detects: system-design | simple-quote | tender

  flows/
    system-design/
      engine.ts          # QuoteEngine class for full system builds
      steps.ts           # Step definitions per vertical (home_cinema, commercial, etc)
      package-detection.ts
    simple-quote/
      engine.ts          # SimpleQuoteEngine - search and add items
    tender/
      parser.ts          # Parse uploaded documents
      matcher.ts         # Match specs to inventory

  search/
    index.ts             # Unified search function
    queries.ts           # Fixed search queries per component

  ai/
    router.ts            # Intent detection prompt
    discovery.ts         # Extract requirements from conversation
    responses.ts         # Generate friendly messages

app/
  api/
    chat/route.ts        # UNIFIED entry point - routes to correct flow

    system-design/
      start/route.ts     # Start system design quote
      select/route.ts    # Select product in step

    simple-quote/
      add/route.ts       # Add item to quote
      remove/route.ts    # Remove item

    tender/
      upload/route.ts    # Upload document
      match/route.ts     # Get matches for line item
      confirm/route.ts   # Confirm selections

    quote/
      generate/route.ts  # Generate PDF (shared)
      [id]/route.ts      # Get quote state

components/
  chat/
    UnifiedChat.tsx      # Single chat interface
    MessageList.tsx      # Display messages
    ProductCards.tsx     # Display product options

  quote/
    StepIndicator.tsx    # Shows progress (system-design)
    QuoteSummary.tsx     # Shows selected products
    TenderUpload.tsx     # Document upload zone
```

---

## What We Delete

- `lib/product-plan.ts` - Over-engineered step planning
- `lib/bom-normalizer.ts` - Complex BOM calculations
- `lib/chat/guardrails.ts` - Destructive "fixes"
- `lib/rag.ts` - Overcomplicated prompts
- `lib/chat-tools.ts` - AI tool definitions
- Complex frontend state management
- Zone handling (single room only for v1)
- Brand matching logic
- Quantity inference
- Follow-up message system

---

## What We Keep

- Database connection
- Hybrid search function (it works)
- Product display components (styling)
- Basic chat UI layout

---

## Implementation Order

### Week 1: Core Engine
1. Create `QuoteEngine` class with step management
2. Create step definitions for 5.1, 7.1, 9.1 systems
3. Create simple search wrapper
4. Create `/api/quote/start` and `/api/quote/select`

### Week 2: Frontend
1. Create `QuoteBuilder` component
2. Wire up to new API
3. Test full flow: start → select → select → ... → complete

### Week 3: Polish
1. Add package detection
2. Add `/api/quote/chat` for questions
3. Add discovery flow (extract requirements)
4. Add error handling

### Week 4: Deploy
1. Run side-by-side with old system
2. A/B test
3. Migrate

---

## Success Criteria

After rebuild, this flow MUST work EVERY TIME:

```
User: "7.1 home cinema, R200k budget, ceiling rears"

System: "Let's build your system! First, the AV Receiver:"
[Shows 3 AVRs, all 7.1+, all R15k-R60k]

User: [Clicks Denon X2800H]

System: "Added! Next, front speakers:"
[Shows 3 floorstanding pairs, R15k-R60k]

User: [Clicks Klipsch R-800F Package]

System: "This package includes center and surrounds! Skipping to subwoofer:"
[Shows 3 subwoofers, R8k-R30k]

User: [Clicks SVS SB-1000]

System: "Your system is complete!
- Denon X2800H: R20,990
- Klipsch R-800F Package: R55,160
- SVS SB-1000: R15,990
Total: R92,140

Ready to generate your quote?"
```

5 clicks. No confusion. No "what?" moments. No AI hallucinations.

---

## Final Note

This is not about being fancy. It's about being **reliable**.

Every "smart" feature we've added has broken something. The package detection broke step counting. The brand matching showed wrong products. The AI follow-ups caused loops.

The new system does LESS and works MORE.

Simple. Deterministic. Bulletproof.
