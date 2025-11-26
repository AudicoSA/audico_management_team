/**
 * Connoisseur MCP Server
 * Shopify JSON feed integration with continuous pagination
 * Pricing: Retail price from Shopify, Cost = Retail * 0.8 (less 20%)
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
// CONNOISSEUR API TYPES
// ============================================

interface ConnoisseurProduct {
  id: number;
  title: string;
  handle: string;
  body_html: string;
  vendor: string;
  product_type: string;
  published_at: string;
  created_at: string;
  updated_at: string;
  tags: string[];
  variants: ConnoisseurVariant[];
  images: ConnoisseurImage[];
  options: ConnoisseurOption[];
}

interface ConnoisseurVariant {
  id: number;
  product_id: number;
  title: string;
  price: string;
  sku: string;
  position: number;
  inventory_quantity: number;
  available: boolean;
  compare_at_price?: string;
  barcode?: string;
  option1?: string;
  option2?: string;
  option3?: string;
}

interface ConnoisseurImage {
  id: number;
  product_id: number;
  position: number;
  src: string;
  alt?: string;
  width: number;
  height: number;
}

interface ConnoisseurOption {
  id: number;
  product_id: number;
  name: string;
  position: number;
  values: string[];
}

interface ConnoisseurAPIResponse {
  products: ConnoisseurProduct[];
}

// ============================================
// CONNOISSEUR MCP SERVER
// ============================================

export class ConnoisseurMCPServer implements MCPSupplierTool {
  private supabase: SupabaseService;
  private supplier: Supplier | null = null;
  private client: AxiosInstance;

  private config = {
    baseUrl: process.env.CONNOISSEUR_BASE_URL || 'https://www.connoisseur.co.za',
    collections: ['all', 'shop-all-jbl', 'shop-philips'], // Fetch from all collections
    pageLimit: parseInt(process.env.CONNOISSEUR_PAGE_LIMIT || '250'),
  };

  constructor(supabaseUrl?: string, supabaseKey?: string) {
    this.supabase = new SupabaseService(supabaseUrl, supabaseKey);

    this.client = axios.create({
      timeout: 30000,
      headers: {
        'User-Agent': 'AudicoResearchBot/1.0 (+contact: hello@audico.co.za)',
        Accept: 'application/json',
      },
    });
  }

  // ============================================
  // MCP INTERFACE IMPLEMENTATION
  // ============================================

  async testConnection(): Promise<boolean> {
    try {
      logger.info('🔌 Testing Connoisseur API connection...');

      // Test first collection
      const url = `${this.config.baseUrl}/collections/${this.config.collections[0]}/products.json?limit=1`;
      const response = await this.client.get<ConnoisseurAPIResponse>(url);

      if (response.data && response.data.products && response.data.products.length > 0) {
        logger.info(`✅ Connoisseur API connection successful - products available`);
        return true;
      }

      logger.error('❌ Connoisseur API returned invalid data');
      return false;
    } catch (error: any) {
      logger.error(`❌ Connoisseur API connection failed: ${error.message}`);
      return false;
    }
  }

  async syncProducts(options?: SyncOptions): Promise<SyncResult> {
    const startTime = Date.now();
    let sessionId = '';

    try {
      // Get supplier record
      this.supplier = await this.supabase.getSupplierByName('Connoisseur');
      if (!this.supplier) {
        throw new Error('Connoisseur supplier not found in database');
      }

      // Update supplier status
      await this.supabase.updateSupplierStatus(this.supplier.id, 'running');

      // Create sync session
      sessionId = await this.supabase.createSyncSession(
        this.supplier.id,
        options?.sessionName || 'manual'
      );

      logSync.start('Connoisseur', sessionId);

      // Fetch all products with pagination
      logger.info('📡 Fetching Connoisseur products with pagination...');
      const allProducts = await this.fetchAllProducts(options?.limit);

      logger.info(`📦 Retrieved ${allProducts.length} products from Connoisseur`);

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
            logSync.progress('Connoisseur', i, allProducts.length);
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
          const errorMsg = `Failed to process ${rawProduct.id}: ${error.message}`;
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

      logSync.complete('Connoisseur', sessionId, {
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
      logger.error(`❌ Connoisseur sync failed: ${error.message}`);

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
    const supplier = await this.supabase.getSupplierByName('Connoisseur');

    if (!supplier) {
      return {
        supplier_name: 'Connoisseur',
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
    const supplier = await this.supabase.getSupplierByName('Connoisseur');

    if (!supplier) {
      throw new Error('Connoisseur supplier not found');
    }

    return supplier;
  }

  // ============================================
  // CONNOISSEUR-SPECIFIC METHODS
  // ============================================

  private async fetchAllProducts(limit?: number): Promise<ConnoisseurProduct[]> {
    const allProducts: ConnoisseurProduct[] = [];

    logger.info('🔄 Starting multi-collection fetch...');
    logger.info(`📚 Collections to fetch: ${this.config.collections.join(', ')}`);

    // Fetch from each collection
    for (const collection of this.config.collections) {
      logger.info(`\n📂 Fetching collection: ${collection}`);

      let page = 1;
      let hasMoreProducts = true;
      let lastProductId: string | null = null;

      while (hasMoreProducts && (!limit || allProducts.length < limit)) {
        try {
          logger.info(`📄 Fetching ${collection} page ${page}...`);

          const products = await this.fetchProductPage(collection, page, lastProductId);

          if (products.length === 0) {
            logger.info(`📄 Page ${page} returned 0 products - collection complete`);
            hasMoreProducts = false;
            break;
          }

          // Check for duplicates and add new products
          let newProductsCount = 0;
          for (const product of products) {
            const exists = allProducts.some(p => p.id === product.id);
            if (!exists) {
              allProducts.push(product);
              newProductsCount++;
              lastProductId = String(product.id);
            }
          }

          logger.info(
            `📦 ${collection} page ${page}: Found ${products.length} products, ${newProductsCount} new, ${allProducts.length} total`
          );

          if (newProductsCount === 0) {
            logger.info(`🛑 No new products found on page ${page} - stopping collection`);
            hasMoreProducts = false;
          } else if (products.length < this.config.pageLimit) {
            logger.info(
              `🏁 Page ${page} returned fewer than ${this.config.pageLimit} products - likely final page`
            );
            hasMoreProducts = false;
          }

          page++;

          // Safety limit per collection
          if (page > 100) {
            logger.info('⚠️ Safety limit reached (100 pages) - stopping collection');
            hasMoreProducts = false;
          }

          // Polite delay between requests (1 req/sec as per requirements)
          if (hasMoreProducts) {
            await this.delay(1000);
          }
        } catch (error: any) {
          logger.error(`❌ Error fetching ${collection} page ${page}: ${error.message}`);
          hasMoreProducts = false;
        }
      }

      logger.info(`✅ Collection '${collection}' complete`);
    }

    logger.info(`\n✅ All collections fetched: ${allProducts.length} total products`);

    // Apply limit if specified
    if (limit && allProducts.length > limit) {
      return allProducts.slice(0, limit);
    }

    return allProducts;
  }

  private async fetchProductPage(
    collection: string,
    page: number,
    lastProductId: string | null
  ): Promise<ConnoisseurProduct[]> {
    const apiEndpoint = `/collections/${collection}/products.json`;

    // Strategy 1: Page-based pagination
    try {
      const url = `${this.config.baseUrl}${apiEndpoint}?limit=${this.config.pageLimit}&page=${page}`;
      const response = await this.client.get<ConnoisseurAPIResponse>(url);
      if (response.data && response.data.products && response.data.products.length > 0) {
        return response.data.products;
      }
    } catch (error) {
      logger.info(`📄 Page-based pagination failed for ${collection} page ${page}`);
    }

    // Strategy 2: Cursor-based pagination (since_id)
    if (lastProductId && page > 1) {
      try {
        const url = `${this.config.baseUrl}${apiEndpoint}?limit=${this.config.pageLimit}&since_id=${lastProductId}`;
        const response = await this.client.get<ConnoisseurAPIResponse>(url);
        if (response.data && response.data.products && response.data.products.length > 0) {
          return response.data.products;
        }
      } catch (error) {
        logger.info(`📄 Cursor-based pagination failed for ${collection} since_id ${lastProductId}`);
      }
    }

    return [];
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private transformToUnified(conProduct: ConnoisseurProduct): UnifiedProduct {
    const mainVariant = conProduct.variants[0];
    const mainImage = conProduct.images[0];

    // Parse retail price from Shopify
    const retailPrice = parseFloat(mainVariant.price) || 0;

    // Calculate cost price (retail less 20%)
    const costPrice = retailPrice * 0.8;

    // Selling price is same as retail price
    const sellingPrice = retailPrice;

    // Calculate margin percentage
    const marginPercentage = costPrice > 0 ? ((sellingPrice - costPrice) / costPrice) * 100 : 0;

    // Extract category
    const category_name = this.mapProductType(conProduct.product_type);

    // Parse HTML description
    const description = this.parseHtmlDescription(conProduct.body_html);

    // Extract SKU from product (e.g., CON000859)
    const sku = mainVariant.sku || `con-${conProduct.id}`;

    return {
      product_name: conProduct.title,
      sku,
      model: conProduct.handle,
      brand: conProduct.vendor || 'Connoisseur',
      category_name,
      description,

      cost_price: costPrice,
      retail_price: retailPrice,
      selling_price: sellingPrice,
      margin_percentage: parseFloat(marginPercentage.toFixed(2)),

      total_stock: mainVariant.available ? 10 : 0,
      stock_jhb: mainVariant.available ? 10 : 0,
      stock_cpt: 0,
      stock_dbn: 0,

      images: conProduct.images.map(img => img.src),
      specifications: {
        product_id: conProduct.id,
        handle: conProduct.handle,
        product_type: conProduct.product_type,
        tags: conProduct.tags,
        vendor: conProduct.vendor,
        options: conProduct.options,
        inventory_quantity: mainVariant.inventory_quantity,
      },

      supplier_id: this.supplier!.id,
      supplier_sku: sku,

      active: mainVariant.available,
    };
  }

  private parseHtmlDescription(html: string): string {
    if (!html) return 'Premium audio and home entertainment product from Connoisseur.';

    // Remove HTML tags and clean up
    let text = html
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim();

    // Limit length
    if (text.length < 50) {
      text = `${text} Premium audio and home entertainment product from Connoisseur.`;
    }

    return text.substring(0, 500) + (text.length > 500 ? '...' : '');
  }

  private mapProductType(productType: string): string {
    const typeMap: Record<string, string> = {
      // Audio categories
      Speakers: 'Audio Visual',
      Headphones: 'Audio Visual',
      Amplifiers: 'Audio Visual',
      Receivers: 'Audio Visual',
      Turntables: 'Audio Visual',
      'CD Players': 'Audio Visual',
      'Streaming Devices': 'Audio Visual',

      // Home cinema
      Projectors: 'Audio Visual',
      'Projector Screens': 'Audio Visual',
      Soundbars: 'Audio Visual',
      Subwoofers: 'Audio Visual',

      // Accessories
      Cables: 'Accessories',
      Mounts: 'Accessories',
      'Power Conditioners': 'Accessories',

      // Smart home
      'Smart Home': 'Home Automation',
      'Home Audio': 'Audio Visual',
      'New Products': 'Audio Visual',
    };

    return typeMap[productType] || 'Audio Visual';
  }
}

export default ConnoisseurMCPServer;
