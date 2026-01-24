/**
 * Scoop MCP Server
 * XML feed integration with regional stock tracking
 */

import 'dotenv/config';
import axios, { AxiosInstance } from 'axios';
import * as xml2js from 'xml2js';
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
  classifyUseCase,
  shouldExcludeFromConsultation,
} from '@audico/shared';

// ============================================
// SCOOP XML TYPES
// ============================================

interface ScoopProduct {
  SKU: string[];
  Description: string[];
  Manufacturer: string[];
  DealerPrice: string[];
  RetailPrice: string[];
  TotalStock: string[];
  CPT?: string[];
  JHB?: string[];
  DBN?: string[];
  ImageURL: string[];
}

// ============================================
// SCOOP MCP SERVER
// ============================================

export class ScoopMCPServer implements MCPSupplierTool {
  private supabase: SupabaseService;
  private supplier: Supplier | null = null;
  private client: AxiosInstance;

  private config = {
    feedUrl: process.env.SCOOP_FEED_URL || 'https://scoop.co.za/scoop_pricelist.xml',
  };

  constructor(supabaseUrl?: string, supabaseKey?: string) {
    this.supabase = new SupabaseService(supabaseUrl, supabaseKey);

    this.client = axios.create({
      timeout: 60000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'application/xml',
      },
    });
  }

  // ============================================
  // MCP INTERFACE IMPLEMENTATION
  // ============================================

  async testConnection(): Promise<boolean> {
    try {
      logger.info('🔌 Testing Scoop XML feed connection...');

      const response = await this.client.get(this.config.feedUrl);

      if (response.data && response.data.length > 0) {
        logger.info('✅ Scoop XML feed connection successful');
        return true;
      }

      logger.error('❌ Scoop XML feed returned no data');
      return false;
    } catch (error: any) {
      logger.error(`❌ Scoop XML feed connection failed: ${error.message}`);
      return false;
    }
  }

  async syncProducts(options?: SyncOptions): Promise<SyncResult> {
    const startTime = Date.now();
    let sessionId = '';

    try {
      // Get supplier record
      this.supplier = await this.supabase.getSupplierByName('Scoop');
      if (!this.supplier) {
        throw new Error('Scoop supplier not found in database');
      }

      // Update supplier status
      await this.supabase.updateSupplierStatus(this.supplier.id, 'running');

      // Create sync session
      sessionId = await this.supabase.createSyncSession(
        this.supplier.id,
        options?.sessionName || 'manual'
      );

      logSync.start('Scoop', sessionId);

      // Fetch XML feed
      logger.info('📡 Fetching Scoop XML feed...');
      const response = await this.client.get(this.config.feedUrl);
      const xmlData = response.data;

      logger.info('📊 Parsing XML data...');

      // Parse XML
      const parser = new xml2js.Parser({
        explicitArray: true,
        ignoreAttrs: false,
        trim: true,
      });

      const parsedXml = await parser.parseStringPromise(xmlData);

      // Extract products
      let products: ScoopProduct[] = [];
      if (parsedXml && parsedXml.root && parsedXml.root.entry) {
        products = parsedXml.root.entry;
      }

      logger.info(`📦 Parsed ${products.length} products from XML feed`);

      const limit = options?.limit || products.length;
      const productsToProcess = products.slice(0, limit);

      let productsAdded = 0;
      let productsUpdated = 0;
      let productsUnchanged = 0;
      const errors: string[] = [];
      const warnings: string[] = [];

      // Process each product
      for (let i = 0; i < productsToProcess.length; i++) {
        const rawProduct = productsToProcess[i];

        try {
          if (i % 50 === 0) {
            logSync.progress('Scoop', i, productsToProcess.length);
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
          const sku = rawProduct.SKU?.[0] || 'unknown';
          const errorMsg = `Failed to process ${sku}: ${error.message}`;
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

      logSync.complete('Scoop', sessionId, {
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
      logger.error(`❌ Scoop sync failed: ${error.message}`);

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
    const supplier = await this.supabase.getSupplierByName('Scoop');

    if (!supplier) {
      return {
        supplier_name: 'Scoop',
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
    const supplier = await this.supabase.getSupplierByName('Scoop');

    if (!supplier) {
      throw new Error('Scoop supplier not found');
    }

    return supplier;
  }

  // ============================================
  // SCOOP-SPECIFIC METHODS
  // ============================================

  private transformToUnified(scoopProduct: ScoopProduct): UnifiedProduct {
    // Extract from XML arrays (take first element)
    const sku = scoopProduct.SKU?.[0] || '';
    const description = scoopProduct.Description?.[0] || '';
    const manufacturer = scoopProduct.Manufacturer?.[0] || '';
    const dealerPrice = parseFloat(scoopProduct.DealerPrice?.[0] || '0');
    const retailPrice = parseFloat(scoopProduct.RetailPrice?.[0] || '0');
    const imageUrl = scoopProduct.ImageURL?.[0] || '';

    // Regional stock
    const stock_cpt = parseInt(scoopProduct.CPT?.[0] || '0');
    const stock_jhb = parseInt(scoopProduct.JHB?.[0] || '0');
    const stock_dbn = parseInt(scoopProduct.DBN?.[0] || '0');
    const total_stock = stock_cpt + stock_jhb + stock_dbn;

    // Calculate margin from dealer/retail prices
    const marginPercentage =
      dealerPrice > 0 ? ((retailPrice - dealerPrice) / dealerPrice) * 100 : 0;

    const brand = manufacturer || this.extractBrand(description);
    const categoryName = this.extractCategory(description);

    // Classify use case for AI consultation filtering
    const useCase = classifyUseCase({
      productName: description,
      categoryName: categoryName,
      brand: brand,
      description: description,
    });

    return {
      product_name: description,
      sku: sku,
      model: sku,
      brand: brand,
      category_name: categoryName,
      description: description,

      cost_price: dealerPrice,
      retail_price: retailPrice,
      selling_price: retailPrice,
      margin_percentage: parseFloat(marginPercentage.toFixed(2)),

      total_stock,
      stock_jhb,
      stock_cpt,
      stock_dbn,

      images: imageUrl ? [imageUrl] : [],
      specifications: {
        sku: sku,
        manufacturer: manufacturer,
      },

      supplier_id: this.supplier!.id,
      supplier_sku: sku,

      active: total_stock > 0,
      use_case: useCase,
      exclude_from_consultation: shouldExcludeFromConsultation(useCase),
    };
  }

  private extractBrand(description: string): string {
    const descUpper = description.toUpperCase();

    const brands = [
      'SAMSUNG',
      'LG',
      'SONY',
      'HISENSE',
      'PANASONIC',
      'PHILIPS',
      'JBL',
      'BOSE',
      'YAMAHA',
      'DENON',
      'LOGITECH',
      'ASUS',
      'DELL',
      'HP',
    ];

    for (const brand of brands) {
      if (descUpper.includes(brand)) {
        return brand.charAt(0) + brand.slice(1).toLowerCase();
      }
    }

    return description.split(' ')[0] || 'Unknown';
  }

  private extractCategory(description: string): string {
    const desc = description.toLowerCase();

    if (desc.includes('tv') || desc.includes('television')) return 'Video';
    if (desc.includes('soundbar') || desc.includes('speaker')) return 'Audio';
    if (desc.includes('receiver') || desc.includes('amplifier')) return 'Audio';
    if (desc.includes('laptop') || desc.includes('computer')) return 'Computing';
    if (desc.includes('tablet') || desc.includes('ipad')) return 'Computing';
    if (desc.includes('phone')) return 'Mobile';
    if (desc.includes('camera')) return 'Video';
    if (desc.includes('cable') || desc.includes('adapter')) return 'Accessories';

    return 'General';
  }
}

export default ScoopMCPServer;
