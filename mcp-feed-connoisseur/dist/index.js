"use strict";
/**
 * Connoisseur MCP Server
 * Shopify JSON feed integration with continuous pagination
 * Pricing: Retail price from Shopify, Cost = Retail * 0.8 (less 20%)
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConnoisseurMCPServer = void 0;
require("dotenv/config");
const axios_1 = __importDefault(require("axios"));
const shared_1 = require("@audico/shared");
// ============================================
// CONNOISSEUR MCP SERVER
// ============================================
class ConnoisseurMCPServer {
    constructor(supabaseUrl, supabaseKey) {
        this.supplier = null;
        this.config = {
            baseUrl: process.env.CONNOISSEUR_BASE_URL || 'https://www.connoisseur.co.za',
            collections: ['all', 'shop-all-jbl', 'shop-philips'], // Fetch from all collections
            pageLimit: parseInt(process.env.CONNOISSEUR_PAGE_LIMIT || '250'),
        };
        this.supabase = new shared_1.SupabaseService(supabaseUrl, supabaseKey);
        this.client = axios_1.default.create({
            timeout: 30000,
            headers: {
                'User-Agent': 'AudicoResearchBot/1.0 (+contact: hello@audico.co.za)',
                Accept: 'application/json',
            },
        });
    }
    // ============================================
    // MCP INTERFACE IMPLEMENTATION
    // ============================================
    async testConnection() {
        try {
            shared_1.logger.info('🔌 Testing Connoisseur API connection...');
            // Test first collection
            const url = `${this.config.baseUrl}/collections/${this.config.collections[0]}/products.json?limit=1`;
            const response = await this.client.get(url);
            if (response.data && response.data.products && response.data.products.length > 0) {
                shared_1.logger.info(`✅ Connoisseur API connection successful - products available`);
                return true;
            }
            shared_1.logger.error('❌ Connoisseur API returned invalid data');
            return false;
        }
        catch (error) {
            shared_1.logger.error(`❌ Connoisseur API connection failed: ${error.message}`);
            return false;
        }
    }
    async syncProducts(options) {
        const startTime = Date.now();
        let sessionId = '';
        try {
            // Get supplier record
            this.supplier = await this.supabase.getSupplierByName('Connoisseur');
            if (!this.supplier) {
                throw new Error('Connoisseur supplier not found in database');
            }
            // Update supplier status
            await this.supabase.updateSupplierStatus(this.supplier.id, 'running');
            // Create sync session
            sessionId = await this.supabase.createSyncSession(this.supplier.id, options?.sessionName || 'manual');
            shared_1.logSync.start('Connoisseur', sessionId);
            // Fetch all products with pagination
            shared_1.logger.info('📡 Fetching Connoisseur products with pagination...');
            const allProducts = await this.fetchAllProducts(options?.limit);
            shared_1.logger.info(`📦 Retrieved ${allProducts.length} products from Connoisseur`);
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
                        shared_1.logSync.progress('Connoisseur', i, allProducts.length);
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
            shared_1.logSync.complete('Connoisseur', sessionId, {
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
            shared_1.logger.error(`❌ Connoisseur sync failed: ${error.message}`);
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
        const supplier = await this.supabase.getSupplierByName('Connoisseur');
        if (!supplier) {
            return {
                supplier_name: 'Connoisseur',
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
        const supplier = await this.supabase.getSupplierByName('Connoisseur');
        if (!supplier) {
            throw new Error('Connoisseur supplier not found');
        }
        return supplier;
    }
    // ============================================
    // CONNOISSEUR-SPECIFIC METHODS
    // ============================================
    async fetchAllProducts(limit) {
        const allProducts = [];
        shared_1.logger.info('🔄 Starting multi-collection fetch...');
        shared_1.logger.info(`📚 Collections to fetch: ${this.config.collections.join(', ')}`);
        // Fetch from each collection
        for (const collection of this.config.collections) {
            shared_1.logger.info(`\n📂 Fetching collection: ${collection}`);
            let page = 1;
            let hasMoreProducts = true;
            let lastProductId = null;
            while (hasMoreProducts && (!limit || allProducts.length < limit)) {
                try {
                    shared_1.logger.info(`📄 Fetching ${collection} page ${page}...`);
                    const products = await this.fetchProductPage(collection, page, lastProductId);
                    if (products.length === 0) {
                        shared_1.logger.info(`📄 Page ${page} returned 0 products - collection complete`);
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
                    shared_1.logger.info(`📦 ${collection} page ${page}: Found ${products.length} products, ${newProductsCount} new, ${allProducts.length} total`);
                    if (newProductsCount === 0) {
                        shared_1.logger.info(`🛑 No new products found on page ${page} - stopping collection`);
                        hasMoreProducts = false;
                    }
                    else if (products.length < this.config.pageLimit) {
                        shared_1.logger.info(`🏁 Page ${page} returned fewer than ${this.config.pageLimit} products - likely final page`);
                        hasMoreProducts = false;
                    }
                    page++;
                    // Safety limit per collection
                    if (page > 100) {
                        shared_1.logger.info('⚠️ Safety limit reached (100 pages) - stopping collection');
                        hasMoreProducts = false;
                    }
                    // Polite delay between requests (1 req/sec as per requirements)
                    if (hasMoreProducts) {
                        await this.delay(1000);
                    }
                }
                catch (error) {
                    shared_1.logger.error(`❌ Error fetching ${collection} page ${page}: ${error.message}`);
                    hasMoreProducts = false;
                }
            }
            shared_1.logger.info(`✅ Collection '${collection}' complete`);
        }
        shared_1.logger.info(`\n✅ All collections fetched: ${allProducts.length} total products`);
        // Apply limit if specified
        if (limit && allProducts.length > limit) {
            return allProducts.slice(0, limit);
        }
        return allProducts;
    }
    async fetchProductPage(collection, page, lastProductId) {
        const apiEndpoint = `/collections/${collection}/products.json`;
        // Strategy 1: Page-based pagination
        try {
            const url = `${this.config.baseUrl}${apiEndpoint}?limit=${this.config.pageLimit}&page=${page}`;
            const response = await this.client.get(url);
            if (response.data && response.data.products && response.data.products.length > 0) {
                return response.data.products;
            }
        }
        catch (error) {
            shared_1.logger.info(`📄 Page-based pagination failed for ${collection} page ${page}`);
        }
        // Strategy 2: Cursor-based pagination (since_id)
        if (lastProductId && page > 1) {
            try {
                const url = `${this.config.baseUrl}${apiEndpoint}?limit=${this.config.pageLimit}&since_id=${lastProductId}`;
                const response = await this.client.get(url);
                if (response.data && response.data.products && response.data.products.length > 0) {
                    return response.data.products;
                }
            }
            catch (error) {
                shared_1.logger.info(`📄 Cursor-based pagination failed for ${collection} since_id ${lastProductId}`);
            }
        }
        return [];
    }
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    transformToUnified(conProduct) {
        const mainVariant = conProduct.variants[0];
        const mainImage = conProduct.images[0];
        // Parse retail price from Shopify
        const retailPrice = parseFloat(mainVariant.price) || 0;
        // Calculate cost price (retail less 20%)
        const costPrice = retailPrice * 0.8;
        // Selling price is same as retail price
        const sellingPrice = retailPrice;
        // Calculate margin percentage
        const marginPercentage = costPrice > 0 ? ((sellingPrice - costPrice) / costPrice) * 100 : 0;
        // Extract category
        const category_name = this.mapProductType(conProduct.product_type);
        // Parse HTML description
        const description = this.parseHtmlDescription(conProduct.body_html);
        // Extract SKU from product (e.g., CON000859)
        const sku = mainVariant.sku || `con-${conProduct.id}`;
        const brand = conProduct.vendor || 'Connoisseur';
        // Classify use case for AI consultation filtering
        const useCase = (0, shared_1.classifyUseCase)({
            productName: conProduct.title,
            categoryName: category_name,
            brand: brand,
            description: description,
        });
        return {
            product_name: conProduct.title,
            sku,
            model: conProduct.handle,
            brand: brand,
            category_name,
            description,
            cost_price: costPrice,
            retail_price: retailPrice,
            selling_price: sellingPrice,
            margin_percentage: parseFloat(marginPercentage.toFixed(2)),
            total_stock: mainVariant.available ? 10 : 0,
            stock_jhb: mainVariant.available ? 10 : 0,
            stock_cpt: 0,
            stock_dbn: 0,
            images: conProduct.images.map(img => img.src),
            specifications: {
                product_id: conProduct.id,
                handle: conProduct.handle,
                product_type: conProduct.product_type,
                tags: conProduct.tags,
                vendor: conProduct.vendor,
                options: conProduct.options,
                inventory_quantity: mainVariant.inventory_quantity,
            },
            supplier_id: this.supplier.id,
            supplier_sku: sku,
            active: mainVariant.available,
            use_case: useCase,
            exclude_from_consultation: (0, shared_1.shouldExcludeFromConsultation)(useCase),
        };
    }
    parseHtmlDescription(html) {
        if (!html)
            return 'Premium audio and home entertainment product from Connoisseur.';
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
            text = `${text} Premium audio and home entertainment product from Connoisseur.`;
        }
        return text.substring(0, 500) + (text.length > 500 ? '...' : '');
    }
    mapProductType(productType) {
        const typeMap = {
            // Audio categories
            Speakers: 'Audio Visual',
            Headphones: 'Audio Visual',
            Amplifiers: 'Audio Visual',
            Receivers: 'Audio Visual',
            Turntables: 'Audio Visual',
            'CD Players': 'Audio Visual',
            'Streaming Devices': 'Audio Visual',
            // Home cinema
            Projectors: 'Audio Visual',
            'Projector Screens': 'Audio Visual',
            Soundbars: 'Audio Visual',
            Subwoofers: 'Audio Visual',
            // Accessories
            Cables: 'Accessories',
            Mounts: 'Accessories',
            'Power Conditioners': 'Accessories',
            // Smart home
            'Smart Home': 'Home Automation',
            'Home Audio': 'Audio Visual',
            'New Products': 'Audio Visual',
        };
        return typeMap[productType] || 'Audio Visual';
    }
}
exports.ConnoisseurMCPServer = ConnoisseurMCPServer;
exports.default = ConnoisseurMCPServer;
//# sourceMappingURL=index.js.map