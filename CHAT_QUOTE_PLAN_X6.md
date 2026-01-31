# CHAT_QUOTE_PLAN_X6: Production-Ready AI Quote System

## Executive Summary

Based on comprehensive analysis of the chat conversation log and codebase, this plan addresses critical issues preventing production deployment:

1. **Context Loss Issues** - AI loses 5.1.2 specifications, forgets multi-room requests, and restarts design mid-flow
2. **Delete Functionality** - UI delete button exists but isn't wired; AI doesn't offer alternatives after deletion
3. **Conversation Persistence** - AI history stored in memory only, lost on server restart
4. **Step Tracking** - AI doesn't know current progress in system design
5. **Multi-Room Handling** - Additional zones (bar, dining) are captured but never processed

**Estimated Complexity:** Medium-High (touching 8+ files, multiple subsystems)

---

## Critical Issues from Chat Log Analysis

### Issue 1: 5.1.2 Specification Lost → Becomes 5.1
**What Happened:** User said "cinema 5.1.2" but system recommended 5.1 components (no height speakers)

**Root Cause:**
- File: `d:\AUDICO-CHAT-QUOTE-X\audico-chat-quote\src\app\api\chat\route.ts` lines 117-124
- Regex matches `5.1` before checking `5.1.2`
- Height speaker component (.2) is completely lost

**Impact:** Missing height speakers = incomplete Atmos system

### Issue 2: Multi-Room Request Completely Forgotten
**What Happened:** User requested cinema + bar + dining; only cinema was built

**Root Cause:**
- File: `d:\AUDICO-CHAT-QUOTE-X\audico-chat-quote\src\app\api\chat\route.ts` lines 250-269
- "Bar" not in zone patterns list
- `additionalZones` stored but never processed after cinema completion

**Impact:** Customer's full requirement ignored

### Issue 3: AI Loses Design Progress, Restarts Flow
**What Happened:** User said "what about center and sub, we were mid design" → AI offered AVRs again

**Root Cause:**
- File: `d:\AUDICO-CHAT-QUOTE-X\audico-chat-quote\src\app\api\chat\route.ts` lines 394-459
- `answerFlowQuestion()` creates new sales agent without step context
- AI doesn't know it's on step 3 of 5

**Impact:** Frustrating user experience, appears broken

### Issue 4: Delete Button Disappeared
**What Happened:** Quote sidebar missing delete functionality

**Root Cause:**
- File: `d:\AUDICO-CHAT-QUOTE-X\audico-chat-quote\src\components\quote\quote-sidebar.tsx` lines 90-94
- Delete button (Trash2 icon) EXISTS in code
- Parent component doesn't pass `onRemove` handler
- No backend endpoint to call

**Impact:** Users can't remove incorrect selections

### Issue 5: No Alternative Suggestions After Deletion
**Requirement:** When user deletes a critical component (e.g., AVR), AI should immediately offer alternatives

**Root Cause:**
- File: `d:\AUDICO-CHAT-QUOTE-X\audico-chat-quote\src\lib\ai\system-prompts.ts`
- System prompt missing deletion handling instructions
- No workflow for "product removed → suggest alternatives"

**Impact:** Poor UX, user left without guidance

---

## Implementation Plan

### Phase 1: Fix Channel Detection (5.1.2, 7.1.4, etc.)

**Objective:** Properly detect Atmos configurations with height speakers

**Files to Modify:**
- `src/app/api/chat/route.ts`
- `src/lib/flows/system-design/steps.ts`
- `src/lib/types.ts`

**Changes:**

