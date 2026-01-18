/**
 * Planet World MCP Server
 * Playwright-based web scraping with JavaScript extraction
 */

import 'dotenv/config';
// @ts-ignore
// import { chromium as playwrightChromium } from 'playwright-extra';
// import StealthPlugin from 'puppeteer-extra-plugin-stealth';
// import { Browser, Page, BrowserContext, chromium as playwrightChromium } from 'playwright';
import { Browser, Page, BrowserContext } from 'playwright'; // Types only
let playwrightChromium: any;
try {
  console.log('DEBUG: Attempting to load playwright...');
  playwrightChromium = require('playwright').chromium;
  console.log('DEBUG: Playwright loaded successfully');
} catch (error) {
  console.error('CRITICAL: Failed to load playwright module:', error);
  // Don't set to undefined - let it remain undefined so we can check later
  // This will cause the scraper to fail loudly when trying to use it
}
import * as path from 'path';
import * as fs from 'fs';
import {
  MCPSupplierTool,
  SyncOptions,
  SyncResult,
  SupplierStatus,
  Supplier,
  UnifiedProduct,
  PricingCalculator,
  logger,
  logSync,
} from '@audico/shared';

import { PartalSupabaseService } from './supabase_local';

// Add stealth plugin to avoid bot detection
// playwrightChromium.use(StealthPlugin());

// ============================================
// PLANET WORLD TYPES
// ============================================

interface PlanetWorldProduct {
  sku: string;
  name: string;
  price: number;
  category: string;
  brand: string;
  image: string;
  productUrl: string;
  description?: string;
  inStock: boolean;
}

// ============================================
// PLANET WORLD MCP SERVER
// ============================================

export class PlanetWorldMCPServer implements MCPSupplierTool {
  private supabase: PartalSupabaseService;
  private supplier: Supplier | null = null;

  private config = {
    baseUrl: process.env.PLANETWORLD_BASE_URL || 'https://www.planetworld.co.za',
    productsUrl: process.env.PLANETWORLD_PRODUCTS_URL || '/products',
    headless: process.env.HEADLESS !== 'false',
    timeout: parseInt(process.env.TIMEOUT || '30000'),
    // Use real Chrome user agent to avoid bot detection
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  };

  constructor(supabaseUrl?: string, supabaseKey?: string) {
    this.supabase = new PartalSupabaseService(supabaseUrl, supabaseKey);
  }

  // ============================================
  // MCP INTERFACE IMPLEMENTATION
  // ============================================

  async testConnection(): Promise<boolean> {
    try {
      logger.info('🔌 Testing Planet World connection...');

      const userDataDir = path.resolve('.pw-profiles/planetworld-za');
      if (!fs.existsSync(userDataDir)) {
        fs.mkdirSync(userDataDir, { recursive: true });
      }

      const context = await playwrightChromium.launchPersistentContext(userDataDir, {
        // channel: 'chromium',
        headless: this.config.headless,
        locale: 'en-ZA',
        timezoneId: 'Africa/Johannesburg',
        userAgent: this.config.userAgent,
      });

      const page = context.pages()[0] || await context.newPage();

      await page.goto(`${this.config.baseUrl}${this.config.productsUrl}`, {
        waitUntil: 'domcontentloaded',
        timeout: 20000,
      });

      const title = await page.title();
      await context.close();

      if (title) {
        logger.info(`✅ Planet World connection successful: ${title}`);
        return true;
      }

      logger.error('❌ Planet World connection failed - no title found');
      return false;
    } catch (error: any) {
      logger.error(`❌ Planet World connection failed: ${error.message}`);
      return false;
    }
  }

  async syncProducts(options?: SyncOptions): Promise<SyncResult> {
    const startTime = Date.now();
    let sessionId = '';
    let context: BrowserContext | null = null;

    try {
      // Get supplier record
      this.supplier = await this.supabase.getSupplierByName('Planet World');
      if (!this.supplier) {
        throw new Error('Planet World supplier not found in database');
      }

      // Update supplier status
      await this.supabase.updateSupplierStatus(this.supplier.id, 'running');

      // Create sync session
      sessionId = await this.supabase.createSyncSession(
        this.supplier.id,
        options?.sessionName || 'manual'
      );

      logSync.start('Planet World', sessionId);

      // PRE-FLIGHT CHECK: Verify Playwright is available before attempting to launch browser
      if (!playwrightChromium) {
        const error = new Error(
          'Playwright browser automation is not available. ' +
          'This usually means Playwright was not installed correctly in the deployment environment. ' +
          'Check that "playwright install chromium" ran successfully during build.'
        );

        // Log crash with detailed context
        await this.supabase.logCrash({
          supplierName: 'Planet World',
          errorType: 'playwright_unavailable',
          errorMessage: error.message,
          stackTrace: error.stack,
          context: {
            nodeVersion: process.version,
            platform: process.platform,
            arch: process.arch,
            env: process.env.NODE_ENV,
            playwrightBrowsersPath: process.env.PLAYWRIGHT_BROWSERS_PATH,
            cwd: process.cwd()
          }
        });

        throw error; // Fail loudly instead of silently
      }

      // Use persistent profile with Chrome channel for better bot evasion
      const userDataDir = path.resolve('.pw-profiles/planetworld-za');

      // Ensure profile directory exists
      if (!fs.existsSync(userDataDir)) {
        fs.mkdirSync(userDataDir, { recursive: true });
        logger.info('📁 Created persistent browser profile directory');
      }

      // Launch with persistent context (Chrome channel + saved state)
      context = await playwrightChromium.launchPersistentContext(userDataDir, {
        // Use system chromium on Railway/Nix environments where it's pre-installed with all deps
        executablePath: process.env.CHROMIUM_PATH || undefined,
        headless: this.config.headless,
        locale: 'en-ZA', // South African English
        timezoneId: 'Africa/Johannesburg', // SA timezone
        viewport: { width: 1920, height: 1080 },
        userAgent: this.config.userAgent,
        acceptDownloads: false,
        // South African proxy if configured
        proxy: process.env.ZA_PROXY ? { server: process.env.ZA_PROXY } : undefined,
        args: [
          '--disable-blink-features=AutomationControlled',
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
        ],
      });

      if (!context) {
        throw new Error('Failed to launch browser context');
      }

      const page = context.pages()[0] || await context.newPage();

      // Additional stealth init script (belt-and-braces with stealth plugin)
      await page.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        (window as any).chrome = { runtime: {} };
      });

