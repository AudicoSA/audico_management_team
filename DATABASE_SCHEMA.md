# Database Schema

Supabase PostgreSQL database with pgvector extension for embeddings.

## Core Tables

### products
The main product catalog table. Stores all product information with embeddings for semantic search.

```sql
-- This table should already exist in Supabase
-- Key columns based on the hybrid search function:
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_name TEXT NOT NULL,
  sku TEXT NOT NULL UNIQUE,
  model TEXT,
  brand TEXT,
  category_name TEXT,
  retail_price NUMERIC(10,2),
  cost_price NUMERIC(10,2),
  stock_jhb INT DEFAULT 0,
  stock_cpt INT DEFAULT 0,
  stock_dbn INT DEFAULT 0,
  images JSONB DEFAULT '[]',
  specifications JSONB DEFAULT '{}',
  supplier_id UUID REFERENCES suppliers(id),
  active BOOLEAN DEFAULT TRUE,
  use_case TEXT,  -- 'Home', 'Commercial', 'Both', 'Car_Audio'
  mounting_type TEXT,  -- 'ceiling', 'wall', 'floor', 'in-wall', etc.
  embedding vector(1536),  -- OpenAI text-embedding-3-small
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Required indexes
CREATE INDEX idx_products_embedding ON products USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX idx_products_brand ON products(brand);
CREATE INDEX idx_products_category ON products(category_name);
CREATE INDEX idx_products_active ON products(active);
CREATE INDEX idx_products_use_case ON products(use_case);
```

### suppliers
```sql
CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  normalized_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### conversations
```sql
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_type TEXT NOT NULL CHECK (chat_type IN ('home', 'business', 'restaurant', 'gym', 'worship', 'education', 'club', 'tender')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'completed')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### chat_messages
```sql
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Critical RPC Functions

### hybrid_product_search
The heart of the search system. Combines vector similarity (semantic) with BM25 (keyword) search.

```sql
CREATE OR REPLACE FUNCTION hybrid_product_search(
  query_text TEXT,
  query_embedding vector(1536),
  min_price NUMERIC DEFAULT 0,
  max_price NUMERIC DEFAULT 999999999,
  brand_filter TEXT DEFAULT NULL,
  category_filter TEXT DEFAULT NULL,
  in_stock_only BOOLEAN DEFAULT TRUE,
  result_limit INT DEFAULT 30,
  vector_weight NUMERIC DEFAULT 0.5,
  bm25_weight NUMERIC DEFAULT 0.5,
  use_case_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  product_name TEXT,
  sku TEXT,
  model TEXT,
  brand TEXT,
  category_name TEXT,
  retail_price NUMERIC,
  cost_price NUMERIC,
  total_stock INT,
  stock_jhb INT,
  stock_cpt INT,
  stock_dbn INT,
  images JSONB,
  specifications JSONB,
  supplier_id UUID,
  active BOOLEAN,
  hybrid_score DOUBLE PRECISION,
  vec_score DOUBLE PRECISION,
  bm25_score DOUBLE PRECISION,
  use_case TEXT
)
```

**Key features:**
- Always excludes `car_audio` products
- Supports `use_case_filter` for Home/Commercial scenarios
- Combines vector and BM25 with configurable weights
- Returns relevance scores for debugging

---

## Optional Tables (Feedback System)

### feedback_products
Tracks product interactions for learning.

```sql
CREATE TABLE feedback_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  product_sku TEXT NOT NULL,
  action_type TEXT CHECK (action_type IN ('shown', 'clicked', 'added', 'removed', 'ignored')),
  search_query TEXT,
  position_in_list INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### product_performance_scores
Computed relevance scores from feedback.

```sql
CREATE TABLE product_performance_scores (
  product_id TEXT PRIMARY KEY,
  times_shown INTEGER DEFAULT 0,
  times_clicked INTEGER DEFAULT 0,
  times_added INTEGER DEFAULT 0,
  click_through_rate DECIMAL(5,4),
  add_rate DECIMAL(5,4),
  relevance_score DECIMAL(5,4)
);
```

---

## New Tables for Quote Engine (Plan X)

The rebuild will need a simpler quote tracking table:

```sql
CREATE TABLE quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  requirements JSONB NOT NULL,
  steps JSONB NOT NULL,
  current_step_index INT DEFAULT 0,
  selected_products JSONB DEFAULT '[]',
  status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'complete', 'abandoned')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_quotes_session ON quotes(session_id);
CREATE INDEX idx_quotes_status ON quotes(status);
```

---

## Supabase Project Info

- **Project URL**: https://supabase.com/dashboard/project/ajdehycoypilsegmxbto
- **Region**: (check your dashboard)
- **pgvector**: Must be enabled for embeddings
- **Database size**: ~15,000+ products with embeddings
