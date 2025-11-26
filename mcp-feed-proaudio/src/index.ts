/**
 * Pro Audio MCP Server
 * WordPress REST API + Playwright browser scraping fallback
 */

import 'dotenv/config';
import { chromium, Browser, Page } from 'playwright';
import axios, { AxiosInstance } from 'axios';
import {
  MCPSupplierTool,
  SyncOptions,
  SyncResult,
  SupplierStatus,
  Supplier,
  UnifiedProduct,
  SupabaseService,
  PricingCalculator,
  logger,
  logSync,
} from '@audico/shared';

interface ProAudioProduct {
  sku: string;
  name: string;
  price: number;
  image: string;
  productUrl: string;
  inStock: boolean;
  brand?: string;
  category?: string;
}

export class ProAudioMCPServer implements MCPSupplierTool {
  private supabase: SupabaseService;
  private supplier: Supplier | null = null;
  private client: AxiosInstance;

  private config = {
    baseUrl: process.env.PROAUDIO_BASE_URL || 'https://proaudio.co.za',
    wpRestApi: process.env.PROAUDIO_WP_REST_API || '/wp-json/wc/v3/products',
    headless: process.env.HEADLESS !== 'false',
    timeout: parseInt(process.env.TIMEOUT || '30000'),
  };

  constructor(supabaseUrl?: string, supabaseKey?: string) {
    this.supabase = new SupabaseService(supabaseUrl, supabaseKey);
    this.client = axios.create({
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
  }

  async testConnection(): Promise<boolean> {
    try {
      logger.info('🔌 Testing Pro Audio connection...');

      // Try WordPress REST API first
      try {
        const response = await this.client.get(`${this.config.baseUrl}${this.config.wpRestApi}?per_page=1`);
        if (response.data && Array.isArray(response.data) && response.data.length > 0) {
          logger.info('✅ Pro Audio WordPress REST API connection successful');
          return true;
        }
      } catch (apiError) {
        logger.info('⚠️ WordPress REST API not available, testing browser fallback...');
      }

      // Fallback to browser
      const browser = await chromium.launch({ headless: this.config.headless });
      const page = await browser.newPage();
      await page.goto(this.config.baseUrl, { timeout: 60000, waitUntil: 'domcontentloaded' });
      const title = await page.title();
      await browser.close();

      if (title) {
        logger.info(`✅ Pro Audio browser connection successful: ${title}`);
        return true;
      }
      return false;
    } catch (error: any) {
      logger.error(`❌ Pro Audio connection failed: ${error.message}`);
      return false;
    }
  }

  async syncProducts(options?: SyncOptions): Promise<SyncResult> {
    const startTime = Date.now();
    let sessionId = '';
    let browser: Browser | null = null;

    try {
      this.supplier = await this.supabase.getSupplierByName('Pro Audio');
      if (!this.supplier) throw new Error('Pro Audio supplier not found');

      await this.supabase.updateSupplierStatus(this.supplier.id, 'running');
      sessionId = await this.supabase.createSyncSession(this.supplier.id, options?.sessionName || 'manual');
      logSync.start('Pro Audio', sessionId);

      // Use browser scraping (WordPress REST API often requires authentication)
      browser = await chromium.launch({ headless: this.config.headless });
      const page = await browser.newPage();

      logger.info('📄 Loading Pro Audio shop page...');
      await page.goto(`${this.config.baseUrl}/shop`, { waitUntil: 'domcontentloaded' });

      // Scroll and load more products (WooCommerce infinite scroll or pagination)
      logger.info('🔄 Scrolling to load all products...');
      let previousCount = 0;
      let currentCount = 0;
      let scrollAttempts = 0;
      const maxScrolls = 100;

      do {
        previousCount = currentCount;

        // Scroll to bottom
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(1500);

        // Check for and click pagination/load more buttons
        try {
          const loadMoreBtn = page.locator('a.next, .load-more, button:has-text("Load More")').first();
          if (await loadMoreBtn.isVisible({ timeout: 2000 })) {
            await loadMoreBtn.click();
            await page.waitForTimeout(2000);
            logger.info(`📱 Clicked pagination button #${scrollAttempts + 1}`);
          }
        } catch {
          // No load more button
        }

        currentCount = await page.evaluate(() => {
          return document.querySelectorAll('a[href*="/product/"]').length;
        });

        scrollAttempts++;
        if (scrollAttempts % 5 === 0) {
          logger.info(`📦 Found ${currentCount} product links so far...`);
        }
      } while (currentCount > previousCount && scrollAttempts < maxScrolls);

      // Collect product links
      const productLinks = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a[href*="/product/"]'));
        return [...new Set(links.map((a: any) => a.href))];
      });

      logger.info(`🔍 Found ${productLinks.length} total product links`);

      const limit = options?.limit || productLinks.length;
      const linksToProcess = productLinks.slice(0, limit);

      const products = await this.scrapeProductDetails(page, linksToProcess, options?.dryRun);

      let productsAdded = 0, productsUpdated = 0;
      const errors: string[] = [], warnings: string[] = [];

      for (let i = 0; i < products.length; i++) {
        try {
          if (i % 50 === 0) logSync.progress('Pro Audio', i, products.length);

          const unifiedProduct = this.transformToUnified(products[i]);
          if (options?.dryRun) {
            logger.info(`[DRY RUN] Would upsert: ${unifiedProduct.product_name}`);
            continue;
          }

          const result = await this.supabase.upsertProduct(unifiedProduct);
          result.isNew ? productsAdded++ : productsUpdated++;
        } catch (error: any) {
          errors.push(`Failed to process ${products[i].sku}: ${error.message}`);
        }
      }

      const durationSeconds = Math.floor((Date.now() - startTime) / 1000);
      await this.supabase.completeSyncSession(sessionId, { products_added: productsAdded, products_updated: productsUpdated, products_unchanged: 0, errors, warnings });
      await this.supabase.updateSupplierStatus(this.supplier.id, 'idle');
      await this.supabase.updateSupplierLastSync(this.supplier.id);

      logSync.complete('Pro Audio', sessionId, { added: productsAdded, updated: productsUpdated, duration: durationSeconds });

      return {
        success: true,
        session_id: sessionId,
        products_added: productsAdded,
        products_updated: productsUpdated,
        products_unchanged: 0,
        errors,
        warnings,
        duration_seconds: durationSeconds,
      };
    } catch (error: any) {
      logger.error(`❌ Pro Audio sync failed: ${error.message}`);
      if (sessionId && this.supplier) {
        await this.supabase.failSyncSession(sessionId, error);
        await this.supabase.updateSupplierStatus(this.supplier.id, 'error', error.message);
      }
      return {
        success: false,
        session_id: sessionId,
        products_added: 0,
        products_updated: 0,
        products_unchanged: 0,
        errors: [error.message],
        warnings: [],
        duration_seconds: Math.floor((Date.now() - startTime) / 1000),
      };
    } finally {
      if (browser) await browser.close();
    }
  }