      // Enable request/response logging to discover JSON API endpoints
      // Track both URLs and response bodies to capture all product IDs
      const apiRequests: Array<{ url: string, method: string, status: number, responseSize: number, body?: string }> = [];
      const productIds = new Set<number>();

      page.on('response', async (response) => {
        const url = response.url();
        const contentType = response.headers()['content-type'] || '';
        // Log all XHR/fetch API calls - be more inclusive to catch product data
        // Include any JSON response or API-like URL from planetworld
        const isJsonResponse = contentType.includes('application/json');
        const isApiLikeUrl = url.includes('planetworld.co.za') && (
          url.includes('.json') ||
          url.includes('api') ||
          url.includes('productid') ||
          url.includes('search') ||
          url.includes('browse') ||
          url.includes('seo-product') ||
          url.includes('product') ||
          url.includes('catalog') ||
          url.includes('list') ||
          url.includes('load') ||
          url.includes('fetch') ||
          url.includes('get')
        );
        if (url.includes('planetworld.co.za') && (isJsonResponse || isApiLikeUrl)) {
          try {
            const body = await response.text();
            apiRequests.push({
              url,
              method: response.request().method(),
              status: response.status(),
              responseSize: body.length,
              body: body.length < 500000 ? body : undefined, // Store body if reasonable size
            });
            
            // Parse product IDs from URL
            const urlMatches = url.matchAll(/[?&]ids=([0-9]+)/g);
            for (const match of urlMatches) {
              if (match[1]) {
                productIds.add(parseInt(match[1]));
              }
            }

            // Also parse product IDs from response body (JSON array of products)
            if (body.length > 0 && body.length < 500000 && body.trim().startsWith('[')) {
              try {
                const jsonData = JSON.parse(body);
                if (Array.isArray(jsonData)) {
                  for (const item of jsonData) {
                    if (item.ProductId) {
                      productIds.add(parseInt(item.ProductId));
                    }
                    if (item.id) {
                      productIds.add(parseInt(item.id));
                    }
                  }
                }
              } catch (e) {
                // Not JSON or parse failed, continue
              }
            }

            // Log more details including content type for debugging
            const shortUrl = url.length > 100 ? url.substring(0, 100) + '...' : url;
            logger.info(`🌐 API [${contentType.split(';')[0]}]: ${response.request().method()} ${shortUrl} → ${response.status()} (${body.length} bytes, ${productIds.size} IDs)`);
          } catch (e) {
            // Ignore binary/image responses
          }
        }
      });

      const fullUrl = `${this.config.baseUrl}${this.config.productsUrl}`;
      logger.info(`📄 Loading Planet World products page: ${fullUrl}`);
      await page.goto(fullUrl, {
        waitUntil: 'networkidle', // Wait for AJAX/JS to finish loading products
        timeout: 30000,
      });

      // Extra wait for dynamic content to render
      await page.waitForTimeout(2000);

      // Dismiss popups
      await this.dismissPopups(page);

      // Use infinite scroll to load all products
      // Scroll more aggressively to ensure all products are loaded via API calls
      const maxScrolls = Math.max(30, options?.limit ? Math.ceil(options.limit / 3) : 100);
      logger.info(`📜 Starting infinite scroll (max ${maxScrolls} scrolls)...`);
      const totalScrolls = await this.infiniteScroll(page, maxScrolls);
      logger.info(`✅ Completed ${totalScrolls} scrolls`);

      // Try clicking Load More buttons (some pages have both)
      // Increase max clicks to ensure we capture all products
      const totalClicks = await this.clickLoadMoreButtons(page, 50);
      if (totalClicks > 0) {
        logger.info(`✅ Also clicked ${totalClicks} Load More buttons`);
      }

      // DEBUG: Take screenshot and inspect page structure
      if (options?.dryRun) {
        await page.screenshot({ path: 'debug-klipsch-page.png', fullPage: true });
        logger.info(`📸 Screenshot saved to debug-klipsch-page.png`);
      }

      // Extract product IDs from API calls (already collected in response listener above)
      logger.info('🔍 Extracting product IDs from API calls...');
      
      // Wait a bit more to ensure all API responses are captured (especially from Load More clicks)
      await this.sleep(3000);

