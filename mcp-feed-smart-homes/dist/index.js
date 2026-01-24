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
        try {
            shared_1.logger.info('🔌 Testing Smart Homes API connection...');
            const url = `${this.config.baseUrl}${this.config.apiEndpoint}?limit=1`;
            const response = await this.client.get(url);
            if (response.data?.products?.length > 0) {
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
            sessionId = await this.supabase.createSyncSession(this.supplier.id, options?.sessionName || 'manual');
            shared_1.logSync.start('Smart Homes', sessionId);
            shared_1.logger.info('📡 Fetching Smart Homes products...');
            const allProducts = await this.fetchAllProducts(options?.limit);
            shared_1.logger.info(`📦 Retrieved ${allProducts.length} products`);
            let productsAdded = 0, productsUpdated = 0;
            const errors = [], warnings = [];
            for (let i = 0; i < allProducts.length; i++) {
                try {
                    if (i % 50 === 0)
                        shared_1.logSync.progress('Smart Homes', i, allProducts.length);
                    const unifiedProduct = this.transformToUnified(allProducts[i]);
                    if (options?.dryRun) {
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
        const allProducts = [];
        let page = 1;
        while (!limit || allProducts.length < limit) {
            try {
                const url = `${this.config.baseUrl}${this.config.apiEndpoint}?limit=${this.config.pageLimit}&page=${page}`;
                const response = await this.client.get(url);
                if (!response.data.products?.length)
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
    transformToUnified(shProduct) {
        const mainVariant = shProduct.variants[0];
        const costExclVat = parseFloat(mainVariant.price) || 0;
        const costInclVat = costExclVat * 1.15;
        const sellingPrice = costInclVat * 1.25; // 15% VAT + 25% margin
        const marginPercentage = ((sellingPrice - costExclVat) / costExclVat) * 100;
        const brand = shProduct.vendor || 'Smart Homes';
        const categoryName = shProduct.product_type || 'Electronics';
        const description = shProduct.body_html?.replace(/<[^>]*>/g, ' ').trim().substring(0, 500);
        // Classify use case for AI consultation filtering
        const useCase = (0, shared_1.classifyUseCase)({
            productName: shProduct.title,
            categoryName: categoryName,
            brand: brand,
            description: description,
        });
        return {
            product_name: shProduct.title,
            sku: mainVariant.sku || `sh-${shProduct.id}`,
            model: shProduct.handle,
            brand: brand,
            category_name: categoryName,
            description: description,
            cost_price: costExclVat,
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
            use_case: useCase,
            exclude_from_consultation: (0, shared_1.shouldExcludeFromConsultation)(useCase),
        };
    }
}
exports.SmartHomesMCPServer = SmartHomesMCPServer;
exports.default = SmartHomesMCPServer;
//# sourceMappingURL=index.js.map