1. **Update channel detection regex** (route.ts lines 117-124)
```typescript
// BEFORE (broken)
if (/5\.1|5\.2|five\s*(point|\.)\s*one|5\s*channel/i.test(message)) {
  requirements.channels = "5.1";
}

// AFTER (correct priority order)
if (/5\.1\.4|5\.2\.4/i.test(message)) {
  requirements.channels = "5.1.4";  // 5 base + sub + 4 height
} else if (/5\.1\.2|5\.2\.2/i.test(message)) {
  requirements.channels = "5.1.2";  // 5 base + sub + 2 height
} else if (/7\.1\.4|7\.2\.4/i.test(message)) {
  requirements.channels = "7.1.4";  // 7 base + sub + 4 height
} else if (/7\.1\.2|7\.2\.2/i.test(message)) {
  requirements.channels = "7.1.2";  // 7 base + sub + 2 height
} else if (/5\.1|5\.2|five\s*(point|\.)\s*one|5\s*channel/i.test(message)) {
  requirements.channels = "5.1";    // 5 base + sub only
} else if (/7\.1|7\.2|seven\s*(point|\.)\s*one|7\s*channel/i.test(message)) {
  requirements.channels = "7.1";    // 7 base + sub only
}
```

2. **Add new channel types to type definitions** (types.ts)
```typescript
export type ChannelConfiguration =
  | "5.1"
  | "5.1.2"   // NEW
  | "5.1.4"   // NEW
  | "7.1"
  | "7.1.2"   // NEW
  | "7.1.4"   // NEW
  | "9.1";
```

3. **Create step configurations for Atmos systems** (steps.ts lines 60-109)
```typescript
case "5.1.2":
  return [
    { id: 1, label: "AVR/Processor", ... },
    { id: 2, label: "Front L/R Speakers", ... },
    { id: 3, label: "Center Speaker", ... },
    { id: 4, label: "Surround L/R Speakers", ... },
    { id: 5, label: "Subwoofer", ... },
    { id: 6, label: "Height/Atmos Speakers (x2)", ... },  // NEW STEP
  ];
```

**Verification:**
- Test: "I need a 5.1.2 system" → Check step 6 includes height speakers
- Test: "Build me a 7.1.4 Atmos setup" → Check 4 height speakers in final step

---

### Phase 2: Implement Multi-Room Workflow

**Objective:** Handle cinema + bar + dining in single conversation

**Files to Modify:**
- `src/app/api/chat/route.ts`
- `src/lib/ai/system-prompts.ts`
- `src/lib/flows/system-design/engine.ts`

**Changes:**

1. **Add "bar" to zone patterns** (route.ts line 250)
```typescript
const zonePatterns = [
  { pattern: /bar|pub|lounge/i, name: "Bar", type: "commercial_loud" },  // NEW
  { pattern: /kitchen\s*(speaker|ceiling|zone)?s?/i, name: "Kitchen", type: "ceiling_zone" },
  { pattern: /dining\s*(room)?\s*(speaker|zone)?s?/i, name: "Dining", type: "ceiling_zone" },
  // ... existing patterns
];
```

2. **Create multi-room tracking in requirements**
```typescript
interface Requirements {
  // ... existing fields
  primaryZone: {
    type: "home_cinema" | "commercial_bgm" | "commercial_loud";
    channels?: string;
    budget?: number;
    roomSize?: number;
  };
  additionalZones: {
    name: string;
    type: string;
    budget?: number;
    requirements?: string;  // "background music" vs "big sound"
  }[];
  totalBudget?: number;
  budgetAllocation?: {
    [zoneName: string]: number;
  };
}
```

3. **Add multi-room system prompt** (system-prompts.ts)
```typescript
## MULTI-ROOM WORKFLOW

When customer requests multiple zones (cinema + bar + dining):

1️⃣ **CLARIFY BUDGET ALLOCATION**
   - Ask: "You mentioned R200k for cinema, R50k for bar/dining. Is that:
     - R200k for cinema, R25k each for bar and dining? OR
     - R200k total for everything?"
   - Store budget allocation in requirements

2️⃣ **BUILD PRIMARY ZONE FIRST**
   - Complete cinema system step-by-step (AVR → Speakers → Sub → Height)
   - Track remaining budget

3️⃣ **THEN BUILD ADDITIONAL ZONES**
   - After cinema: "Great! Cinema system complete. Now let's handle the bar..."
   - For each zone:
     - Search appropriate products (commercial_loud for bar, ceiling for dining)
     - Show 3-4 options
     - Add to same quote with zone labels

4️⃣ **MAINTAIN CONTEXT**
   - Never forget additional zones
   - Reference them: "Still need to handle bar and dining"
   - Complete all zones before finalizing quote
```

