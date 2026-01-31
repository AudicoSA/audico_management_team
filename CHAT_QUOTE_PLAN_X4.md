# The System You Actually Need: AI-Native Architecture

## Executive Summary

**Stop patching regex patterns. Build an AI-native system that scales.**

The current system fails because it tries to **predict** what users will say (regex patterns). This is impossible.

**The solution:** Let Claude (Opus/Sonnet) **understand** what users mean, then give it tools to find products.

---

## The Problem With Current Architecture

```
Current (BROKEN):
User: "workout facility audio"
  ↓
Regex: /gym|club|loud|dance|fitness/ → NO MATCH
  ↓
Defaults to: "simple_quote" or asks vague questions
  ↓
FAILS to understand user intent
```

**Why it fails:**
- Needs thousands of regex patterns for every variation
- Can't understand "workout facility" = "gym"
- Can't handle: "spinning classes", "exercise studio", "training center", etc.
- Every new phrase requires code changes

---

## The Right Architecture: Claude-Powered Conversational AI

```
Correct (AI-NATIVE):
User: "workout facility audio"
  ↓
Claude AI: Understands "workout facility" = commercial gym audio
  ↓
Claude: Uses tool_search_products(category="commercial_audio", use_case="gym")
  ↓
Claude: "I understand you need audio for your workout facility..."
  ↓
SUCCESS - handles ANY phrasing
```

**Why it works:**
- Claude understands natural language variations automatically
- No regex patterns needed
- Scales to infinite phrasings
- Self-improving through better prompts

---

## System Architecture: 3-Layer Design

### Layer 1: Conversation Handler (Claude Opus/Sonnet)

**Single Entry Point** - ALL messages go through Claude first:

```typescript
// src/app/api/chat/route.ts

async function handleChat(message: string, context: ConversationContext) {
  const claude = new Claude({
    model: "claude-opus-4-5",
    system: MASTER_SYSTEM_PROMPT,
    tools: [
      searchProductsByCategory,
      searchProductsByKeyword,
      filterProducts,
      getProductDetails,
      createQuote,
      updateQuote,
      askClarifyingQuestion,
    ]
  });

  const response = await claude.chat(message, {
    conversationHistory: context.messages,
    currentQuote: context.quote,
    selectedProducts: context.selectedProducts,
  });

  return response;
}
```

**Master System Prompt:**
```
You are an expert AV sales consultant for Audico, South Africa's leading AV retailer.

Your job: Understand what the customer needs, ask smart questions, and recommend the right products.

## YOUR TOOLS

1. searchProductsByCategory(category, filters)
   - Categories: home_cinema, commercial_bgm, commercial_loud, video_conference
   - Use this when you understand the use case

2. searchProductsByKeyword(keywords, filters)
   - Use for specific product requests ("Denon AVR", "JBL subwoofer")

3. filterProducts(products, criteria)
   - Filter results by: price, brand, specs, use_case

4. getProductDetails(sku)
   - Get full specs for a specific product

5. createQuote(type, requirements)
   - Create a quote once you understand customer needs

6. updateQuote(quoteId, updates)
   - Modify existing quote

7. askClarifyingQuestion(question, options)
   - Ask customer for more details

## YOUR PROCESS

**First Message:**
1. Understand the use case from customer's description
2. If unclear, ask clarifying questions
3. Once clear, search products and recommend

**Follow-up Messages:**
1. Use conversation history to maintain context
2. If they want alternatives, search with different criteria
3. If they change requirements, update the quote

## USE CASE DETECTION

You're smart enough to understand:
- "workout facility" = gym (commercial_loud)
- "spinning classes" = gym with class studio
- "coffee shop music" = restaurant (commercial_bgm)
- "boardroom video" = video conference
- "movie room" = home cinema
- "training center" = gym or conference (ask to clarify)

DON'T rely on exact keywords - use your understanding.

## PRODUCT RECOMMENDATIONS

**For home cinema:**
- MUST be passive speakers (no active/powered for systems with AVR)
- Brands: JBL Stage, Klipsch, Polk, Denon, Marantz

**For commercial (gym/restaurant):**
- Active/powered speakers OK
- 100V systems for distributed audio
- Commercial-grade durability

**For video conference:**
- All-in-one systems (Yealink, Poly, Jabra) for simplicity
- Or separate camera + speakerphone for larger rooms

## RESPONSE STYLE

- Enthusiastic but professional
- Explain WHY you recommend products
- Ask smart follow-up questions
- Prices in South African Rand (R)
```

