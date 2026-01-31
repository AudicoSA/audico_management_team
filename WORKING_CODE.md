# Working Code to Keep

This file contains code that **works** and should be preserved in the rebuild.

---

## 1. Hybrid Search API (`app/api/search/route.ts`)

This is the core search functionality that works well:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

interface SearchFilters {
  min_price?: number;
  max_price?: number;
  brand?: string;
  category?: string;
  in_stock_only?: boolean;
}

interface SearchRequest {
  query: string;
  filters?: SearchFilters;
  k?: number;
}

export async function POST(req: NextRequest) {
  try {
    const body: SearchRequest = await req.json();
    const { query, filters = {}, k = 100 } = body;

    if (!query || query.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Query is required' },
        { status: 400 }
      );
    }

    // Generate embedding for query using OpenAI
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: query,
    });
    const queryEmbedding = embeddingResponse.data[0].embedding;

    // Call hybrid search function
    const { data, error } = await supabase.rpc('hybrid_product_search', {
      query_text: query,
      query_embedding: queryEmbedding,
      min_price: filters.min_price || 0,
      max_price: filters.max_price || 999999999,
      brand_filter: filters.brand || null,
      category_filter: filters.category || null,
      in_stock_only: filters.in_stock_only ?? false,
      result_limit: Math.min(k, 500),
      vector_weight: 0.5,
      bm25_weight: 0.5,
    });

    if (error) throw error;

    // Transform results
    const items = (data || []).map((product: any) => ({
      id: product.id,
      name: product.product_name,
      sku: product.sku,
      model: product.model,
      brand: product.brand,
      category: product.category_name,
      price: parseFloat(String(product.retail_price || 0)),
      cost: parseFloat(String(product.cost_price || 0)),
      stock: {
        total: product.total_stock,
        jhb: product.stock_jhb,
        cpt: product.stock_cpt,
        dbn: product.stock_dbn,
      },
      images: product.images || [],
      specifications: product.specifications || {},
    }));

    return NextResponse.json({
      success: true,
      query,
      items,
      count: items.length,
    });
  } catch (error: any) {
    console.error('Search API error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
```

---

## 2. Hybrid Search SQL Function

Keep this in Supabase:

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
) AS $$
BEGIN
  RETURN QUERY
  WITH vector_search AS (
    SELECT
      p.id,
      (1 - (p.embedding <=> query_embedding))::double precision AS similarity
    FROM products p
    WHERE
      (NOT in_stock_only OR (p.stock_jhb + p.stock_cpt + p.stock_dbn) > 0)
      AND p.retail_price BETWEEN min_price AND max_price
      AND (brand_filter IS NULL OR p.brand ILIKE brand_filter)
      AND (category_filter IS NULL OR p.category_name ILIKE category_filter)
      AND p.active = TRUE
      AND (p.use_case IS NULL OR LOWER(p.use_case) != 'car_audio')
      AND (
        use_case_filter IS NULL
        OR LOWER(p.use_case) = LOWER(use_case_filter)
        OR LOWER(p.use_case) = 'both'
        OR p.use_case IS NULL
      )
  ),
  bm25_search AS (
    SELECT
      p.id,
      ts_rank_cd(
        to_tsvector('english',
          COALESCE(p.product_name, '') || ' ' ||
          COALESCE(p.brand, '') || ' ' ||
          COALESCE(p.model, '') || ' ' ||
          COALESCE(p.category_name, '')
        ),
        plainto_tsquery('english', query_text)
      )::double precision AS rank
    FROM products p
    WHERE
      (NOT in_stock_only OR (p.stock_jhb + p.stock_cpt + p.stock_dbn) > 0)
      AND p.retail_price BETWEEN min_price AND max_price
      AND (brand_filter IS NULL OR p.brand ILIKE brand_filter)
      AND (category_filter IS NULL OR p.category_name ILIKE category_filter)
      AND p.active = TRUE
      AND (p.use_case IS NULL OR LOWER(p.use_case) != 'car_audio')
      AND (
        use_case_filter IS NULL
        OR LOWER(p.use_case) = LOWER(use_case_filter)
        OR LOWER(p.use_case) = 'both'
        OR p.use_case IS NULL
      )
  ),
  combined_scores AS (
    SELECT
      COALESCE(vs.id, bm.id) AS product_id,
      (COALESCE(vs.similarity, 0) * vector_weight +
      COALESCE(bm.rank, 0) * bm25_weight)::double precision AS hybrid_score,
      COALESCE(vs.similarity, 0)::double precision AS vec_score,
      COALESCE(bm.rank, 0)::double precision AS bm25_score
    FROM vector_search vs
    FULL OUTER JOIN bm25_search bm ON vs.id = bm.id
  )
  SELECT
    p.id,
    p.product_name,
    p.sku,
    p.model,
    p.brand,
    p.category_name,
    p.retail_price,
    p.cost_price,
    (p.stock_jhb + p.stock_cpt + p.stock_dbn) AS total_stock,
    p.stock_jhb,
    p.stock_cpt,
    p.stock_dbn,
    p.images,
    p.specifications,
    p.supplier_id,
    p.active,
    cs.hybrid_score,
    cs.vec_score,
    cs.bm25_score,
    p.use_case
  FROM combined_scores cs
  JOIN products p ON p.id = cs.product_id
  ORDER BY cs.hybrid_score DESC
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql STABLE;
```

---

## 3. Product Card Component Styling

The visual styling of product cards is good. Keep the basic structure:

```tsx
// Key styles to preserve
<div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow">
  <div className="relative h-48">
    <Image src={product.images[0]} alt={product.name} fill className="object-contain p-4" />
  </div>
  <div className="p-4">
    <h3 className="font-semibold text-gray-900 line-clamp-2">{product.name}</h3>
    <p className="text-sm text-gray-500">{product.brand}</p>
    <p className="text-lg font-bold text-primary">R{product.price.toLocaleString()}</p>
    <button onClick={onSelect} className="w-full mt-2 bg-primary text-white py-2 rounded-lg">
      Add to Quote
    </button>
  </div>
</div>
```

---

## 4. Chat UI Layout

The basic chat layout works. Key components:
- Message list with auto-scroll
- Input field at bottom
- Product cards displayed inline in conversation
- Step indicator showing progress

---

## 5. Currency Formatting

```typescript
function formatCurrency(value: number | undefined): string {
  if (!value || Number.isNaN(value)) {
    return 'N/A';
  }
  return `R${Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}`;
}
```

---

## What NOT to Keep

- `lib/product-plan.ts` - Overcomplicated
- `lib/bom-normalizer.ts` - Not needed with simple approach
- `lib/chat/guardrails.ts` - Caused more problems than solved
- Complex frontend state management
- Zone handling code
- Brand matching logic
- AI tool definitions (chat-tools.ts)

---

## Technology Stack (Keep)

- **Next.js 14** - App router
- **Supabase** - PostgreSQL + Auth
- **OpenAI** - `text-embedding-3-small` for embeddings, `gpt-4-turbo` for chat
- **Tailwind CSS** - Styling
- **TypeScript** - Type safety
