# Supabase Configuration

## Your Existing Project

Your Supabase project is already set up with ~15,000+ products and embeddings.

**Project ID**: `ajdehycoypilsegmxbto`
**Dashboard**: https://supabase.com/dashboard/project/ajdehycoypilsegmxbto

## Connection Details

Copy these from your `.env.local` in the old project:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://ajdehycoypilsegmxbto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[copy from old .env.local]
SUPABASE_SERVICE_KEY=[copy from old .env.local]
```

## Required Extensions

Ensure these are enabled in Supabase SQL Editor:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;  -- For fuzzy text search
```

## Critical Functions

The `hybrid_product_search` function is already deployed. If you need to recreate it, see DATABASE_SCHEMA.md.

## Products Table Structure

The products table already exists with these key columns:
- `id` (UUID)
- `product_name` (TEXT)
- `sku` (TEXT)
- `brand` (TEXT)
- `retail_price` (NUMERIC)
- `stock_jhb`, `stock_cpt`, `stock_dbn` (INT)
- `embedding` (vector(1536))
- `use_case` (TEXT) - 'Home', 'Commercial', 'Both', 'Car_Audio'
- `images` (JSONB)

## New Table for Quote Engine

Run this in SQL Editor to create the quotes table:

```sql
CREATE TABLE IF NOT EXISTS quotes (
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

GRANT ALL ON quotes TO authenticated, service_role;
```
