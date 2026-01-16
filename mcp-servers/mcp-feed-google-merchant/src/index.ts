/**
 * Google Merchant Feed MCP Server
 *
 * PURPOSE: Sync OpenCart Google Merchant Feed products to Supabase
 *
 * LOOP PREVENTION:
 * - Only syncs products that don't exist from real suppliers (Nology, Esquire, etc.)
 * - Checks supplier_id before upserting
 * - Uses "Manual Upload" supplier for OpenCart products
 *
 * USAGE:
 * - One-time migration: npm run migrate (imports all 7k+ products)
 * - Ongoing sync: npm run sync (catches new manual products)
 */

import 'dotenv/config';
import axios, { AxiosInstance } from 'axios';
import { XMLParser } from 'fast-xml-parser';
import {
  MCPSupplierTool,
  SyncOptions,
  SyncResult,
  SupplierStatus,
  Supplier,
  UnifiedProduct,
  SupabaseService,
  logger,
  logSync,
} from '@audico/shared';

// ============================================
// GOOGLE FEED TYPES
// ============================================

interface GoogleFeedProduct {
  'g:id': string;
  'g:title': string;
  'g:description'?: string;
  'g:link': string;
  'g:image_link'?: string;
  'g:price': string; // e.g. "4690.00 ZAR"
  'g:availability': string; // "in stock" | "out of stock"
  'g:brand'?: string;
  'g:gtin'?: string;
  'g:mpn'?: string;
  'g:condition'?: string;
  'g:product_type'?: string;
  'g:google_product_category'?: string;
}

// ============================================
// GOOGLE MERCHANT FEED MCP SERVER
// ============================================

export class GoogleMerchantFeedMCPServer implements MCPSupplierTool {
  private supabase: SupabaseService;
  private supplier: Supplier | null = null;
  private client: AxiosInstance;

  // Cache of real supplier IDs (to prevent loop)
  private realSupplierIds: string[] = [];

  private config = {
    feedUrl: process.env.GOOGLE_FEED_URL || 'https://www.audico.co.za/index.php?route=extension/feed/google_base',
    timeout: parseInt(process.env.TIMEOUT || '30000'),
  };

  constructor(supabaseUrl?: string, supabaseKey?: string) {
    this.supabase = new SupabaseService(supabaseUrl, supabaseKey);
    this.client = axios.create({
      timeout: this.config.timeout,
      headers: {
        'User-Agent': 'AudicoMCPSync/1.0',
      },
    });
  }

  // ============================================
  // MCP INTERFACE IMPLEMENTATION
  // ============================================

  async testConnection(): Promise<boolean> {
    try {
      logger.info('🔌 Testing Google Merchant Feed connection...');

      const response = await this.client.get(this.config.feedUrl, {
        timeout: 60000, // 60 seconds for large feed
      });

      if (!response.data) {
        logger.error('❌ No data received from feed');
        return false;
      }

      // Parse XML to verify it's valid
      const parser = new XMLParser({
        ignoreAttributes: false,
        parseTagValue: false,
        cdataPropName: '__cdata', // Handle CDATA sections
        trimValues: true,
      });

      const parsed = parser.parse(response.data);

      if (!parsed.rss || !parsed.rss.channel || !parsed.rss.channel.item) {
        logger.error('❌ Invalid feed structure');
        return false;
      }

      const itemCount = Array.isArray(parsed.rss.channel.item)
        ? parsed.rss.channel.item.length
        : 1;

      logger.info(`✅ Google Feed connection successful - ${itemCount} products available`);
      return true;
    } catch (error: any) {
      logger.error(`❌ Google Feed connection failed: ${error.message}`);
      return false;
    }
  }

