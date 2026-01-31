# AUDICO Chat Quote X2 - Comprehensive Handoff Plan

## Project Overview

An AI-powered audio equipment quote builder for Audico, a South African audio retailer. The system guides customers through building audio systems (home cinema, commercial/restaurant, gym) via a chat interface.

**Supabase Project:** `ajdehycoypilsegmxbto`
- ~15,000 products with embeddings
- `hybrid_product_search` RPC function exists
- Products have: name, sku, brand, price, stock, category_name, embeddings
- **NOTE:** There may be an existing RAG database setup from months ago - investigate!

---

## Current State: What Works

### Home Cinema Flow (5.1/7.1)
- Step-by-step guided flow: AVR → Fronts → Center → Surrounds → Subwoofer
- Brand matching (picks Klipsch center if Klipsch fronts selected)
- Smart sub filtering (excludes Denon Home, Sonos wireless subs)
- Package detection (speaker package skips center/surround steps)
- Single speaker quantity doubling (x2 if not sold as pair)
- Additional zone detection (mentions kitchen speakers at end)

### Commercial BGM Flow (Restaurant)
- Discovery questions (size, zones, indoor/outdoor, budget)
- Multi-zone step flow: Amp 1 → Amp 2 → Indoor Speakers → Outdoor Speakers
- Detection working: "restaurant" → commercial_bgm → discovery → commercial_bgm_details

### Simple Quote Flow
- Direct product search
- Add to quote functionality

---

## Current State: What's BROKEN

### 1. Search Returns Wrong Products
**Problem:** Searching for "amp" returns speakers, subwoofers, and random products.

**Examples from chat_copy.txt:**
- Amp search returned: "Sonos Era 100 Pro - Dual POE Commercial Speakers" (SPEAKER!)
- Amp search returned: "HK Audio SONAR 115 Sub D - 1500W Active PA Subwoofer" (SUBWOOFER!)
- Source search returned: "Lithe Audio 6.5" Bluetooth Ceiling Speaker" (SPEAKER not streamer!)

**Root Cause:** Semantic search (embeddings) doesn't understand product categories. "Amplifier" and "Speaker" have similar embeddings because they're both audio equipment.

**Attempted Fixes (partial success):**
- Added negative keyword filtering (exclude "speaker" from amp search)
- Added category_filter parameter to search
- Better search queries ("sonos amp yamaha musiccast" instead of generic)

### 2. Can't Skip Steps
**Problem:** User asked "these are not sources, lets skip please" but system just repeated the same products.

**Missing:** Skip step functionality

### 3. Can't Answer Questions Mid-Flow
**Problem:** User asked "can you confirm amp will drive both zones individually?" and got "Please select a product from the options above"

**Missing:** Question detection and handling during guided flow

### 4. No Real Intelligence
The system is essentially:
- Intent detection (AI) - GPT-4o
- Fixed step sequences (code)
- Keyword search (semantic + BM25)
- Text generation (AI) - Claude

There's no understanding of:
- What products ARE (amp vs speaker)
- Compatibility (can this amp drive those speakers?)
- Technical specifications
- Use case appropriateness

---

## Key Files

### Core Flow Engine
```
src/lib/flows/system-design/engine.ts    - Main quote engine
src/lib/flows/system-design/steps.ts     - Step definitions per scenario
src/lib/flows/simple-quote/engine.ts     - Simple quote engine
```

### Search
```
src/lib/search.ts                        - Product search (hybrid vector + BM25)
src/lib/supabase.ts                      - Database client & types
```

### API Routes
```
src/app/api/chat/route.ts                - Main chat endpoint, intent detection
src/app/api/system-design/select/route.ts - Product selection
src/app/api/simple-quote/add/route.ts    - Add item to quote
```

### Frontend
```
src/components/chat/unified-chat.tsx     - Main chat interface
src/components/products/product-card.tsx - Product display
src/components/products/product-grid.tsx - Product grid
```

### Types
```
src/lib/types.ts                         - All TypeScript types & Zod schemas
```

---

## Database Schema

### quotes table
```sql
CREATE TABLE quotes (
  id UUID PRIMARY KEY,
  session_id TEXT NOT NULL,
  flow_type TEXT NOT NULL,  -- 'system_design' | 'simple_quote' | 'tender'
  requirements JSONB,
  steps JSONB,
  current_step_index INT,
  selected_products JSONB,
  status TEXT,  -- 'in_progress' | 'complete'
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

### products table (existing)
- Has embeddings column for vector search
- Has category_name column (but may not be well-populated)
- Has brand, price, stock info

### hybrid_product_search RPC
Combines vector similarity (embeddings) with BM25 text search.

**Parameters:**
- query_text, query_embedding
- min_price, max_price
- brand_filter, category_filter
- in_stock_only
- use_case_filter ('Home' | 'Commercial')
- vector_weight, bm25_weight

---

## Recommended Solution: Specialist RAG Agent

### Why Current Approach Fails
1. **Semantic search is category-blind** - embeddings don't distinguish amps from speakers
2. **No product knowledge** - system doesn't know what products ARE
3. **No compatibility reasoning** - can't answer "will this amp drive those speakers?"
4. **No specification understanding** - power, impedance, channels are ignored

### Proposed Architecture

```
User Message
    ↓
