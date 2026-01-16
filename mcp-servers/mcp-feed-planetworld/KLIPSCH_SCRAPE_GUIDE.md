# 🔊 Klipsch Speakers Scrape Guide

**Target**: 156 Klipsch speakers from Planet World
**URL**: https://www.planetworld.co.za/products/browse/?categoryids=690&manufacturerids=99
**Status**: Ready to run

---

## ✅ Pre-Flight Checklist

Before running the scraper, verify:

1. **✅ Playwright installed**:
   ```bash
   npx playwright install chromium
   ```

2. **✅ Environment variables set** (`.env` or system):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY`
   - `OPENAI_API_KEY`

3. **✅ Database connection working**:
   ```bash
   npm run test
   ```

4. **✅ Planet World supplier exists** in database:
   - Check Supabase → `suppliers` table
   - Should have entry with name: "Planet World"

---

## 🧪 Step 1: Dry Run Test (RECOMMENDED)

**Test with 10 products first - NO database writes**:

```bash
cd D:\AudicoAI\audico_quotes_modern\audico-mcp-servers\mcp-feed-planetworld
npm run test:klipsch
```

**What this does**:
- ✅ Opens Planet World Klipsch page
- ✅ Clicks "Load More" to reveal products
- ✅ Scrapes first 10 product details
- ✅ Shows what WOULD be saved
- ❌ Does NOT write to database

**Expected output**:
```
🧪 DRY RUN: Testing Klipsch scraper (no database writes)

📄 Loading Planet World products page...
✅ Completed X Load More clicks
🔍 Found ~156 product links
🏭 Scraping 10 individual product pages...

[DRY RUN] Would upsert: Klipsch RP-600M II Bookshelf Speakers...
[DRY RUN] Would upsert: Klipsch R-41M Bookshelf Speakers...
...

📊 DRY RUN RESULTS:
   Success: true
   Duration: 45s
   Products found: 10

✅ Dry run complete - no data was written to database
```

**Review the output**:
- ✅ Product names look correct?
- ✅ Prices look reasonable?
- ✅ SKUs extracted properly?
- ✅ Brand = "Klipsch"?

---

## 🚀 Step 2: Full Scrape (156 Klipsch Speakers)

**Once dry run looks good, run the full scrape**:

```bash
npm run scrape:klipsch
```

**What this does**:
- ✅ Scrapes ALL Klipsch speakers (~156 products)
- ✅ Writes to database
- ✅ Creates sync session in database
- ✅ Updates supplier status
- ✅ Generates embeddings for chat search

**Expected output**:
```
🔊 Starting Klipsch speakers scrape from Planet World...

🔌 Testing connection...
✅ Connection successful!

📦 Starting Klipsch product sync...
   URL: https://www.planetworld.co.za/products/browse/?categoryids=690&manufacturerids=99
   Expected: ~156 Klipsch speakers

📄 Loading Planet World products page...
🔄 Clicking Load More buttons...
📱 Clicked Load More button #1
📱 Clicked Load More button #2
...
✅ Completed 10 Load More clicks
🔍 Found 156 product links

🏭 Scraping 156 individual product pages...
📦 Progress: 0/156 products
📦 Progress: 20/156 products
...
✅ Successfully scraped 156 products

✅ Klipsch scrape completed successfully!
   Products added: 156
   Products updated: 0
   Duration: 240s (4 minutes)
   Session ID: xxx-xxx-xxx
