/**
 * Stock2Shop (Linkqage) MCP Server
 * Official Stock2Shop API integration with Elasticsearch
 */

import 'dotenv/config';
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

// ============================================
// STOCK2SHOP API TYPES
// ============================================

interface Stock2ShopAuthResponse {
  system_user: {
    id: number;
    username: string;
    email: string;
    role_description: string;
    token: string;
    client_name: string;
    channels: Array<{ id: number; description: string }>;
    sources: Array<{ id: number; description: string }>;
  };
}

interface Stock2ShopProduct {
  id: number;
  source_product_code: string;
  title: string;
  body_html: string;
  active: boolean;
  modified: string;
  vendor?: string;
  variants: Stock2ShopVariant[];
  images: Stock2ShopImage[];
  meta: Record<string, any>;
}

interface Stock2ShopVariant {
  id: number;
  sku: string;
  source_variant_code: string;
  title: string;
  price: number;
  inventory_quantity: number;
  option1?: string;
  option2?: string;
  option3?: string;
  meta: Record<string, any>;
}

interface Stock2ShopImage {
  id: number;
  src: string;
  alt: string;
  position: number;
}

// ============================================
// STOCK2SHOP MCP SERVER
// ============================================

export class Stock2ShopMCPServer implements MCPSupplierTool {
  private supabase: SupabaseService;
  private supplier: Supplier | null = null;
  private client: AxiosInstance;
  private token: string | null = null;
  private lastRequest: Date = new Date(0);

  private config = {
    baseUrl: process.env.STOCK2SHOP_BASE_URL || 'https://api.stock2shop.com',
    username: process.env.STOCK2SHOP_USERNAME || '',
    password: process.env.STOCK2SHOP_PASSWORD || '',
    channelId: parseInt(process.env.STOCK2SHOP_CHANNEL_ID || '689'),
    rateLimit: 3, // 3 requests per second when authenticated
  };

  constructor(supabaseUrl?: string, supabaseKey?: string) {
    this.supabase = new SupabaseService(supabaseUrl, supabaseKey);

    this.client = axios.create({
      baseURL: this.config.baseUrl,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      timeout: 30000,
    });
  }

  // ============================================
  // MCP INTERFACE IMPLEMENTATION
  // ============================================

  async testConnection(): Promise<boolean> {
    try {
      logger.info('🔌 Testing Stock2Shop API connection...');

      await this.authenticate();

      if (this.token) {
        logger.info('✅ Stock2Shop API connection successful');
        return true;
      }

      logger.error('❌ Stock2Shop API authentication failed');
      return false;
    } catch (error: any) {
      logger.error(`❌ Stock2Shop API connection failed: ${error.message}`);
      return false;
    }
  }

