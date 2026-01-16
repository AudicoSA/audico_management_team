/**
 * Solution Technologies MCP Server
 * Shopify JSON feed integration with continuous pagination
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
// SOLUTION TECHNOLOGIES API TYPES
// ============================================

interface SolutionTechnologiesProduct {
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
  variants: SolutionTechnologiesVariant[];
  images: SolutionTechnologiesImage[];
  options: SolutionTechnologiesOption[];
}

interface SolutionTechnologiesVariant {
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

interface SolutionTechnologiesImage {
  id: number;
  product_id: number;
  position: number;
  src: string;
  alt?: string;
  width: number;
  height: number;
}

interface SolutionTechnologiesOption {
  id: number;
  product_id: number;
  name: string;
  position: number;
  values: string[];
}

interface SolutionTechnologiesAPIResponse {
  products: SolutionTechnologiesProduct[];
}

// ============================================
// SOLUTION TECHNOLOGIES MCP SERVER
// ============================================

export class SolutionTechnologiesMCPServer implements MCPSupplierTool {
  private supabase: SupabaseService;
  private supplier: Supplier | null = null;
  private client: AxiosInstance;

  private config = {
    baseUrl:
      process.env.SOLUTION_TECHNOLOGIES_BASE_URL || 'https://solutiontechnologies.co.za',
    apiEndpoint:
      process.env.SOLUTION_TECHNOLOGIES_API_ENDPOINT || '/collections/all/products.json',
    pageLimit: parseInt(process.env.SOLUTION_TECHNOLOGIES_PAGE_LIMIT || '250'),
  };

  constructor(supabaseUrl?: string, supabaseKey?: string) {
    this.supabase = new SupabaseService(supabaseUrl, supabaseKey);

    this.client = axios.create({
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'application/json',
      },
    });
  }

  // ============================================
  // MCP INTERFACE IMPLEMENTATION
  // ============================================

  async testConnection(): Promise<boolean> {
    try {
      logger.info('🔌 Testing Solution Technologies API connection...');

      const url = `${this.config.baseUrl}${this.config.apiEndpoint}?limit=1`;
      const response = await this.client.get<SolutionTechnologiesAPIResponse>(url);

      if (response.data && response.data.products && response.data.products.length > 0) {
        logger.info(
          `✅ Solution Technologies API connection successful - products available`
        );
        return true;
      }

      logger.error('❌ Solution Technologies API returned invalid data');
      return false;
    } catch (error: any) {
      logger.error(`❌ Solution Technologies API connection failed: ${error.message}`);
      return false;
    }
  }

  async syncProducts(options?: SyncOptions): Promise<SyncResult> {
    const startTime = Date.now();
    let sessionId = '';

    try {
      // Get supplier record
      this.supplier = await this.supabase.getSupplierByName('Solution Technologies');
      if (!this.supplier) {
        throw new Error('Solution Technologies supplier not found in database');
      }

      // Update supplier status
      await this.supabase.updateSupplierStatus(this.supplier.id, 'running');

      // Create sync session
      sessionId = await this.supabase.createSyncSession(
        this.supplier.id,
        options?.sessionName || 'manual'
      );

      logSync.start('Solution Technologies', sessionId);

      // Fetch all products with pagination
      logger.info('📡 Fetching Solution Technologies products with pagination...');
      const allProducts = await this.fetchAllProducts(options?.limit);

      logger.info(`📦 Retrieved ${allProducts.length} products from Solution Technologies`);

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
            logSync.progress('Solution Technologies', i, allProducts.length);
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

      logSync.complete('Solution Technologies', sessionId, {
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
      logger.error(`❌ Solution Technologies sync failed: ${error.message}`);

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
    const supplier = await this.supabase.getSupplierByName('Solution Technologies');

    if (!supplier) {
      return {
        supplier_name: 'Solution Technologies',
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
    const supplier = await this.supabase.getSupplierByName('Solution Technologies');

    if (!supplier) {
      throw new Error('Solution Technologies supplier not found');
    }

    return supplier;
  }

  // ============================================
  // SOLUTION TECHNOLOGIES-SPECIFIC METHODS
  // ============================================

  private async fetchAllProducts(limit?: number): Promise<SolutionTechnologiesProduct[]> {
    const allProducts: SolutionTechnologiesProduct[] = [];
    let page = 1;
    let hasMoreProducts = true;
    let lastProductId: string | null = null;

    logger.info('🔄 Starting continuous pagination...');

    while (hasMoreProducts && (!limit || allProducts.length < limit)) {
      try {
        logger.info(`📄 Fetching page ${page}...`);

        const products = await this.fetchProductPage(page, lastProductId);

        if (products.length === 0) {
          logger.info(`📄 Page ${page} returned 0 products - pagination complete`);
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
          `📦 Page ${page}: Found ${products.length} products, ${newProductsCount} new, ${allProducts.length} total`
        );

        if (newProductsCount === 0) {
          logger.info(`🛑 No new products found on page ${page} - stopping`);
          hasMoreProducts = false;
        } else if (products.length < this.config.pageLimit) {
          logger.info(
            `🏁 Page ${page} returned fewer than ${this.config.pageLimit} products - likely final page`
          );
          hasMoreProducts = false;
        }

        page++;

        // Safety limit
        if (page > 100) {
          logger.info('⚠️ Safety limit reached (100 pages) - stopping');
          hasMoreProducts = false;
        }

        // Polite delay between requests
        if (hasMoreProducts) {
          await this.delay(2000);
        }
      } catch (error: any) {
        logger.error(`❌ Error fetching page ${page}: ${error.message}`);
        hasMoreProducts = false;
      }
    }

    logger.info(`✅ Pagination complete: ${allProducts.length} total products`);

    // Apply limit if specified
    if (limit && allProducts.length > limit) {
      return allProducts.slice(0, limit);
    }

    return allProducts;
  }

  private async fetchProductPage(
    page: number,
    lastProductId: string | null
  ): Promise<SolutionTechnologiesProduct[]> {
    // Strategy 1: Page-based pagination
    try {
      const url = `${this.config.baseUrl}${this.config.apiEndpoint}?limit=${this.config.pageLimit}&page=${page}`;
      const response = await this.client.get<SolutionTechnologiesAPIResponse>(url);
      if (response.data && response.data.products && response.data.products.length > 0) {
        return response.data.products;
      }
    } catch (error) {
      logger.info(`📄 Page-based pagination failed for page ${page}`);
    }

    // Strategy 2: Cursor-based pagination (since_id)
    if (lastProductId && page > 1) {
      try {
        const url = `${this.config.baseUrl}${this.config.apiEndpoint}?limit=${this.config.pageLimit}&since_id=${lastProductId}`;
        const response = await this.client.get<SolutionTechnologiesAPIResponse>(url);
        if (response.data && response.data.products && response.data.products.length > 0) {
          return response.data.products;
        }
      } catch (error) {
        logger.info(`📄 Cursor-based pagination failed for since_id ${lastProductId}`);
      }
    }

    return [];
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private transformToUnified(
    stProduct: SolutionTechnologiesProduct
  ): UnifiedProduct {
    const mainVariant = stProduct.variants[0];
    const mainImage = stProduct.images[0];

    // Parse price (cost excl VAT)
    const costExclVat = parseFloat(mainVariant.price) || 0;

    // Use 15% VAT + 25% margin pricing
    const costInclVat = costExclVat * 1.15;
    const sellingPrice = costInclVat * 1.25;
    const marginPercentage = ((sellingPrice - costExclVat) / costExclVat) * 100;

    // Extract category
    const category_name = this.mapProductType(stProduct.product_type);

    // Parse HTML description
    const description = this.parseHtmlDescription(stProduct.body_html);

    return {
      product_name: stProduct.title,
      sku: mainVariant.sku || `st-${stProduct.id}`,
      model: stProduct.handle,
      brand: stProduct.vendor || 'Solution Technologies',
      category_name,
      description,

      cost_price: costExclVat,
      retail_price: sellingPrice,
      selling_price: sellingPrice,
      margin_percentage: parseFloat(marginPercentage.toFixed(2)),

      total_stock: mainVariant.available ? 10 : 0, // Default stock
      stock_jhb: mainVariant.available ? 10 : 0,
      stock_cpt: 0,
      stock_dbn: 0,

      images: stProduct.images.map(img => img.src),
      specifications: {
        product_id: stProduct.id,
        handle: stProduct.handle,
        product_type: stProduct.product_type,
        tags: stProduct.tags,
        vendor: stProduct.vendor,
        options: stProduct.options,
      },

      supplier_id: this.supplier!.id,
      supplier_sku: mainVariant.sku || `st-${stProduct.id}`,

      active: mainVariant.available,
    };
  }

  private parseHtmlDescription(html: string): string {
    if (!html) return 'Professional technology product from Solution Technologies.';

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
      text = `${text} Professional technology product from Solution Technologies.`;
    }

    return text.substring(0, 500) + (text.length > 500 ? '...' : '');
  }

  private mapProductType(productType: string): string {
    const typeMap: Record<string, string> = {
      Converters: 'Audio Visual',
      'Control Systems': 'Networking',
      Speakers: 'Audio Visual',
      Amplifiers: 'Audio Visual',
      Microphones: 'Audio Visual',
      Cables: 'Accessories',
      Monitors: 'Audio Visual',
      Keyboards: 'Computing',
      Mice: 'Computing',
    };

    return typeMap[productType] || 'Electronics';
  }
}

export default SolutionTechnologiesMCPServer;
