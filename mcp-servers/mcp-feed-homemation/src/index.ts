import 'dotenv/config';
import { chromium, Browser, Page } from 'playwright';
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

type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock';

interface HomemationProduct {
  sku: string;
  name: string;
  price: number; // ZAR retail/RRP parsed to number
  brand?: string;
  categoryUrl: string;
  detailUrl?: string;
  stockStatus: StockStatus;
  stockQuantity: number; // heuristic: 10/3/0 for green/yellow/red
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * Parse ZAR currency with Unicode-aware handling
 * Handles U+00A0 (NBSP), U+202F (NNBSP), U+2007 (figure space)
 */
function parseZAR(raw: string | null | undefined): number {
  if (!raw) return 0;
  // capture the R-prefixed amount
  const m = raw.match(/R\s*([\d\s.,\u00A0\u202F\u2007]+)/i);
  const body = (m ? m[1] : raw)
    .replace(/[\u00A0\u202F\u2007\s]/g, '') // strip NBSP, NNBSP, figure space, whitespace
    .trim();
  if (!body) return 0;

  let cleaned = body;
  if (cleaned.includes('.') && cleaned.includes(',')) {
    cleaned = cleaned.replace(/,/g, '');       // treat commas as thousands
  } else if (cleaned.includes(',') && !cleaned.includes('.')) {
    if (/,(\d{2})$/.test(cleaned)) cleaned = cleaned.replace(',', '.'); // decimal comma
    else cleaned = cleaned.replace(/,/g, '');                            // thousands
  }
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export class HomemationMCPServer implements MCPSupplierTool {
  private supabase: SupabaseService;
  private supplier: Supplier | null = null;

  private config = {
    baseUrl: process.env.HOMEMATION_BASE_URL || 'https://www.homemation.co.za',
    categoryUrls: (process.env.HOMEMATION_CATEGORY_URLS || '/tv-soundbars,/speakers')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
      .map(path => path.startsWith('http') ? path : (this.ensureNoTrailSlash(process.env.HOMEMATION_BASE_URL || 'https://www.homemation.co.za') + path)),
    username: process.env.HOMEMATION_USERNAME || '',
    password: process.env.HOMEMATION_PASSWORD || '',
    headless: process.env.HEADLESS !== 'false',
    timeout: Number(process.env.TIMEOUT || 30000),
    logLevel: process.env.LOG_LEVEL || 'info'
  };

  constructor(supabaseUrl?: string, supabaseKey?: string) {
    this.supabase = new SupabaseService(
      supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL,
      supabaseKey || process.env.SUPABASE_SERVICE_KEY
    );
  }

  private ensureNoTrailSlash(url: string) {
    return url.endsWith('/') ? url.slice(0, -1) : url;
  }

  /** LOGIN **/
  private async login(page: Page): Promise<boolean> {
    // Skip login - according to the spec in Homemation_Scrape_Info.txt,
    // prices are publicly visible without authentication
    logger.info('ℹ️ Skipping login - prices should be publicly visible');
    return true;
  }

  /** SCRAPE ONE CATEGORY (with lazy-load + stock colour detection) **/
  private async scrapeCategory(page: Page, categoryUrl: string): Promise<HomemationProduct[]> {
    await page.goto(categoryUrl, { waitUntil: 'domcontentloaded', timeout: this.config.timeout });

    // If a country/currency modal appears, try to accept/continue
    try {
      await page.getByText('Continue', { exact: true }).click({ timeout: 1500 });
    } catch { /* ignore */ }

    // Give JS a moment to render price blocks
    await page.waitForTimeout(1500);

    // Handle "Load More" button pagination
    let loadMoreAttempts = 0;
    const maxLoadMore = 50; // Safety limit (621 products / ~40 per page = ~16 clicks)
    let lastProductCount = 0;

    while (loadMoreAttempts < maxLoadMore) {
      // Scroll to bottom to make button visible
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(1000);

      // Count current products
      const currentProductCount = await page.evaluate(() => {
        return document.querySelectorAll('h3').length;
      });

      // Check if we've loaded all products (no new products after clicking)
      if (loadMoreAttempts > 0 && currentProductCount === lastProductCount) {
        console.log(`   └─ All products loaded (${currentProductCount} total)`);
        break;
      }

      // Look for "Load More" button (Homemation uses .btn-load-more)
      const loadMoreButton = await page.$('.btn-load-more');

      if (!loadMoreButton) {
        // No more button, all products loaded
        console.log(`   └─ Load More button not found, all products loaded (${currentProductCount} total)`);
        break;
      }

      // Check if button is visible and enabled
      const isVisible = await loadMoreButton.isVisible().catch(() => false);
      const isEnabled = await loadMoreButton.isEnabled().catch(() => true);

      if (!isVisible || !isEnabled) {
        console.log(`   └─ Load More button hidden/disabled, all products loaded (${currentProductCount} total)`);
        break;
      }

      lastProductCount = currentProductCount;

      // Click the button
      await loadMoreButton.click().catch(() => {});
      loadMoreAttempts++;

      // Wait for new products to load
      await page.waitForTimeout(1500);

      console.log(`   └─ Loaded more products (click ${loadMoreAttempts}, ${currentProductCount} products visible)`);
    }

    // Final scroll to ensure all content is rendered
    await page.evaluate(async () => {
      window.scrollTo(0, 0);
      await new Promise(r => setTimeout(r, 300));
      window.scrollTo(0, document.body.scrollHeight);
    });
    await page.waitForTimeout(1200);


    // Evaluate in page for performance (DOM closest to your spec)
    const scraped = await page.evaluate((catUrl) => {
      const PRICE_RE = /R[\s\u00A0\u202F\u2007]*[\d,.\s\u00A0\u202F\u2007]+/i;
      const BRANDS = ['Denon','Polk','Monitor Audio','Klipsch','Rotel','Bowers & Wilkins','SVS','Control4','Ascendo','Michi','Pulse Eight','Anthem','AudioQuest','Eversolo'];

      function extractPriceText(txt: string): string {
        const m = txt.match(PRICE_RE);
        return m ? m[0] : '';
      }

      function detectStock(card: HTMLElement): {status: 'in_stock'|'low_stock'|'out_of_stock', qty: number} {
        // Look for typical icons/labels; fallback to colour CSS
        // Try class matches first:
        const clues = card.querySelectorAll('[class*="stock"], [class*="tick"], [class*="availability"], i, svg');
        for (const el of Array.from(clues)) {
          const elem = el as HTMLElement;
          const style = window.getComputedStyle(elem);
          const color = (style.color || style.fill || style.backgroundColor || '').toLowerCase();

          if (color.includes('255, 0, 0') || color.includes('red')) {
            return { status: 'out_of_stock', qty: 0 };
          }
          if (color.includes('255, 255, 0') || color.includes('yellow') || color.includes('orange')) {
            return { status: 'low_stock', qty: 3 };
          }
          if (color.includes('0, 128, 0') || color.includes('green')) {
            return { status: 'in_stock', qty: 10 };
          }
        }

        // Textual fallback
        const text = card.innerText.toLowerCase();
        if (text.includes('out of stock')) return { status: 'out_of_stock', qty: 0 };
        if (text.includes('low stock')) return { status: 'low_stock', qty: 3 };
        if (text.includes('in stock'))  return { status: 'in_stock', qty: 10 };
        return { status: 'in_stock', qty: 10 }; // default optimistic
      }

      const results: any[] = [];

      // H3 headings usually hold product names; move upward to find card container
      const h3s = document.querySelectorAll('h3');

      h3s.forEach((h3) => {
        const name = h3.textContent?.trim() || '';
        if (!name) return;
        // Skip non-product headings
        const lower = name.toLowerCase();
        if (lower.includes("let's talk") || lower.includes('request a demo')) return;

        // find container that also includes "Product Code:" somewhere
        let card: HTMLElement | null = h3.parentElement as HTMLElement | null;
        for (let i = 0; i < 4 && card; i++) {
          if (card.innerText.includes('Product Code')) break;
          card = card.parentElement as HTMLElement | null;
        }
        if (!card) return;

        // Go one level up to get the full product card including price
        const fullCard = card.parentElement;
        if (fullCard) card = fullCard;

        // SKU
        const skuHolder = card.querySelector('.product-box-sku, .product-sku, .sku, .code');
        let sku = '';
        if (skuHolder) {
          sku = (skuHolder.textContent || '').replace(/Product\s*Code:\s*/i, '').trim();
        } else {
          // text fallback
          const m = card.innerText.match(/Product\s*Code:\s*([A-Za-z0-9\-_\/]+)/i);
          if (m) sku = m[1].trim();
        }
        if (!sku) return;

        // Price - extract raw text containing "Retail" or price pattern
        let priceText = '';
        const priceNode = card.querySelector('.product-grid-price-contain, .price, .product-price, [class*="price"]');
        const cardText = card.innerText || '';

        if (priceNode) {
          priceText = extractPriceText(priceNode.textContent || '');
        }

        // Fallback: search entire card text for "Retail" line
        if (!priceText && cardText.includes('Retail')) {
          priceText = extractPriceText(cardText);
        }

        // Stock colour / quantity
        const { status, qty } = detectStock(card);

        // Brand (prefix match in name)
        let brand = '';
        for (const b of BRANDS) {
          if (name.toLowerCase().startsWith(b.toLowerCase())) { brand = b; break; }
        }

        // Detail URL (closest anchor)
        let detailUrl = '';
        const link = h3.closest('a') || card.querySelector('a');
        if (link && (link as HTMLAnchorElement).href) {
          detailUrl = (link as HTMLAnchorElement).href;
        }

        results.push({
          name,
          sku,
          priceText,  // Return raw text, parse outside
          brand,
          categoryUrl: catUrl,
          detailUrl,
          stockStatus: status,
          stockQuantity: qty
        });
      });

      return results;
    }, categoryUrl);

    const items = scraped as any[];

    // Parse prices outside browser context using Unicode-aware parser
    return items.map((item: any) => ({
      ...item,
      price: parseZAR(item.priceText)
    })) as HomemationProduct[];
  }

  /** Transform to your unified schema (per spec) */
  private transformToUnified(h: HomemationProduct): UnifiedProduct {
    // Homemation shows PUBLIC retail prices (no login)
    // This is their selling price to customers = our retail price
    const retailPrice = h.price; // What Homemation sells at = our retail

    // Our selling price matches Homemation's retail
    const sellingPrice = retailPrice;

    // Our cost: Retail minus 25%
    const costPrice = retailPrice * 0.75;

    // Margin: 25%
    const marginPercentage = 25;

    return {
      product_name: h.name,
      sku: h.sku,
      model: h.sku,
      brand: h.brand || 'Homemation',
      category_name: h.categoryUrl.split('/').pop() || 'Homemation',
      cost_price: costPrice,        // Homemation's retail (our reference cost)
      retail_price: retailPrice,     // Homemation's retail price
      selling_price: sellingPrice,   // Our price (Homemation retail + 20%)
      margin_percentage: marginPercentage,
      total_stock: h.stockQuantity,
      stock_jhb: h.stockQuantity,
      stock_cpt: 0,
      stock_dbn: 0,
      images: [],
      specifications: {
        product_url: h.detailUrl || h.categoryUrl,
        category: h.categoryUrl,
        stock_status: h.stockStatus
      },
      supplier_id: this.supplier?.id!,
      supplier_sku: h.sku,
      active: h.stockStatus !== 'out_of_stock'
    };
  }

  /** MCPSupplierTool: testConnection */
  async testConnection(): Promise<boolean> {
    const browser = await chromium.launch({ headless: this.config.headless });
    const page = await browser.newPage({ userAgent: 'AudicoPriceBot/1.0 (k.karsten@audico.co.za)' });
    try {
      const ok = await this.login(page);
      if (!ok) return false;

      await page.goto(this.config.categoryUrls[0], { waitUntil: 'domcontentloaded', timeout: this.config.timeout });
      await page.waitForTimeout(1500);

      // Heuristic: look for any product code or price element
      const hasProducts = await page.evaluate(() => {
        const text = document.body.innerText;
        return text.includes('Product Code') || /R\s*[\d\s,]+(\.\d{2})?/i.test(text);
      });

      return !!hasProducts;
    } finally {
      await browser.close();
    }
  }

  /** MCPSupplierTool: syncProducts */
  async syncProducts(options?: SyncOptions): Promise<SyncResult> {
    const started = Date.now();
    const dryRun = !!options?.dryRun;
    const limit = typeof options?.limit === 'number' ? options!.limit! : undefined;

    const browser: Browser = await chromium.launch({ headless: this.config.headless });
    const page: Page = await browser.newPage({ userAgent: 'AudicoPriceBot/1.0 (k.karsten@audico.co.za)' });

    let sessionId = '';

    let added = 0, updated = 0, unchanged = 0;
    const collected: HomemationProduct[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Lazy-load or fetch supplier record once
      if (!this.supplier) {
        this.supplier = await this.getSupplierInfo();
      }

      await this.supabase.updateSupplierStatus(this.supplier.id, 'running');
      sessionId = await this.supabase.createSyncSession(this.supplier.id, options?.sessionName || 'manual');
      logSync.start('Homemation', sessionId);

      if (!(await this.login(page))) {
        throw new Error('Login failed');
      }

      for (let i = 0; i < this.config.categoryUrls.length; i++) {
        const cat = this.config.categoryUrls[i];
        logger.info(`📂 Scraping category ${i + 1}/${this.config.categoryUrls.length}: ${cat}`);
        const rows = await this.scrapeCategory(page, cat);
        const withPrices = rows.filter(r => r.price > 0).length;
        logger.info(`   └─ Found ${rows.length} products (${withPrices} with prices)`);
        collected.push(...rows);

        if (i % 50 === 0) logSync.progress('Homemation', i, this.config.categoryUrls.length);

        await sleep(1200); // polite delay
        if (limit && collected.length >= limit) break;
      }

      // Limit if requested
      const finalRows = limit ? collected.slice(0, limit) : collected;

      // Transform & upsert
      for (const row of finalRows) {
        try {
          const unified = this.transformToUnified(row);
          if (dryRun) {
            logger.info(`[DRY RUN] Would upsert: ${unified.product_name} (${unified.sku}) ZAR ${unified.selling_price}`);
            continue;
          }
          const res = await this.supabase.upsertProduct(unified);
          res.isNew ? added++ : updated++;
        } catch (error: any) {
          errors.push(`Failed to process ${row.sku}: ${error.message}`);
        }
      }

      const durationSeconds = Math.floor((Date.now() - started) / 1000);

      await this.supabase.completeSyncSession(sessionId, {
        products_added: added,
        products_updated: updated,
        products_unchanged: unchanged,
        errors,
        warnings
      });
      await this.supabase.updateSupplierStatus(this.supplier.id, 'idle');
      await this.supabase.updateSupplierLastSync(this.supplier.id);

      logSync.complete('Homemation', sessionId, {
        added,
        updated,
        duration: durationSeconds
      });

      return {
        success: true,
        session_id: sessionId,
        products_added: added,
        products_updated: updated,
        products_unchanged: unchanged,
        errors,
        warnings,
        duration_seconds: durationSeconds
      };
    } catch (err: any) {
      logger.error(`❌ Sync failed: ${err?.message || err}`);

      if (sessionId && this.supplier) {
        await this.supabase.failSyncSession(sessionId, err);
        await this.supabase.updateSupplierStatus(this.supplier.id, 'error', err.message);
      }

      const durationSeconds = Math.floor((Date.now() - started) / 1000);

      return {
        success: false,
        session_id: sessionId,
        products_added: added,
        products_updated: updated,
        products_unchanged: unchanged,
        errors: [err?.message || String(err)],
        warnings,
        duration_seconds: durationSeconds
      };
    } finally {
      await browser.close();
    }
  }

  /** MCPSupplierTool: getStatus */
  async getStatus(): Promise<SupplierStatus> {
    const supplier = await this.supabase.getSupplierByName('Homemation');
    if (!supplier) {
      return {
        supplier_name: 'Homemation',
        total_products: 0,
        status: 'error',
        error_message: 'Supplier not found'
      };
    }

    const totalProducts = await this.supabase.getProductCount(supplier.id);
    return {
      supplier_name: supplier.name,
      last_sync: supplier.last_sync ? new Date(supplier.last_sync) : undefined,
      total_products: totalProducts,
      status: supplier.status as any,
      error_message: supplier.error_message || undefined
    };
  }

  /** MCPSupplierTool: getSupplierInfo */
  async getSupplierInfo(): Promise<Supplier> {
    const supplier = await this.supabase.getSupplierByName('Homemation');
    if (!supplier) throw new Error('Homemation supplier not found');
    return supplier;
  }
}

export default HomemationMCPServer;