```

---

## 📊 Step 3: Verify Data in Chat

**After scrape completes, test in chat**:

1. **Navigate to chat**: http://localhost:3000/chat

2. **Try these queries**:
   ```
   "show me Klipsch speakers"
   "Klipsch bookshelf speakers under R10000"
   "Klipsch reference series"
   ```

3. **Expected results**:
   - ✅ Should show 30-50+ Klipsch products
   - ✅ Prices in Rands (R)
   - ✅ Stock showing as 10 (default)
   - ✅ Images displaying
   - ✅ Can add to quote

---

## 🔍 Step 4: Verify in Database

**Check Supabase Dashboard**:

1. **Go to**: Supabase Dashboard → Table Editor → `products`

2. **Filter**:
   ```sql
   brand ILIKE '%Klipsch%'
   ```

3. **Should see**:
   - ~156 products
   - All with `active = true`
   - All with `brand = "Klipsch"`
   - Prices in `cost_price` and `retail_price`
   - Stock set to 10

4. **Check sync session**:
   ```sql
   SELECT * FROM sync_sessions
   WHERE session_name = 'klipsch-speakers-import'
   ORDER BY created_at DESC
   LIMIT 1;
   ```

---

## 🔧 Data Mapping

**How Planet World data becomes chat-ready**:

| Planet World | Database Field | Calculation | Example |
|-------------|----------------|-------------|---------|
| Product Name | `product_name` | - | "Klipsch RP-600M II" |
| SKU | `sku`, `model` | - | "RP600MII" |
| **Price (RRP)** | `retail_price`, `selling_price` | As scraped | **R12,999.00** |
| **Cost Price** | `cost_price` | RRP × 0.75 | **R9,749.25** |
| Margin | `margin_percentage` | - | 25% |
| Brand | `brand` | - | "Klipsch" |
| Image URL | `images` | - | ["https://..."] |
| Product URL | `specifications.product_url` | - | "https://..." |
| In Stock | `total_stock`, `stock_jhb` | - | 10 (default) |

**✅ Pricing Logic (CORRECTED)**:
- Scraped price = **Recommended Retail Price (RRP)**
- Cost = RRP - 25% = **RRP × 0.75**
- Margin = **25%**

**Example**:
- RRP on website: R12,999.00
- Cost price in DB: R9,749.25 (75% of RRP)
- Selling price in DB: R12,999.00 (RRP)

---

## ⚙️ How It Works

### 1. Page Loading
```
Open: https://www.planetworld.co.za/products/browse/?categoryids=690&manufacturerids=99
↓
Dismiss popups ("Accept", "Continue", etc.)
```

### 2. Pagination
```
Click "Load More" button repeatedly
↓
Wait for products to load (networkidle)
↓
Repeat until all products visible (~10 clicks for 156 products)
```

### 3. Link Collection
```
Extract all product detail page URLs
↓
Filter: Only /products/[product-slug] URLs
↓
Result: ~156 unique product links
```

### 4. Detail Scraping
```
For each product link:
  ↓
  Open product page
  ↓
  Extract via JavaScript:
    - Name (from <h1>)
    - SKU (from SKU: text)
    - Price (from R12,999.00)
    - Brand (from brand link or name)
    - Image (from CDN URL)
  ↓
  Transform to unified schema
  ↓
  Upsert to database
```

### 5. Database Storage
```
Upsert to products table
↓
Generate embeddings (OpenAI)
↓
Update sync session
↓
Update supplier status
```

---

## 🛡️ Safety Features

**The scraper includes**:

- ✅ **Dry run mode** - Test without database writes
- ✅ **Rate limiting** - 500ms delay every 20 products
- ✅ **Timeout protection** - 30s max per operation
- ✅ **Error handling** - Continues even if some products fail
- ✅ **Session tracking** - Full audit trail in database
- ✅ **Deduplication** - Uses `supplier_sku` to avoid duplicates

---

## ⚠️ Troubleshooting

### Issue: "Planet World supplier not found"
**Solution**: Create supplier record in database:
```sql
INSERT INTO suppliers (name, status, active)
VALUES ('Planet World', 'idle', true);
```

### Issue: "Playwright not installed"
**Solution**:
```bash
npx playwright install chromium
```

### Issue: "No product links found"
**Problem**: Selectors may have changed
**Solution**: Check Planet World website structure

### Issue: "Scrape timeout"
**Solution**: Increase timeout in `.env`:
```
TIMEOUT=60000
```

### Issue: "Products not appearing in chat"
**Solution**:
1. Check products exist in database
2. Restart chat dev server: `npm run dev`
3. Check embeddings were generated
4. Try specific query: "Klipsch RP-600M"

---

## 📈 Expected Results

### Performance
- **Scrape time**: 3-5 minutes for 156 products
- **Success rate**: 95%+ (some may fail due to network)
- **Database impact**: +156 products

### Chat Impact
- **Search "speakers"**: Now includes Klipsch products
- **Search "Klipsch"**: Shows all Klipsch products
- **Brand diversity**: Adds premium speaker brand to catalog

---

## 🎯 Next Steps After Scrape

1. **✅ Verify in chat** - Test queries work
2. **✅ Check embeddings** - Ensure semantic search works
3. **✅ Update stock** - If you have real stock numbers
4. **✅ Review pricing** - Adjust markup if needed (currently 20%)
5. **✅ Add product details** - Enhance specifications if desired

---

## 📝 Commands Reference

```bash
# Dry run test (10 products, no database writes)
npm run test:klipsch

# Full scrape (156 products, writes to database)
npm run scrape:klipsch

# Check connection
npm run test

# Regular sync (all products, not just Klipsch)
npm run sync -- --limit=100
```

---

## ✅ Ready to Go!

**Current status**: ✅ All files created and ready

**To start**:
```bash
cd D:\AudicoAI\audico_quotes_modern\audico-mcp-servers\mcp-feed-planetworld

# Option 1: Safe test first (recommended)
npm run test:klipsch

# Option 2: Full scrape immediately
npm run scrape:klipsch
```

**Then test in chat**:
```
http://localhost:3000/chat
Query: "show me Klipsch speakers"
```

🎉 **That's it! The scraped Klipsch products will automatically be available in your chat system via the hybrid search we fixed earlier.**