4. **Update SystemDesignEngine to support multi-zone**
```typescript
interface SystemDesignQuote {
  // ... existing fields
  zones: {
    name: string;
    type: string;
    steps: Step[];
    selectedProducts: QuoteItem[];
    budget: number;
    status: "pending" | "in_progress" | "complete";
  }[];
  currentZoneIndex: number;
}
```

**Verification:**
- Test: "5.1.2 cinema + bar + dining" → All 3 zones must be completed
- Test: After cinema done, check AI says "Now let's handle the bar"
- Test: Final quote includes products labeled by zone

---

### Phase 3: Fix Step Context Loss

**Objective:** AI always knows current step and progress

**Files to Modify:**
- `src/lib/ai/claude-handler.ts`
- `src/lib/ai/system-prompts.ts`
- `src/app/api/chat/route.ts`

**Changes:**

1. **Pass step context to Claude in every message** (claude-handler.ts)
```typescript
async chat(message: string): Promise<ChatResponse> {
  // Build context message with current state
  const contextMessage = this.buildContextMessage();

  const messages: Anthropic.MessageParam[] = [
    ...this.context.conversationHistory,
    {
      role: "user",
      content: [
        // NEW: Inject context before user message
        {
          type: "text",
          text: contextMessage,
        },
        {
          type: "text",
          text: message,
        }
      ]
    }
  ];
  // ... rest of chat logic
}

private buildContextMessage(): string {
  const quote = this.context.currentQuote;
  if (!quote || !quote.steps) return "";

  const currentStep = quote.steps[quote.current_step_index];
  const selectedProducts = quote.selected_products || [];

  return `
[SYSTEM CONTEXT - Current State]
- Quote ID: ${quote.id}
- System Type: ${quote.requirements.channels || "Unknown"}
- Current Step: ${currentStep?.label || "Unknown"} (${quote.current_step_index + 1}/${quote.steps.length})
- Budget Total: R${quote.requirements.budget_total || 0}
- Budget Spent: R${selectedProducts.reduce((sum, p) => sum + p.lineTotal, 0)}
- Budget Remaining: R${(quote.requirements.budget_total || 0) - selectedProducts.reduce((sum, p) => sum + p.lineTotal, 0)}

Selected Products So Far:
${selectedProducts.map(p => `- ${p.product.name} (R${p.product.price})`).join('\n') || "None yet"}

${quote.requirements.additionalZones?.length ?
  `\nAdditional Zones Pending: ${quote.requirements.additionalZones.map(z => z.name).join(', ')}`
  : ''}

Your task: ${this.getStepInstruction(currentStep)}
`.trim();
}

private getStepInstruction(step: Step): string {
  switch (step?.id) {
    case 1: return "Search for AVRs and show 3-4 options with provide_final_recommendation";
    case 2: return "Search for front speakers and show 3-4 options with provide_final_recommendation";
    case 3: return "Search for center channel and show 3-4 options with provide_final_recommendation";
    case 4: return "Search for surround speakers and show 3-4 options with provide_final_recommendation";
    case 5: return "Search for subwoofers and show 2-3 options with provide_final_recommendation";
    case 6: return "Search for height/Atmos speakers and show 2-3 options with provide_final_recommendation";
    default: return "Continue helping the customer";
  }
}
```

