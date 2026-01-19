/**
 * Nology MCP Server
 * Extracts the gold from linkqage-ecommerce/lib/nology-service.ts
 * and transforms it to use the unified schema
 */

import axios from 'axios';
import {
  MCPSupplierTool,
  SyncOptions,
  SyncResult,
  SupplierStatus,
  Supplier,
  UnifiedProduct,
  SupabaseService,
  PricingCalculator,
  ProductAutoTagger,
  logger,
  logSync,
} from '@audico/shared';

// ============================================
// NOLOGY API TYPES
// ============================================

interface NologyProduct {
  Model: string;
  ShortDescription: string;
  LongDescription: string;
  GlobalSKU: string;
  Barcode: string;
  Brand: string; // CRITICAL: Brand field for detection
  TotalQtyAvailable: Array<{ CPT?: number; JHB?: number }>;
  Price: number; // Cost excluding VAT
  Image: string | null; // Base64 image data
  AdditionalImages?: Array<{ Image: string }>;
  AllImages?: string; // Pipe-separated URLs
  RelatedItems?: Array<{ Model: string; Relation: string }>;
}

// ============================================
// NOLOGY MCP SERVER
// ============================================

export class NologyMCPServer implements MCPSupplierTool {
  private supabase: SupabaseService;
  private supplier: Supplier | null = null;

  private config = {
    baseUrl: process.env.NOLOGY_API_BASE_URL || 'https://erp.nology.co.za/NologyDataFeed/api',
    username: process.env.NOLOGY_API_USERNAME || 'AUV001',
    secret: process.env.NOLOGY_API_SECRET || 'e2bzCs64bM',
    timeout: 30000,
  };

  constructor(supabaseUrl?: string, supabaseKey?: string) {
    this.supabase = new SupabaseService(supabaseUrl, supabaseKey);
  }

  // ============================================
  // MCP INTERFACE IMPLEMENTATION
  // ============================================

