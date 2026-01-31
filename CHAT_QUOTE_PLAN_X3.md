# AUDICO Chat Quote X3 - Handover Plan

## Project Overview

**AUDICO Chat Quote** is an AI-powered audio equipment quote builder for Audico, a South African audio retailer. Users describe their needs (home cinema, restaurant BGM, gym, conference room, etc.) and the system guides them through selecting appropriate products step-by-step.

**Tech Stack:**
- Next.js 14 App Router
- Supabase PostgreSQL with pgvector (embeddings)
- Claude API (Anthropic) for conversation
- OpenAI API for embeddings + product classification
- TypeScript

**Repository:** `D:\AUDICO-CHAT-QUOTE-X\audico-chat-quote`

---

## What We Built (X2 Session)

### 1. Product Enrichment System
- Added `component_type` column to products table
- Created AI classification using GPT-4o-mini to categorize products (avr, fronts, center, surrounds, subwoofer, amp, ceiling_speakers, outdoor_speakers, etc.)
- Built bulk enrichment script and admin dashboard at `/admin/enrichment`
- ~51% of products enriched so far

### 2. Smart Search with Fallbacks
**File:** `src/lib/search.ts`

- `searchByComponentType()` - Fast direct DB query on enriched `component_type` field
- `smartSearchForComponent()` - Tries component_type first, falls back to semantic search
- `searchProductsSafe()` - Wraps semantic search with timeout protection, falls back to keyword search
- `searchByKeywords()` - Fast ilike-based search without embeddings

### 3. Product Filtering
**File:** `src/lib/search.ts`

Added filters to exclude wrong products:
- `CAR_AUDIO_KEYWORDS` - Filters out Hertz, JBL Club, Focal KIT, coaxial speakers, etc.
- `NON_HOME_AUDIO_BRANDS` - Hertz, AudioQuest, QTX
- `NOT_AN_AMPLIFIER_KEYWORDS` - Turntables (Gemini TT), headphone amps (Tone Pocket), car amps
- `COMPONENT_MIN_PRICES` - Minimum prices per component to filter junk (e.g., subwoofer R5000+)
- `filterOutCarAudio()` and `filterOutNonAmplifiers()` functions

### 4. Natural Conversation in Flows
**File:** `src/app/api/chat/route.ts`

- Removed rigid "select a product" responses
- Added `detectProductTypeRequest()` - Detects when user asks for floor/bookshelf/ceiling/wall/outdoor speakers
- Added `answerFlowQuestion()` - Uses Claude to answer questions mid-flow with database context
- System searches actual products and tells Claude to ONLY recommend those (prevents hallucination)

### 5. Timeout Protection
**File:** `src/lib/search.ts` + `src/app/api/chat/route.ts`

- Created `searchProductsSafe()` that catches timeout errors and falls back to keyword search
- Applied to: conference flow, gym flow, simple quote flow
- Prevents "statement timeout" errors on semantic search

### 6. Product Sorting
- Products now sorted by: `stock_jhb DESC, retail_price ASC`
- User mentioned wanting custom "training priority" sorting later

---

## Current State

### Working Flows
1. **Restaurant/BGM Flow** - 2-zone system with amps + ceiling + outdoor speakers
2. **Home Cinema 5.1 Flow** - AVR + fronts + center + surrounds + subwoofer
3. **Conference Flow** - Small/medium/large room speakerphones (with timeout fallback)
4. **Gym Flow** - PA speakers + wireless mics (with timeout fallback)
5. **Simple Quote** - Direct product search

### Known Issues Still Present

1. **JBL Car Amplifier showing in restaurant amp results** (line 31-41 in chat_copy.txt)
   - The filter `NOT_AN_AMPLIFIER_KEYWORDS` includes "car amplifier" but it's not being applied to the restaurant flow
   - The restaurant flow uses `smartSearchForComponent("amp")` which applies `filterOutNonAmplifiers()`
   - **Debug needed:** Check if "JBL AMPRF3004A 75 WATT Car Amplifier" contains "car amplifier" lowercase

2. **Enrichment incomplete** - Only ~51% of products have `component_type` set
   - Run more enrichment batches via `/admin/enrichment`
   - Or run the bulk script: `npx ts-node scripts/enrich-products.ts`

3. **Custom sorting not implemented** - User wants "training priority" products first, not cheapest first

---

## Key Files

| File | Purpose |
|------|---------|
| `src/app/api/chat/route.ts` | Main chat handler - intent detection, flow routing, question answering |
| `src/lib/search.ts` | All search functions - semantic, component-type, keyword, filters |
| `src/lib/flows/system-design/engine.ts` | Guided flow engine - steps, product selection, quote building |
| `src/lib/flows/simple-quote/engine.ts` | Simple quote engine |
| `src/lib/agent/specialist.ts` | Claude tool-calling agent for recommendations (optional, feature-flagged) |
| `src/lib/agent/knowledge.ts` | Product category definitions and compatibility rules |
| `src/lib/types.ts` | TypeScript types for Product, Requirements, Steps, etc. |
| `src/app/admin/enrichment/page.tsx` | Admin dashboard for product enrichment |

