"use strict";
/**
 * Pro Audio MCP Server
 * WordPress REST API + Playwright browser scraping fallback
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProAudioMCPServer = void 0;
require("dotenv/config");
const playwright_1 = require("playwright");
const axios_1 = __importDefault(require("axios"));
const shared_1 = require("@audico/shared");
class ProAudioMCPServer {
    constructor(supabaseUrl, supabaseKey) {
        this.supplier = null;
        this.config = {
            baseUrl: process.env.PROAUDIO_BASE_URL || 'https://proaudio.co.za',
            wpRestApi: process.env.PROAUDIO_WP_REST_API || '/wp-json/wc/v3/products',
            headless: process.env.HEADLESS !== 'false',
            timeout: parseInt(process.env.TIMEOUT || '30000'),
        };
        this.supabase = new shared_1.SupabaseService(supabaseUrl, supabaseKey);
        this.client = axios_1.default.create({
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
        });
    }
    async testConnection() {
        try {
            shared_1.logger.info('🔌 Testing Pro Audio connection...');
            // Try WordPress REST API first
            try {
                const response = await this.client.get(`${this.config.baseUrl}${this.config.wpRestApi}?per_page=1`);
                if (response.data && Array.isArray(response.data) && response.data.length > 0) {
                    shared_1.logger.info('✅ Pro Audio WordPress REST API connection successful');
                    return true;
                }
            }
            catch (apiError) {
                shared_1.logger.info('⚠️ WordPress REST API not available, testing browser fallback...');
            }
            // Fallback to browser
            const browser = await playwright_1.chromium.launch({ headless: this.config.headless });
            const page = await browser.newPage();
            await page.goto(this.config.baseUrl, { timeout: 60000, waitUntil: 'domcontentloaded' });
            const title = await page.title();
            await browser.close();
            if (title) {
                shared_1.logger.info(`✅ Pro Audio browser connection successful: ${title}`);
                return true;
            }
            return false;
        }
        catch (error) {
            shared_1.logger.error(`❌ Pro Audio connection failed: ${error.message}`);
            return false;
        }
    }
    async syncProducts(options) {
        const startTime = Date.now();
        let sessionId = '';
        let browser = null;
        try {
            this.supplier = await this.supabase.getSupplierByName('Pro Audio');
            if (!this.supplier)
                throw new Error('Pro Audio supplier not found');
            await this.supabase.updateSupplierStatus(this.supplier.id, 'running');
            sessionId = await this.supabase.createSyncSession(this.supplier.id, options?.sessionName || 'manual');
            shared_1.logSync.start('Pro Audio', sessionId);
            // Use browser scraping (WordPress REST API often requires authentication)
            browser = await playwright_1.chromium.launch({ headless: this.config.headless });
            const page = await browser.newPage();
            shared_1.logger.info('📄 Loading Pro Audio shop page...');
            await page.goto(`${this.config.baseUrl}/shop`, { waitUntil: 'domcontentloaded' });
            // Scroll and load more products (WooCommerce infinite scroll or pagination)
            shared_1.logger.info('🔄 Scrolling to load all products...');
            let previousCount = 0;
            let currentCount = 0;
            let scrollAttempts = 0;
            const maxScrolls = 100;
            do {
                previousCount = currentCount;
                // Scroll to bottom
                await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
                await page.waitForTimeout(1500);
                // Check for and click pagination/load more buttons
                try {
                    const loadMoreBtn = page.locator('a.next, .load-more, button:has-text("Load More")').first();
                    if (await loadMoreBtn.isVisible({ timeout: 2000 })) {
                        await loadMoreBtn.click();
                        await page.waitForTimeout(2000);
                        shared_1.logger.info(`📱 Clicked pagination button #${scrollAttempts + 1}`);
                    }
                }
                catch {
                    // No load more button
                }
                currentCount = await page.evaluate(() => {
                    return document.querySelectorAll('a[href*="/product/"]').length;
                });
                scrollAttempts++;
                if (scrollAttempts % 5 === 0) {
                    shared_1.logger.info(`📦 Found ${currentCount} product links so far...`);
                }
            } while (currentCount > previousCount && scrollAttempts < maxScrolls);
            // Collect product links
            const productLinks = await page.evaluate(() => {
                const links = Array.from(document.querySelectorAll('a[href*="/product/"]'));
                return [...new Set(links.map((a) => a.href))];
            });
            shared_1.logger.info(`🔍 Found ${productLinks.length} total product links`);
            const limit = options?.limit || productLinks.length;
            const linksToProcess = productLinks.slice(0, limit);
            const products = await this.scrapeProductDetails(page, linksToProcess, options?.dryRun);
            let productsAdded = 0, productsUpdated = 0;
            const errors = [], warnings = [];
            for (let i = 0; i < products.length; i++) {
                try {
                    if (i % 50 === 0)
                        shared_1.logSync.progress('Pro Audio', i, products.length);
                    const unifiedProduct = this.transformToUnified(products[i]);
                    if (options?.dryRun) {
                        shared_1.logger.info(`[DRY RUN] Would upsert: ${unifiedProduct.product_name}`);
                        continue;
                    }
                    const result = await this.supabase.upsertProduct(unifiedProduct);
                    result.isNew ? productsAdded++ : productsUpdated++;
                }
                catch (error) {
                    errors.push(`Failed to process ${products[i].sku}: ${error.message}`);
                }
            }
            const durationSeconds = Math.floor((Date.now() - startTime) / 1000);
            await this.supabase.completeSyncSession(sessionId, { products_added: productsAdded, products_updated: productsUpdated, products_unchanged: 0, errors, warnings });
            await this.supabase.updateSupplierStatus(this.supplier.id, 'idle');
            await this.supabase.updateSupplierLastSync(this.supplier.id);
            shared_1.logSync.complete('Pro Audio', sessionId, { added: productsAdded, updated: productsUpdated, duration: durationSeconds });
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
            shared_1.logger.error(`❌ Pro Audio sync failed: ${error.message}`);
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
        finally {
            if (browser)
                await browser.close();
        }
    }
    async getStatus() {
        const supplier = await this.supabase.getSupplierByName('Pro Audio');
        if (!supplier)
            return { supplier_name: 'Pro Audio', total_products: 0, status: 'error', error_message: 'Supplier not found' };
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
        const supplier = await this.supabase.getSupplierByName('Pro Audio');
        if (!supplier)
            throw new Error('Pro Audio supplier not found');
        return supplier;
    }
    async scrapeProductDetails(page, productLinks, dryRun) {
        const products = [];
        for (let i = 0; i < productLinks.length; i++) {
            try {
                if (i % 20 === 0)
                    shared_1.logger.info(`📦 Progress: ${i}/${productLinks.length} products`);
                await page.goto(productLinks[i], { waitUntil: 'domcontentloaded', timeout: 10000 });
                const productData = await page.evaluate((url) => {
                    const name = document.querySelector('h1.product_title')?.textContent?.trim() || '';
                    const priceText = document.querySelector('.price')?.textContent || '';
                    const priceMatch = priceText.match(/R\s*([0-9,]+(?:\.[0-9]{2})?)/);
                    const price = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : 0;
                    const image = document.querySelector('.woocommerce-product-gallery__image img')?.src || '';
                    const sku = document.querySelector('.sku')?.textContent?.trim() || `PA-${Date.now()}`;
                    const brand = document.querySelector('.product_brand')?.textContent?.trim() || '';
                    return { name, sku, price, image, url, brand };
                }, productLinks[i]);
                if (productData.name) {
                    products.push({
                        sku: productData.sku,
                        name: productData.name,
                        price: productData.price,
                        image: productData.image,
                        productUrl: productLinks[i],
                        inStock: true,
                        brand: productData.brand,
                        category: 'Audio',
                    });
                }
                if (i % 20 === 0 && !dryRun)
                    await new Promise(resolve => setTimeout(resolve, 500));
            }
            catch (error) {
                shared_1.logger.error(`Error scraping ${productLinks[i]}: ${error.message}`);
            }
        }
        return products;
    }
    transformToUnified(paProduct) {
        // ProAudio pricing: scraped price is their website price
        // Our retail = scraped price - 10%
        // Our cost = scraped price - 20%
        const scrapedPrice = paProduct.price;
        const retailPrice = scrapedPrice * 0.90; // 10% off scraped price
        const costPrice = scrapedPrice * 0.80; // 20% off scraped price
        const marginPercentage = ((retailPrice - costPrice) / costPrice) * 100;
        const brand = paProduct.brand || 'Pro Audio';
        const categoryName = paProduct.category || 'Audio';
        // Classify use case for AI consultation filtering
        const useCase = (0, shared_1.classifyUseCase)({
            productName: paProduct.name,
            categoryName: categoryName,
            brand: brand,
        });
        return {
            product_name: paProduct.name,
            sku: paProduct.sku,
            model: paProduct.name, // Use product name as model, not SKU
            brand: brand,
            category_name: categoryName,
            cost_price: parseFloat(costPrice.toFixed(2)),
            retail_price: parseFloat(retailPrice.toFixed(2)),
            selling_price: parseFloat(retailPrice.toFixed(2)),
            margin_percentage: marginPercentage,
            total_stock: paProduct.inStock ? 10 : 0,
            stock_jhb: paProduct.inStock ? 10 : 0,
            stock_cpt: 0,
            stock_dbn: 0,
            images: paProduct.image ? [paProduct.image] : [],
            specifications: { product_url: paProduct.productUrl },
            supplier_id: this.supplier.id,
            supplier_sku: paProduct.sku,
            active: paProduct.inStock,
            use_case: useCase,
            exclude_from_consultation: (0, shared_1.shouldExcludeFromConsultation)(useCase),
        };
    }
}
exports.ProAudioMCPServer = ProAudioMCPServer;
exports.default = ProAudioMCPServer;
//# sourceMappingURL=index.js.map