      // DIRECT API DISCOVERY: Try fetching product catalog directly from known API endpoints
      // This bypasses scroll/DOM issues entirely
      logger.info('🔍 Attempting direct API discovery for product catalog...');
      try {
        // Common storefront API patterns - try multiple endpoints
        const discoveryEndpoints = [
          '/api/store/seo-product/list?limit=1000',
          '/api/store/products?limit=1000',
          '/api/products?limit=500',
          '/api/store/search?limit=500',
        ];

        for (const endpoint of discoveryEndpoints) {
          try {
            const discoveryUrl = `${this.config.baseUrl}${endpoint}`;
            const response = await fetch(discoveryUrl, {
              headers: {
                'User-Agent': this.config.userAgent,
                'Accept': 'application/json',
                'Referer': fullUrl,
              }
            });

            if (response.ok) {
              const text = await response.text();
              if (text.trim().startsWith('[') || text.trim().startsWith('{')) {
                const data = JSON.parse(text);
                const items = Array.isArray(data) ? data : (data.products || data.items || data.data || []);

                if (Array.isArray(items) && items.length > 0) {
                  for (const item of items) {
                    if (item.ProductId) productIds.add(parseInt(item.ProductId));
                    if (item.id) productIds.add(parseInt(item.id));
                    if (item.product_id) productIds.add(parseInt(item.product_id));
                  }
                  logger.info(`✅ Direct API discovery: Found ${items.length} products from ${endpoint} (${productIds.size} total IDs)`);
                }
              }
            }
          } catch (e) {
            // Endpoint not available, continue
          }
        }
      } catch (e) {
        logger.info('ℹ️ Direct API discovery did not find additional products');
      }
      
      // Log details about captured API requests
      const apiCallsWithProducts = apiRequests.filter(req => req.body && req.body.includes('ProductId'));
      logger.info(`📊 API Summary: ${apiRequests.length} total requests, ${apiCallsWithProducts.length} with product data`);
      
      if (apiCallsWithProducts.length > 0) {
        // Parse any missed product IDs from stored response bodies
        for (const req of apiCallsWithProducts) {
          if (req.body && req.body.trim().startsWith('[')) {
            try {
              const jsonData = JSON.parse(req.body);
              if (Array.isArray(jsonData)) {
                for (const item of jsonData) {
                  if (item.ProductId) productIds.add(parseInt(item.ProductId));
                  if (item.id) productIds.add(parseInt(item.id));
                }
              }
            } catch (e) {
              // Parse failed, continue
            }
          }
        }
      }
      
      // Also extract product IDs directly from DOM (data attributes, hidden inputs, etc.)
      logger.info('🔍 Extracting product IDs from DOM elements...');
      const domProductIds = await page.evaluate(() => {
        const ids = new Set<number>();
        
        // Check for data-product-id, data-id, data-productid attributes
        const productElements = document.querySelectorAll('[data-product-id], [data-id], [data-productid], [data-product-id], .product-item, .product-card');
        productElements.forEach((el: any) => {
          const id = el.getAttribute('data-product-id') || el.getAttribute('data-id') || el.getAttribute('data-productid');
          if (id) {
            const numId = parseInt(id);
            if (!isNaN(numId)) ids.add(numId);
          }
        });
        
        // Check for product IDs in href parameters
        const links = document.querySelectorAll('a[href*="productid="], a[href*="/products/"]');
        links.forEach((link: any) => {
          const href = link.href;
          // Extract from ?productid=123
          const productIdMatch = href.match(/[?&]productid=(\d+)/);
          if (productIdMatch && productIdMatch[1]) {
            ids.add(parseInt(productIdMatch[1]));
          }
          // Extract from /products/.../product-slug format (might have ID in data)
          const parent = link.closest('[data-product-id], [data-id]');
          if (parent) {
            const id = (parent as any).getAttribute('data-product-id') || (parent as any).getAttribute('data-id');
            if (id) {
              const numId = parseInt(id);
              if (!isNaN(numId)) ids.add(numId);
            }
          }
        });
        
        // Check for hidden input fields with product IDs
        const hiddenInputs = document.querySelectorAll('input[type="hidden"][name*="product"], input[type="hidden"][name*="id"]');
        hiddenInputs.forEach((input: any) => {
          const value = input.value;
          if (value && /^\d+$/.test(value)) {
            ids.add(parseInt(value));
          }
        });
        
        return Array.from(ids);
      });
      
      domProductIds.forEach(id => productIds.add(id));
      logger.info(`📋 Found ${domProductIds.length} product IDs from DOM (${productIds.size} total from all sources)`);
      
      logger.info(`✅ Found ${productIds.size} product IDs from API tracking (${apiRequests.length} API requests captured)`);
      
      // Debug: Show some sample product IDs if we have them
      if (productIds.size > 0 && productIds.size <= 50) {
        const sampleIds = Array.from(productIds).slice(0, 10);
        logger.info(`📋 Sample Product IDs: ${sampleIds.join(', ')}`);
      }

      // Collect DOM links to compare
      const productLinks = await this.collectProductLinks(page, options?.limit || 10000);
      logger.info(`🔍 Found ${productLinks.length} product links via DOM`);

      // Decision Logic: Use API if it captured a significant number of products (or more than DOM),
      // otherwise fallback to DOM if API missed them (e.g. Load More didn't trigger API logs correctly).
      let products: PlanetWorldProduct[] = [];
      let apiProducts: PlanetWorldProduct[] = [];
      const apiCount = productIds.size;
      const domCount = productLinks.length;


