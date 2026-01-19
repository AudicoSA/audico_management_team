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
    let productsAdded = 0;
    let productsUpdated = 0;
    let productsUnchanged = 0;
    const errors: string[] = [];
    const warnings: string[] = [];

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

      // PRE-FLIGHT CHECK
      if (!playwrightChromium) {
        throw new Error('Playwright browser automation is not available.');
      }

      // Use persistent profile
      const userDataDir = path.resolve('.pw-profiles/planetworld-za');
      if (!fs.existsSync(userDataDir)) {
        fs.mkdirSync(userDataDir, { recursive: true });
      }

      context = await playwrightChromium.launchPersistentContext(userDataDir, {
        executablePath: process.env.CHROMIUM_PATH || undefined,
        headless: this.config.headless,
        locale: 'en-ZA',
        timezoneId: 'Africa/Johannesburg',
        viewport: { width: 1920, height: 1080 },
        userAgent: this.config.userAgent,
        args: ['--disable-blink-features=AutomationControlled', '--no-sandbox', '--disable-dev-shm-usage'],
      });

      if (!context) throw new Error('Failed to launch browser context');

      const page = context.pages()[0] || await context.newPage();

      // Pagination Loop
      let pageNum = 1;
      let hasMoreProducts = true;
      const maxPages = 100; // Safety limit
      const limit = options?.limit || 10000;

      logger.info('🚀 Starting paginated scrape...');

      while (hasMoreProducts && pageNum <= maxPages) {
        if ((productsAdded + productsUpdated) >= limit) {
          logger.info(`🛑 Reached limit of ${limit} products`);
          break;
        }

        const pageUrl = `${this.config.baseUrl}${this.config.productsUrl}?page=${pageNum}`;
        logger.info(`📄 Scraping Page ${pageNum}: ${pageUrl}`);

        try {
          await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
          // Wait for product grid
          try {
            await page.waitForSelector('a[href*="/products/"]', { timeout: 5000 });
          } catch (e) {
            // If timeout, might be empty page
          }

          const productLinks = await this.collectProductLinks(page, limit);

          if (productLinks.length === 0) {
            logger.info(`✅ No products found on page ${pageNum}. Reached end of catalog.`);
            hasMoreProducts = false;
            break;
          }

          logger.info(`🔍 Page ${pageNum}: Found ${productLinks.length} products`);

          // Scrape details for this page
          const products = await this.scrapeProductDetails(page, productLinks, options?.dryRun);

          if (products.length === 0) {
            logger.warn(`⚠️ Page ${pageNum} had links but scraping details returned 0 products.`);
            // Don't confirm end of catalog yet, maybe just a partial fail?
            // But if consecutive failures, maybe stop?
            // For now, continue to next page.
          }

          // Upsert batch
          for (const rawProduct of products) {
            try {
              const unifiedProduct = this.transformToUnified(rawProduct);

              if (options?.dryRun) {
                logger.info(`[DRY RUN] Would upsert: ${unifiedProduct.product_name}`);
                continue;
              }

              const result = await this.supabase.upsertProduct(unifiedProduct);
              if (result.isNew) productsAdded++;
              else productsUpdated++;

            } catch (error: any) {
              const errorMsg = `Failed to process ${rawProduct.sku}: ${error.message}`;
              errors.push(errorMsg);
              logger.error(errorMsg);
            }
          }

          if (products.length > 0) {
            // Only increment log progress if we actually found stuff
            logSync.progress('Planet World', productsAdded + productsUpdated, 0);
          }

          pageNum++;
          // Small delay between pages
          await this.sleep(1000);

        } catch (e: any) {
          logger.error(`❌ Error scraping page ${pageNum}: ${e.message}`);
          warnings.push(`Page ${pageNum} failed: ${e.message}`);
          // Continue to next page? Or stop?
          // Retry logic could go here. For now, continue.
          pageNum++;
        }
      }

      // Cleanup
      await context.close();
      context = null;

      const durationSeconds = Math.floor((Date.now() - startTime) / 1000);

      await this.supabase.completeSyncSession(sessionId, {
        products_added: productsAdded,
        products_updated: productsUpdated,
        products_unchanged: productsUnchanged,
        errors,
        warnings,
      });

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
      // ... Error handling simplified ...
      logger.error(`❌ Planet World sync failed: ${error.message}`);
      if (sessionId && this.supplier) {
        await this.supabase.failSyncSession(sessionId, error);
        await this.supabase.updateSupplierStatus(this.supplier.id, 'error', error.message);
      }
      return {
        success: false,
        session_id: sessionId,
        products_added: productsAdded,
        products_updated: productsUpdated,
        products_unchanged: productsUnchanged,
        errors: [error.message],
        warnings: [],
        duration_seconds: Math.floor((Date.now() - startTime) / 1000),
      };
    } finally {
      if (context) await context.close();
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




  private async capturePricingStock(page: Page, timeoutMs = 5000): Promise<{ price: number; inStock: boolean; sku?: string, found: boolean }> {
    try {
      // Capture the first JSON-ish XHR/fetch response that likely contains pricing/stock.
      const res = await page.waitForResponse((r: any) => {
        const rt = r.request().resourceType();
        const url = r.url().toLowerCase();

        // Target specific known endpoints
        const knownEndpoints = [
          'api/store/seo-product/list', // Comprehensive (Price, StockQty, Sku)
          'ajax/pricestock',            // Real-time (RetailPriceIncl, TotalStock)
          'ajax/getproductextra'
        ];

        const isKnownEndpoint = knownEndpoints.some(ep => url.includes(ep));

        // Also look for generic signals if specific endpoints change
        const genericSignal = (rt === 'xhr' || rt === 'fetch') &&
          (url.includes('product') || url.includes('price') || url.includes('stock')) &&
          !url.includes('.js') && !url.includes('.css');

        return isKnownEndpoint || genericSignal;
      }, { timeout: timeoutMs });

      const bodyText = await res.text();
      let data: any = null;
      try { data = JSON.parse(bodyText); } catch { return { price: 0, inStock: false, found: false }; }

      // Strategy 1: SEO Product List (Array)
      if (Array.isArray(data) && data.length > 0 && data[0].Price) {
        const p = data[0];
        return {
          price: parseFloat(p.Price),
          inStock: (p.StockQty && parseFloat(p.StockQty) > 0) || p.HasStock === 'InStock',
          sku: p.Sku,
          found: true
        };
      }

      // Strategy 2: PriceStock (Object)
      if (data.RetailPriceIncl) {
        // "R12,999.00"
        const priceStr = data.RetailPriceIncl.replace(/[^0-9.]/g, '');
        const stock = data.TotalStock ? parseFloat(data.TotalStock) : 0;
        return {
          price: parseFloat(priceStr),
          inStock: stock > 0,
          found: true
        };
      }

      return { price: 0, inStock: false, found: false };

    } catch (e) {
      // Timeout or error
      return { price: 0, inStock: false, found: false };
    }
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

        // START NETWORK LISTENER BEFORE NAVIGATION
        const networkPromise = this.capturePricingStock(page, 5000);

        await page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: 10000,
        });

        // Await the network result (it might clear quickly or timeout)
        const networkData = await networkPromise;
        if (networkData.found) {
          if (dryRun) logger.info(`⚡ API Intercept: Price R${networkData.price}, Stock: ${networkData.inStock} (${url})`);
        }

        // Extract product data using JavaScript (DOM Fallback/Complement)
        // We still need Name, Brand, Image from DOM usually
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

          // Price (DOM Scrape - Fallback)
          let price = 0;
          let debugInfo = '';
          const priceSelectors = [
            '.product-box-price',
            '.price',
            '.product-price',
            '[data-testid*="price"]',
            '.product-info .price',
            'span.price',
            '.amount',
            'span[itemprop="price"]',
            '#price'
          ];

          for (const selector of priceSelectors) {
            const priceEl = document.querySelector(selector) as any;
            if (priceEl) {
              // Get text, but be careful of children like <span class="price-info">
              // Strategy: Get direct text if possible, or just parse the whole string
              let text = priceEl.textContent || '';

              debugInfo += ` [Found ${selector}: "${text.substring(0, 50)}..."] `;

              // Remove "RRP Incl VAT" etc
              text = text.replace(/RRP.*$/, '').replace(/Incl.*$/, '');

              const cleanText = text.replace(/R/gi, '').replace(/,/g, '').replace(/\s/g, '');
              const priceMatch = cleanText.match(/([0-9]+(\.[0-9]+)?)/);

              if (priceMatch) {
                const extracted = parseFloat(priceMatch[1]);
                if (!isNaN(extracted) && extracted > 0) {
                  price = extracted;
                  debugInfo += ` [Extracted: ${price}]`;
                  break;
                }
              }
            }
          }

          if (!debugInfo) {
            debugInfo = `[No selectors matched] Title: ${document.title} BodyStart: ${document.body.innerText.substring(0, 100).replace(/\n/g, ' ')}`;
          }

          // Stock Status (DOM Scrape - Fallback)
          let inStock = false; // Default to false

          const bodyText = document.body.innerText.toLowerCase();

          // 1. Check for specific "No Stock" text first (Override check)
          if (bodyText.includes('no stock') || bodyText.includes('out of stock') || bodyText.includes('sold out')) {
            inStock = false;
          } else if (bodyText.includes('in stock') || bodyText.includes('available')) {
            inStock = true;
          }

          // 2. Check specific element text (Higher priority)
          const stockEl = document.querySelector('.product-stock-status') ||
            document.querySelector('.stock-status') ||
            document.querySelector('.item-in-stock');

          if (stockEl) {
            const stockText = stockEl.textContent?.toLowerCase().trim() || '';
            if (stockText.includes('in stock')) inStock = true;
            if (stockText.includes('no stock') || stockText.includes('out of stock')) inStock = false;
          }

          // 3. Icon Check (Highest priority)
          // <span class="item-in-stock"><i class="fa fa-times"></i>No Stock </span>
          const stockContainer = document.querySelector('.item-in-stock');
          if (stockContainer) {
            if (stockContainer.querySelector('.fa-times') || stockContainer.querySelector('.fa-times-circle')) {
              inStock = false;
            }
            if (stockContainer.querySelector('.fa-check') || stockContainer.querySelector('.fa-check-circle')) {
              inStock = true;
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
            debugInfo, // Return debug info
          };
        }, url);

        // MERGE DATA: Prefer Network Data over DOM Data
        if (networkData.found) {
          productData.price = networkData.price;
          productData.inStock = networkData.inStock;
          if (networkData.sku && !productData.sku) {
            productData.sku = networkData.sku;
          }
        }

        if (productData.price === 0) {
          logger.warn(`⚠️  Zero price detected for ${productData.sku} (${url})`);
          logger.warn(`Debug Info: ${productData.debugInfo}`);
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

if (require.main === module) {
  (async () => {
    try {
      const args = process.argv.slice(2);
      const isDryRun = args.includes('--dry-run');

      const server = new PlanetWorldMCPServer();

      console.log(`Starting PlanetWorld Scraper(Dry Run: ${isDryRun})...`);
      // We need to enable dryRun param in syncProducts
      await server.syncProducts({ dryRun: isDryRun });

      console.log('Sync completed.');
      process.exit(0);
    } catch (error) {
      console.error('Fatal error during execution:', error);
      process.exit(1);
    }
  })();
}