### Layer 2: Product Search Engine

**Two approaches - CHOOSE ONE:**

#### Option A: Gemini File Search (RECOMMENDED - Fastest to implement)

```typescript
// src/lib/search/gemini-search.ts

import { GoogleAIFileManager, GoogleGenerativeAI } from "@google/generative-ai";

export class GeminiProductSearch {
  private fileManager: GoogleAIFileManager;
  private genAI: GoogleGenerativeAI;
  private fileSearchStore: string; // ID of uploaded product catalog

  async searchByCategory(
    category: "home_cinema" | "commercial_bgm" | "commercial_loud" | "video_conference",
    filters: SearchFilters
  ): Promise<Product[]> {
    const result = await this.genAI.generateContent({
      model: "gemini-2.0-flash",
      contents: [{
        role: "user",
        parts: [{ text: `Find products for ${category} within budget ${filters.budget}` }]
      }],
      tools: [{
        fileSearchTool: {
          fileSearchConfig: {
            metadataFilter: {
              category: category,
              min_price: filters.minPrice,
              max_price: filters.maxPrice,
            },
            top_k: 10
          }
        }
      }]
    });

    return this.parseProductsFromGemini(result);
  }

  async uploadProductCatalog() {
    // Export from Supabase to CSV with metadata
    const products = await this.exportFromSupabase();

    // Upload to Gemini File Search
    const uploadResult = await this.fileManager.uploadFile("products.csv", {
      displayName: "Audico Product Catalog",
      metadata: {
        version: new Date().toISOString(),
        product_count: products.length.toString()
      }
    });

    this.fileSearchStore = uploadResult.file.name;
  }
}
```

**CSV Format:**
```csv
sku,name,brand,price,category,component_type,use_case,specifications
AVRX2800H,Denon AVRX2800H,Denon,20990,home_cinema,avr,home,"{channels:7.2,power:95w}"
COL81W,BiAmp Column Speaker,BiAmp,13830,commercial_loud,speakers,commercial,"{power:100w,spl:120db}"
```

#### Option B: Enhanced Supabase (More control, more work)

```typescript
// src/lib/search/enhanced-search.ts

export class EnhancedProductSearch {
  async searchByCategory(
    category: string,
    filters: SearchFilters
  ): Promise<Product[]> {
    // Step 1: Filter by category FIRST (structured data)
    let query = supabase
      .from("products")
      .select("*")
      .eq("category", category)
      .eq("active", true);

    if (filters.minPrice) query = query.gte("price", filters.minPrice);
    if (filters.maxPrice) query = query.lte("price", filters.maxPrice);

    const { data } = await query;

    // Step 2: THEN apply semantic search within category
    if (filters.keywords) {
      return await this.semanticRankWithinResults(data, filters.keywords);
    }

    return data;
  }

  async semanticRankWithinResults(
    products: Product[],
    keywords: string
  ): Promise<Product[]> {
    // Use vector similarity only within pre-filtered results
    // This prevents "passive" matching PoE injectors
    // because PoE injectors are already excluded by category filter
  }
}
```

### Layer 3: Quote Management

**Simple, stateful quote engine:**

```typescript
// src/lib/quote/quote-engine.ts

export class QuoteEngine {
  async createQuote(
    type: QuoteType,
    requirements: Requirements
  ): Promise<Quote> {
    const quote = {
      id: uuidv4(),
      type,
      requirements,
      items: [],
      status: "draft",
      createdAt: new Date(),
    };

    await supabase.from("quotes").insert(quote);
    return quote;
  }

  async addProduct(quoteId: string, product: Product) {
    // Add product to quote
    // Update total
    // Return updated quote
  }

  async removeProduct(quoteId: string, productSku: string) {
    // Remove product from quote
  }

  async updateRequirements(quoteId: string, requirements: Partial<Requirements>) {
    // Customer changed their mind? No problem - update requirements
    // Claude can handle this naturally
  }
}
```

---

## Implementation Plan (The RIGHT Way)

### Week 1: Build AI Layer

**Day 1-2: Claude Integration**
```typescript
// Create master conversation handler
// Write comprehensive system prompt
// Define tool schema
// Test with mock tools
```

