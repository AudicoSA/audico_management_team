# Klipsch Scraper - Bot Detection Issue

**Date**: 2025-10-07
**Status**: ❌ BLOCKED - Bot detection preventing scraping
**URL**: `https://www.planetworld.co.za/products/browse/?categoryids=690&manufacturerids=99`

---

## Issue Summary

The Klipsch scraper can load the page but Planet World's website detects the Playwright browser and returns **"NONE"** (0 products) instead of the 156 Klipsch products that exist.

**Verification**: WebFetch confirms the page shows 156 Klipsch products when accessed normally, but Playwright sees an empty product list.

---

## Fixes Already Applied ✅

### 1. Fixed URL Pattern Matching
**Problem**: Scraper was rejecting valid product URLs
**File**: `src/index.ts` lines 579-601
**What was fixed**:
- OLD regex: `/\/products\/[^\/]+$/` (only matched single-segment URLs like `/products/category`)
- NEW regex: `/\/products\/[^\/]+\/.+/` (matches multi-segment URLs like `/products/category/subcategory/product-name`)
- Planet World uses deep paths: `/products/auto-audio/vehicle-infotainment-system/.../product-slug`

```javascript
// OLD (broken)
return /\/products\/[^\/]+$/.test(url) || url.includes('productid=');

// NEW (working)
return uniqueUrls.filter((url: string) => {
  if (url.includes('/products/browse/') && !url.includes('productid=')) return false;
  if (/\/products\/[^\/]+$/.test(url) && !url.includes('productid=')) return false; // Skip categories
  if (url.includes('productid=')) return true;
  return /\/products\/[^\/]+\/.+/.test(url); // Accept multi-segment product URLs
});
```

### 2. Fixed Wait Strategy
**Problem**: Page loaded HTML but not JavaScript-rendered products
**File**: `src/index.ts` lines 131-137
**What was fixed**:
- Changed `waitUntil: 'domcontentloaded'` → `waitUntil: 'networkidle'`
- Added extra 2000ms wait after page load for dynamic content
- Added 3000ms wait before collecting product links

```javascript
await page.goto(fullUrl, {
  waitUntil: 'networkidle', // Wait for AJAX/JS to finish loading products
  timeout: 30000,
});
await page.waitForTimeout(2000); // Extra wait for dynamic content
```

### 3. Fixed Environment Variable Loading
**Problem**: URL override wasn't being applied
**File**: `test-klipsch-dryrun.ts` lines 13-17
**What was fixed**:
- Moved `process.env.PLANETWORLD_PRODUCTS_URL` assignment BEFORE `new PlanetWorldMCPServer()`
- Server constructor reads env vars, so they must be set first

```javascript
// WRONG ORDER
const server = new PlanetWorldMCPServer();
process.env.PLANETWORLD_PRODUCTS_URL = '/products/browse/?categoryids=690&manufacturerids=99';

// CORRECT ORDER
process.env.PLANETWORLD_PRODUCTS_URL = '/products/browse/?categoryids=690&manufacturerids=99';
const server = new PlanetWorldMCPServer();
```

### 4. Added Stealth Browser Options
**Problem**: Bot detection flagging automated browser
**File**: `src/index.ts` lines 119-145
**What was fixed**:
- Changed User Agent from `AudicoMCPScraper/1.0` → Real Chrome UA
- Added stealth browser launch args
- Removed `navigator.webdriver` property
- Added fake `window.chrome` object

```javascript
browser = await chromium.launch({
  headless: this.config.headless,
  timeout: this.config.timeout,
  args: [
    '--disable-blink-features=AutomationControlled',
    '--disable-features=IsolateOrigins,site-per-process',
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--no-first-run',
    '--no-zygote',
    '--disable-gpu',
  ],
});

const page = await browser.newPage({
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  viewport: { width: 1920, height: 1080 },
});

await page.addInitScript(() => {
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  (window as any).chrome = { runtime: {} };
});
```

### 5. Added Better Debug Logging
**File**: `src/index.ts` lines 457-530
**What was added**:
- Log actual URL being loaded
- Show product container samples with their links
- Display possible product links found
- Show filtered link count

---

## Current Behavior 🔍

### Test Command
```bash
npm run test:klipsch
```

### Output
```
📄 Loading Planet World products page: https://www.planetworld.co.za/products/browse/?categoryids=690&manufacturerids=99
📜 Infinite scrolling to load products...
✅ Completed 20 scrolls
✅ Also clicked 5 Load More buttons
📸 Screenshot saved to debug-klipsch-page.png

🔍 DEBUG: Potential product containers:
   div[class*="product"]: 3 elements
      Text: Matching Products FoundFound: View All

                NONE

🔍 DEBUG: Product container samples (3):
   1. class="product-result-holder" links=1
      - https://www.planetworld.co.za/viewing-rooms#
      text: "Matching Products FoundFound: View All\n\n\t\t\t\tNONE"
   2. class="product-results" links=0
      text: "\n\t\t\t\tNONE\n\t\t\t"
   3. class="product-returns" links=0
      text: ""

✅ Collected 0 unique product links after filtering
❌ Planet World sync failed: No product links found - check selectors
```

**Key observation**: Page literally says **"NONE"** - not a selector issue, the server is returning empty results.

---

## Proof That Products Exist ✅

### WebFetch Test
```bash
WebFetch: https://www.planetworld.co.za/products/browse/?categoryids=690&manufacturerids=99
```

**Result**:
- Page shows **"156 Results Found"** for Klipsch
- Products visible: "Klipsch PRO10SWLS", "Klipsch The Fives", "Klipsch Heritage Klipschorn", etc.
- Product cards render correctly
- "Load More" button present

