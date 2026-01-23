"use strict";
/**
 * Smart Homes MCP Server
 * Shopify JSON feed integration (similar to Solution Technologies)
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SmartHomesMCPServer = void 0;
require("dotenv/config");
const axios_1 = __importDefault(require("axios"));
const shared_1 = require("@audico/shared");
class SmartHomesMCPServer {
    constructor(supabaseUrl, supabaseKey) {
        this.supplier = null;
        this.config = {
            baseUrl: process.env.SMART_HOMES_BASE_URL || 'https://smart-homes.co.za',
            apiEndpoint: process.env.SMART_HOMES_API_ENDPOINT || '/collections/all/products.json',
            pageLimit: 250,
        };
        this.supabase = new shared_1.SupabaseService(supabaseUrl, supabaseKey);
        this.client = axios_1.default.create({
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                Accept: 'application/json',
            },
        });
    }
    async testConnection() {
        var _a, _b;
        try {
            shared_1.logger.info('🔌 Testing Smart Homes API connection...');
            const url = `${this.config.baseUrl}${this.config.apiEndpoint}?limit=1`;
            const response = await this.client.get(url);
            if (((_b = (_a = response.data) === null || _a === void 0 ? void 0 : _a.products) === null || _b === void 0 ? void 0 : _b.length) > 0) {
                shared_1.logger.info('✅ Smart Homes API connection successful');
                return true;
            }
            return false;
        }
        catch (error) {
            shared_1.logger.error(`❌ Smart Homes API connection failed: ${error.message}`);
            return false;
        }
    }
    async syncProducts(options) {
        const startTime = Date.now();
        let sessionId = '';
        try {
            this.supplier = await this.supabase.getSupplierByName('Smart Homes');
            if (!this.supplier)
                throw new Error('Smart Homes supplier not found');
            await this.supabase.updateSupplierStatus(this.supplier.id, 'running');
            sessionId = await this.supabase.createSyncSession(this.supplier.id, (options === null || options === void 0 ? void 0 : options.sessionName) || 'manual');
            shared_1.logSync.start('Smart Homes', sessionId);
            shared_1.logger.info('📡 Fetching Smart Homes products...');
            const allProducts = await this.fetchAllProducts(options === null || options === void 0 ? void 0 : options.limit);
            shared_1.logger.info(`📦 Retrieved ${allProducts.length} products`);
            let productsAdded = 0, productsUpdated = 0;
            const errors = [], warnings = [];
            for (let i = 0; i < allProducts.length; i++) {
                try {
                    if (i % 50 === 0)
                        shared_1.logSync.progress('Smart Homes', i, allProducts.length);
                    const unifiedProduct = this.transformToUnified(allProducts[i]);
                    if (options === null || options === void 0 ? void 0 : options.dryRun) {
                        shared_1.logger.info(`[DRY RUN] Would upsert: ${unifiedProduct.product_name}`);
                        continue;
                    }
                    const result = await this.supabase.upsertProduct(unifiedProduct);
                    result.isNew ? productsAdded++ : productsUpdated++;
                }
                catch (error) {
                    errors.push(`Failed to process ${allProducts[i].id}: ${error.message}`);
                }
            }
            const durationSeconds = Math.floor((Date.now() - startTime) / 1000);
            await this.supabase.completeSyncSession(sessionId, { products_added: productsAdded, products_updated: productsUpdated, products_unchanged: 0, errors, warnings });
            await this.supabase.updateSupplierStatus(this.supplier.id, 'idle');
            await this.supabase.updateSupplierLastSync(this.supplier.id);
            shared_1.logSync.complete('Smart Homes', sessionId, { added: productsAdded, updated: productsUpdated, duration: durationSeconds });
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
        }
        catch (error) {
            shared_1.logger.error(`❌ Smart Homes sync failed: ${error.message}`);
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
    async getStatus() {
        const supplier = await this.supabase.getSupplierByName('Smart Homes');
        if (!supplier) {
            return { supplier_name: 'Smart Homes', total_products: 0, status: 'error', error_message: 'Supplier not found' };
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
        const supplier = await this.supabase.getSupplierByName('Smart Homes');
        if (!supplier)
            throw new Error('Smart Homes supplier not found');
        return supplier;
    }
    async fetchAllProducts(limit) {
        var _a;
        const allProducts = [];
        let page = 1;
        while (!limit || allProducts.length < limit) {
            try {
                const url = `${this.config.baseUrl}${this.config.apiEndpoint}?limit=${this.config.pageLimit}&page=${page}`;
                const response = await this.client.get(url);
                if (!((_a = response.data.products) === null || _a === void 0 ? void 0 : _a.length))
                    break;
                allProducts.push(...response.data.products);
                if (response.data.products.length < this.config.pageLimit)
                    break;
                page++;
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
            catch (error) {
                break;
            }
        }
        return limit ? allProducts.slice(0, limit) : allProducts;
    }
    /**
     * Round to nearest R10. E.g., R95 -> R100, R94 -> R90
     */
    roundToNearest10(value) {
        return Math.round(value / 10) * 10;
    }
    transformToUnified(shProduct) {
        var _a;
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
            description: (_a = shProduct.body_html) === null || _a === void 0 ? void 0 : _a.replace(/<[^>]*>/g, ' ').trim().substring(0, 500),
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
            supplier_id: this.supplier.id,
            supplier_sku: mainVariant.sku || `sh-${shProduct.id}`,
            active: mainVariant.available,
        };
    }
}
exports.SmartHomesMCPServer = SmartHomesMCPServer;
exports.default = SmartHomesMCPServer;