2. **Update system prompt with context awareness instructions**
```typescript
## USING SYSTEM CONTEXT

Before each response, you'll receive a [SYSTEM CONTEXT] block with:
- Current step number and name
- Budget remaining
- Products already selected
- Pending additional zones

CRITICAL RULES:
- Always check budget remaining before recommending products
- Never show products over remaining budget
- Reference selected products: "To match your Klipsch R-600F speakers..."
- Track pending zones: "After this, we'll handle the bar and dining"
- If user asks clarifying question mid-step, STAY ON THAT STEP
```

3. **Fix answerFlowQuestion to maintain step context** (route.ts lines 394-459)
```typescript
async function answerFlowQuestion(
  message: string,
  quoteContext: any,
  sessionId: string
): Promise<ChatResponse> {
  // BEFORE: Created agent without context
  // AFTER: Pass full quote context

  const contextPrompt = `
You are helping with an in-progress quote (ID: ${quoteContext.id}).

Current State:
- Step: ${quoteContext.currentStep?.label || "Unknown"}
- Selected: ${quoteContext.selectedProducts?.map(p => p.product.name).join(', ') || "Nothing yet"}
- Budget: R${quoteContext.totalBudget || 0} (R${quoteContext.spent || 0} spent, R${quoteContext.remaining || 0} left)

The customer asked: "${message}"

Answer their question helpfully, referencing the products they've already selected.
DO NOT restart the design process or suggest new AVRs if they already chose one.
Stay focused on their current step.
`;

  // ... rest of function with context
}
```

**Verification:**
- Test: Select AVR → Ask "what's the warranty?" → Check AI doesn't restart
- Test: Mid-design, check Claude's response references selected products
- Test: Ask question after step 3 → Verify AI continues from step 4, not step 1

---

### Phase 4: Implement Delete with AI Alternative Suggestions

**Objective:** Wire delete button + AI offers alternatives when critical component removed

**Files to Modify:**
- `src/app/page.tsx`
- `src/components/quote/quote-sidebar.tsx`
- `src/app/api/quote/remove/route.ts` (NEW FILE)
- `src/components/chat/unified-chat.tsx`
- `src/lib/ai/system-prompts.ts`

**Changes:**

1. **Create DELETE endpoint** (NEW: api/quote/remove/route.ts)
```typescript
import { QuoteManager } from "@/lib/ai/quote-manager";

export async function POST(request: Request) {
  try {
    const { quoteId, productId, sku, sessionId } = await request.json();

    if (!quoteId || (!productId && !sku)) {
      return Response.json(
        { error: "Missing quoteId and productId/sku" },
        { status: 400 }
      );
    }

    const quoteManager = QuoteManager.getInstance();

    // Remove product
    await quoteManager.removeProduct(quoteId, sku);

    // Get updated quote
    const updatedItems = await quoteManager.getQuoteItems(quoteId);
    const quote = await quoteManager.getQuote(quoteId);

    // Determine if removed product is critical
    const removedProduct = updatedItems.find(p => p.product.sku === sku);
    const isCritical = ["AVR", "AV Receiver", "Amplifier"].some(keyword =>
      removedProduct?.product.category?.includes(keyword)
    );

    return Response.json({
      success: true,
      quoteItems: updatedItems,
      isCritical,
      removedProduct: removedProduct?.product,
      message: isCritical
        ? "Product removed. Would you like me to suggest alternatives?"
        : "Product removed successfully.",
    });
  } catch (error: any) {
    console.error("[Remove API] Error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
```

2. **Wire delete button in Page.tsx**
```typescript
// Add handler
const handleRemoveItem = async (productId: string) => {
  try {
    setIsLoading(true);

    const response = await fetch("/api/quote/remove", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quoteId,
        productId,
        sessionId,
      }),
    });

    const data = await response.json();

    if (data.error) {
      console.error("Remove error:", data.error);
      return;
    }

    // Update quote items
    setQuoteItems(data.quoteItems);

    // If critical component removed, trigger AI suggestion
    if (data.isCritical && data.removedProduct) {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: `I've removed the ${data.removedProduct.name} from your quote. This is a critical component for your system. Would you like me to suggest alternative options?`,
        timestamp: new Date(),
      }]);
    }
  } catch (error) {
    console.error("Remove error:", error);
  } finally {
    setIsLoading(false);
  }
};