  async getStatus(): Promise<SupplierStatus> {
    const supplier = await this.supabase.getSupplierByName('Pro Audio');
    if (!supplier) return { supplier_name: 'Pro Audio', total_products: 0, status: 'error', error_message: 'Supplier not found' };
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
    const supplier = await this.supabase.getSupplierByName('Pro Audio');
    if (!supplier) throw new Error('Pro Audio supplier not found');
    return supplier;
  }

  private async scrapeProductDetails(page: Page, productLinks: string[], dryRun?: boolean): Promise<ProAudioProduct[]> {
    const products: ProAudioProduct[] = [];

    for (let i = 0; i < productLinks.length; i++) {
      try {
        if (i % 20 === 0) logger.info(`📦 Progress: ${i}/${productLinks.length} products`);

        await page.goto(productLinks[i], { waitUntil: 'domcontentloaded', timeout: 10000 });

        const productData = await page.evaluate((url) => {
          const name = (document.querySelector('h1.product_title') as any)?.textContent?.trim() || '';
          const priceText = (document.querySelector('.price') as any)?.textContent || '';
          const priceMatch = priceText.match(/R\s*([0-9,]+(?:\.[0-9]{2})?)/);
          const price = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : 0;
          const image = (document.querySelector('.woocommerce-product-gallery__image img') as any)?.src || '';
          const sku = (document.querySelector('.sku') as any)?.textContent?.trim() || `PA-${Date.now()}`;
          const brand = (document.querySelector('.product_brand') as any)?.textContent?.trim() || '';

          return { name, sku, price, image, url, brand };
        }, productLinks[i]);

        if (productData.name) {
          products.push({
            sku: productData.sku,
            name: productData.name,
            price: productData.price,
            image: productData.image,
            productUrl: productLinks[i],
            inStock: true,
            brand: productData.brand,
            category: 'Audio',
          });
        }

        if (i % 20 === 0 && !dryRun) await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error: any) {
        logger.error(`Error scraping ${productLinks[i]}: ${error.message}`);
      }
    }

    return products;
  }

  private transformToUnified(paProduct: ProAudioProduct): UnifiedProduct {
    // ProAudio pricing: scraped price is their website price
    // Our retail = scraped price - 10%
    // Our cost = scraped price - 20%
    const scrapedPrice = paProduct.price;
    const retailPrice = scrapedPrice * 0.90; // 10% off scraped price
    const costPrice = scrapedPrice * 0.80; // 20% off scraped price
    const marginPercentage = ((retailPrice - costPrice) / costPrice) * 100;

    return {
      product_name: paProduct.name,
      sku: paProduct.sku,
      model: paProduct.name, // Use product name as model, not SKU
      brand: paProduct.brand || 'Pro Audio',
      category_name: paProduct.category || 'Audio',
      cost_price: parseFloat(costPrice.toFixed(2)),
      retail_price: parseFloat(retailPrice.toFixed(2)),
      selling_price: parseFloat(retailPrice.toFixed(2)),
      margin_percentage: marginPercentage,
      total_stock: paProduct.inStock ? 10 : 0,
      stock_jhb: paProduct.inStock ? 10 : 0,
      stock_cpt: 0,
      stock_dbn: 0,
      images: paProduct.image ? [paProduct.image] : [],
      specifications: { product_url: paProduct.productUrl },
      supplier_id: this.supplier!.id,
      supplier_sku: paProduct.sku,
      active: paProduct.inStock,
    };
  }
}

export default ProAudioMCPServer;
