/**
 * Smart Homes MCP Server
 * Shopify JSON feed integration (similar to Solution Technologies)
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

// Reuse Solution Technologies types
interface SmartHomesProduct {
  id: number;
  title: string;
  handle: string;
  body_html: string;
  vendor: string;
  product_type: string;
  variants: SmartHomesVariant[];
  images: SmartHomesImage[];
}

interface SmartHomesVariant {
  id: number;
  sku: string;
  price: string;
  inventory_quantity: number;
  available: boolean;
}

interface SmartHomesImage {
  src: string;
}

interface SmartHomesAPIResponse {
  products: SmartHomesProduct[];
}

export class SmartHomesMCPServer implements MCPSupplierTool {
  private supabase: SupabaseService;
  private supplier: Supplier | null = null;
  private client: AxiosInstance;

  private config = {
    baseUrl: process.env.SMART_HOMES_BASE_URL || 'https://smart-homes.co.za',
    apiEndpoint: process.env.SMART_HOMES_API_ENDPOINT || '/collections/all/products.json',
    pageLimit: 250,
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

  async testConnection(): Promise<boolean> {
    try {
      logger.info('🔌 Testing Smart Homes API connection...');
      const url = `${this.config.baseUrl}${this.config.apiEndpoint}?limit=1`;
      const response = await this.client.get<SmartHomesAPIResponse>(url);

      if (response.data?.products?.length > 0) {
        logger.info('✅ Smart Homes API connection successful');
        return true;
      }
      return false;
    } catch (error: any) {
      logger.error(`❌ Smart Homes API connection failed: ${error.message}`);
      return false;
    }
  }

  async syncProducts(options?: SyncOptions): Promise<SyncResult> {
    const startTime = Date.now();
    let sessionId = '';

    try {
      this.supplier = await this.supabase.getSupplierByName('Smart Homes');
      if (!this.supplier) throw new Error('Smart Homes supplier not found');

      await this.supabase.updateSupplierStatus(this.supplier.id, 'running');
      sessionId = await this.supabase.createSyncSession(this.supplier.id, options?.sessionName || 'manual');
      logSync.start('Smart Homes', sessionId);

      logger.info('📡 Fetching Smart Homes products...');
      const allProducts = await this.fetchAllProducts(options?.limit);
      logger.info(`📦 Retrieved ${allProducts.length} products`);

      let productsAdded = 0, productsUpdated = 0;
      const errors: string[] = [], warnings: string[] = [];

      for (let i = 0; i < allProducts.length; i++) {
        try {
          if (i % 50 === 0) logSync.progress('Smart Homes', i, allProducts.length);

          const unifiedProduct = this.transformToUnified(allProducts[i]);
          if (options?.dryRun) {
            logger.info(`[DRY RUN] Would upsert: ${unifiedProduct.product_name}`);
            continue;
          }

          const result = await this.supabase.upsertProduct(unifiedProduct);
          result.isNew ? productsAdded++ : productsUpdated++;
        } catch (error: any) {
          errors.push(`Failed to process ${allProducts[i].id}: ${error.message}`);
        }
      }

      const durationSeconds = Math.floor((Date.now() - startTime) / 1000);
      await this.supabase.completeSyncSession(sessionId, { products_added: productsAdded, products_updated: productsUpdated, products_unchanged: 0, errors, warnings });
      await this.supabase.updateSupplierStatus(this.supplier.id, 'idle');
      await this.supabase.updateSupplierLastSync(this.supplier.id);

      logSync.complete('Smart Homes', sessionId, { added: productsAdded, updated: productsUpdated, duration: durationSeconds });

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
      logger.error(`❌ Smart Homes sync failed: ${error.message}`);
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
    }
  }

  async getStatus(): Promise<SupplierStatus> {
    const supplier = await this.supabase.getSupplierByName('Smart Homes');
    if (!supplier) {
      return { supplier_name: 'Smart Homes', total_products: 0, status: 'error', error_message: 'Supplier not found' };
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
    const supplier = await this.supabase.getSupplierByName('Smart Homes');
    if (!supplier) throw new Error('Smart Homes supplier not found');
    return supplier;
  }

  private async fetchAllProducts(limit?: number): Promise<SmartHomesProduct[]> {
    const allProducts: SmartHomesProduct[] = [];
    let page = 1;

    while (!limit || allProducts.length < limit) {
      try {
        const url = `${this.config.baseUrl}${this.config.apiEndpoint}?limit=${this.config.pageLimit}&page=${page}`;
        const response = await this.client.get<SmartHomesAPIResponse>(url);

        if (!response.data.products?.length) break;

        allProducts.push(...response.data.products);
        if (response.data.products.length < this.config.pageLimit) break;

        page++;
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        break;
      }
    }

    return limit ? allProducts.slice(0, limit) : allProducts;
  }

  /**
   * Round to nearest R10. E.g., R95 -> R100, R94 -> R90
   */
  private roundToNearest10(value: number): number {
    return Math.round(value / 10) * 10;
  }

  private transformToUnified(shProduct: SmartHomesProduct): UnifiedProduct {
    const mainVariant = shProduct.variants[0];
    const apiPrice = parseFloat(mainVariant.price) || 0; // This is ex-VAT

    // Smart Homes API returns ex-VAT prices (taxable: true)
    // Website shows incl-VAT prices
    // Step 1: Add 15% VAT to get the "website price"
    const priceInclVat = apiPrice * 1.15;

    // Step 2: Apply 5% discount 
    const discountedPrice = priceInclVat * 0.95;

    // Step 3: Round to nearest R10
    const sellingPrice = this.roundToNearest10(discountedPrice);

    // Cost is the incl-VAT price for margin calculation
    const marginPercentage = priceInclVat > 0
      ? ((priceInclVat - sellingPrice) / priceInclVat) * 100
      : 0;

    return {
      product_name: shProduct.title,
      sku: mainVariant.sku || `sh-${shProduct.id}`,
      model: shProduct.handle,
      brand: shProduct.vendor || 'Smart Homes',
      category_name: shProduct.product_type || 'Electronics',
      description: shProduct.body_html?.replace(/<[^>]*>/g, ' ').trim().substring(0, 500),
      cost_price: priceInclVat,
      retail_price: sellingPrice,
      selling_price: sellingPrice,
      margin_percentage: parseFloat(marginPercentage.toFixed(2)),
      total_stock: mainVariant.available ? 10 : 0,
      stock_jhb: mainVariant.available ? 10 : 0,
      stock_cpt: 0,
      stock_dbn: 0,
      images: shProduct.images.map(img => img.src),
      specifications: { product_id: shProduct.id, handle: shProduct.handle },
      supplier_id: this.supplier!.id,
      supplier_sku: mainVariant.sku || `sh-${shProduct.id}`,
      active: mainVariant.available,
    };
  }
}

export default SmartHomesMCPServer;
