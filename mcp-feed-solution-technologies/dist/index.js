"use strict";
/**
 * Solution Technologies MCP Server
 * Shopify JSON feed integration with continuous pagination
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SolutionTechnologiesMCPServer = void 0;
require("dotenv/config");
const axios_1 = __importDefault(require("axios"));
const shared_1 = require("@audico/shared");
// ============================================
// SOLUTION TECHNOLOGIES MCP SERVER
// ============================================
class SolutionTechnologiesMCPServer {
    constructor(supabaseUrl, supabaseKey) {
        this.supplier = null;
        this.config = {
            baseUrl: process.env.SOLUTION_TECHNOLOGIES_BASE_URL || 'https://solutiontechnologies.co.za',
            apiEndpoint: process.env.SOLUTION_TECHNOLOGIES_API_ENDPOINT || '/collections/all/products.json',
            pageLimit: parseInt(process.env.SOLUTION_TECHNOLOGIES_PAGE_LIMIT || '250'),
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
    // ============================================
    // MCP INTERFACE IMPLEMENTATION
    // ============================================
    async testConnection() {
        try {
            shared_1.logger.info('🔌 Testing Solution Technologies API connection...');
            const url = `${this.config.baseUrl}${this.config.apiEndpoint}?limit=1`;
            const response = await this.client.get(url);
            if (response.data && response.data.products && response.data.products.length > 0) {
                shared_1.logger.info(`✅ Solution Technologies API connection successful - products available`);
                return true;
            }
            shared_1.logger.error('❌ Solution Technologies API returned invalid data');
            return false;
        }
        catch (error) {
            shared_1.logger.error(`❌ Solution Technologies API connection failed: ${error.message}`);
            return false;
        }
    }
    async syncProducts(options) {
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
            sessionId = await this.supabase.createSyncSession(this.supplier.id, options?.sessionName || 'manual');
            shared_1.logSync.start('Solution Technologies', sessionId);
            // Fetch all products with pagination
            shared_1.logger.info('📡 Fetching Solution Technologies products with pagination...');
            const allProducts = await this.fetchAllProducts(options?.limit);
            shared_1.logger.info(`📦 Retrieved ${allProducts.length} products from Solution Technologies`);
            let productsAdded = 0;
            let productsUpdated = 0;
            let productsUnchanged = 0;
            const errors = [];
            const warnings = [];
            // Process each product
            for (let i = 0; i < allProducts.length; i++) {
                const rawProduct = allProducts[i];
                try {
                    if (i % 50 === 0) {
                        shared_1.logSync.progress('Solution Technologies', i, allProducts.length);
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
                    const errorMsg = `Failed to process ${rawProduct.id}: ${error.message}`;
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
            shared_1.logSync.complete('Solution Technologies', sessionId, {
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
            shared_1.logger.error(`❌ Solution Technologies sync failed: ${error.message}`);
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
            status: supplier.status,
            error_message: supplier.error_message || undefined,
        };
    }
    async getSupplierInfo() {
        const supplier = await this.supabase.getSupplierByName('Solution Technologies');
        if (!supplier) {
            throw new Error('Solution Technologies supplier not found');
        }
        return supplier;
    }
    // ============================================
    // SOLUTION TECHNOLOGIES-SPECIFIC METHODS
    // ============================================
    async fetchAllProducts(limit) {
        const allProducts = [];
        let page = 1;
        let hasMoreProducts = true;
        let lastProductId = null;
        shared_1.logger.info('🔄 Starting continuous pagination...');
        while (hasMoreProducts && (!limit || allProducts.length < limit)) {
            try {
                shared_1.logger.info(`📄 Fetching page ${page}...`);
                const products = await this.fetchProductPage(page, lastProductId);
                if (products.length === 0) {
                    shared_1.logger.info(`📄 Page ${page} returned 0 products - pagination complete`);
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
                shared_1.logger.info(`📦 Page ${page}: Found ${products.length} products, ${newProductsCount} new, ${allProducts.length} total`);
                if (newProductsCount === 0) {
                    shared_1.logger.info(`🛑 No new products found on page ${page} - stopping`);
                    hasMoreProducts = false;
                }
                else if (products.length < this.config.pageLimit) {
                    shared_1.logger.info(`🏁 Page ${page} returned fewer than ${this.config.pageLimit} products - likely final page`);
                    hasMoreProducts = false;
                }
                page++;
                // Safety limit
                if (page > 100) {
                    shared_1.logger.info('⚠️ Safety limit reached (100 pages) - stopping');
                    hasMoreProducts = false;
                }
                // Polite delay between requests
                if (hasMoreProducts) {
                    await this.delay(2000);
                }
            }
            catch (error) {
                shared_1.logger.error(`❌ Error fetching page ${page}: ${error.message}`);
                hasMoreProducts = false;
            }
        }
        shared_1.logger.info(`✅ Pagination complete: ${allProducts.length} total products`);
        // Apply limit if specified
        if (limit && allProducts.length > limit) {
            return allProducts.slice(0, limit);
        }
        return allProducts;
    }
    async fetchProductPage(page, lastProductId) {
        // Strategy 1: Page-based pagination
        try {
            const url = `${this.config.baseUrl}${this.config.apiEndpoint}?limit=${this.config.pageLimit}&page=${page}`;
            const response = await this.client.get(url);
            if (response.data && response.data.products && response.data.products.length > 0) {
                return response.data.products;
            }
        }
        catch (error) {
            shared_1.logger.info(`📄 Page-based pagination failed for page ${page}`);
        }
        // Strategy 2: Cursor-based pagination (since_id)
        if (lastProductId && page > 1) {
            try {
                const url = `${this.config.baseUrl}${this.config.apiEndpoint}?limit=${this.config.pageLimit}&since_id=${lastProductId}`;
                const response = await this.client.get(url);
                if (response.data && response.data.products && response.data.products.length > 0) {
                    return response.data.products;
                }
            }
            catch (error) {
                shared_1.logger.info(`📄 Cursor-based pagination failed for since_id ${lastProductId}`);
            }
        }
        return [];
    }
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    transformToUnified(stProduct) {
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
        const brand = stProduct.vendor || 'Solution Technologies';
        // Classify use case for AI consultation filtering
        const useCase = (0, shared_1.classifyUseCase)({
            productName: stProduct.title,
            categoryName: category_name,
            brand: brand,
            description: description,
        });
        return {
            product_name: stProduct.title,
            sku: mainVariant.sku || `st-${stProduct.id}`,
            model: stProduct.handle,
            brand: brand,
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
            supplier_id: this.supplier.id,
            supplier_sku: mainVariant.sku || `st-${stProduct.id}`,
            active: mainVariant.available,
            use_case: useCase,
            exclude_from_consultation: (0, shared_1.shouldExcludeFromConsultation)(useCase),
        };
    }
    parseHtmlDescription(html) {
        if (!html)
            return 'Professional technology product from Solution Technologies.';
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
    mapProductType(productType) {
        const typeMap = {
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
exports.SolutionTechnologiesMCPServer = SolutionTechnologiesMCPServer;
exports.default = SolutionTechnologiesMCPServer;
//# sourceMappingURL=index.js.map