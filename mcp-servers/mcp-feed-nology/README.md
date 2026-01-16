# Nology MCP Server

MCP server for integrating Nology Product Data Feed API with unified Audico database.

## Features

- ✅ Fetches products from Nology API
- ✅ Applies **15% VAT + 15% margin** pricing (32.25% total markup)
- ✅ Maps stock by region (CPT, JHB)
- ✅ Transforms to unified schema
- ✅ Brand detection (Yealink, MikroTik, TP-LINK, etc.)
- ✅ Session tracking and error handling
- ✅ Dry-run mode for testing

## Installation

```bash
cd audico-mcp-servers
npm install
cd mcp-feed-nology
npm install
npm run build
```

## Configuration

Set environment variables:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_KEY=your-service-key
NOLOGY_API_USERNAME=AUV001
NOLOGY_API_SECRET=e2bzCs64bM
NOLOGY_API_BASE_URL=https://erp.nology.co.za/NologyDataFeed/api
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

### Programmatic Usage

```typescript
import { NologyMCPServer } from '@audico/mcp-feed-nology';

const server = new NologyMCPServer();

// Test connection
const connected = await server.testConnection();

// Sync products
const result = await server.syncProducts({
  limit: 100,
  sessionName: 'my-sync',
});

// Get status
const status = await server.getStatus();
console.log(`Total products: ${status.total_products}`);
```

## Pricing Formula

Nology uses a specific pricing formula:

1. **Cost Excl VAT** (from API): R1000
2. **Add 15% VAT**: R1000 × 1.15 = R1150
3. **Add 15% Margin**: R1150 × 1.15 = **R1322.50** (selling price)
4. **Total Markup**: 32.25%

## Data Mapping

| Nology Field | Unified Field | Notes |
|--------------|---------------|-------|
| Model | model | Product model number |
| ShortDescription | product_name | Display name |
| LongDescription | description | Full description |
| GlobalSKU | sku, supplier_sku | SKU identifiers |
| Brand | brand | Brand name |
| Price | cost_price | Cost excl VAT |
| TotalQtyAvailable | stock_jhb, stock_cpt | Regional stock |
| AdditionalImages | images | Image URLs |

## Logs

Logs are stored in:
- `logs/error.log` - Errors only
- `logs/combined.log` - All logs

## API Documentation

See: `Nology Product Data Feed Service Documentation v4.pdf`

## Support

Issues? Check:
1. API credentials are correct
2. Supabase connection is working
3. Unified schema is deployed
4. Network connectivity to Nology API
