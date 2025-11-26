# Solution Technologies MCP Server

MCP server for integrating Solution Technologies Shopify JSON feed with unified Audico database.

## Features

- ✅ Shopify JSON API integration
- ✅ Continuous pagination (page + cursor-based)
- ✅ Multi-strategy pagination (page, since_id, offset)
- ✅ 15% VAT + 25% margin pricing
- ✅ Transforms to unified schema
- ✅ Session tracking
- ✅ HTML description parsing

## Installation

```bash
cd audico-mcp-servers/mcp-feed-solution-technologies
npm install
npm run build
```

## Configuration

Update `.env` file:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your-url
SUPABASE_SERVICE_KEY=your-key

# Solution Technologies
SOLUTION_TECHNOLOGIES_BASE_URL=https://solutiontechnologies.co.za
SOLUTION_TECHNOLOGIES_API_ENDPOINT=/collections/all/products.json
SOLUTION_TECHNOLOGIES_PAGE_LIMIT=250
```

## Usage

### Test Connection

```bash
npm run test
```

### Sync Products

```bash
# Dry run (no changes)
npm run sync -- --dry-run

# Sync 10 products
npm run sync -- --limit=10

# Full sync (all products with pagination)
npm run sync
```

## API Details

- **Base URL:** `https://solutiontechnologies.co.za`
- **Endpoint:** `/collections/all/products.json`
- **Format:** Shopify JSON
- **Pagination:** Multiple strategies (page, since_id, offset)
- **Rate Limiting:** 2 second delay between pages

## Pagination Strategy

The server uses **3 fallback pagination strategies**:

1. **Page-based:** `?limit=250&page=1`
2. **Cursor-based:** `?limit=250&since_id=123` (for page > 1)
3. **Offset-based:** `?limit=250&offset=250`

**Safety features:**
- Duplicate detection (by product ID)
- 100 page safety limit
- Stops when 0 products returned
- Stops when no new products found

## Data Mapping

| Shopify Field | Unified Field | Notes |
|--------------|---------------|-------|
| title | product_name | Product display name |
| variants[0].sku | sku | Product SKU |
| handle | model | URL handle |
| vendor | brand | Vendor/Brand |
| product_type | category_name | Mapped to categories |
| variants[0].price | cost_price | Cost excl VAT |
| price * 1.4375 | selling_price | 15% VAT + 25% margin |
| variants[0].available | active | Stock availability |
| images[].src | images | Image URLs array |
| body_html | description | Parsed HTML |

## Pricing Strategy

Solution Technologies uses **15% VAT + 25% margin**:
- Cost Price: from API (excl VAT)
- + 15% VAT: Cost × 1.15
- + 25% margin: (Cost × 1.15) × 1.25
- **Total markup: 43.75%** on original cost

## Product Type Mapping

| Shopify Type | Unified Category |
|-------------|------------------|
| Converters | Audio Visual |
| Control Systems | Networking |
| Speakers | Audio Visual |
| Amplifiers | Audio Visual |
| Microphones | Audio Visual |
| Cables | Accessories |
| Monitors | Audio Visual |
| Keyboards | Computing |
| Mice | Computing |
| (other) | Electronics |

## Notes

- Products with `available: false` are marked as inactive
- HTML descriptions are parsed and cleaned
- Default stock of 10 for available products
- Variants: Uses first variant for pricing/stock
- Multiple product images are preserved
- Tags and options stored in specifications