  async syncProducts(options?: SyncOptions): Promise<SyncResult> {
    const startTime = Date.now();
    let sessionId = '';

    try {
      // Get supplier record (Manual Upload)
      this.supplier = await this.supabase.getSupplierByName('Manual Upload');
      if (!this.supplier) {
        throw new Error('Manual Upload supplier not found in database');
      }

      // Load real supplier IDs for loop prevention
      await this.loadRealSupplierIds();

      // Update supplier status
      await this.supabase.updateSupplierStatus(this.supplier.id, 'running');

      // Create sync session
      sessionId = await this.supabase.createSyncSession(
        this.supplier.id,
        options?.sessionName || 'manual'
      );

      logSync.start('Google Merchant Feed', sessionId);

      // Fetch and parse feed
      logger.info('📡 Fetching Google Merchant Feed...');
      const products = await this.fetchAndParseFeed();
      logger.info(`📦 Parsed ${products.length} products from feed`);

      let productsAdded = 0;
      let productsUpdated = 0;
      let productsSkipped = 0;
      const errors: string[] = [];
      const warnings: string[] = [];

      // Process products with loop prevention
      for (let i = 0; i < products.length; i++) {
        const rawProduct = products[i];

        try {
          if (i % 100 === 0) {
            logSync.progress('Google Merchant Feed', i, products.length);
          }

          // LOOP PREVENTION: Check if product exists from a real supplier
          const shouldSkip = await this.shouldSkipProduct(rawProduct['g:id']);

          if (shouldSkip.skip) {
            productsSkipped++;
            if (i % 500 === 0 && shouldSkip.reason) {
              logger.info(`⏭️  Skipping ${rawProduct['g:id']}: ${shouldSkip.reason}`);
            }
            continue;
          }

          // Transform to unified schema
          const unifiedProduct = this.transformToUnified(rawProduct);

          if (options?.dryRun) {
            logger.info(`[DRY RUN] Would upsert: ${unifiedProduct.product_name} (${unifiedProduct.sku})`);
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
          const errorMsg = `Failed to process ${rawProduct['g:id']}: ${error.message}`;
          errors.push(errorMsg);

          if (errors.length < 10) {
            logger.error(errorMsg);
          }
        }
      }

      // Calculate duration
      const durationSeconds = Math.floor((Date.now() - startTime) / 1000);

      // Log summary
      logger.info(`📊 Sync Summary:`);
      logger.info(`   Added: ${productsAdded}`);
      logger.info(`   Updated: ${productsUpdated}`);
      logger.info(`   Skipped (supplier products): ${productsSkipped}`);
      logger.info(`   Errors: ${errors.length}`);

      // Complete sync session
      await this.supabase.completeSyncSession(sessionId, {
        products_added: productsAdded,
        products_updated: productsUpdated,
        products_unchanged: productsSkipped,
        errors,
        warnings,
      });

      // Update supplier
      await this.supabase.updateSupplierStatus(this.supplier.id, 'idle');
      await this.supabase.updateSupplierLastSync(this.supplier.id);

      logSync.complete('Google Merchant Feed', sessionId, {
        added: productsAdded,
        updated: productsUpdated,
        duration: durationSeconds,
      });

      return {
        success: true,
        session_id: sessionId,
        products_added: productsAdded,
        products_updated: productsUpdated,
        products_unchanged: productsSkipped,
        errors,
        warnings,
        duration_seconds: durationSeconds,
      };
    } catch (error: any) {
      logger.error(`❌ Google Feed sync failed: ${error.message}`);

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
    }
  }

  async getStatus(): Promise<SupplierStatus> {
    const supplier = await this.supabase.getSupplierByName('Manual Upload');

    if (!supplier) {
      return {
        supplier_name: 'Manual Upload',
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
    const supplier = await this.supabase.getSupplierByName('Manual Upload');

    if (!supplier) {
      throw new Error('Manual Upload supplier not found');
    }

    return supplier;
  }

  // ============================================
  // GOOGLE FEED-SPECIFIC METHODS
  // ============================================

  /**
   * Load all real supplier IDs to prevent syncing their products
   */
  private async loadRealSupplierIds(): Promise<void> {
    try {
      const { data, error } = await this.supabase['client']
        .from('suppliers')
        .select('id, name')
        .neq('name', 'Manual Upload')
        .neq('name', 'Pinnacle'); // Also exclude legacy suppliers if any

      if (error) throw error;

      this.realSupplierIds = data.map((s: any) => s.id);

      logger.info(`🛡️  Loop prevention: Loaded ${this.realSupplierIds.length} real supplier IDs`);
    } catch (error: any) {
      logger.warn(`⚠️  Could not load supplier IDs: ${error.message}`);
      this.realSupplierIds = [];
    }
  }

  /**
   * LOOP PREVENTION: Check if product should be skipped
   * Returns true if product exists from a real supplier
   */
  private async shouldSkipProduct(sku: string): Promise<{skip: boolean, reason?: string}> {
    try {
      const { data, error } = await this.supabase['client']
        .from('products')
        .select('supplier_id')
        .eq('sku', sku)
        .single();

      if (error) {
        // Product doesn't exist - safe to import
        if (error.code === 'PGRST116') {
          return { skip: false };
        }
        throw error;
      }

      // Product exists - check if it's from a real supplier
      if (this.realSupplierIds.includes(data.supplier_id)) {
        return {
          skip: true,
          reason: `Managed by supplier ID ${data.supplier_id}`
        };
      }

      // Product exists from Manual Upload - safe to update
      return { skip: false };
    } catch (error: any) {
      logger.warn(`⚠️  Error checking product ${sku}: ${error.message}`);
      // Default to safe behavior - skip on error
      return { skip: true, reason: 'Error checking product' };
    }
  }

  /**
   * Fetch and parse Google Merchant Feed XML
   */
  private async fetchAndParseFeed(): Promise<GoogleFeedProduct[]> {
    const response = await this.client.get(this.config.feedUrl);

    const parser = new XMLParser({
      ignoreAttributes: false,
      parseTagValue: false,
      cdataPropName: '__cdata',
      trimValues: true,
    });

    const parsed = parser.parse(response.data);

    if (!parsed.rss || !parsed.rss.channel || !parsed.rss.channel.item) {
      throw new Error('Invalid feed structure');
    }

    const items = Array.isArray(parsed.rss.channel.item)
      ? parsed.rss.channel.item
      : [parsed.rss.channel.item];

    return items as GoogleFeedProduct[];
  }

  /**
   * Transform Google Feed product to UnifiedProduct schema
   */
  private transformToUnified(gProduct: any): UnifiedProduct {
    // Helper to extract CDATA or plain text
    const getText = (field: any): string => {
      if (!field) return '';
      if (typeof field === 'string') return field;
      if (field.__cdata) return field.__cdata;
      if (field['#text']) return field['#text'];
      return String(field);
    };

    const title = getText(gProduct.title || gProduct['g:title']);
    const sku = getText(gProduct['g:id']);
    const priceText = getText(gProduct['g:price']);
    const brandText = getText(gProduct['g:brand']);
    const availabilityText = getText(gProduct['g:availability']);
    const linkText = getText(gProduct.link || gProduct['g:link']);
    const imageText = getText(gProduct['g:image_link']);
    const mpnText = getText(gProduct['g:mpn']);
    const descriptionText = getText(gProduct.description || gProduct['g:description']);

    // Parse price (e.g. "4690.00 ZAR" -> 4690.00)
    const priceMatch = priceText.match(/([0-9.]+)/);
    const price = priceMatch ? parseFloat(priceMatch[1]) : 0;

    // Extract brand from title if not provided
    const brand = brandText || this.extractBrandFromTitle(title);

    // Extract category - g:product_type can be an array or string
    let category = 'General';
    const productType = gProduct['g:product_type'];
    if (productType) {
      if (Array.isArray(productType)) {
        category = getText(productType[0]); // Take first category
      } else {
        category = getText(productType);
      }
    }
    if (!category || category === 'General') {
      category = getText(gProduct['g:google_product_category']) || 'General';
    }

    // Stock status
    const inStock = availabilityText?.toLowerCase().includes('in stock') ?? true;

    return {
      product_name: title,
      sku: sku,
      model: mpnText || sku,
      brand: brand,
      category_name: category,
      description: descriptionText,

      // Pricing: Google Feed shows our selling price
      cost_price: price * 0.8, // Estimate cost as 80% of retail
      retail_price: price,
      selling_price: price,
      margin_percentage: 20,

      // Stock (default values, update from OpenCart later)
      total_stock: inStock ? 5 : 0,
      stock_jhb: inStock ? 5 : 0,
      stock_cpt: 0,
      stock_dbn: 0,

      // Images
      images: imageText ? [imageText] : [],

      // Specifications
      specifications: {
        product_url: linkText,
        condition: getText(gProduct['g:condition']) || 'new',
        gtin: getText(gProduct['g:gtin']),
        source: 'google_merchant_feed',
      },

      supplier_id: this.supplier!.id,
      supplier_sku: sku,

      active: inStock,
    };
  }

  /**
   * Extract brand from product title
   */
  private extractBrandFromTitle(title: string): string {
    const commonBrands = [
      'Samsung', 'LG', 'Sony', 'Denon', 'Polk', 'Monitor Audio',
      'Klipsch', 'Bose', 'JBL', 'Yamaha', 'Marantz', 'Pioneer',
      'Onkyo', 'KEF', 'B&W', 'Bowers & Wilkins', 'SVS', 'Control4',
      'Rotel', 'Anthem', 'AudioQuest', 'Eversolo', 'Hisense', 'TCL'
    ];

    for (const brand of commonBrands) {
      if (title.toLowerCase().includes(brand.toLowerCase())) {
        return brand;
      }
    }

    // Default to first word
    return title.split(' ')[0] || 'Unknown';
  }
}

export default GoogleMerchantFeedMCPServer;
