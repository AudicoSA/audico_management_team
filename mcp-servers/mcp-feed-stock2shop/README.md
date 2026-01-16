# Stock2Shop (Linkqage) MCP Server

MCP server for integrating Stock2Shop API (Linkqage supplier) with unified Audico database.

## Features

- ✅ Official Stock2Shop API integration
- ✅ Elasticsearch product search
- ✅ Channel-specific access (LinkQage B2B - Channel 689)
- ✅ Rate limiting (3 requests/second)
- ✅ Trade pricing access
- ✅ Transforms to unified schema
- ✅ Session tracking

## Installation

```bash
cd audico-mcp-servers/mcp-feed-stock2shop
npm install
npm run build
```

## Configuration

Update `.env` file with your Stock2Shop credentials:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your-url
SUPABASE_SERVICE_KEY=your-key

# Stock2Shop
STOCK2SHOP_BASE_URL=https://api.stock2shop.com
STOCK2SHOP_USERNAME=your-username
STOCK2SHOP_PASSWORD=your-password
STOCK2SHOP_CHANNEL_ID=689  # LinkQage B2B Channel
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

# Full sync
npm run sync
```

## API Details

- **Base URL:** `https://api.stock2shop.com`
- **Channel ID:** 689 (LinkQage B2B - required for trade pricing)
- **Rate Limit:** 3 requests/second (authenticated)
- **Search:** Elasticsearch-based product search

## Data Mapping

| Stock2Shop Field | Unified Field | Notes |
|------------------|---------------|-------|
| title | product_name | Product display name |
| source_product_code | supplier_sku | Supplier's product code |
| variants[0].sku | sku | Product SKU |
| variants[0].price | cost_price | Cost price |
| variants[0].inventory_quantity | total_stock | Stock level |
| images[].src | images | Image URLs |
| vendor | brand | Brand name |

## Pricing Strategy

Stock2Shop uses **20% standard markup**:
- Cost Price: from API
- Selling Price: Cost × 1.20

## Notes

- Authentication token expires after 1 hour
- All requests include `channel_id=689` for B2B pricing
- Elasticsearch allows complex product filtering
- Products have variants (most have single variant)
- Stock is not split by region (goes to total_stock)
