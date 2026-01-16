# Esquire MCP Server

MCP server for integrating Esquire JSON product feed with unified Audico database.

## Features

- ✅ Esquire JSON API integration
- ✅ Location-based stock tracking (JHB, DBN, CPT)
- ✅ Cost excl VAT pricing
- ✅ 15% VAT + 20% margin pricing
- ✅ Transforms to unified schema
- ✅ Session tracking
- ✅ Product activation/deactivation

## Installation

```bash
cd audico-mcp-servers/mcp-feed-esquire
npm install
npm run build
```

## Configuration

Update `.env` file:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your-url
SUPABASE_SERVICE_KEY=your-key

# Esquire
ESQUIRE_FEED_URL=https://api.esquire.co.za/api/ExportWithLocation?key=14&Org=esquire&ID=182599&m=0&o=descending&rm=RoundNearest&r=1&0
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

- **Feed URL:** `https://api.esquire.co.za/api/ExportWithLocation`
- **Format:** JSON array
- **Stock Locations:** MID (JHB), DBN, CPT
- **Pricing:** Cost excl VAT provided

## Data Mapping

| Esquire Field | Unified Field | Notes |
|--------------|---------------|-------|
| ProductName | product_name | Product display name |
| ProductCode | sku | Product SKU |
| ProductCode | supplier_sku | Supplier SKU |
| Price | cost_price | Cost excl VAT |
| Price * 1.38 | selling_price | 15% VAT + 20% margin |
| Location.MID | stock_jhb | JHB stock |
| Location.DBN | stock_dbn | DBN stock |
| Location.CPT | stock_cpt | CPT stock |
| image | images | Image URLs |
| Category | category_name | Product category |

## Pricing Strategy

Esquire uses **15% VAT + 20% margin**:
- Cost Price: from API (excl VAT)
- + 15% VAT: Cost × 1.15
- + 20% margin: (Cost × 1.15) × 1.20
- **Total markup: 38%** on original cost

## Location Stock

Esquire provides stock by location:
- **MID**: Johannesburg (maps to stock_jhb)
- **DBN**: Durban (maps to stock_dbn)
- **CPT**: Cape Town (maps to stock_cpt)

## Notes

- Products with status !== 1 are marked as inactive
- Products with 0 total stock are marked as inactive
- Feed includes ProductAttributes for detailed specs
- Condition field indicates product condition (New/Refurbished)
- Product deactivation handles discontinued items
