"use strict";
/**
 * Scoop MCP Server
 * XML feed integration with regional stock tracking
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
exports.ScoopMCPServer = void 0;
require("dotenv/config");
const axios_1 = __importDefault(require("axios"));
const xml2js = __importStar(require("xml2js"));
const shared_1 = require("@audico/shared");
// ============================================
// SCOOP MCP SERVER
// ============================================
class ScoopMCPServer {
    constructor(supabaseUrl, supabaseKey) {
        this.supplier = null;
        this.config = {
            feedUrl: process.env.SCOOP_FEED_URL || 'https://scoop.co.za/scoop_pricelist.xml',
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
            shared_1.logger.info('🔌 Testing Scoop XML feed connection...');
            const response = await this.client.get(this.config.feedUrl);
            if (response.data && response.data.length > 0) {
                shared_1.logger.info('✅ Scoop XML feed connection successful');
                return true;
            }
            shared_1.logger.error('❌ Scoop XML feed returned no data');
            return false;
        }
        catch (error) {
            shared_1.logger.error(`❌ Scoop XML feed connection failed: ${error.message}`);
            return false;
        }
    }
    async syncProducts(options) {
        var _a;
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
            sessionId = await this.supabase.createSyncSession(this.supplier.id, (options === null || options === void 0 ? void 0 : options.sessionName) || 'manual');
            shared_1.logSync.start('Scoop', sessionId);
            // Fetch XML feed
            shared_1.logger.info('📡 Fetching Scoop XML feed...');
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
            if (parsedXml && parsedXml.products && parsedXml.products.product) {
                products = parsedXml.products.product;
            }
            shared_1.logger.info(`📦 Parsed ${products.length} products from XML feed`);
            const limit = (options === null || options === void 0 ? void 0 : options.limit) || products.length;
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
                        shared_1.logSync.progress('Scoop', i, productsToProcess.length);
                    }
                    // Transform to unified schema
                    const unifiedProduct = this.transformToUnified(rawProduct);
                    if (options === null || options === void 0 ? void 0 : options.dryRun) {
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
                    const sku = ((_a = rawProduct.sku) === null || _a === void 0 ? void 0 : _a[0]) || 'unknown';
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
            shared_1.logSync.complete('Scoop', sessionId, {
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
            shared_1.logger.error(`❌ Scoop sync failed: ${error.message}`);
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
            status: supplier.status,
            error_message: supplier.error_message || undefined,
        };
    }
    async getSupplierInfo() {
        const supplier = await this.supabase.getSupplierByName('Scoop');
        if (!supplier) {
            throw new Error('Scoop supplier not found');
        }
        return supplier;
    }
    // ============================================
    // SCOOP-SPECIFIC METHODS
    // ============================================
    transformToUnified(scoopProduct) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
        // Extract from XML arrays (take first element)
        const sku = ((_a = scoopProduct.sku) === null || _a === void 0 ? void 0 : _a[0]) || '';
        const description = ((_b = scoopProduct.description) === null || _b === void 0 ? void 0 : _b[0]) || '';
        const manufacturer = ((_c = scoopProduct.manufacturer) === null || _c === void 0 ? void 0 : _c[0]) || '';
        const dealerPrice = parseFloat(((_d = scoopProduct.dealer_price) === null || _d === void 0 ? void 0 : _d[0]) || '0');
        const retailPrice = parseFloat(((_e = scoopProduct.retail_price) === null || _e === void 0 ? void 0 : _e[0]) || '0');
        const imageUrl = ((_f = scoopProduct.image_url) === null || _f === void 0 ? void 0 : _f[0]) || '';
        // Regional stock
        const stock_cpt = parseInt(((_g = scoopProduct.cpt) === null || _g === void 0 ? void 0 : _g[0]) || '0');
        const stock_jhb = parseInt(((_h = scoopProduct.jhb) === null || _h === void 0 ? void 0 : _h[0]) || '0');
        const stock_dbn = parseInt(((_j = scoopProduct.dbn) === null || _j === void 0 ? void 0 : _j[0]) || '0');
        const total_stock = parseInt(((_k = scoopProduct.total_stock) === null || _k === void 0 ? void 0 : _k[0]) || '0');
        // Calculate margin from dealer/retail prices
        const marginPercentage = dealerPrice > 0 ? ((retailPrice - dealerPrice) / dealerPrice) * 100 : 0;
        return {
            product_name: description,
            sku: sku,
            model: sku,
            brand: manufacturer || this.extractBrand(description),
            category_name: this.extractCategory(description),
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
            supplier_id: this.supplier.id,
            supplier_sku: sku,
            active: total_stock > 0,
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
exports.ScoopMCPServer = ScoopMCPServer;
exports.default = ScoopMCPServer;
