"use strict";
/**
 * Esquire MCP Server
 * Shopify XML feed integration
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EsquireMCPServer = void 0;
require("dotenv/config");
const axios_1 = __importDefault(require("axios"));
const xml2js = __importStar(require("xml2js"));
const shared_1 = require("@audico/shared");
// ============================================
// ESQUIRE MCP SERVER
// ============================================
class EsquireMCPServer {
    constructor(supabaseUrl, supabaseKey) {
        this.supplier = null;
        this.config = {
            feedUrl: process.env.ESQUIRE_FEED_URL || 'https://api.esquire.co.za/api/Export?key=13&Org=esquire&ID=182599&m=0&o=ascending&rm=RoundNone&r=0&min=0',
        };
        this.supabase = new shared_1.SupabaseService(supabaseUrl, supabaseKey);
        this.client = axios_1.default.create({
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
    async testConnection() {
        try {
            shared_1.logger.info('🔌 Testing Esquire XML feed connection...');
            const response = await this.client.get(this.config.feedUrl);
            const parser = new xml2js.Parser({
                explicitArray: true,
                ignoreAttrs: false,
                trim: true,
            });
            const parsedXml = await parser.parseStringPromise(response.data);
            if (parsedXml && parsedXml.ROOT && parsedXml.ROOT.Products && parsedXml.ROOT.Products[0].Product) {
                const productCount = parsedXml.ROOT.Products[0].Product.length;
                shared_1.logger.info(`✅ Esquire XML feed connection successful - ${productCount} products available`);
                return true;
            }
            shared_1.logger.error('❌ Esquire XML feed returned invalid structure');
            return false;
        }
        catch (error) {
            shared_1.logger.error(`❌ Esquire XML feed connection failed: ${error.message}`);
            return false;
        }
    }
    async syncProducts(options) {
        const startTime = Date.now();
        let sessionId = '';
        try {
            // Get supplier record
            this.supplier = await this.supabase.getSupplierByName('Esquire');
            if (!this.supplier) {
                throw new Error('Esquire supplier not found in database');
            }
            // Update supplier status
            await this.supabase.updateSupplierStatus(this.supplier.id, 'running');
            // Create sync session
            sessionId = await this.supabase.createSyncSession(this.supplier.id, options?.sessionName || 'manual');
            shared_1.logSync.start('Esquire', sessionId);
            // Fetch XML feed
            shared_1.logger.info('📡 Fetching Esquire XML feed...');
            const response = await this.client.get(this.config.feedUrl);
            const xmlData = response.data;
            shared_1.logger.info('📊 Parsing XML data...');
            // Parse XML
            const parser = new xml2js.Parser({
                explicitArray: true,
                ignoreAttrs: false,
                trim: true,
            });
            const parsedXml = await parser.parseStringPromise(xmlData);
            // Extract products
            let products = [];
            if (parsedXml && parsedXml.ROOT && parsedXml.ROOT.Products && parsedXml.ROOT.Products[0].Product) {
                products = parsedXml.ROOT.Products[0].Product;
            }
            shared_1.logger.info(`📦 Parsed ${products.length} products from XML feed`);
            const limit = options?.limit || products.length;
            const productsToProcess = products.slice(0, limit);
            let productsAdded = 0;
            let productsUpdated = 0;
            let productsUnchanged = 0;
            const errors = [];
            const warnings = [];
            // Process each product
            for (let i = 0; i < productsToProcess.length; i++) {
                const rawProduct = productsToProcess[i];
                try {
                    if (i % 50 === 0) {
                        shared_1.logSync.progress('Esquire', i, productsToProcess.length);
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
                    const sku = rawProduct.VariantSKU?.[0] || 'unknown';
                    const errorMsg = `Failed to process ${sku}: ${error.message}`;
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
            shared_1.logSync.complete('Esquire', sessionId, {
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
            shared_1.logger.error(`❌ Esquire sync failed: ${error.message}`);
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
        const supplier = await this.supabase.getSupplierByName('Esquire');
        if (!supplier) {
            return {
                supplier_name: 'Esquire',
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
        const supplier = await this.supabase.getSupplierByName('Esquire');
        if (!supplier) {
            throw new Error('Esquire supplier not found');
        }
        return supplier;
    }
    // ============================================
    // ESQUIRE-SPECIFIC METHODS
    // ============================================
    transformToUnified(esquireProduct) {
        // Extract from XML arrays (take first element)
        const sku = esquireProduct.VariantSKU?.[0] || '';
        const productName = esquireProduct.Title?.[0] || '';
        const costPrice = parseFloat(esquireProduct.VariantPrice?.[0] || '0');
        const stock = parseInt(esquireProduct.VariantInventoryQty?.[0] || '0');
        const imageUrl = esquireProduct.ImageSrc?.[0] || '';
        const description = esquireProduct.BodyHTML?.[0] || '';
        const category = esquireProduct.ProductCategory?.[0] || esquireProduct.Handle?.[0] || '';
        const vendor = esquireProduct.Vendor?.[0] || 'Esquire';
        // Esquire pricing: 15% VAT + 20% margin = 38% markup
        const sellingPrice = costPrice * 1.38;
        const marginPercentage = 38;
        const brand = vendor || this.extractBrand(productName);
        const categoryName = category || this.extractCategory(productName);
        // Classify use case for AI consultation filtering
        const useCase = (0, shared_1.classifyUseCase)({
            productName: productName,
            categoryName: categoryName,
            brand: brand,
            description: description,
        });
        return {
            product_name: productName,
            sku: sku,
            model: sku,
            brand: brand,
            category_name: categoryName,
            description: description,
            cost_price: costPrice,
            retail_price: sellingPrice,
            selling_price: sellingPrice,
            margin_percentage: marginPercentage,
            total_stock: stock,
            stock_jhb: 0,
            stock_cpt: 0,
            stock_dbn: 0,
            images: imageUrl ? [imageUrl] : [],
            specifications: {
                sku: sku,
                vendor: vendor,
                tags: esquireProduct.Tags?.[0] || '',
            },
            supplier_id: this.supplier.id,
            supplier_sku: sku,
            active: stock > 0,
            use_case: useCase,
            exclude_from_consultation: (0, shared_1.shouldExcludeFromConsultation)(useCase),
        };
    }
    extractBrand(description) {
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
    extractCategory(description) {
        const desc = description.toLowerCase();
        if (desc.includes('tv') || desc.includes('television'))
            return 'Video';
        if (desc.includes('soundbar') || desc.includes('speaker'))
            return 'Audio';
        if (desc.includes('receiver') || desc.includes('amplifier'))
            return 'Audio';
        if (desc.includes('laptop') || desc.includes('computer'))
            return 'Computing';
        if (desc.includes('tablet') || desc.includes('ipad'))
            return 'Computing';
        if (desc.includes('phone'))
            return 'Mobile';
        if (desc.includes('camera'))
            return 'Video';
        if (desc.includes('cable') || desc.includes('adapter'))
            return 'Accessories';
        return 'General';
    }
}
exports.EsquireMCPServer = EsquireMCPServer;
exports.default = EsquireMCPServer;
//# sourceMappingURL=index.js.map