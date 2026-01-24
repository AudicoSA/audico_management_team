"use strict";
/**
 * Nology MCP Server
 * Extracts the gold from linkqage-ecommerce/lib/nology-service.ts
 * and transforms it to use the unified schema
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NologyMCPServer = void 0;
const axios_1 = __importDefault(require("axios"));
const shared_1 = require("@audico/shared");
// ============================================
// NOLOGY MCP SERVER
// ============================================
class NologyMCPServer {
    constructor(supabaseUrl, supabaseKey) {
        this.supplier = null;
        this.config = {
            baseUrl: process.env.NOLOGY_API_BASE_URL || 'https://erp.nology.co.za/NologyDataFeed/api',
            username: process.env.NOLOGY_API_USERNAME || 'AUV001',
            secret: process.env.NOLOGY_API_SECRET || 'e2bzCs64bM',
            timeout: 30000,
        };
        this.supabase = new shared_1.SupabaseService(supabaseUrl, supabaseKey);
    }
    // ============================================
    // MCP INTERFACE IMPLEMENTATION
    // ============================================
    async testConnection() {
        try {
            shared_1.logger.info('🔌 Testing Nology API connection...');
            const response = await axios_1.default.get(`${this.config.baseUrl}/Products/View`, {
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
                shared_1.logger.info(`✅ Nology API connection successful (${response.data.length} products available)`);
                return true;
            }
            shared_1.logger.error('❌ Nology API returned invalid format');
            return false;
        }
        catch (error) {
            shared_1.logger.error(`❌ Nology API connection failed: ${error.message}`);
            return false;
        }
    }
    async syncProducts(options) {
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
            sessionId = await this.supabase.createSyncSession(this.supplier.id, options?.sessionName || 'manual');
            shared_1.logSync.start('Nology', sessionId);
            // Fetch products from Nology API
            shared_1.logger.info('📥 Fetching products from Nology API...');
            const rawProducts = await this.fetchProducts();
            if (options?.limit) {
                rawProducts.splice(options.limit);
            }
            shared_1.logger.info(`📦 Processing ${rawProducts.length} products...`);
            let productsAdded = 0;
            let productsUpdated = 0;
            let productsUnchanged = 0;
            const errors = [];
            const warnings = [];
            // Process each product
            for (let i = 0; i < rawProducts.length; i++) {
                const rawProduct = rawProducts[i];
                try {
                    if (i % 50 === 0) {
                        shared_1.logSync.progress('Nology', i, rawProducts.length);
                    }
                    // Transform to unified schema
                    const unifiedProduct = this.transformToUnified(rawProduct);
                    if (options?.dryRun) {
                        shared_1.logger.info(`[DRY RUN] Would upsert: ${unifiedProduct.product_name}`);
                        continue;
                    }
                    // Upsert product
                    const result = await this.supabase.upsertProduct(unifiedProduct);
                    if (result.isNew) {
                        productsAdded++;
                    }
                    else {
                        productsUpdated++;
                    }
                }
                catch (error) {
                    const errorMsg = `Failed to process ${rawProduct.Model}: ${error.message}`;
                    errors.push(errorMsg);
                    shared_1.logger.error(errorMsg);
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
            shared_1.logSync.complete('Nology', sessionId, {
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
        }
        catch (error) {
            shared_1.logger.error(`❌ Nology sync failed: ${error.message}`);
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
    async getStatus() {
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
            status: supplier.status,
            error_message: supplier.error_message || undefined,
        };
    }
    async getSupplierInfo() {
        const supplier = await this.supabase.getSupplierByName('Nology');
        if (!supplier) {
            throw new Error('Nology supplier not found');
        }
        return supplier;
    }
    // ============================================
    // NOLOGY-SPECIFIC METHODS
    // ============================================
    async fetchProducts() {
        try {
            const response = await axios_1.default.get(`${this.config.baseUrl}/Products/View`, {
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
                shared_1.logger.info(`✅ Fetched ${response.data.length} products from Nology API`);
                return response.data;
            }
            else {
                throw new Error('Invalid response format from Nology API');
            }
        }
        catch (error) {
            throw new Error(`Failed to fetch from Nology API: ${error.message}`);
        }
    }
    transformToUnified(nologyProduct) {
        // Extract stock info
        const stockInfo = nologyProduct.TotalQtyAvailable?.[0] || {};
        const stock_cpt = stockInfo.CPT || 0;
        const stock_jhb = stockInfo.JHB || 0;
        const total_stock = stock_cpt + stock_jhb;
        // Calculate pricing using Nology formula (15% VAT + 15% margin)
        const pricing = shared_1.PricingCalculator.nologyPricing(nologyProduct.Price || 0);
        // Extract images
        const images = [];
        if (nologyProduct.AdditionalImages && nologyProduct.AdditionalImages.length > 0) {
            images.push(...nologyProduct.AdditionalImages.map(img => img.Image));
        }
        // Extract category from description or model
        const category_name = this.extractCategory(nologyProduct);
        // Build specifications
        const specifications = {
            global_sku: nologyProduct.GlobalSKU,
            barcode: nologyProduct.Barcode,
            all_images: nologyProduct.AllImages,
        };
        if (nologyProduct.RelatedItems && nologyProduct.RelatedItems.length > 0) {
            specifications.related_items = nologyProduct.RelatedItems;
        }
        // Auto-tag for consultation mode (Build #10)
        const autoTags = shared_1.ProductAutoTagger.autoTag({
            product_name: nologyProduct.ShortDescription || nologyProduct.Model,
            description: nologyProduct.LongDescription,
            category_name,
        });
        // Classify use case for AI consultation filtering
        const brand = nologyProduct.Brand || this.extractBrand(nologyProduct.Model);
        const useCase = (0, shared_1.classifyUseCase)({
            productName: nologyProduct.ShortDescription || nologyProduct.Model,
            categoryName: category_name,
            brand: brand,
            description: nologyProduct.LongDescription,
        });
        return {
            product_name: nologyProduct.ShortDescription || nologyProduct.Model,
            sku: nologyProduct.GlobalSKU,
            model: nologyProduct.Model,
            brand: brand,
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
            supplier_id: this.supplier.id,
            supplier_sku: nologyProduct.GlobalSKU,
            active: true,
            // Build #10: Consultation mode auto-tagging
            scenario_tags: autoTags.scenario_tags,
            mounting_type: autoTags.mounting_type,
            exclude_from_consultation: (0, shared_1.shouldExcludeFromConsultation)(useCase) || autoTags.exclude_from_consultation,
            use_case: useCase,
        };
    }
    extractCategory(product) {
        const desc = product.ShortDescription?.toLowerCase() || '';
        const model = product.Model?.toLowerCase() || '';
        // Audio categories
        if (desc.includes('speaker') || desc.includes('audio'))
            return 'Audio';
        if (desc.includes('microphone') || desc.includes('mic'))
            return 'Audio';
        if (desc.includes('amplifier') || desc.includes('amp'))
            return 'Audio';
        // Video categories
        if (desc.includes('camera') || desc.includes('video'))
            return 'Video';
        if (desc.includes('display') || desc.includes('monitor'))
            return 'Video';
        // Networking
        if (desc.includes('router') || desc.includes('switch'))
            return 'Networking';
        if (desc.includes('phone') || model.includes('ip'))
            return 'Networking';
        if (desc.includes('wireless') || desc.includes('wifi'))
            return 'Networking';
        // Accessories
        if (desc.includes('cable') || desc.includes('mount'))
            return 'Accessories';
        if (desc.includes('adapter') || desc.includes('charger'))
            return 'Accessories';
        return 'General';
    }
    extractBrand(model) {
        // Extract brand from model string
        // Examples: "YEALINK-T53W" -> "Yealink", "MIKROTIK-RB" -> "MikroTik"
        const modelUpper = model.toUpperCase();
        if (modelUpper.startsWith('YEALINK'))
            return 'Yealink';
        if (modelUpper.startsWith('MIKROTIK'))
            return 'MikroTik';
        if (modelUpper.startsWith('TP-LINK') || modelUpper.startsWith('TPLINK'))
            return 'TP-LINK';
        if (modelUpper.startsWith('UBIQUITI'))
            return 'Ubiquiti';
        if (modelUpper.startsWith('CISCO'))
            return 'Cisco';
        // If no match, take first part before dash or space
        const parts = model.split(/[-\s]/);
        return parts[0] || 'Unknown';
    }
}
exports.NologyMCPServer = NologyMCPServer;
exports.default = NologyMCPServer;
//# sourceMappingURL=index.js.map