---

## Database Schema (Key Fields)

**products table:**
```sql
- id (uuid)
- sku (text)
- product_name (text)
- brand (text)
- category_name (text)
- retail_price (numeric)
- cost_price (numeric)
- stock_jhb, stock_cpt, stock_dbn (int)
- component_type (text) -- NEW: avr, fronts, center, surrounds, subwoofer, amp, ceiling_speakers, outdoor_speakers, wall_speakers, source, accessory, null
- embedding (vector) -- OpenAI embeddings for semantic search
- active (boolean)
```

**quotes table:**
```sql
- id (uuid)
- session_id (text)
- requirements (jsonb)
- items (jsonb)
- status (text)
- created_at, updated_at (timestamp)
```

---

## Environment Variables

```env
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ... (for server-side)
```

---

## Next Steps (Priority Order)

### P1: Fix JBL Car Amplifier Bug
The "JBL AMPRF3004A 75 WATT Car Amplifier" is still showing in restaurant amp results.
- Check `filterOutNonAmplifiers()` in search.ts
- The product name contains "Car Amplifier" - should match "car amplifier" keyword
- May need to debug why it's not being filtered

### P2: Complete Product Enrichment
- Run enrichment to get remaining ~49% of products classified
- Option 1: Use admin dashboard at `/admin/enrichment`
- Option 2: Run `npx ts-node scripts/enrich-products.ts`

### P3: Implement Training Priority Sorting
User wants products they can provide "personal training" on to appear first, not cheapest.
- Need user to provide criteria (brand list? margin threshold? manual flag?)
- Add `training_priority` field to products table OR
- Create a `priority_brands` config list

### P4: Test All Flows End-to-End
- [ ] Home cinema 5.1/7.1 flow
- [ ] Restaurant 2-zone BGM flow
  - [ ] **Pendant speakers** - had issues earlier, verify they show correctly for indoor speakers
- [ ] Conference small/medium/large
- [ ] Gym with/without spin studio
- [ ] Church/worship (partially implemented)
- [ ] Simple product quote

### P5: Add Skip Functionality UI
- Backend skip works via typing "skip"
- Need proper skip button in UI

### P6: Improve AVR Detection
- AVRs still sometimes mix with other products
- Consider adding `COMPONENT_BRAND_PATTERNS.avr` stricter regex

---

## Testing Commands

```bash
# Start dev server
cd audico-chat-quote
npm run dev

# Build (checks for TypeScript errors)
npm run build

# Run enrichment script
npx ts-node scripts/enrich-products.ts
```

---

## Test Scenarios

### Restaurant BGM
```
User: "need sound for my restaurant please, 2 zones - main zone and outside patio"
Expected: Should start guided flow with Zone 1 Amp -> Zone 2 Amp -> Indoor Speakers -> Outdoor Speakers
```

### Home Cinema
```
User: "5.1 home cinema for my lounge, R80k budget"
Expected: Should start guided flow with AVR -> Fronts -> Center -> Surrounds -> Subwoofer
```

### Conference Room
```
User: "conference room"
Then: "large / zoom and teams / have nothing"
Expected: Should show conference speakerphones for large boardroom
```

### Natural Conversation
```
User (during fronts step): "floor please"
Expected: Should show floorstanding speakers and update product display
```

---

## Architecture Notes

### Search Flow
```
User Query
    ↓
searchProductsSafe() ← timeout protection
    ↓
searchProducts() ← semantic search with embeddings
    ↓ (on timeout)
searchByKeywords() ← fast ilike fallback
```

### Component Search Flow
```
smartSearchForComponent(component)
    ↓
searchByComponentType() ← uses enriched component_type field
    ↓ (if < 3 results)
searchForComponent() ← semantic search with category filters
    ↓
Apply filters: filterOutCarAudio(), filterOutNonAmplifiers()
```

### Chat Flow Detection
```
Message → detectIntent() → extractRequirements()
    ↓
system_design → SystemDesignEngine (guided steps)
simple_quote → SimpleQuoteEngine (direct search)
video_conference → Discovery questions → searchProductsSafe()
commercial_bgm → Discovery questions → SystemDesignEngine
commercial_loud → Discovery questions → searchProductsSafe()
```

---

## Contact / Context

- User is building this for Audico (South African audio retailer)
- Products include: home cinema, commercial BGM, conference, gym/fitness audio
- Prices in South African Rand (R)
- Stock primarily in JHB warehouse

---

*Last updated: Session X2 - January 2026*