// Pass to QuoteSidebar
<QuoteSidebar
  items={quoteItems}
  onRemove={handleRemoveItem}  // ← NOW WIRED
/>
```

3. **Update system prompt for deletion handling** (system-prompts.ts)
```typescript
## HANDLING PRODUCT REMOVAL

When customer says "remove", "delete", "take out [product]", "I don't want the [product]":

1️⃣ **IDENTIFY PRODUCT**
   - Match product name/brand/SKU from selected products
   - If ambiguous: Ask "Which [type] do you want to remove? You have [list]"

2️⃣ **REMOVE VIA TOOL**
   - Call update_quote with remove_sku parameter
   - Acknowledge: "I've removed the [product name] from your quote."

3️⃣ **CHECK IF CRITICAL**
   - Critical components: AVR, Amplifier, Main Speakers, Subwoofer
   - Non-critical: Cables, accessories

4️⃣ **OFFER ALTERNATIVES (if critical)**
   - Immediately search for alternatives in same category
   - Call provide_final_recommendation with 3-4 alternatives
   - Say: "Here are some alternative [component type] options for you:"
   - Respect remaining budget

5️⃣ **RECALCULATE BUDGET**
   - Update running total
   - Inform user of new budget remaining

EXAMPLE:
User: "Actually, remove that Denon AVR"
You:
- [Call update_quote with remove_sku: "DENON-AVR-X2800H"]
- "I've removed the Denon AVR-X2800H from your quote. That frees up R20,990."
- [Search for AVRs, call provide_final_recommendation]
- "Here are some alternative AVR options within your budget:"
- [Show 3-4 AVR cards]
```

4. **Add conversational deletion to UnifiedChat** (unified-chat.tsx)
```typescript
// User can also type "remove the denon avr"
// AI will detect intent and call update_quote tool
// Response will include updated quoteItems
// onQuoteUpdate will refresh the sidebar automatically
```

**Verification:**
- Test: Click delete button on AVR → Check it's removed from quote
- Test: After deletion, verify AI message offers alternatives
- Test: Type "remove the Denon AVR" → Check AI detects intent and removes
- Test: Delete non-critical item (cable) → Verify no alternative suggestions
- Test: Delete item, then check budget remaining updates correctly

---

### Phase 5: Persist Conversation History

**Objective:** Survive server restarts without losing conversation

**Files to Modify:**
- `src/lib/ai/claude-handler.ts`
- Supabase migrations (NEW)
- `src/app/api/chat/ai-native/route.ts`

**Changes:**

1. **Create conversation_history table** (NEW: supabase/migrations/004_conversation_history.sql)
```sql
CREATE TABLE conversation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  quote_id UUID REFERENCES quotes(id) ON DELETE CASCADE,
  message_index INT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_conversation_history_session ON conversation_history(session_id);
CREATE INDEX idx_conversation_history_quote ON conversation_history(quote_id);
```

2. **Update ClaudeHandler to persist messages** (claude-handler.ts)
```typescript
class ClaudeConversationHandler {
  constructor(sessionId: string, quoteId?: string) {
    this.context = {
      sessionId,
      currentQuoteId: quoteId,
      conversationHistory: [],
      // ... other fields
    };

    // Load history from database
    this.loadConversationHistory();
  }

  private async loadConversationHistory() {
    const { data, error } = await supabase
      .from("conversation_history")
      .select("*")
      .eq("session_id", this.context.sessionId)
      .order("message_index", { ascending: true });

    if (!error && data) {
      this.context.conversationHistory = data.map(row => ({
        role: row.role as "user" | "assistant",
        content: row.content,
      }));
    }
  }