**Day 3: Tool Implementation**
```typescript
// searchProductsByCategory()
// searchProductsByKeyword()
// filterProducts()
// getProductDetails()
```

**Day 4-5: Quote Management**
```typescript
// createQuote()
// updateQuote()
// Simple CRUD operations
```

### Week 2: Product Search Layer

**Choose Path A or B:**

**Path A: Gemini File Search** (RECOMMENDED)
- Day 1: Export products to CSV with rich metadata
- Day 2: Upload to Gemini, test queries
- Day 3: Integrate with Claude layer
- Day 4-5: Test accuracy, tune metadata filters

**Path B: Enhanced Supabase**
- Day 1-2: Add category, component_type fields
- Day 3: Build category-first search
- Day 4-5: Test and validate

### Week 3: Testing & Refinement

**Day 1-3: Comprehensive Testing**
- Run test suite (50+ scenarios)
- Document failure rate
- Tune system prompts based on failures

**Day 4-5: Edge Cases**
- Handle ambiguity ("training center" = gym or conference?)
- Handle specification requests ("needs to be weatherproof")
- Handle budget constraints

---

## Why This Architecture Works

### 1. Handles Infinite Phrasings

**Current System:**
```typescript
if (/gym|club|loud|dance|fitness/i.test(message)) // FRAGILE
```

**AI-Native System:**
```
Claude understands:
- "workout facility" ✓
- "spinning studio" ✓
- "pilates and yoga center" ✓
- "training facility" ✓
- "exercise classes venue" ✓
WITHOUT any code changes
```

### 2. Self-Documenting

The system prompt IS the documentation. Want to add support for churches? Update the prompt:

```diff
## USE CASE DETECTION

You're smart enough to understand:
- "workout facility" = gym (commercial_loud)
- "spinning classes" = gym with class studio
+ "church audio" = worship (high-quality, speech clarity)
+ "house of worship" = worship
```

Done. No code changes.

### 3. Conversational Memory

Claude maintains context naturally:

```
User: "Need audio for my gym"
Claude: "Great! A few questions..."
User: "150m2, yes we do spin classes"
Claude: [remembers it's a gym] "Perfect, for a gym with spin classes..."
```

No manual sessionId juggling, no context loss bugs.

### 4. Intelligent Product Filtering

Claude can reason about product suitability:

```
User: "Need speakers for outdoor patio at my restaurant"
Claude:
  1. Searches category="commercial_bgm"
  2. Filters for weatherproof=true
  3. Excludes indoor-only products
  4. Recommends 3 options with IP ratings explained
```

All through natural reasoning + tools.

---

## Migration Strategy

**Don't rewrite everything at once. Parallel run:**

### Phase 1: Add AI layer alongside current system

```typescript
// New endpoint
POST /api/chat/ai-native

// Old endpoint (keep running)
POST /api/chat (current system)
```

### Phase 2: A/B test with real users

- 50% traffic → AI-native
- 50% traffic → Current system
- Compare:
  - Completion rate
  - Customer satisfaction
  - Products selected
  - Support tickets

### Phase 3: Migrate fully

Once AI-native proves better:
- Redirect all traffic
- Deprecate old system
- Remove regex patterns

---

## Cost Analysis

### Option A: Gemini File Search + Claude

**Setup:**
- Gemini File Search: $0.15 per 1M tokens (one-time indexing) ≈ $5
- Daily CSV sync: Automated script

**Running Costs (per month at 10,000 conversations):**
- Claude API: ~$50-100 (most conversations = 2-3 turns)
- Gemini queries: ~$20-30 (product search)
- Supabase: $25 (existing)

**Total: ~$100-150/month**

### Option B: Enhanced Supabase + Claude

**Setup:**
- Data enrichment: 2-3 weeks developer time
- Add component_type fields: 1 week

**Running Costs (per month):**
- Claude API: ~$50-100
- Supabase: $25-50 (larger DB)
- Vector embeddings: Included

**Total: ~$75-150/month + 3-4 weeks dev time**

**Recommendation: Option A** - Faster to market, less maintenance

---

## Testing Strategy

### Comprehensive Test Suite