      // Always fetch API products first as a backup (if IDs exist)
      if (apiCount > 0) {
        try {
          apiProducts = await this.fetchProductsViaAPI(Array.from(productIds), options?.dryRun);
        } catch (e) {
          logger.warn('⚠️ Failed to fetch backup API products');
        }
      }

      // If API found more or equal, OR if API found a "reasonable" amount (e.g. > 20) and DOM suggests the same order of magnitude
      // Actually, simplest heuristic: Use whichever is larger.
      if (apiCount >= domCount && apiCount > 0) {
        logger.info(`🚀 Using API method (${apiCount} IDs >= ${domCount} DOM links)`);
        products = apiProducts;
        logger.info(`✅ Fetched ${products.length} products via API`);
      } else {
        // Fallback to DOM scraping
        logger.warn(`⚠️  Preferring DOM scraping (${domCount} links > ${apiCount} API IDs)`);

        if (domCount === 0) {
          if (apiProducts.length > 0) {
            // If DOM found 0, but API found some, use API (edge case)
            logger.info(`⚠️  DOM found 0 links, reverting to API (${apiProducts.length} products)`);
            products = apiProducts;
          } else {
            throw new Error('No product links found via DOM or API - check selectors and page load');
          }
        } else {
          products = await this.scrapeProductDetails(page, productLinks, options?.dryRun);

          // Safety Net: If DOM scraping failed to extract DETAILS (length 0), fallback to API
          if (products.length === 0 && apiProducts.length > 0) {
            logger.warn(`🚨 DOM scraping found links but extracted 0 products (selector mismatch?). Reverting to API (${apiProducts.length} products).`);
            products = apiProducts;
          }
        }
      }

      let productsAdded = 0;
      let productsUpdated = 0;
      let productsUnchanged = 0;
      const errors: string[] = [];
      const warnings: string[] = [];

      // Process and store products
      for (let i = 0; i < products.length; i++) {
        const rawProduct = products[i];

        try {
          if (i % 50 === 0) {
            logSync.progress('Planet World', i, products.length);
          }

          // Transform to unified schema
          const unifiedProduct = this.transformToUnified(rawProduct);

          if (options?.dryRun) {
            logger.info(`[DRY RUN] Would upsert: ${unifiedProduct.product_name} (RRP: ${unifiedProduct.retail_price}, Sell: ${unifiedProduct.selling_price}) Stock: ${unifiedProduct.total_stock}`);
            continue;
          }

          // Upsert product
          const result = await this.supabase.upsertProduct(unifiedProduct);

          if (result.isNew) {
            productsAdded++;
          } else {
            productsUpdated++;
          }
        } catch (error: any) {
          const errorMsg = `Failed to process ${rawProduct.sku}: ${error.message}`;
          errors.push(errorMsg);
          logger.error(errorMsg);
        }
      }

      // Calculate duration
      const durationSeconds = Math.floor((Date.now() - startTime) / 1000);

      // Complete sync session
      await this.supabase.completeSyncSession(sessionId, {
        products_added: productsAdded,
        products_updated: productsUpdated,
        products_unchanged: productsUnchanged,
        errors,
        warnings,
      });

      // Update supplier
      await this.supabase.updateSupplierStatus(this.supplier.id, 'idle');
      await this.supabase.updateSupplierLastSync(this.supplier.id);

      logSync.complete('Planet World', sessionId, {
        added: productsAdded,
        updated: productsUpdated,
        duration: durationSeconds,
      });