**Conclusion**: The URL is correct and products exist, but Planet World returns different content to automated browsers.

---

## Bot Detection Evidence 🤖

1. **Same URL, different results**:
   - Normal browser/WebFetch: 156 products
   - Playwright: "NONE" (0 products)

2. **All stealth measures failed**:
   - ✅ Real Chrome user agent
   - ✅ Disabled automation flags
   - ✅ Removed webdriver property
   - ✅ Proper viewport size
   - ❌ Still detected

3. **Page structure changes**:
   - Normal: 1393+ product divs with links
   - Playwright: 3 product divs, all say "NONE"

---

## Solutions to Try 🔧

### Option 1: Advanced Stealth Library (RECOMMENDED)
Use `playwright-extra` with `puppeteer-extra-plugin-stealth`:

```bash
npm install playwright-extra puppeteer-extra-plugin-stealth
```

```javascript
import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

chromium.use(StealthPlugin());
const browser = await chromium.launch({ headless: true });
```

**Why this helps**: Applies 23+ stealth techniques to evade detection

---

### Option 2: Session Cookies
Extract cookies from a real browser session and inject them:

```javascript
// After logging in manually, export cookies
const cookies = await page.context().cookies();

// In scraper
await context.addCookies(cookies);
```

**Why this helps**: Authenticated sessions may bypass bot checks

---

### Option 3: Human-like Behavior
Add randomization to mimic human interaction:

```javascript
// Random delays
await page.waitForTimeout(Math.random() * 2000 + 1000);

// Random mouse movements
await page.mouse.move(Math.random() * 500, Math.random() * 500);

// Gradual scrolling
for (let i = 0; i < 10; i++) {
  await page.mouse.wheel(0, 300);
  await page.waitForTimeout(Math.random() * 500 + 200);
}
```

**Why this helps**: Detection systems look for suspiciously perfect timing/behavior

---

### Option 4: Residential Proxy
Route requests through residential proxies:

```javascript
const browser = await chromium.launch({
  proxy: {
    server: 'http://proxy-server:port',
    username: 'user',
    password: 'pass'
  }
});
```

**Why this helps**: IP reputation may trigger bot detection

---

### Option 5: Browser Context Persistence
Keep browser context alive across requests:

```javascript
const context = await browser.newContext({
  storageState: 'auth.json' // Save/restore browser state
});
```

**Why this helps**: New contexts look suspicious; persistent contexts build reputation

---

## Files Modified 📝

1. **src/index.ts**
   - Lines 45-52: Updated user agent
   - Lines 119-145: Added stealth browser launch
   - Lines 131-137: Changed wait strategy
   - Lines 457-530: Enhanced debug logging
   - Lines 579-601: Fixed URL pattern matching

2. **test-klipsch-dryrun.ts**
   - Lines 13-17: Fixed env var loading order

---

## How to Test 🧪

```bash
# Current test (shows 0 products due to bot detection)
cd audico-mcp-servers/mcp-feed-planetworld
npm run test:klipsch

# Try non-headless mode (visible browser)
HEADLESS=false npm run test:klipsch

# Check debug output
grep -E "(Loading Planet World|Collected.*links|NONE)" klipsch-debug.log
```

---

## Expected Behavior After Fix ✨

When working correctly:
```
📄 Loading Planet World products page: https://www.planetworld.co.za/products/browse/?categoryids=690&manufacturerids=99
✅ Completed 20 scrolls
✅ Also clicked 5 Load More buttons

🔍 DEBUG: Product container samples (10):
   6. class="col-md-8 col-lg-9 product-categories-contain" links=156
      - https://www.planetworld.co.za/products/home-retail/speakers/.../klipsch-pro10swls
      - https://www.planetworld.co.za/products/home-retail/speakers/.../klipsch-the-fives
      text: "SKU: KLIPSCH-PRO10SWLS\nKlipsch PRO10SWLS..."

✅ Collected 156 unique product links after filtering
🏭 Scraping 156 individual product pages...
[DRY RUN] Would upsert: Klipsch PRO10SWLS (Subwoofer) Brown Landscape Speaker
[DRY RUN] Would upsert: Klipsch The Fives Matte Black Active Speaker
[DRY RUN] Would upsert: Klipsch Heritage Klipschorn AK6 Floorstanding Speakers
...
```

---

## Questions for GPT 💬

1. **Which stealth approach is most effective** against modern bot detection (Planet World likely uses Cloudflare or similar)?

2. **Can we use playwright-extra with TypeScript** in this project structure? Any gotchas?

3. **Are there Playwright-specific flags/features** we're missing that help with detection?

4. **Should we try Firefox instead of Chromium**? Some sites have weaker Firefox fingerprinting.

5. **Is there a way to test** what specific detection method is being used (TLS fingerprinting, canvas fingerprinting, behavior analysis, etc.)?

---

## Technical Context 🔧

- **Framework**: Playwright (TypeScript)
- **Browser**: Chromium
- **Target**: https://www.planetworld.co.za (South African e-commerce site)
- **Detection Type**: Returns empty product list (not blocking request, altering response)
- **Project Structure**: MCP server with Supabase backend
- **OS**: Windows (based on paths)

---

## Success Criteria ✅

Fix is successful when:
1. `npm run test:klipsch` returns 156 product links (not 0)
2. Products scraped are actual Klipsch speakers (not empty/generic products)
3. Solution works in both headless and non-headless modes
4. Scraper can run reliably without manual intervention