```bash
# Test natural language variations
./test_nlp_variations.sh

Examples:
- "workout facility audio" → gym ✓
- "spinning classes sound" → gym + class studio ✓
- "coffee shop background music" → commercial BGM ✓
- "boardroom video meetings" → video conference ✓
- "movie room at home" → home cinema ✓
- "pilates studio" → gym (light music) ✓
- "crossfit box" → gym (loud music) ✓
```

### Edge Case Testing

```bash
# Ambiguous requests
- "training center audio" → Ask: fitness or corporate training?
- "speakers for my space" → Ask: what type of space?
- "need a microphone" → Ask: for what purpose?

# Specification requirements
- "outdoor speakers for patio" → Filter weatherproof=true
- "passive speakers under 10k" → Filter passive=true, price<10000
- "7.1 home cinema under 100k" → Budget allocation across components

# Multi-turn conversations
- Change requirements mid-flow
- Ask for alternatives
- Go back and change earlier selections
```

### Success Metrics

**Must achieve before launch:**
- ✅ 95%+ intent detection accuracy
- ✅ 90%+ product relevance (no PoE injectors for audio searches)
- ✅ <5% conversation abandonment
- ✅ Zero "I don't understand" responses

---

## Critical Files to Create/Modify

### New Files (Create):

1. **`src/lib/ai/claude-handler.ts`** - Master Claude conversation handler
2. **`src/lib/ai/system-prompts.ts`** - All system prompts
3. **`src/lib/ai/tools.ts`** - Tool definitions for Claude
4. **`src/lib/search/gemini-search.ts`** OR **`src/lib/search/enhanced-search.ts`**
5. **`src/lib/quote/quote-engine.ts`** - Simplified quote management
6. **`scripts/export-to-gemini.ts`** - Export products to CSV for Gemini
7. **`scripts/test-all-flows.sh`** - Comprehensive test suite

### Modified Files:

1. **`src/app/api/chat/route.ts`** - Route to new AI handler
2. **`src/components/chat/unified-chat.tsx`** - Already has sessionId persistence ✓
3. **Database schema** - Add `category`, `component_type`, `specifications` columns (if not using Gemini)

---

## Implementation Timeline

| Week | Work | Deliverable |
|------|------|-------------|
| **Week 1** | Build AI layer | Working Claude handler with tools |
| **Week 2** | Implement search | Gemini OR Supabase search working |
| **Week 3** | Testing & refinement | 95%+ accuracy on test suite |
| **Week 4** | A/B testing | Parallel run with current system |
| **Week 5** | Full migration | AI-native as primary system |

**Total: 5 weeks to production-ready AI-native system**

---

## Why This is the RIGHT Solution

### Current Approach (Broken):
- Regex patterns for every phrase variation
- Keyword filters for product exclusions
- Manual bug fixes for each edge case
- **Result:** Whack-a-mole debugging forever

### AI-Native Approach (Correct):
- Claude understands natural language
- Tools for structured product search
- Learns from failures through prompt tuning
- **Result:** Scales to infinite phrasings

**You cannot predict every way a customer will ask for products.**

**But Claude can UNDERSTAND any way they ask.**

---

## Next Steps (What to Do NOW)

### Option 1: Start Building (Recommended)

```bash
# Create the foundation
mkdir -p src/lib/ai src/lib/search scripts
touch src/lib/ai/claude-handler.ts
touch src/lib/ai/system-prompts.ts
touch src/lib/ai/tools.ts

# Start with Week 1 work
# I can help write the Claude handler
```

### Option 2: Proof of Concept First

Test Claude's understanding WITHOUT building the full system:

```bash
# Quick test script
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-opus-4-5",
    "max_tokens": 1024,
    "messages": [{
      "role": "user",
      "content": "I need audio for my spinning studio"
    }],
    "system": "You are an AV sales expert. Classify this request into: home_cinema, commercial_bgm, commercial_loud, or video_conference. Explain your reasoning."
  }'
```

Test with 20 different phrasings. If Claude gets 95%+ correct → BUILD IT.

---

## The Bottom Line

**Current system:** Broken by design. Cannot scale to natural language variations.

**AI-native system:** Built for scale. Handles any phrasing. Production-ready in 5 weeks.

**Cost:** ~$100-150/month operational. 5 weeks development time.

**ROI:** Can finally go to market with confidence. No more "every test has a problem."

**Your choice:** Keep patching regex patterns forever, or build it right once.

I recommend: **Build it right. Start Week 1 tomorrow.**
