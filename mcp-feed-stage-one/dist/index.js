"use strict";
/**
 * Stage-One MCP Server
 * WordPress/WooCommerce integration with session-based authentication
 *
 * Stage-One uses a "login to see prices" plugin that hides prices from the REST API.
 * Solution: Authenticate via WordPress login, then scrape HTML category pages.
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
exports.StageOneMCPServer = void 0;
require("dotenv/config");
const axios_1 = __importDefault(require("axios"));
const axios_cookiejar_support_1 = require("axios-cookiejar-support");
const tough_cookie_1 = require("tough-cookie");
const cheerio = __importStar(require("cheerio"));
const shared_1 = require("@audico/shared");
// Category URLs to scrape
const CATEGORY_URLS = [
    '/product-category/amplifiers/',
    '/product-category/audio-interfaces/',
    '/product-category/cable-management/',
    '/product-category/cables-leads/',
    '/product-category/connectors-adaptors/',
    '/product-category/flight-cases-racks-bags/',
    '/product-category/headphones/',
    '/product-category/lighting/',
    '/product-category/megaphones/',
    '/product-category/microphones/',
    '/product-category/mixing-consoles/',
    '/product-category/multimedia-players/',
    '/product-category/music-instruments/',
    '/product-category/new-products/',
    '/product-category/projector-screens/',
    '/product-category/speakers/',
    '/product-category/special-effects-sfx/',
    '/product-category/stands-dj-lighing-audio/',
    '/product-category/tools-testers/',
    '/product-category/trussing-staging/',
    '/product-category/tv-video-hifi/',
];
// ============================================
// STAGE-ONE MCP SERVER
// ============================================
class StageOneMCPServer {
    constructor(supabaseUrl, supabaseKey) {
        this.supplier = null;
        this.isAuthenticated = false;
        this.config = {
            baseUrl: process.env.STAGEONE_BASE_URL || 'https://stage-one.co.za',
            username: process.env.STAGEONE_USERNAME || '',
            password: process.env.STAGEONE_PASSWORD || '',
            timeout: 60000,
        };
        this.supabase = new shared_1.SupabaseService(supabaseUrl, supabaseKey);
        this.cookieJar = new tough_cookie_1.CookieJar();
        // Create axios instance with cookie jar support
        this.client = (0, axios_cookiejar_support_1.wrapper)(axios_1.default.create({
            jar: this.cookieJar,
            withCredentials: true,
            timeout: this.config.timeout,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Connection': 'keep-alive',
            },
        }));
    }
    // ============================================
    // AUTHENTICATION METHODS
    // ============================================
    async extractNonce() {
        shared_1.logger.info('Fetching login page to extract nonce...');
        try {
            const response = await this.client.get(`${this.config.baseUrl}/my-account/`);
            const $ = cheerio.load(response.data);
            let nonce = $('input[name="woocommerce-login-nonce"]').val();
            if (!nonce) {
                nonce = $('input[name="_wpnonce"]').val();
            }
            if (!nonce) {
                throw new Error('Could not find login nonce on page');
            }
            shared_1.logger.info(`Extracted nonce: ${nonce.substring(0, 10)}...`);
            return nonce;
        }
        catch (error) {
            shared_1.logger.error(`Failed to extract nonce: ${error.message}`);
            throw error;
        }
    }
    async authenticate() {
        if (!this.config.username || !this.config.password) {
            throw new Error('STAGEONE_USERNAME and STAGEONE_PASSWORD must be set');
        }
        shared_1.logger.info(`Authenticating as ${this.config.username}...`);
        try {
            const nonce = await this.extractNonce();
            const loginUrl = `${this.config.baseUrl}/my-account/`;
            const formData = new URLSearchParams();
            formData.append('username', this.config.username);
            formData.append('password', this.config.password);
            formData.append('woocommerce-login-nonce', nonce);
            formData.append('_wp_http_referer', '/my-account/');
            formData.append('login', 'Log in');
            formData.append('rememberme', 'forever');
            const loginResponse = await this.client.post(loginUrl, formData.toString(), {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Referer': loginUrl,
                },
                maxRedirects: 5,
                validateStatus: (status) => status >= 200 && status < 400,
            });
            // Verify by checking for dashboard or logged-in state
            const $ = cheerio.load(loginResponse.data);
            if ($('.woocommerce-MyAccount-navigation').length > 0) {
                shared_1.logger.info('Login successful - found account dashboard');
                this.isAuthenticated = true;
                return true;
            }
            const errorMsg = $('.woocommerce-error').text().trim();
            if (errorMsg) {
                shared_1.logger.error(`Login error: ${errorMsg}`);
                return false;
            }
            // Check cookies as backup verification
            const cookies = await this.cookieJar.getCookies(this.config.baseUrl);
            const hasLoggedInCookie = cookies.some(c => c.key.startsWith('wordpress_logged_in'));
            if (hasLoggedInCookie) {
                this.isAuthenticated = true;
                return true;
            }
            shared_1.logger.error('Login verification failed');
            return false;
        }
        catch (error) {
            shared_1.logger.error(`Authentication failed: ${error.message}`);
            return false;
        }
    }
    // ============================================
    // HTML SCRAPING METHODS
    // ============================================
    parsePrice(priceText) {
        // Parse "R1 798,80" or "R1798.80" format
        const cleaned = priceText
            .replace(/[R\s]/g, '') // Remove R and spaces
            .replace(/,/g, '.') // Replace comma with dot
            .replace(/\.(?=.*\.)/g, ''); // Remove all but last dot
        const price = parseFloat(cleaned);
        return isNaN(price) ? 0 : price;
    }
    async scrapeCategoryPage(categoryUrl, page = 1) {
        const url = page > 1
            ? `${this.config.baseUrl}${categoryUrl}page/${page}/`
            : `${this.config.baseUrl}${categoryUrl}`;
        try {
            const response = await this.client.get(url);
            const $ = cheerio.load(response.data);
            const products = [];
            const categoryName = $('h1').first().text().trim() || categoryUrl.split('/').filter(Boolean).pop() || 'General';
            // Find product items in the listing
            $('ul.products li, .products .product, [class*="product-item"]').each((_, element) => {
                const $el = $(element);
                // Get product link and name
                const $link = $el.find('a[href*="/product/"]').first();
                const productUrl = $link.attr('href') || '';
                const name = $el.find('h2, .woocommerce-loop-product__title, .product-title').first().text().trim();
                if (!name || !productUrl)
                    return;
                // Get price - look for the price element
                let priceText = '';
                const $price = $el.find('.price, .woocommerce-Price-amount, [class*="price"]');
                $price.each((_, priceEl) => {
                    const text = $(priceEl).text();
                    if (text.includes('R') && !text.includes('log in')) {
                        priceText = text;
                        return false; // break
                    }
                });
                // Skip if no price found (hidden or "Please log in to see pricing")
                if (!priceText || priceText.includes('log in')) {
                    return;
                }
                const price = this.parsePrice(priceText);
                if (price <= 0)
                    return;
                // Get image
                const imageUrl = $el.find('img').first().attr('src') || '';
                // Get SKU from page if visible
                const skuMatch = productUrl.match(/product\/([^\/]+)/);
                const slug = skuMatch ? skuMatch[1] : '';
                // Check stock status
                const inStock = !$el.find('.out-of-stock, .outofstock').length;
                products.push({
                    name,
                    sku: slug, // Will be updated with real SKU from product page if needed
                    price,
                    imageUrl,
                    productUrl,
                    category: categoryName,
                    inStock,
                });
            });
            // Check for pagination
            const hasMore = $('a.next, .pagination .next, [rel="next"]').length > 0 ||
                $(`a[href*="page/${page + 1}"]`).length > 0;
            return { products, hasMore };
        }
        catch (error) {
            shared_1.logger.error(`Failed to scrape ${url}: ${error.message}`);
            return { products: [], hasMore: false };
        }
    }
    async scrapeProductDetails(productUrl) {
        try {
            const response = await this.client.get(productUrl);
            const $ = cheerio.load(response.data);
            // Extract SKU
            const sku = $('.sku, [class*="sku"]').text().trim() ||
                $('span:contains("SKU")').next().text().trim() ||
                '';
            // Extract brand
            const brand = $('a[href*="/brand/"]').first().text().trim() ||
                $('[class*="brand"]').first().text().trim() ||
                '';
            // Extract description
            const description = $('.product-description, .woocommerce-product-details__short-description, #tab-description')
                .first().text().trim().substring(0, 500);
            return { sku, brand };
        }
        catch (error) {
            return {};
        }
    }
    async scrapeAllProducts() {
        const allProducts = [];
        const seenUrls = new Set();
        for (const categoryUrl of CATEGORY_URLS) {
            shared_1.logger.info(`Scraping category: ${categoryUrl}`);
            let page = 1;
            let hasMore = true;
            while (hasMore) {
                const { products, hasMore: more } = await this.scrapeCategoryPage(categoryUrl, page);
                for (const product of products) {
                    if (!seenUrls.has(product.productUrl)) {
                        seenUrls.add(product.productUrl);
                        allProducts.push(product);
                    }
                }
                hasMore = more;
                page++;
                // Rate limiting
                await new Promise(resolve => setTimeout(resolve, 300));
                // Safety limit per category
                if (page > 50)
                    break;
            }
            shared_1.logger.info(`  Found ${seenUrls.size} unique products so far`);
        }
        return allProducts;
    }
    // ============================================
    // MCP INTERFACE IMPLEMENTATION
    // ============================================
    async testConnection() {
        try {
            shared_1.logger.info('Testing Stage-One connection...');
            // Test basic connectivity
            const response = await this.client.get(`${this.config.baseUrl}/product-category/speakers/`);
            if (!response.data) {
                shared_1.logger.error('Stage-One returned no data');
                return false;
            }
            // Check if prices are visible (would show "Please log in" if not authenticated)
            const $ = cheerio.load(response.data);
            const hasLoginPrompt = $.text().includes('log in to see pricing');
            if (hasLoginPrompt) {
                shared_1.logger.info('Prices hidden - authentication required');
                const authSuccess = await this.authenticate();
                if (!authSuccess) {
                    shared_1.logger.error('Authentication failed');
                    return false;
                }
                // Verify prices now visible
                const authResponse = await this.client.get(`${this.config.baseUrl}/product-category/speakers/`);
                const $auth = cheerio.load(authResponse.data);
                // Look for actual prices
                const priceElements = $auth('.price, .woocommerce-Price-amount').filter((_, el) => {
                    return $auth(el).text().includes('R') && !$auth(el).text().includes('log in');
                });
                if (priceElements.length > 0) {
                    shared_1.logger.info(`Authentication verified - found ${priceElements.length} visible prices`);
                    return true;
                }
                shared_1.logger.warn('Authenticated but prices may still be hidden for some products');
                return true;
            }
            shared_1.logger.info('Stage-One connection successful (prices visible)');
            return true;
        }
        catch (error) {
            shared_1.logger.error(`Stage-One connection failed: ${error.message}`);
            return false;
        }
    }
    async syncProducts(options) {
        const startTime = Date.now();
        let sessionId = '';
        try {
            this.supplier = await this.supabase.getSupplierByName('Stage-One');
            if (!this.supplier) {
                throw new Error('Stage-One supplier not found in database. Please add it first.');
            }
            await this.supabase.updateSupplierStatus(this.supplier.id, 'running');
            sessionId = await this.supabase.createSyncSession(this.supplier.id, options?.sessionName || 'manual');
            shared_1.logSync.start('Stage-One', sessionId);
            // Ensure authentication
            if (!this.isAuthenticated) {
                shared_1.logger.info('Authenticating before sync...');
                const authSuccess = await this.authenticate();
                if (!authSuccess) {
                    throw new Error('Failed to authenticate with Stage-One');
                }
            }
            // Scrape all products from HTML
            shared_1.logger.info('Scraping products from Stage-One website...');
            let allProducts = await this.scrapeAllProducts();
            if (options?.limit) {
                allProducts = allProducts.slice(0, options.limit);
            }
            shared_1.logger.info(`Processing ${allProducts.length} products...`);
            let productsAdded = 0;
            let productsUpdated = 0;
            let productsUnchanged = 0;
            const errors = [];
            const warnings = [];
            for (let i = 0; i < allProducts.length; i++) {
                const product = allProducts[i];
                try {
                    if (i % 50 === 0) {
                        shared_1.logSync.progress('Stage-One', i, allProducts.length);
                    }
                    const unifiedProduct = this.transformToUnified(product);
                    if (options?.dryRun) {
                        shared_1.logger.info(`[DRY RUN] Would upsert: ${unifiedProduct.product_name}`);
                        continue;
                    }
                    const result = await this.supabase.upsertProduct(unifiedProduct);
                    if (result.isNew) {
                        productsAdded++;
                    }
                    else {
                        productsUpdated++;
                    }
                }
                catch (error) {
                    const errorMsg = `Failed to process ${product.name}: ${error.message}`;
                    errors.push(errorMsg);
                    shared_1.logger.error(errorMsg);
                }
            }
            const durationSeconds = Math.floor((Date.now() - startTime) / 1000);
            await this.supabase.completeSyncSession(sessionId, {
                products_added: productsAdded,
                products_updated: productsUpdated,
                products_unchanged: productsUnchanged,
                errors,
                warnings,
            });
            await this.supabase.updateSupplierStatus(this.supplier.id, 'idle');
            await this.supabase.updateSupplierLastSync(this.supplier.id);
            shared_1.logSync.complete('Stage-One', sessionId, {
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
            shared_1.logger.error(`Stage-One sync failed: ${error.message}`);
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
        const supplier = await this.supabase.getSupplierByName('Stage-One');
        if (!supplier) {
            return {
                supplier_name: 'Stage-One',
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
        const supplier = await this.supabase.getSupplierByName('Stage-One');
        if (!supplier) {
            throw new Error('Stage-One supplier not found');
        }
        return supplier;
    }
    // ============================================
    // TRANSFORM TO UNIFIED SCHEMA
    // ============================================
    transformToUnified(product) {
        // Price from Stage-One is cost (excl VAT)
        // Apply 15% VAT + 20% margin = 38% total markup
        const costPrice = product.price;
        const pricing = shared_1.PricingCalculator.esquirePricing(costPrice); // 15% VAT + 20% margin
        // Extract brand from name if not set
        const brand = product.brand || this.extractBrand(product.name);
        // Generate SKU from slug if needed
        const sku = product.sku || this.slugToSku(product.productUrl);
        // Classify use case for AI consultation filtering
        const useCase = (0, shared_1.classifyUseCase)({
            productName: product.name,
            categoryName: product.category,
            brand: brand,
        });
        return {
            product_name: product.name,
            sku: sku,
            model: sku,
            brand: brand,
            category_name: product.category,
            description: '',
            cost_price: costPrice,
            retail_price: pricing.selling_price,
            selling_price: pricing.selling_price,
            margin_percentage: pricing.margin_percentage,
            total_stock: product.inStock ? 10 : 0,
            stock_jhb: product.inStock ? 10 : 0,
            stock_cpt: 0,
            stock_dbn: 0,
            images: product.imageUrl ? [product.imageUrl] : [],
            specifications: {},
            supplier_url: product.productUrl,
            supplier_id: this.supplier.id,
            supplier_sku: sku,
            active: product.inStock,
            use_case: useCase,
            exclude_from_consultation: (0, shared_1.shouldExcludeFromConsultation)(useCase),
        };
    }
    slugToSku(productUrl) {
        const match = productUrl.match(/product\/([^\/]+)/);
        if (match) {
            return match[1].toUpperCase().replace(/-/g, '_').substring(0, 50);
        }
        return `STAGEONE_${Date.now()}`;
    }
    extractBrand(productName) {
        const name = productName.toUpperCase();
        const knownBrands = [
            'ADASTRA', 'VONYX', 'SKYTEC', 'POWER DYNAMICS', 'FENTON',
            'JBL', 'HARMAN', 'YAMAHA', 'DENON', 'MARANTZ', 'BOSE', 'SONOS',
            'SAMSUNG', 'LG', 'SONY', 'PHILIPS', 'PANASONIC',
            'CROWN', 'QSC', 'SHURE', 'SENNHEISER', 'AUDIO-TECHNICA',
            'PIONEER', 'NUMARK', 'BEHRINGER', 'MACKIE', 'ALLEN & HEATH',
            'DBX', 'LEXICON', 'KLIPSCH', 'FOCAL', 'B&W', 'PARADIGM',
            'TRANTEC', 'CITRONIC', 'PULSE', 'QTX', 'RELOOP',
        ];
        for (const brand of knownBrands) {
            if (name.startsWith(brand) || name.includes(` ${brand} `)) {
                return brand.split(' ').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');
            }
        }
        // Take first word as brand
        const firstWord = productName.split(/[\s\-–]/)[0];
        return firstWord || 'Unknown';
    }
}
exports.StageOneMCPServer = StageOneMCPServer;
exports.default = StageOneMCPServer;
//# sourceMappingURL=index.js.map