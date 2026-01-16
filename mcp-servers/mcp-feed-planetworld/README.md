# Planet World MCP Server

MCP server for scraping Planet World products using Playwright browser automation with JavaScript extraction.

## Features

- ✅ Playwright-based browser automation
- ✅ JavaScript content extraction
- ✅ "Load More" button clicking for pagination
- ✅ Popup dismissal handling
- ✅ Product detail page scraping
- ✅ Transforms to unified schema
- ✅ Session tracking
- ✅ Rate limiting (polite scraping)

## Installation

```bash
cd audico-mcp-servers/mcp-feed-planetworld
npm install
npm run build
```

## Install Playwright Browsers

```bash
npx playwright install chromium
```

## Configuration

Update `.env` file:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your-url
SUPABASE_SERVICE_KEY=your-key

# Planet World
PLANETWORLD_BASE_URL=https://www.planetworld.co.za
PLANETWORLD_PRODUCTS_URL=/products

# Browser
HEADLESS=true
TIMEOUT=30000
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

# Full sync (default 100 products)
npm run sync
```

## Scraping Strategy

1. **Load Products Page**: Navigate to `/products`
2. **Dismiss Popups**: Auto-dismiss common popups (Accept, Continue, etc.)
3. **Click "Load More"**: Repeatedly click Load More buttons until limit reached
4. **Collect Links**: Extract all product detail page URLs
5. **Scrape Details**: Visit each product page and extract data via JavaScript
6. **Transform**: Convert to unified schema with pricing
7. **Store**: Upsert to Supabase unified products table

## Data Extraction

### JavaScript-Based Extraction

Planet World uses dynamic JavaScript content loading. The scraper:

- **Name**: Extracts from `<h1>` elements
- **SKU**: Searches for SKU patterns in DOM and text
- **Brand**: Extracts from brand links or infers from name
- **Price**: Parses "R12,999.00" format from price elements
- **Image**: Finds high-quality CDN images (storefront7.co.za)

### Example Product:

```json
{
  "sku": "ONENAV",
  "name": "OneNav Smart Navigation System",
  "price": 11699.10,
  "brand": "OneNav",
  "category": "Electronics",
  "image": "https://content.storefront7.co.za/media/...",
  "productUrl": "https://www.planetworld.co.za/products/onenav",
  "inStock": true
}
```

## Data Mapping

| Planet World Field | Unified Field | Notes |
|-------------------|---------------|-------|
| name | product_name | Product display name |
| sku | sku | Product SKU |
| sku | model | Also used as model |
| price | retail_price | Scraped price is RRP |
| price * 0.75 | cost_price | Cost is 25% less than RRP |
| brand | brand | Extracted from name/page |
| image | images | Array with single image |
| productUrl | specifications | Stored in specs |

## Pricing Strategy

Planet World pricing **corrected**:
- **Scraped Price**: Recommended Retail Price (RRP)
- **Cost Price**: RRP × 0.75 (25% less than retail)
- **Selling Price**: RRP (same as scraped)
- **Margin**: 25%

## Technical Details

- **Browser**: Chromium (Playwright)
- **Headless Mode**: Yes (configurable)
- **Rate Limiting**: 500ms delay every 20 products
- **Timeout**: 30 seconds per operation
- **Pagination**: ~16 products loaded per "Load More" click
- **User Agent**: `AudicoMCPScraper/1.0`

## Notes

- Playwright must be installed with `npx playwright install chromium`
- Scraping respects rate limits with polite delays
- Popups are automatically dismissed
- Session tracking maintains full audit trail
- Products are deduplicated by supplier_sku