  async syncProducts(options?: SyncOptions): Promise<SyncResult> {
    const startTime = Date.now();
    let sessionId = '';

    try {
      // Get supplier record
      this.supplier = await this.supabase.getSupplierByName('Stock2Shop (Linkqage)');
      if (!this.supplier) {
        throw new Error('Stock2Shop supplier not found in database');
      }

      // Update supplier status
      await this.supabase.updateSupplierStatus(this.supplier.id, 'running');

      // Create sync session
      sessionId = await this.supabase.createSyncSession(
        this.supplier.id,
        options?.sessionName || 'manual'
      );

      logSync.start('Stock2Shop', sessionId);

      // Authenticate
      await this.authenticate();

      // Search products from Elasticsearch with pagination
      logger.info('📥 Fetching products from Stock2Shop Elasticsearch...');

      // Fetch ALL products with pagination (unless limit is specified for testing)
      const allProducts: Stock2ShopProduct[] = [];
      const pageSize = 100; // Elasticsearch page size
      let from = 0;
      let totalProducts = 0;

      do {
        const response = await this.searchProducts({}, from, pageSize);
        totalProducts = response.total;
        allProducts.push(...response.products);
        from += pageSize;

        logger.info(`📄 Fetched ${allProducts.length} / ${totalProducts} products...`);

        // Break if we've fetched all products
        if (allProducts.length >= totalProducts) break;

        // Apply limit if specified (for testing)
        if (options?.limit && allProducts.length >= options.limit) {
          allProducts.splice(options.limit);
          break;
        }
      } while (from < totalProducts);

      logger.info(`✅ Fetched total of ${allProducts.length} products from Stock2Shop`);
      logger.info(`📦 Processing ${allProducts.length} products...`);

      let productsAdded = 0;
      let productsUpdated = 0;
      let productsUnchanged = 0;
      const errors: string[] = [];
      const warnings: string[] = [];

      // Process each product
      for (let i = 0; i < allProducts.length; i++) {
        const rawProduct = allProducts[i];

        try {
          if (i % 50 === 0) {
            logSync.progress('Stock2Shop', i, allProducts.length);
          }

          // Transform to unified schema
          const unifiedProduct = this.transformToUnified(rawProduct);

          if (options?.dryRun) {
            logger.info(`[DRY RUN] Would upsert: ${unifiedProduct.product_name}`);
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
          const errorMsg = `Failed to process ${rawProduct.source_product_code}: ${error.message}`;
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

      logSync.complete('Stock2Shop', sessionId, {
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
      logger.error(`❌ Stock2Shop sync failed: ${error.message}`);

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
    const supplier = await this.supabase.getSupplierByName('Stock2Shop (Linkqage)');

    if (!supplier) {
      return {
        supplier_name: 'Stock2Shop (Linkqage)',
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
    const supplier = await this.supabase.getSupplierByName('Stock2Shop (Linkqage)');

    if (!supplier) {
      throw new Error('Stock2Shop supplier not found');
    }

    return supplier;
  }

  // ============================================
  // STOCK2SHOP-SPECIFIC METHODS
  // ============================================

  private async authenticate(): Promise<void> {
    try {
      logger.info('🔐 Authenticating with Stock2Shop...');

      const response = await this.client.post('/v1/users/authenticate', {
        system_user_auth: {
          username: this.config.username,
          password: this.config.password,
        },
      });

      const authData: Stock2ShopAuthResponse = response.data;
      this.token = authData.system_user.token;

      logger.info(`✅ Authenticated as ${authData.system_user.username} (${authData.system_user.client_name})`);
    } catch (error: any) {
      throw new Error(`Stock2Shop authentication failed: ${error.message}`);
    }
  }

  private async rateLimitDelay(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequest.getTime();
    const minInterval = 1000 / this.config.rateLimit; // ms between requests

    if (timeSinceLastRequest < minInterval) {
      const delay = minInterval - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    this.lastRequest = new Date();
  }

  private async searchProducts(
    query: any = {},
    from: number = 0,
    size: number = 100
  ): Promise<{ products: Stock2ShopProduct[]; total: number }> {
    await this.rateLimitDelay();

    const searchQuery = {
      from,
      size,
      sort: [{ modified: { order: 'desc' } }],
      query: {
        bool: {
          must: [],
          filter: query ? [{ match: query }] : []
        },
      },
      _source: [
        'id',
        'title',
        'body_html',
        'source_product_code',
        'active',
        'modified',
        'vendor',
        'images',
        'variants.*',
        'meta.*',
      ],
    };

    const response = await this.client.post('/v1/products/elastic_search', searchQuery, {
      params: {
        token: this.token,
        channel_id: this.config.channelId, // LinkQage B2B Channel
      },
    });

    const products = response.data.hits?.hits?.map((hit: any) => hit._source) || [];
    // Elasticsearch can return total as a number or as an object with value property
    const totalHits = response.data.hits?.total;
    const total = typeof totalHits === 'number' ? totalHits : (totalHits?.value || products.length);

    logger.info(`✅ Found ${total} total products, returning ${products.length}`);

    return { products, total };
  }

  private transformToUnified(s2sProduct: Stock2ShopProduct): UnifiedProduct {
    // Use first variant for pricing (most products have single variant)
    const variant = s2sProduct.variants?.[0];

    if (!variant) {
      throw new Error(`Product ${s2sProduct.source_product_code} has no variants`);
    }

    // Extract brand from vendor or product title
    const brand = s2sProduct.vendor || this.extractBrand(s2sProduct.title);

    // Extract images
    const images = s2sProduct.images?.map(img => img.src) || [];

    // Use standard 20% margin
    const pricing = PricingCalculator.standardMarkup(variant.price, 20);

    // Extract category from product title or meta
    const category_name = this.extractCategory(s2sProduct);

    return {
      product_name: s2sProduct.title,
      sku: variant.sku,
      model: variant.source_variant_code,
      brand,
      category_name,
      description: s2sProduct.body_html,

      cost_price: variant.price,
      retail_price: pricing.selling_price,
      selling_price: pricing.selling_price,
      margin_percentage: pricing.margin_percentage,

      total_stock: variant.inventory_quantity,
      stock_jhb: variant.inventory_quantity, // Stock2Shop doesn't split by region
      stock_cpt: 0,
      stock_dbn: 0,

      images,
      specifications: {
        source_product_code: s2sProduct.source_product_code,
        stock2shop_id: s2sProduct.id,
        variant_id: variant.id,
        options: {
          option1: variant.option1,
          option2: variant.option2,
          option3: variant.option3,
        },
        meta: s2sProduct.meta,
      },

      supplier_id: this.supplier!.id,
      supplier_sku: s2sProduct.source_product_code,

      active: s2sProduct.active,
    };
  }

  private extractBrand(title: string): string {
    const titleUpper = title.toUpperCase();

    // Common brands
    const brands = [
      'DENON',
      'YAMAHA',
      'SONY',
      'MARANTZ',
      'ONKYO',
      'JBL',
      'BOSE',
      'KLIPSCH',
      'KEF',
      'POLK',
      'SAMSUNG',
      'LG',
    ];

    for (const brand of brands) {
      if (titleUpper.includes(brand)) {
        return brand.charAt(0) + brand.slice(1).toLowerCase(); // Proper case
      }
    }

    // If no match, take first word
    return title.split(' ')[0] || 'Unknown';
  }

  private extractCategory(product: Stock2ShopProduct): string {
    const title = product.title?.toLowerCase() || '';
    const desc = product.body_html?.toLowerCase() || '';
    const combined = title + ' ' + desc;

    if (combined.includes('receiver') || combined.includes('amplifier')) return 'Audio';
    if (combined.includes('speaker')) return 'Audio';
    if (combined.includes('tv') || combined.includes('display')) return 'Video';
    if (combined.includes('projector') || combined.includes('screen')) return 'Video';
    if (combined.includes('cable') || combined.includes('mount')) return 'Accessories';

    return 'General';
  }
}

export default Stock2ShopMCPServer;