  private async saveMessage(role: "user" | "assistant", content: any) {
    const messageIndex = this.context.conversationHistory.length;

    await supabase
      .from("conversation_history")
      .insert({
        session_id: this.context.sessionId,
        quote_id: this.context.currentQuoteId,
        message_index: messageIndex,
        role,
        content,
      });
  }

  async chat(message: string): Promise<ChatResponse> {
    // Add user message
    const userMessage = { role: "user" as const, content: message };
    this.context.conversationHistory.push(userMessage);
    await this.saveMessage("user", message);  // ← PERSIST

    // ... Claude API call

    // Add assistant response
    this.context.conversationHistory.push(assistantMessage);
    await this.saveMessage("assistant", assistantMessage.content);  // ← PERSIST

    return response;
  }
}
```

3. **Clear old conversations after 7 days** (cleanup job)
```sql
-- Run nightly
DELETE FROM conversation_history
WHERE created_at < NOW() - INTERVAL '7 days';
```

**Verification:**
- Test: Have conversation → Restart dev server → Continue conversation
- Test: Check Supabase conversation_history table has messages
- Test: Load quote by ID, verify conversation context restored

---

### Phase 6: Budget Tracking and Allocation

**Objective:** AI always knows remaining budget and allocates across zones

**Files to Modify:**
- `src/lib/ai/claude-handler.ts`
- `src/lib/ai/system-prompts.ts`

**Changes:**

1. **Add budget calculations to context builder**
```typescript
private buildContextMessage(): string {
  const quote = this.context.currentQuote;
  const selectedProducts = quote.selected_products || [];

  const budgetTotal = quote.requirements.budget_total || 0;
  const budgetSpent = selectedProducts.reduce((sum, p) => sum + p.lineTotal, 0);
  const budgetRemaining = budgetTotal - budgetSpent;

  // Multi-room budget allocation
  let budgetBreakdown = "";
  if (quote.requirements.additionalZones?.length) {
    const zones = [
      { name: "Cinema", budget: quote.requirements.primaryZone?.budget || budgetTotal * 0.7 },
      ...quote.requirements.additionalZones.map(z => ({
        name: z.name,
        budget: z.budget || (budgetTotal * 0.3) / quote.requirements.additionalZones.length
      }))
    ];

    budgetBreakdown = `
Budget Allocation by Zone:
${zones.map(z => `- ${z.name}: R${z.budget.toLocaleString()}`).join('\n')}
`;
  }

  return `
[SYSTEM CONTEXT]
Budget Total: R${budgetTotal.toLocaleString()}
Budget Spent: R${budgetSpent.toLocaleString()}
Budget Remaining: R${budgetRemaining.toLocaleString()}
${budgetBreakdown}
...
`;
}
```

2. **Update system prompt with budget rules**
```typescript
## BUDGET MANAGEMENT

CRITICAL RULES:
1. NEVER recommend products over remaining budget
2. For multi-room: allocate budget per zone (e.g., 70% cinema, 15% bar, 15% dining)
3. Always show budget remaining after each selection
4. If budget tight, suggest cost-saving alternatives
5. Warn if approaching budget: "You have R15k left - let's find a sub under R12k"