Intent Detection (GPT-4o) ─────→ greeting/question/tender
    ↓
System Design Flow
    ↓
┌─────────────────────────────────────┐
│  SPECIALIST AGENT (Claude/GPT-4)    │
│                                     │
│  Context:                           │
│  - Current step (amp, speakers...)  │
│  - Requirements (zones, budget...)  │
│  - Selected products so far         │
│  - Product catalog subset (RAG)     │
│                                     │
│  Tools:                             │
│  - search_products(query, filters)  │
│  - get_product_details(sku)         │
│  - check_compatibility(amp, spkr)   │
│  - skip_step(reason)                │
│  - answer_question(question)        │
│                                     │
│  Output:                            │
│  - Recommended products (ranked)    │
│  - Explanation of why               │
│  - Compatibility notes              │
└─────────────────────────────────────┘
    ↓
Frontend Display
```

### RAG Database Requirements

Check if already exists in Supabase! Look for:
- Product specifications table
- Category hierarchy
- Compatibility rules
- Use case mappings

If not exists, need to build:

1. **Product Category Index**
```
amplifier -> [Sonos Amp, Yamaha RX-V6A, ...]
ceiling_speaker -> [Bose FS2CE, Tannoy CVS8, ...]
outdoor_speaker -> [Klipsch CP6T, Sonos Outdoor, ...]
streamer -> [WiiM Pro, Sonos Port, Bluesound Node, ...]
```

2. **Compatibility Rules**
```
Sonos Amp:
  - outputs: 2 channels, 125W/channel @ 8 ohms
  - works_with: passive speakers, 4-16 ohm
  - NOT: 100V line, active speakers
  - zones: single (need multiple for multi-zone)
```

3. **Use Case Mappings**
```
restaurant_small:
  - amp: Sonos Amp, Yamaha WXA-50
  - speakers: 2-4 ceiling speakers
  - budget: R15-30k

restaurant_2zone:
  - amps: 2x Sonos Amp OR multi-zone amp
  - indoor_speakers: 4+ ceiling
  - outdoor_speakers: weatherproof pair
  - budget: R40-80k
```

---

## Implementation Priority

### Phase 1: Fix Search (Quick Wins)
1. Query Supabase to find actual category names in data
2. Use category_filter to constrain results
3. Tighter negative keyword filtering
4. WiiM should be priority for "source" searches

### Phase 2: Skip & Questions
1. Add skip step API endpoint
2. Detect questions vs product selection in chat
3. Route questions to Claude for answering

### Phase 3: Specialist Agent
1. Build product knowledge base (or use existing RAG)
2. Create Claude tool-calling agent
3. Give it search, compatibility, and question tools
4. Replace simple keyword search with agent recommendations

---

## Environment Variables
```
NEXT_PUBLIC_SUPABASE_URL=https://ajdehycoypilsegmxbto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_KEY=...
OPENAI_API_KEY=...        # For embeddings & intent detection
ANTHROPIC_API_KEY=...     # For Claude responses
```

---

## Test Scenarios

### Home Cinema
```
User: "7.1 home cinema, R150k budget"
Expected: AVR products → Fronts → Center (brand-matched) → Surrounds → Subwoofer (no smart subs)
```

### Restaurant 2-Zone
```
User: "audio for my restaurant"
System: Discovery questions
User: "medium, 2 zones indoor + outdoor, R60k"
Expected: Amp 1 (Sonos Amp) → Amp 2 (Sonos Amp) → Indoor Ceiling → Outdoor Speakers
```

### Skip Step
```
User: (on source step) "skip please, amp has streaming"
Expected: Skip to next step or complete quote
```

### Mid-Flow Question
```
User: "will this amp drive both zones?"
Expected: Intelligent answer about amp capabilities, not "select a product"
```

---

## Key Insight

The fundamental problem is that **semantic search doesn't understand audio equipment categories**.

The embedding for "Sonos Amp" is similar to "Sonos Speaker" because they share:
- Brand name
- Audio context
- Similar descriptions

A specialist agent with product knowledge would know:
- Sonos Amp IS an amplifier (ComponentType: amp)
- Sonos Era 100 IS a speaker (ComponentType: speaker)
- WiiM Pro IS a streamer (ComponentType: source)

This knowledge could come from:
1. A curated category mapping table
2. Product specifications database
3. LLM with product catalog in context (RAG)

**CHECK SUPABASE FOR EXISTING RAG SETUP FIRST!**

---

## Commands

```bash
# Start dev server
cd audico-chat-quote
npm run dev

# Build
npm run build
```

---

## Contact / Context
- Database: Supabase project `ajdehycoypilsegmxbto`
- ~15K products with embeddings
- South African Rand (R) pricing
- Stock levels: JHB warehouse
