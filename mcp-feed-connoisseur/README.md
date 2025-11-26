# Connoisseur MCP Server

Shopify product feed integration for Connoisseur (www.connoisseur.co.za).

## Features

- ✅ Shopify JSON API integration
- ✅ Continuous pagination support
- ✅ Polite crawling (1 req/sec)
- ✅ Automatic price calculation
- ✅ Unified Supabase schema

## Pricing Strategy

**Connoisseur provides RETAIL prices:**
- `retail_price` = Price from Shopify (customer-facing price)
- `cost_price` = Retail price × 0.8 (less 20% supplier discount)
- `selling_price` = Retail price (our selling price)
- `margin_percentage` = Calculated automatically

### Example:
If Shopify shows R 10,000:
- Retail Price: R 10,000
- Cost Price: R 8,000 (our cost from Connoisseur)
- Selling Price: R 10,000 (what we sell to customers)
- Margin: 25%

## Usage

### Test Connection
```bash
npm run test
```

### Sync Products
```bash
# Full sync
npm run sync

# Dry run (preview only)
npm run sync -- --dry-run

# Limit to 50 products
npm run sync -- --limit=50
```

## Environment Variables

Add to `.env.local`:

```env
CONNOISSEUR_BASE_URL=https://www.connoisseur.co.za
CONNOISSEUR_API_ENDPOINT=/collections/all/products.json
CONNOISSEUR_PAGE_LIMIT=250
```

## Database Setup

Ensure the "Connoisseur" supplier exists in Supabase:

```sql
INSERT INTO suppliers (name, active, status)
VALUES ('Connoisseur', true, 'idle')
ON CONFLICT (name) DO NOTHING;
```

## Product Fields

Maps Shopify products to unified schema:
- `product_name`: Shopify title
- `sku`: Shopify variant SKU (e.g., CON000859)
- `model`: Shopify handle
- `brand`: Shopify vendor
- `category_name`: Mapped from product_type
- `images`: All product images
- `specifications`: Full Shopify metadata

## Rate Limiting

- 1 request per second (polite crawling)
- User-Agent: `AudicoResearchBot/1.0`
- Respects Shopify's pagination patterns
- Automatic retry with backoff

## Category Mapping

| Shopify Product Type | Unified Category |
|---------------------|------------------|
| Speakers            | Audio Visual     |
| Headphones          | Audio Visual     |
| Amplifiers          | Audio Visual     |
| Receivers           | Audio Visual     |
| Projectors          | Audio Visual     |
| Cables              | Accessories      |
| Smart Home          | Home Automation  |

## Troubleshooting

**Connection fails:**
- Verify Shopify store URL is correct
- Check network connectivity
- Ensure JSON endpoint is enabled

**No products synced:**
- Check supplier exists in database
- Verify products are "available" in Shopify
- Review sync session logs

**Pricing looks wrong:**
- Verify retail price from Shopify
- Check cost calculation (retail × 0.8)
- Review margin percentage calculation