BUDGET ALLOCATION EXAMPLES:
- R200k total, cinema only → Full R200k for cinema
- R200k cinema + R50k bar/dining → R200k cinema, R25k each for bar and dining
- R150k for all 3 zones → R105k cinema (70%), R22.5k bar (15%), R22.5k dining (15%)
```

**Verification:**
- Test: Set budget R100k → Select products → Check AI never recommends over remaining
- Test: Multi-room R150k → Check budget split across zones
- Test: Approaching budget limit → Verify AI warns user

---

## Critical Files Reference

| File | Purpose | Changes Required |
|------|---------|------------------|
| `src/app/api/chat/route.ts` | Intent detection + routing | Fix 5.1.2 regex, add "bar" zone, fix answerFlowQuestion context |
| `src/lib/flows/system-design/steps.ts` | Step generation | Add 5.1.2, 7.1.2, 7.1.4 step configs with height speakers |
| `src/lib/types.ts` | Type definitions | Add new channel types, multi-zone types |
| `src/lib/ai/claude-handler.ts` | AI conversation | Add context builder, persist history, load quote state |
| `src/lib/ai/system-prompts.ts` | AI behavior | Add multi-room workflow, deletion handling, context awareness |
| `src/app/page.tsx` | Main UI | Add handleRemoveItem, pass to QuoteSidebar |
| `src/components/quote/quote-sidebar.tsx` | Quote display | Already has delete button, needs onRemove prop |
| `src/app/api/quote/remove/route.ts` | NEW FILE | Delete endpoint with critical component detection |
| `supabase/migrations/004_conversation_history.sql` | NEW FILE | Persist conversation history |

---

## Testing Plan

### Test Suite 1: Channel Detection
- [ ] "5.1.2 home cinema" → 6 steps (including 2 height speakers)
- [ ] "7.1.4 Atmos setup" → 8 steps (including 4 height speakers)
- [ ] "5.1 system" → 5 steps (no height speakers)

### Test Suite 2: Multi-Room
- [ ] "Cinema 5.1 + bar + dining" → All 3 zones completed
- [ ] After cinema: Check AI says "Now let's handle the bar"
- [ ] Final quote: Products labeled by zone
- [ ] Budget: Properly allocated across zones

### Test Suite 3: Context Preservation
- [ ] Select AVR → Ask "what's the warranty" → Verify doesn't restart
- [ ] Mid-design question → Continue from correct step
- [ ] Restart server → Resume conversation → Context intact

### Test Suite 4: Delete Functionality
- [ ] Click delete on AVR → Removed from quote
- [ ] After delete critical component → AI offers alternatives
- [ ] Type "remove the Denon" → AI detects and removes
- [ ] Delete non-critical → No alternative suggestions
- [ ] Budget updates after deletion

### Test Suite 5: Budget Tracking
- [ ] R100k budget → AI never recommends over remaining
- [ ] Multi-room R150k → Check 70/15/15 split
- [ ] Near budget limit → AI warns user
- [ ] Budget remaining shown after each selection

---

## Rollout Strategy

### Stage 1: Core Fixes (Deploy First)
1. Fix 5.1.2 detection
2. Add "bar" to zone patterns
3. Wire delete button
4. Add context to answerFlowQuestion

**Risk:** Low
**Impact:** High (fixes most visible bugs)
**Time:** 4-6 hours

### Stage 2: AI Improvements (Deploy Second)
1. Update system prompts (multi-room, deletion, context)
2. Add context builder to ClaudeHandler
3. Create delete endpoint
4. Implement alternative suggestions

**Risk:** Medium
**Impact:** High (major UX improvement)
**Time:** 6-8 hours

### Stage 3: Persistence (Deploy Third)
1. Create conversation_history table
2. Update ClaudeHandler to save/load
3. Add cleanup job

**Risk:** Medium (database changes)
**Impact:** Medium (nice-to-have for production)
**Time:** 4-6 hours

### Stage 4: Multi-Room Workflow (Deploy Fourth)
1. Implement zone tracking
2. Add zone-specific product search
3. Update SystemDesignEngine for multi-zone

**Risk:** High (complex new feature)
**Impact:** High (enables full customer requirement)
**Time:** 8-12 hours

---

## Success Criteria

- [ ] User can request "5.1.2 cinema + bar + dining" and all components are delivered
- [ ] Deleting critical component triggers immediate alternative suggestions
- [ ] AI never loses track of design progress (no restarts mid-flow)
- [ ] Conversation survives server restarts
- [ ] Budget tracking prevents over-budget recommendations
- [ ] System handles 95%+ of production scenarios without errors

---

## Known Limitations After Implementation

1. **Conversation history grows large** - May need pagination after 50+ messages
2. **Multi-zone limited to 3 zones** - More than 3 may need UI redesign
3. **Budget allocation heuristic** - May not match all customer expectations
4. **Alternative suggestions limited to same brand** - Could cross-recommend

---

## Database Schema Changes

### New Table: conversation_history
```sql
CREATE TABLE conversation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  quote_id UUID REFERENCES quotes(id) ON DELETE CASCADE,
  message_index INT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_conversation_history_session ON conversation_history(session_id);
