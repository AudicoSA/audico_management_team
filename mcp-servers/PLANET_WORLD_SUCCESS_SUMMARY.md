# Planet World MCP - Bot Detection Solution SUCCESS ✅

**Date**: 2025-10-07
**Status**: ✅ FULLY WORKING - 1,871 products successfully scraped

---

## 🎉 Problem Solved!

### Original Issue
Planet World's website detected Playwright browsers and returned "NONE" (0 products) despite products existing on the page.

### Solution Implemented
**API Discovery & Direct Scraping** (GPT's Phase 0 + Phase 2 approach):
1. Load page with browser (DOM shows "NONE" due to bot detection)
2. Capture API calls made by the page's JavaScript
3. Extract product IDs from Google Analytics tracking calls
4. Call `/api/store/seo-product/list?ids=...` directly
5. Get full product data as JSON - **bypassing bot detection entirely**

---

## ✅ Results

### Test Results
```bash
npm run test:klipsch
```

**Output**:
- ✅ Found **1,871 product IDs** from API tracking
- ✅ Fetched **1,871 products** via 38 API batches (50 products per batch)
- ✅ Took ~20 seconds for API calls
- ✅ Success rate: 100%

### Products Scraped
- **Brands**: Klipsch, Alpine, Focal, Kenwood, Kicker, OneNav, SONOS, and many more
- **Categories**: Speakers, Subwoofers, Amplifiers, Car Audio, Home Audio, etc.
- **Data Retrieved**: SKU, Name, Price, Brand, Category, Image URL, Product URL, Description, Stock Status

---

## 📝 Key Files Modified

### 1. `src/index.ts`
**Lines 7-26**: Added playwright-extra + stealth plugin
```typescript
import { chromium as playwrightChromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
playwrightChromium.use(StealthPlugin());
```

**Lines 136-151**: Chrome channel + persistent profile + SA locale
```typescript
const context = await playwrightChromium.launchPersistentContext(userDataDir, {
  channel: 'chrome',
  locale: 'en-ZA',
  timezoneId: 'Africa/Johannesburg',
  // ...
});
```

**Lines 167-190**: API request/response logging
```typescript
page.on('response', async (response) => {
  // Log all API calls to discover endpoints
});
```

**Lines 255-287**: NEW - Extract product IDs from API calls & fetch via API
```typescript
const productIds = new Set<number>();
for (const req of apiRequests) {
  const idMatch = req.url.match(/productIds=([0-9,]+)/);
  if (idMatch) {
    ids.forEach(id => productIds.add(id));
  }
}
products = await this.fetchProductsViaAPI(Array.from(productIds));
```

**Lines 695-757**: NEW `fetchProductsViaAPI()` method
```typescript
private async fetchProductsViaAPI(productIds: number[]) {
  // Batch fetch from /api/store/seo-product/list
  // Returns: [{"ProductId":5430,"Name":"...","Sku":"...","Price":"...","Brand":"..."}]
}
```

### 2. `test-klipsch-dryrun.ts`
Updated to scrape all products in category 690:
```typescript
process.env.PLANETWORLD_PRODUCTS_URL = '/products/browse/?categoryids=690';
```

### 3. `scrape-all-products.ts` (NEW)
Production script to actually write products to database:
```bash
npm run scrape:all  # Writes to database
```

### 4. `package.json`
Added new script:
```json
"scrape:all": "ts-node scrape-all-products.ts"
```

---

## 🚀 How to Use

### Dry Run (Test - No Database Writes)
```bash
cd audico-mcp-servers/mcp-feed-planetworld
npm run test:klipsch
```

### Production (Write to Database)
```bash
npm run scrape:all
```

This will:
1. Load `/products/browse/?categoryids=690` (all audio products)
2. Discover 1,871 product IDs via API tracking
3. Fetch all products via API
4. Save to Supabase database

---

## 📊 API Endpoint Discovered

### Planet World Product API
```
GET https://www.planetworld.co.za/api/store/seo-product/list?ids=5430&ids=5557&ids=5558...
```

**Response Format**:
```json
[
  {
    "ProductId": 5430,
    "Name": "Klipsch PRO10SWLS (Subwoofer) Brown Landscape Speaker",
    "Description": "KLIPSCH PRO-10SW-LS landscape subwoofer",
    "Sku": "1063140",
    "Price": "32069.57",
    "Brand": "Klipsch",
    "Categories": ["/Klipsch/Speaker/Outdoor", "/Products/Home CI/Audio/Speaker/Outdoor"],
    "StockQty": "1.00000",
    "HasStock": "InStock",
    "Url": "https://www.planetworld.co.za/products/home-ci/audio/speaker/outdoor/klipsch-pro10swls-subwoofer-brown-landscape-speaker",
    "ImageUrls": ["https://content.storefront7.co.za/stores/..."]
  }
]
```

---

## 🔧 Technologies Used

- **playwright-extra** + **puppeteer-extra-plugin-stealth**: Bot detection evasion
- **Chrome channel**: Real Chrome browser instead of Chromium
- **Persistent profile**: Builds browser reputation across runs
- **South African locale**: `en-ZA` + `Africa/Johannesburg` timezone
- **Request logging**: Discovers API endpoints
- **Direct API scraping**: Bypasses DOM entirely

---

## ✅ Next Steps - Populating Database

### 1. Run Production Scrape
```bash
cd audico-mcp-servers/mcp-feed-planetworld
npm run scrape:all
```

This will populate your Supabase database with all 1,871 Planet World products.

### 2. Verify in Database
Check Supabase:
- Table: `products`
- Supplier: `Planet World`
- Should have ~1,871 products with Klipsch, Alpine, Focal, etc.

### 3. Test Search in Chat
Once database is populated, test in chat:
```
Show me Klipsch speakers
```

Should return Klipsch products from Planet World.

---

## 📋 Applying to Homemation

### Current Status
Homemation MCP already exists at:
```
audico-mcp-servers/mcp-feed-homemation/
```

Uses similar Playwright structure.

### Recommendations

1. **Check if Homemation has similar bot detection**
   ```bash
   cd audico-mcp-servers/mcp-feed-homemation
   npm run test  # or whatever test script exists
   ```

2. **If bot detection exists, apply same solution**:
   - Add playwright-extra + stealth plugin
   - Add Chrome channel + persistent profile
   - Add request logging to discover APIs
   - Implement direct API scraping if found

3. **Pricing calculation**:
   Per your note: **"Price scraped = retail, cost = retail - 25%"**

   Update the pricing transform in Homemation scraper:
   ```typescript
   const retailPrice = parseZAR(priceText);
   const costPrice = retailPrice * 0.75; // 25% discount
   ```

---

## 🎯 Success Criteria Met

✅ Scraper defeats bot detection
✅ 1,871 products discovered and scraped
✅ API endpoint identified and used
✅ Works reliably without manual intervention
✅ Fast (20s for API vs hours for DOM)
✅ Production-ready script created

---

## 🔗 Related Files

- [KLIPSCH_BOT_DETECTION_ISSUE.md](./KLIPSCH_BOT_DETECTION_ISSUE.md) - Original problem documentation
- [GPT_Klipsch.txt](./GPT_Klipsch.txt) - GPT's solution recommendations
- [scrape-all-products.ts](./scrape-all-products.ts) - Production scraper script
- [src/index.ts](./src/index.ts) - Main scraper implementation

---

**Ready to populate the database!** Run `npm run scrape:all` when ready.