  async testConnection(): Promise<boolean> {
    try {
      logger.info('🔌 Testing Nology API connection...');

      const response = await axios.get(`${this.config.baseUrl}/Products/View`, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        data: {
          Username: this.config.username,
          Secret: this.config.secret,
          ImageData: false,
        },
        timeout: this.config.timeout,
      });

      if (response.data && Array.isArray(response.data)) {
        logger.info(`✅ Nology API connection successful (${response.data.length} products available)`);
        return true;
      }

      logger.error('❌ Nology API returned invalid format');
      return false;
    } catch (error: any) {
      logger.error(`❌ Nology API connection failed: ${error.message}`);
      return false;
    }
  }

  async syncProducts(options?: SyncOptions): Promise<SyncResult> {
    const startTime = Date.now();
    let sessionId = '';

    try {
      // Get supplier record
      this.supplier = await this.supabase.getSupplierByName('Nology');
      if (!this.supplier) {
        throw new Error('Nology supplier not found in database');
      }

      // Update supplier status
      await this.supabase.updateSupplierStatus(this.supplier.id, 'running');

      // Create sync session
      sessionId = await this.supabase.createSyncSession(
        this.supplier.id,
        options?.sessionName || 'manual'
      );

      logSync.start('Nology', sessionId);

      // Fetch products from Nology API
      logger.info('📥 Fetching products from Nology API...');
      const rawProducts = await this.fetchProducts();

      if (options?.limit) {
        rawProducts.splice(options.limit);
      }

      logger.info(`📦 Processing ${rawProducts.length} products...`);

      let productsAdded = 0;
      let productsUpdated = 0;
      let productsUnchanged = 0;
      const errors: string[] = [];
      const warnings: string[] = [];

      // Process each product
      for (let i = 0; i < rawProducts.length; i++) {
        const rawProduct = rawProducts[i];

        try {
          if (i % 50 === 0) {
            logSync.progress('Nology', i, rawProducts.length);
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
          const errorMsg = `Failed to process ${rawProduct.Model}: ${error.message}`;
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

      logSync.complete('Nology', sessionId, {
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
      logger.error(`❌ Nology sync failed: ${error.message}`);

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
    const supplier = await this.supabase.getSupplierByName('Nology');

    if (!supplier) {
      return {
        supplier_name: 'Nology',
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
    const supplier = await this.supabase.getSupplierByName('Nology');

    if (!supplier) {
      throw new Error('Nology supplier not found');
    }

    return supplier;
  }

  // ============================================
  // NOLOGY-SPECIFIC METHODS
  // ============================================

  private async fetchProducts(): Promise<NologyProduct[]> {
    try {
      const response = await axios.get(`${this.config.baseUrl}/Products/View`, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        data: {
          Username: this.config.username,
          Secret: this.config.secret,
          ImageData: false, // Don't download base64 images (use URLs instead)
        },
        timeout: this.config.timeout,
      });

      if (response.data && Array.isArray(response.data)) {
        logger.info(`✅ Fetched ${response.data.length} products from Nology API`);
        return response.data;
      } else {
        throw new Error('Invalid response format from Nology API');
      }
    } catch (error: any) {
      throw new Error(`Failed to fetch from Nology API: ${error.message}`);
    }
  }

  private transformToUnified(nologyProduct: NologyProduct): UnifiedProduct {
    // Extract stock info
    const stockInfo = nologyProduct.TotalQtyAvailable?.[0] || {};
    const stock_cpt = stockInfo.CPT || 0;
    const stock_jhb = stockInfo.JHB || 0;
    const total_stock = stock_cpt + stock_jhb;

    // Calculate pricing using Nology formula (15% VAT + 15% margin)
    const pricing = PricingCalculator.nologyPricing(nologyProduct.Price || 0);

    // Extract images
    const images: string[] = [];
    if (nologyProduct.AdditionalImages && nologyProduct.AdditionalImages.length > 0) {
      images.push(...nologyProduct.AdditionalImages.map(img => img.Image));
    }

    // Extract category from description or model
    const category_name = this.extractCategory(nologyProduct);

    // Build specifications
    const specifications: Record<string, any> = {
      global_sku: nologyProduct.GlobalSKU,
      barcode: nologyProduct.Barcode,
      all_images: nologyProduct.AllImages,
    };

    if (nologyProduct.RelatedItems && nologyProduct.RelatedItems.length > 0) {
      specifications.related_items = nologyProduct.RelatedItems;
    }

    // Auto-tag for consultation mode (Build #10)
    const autoTags = ProductAutoTagger.autoTag({
      product_name: nologyProduct.ShortDescription || nologyProduct.Model,
      description: nologyProduct.LongDescription,
      category_name,
    });

    return {
      product_name: nologyProduct.ShortDescription || nologyProduct.Model,
      sku: nologyProduct.GlobalSKU,
      model: nologyProduct.Model,
      brand: nologyProduct.Brand || this.extractBrand(nologyProduct.Model),
      category_name,
      description: nologyProduct.LongDescription,

      cost_price: pricing.cost_price,
      retail_price: pricing.retail_price,
      selling_price: pricing.selling_price,
      margin_percentage: pricing.margin_percentage,

      total_stock,
      stock_jhb,
      stock_cpt,
      stock_dbn: 0, // Nology doesn't have DBN

      images,
      specifications,

      supplier_url: `${this.config.baseUrl}/Products/${nologyProduct.Model}`,
      supplier_id: this.supplier!.id,
      supplier_sku: nologyProduct.GlobalSKU,

      active: true,

      // Build #10: Consultation mode auto-tagging
      scenario_tags: autoTags.scenario_tags,
      mounting_type: autoTags.mounting_type || undefined,
      exclude_from_consultation: autoTags.exclude_from_consultation,
    };
  }

  private extractCategory(product: NologyProduct): string {
    const desc = product.ShortDescription?.toLowerCase() || '';
    const model = product.Model?.toLowerCase() || '';

    // Audio categories
    if (desc.includes('speaker') || desc.includes('audio')) return 'Audio';
    if (desc.includes('microphone') || desc.includes('mic')) return 'Audio';
    if (desc.includes('amplifier') || desc.includes('amp')) return 'Audio';

    // Video categories
    if (desc.includes('camera') || desc.includes('video')) return 'Video';
    if (desc.includes('display') || desc.includes('monitor')) return 'Video';

    // Networking
    if (desc.includes('router') || desc.includes('switch')) return 'Networking';
    if (desc.includes('phone') || model.includes('ip')) return 'Networking';
    if (desc.includes('wireless') || desc.includes('wifi')) return 'Networking';

    // Accessories
    if (desc.includes('cable') || desc.includes('mount')) return 'Accessories';
    if (desc.includes('adapter') || desc.includes('charger')) return 'Accessories';

    return 'General';
  }

  private extractBrand(model: string): string {
    // Extract brand from model string
    // Examples: "YEALINK-T53W" -> "Yealink", "MIKROTIK-RB" -> "MikroTik"

    const modelUpper = model.toUpperCase();

    if (modelUpper.startsWith('YEALINK')) return 'Yealink';
    if (modelUpper.startsWith('MIKROTIK')) return 'MikroTik';
    if (modelUpper.startsWith('TP-LINK') || modelUpper.startsWith('TPLINK')) return 'TP-LINK';
    if (modelUpper.startsWith('UBIQUITI')) return 'Ubiquiti';
    if (modelUpper.startsWith('CISCO')) return 'Cisco';

    // If no match, take first part before dash or space
    const parts = model.split(/[-\s]/);
    return parts[0] || 'Unknown';
  }
}

export default NologyMCPServer;