      return {
        success: true,
        session_id: sessionId,
        products_added: productsAdded,
        products_updated: productsUpdated,
        products_unchanged: productsUnchanged,
        errors,
        warnings,
        duration_seconds: durationSeconds,
      };
    } catch (error: any) {
      logger.error(`❌ Planet World sync failed: ${error.message}`);

      if (sessionId && this.supplier) {
        await this.supabase.failSyncSession(sessionId, error);
        await this.supabase.updateSupplierStatus(this.supplier.id, 'error', error.message);
      }

      const durationSeconds = Math.floor((Date.now() - startTime) / 1000);

      return {
        success: false,
        session_id: sessionId,
        products_added: 0,
        products_updated: 0,
        products_unchanged: 0,
        errors: [error.message],
        warnings: [],
        duration_seconds: durationSeconds,
      };
    } finally {
      if (context) {
        await context.close();
      }
    }
  }

  async getStatus(): Promise<SupplierStatus> {
    const supplier = await this.supabase.getSupplierByName('Planet World');

    if (!supplier) {
      return {
        supplier_name: 'Planet World',
        total_products: 0,
        status: 'error',
        error_message: 'Supplier not found in database',
      };
    }

    const totalProducts = await this.supabase.getProductCount(supplier.id);

    return {
      supplier_name: supplier.name,
      last_sync: supplier.last_sync ? new Date(supplier.last_sync) : undefined,
      total_products: totalProducts,
      status: supplier.status as any,
      error_message: supplier.error_message || undefined,
    };
  }

  async getSupplierInfo(): Promise<Supplier> {
    const supplier = await this.supabase.getSupplierByName('Planet World');

    if (!supplier) {
      throw new Error('Planet World supplier not found');
    }

    return supplier;
  }

  // ============================================
  // PLANET WORLD-SPECIFIC METHODS
  // ============================================

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async dismissPopups(page: Page): Promise<void> {
    const popupTexts = ['Continue', 'SAVE & ACCEPT', 'Allow All', 'Accept', 'OK', 'Close'];

    for (const text of popupTexts) {
      try {
        const element = page.getByText(text, { exact: true }).first();
        if (await element.isVisible({ timeout: 2000 })) {
          await element.click();
          logger.info(`✅ Dismissed popup: ${text}`);
          await this.sleep(1000);
        }
      } catch {
        // Popup not found - continue
      }
    }
  }

  private async infiniteScroll(page: Page, maxScrolls: number = 50): Promise<number> {
    let scrollCount = 0;
    let previousProductCount = 0;
    let noChangeCount = 0;

    logger.info('📜 Infinite scrolling to load products...');

    // Get initial product count
    previousProductCount = await this.getProductLinkCount(page);
    logger.info(`📦 Initial product count: ${previousProductCount}`);

    while (scrollCount < maxScrolls) {
      // Scroll gradually to bottom in steps (incrementally rather than instant jump)
      // This helps trigger intersection observers more reliably
      const scrollDistance = await page.evaluate(() => {
        const maxScroll = document.body.scrollHeight - window.innerHeight;
        const currentScroll = window.pageYOffset || document.documentElement.scrollTop;
        return maxScroll - currentScroll;
      });

      // Do gradual scrolling in chunks of 300px with longer delays to trigger intersection observers
      const scrollStep = 300;
      const stepsNeeded = Math.ceil(scrollDistance / scrollStep);

      for (let step = 0; step < stepsNeeded && step < 15; step++) {
        await page.evaluate((stepSize) => {
          window.scrollBy(0, stepSize);
        }, scrollStep);
        await this.sleep(350); // Longer delay between scroll steps for intersection observers
      }

      // Final scroll to ensure we're at the bottom
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });

      scrollCount++;

      // Wait for network activity to settle and content to load
      try {
        await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
      } catch {
        // Network idle timeout is okay, continue
      }
      
      // Wait for network activity to complete and content to render
      await this.sleep(4000); // Increased wait to allow API calls to complete and products to render

      // Check current product count (more reliable than page height)
      const currentProductCount = await this.getProductLinkCount(page);

      if (scrollCount % 5 === 0) {
        logger.info(`📜 Scrolled ${scrollCount} times... Found ${currentProductCount} products so far`);
      }

      // Check if new products were loaded
      if (currentProductCount > previousProductCount) {
        // New products found - reset no-change counter
        logger.info(`📦 Products increased: ${previousProductCount} → ${currentProductCount} (+${currentProductCount - previousProductCount})`);
        previousProductCount = currentProductCount;
        noChangeCount = 0;
      } else {
        // No new products - increment no-change counter
        noChangeCount++;
        
        // Try a small scroll up and down to trigger intersection observers
        if (noChangeCount < 3) {
          await page.evaluate(() => window.scrollBy(0, -200));
          await this.sleep(500);
          await page.evaluate(() => window.scrollBy(0, 300));
          await this.sleep(1000);
          
          // Re-check after scroll jiggle
          const recheckCount = await this.getProductLinkCount(page);
          if (recheckCount > currentProductCount) {
            previousProductCount = recheckCount;
            noChangeCount = 0;
            continue;
          }
        }

        // If no new products found for 3 consecutive scrolls, we're likely at the bottom
        if (noChangeCount >= 3) {
          logger.info(`✅ Reached bottom of page - ${currentProductCount} products loaded (no change for ${noChangeCount} scrolls)`);
          break;
        }
      }
    }

    const finalCount = await this.getProductLinkCount(page);
    logger.info(`📜 Scrolling complete: ${scrollCount} scrolls, ${finalCount} total products`);
    return scrollCount;
  }

  private async getProductLinkCount(page: Page): Promise<number> {
    return await page.evaluate(() => {
      // Use the same selector logic as collectProductLinks to count products
      const productContainers = [
        '.product-grid a[href*="/products/"]',
        '.product-list a[href*="/products/"]',
        '.product-item a[href*="/products/"]',
        '.products-container a[href*="/products/"]',
        '#product-grid a[href*="/products/"]',
        '.main-content a[href*="/products/"]',
        '#content a[href*="/products/"]',
        '.content a[href*="/products/"]',
      ];

      let links: Element[] = [];
      for (const selector of productContainers) {
        try {
          const found = Array.from(document.querySelectorAll(selector));
          if (found.length > 0) {
            links = found;
            break;
          }
        } catch (e) {
          // Selector not found, try next
        }
      }

      // Fallback: Get all product links but exclude sidebar/navigation
      if (links.length === 0) {
        const allProductLinks = Array.from(document.querySelectorAll('a[href*="/products/"]'));
        links = allProductLinks.filter((link: any) => {
          const parent = link.closest('.sidebar, .filter, nav, .navigation, .menu, aside, .categories');
          return !parent;
        });
      }

      // Filter for product detail pages (same logic as collectProductLinks)
      const uniqueUrls = [...new Set(links.map((a: any) => a.href))];
      const filteredUrls = uniqueUrls.filter((url: string) => {
        // Always include URLs with productid param - these are definite product pages
        if (url.includes('productid=')) {
          return true;
        }
        // Exclude pure category browse pages (no productid)
        if (url.includes('/products/browse/') && !url.includes('productid=')) {
          return false;
        }
        // Exclude top-level category pages like /products/audio (single segment, no productid)
        if (/\/products\/[^\/\?]+$/.test(url)) {
          return false;
        }
        // Include product detail pages with slug (e.g., /products/audio/product-name-123)
        // Also include any URL with query params that might indicate a product
        return /\/products\/[^\/]+\/.+/.test(url) || url.includes('?');
      });

      return filteredUrls.length;
    });
  }

  private async clickLoadMoreButtons(page: Page, maxClicks: number = 200): Promise<number> {
    let clickCount = 0;

    logger.info('🔄 Clicking Load More buttons...');

    while (clickCount < maxClicks) {
      const loadMoreSelectors = [
        'text="Load More"',
        'button:has-text("Load More")',
        '[data-testid*="load-more"]',
        '.load-more',
        'button:has-text("Show More")',
        'text="View More"',
        'button[onclick*="load"]',
        '.btn:has-text("Load More")',
      ];

      let buttonFound = false;

      for (const selector of loadMoreSelectors) {
        try {
          const btn = page.locator(selector).first();
          if (await btn.isVisible({ timeout: 1500 })) {
            await btn.click();
            clickCount++;
            logger.info(`📱 Clicked Load More button #${clickCount}`);
            buttonFound = true;

            // Wait for content to load - increase wait time to ensure API responses are captured
            await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => { });
            await this.sleep(2000); // Increased wait to allow API responses to complete
            break;
          }
        } catch {
          // Button not found - continue
        }
      }

      if (!buttonFound) {
        logger.info('✅ No more Load More buttons - all products loaded');
        break;
      }
    }

    return clickCount;
  }

  private async collectProductLinks(page: Page, limit: number): Promise<string[]> {
    // Wait for product cards to actually appear in the DOM after scrolling/loading
    logger.info('⏳ Waiting for product cards to render...');
    await this.sleep(3000); // Give slow-loading products time to render

    // Try to wait for at least some product elements to appear
    try {
      await page.waitForSelector('a[href*="/products/"]', { timeout: 10000 });
      logger.info('✅ Product links detected in DOM');
    } catch (e) {
      logger.warn('⚠️  Timeout waiting for product links - continuing anyway');
    }

    const allLinks = await page.evaluate(() => {
      // IMPORTANT: Exclude left sidebar category filters
      // Target only product cards in the main content area (right side)
      // Common product card selectors: .product-item, .product-card, .product-grid, etc.

      // First try: Look for product grid/list containers and get links from there
      const productContainers = [
        '.product-grid a[href*="/products/"]',
        '.product-list a[href*="/products/"]',
        '.product-item a[href*="/products/"]',
        '.products-container a[href*="/products/"]',
        '#product-grid a[href*="/products/"]',
        '.main-content a[href*="/products/"]',
        '#content a[href*="/products/"]',
        '.content a[href*="/products/"]',
      ];

      let links: Element[] = [];
      for (const selector of productContainers) {
        try {
          const found = Array.from(document.querySelectorAll(selector));
          if (found.length > 0) {
            links = found;
            break;
          }
        } catch (e) {
          // Selector not found, try next
        }
      }

      // Fallback: Get all product links but exclude sidebar/navigation
      if (links.length === 0) {
        const allProductLinks = Array.from(document.querySelectorAll('a[href*="/products/"]'));
        // Exclude links from sidebar, navigation, filters
        links = allProductLinks.filter((link: any) => {
          const parent = link.closest('.sidebar, .filter, nav, .navigation, .menu, aside, .categories');
          return !parent; // Only include links NOT inside these containers
        });
      }

      const uniqueUrls = [...new Set(links.map((a: any) => a.href))];

      // Filter for product detail pages
      return uniqueUrls.filter((url: string) => {
        // Always include URLs with productid param - these are definite product pages
        if (url.includes('productid=')) {
          return true;
        }
        // Exclude pure category browse pages (no productid)
        if (url.includes('/products/browse/') && !url.includes('productid=')) {
          return false;
        }
        // Exclude top-level category pages like /products/audio (single segment, no productid)
        if (/\/products\/[^\/\?]+$/.test(url)) {
          return false;
        }
        // Include product detail pages with slug (e.g., /products/audio/product-name-123)
        // Also include any URL with query params that might indicate a product
        return /\/products\/[^\/]+\/.+/.test(url) || url.includes('?');
      });
    });

    logger.info(`✅ Collected ${allLinks.length} unique product links after filtering`);
    return allLinks.slice(0, limit);
  }

  private async fetchProductsViaAPI(
    productIds: number[],
    dryRun?: boolean
  ): Promise<PlanetWorldProduct[]> {
    const products: PlanetWorldProduct[] = [];

    logger.info(`📡 Fetching ${productIds.length} products via API...`);

    // API endpoint: /api/store/seo-product/list?ids=5430&ids=5557&ids=5558...
    // Batch products in groups of 50 to avoid URL length limits
    const batchSize = 50;
    for (let i = 0; i < productIds.length; i += batchSize) {
      const batch = productIds.slice(i, i + batchSize);
      const idsParam = batch.map(id => `ids=${id}`).join('&');
      const apiUrl = `${this.config.baseUrl}/api/store/seo-product/list?${idsParam}`;

      try {
        logger.info(`📡 Fetching batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(productIds.length / batchSize)}`);

        const response = await fetch(apiUrl, {
          headers: {
            'User-Agent': this.config.userAgent,
            'Accept': 'application/json',
            'Referer': `${this.config.baseUrl}${this.config.productsUrl}`,
          }
        });

        if (!response.ok) {
          logger.warn(`⚠️  API returned ${response.status} for batch ${i}-${i + batchSize}`);
          continue;
        }

        const data = await response.json();

        // Parse API response
        if (Array.isArray(data)) {
          for (const item of data) {
            // Clean price string: "R 12,999.00" -> "12999.00"
            const priceStr = (item.Price || '').toString().replace(/R/gi, '').replace(/,/g, '').replace(/\s/g, '');
            const parsedPrice = parseFloat(priceStr);

            const product: PlanetWorldProduct = {
              sku: item.Sku || item.ProductId?.toString() || '',
              name: item.Name || '',
              price: !isNaN(parsedPrice) ? parsedPrice : 0,
              category: Array.isArray(item.Categories) ? item.Categories[0] : (item.Category || ''),
              brand: item.Brand || 'Unknown',
              image: Array.isArray(item.ImageUrls) && item.ImageUrls.length > 0 ? item.ImageUrls[0] : '',
              productUrl: item.Url || `${this.config.baseUrl}/products/${item.ProductId}`,
              description: item.Description || '',
              inStock: item.HasStock === 'InStock' || item.StockQty > 0,
            };

            if (product.sku && product.name) {
              products.push(product);
            }
          }
        }

        await this.sleep(500); // Rate limiting
      } catch (error: any) {
        logger.error(`❌ API fetch failed for batch ${i}-${i + batchSize}: ${error.message}`);
      }
    }

    return products;
  }

  private async scrapeProductDetails(
    page: Page,
    productLinks: string[],
    dryRun?: boolean
  ): Promise<PlanetWorldProduct[]> {
    const products: PlanetWorldProduct[] = [];

    logger.info(`🏭 Scraping ${productLinks.length} individual product pages...`);

    for (let i = 0; i < productLinks.length; i++) {
      const url = productLinks[i];

      try {
        if (i % 20 === 0) {
          logger.info(`📦 Progress: ${i}/${productLinks.length} products`);
        }

        await page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: 10000,
        });

        // Extract product data using JavaScript
        const productData = await page.evaluate((productUrl: string) => {
          // Name
          const name = (document.querySelector('h1') as any)?.textContent?.trim() ||
            (document.querySelector('.product-name') as any)?.textContent?.trim() ||
            (document.querySelector('.product-title') as any)?.textContent?.trim() ||
            '';

          // SKU
          let sku = '';
          const skuSelectors = ['[data-testid*="sku"]', '.sku', '.product-sku', '.product_sku', 'span[itemprop="sku"]', '#sku'];

          for (const selector of skuSelectors) {
            const skuEl = document.querySelector(selector) as any;
            if (skuEl) {
              sku = (skuEl.textContent || '').replace(/SKU:\s*/i, '').trim();
              break;
            }
          }

          if (!sku) {
            // Try looking for "Product Code"
            const bodyText = (document.body as any).textContent || '';
            const codeMatch = bodyText.match(/Product Code:\s*([^\s\n]+)/i);
            if (codeMatch) {
              sku = codeMatch[1].trim();
            }
          }

          if (!sku) {
            const bodyText = (document.body as any).textContent || '';
            const skuMatch = bodyText.match(/SKU:\s*([^\s\n]+)/i);
            if (skuMatch) {
              sku = skuMatch[1].trim();
            }
          }

          // Brand
          let brand = '';
          const brandSelectors = [
            '[data-testid*="brand"] a',
            '.brand a',
            '.product-brand a',
          ];

          for (const selector of brandSelectors) {
            const brandEl = document.querySelector(selector) as any;
            if (brandEl) {
              brand = brandEl.textContent?.trim() || '';
              break;
            }
          }

          // Price
          let price = 0;
          const priceSelectors = [
            '.price',
            '.product-price',
            '[data-testid*="price"]',
            '.product-info .price',
            'span.price',
            '.amount'
          ];

          for (const selector of priceSelectors) {
            const priceEl = document.querySelector(selector) as any;
            if (priceEl) {
              const priceText = priceEl.innerText || priceEl.textContent || '';
              // Robust cleaning: "R 12,999.00" -> "12999.00"
              // Remove 'R', commas (thousands separator), spaces
              const cleanText = priceText.replace(/[R\s,]/gi, '').replace(/Price/gi, '');
              const priceMatch = cleanText.match(/([0-9]+(\.[0-9]+)?)/);

              if (priceMatch) {
                const extracted = parseFloat(priceMatch[1]);
                if (!isNaN(extracted) && extracted > 0) {
                  price = extracted;
                  break;
                }
              }
            }
          }

          // Stock Status - Look for Green Tick (fa-check-circle etc)
          let inStock = false;
          // Check for visual indicators as described by user: "Red X (out), Green Tick (in)"
          // Common icon classes
          if (document.querySelector('.fa-check') ||
            document.querySelector('.fa-check-circle') ||
            document.querySelector('.icon-check') ||
            document.querySelector('.stock-in') ||
            document.querySelector('.instock') ||
            (document.body.innerText.includes('In Stock') && !document.body.innerText.includes('Out of Stock'))) {
            inStock = true;
          }

          // Also check specific "product-stock-status" elements
          const stockEl = document.querySelector('.product-stock-status') || document.querySelector('.stock-status');
          if (stockEl) {
            const stockText = stockEl.textContent?.toLowerCase() || '';
            if (stockText.includes('in stock')) inStock = true;
            if (stockText.includes('out of stock')) inStock = false;
          }

          // Check for specific icons if present
          const icons = Array.from(document.querySelectorAll('i, span[class*="icon"]'));
          for (const icon of icons) {
            const cls = icon.className.toLowerCase();
            if (cls.includes('check') || cls.includes('tick')) {
              if ((icon as HTMLElement).offsetParent !== null) inStock = true;
            }
            if (cls.includes('times') || cls.includes('cross') || cls.includes('x-circle')) {
              if ((icon as HTMLElement).offsetParent !== null) inStock = false;
            }
          }

          // Image
          let image = '';
          const imgSelectors = [
            '.product-image img',
            '.main-image img',
            '.product-gallery img',
            'img[src*="content.storefront7.co.za"]',
            'img[src*="/media/"]',
          ];

          for (const selector of imgSelectors) {
            const imgEl = document.querySelector(selector) as any;
            if (imgEl && imgEl.src && imgEl.src.includes('http')) {
              image = imgEl.src;
              break;
            }
          }

          return {
            name,
            sku,
            brand,
            price,
            image,
            url: productUrl,
            inStock,
          };
        }, url);

        if (productData.price === 0) {
          logger.warn(`⚠️  Zero price detected for ${productData.sku} (${url})`);
        }

        if (productData.name && productData.sku) {
          const product: PlanetWorldProduct = {
            sku: productData.sku,
            name: productData.name,
            price: productData.price,
            category: 'Electronics',
            brand: productData.brand || this.extractBrand(productData.name),
            image: productData.image,
            productUrl: url,
            inStock: productData.inStock,
          };

          products.push(product);
        }

        // Gentle throttle
        if (i % 20 === 0 && !dryRun) {
          await this.sleep(500);
        }
      } catch (error: any) {
        logger.error(`Error scraping ${url}: ${error.message}`);
      }
    }

    logger.info(`✅ Successfully scraped ${products.length} products`);
    return products;
  }

  private transformToUnified(pwProduct: PlanetWorldProduct): UnifiedProduct {
    // Extract brand from name if not found
    const brand = pwProduct.brand || this.extractBrand(pwProduct.name);

    // Extract category from name
    const category_name = this.extractCategory(pwProduct);

    // Planet World pricing:
    // Retail Price (RRP) = Scraped Price
    // Selling Price = Scraped Price * 0.95 (5% discount)
    // Cost Price = Scraped Price * 0.70 (30% margin)

    const retail_price = pwProduct.price;
    const selling_price = parseFloat((retail_price * 0.95).toFixed(2));
    const cost_price = parseFloat((retail_price * 0.70).toFixed(2));
    const margin_percentage = 25;

    return {
      product_name: pwProduct.name,
      sku: pwProduct.sku,
      model: pwProduct.sku,
      brand,
      category_name,
      description: pwProduct.description,

      cost_price: cost_price,
      retail_price: retail_price,
      selling_price: selling_price,
      margin_percentage: margin_percentage,

      total_stock: pwProduct.inStock ? 5 : 0, // Stock Level 5 as requested for "In Stock"
      stock_jhb: pwProduct.inStock ? 5 : 0,
      stock_cpt: 0,
      stock_dbn: 0,

      images: pwProduct.image ? [pwProduct.image] : [],
      specifications: {
        product_url: pwProduct.productUrl,
        category: pwProduct.category,
      },

      supplier_id: this.supplier!.id,
      supplier_sku: pwProduct.sku,

      active: pwProduct.inStock,
    };
  }

  private extractBrand(name: string): string {
    const nameUpper = name.toUpperCase();

    // Common brands
    const brands = [
      'SAMSUNG',
      'LG',
      'SONY',
      'HISENSE',
      'TCL',
      'PANASONIC',
      'PHILIPS',
      'JBL',
      'BOSE',
      'SONOS',
      'APPLE',
      'LOGITECH',
      'MICROSOFT',
    ];

    for (const brand of brands) {
      if (nameUpper.includes(brand)) {
        return brand.charAt(0) + brand.slice(1).toLowerCase();
      }
    }

    // If no match, take first word
    return name.split(' ')[0] || 'Unknown';
  }

  private extractCategory(product: PlanetWorldProduct): string {
    const name = product.name?.toLowerCase() || '';
    const category = product.category?.toLowerCase() || '';
    const combined = name + ' ' + category;

    if (combined.includes('tv') || combined.includes('television')) return 'Video';
    if (combined.includes('soundbar') || combined.includes('speaker')) return 'Audio';
    if (combined.includes('receiver') || combined.includes('amplifier')) return 'Audio';
    if (combined.includes('projector') || combined.includes('screen')) return 'Video';
    if (combined.includes('cable') || combined.includes('mount')) return 'Accessories';
    if (combined.includes('gaming') || combined.includes('console')) return 'Gaming';

    return 'General';
  }
}

export default PlanetWorldMCPServer;