CREATE INDEX idx_conversation_history_quote ON conversation_history(quote_id);
```

### Modified Table: quotes
```sql
ALTER TABLE quotes
  ALTER COLUMN flow_type TYPE TEXT,
  DROP CONSTRAINT quotes_flow_type_check,
  ADD CONSTRAINT quotes_flow_type_check
    CHECK (flow_type IN ('system_design', 'simple_quote', 'tender', 'ai_native'));
```

---

## End-to-End User Flow (After Implementation)

**User:** "Hi, I need a 5.1.2 Dolby Atmos cinema system, plus speakers for the bar and dining room. Budget is R200k for cinema, R50k for bar and dining."

**AI:** "Perfect! Let me help you build a complete multi-zone audio solution.

Budget Allocation:
- Cinema (5.1.2 Atmos): R200,000
- Bar (high-output): R25,000
- Dining (background music): R25,000

Let's start with your cinema's AVR. For a 5.1.2 Atmos system, you'll need a receiver with at least 7 channels. Here are my top recommendations:"

[Shows 4 AVR options]

**User:** [Clicks Denon AVR-X2800H - R20,990]

**AI:** "Excellent choice! The Denon AVR-X2800H is perfect for 5.1.2 Atmos. Budget remaining: R179,010.

Now for your front left/right speakers. Here are great options that pair well with the Denon:"

[Shows 4 speaker options]

**User:** [Clicks Klipsch R-600F - R23,390]

**AI:** "Great! Klipsch speakers are known for dynamic sound. Budget remaining: R155,620.

Now let's find a matching center channel to complete your front soundstage:"

[Shows 3 Klipsch center channels]

**User:** [Clicks Klipsch R-30C - R8,390]

**AI:** "Perfect match! Budget remaining: R147,230. Next we need surround speakers:"

[Shows 3 Klipsch surround options]

**User:** [Selects surrounds]

**AI:** "Now for the subwoofer to handle the .1 low-frequency effects:"

[Shows 3 Klipsch subs]

**User:** [Selects Klipsch R-121SW - R11,990]

**AI:** "Excellent! For your .2 Atmos setup, you need 2 height speakers. These Klipsch options are designed for overhead effects:"

[Shows 2 height speaker options]

**User:** [Selects height speakers]

**AI:** "🎉 Your 5.1.2 Dolby Atmos cinema system is complete! Total: R87,550 (under your R200k budget).

Now let's tackle the bar. You mentioned you want 'big sound' - I'm thinking high-output speakers. What's the approximate size of the bar area?"

[Continues to bar zone...]

**User:** "Actually, I don't like that subwoofer. Remove it."

[Clicks delete button on R-121SW in quote sidebar]

**AI:** "I've removed the Klipsch R-121SW from your quote (R11,990 refunded). Budget remaining: R159,220.

Here are some alternative subwoofer options that will pair beautifully with your Klipsch system:"

[Shows 3 alternative Klipsch subs]

---

## Summary

This plan addresses all critical production blockers identified in the chat log:
- ✅ 5.1.2 detection (height speakers included)
- ✅ Multi-room handling (all zones completed)
- ✅ Context preservation (no mid-design restarts)
- ✅ Delete with alternatives (immediate suggestions)
- ✅ Conversation persistence (survives restarts)
- ✅ Budget tracking (never over-recommend)

**Estimated Total Implementation Time:** 22-32 hours across 4 deployment stages

**Risk Level:** Medium (database changes, multi-system coordination)

**Production Readiness After:** 85-90% (handles vast majority of real-world scenarios)