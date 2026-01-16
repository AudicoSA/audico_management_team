# 🚀 MCP Push OpenCart

**AI-powered product synchronization from Supabase to OpenCart (audicoonline.co.za)**

## Features

- ✅ **AI-Powered Deduplication** - Hybrid fuzzy matching algorithm prevents duplicates
- ✅ **Excel Cache Integration** - Loads 7,775+ OpenCart products instantly from Excel export
- ✅ **Skip Existing Products** - Matched products are skipped to avoid duplicates
- ⚠️ **Updates Not Yet Implemented** - Price/stock updates require separate system (see Known Limitations)
- ✅ **LiveFeed Category** - New products pushed to LiveFeed category
- ✅ **Brand Mapping** - Intelligent manufacturer ID assignment
- ✅ **Session Tracking** - Complete audit trail in Supabase
- ✅ **Batch Processing** - Handle large product catalogs efficiently

## Installation

```bash
cd mcp-push-opencart
npm install
npm run build
```

## Configuration

Add to `.env`:

```env
# OpenCart Configuration
OPENCART_BASE_URL=https://www.audicoonline.co.za
OPENCART_CLIENT_ID=demo_oauth_client
OPENCART_CLIENT_SECRET=demo_oauth_secret
OPENCART_ADMIN_USERNAME=admin
OPENCART_ADMIN_PASSWORD=your-password

# LiveFeed Category ID
OPENCART_LIVEFEED_CATEGORY_ID=967

# AI Configuration (for product matching)
ANTHROPIC_API_KEY=your-anthropic-key

# Supabase (from shared config)
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_KEY=...
```

## Usage

### Test Connection

```bash
npm run test
```

### Push Products

```bash
# Dry run (no actual push)
npm run push -- --dry-run --limit=5

# Push 10 products
npm run push -- --limit=10

# Full push (all products)
npm run push
```

## Product Matching Algorithm

### Tier 1: Exact SKU Match (100% confidence)
- Matches Supabase `sku` against OpenCart SKU field
- Direct database lookup for maximum accuracy

### Tier 2: Model + Brand Match (90% confidence)
- Combines `model` + `brand` for unique identification
- Checks if model code appears in OpenCart product name/model
- Example: "WiiM Pro" + "Homemation" matches "WiiM Pro - Streaming Pre-Amplifier"

### Tier 3: Hybrid Fuzzy Match (55%+ confidence)
- **Core Words (50% weight)** - Extracts meaningful identifiers (brand, model, type)
- **Position Bonus (20% weight)** - Key words appearing early in name
- **Brevity Bonus (15% weight)** - Shorter names preferred when core matches
- **Levenshtein (15% weight)** - Overall string similarity
- **Word Stem Matching** - Handles "streamer" ↔ "streaming", "amplifier" ↔ "amp"
- Example: "WiiM Pro Streamer" → "WiiM Pro - Streaming Pre-Amplifier" (80% match)

### Tier 4: Create New Product
- No match found (<55% confidence) → Create in LiveFeed category
- Mark for manual categorization and enhancement

## Update vs Create Logic

### Existing Products (Matched 55%+)
- ⏭️ **Skipped** - Product exists, no action taken
- 💡 **Reason:** OpenCart REST API update endpoint requires investigation
- 🔧 **Future:** Separate update system needed for price/stock sync

### New Products (<55% match)
- ✅ **Push to:** LiveFeed category (ID: 967)
- ✅ **Include:** Basic info (name, SKU, price, stock)
- 💡 **Internal AI** will enhance descriptions later

## Known Limitations

### ⚠️ Price/Stock Updates Not Implemented

**Current Behavior:**
- Matched products are **skipped** (no duplicates created ✅)
- Price and stock are **not updated** for existing products

**Why:**
- OpenCart REST API `PUT /products` endpoint returns "Invalid id" errors
- Update functionality requires further API investigation
- Reference implementation only creates products, never updates

**Workaround:**
- For now, only **new products** are pushed
- **Existing products** are detected and skipped
- Manual price/stock updates in OpenCart admin or separate sync system needed

**Future Solution:**
- Investigate OpenCart REST API documentation for proper update format
- Build separate `mcp-update-opencart` for price/stock synchronization
- Potentially use direct database updates instead of REST API

## OpenCart API Structure

```typescript
{
  model: string,              // Short model identifier
  sku: string,               // Unique SKU
  price: string,             // Price in rands (numeric string)
  quantity: string,          // Stock quantity (numeric string)
  status: '1',               // Active
  manufacturer_id: string,   // Brand mapping
  product_store: [0],        // Default store
  product_category: [967],   // LiveFeed category
  product_description: [{
    language_id: '1',
    name: string,            // Product name
    description: string      // HTML description
  }]
}
```

## Manufacturer Mapping

Common brands mapped to OpenCart manufacturer IDs:

- TP-Link → 367
- Denon → (to be determined)
- Marantz → (to be determined)
- Yamaha → (to be determined)
- Yealink → (to be determined)
- Jabra → (to be determined)
- Others → 459 (General)

## Example Workflow

1. **Fetch Active Products** - Get products from Supabase with `active=true` and `stock>0`
2. **Match Against OpenCart** - Use 4-tier algorithm to find existing products
3. **Update Existing** - Send PATCH request with new price/stock
4. **Create New** - Send POST request to LiveFeed category
5. **Track Session** - Log results in `push_sessions` table

## Error Handling

- **API Errors** - Logged and continue with next product
- **Match Ambiguity** - When AI confidence < 70%, treat as new product
- **Rate Limiting** - Built-in delays between API calls
- **Session Recovery** - Failed sessions can be resumed

## Success Metrics

**Target Performance:**
- Push Speed: ~10-20 products/minute
- Match Accuracy: >95%
- Duplicate Rate: <1%

## Testing Checklist

- [ ] Test connection to OpenCart API
- [ ] Verify brand manufacturer mapping
- [ ] Test with 2-5 known products
- [ ] Verify LiveFeed category assignment
- [ ] Check price/stock updates on existing products
- [ ] Confirm no duplicates created

## Scheduled Automation (Future)

Once tested, this MCP can run on schedule:

```bash
# Daily sync at 2 AM
0 2 * * * cd /path/to/mcp-push-opencart && npm run push
```

## Troubleshooting

### "Connection failed"
Check OpenCart credentials in `.env`

### "Duplicate products created"
Review matching algorithm logs - may need to adjust confidence thresholds

### "Products not showing on website"
Check product status=1 and assigned to correct store ID

## Related Files

- `linkqage-ecommerce/lib/opencart.ts` - OpenCart API client
- `linkqage-ecommerce/app/api/opencart/push-stock2shop-production/route.ts` - Reference implementation

---

**Built with the Audico MCP pattern** 🚀
