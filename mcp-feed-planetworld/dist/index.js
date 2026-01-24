"use strict";
/**
 * Planet World MCP Server
 * Playwright-based web scraping with JavaScript extraction
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
exports.PlanetWorldMCPServer = void 0;
require("dotenv/config");
const playwright_extra_1 = require("playwright-extra");
const puppeteer_extra_plugin_stealth_1 = __importDefault(require("puppeteer-extra-plugin-stealth"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const shared_1 = require("@audico/shared");
// Add stealth plugin to avoid bot detection
playwright_extra_1.chromium.use((0, puppeteer_extra_plugin_stealth_1.default)());
// ============================================
// PLANET WORLD MCP SERVER
// ============================================
class PlanetWorldMCPServer {
    constructor(supabaseUrl, supabaseKey) {
        this.supplier = null;
        this.config = {
            baseUrl: process.env.PLANETWORLD_BASE_URL || 'https://www.planetworld.co.za',
            productsUrl: process.env.PLANETWORLD_PRODUCTS_URL || '/products',
            headless: process.env.HEADLESS !== 'false',
            timeout: parseInt(process.env.TIMEOUT || '30000'),
            // Use real Chrome user agent to avoid bot detection
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        };
        this.supabase = new shared_1.SupabaseService(supabaseUrl, supabaseKey);
    }
    // ============================================
    // MCP INTERFACE IMPLEMENTATION
    // ============================================
    async testConnection() {
        try {
            shared_1.logger.info('🔌 Testing Planet World connection...');
            const userDataDir = path.resolve('.pw-profiles/planetworld-za');
            if (!fs.existsSync(userDataDir)) {
                fs.mkdirSync(userDataDir, { recursive: true });
            }
            const context = await playwright_extra_1.chromium.launchPersistentContext(userDataDir, {
                channel: 'chrome',
                headless: this.config.headless,
                locale: 'en-ZA',
                timezoneId: 'Africa/Johannesburg',
                userAgent: this.config.userAgent,
            });
            const page = context.pages()[0] || await context.newPage();
            await page.goto(`${this.config.baseUrl}${this.config.productsUrl}`, {
                waitUntil: 'domcontentloaded',
                timeout: 20000,
            });
            const title = await page.title();
            await context.close();
            if (title) {
                shared_1.logger.info(`✅ Planet World connection successful: ${title}`);
                return true;
            }
            shared_1.logger.error('❌ Planet World connection failed - no title found');
            return false;
        }
        catch (error) {
            shared_1.logger.error(`❌ Planet World connection failed: ${error.message}`);
            return false;
        }
    }
    async syncProducts(options) {
        const startTime = Date.now();
        let sessionId = '';
        let context = null;
        try {
            // Get supplier record
            this.supplier = await this.supabase.getSupplierByName('Planet World');
            if (!this.supplier) {
                throw new Error('Planet World supplier not found in database');
            }
            // Update supplier status
            await this.supabase.updateSupplierStatus(this.supplier.id, 'running');
            // Create sync session
            sessionId = await this.supabase.createSyncSession(this.supplier.id, options?.sessionName || 'manual');
            shared_1.logSync.start('Planet World', sessionId);
            // Use persistent profile with Chrome channel for better bot evasion
            const userDataDir = path.resolve('.pw-profiles/planetworld-za');
            // Ensure profile directory exists
            if (!fs.existsSync(userDataDir)) {
                fs.mkdirSync(userDataDir, { recursive: true });
                shared_1.logger.info('📁 Created persistent browser profile directory');
            }
            // Launch with persistent context (Chrome channel + saved state)
            context = await playwright_extra_1.chromium.launchPersistentContext(userDataDir, {
                channel: 'chrome', // Use real Chrome instead of Chromium
                headless: this.config.headless,
                locale: 'en-ZA', // South African English
                timezoneId: 'Africa/Johannesburg', // SA timezone
                viewport: { width: 1920, height: 1080 },
                userAgent: this.config.userAgent,
                acceptDownloads: false,
                // South African proxy if configured
                proxy: process.env.ZA_PROXY ? { server: process.env.ZA_PROXY } : undefined,
                args: [
                    '--disable-blink-features=AutomationControlled',
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                ],
            });
            const page = context.pages()[0] || await context.newPage();
            // Additional stealth init script (belt-and-braces with stealth plugin)
            await page.addInitScript(() => {
                Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
                window.chrome = { runtime: {} };
            });
            const fullUrl = `${this.config.baseUrl}${this.config.productsUrl}`;
            shared_1.logger.info(`📄 Loading Planet World products page: ${fullUrl}`);
            await page.goto(fullUrl, {
                waitUntil: 'networkidle', // Wait for AJAX/JS to finish loading products
                timeout: 30000,
            });
            // Extra wait for dynamic content to render
            await page.waitForTimeout(2000);
            // Dismiss popups
            await this.dismissPopups(page);
            // Use infinite scroll for Klipsch category page (lazy loading)
            // Scroll aggressively to load all products (minimum 20 scrolls even for small limits)
            const maxScrolls = Math.max(20, options?.limit ? Math.ceil(options.limit / 5) : 50);
            const totalScrolls = await this.infiniteScroll(page, maxScrolls);
            shared_1.logger.info(`✅ Completed ${totalScrolls} scrolls`);
            // Try clicking Load More buttons (some pages have both)
            const totalClicks = await this.clickLoadMoreButtons(page, 5);
            if (totalClicks > 0) {
                shared_1.logger.info(`✅ Also clicked ${totalClicks} Load More buttons`);
            }
            // DEBUG: Take screenshot and inspect page structure
            if (options?.dryRun) {
                await page.screenshot({ path: 'debug-klipsch-page.png', fullPage: true });
                shared_1.logger.info(`📸 Screenshot saved to debug-klipsch-page.png`);
                const pageStructure = await page.evaluate(() => {
                    // Look for common product container patterns
                    const selectors = [
                        '.product', '.product-card', '.product-item', '.product-listing',
                        '[data-product]', '[data-product-id]',
                        '.item', '.card', '.listing-item',
                        'div[class*="product"]', 'div[id*="product"]'
                    ];
                    const found = selectors.map(sel => {
                        const elements = document.querySelectorAll(sel);
                        return {
                            selector: sel,
                            count: elements.length,
                            sample: elements.length > 0 ? {
                                html: elements[0].outerHTML.substring(0, 500),
                                text: elements[0].textContent?.trim().substring(0, 100)
                            } : null
                        };
                    }).filter(r => r.count > 0);
                    return found;
                });
                shared_1.logger.info(`🔍 DEBUG: Potential product containers:`);
                pageStructure.forEach(p => {
                    shared_1.logger.info(`   ${p.selector}: ${p.count} elements`);
                    if (p.sample) {
                        shared_1.logger.info(`      Text: ${p.sample.text}`);
                    }
                });
            }
            // Collect product links
            const productLinks = await this.collectProductLinks(page, options?.limit || 10000);
            shared_1.logger.info(`🔍 Found ${productLinks.length} product links`);
            if (productLinks.length === 0) {
                throw new Error('No product links found - check selectors');
            }
            // Scrape products
            const products = await this.scrapeProductDetails(page, productLinks, options?.dryRun);
            let productsAdded = 0;
            let productsUpdated = 0;
            let productsUnchanged = 0;
            const errors = [];
            const warnings = [];
            // Process and store products
            for (let i = 0; i < products.length; i++) {
                const rawProduct = products[i];
                try {
                    if (i % 50 === 0) {
                        shared_1.logSync.progress('Planet World', i, products.length);
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
                    const errorMsg = `Failed to process ${rawProduct.sku}: ${error.message}`;
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
            shared_1.logSync.complete('Planet World', sessionId, {
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
            shared_1.logger.error(`❌ Planet World sync failed: ${error.message}`);
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
        finally {
            if (context) {
                await context.close();
            }
        }
    }
    async getStatus() {
        const supplier = await this.supabase.getSupplierByName('Planet World');
        if (!supplier) {
            return {
                supplier_name: 'Planet World',
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
        const supplier = await this.supabase.getSupplierByName('Planet World');
        if (!supplier) {
            throw new Error('Planet World supplier not found');
        }
        return supplier;
    }
    // ============================================
    // PLANET WORLD-SPECIFIC METHODS
    // ============================================
    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    async dismissPopups(page) {
        const popupTexts = ['Continue', 'SAVE & ACCEPT', 'Allow All', 'Accept', 'OK', 'Close'];
        for (const text of popupTexts) {
            try {
                const element = page.getByText(text, { exact: true }).first();
                if (await element.isVisible({ timeout: 2000 })) {
                    await element.click();
                    shared_1.logger.info(`✅ Dismissed popup: ${text}`);
                    await this.sleep(1000);
                }
            }
            catch {
                // Popup not found - continue
            }
        }
    }
    async infiniteScroll(page, maxScrolls = 50) {
        let scrollCount = 0;
        let previousHeight = 0;
        let noChangeCount = 0;
        shared_1.logger.info('📜 Infinite scrolling to load products...');
        while (scrollCount < maxScrolls) {
            // Get current page height
            const currentHeight = await page.evaluate(() => document.body.scrollHeight);
            // Scroll down slowly
            await page.evaluate(() => {
                window.scrollBy(0, window.innerHeight * 0.8); // Scroll 80% of viewport
            });
            scrollCount++;
            if (scrollCount % 5 === 0) {
                shared_1.logger.info(`📜 Scrolled ${scrollCount} times...`);
            }
            // Wait for content to load
            await this.sleep(1000); // Slower scroll for lazy loading
            // Check if we've reached the bottom
            if (currentHeight === previousHeight) {
                noChangeCount++;
                // If height hasn't changed for 3 consecutive scrolls, we're at the bottom
                if (noChangeCount >= 3) {
                    shared_1.logger.info('✅ Reached bottom of page - all products loaded');
                    break;
                }
            }
            else {
                noChangeCount = 0;
            }
            previousHeight = currentHeight;
        }
        return scrollCount;
    }
    async clickLoadMoreButtons(page, maxClicks = 200) {
        let clickCount = 0;
        shared_1.logger.info('🔄 Clicking Load More buttons...');
        while (clickCount < maxClicks) {
            const loadMoreSelectors = [
                'text="Load More"',
                'button:has-text("Load More")',
                '[data-testid*="load-more"]',
                '.load-more',
                'button:has-text("Show More")',
                'text="View More"',
                'button[onclick*="load"]',
                '.btn:has-text("Load More")',
            ];
            let buttonFound = false;
            for (const selector of loadMoreSelectors) {
                try {
                    const btn = page.locator(selector).first();
                    if (await btn.isVisible({ timeout: 1500 })) {
                        await btn.click();
                        clickCount++;
                        shared_1.logger.info(`📱 Clicked Load More button #${clickCount}`);
                        buttonFound = true;
                        // Wait for content to load
                        await page.waitForLoadState('networkidle').catch(() => { });
                        await this.sleep(800);
                        break;
                    }
                }
                catch {
                    // Button not found - continue
                }
            }
            if (!buttonFound) {
                shared_1.logger.info('✅ No more Load More buttons - all products loaded');
                break;
            }
        }
        return clickCount;
    }
    async collectProductLinks(page, limit) {
        // Wait for product cards to actually appear in the DOM after scrolling/loading
        shared_1.logger.info('⏳ Waiting for product cards to render...');
        await this.sleep(3000); // Give slow-loading products time to render
        // Try to wait for at least some product elements to appear
        try {
            await page.waitForSelector('a[href*="/products/"]', { timeout: 10000 });
            shared_1.logger.info('✅ Product links detected in DOM');
        }
        catch (e) {
            shared_1.logger.warn('⚠️  Timeout waiting for product links - continuing anyway');
        }
        // DEBUG: Log all links on page to understand structure
        const debugInfo = await page.evaluate(() => {
            const allLinks = Array.from(document.querySelectorAll('a[href*="/products/"]'));
            const withProductId = allLinks.filter((a) => a.href.includes('productid='));
            // NEW: Check what's in the product containers
            const productDivs = Array.from(document.querySelectorAll('div[class*="product"]'));
            const productDivSamples = productDivs.slice(0, 10).map((div) => {
                const links = Array.from(div.querySelectorAll('a'));
                return {
                    className: div.className,
                    linkCount: links.length,
                    linkHrefs: links.map((a) => a.href).slice(0, 3),
                    innerText: div.innerText?.substring(0, 100)
                };
            });
            // Also check for ANY links that might be products (not just /products/)
            const allHrefs = Array.from(document.querySelectorAll('a[href]'));
            const possibleProductLinks = allHrefs.filter((a) => {
                const href = a.href;
                // Look for links that might be product detail pages
                return !href.includes('/browse/') &&
                    !href.includes('categoryids=') &&
                    (href.includes('productid=') ||
                        href.match(/\/products\/[a-z0-9-]+$/i) ||
                        href.match(/\/product\//i));
            });
            return {
                totalLinks: allLinks.length,
                withProductId: withProductId.length,
                sampleProductIdHrefs: withProductId.slice(0, 10).map((a) => a.href),
                sampleHrefs: allLinks.slice(0, 20).map((a) => a.href),
                sampleClasses: allLinks.slice(0, 20).map((a) => ({
                    href: a.href,
                    className: a.className,
                    parentClass: a.parentElement?.className || '',
                    text: a.textContent?.trim().substring(0, 50) || ''
                })),
                productDivSamples,
                possibleProductLinks: possibleProductLinks.slice(0, 20).map((a) => a.href)
            };
        });
        shared_1.logger.info(`🔍 DEBUG: Found ${debugInfo.totalLinks} total links, ${debugInfo.withProductId} with productid parameter`);
        shared_1.logger.info(`🔍 DEBUG: Found ${debugInfo.possibleProductLinks.length} possible product links (non-browse)`);
        shared_1.logger.info(`🔍 DEBUG: Product container samples (${debugInfo.productDivSamples.length}):`);
        debugInfo.productDivSamples.forEach((sample, i) => {
            shared_1.logger.info(`   ${i + 1}. class="${sample.className}" links=${sample.linkCount}`);
            if (sample.linkHrefs.length > 0) {
                sample.linkHrefs.forEach((href) => shared_1.logger.info(`      - ${href}`));
            }
            shared_1.logger.info(`      text: "${sample.innerText}"`);
        });
        if (debugInfo.possibleProductLinks.length > 0) {
            shared_1.logger.info(`🔍 DEBUG: Possible product links found:`);
            debugInfo.possibleProductLinks.forEach((href, i) => {
                shared_1.logger.info(`   ${i + 1}. ${href}`);
            });
        }
        if (debugInfo.withProductId > 0) {
            shared_1.logger.info(`🔍 DEBUG: Sample productid links:`);
            debugInfo.sampleProductIdHrefs.forEach((href, i) => {
                shared_1.logger.info(`   ${i + 1}. ${href}`);
            });
        }
        else {
            shared_1.logger.info(`🔍 DEBUG: No productid links found. Sample ALL /products/ links:`);
            debugInfo.sampleHrefs.slice(0, 10).forEach((href, i) => {
                shared_1.logger.info(`   ${i + 1}. ${href}`);
            });
        }
        const allLinks = await page.evaluate(() => {
            // IMPORTANT: Exclude left sidebar category filters
            // Target only product cards in the main content area (right side)
            // Common product card selectors: .product-item, .product-card, .product-grid, etc.
            // First try: Look for product grid/list containers and get links from there
            const productContainers = [
                '.product-grid a[href*="/products/"]',
                '.product-list a[href*="/products/"]',
                '.product-item a[href*="/products/"]',
                '.products-container a[href*="/products/"]',
                '#product-grid a[href*="/products/"]',
                '.main-content a[href*="/products/"]',
                '#content a[href*="/products/"]',
                '.content a[href*="/products/"]',
            ];
            let links = [];
            for (const selector of productContainers) {
                try {
                    const found = Array.from(document.querySelectorAll(selector));
                    if (found.length > 0) {
                        links = found;
                        console.log(`Found ${found.length} products using selector: ${selector}`);
                        break;
                    }
                }
                catch (e) {
                    // Selector not found, try next
                }
            }
            // Fallback: Get all product links but exclude sidebar/navigation
            if (links.length === 0) {
                const allProductLinks = Array.from(document.querySelectorAll('a[href*="/products/"]'));
                // Exclude links from sidebar, navigation, filters
                links = allProductLinks.filter((link) => {
                    const parent = link.closest('.sidebar, .filter, nav, .navigation, .menu, aside, .categories');
                    return !parent; // Only include links NOT inside these containers
                });
                console.log(`Found ${links.length} products using fallback (excluding sidebar)`);
            }
            const uniqueUrls = [...new Set(links.map((a) => a.href))];
            // Filter for product detail pages - accept multiple URL patterns:
            // - /products/category/subcategory/.../product-name (Planet World's actual format)
            // - /products/product-name
            // - /products/browse/?productid=123
            // - /products/?productid=123
            return uniqueUrls.filter((url) => {
                // Exclude category browse pages without productid
                if (url.includes('/products/browse/') && !url.includes('productid=')) {
                    return false;
                }
                // Exclude category pages (only one segment after /products/)
                if (/\/products\/[^\/]+$/.test(url) && !url.includes('productid=')) {
                    // This is a category like /products/auto-audio - skip it
                    return false;
                }
                // Include pages with productid param
                if (url.includes('productid=')) {
                    return true;
                }
                // Include product detail pages (multiple segments = actual product)
                // /products/category/.../product-name (must have at least 2 path segments after /products/)
                return /\/products\/[^\/]+\/.+/.test(url);
            });
        });
        shared_1.logger.info(`✅ Collected ${allLinks.length} unique product links after filtering`);
        return allLinks.slice(0, limit);
    }
    async scrapeProductDetails(page, productLinks, dryRun) {
        const products = [];
        shared_1.logger.info(`🏭 Scraping ${productLinks.length} individual product pages...`);
        for (let i = 0; i < productLinks.length; i++) {
            const url = productLinks[i];
            try {
                if (i % 20 === 0) {
                    shared_1.logger.info(`📦 Progress: ${i}/${productLinks.length} products`);
                }
                await page.goto(url, {
                    waitUntil: 'domcontentloaded',
                    timeout: 10000,
                });
                // Extract product data using JavaScript
                const productData = await page.evaluate((productUrl) => {
                    // Name
                    const name = document.querySelector('h1')?.textContent?.trim() || '';
                    // SKU
                    let sku = '';
                    const skuSelectors = ['[data-testid*="sku"]', '.sku', '.product-sku'];
                    for (const selector of skuSelectors) {
                        const skuEl = document.querySelector(selector);
                        if (skuEl) {
                            sku = (skuEl.textContent || '').replace(/SKU:\s*/i, '').trim();
                            break;
                        }
                    }
                    if (!sku) {
                        const bodyText = document.body.textContent || '';
                        const skuMatch = bodyText.match(/SKU:\s*([^\s\n]+)/i);
                        if (skuMatch) {
                            sku = skuMatch[1].trim();
                        }
                    }
                    // Brand
                    let brand = '';
                    const brandSelectors = [
                        '[data-testid*="brand"] a',
                        '.brand a',
                        '.product-brand a',
                    ];
                    for (const selector of brandSelectors) {
                        const brandEl = document.querySelector(selector);
                        if (brandEl) {
                            brand = brandEl.textContent?.trim() || '';
                            break;
                        }
                    }
                    // Price
                    let price = 0;
                    const priceSelectors = ['.price', '.product-price', '[data-testid*="price"]'];
                    for (const selector of priceSelectors) {
                        const priceEl = document.querySelector(selector);
                        if (priceEl) {
                            const priceText = priceEl.textContent || '';
                            const priceMatch = priceText.match(/R\s*([0-9,]+(?:\.[0-9]{2})?)/);
                            if (priceMatch) {
                                price = parseFloat(priceMatch[1].replace(/,/g, ''));
                                break;
                            }
                        }
                    }
                    // Image
                    let image = '';
                    const imgSelectors = [
                        '.product-image img',
                        '.main-image img',
                        '.product-gallery img',
                        'img[src*="content.storefront7.co.za"]',
                        'img[src*="/media/"]',
                    ];
                    for (const selector of imgSelectors) {
                        const imgEl = document.querySelector(selector);
                        if (imgEl && imgEl.src && imgEl.src.includes('http')) {
                            image = imgEl.src;
                            break;
                        }
                    }
                    return {
                        name,
                        sku,
                        brand,
                        price,
                        image,
                        url: productUrl,
                    };
                }, url);
                if (productData.name && productData.sku) {
                    const product = {
                        sku: productData.sku,
                        name: productData.name,
                        price: productData.price,
                        category: 'Electronics',
                        brand: productData.brand || this.extractBrand(productData.name),
                        image: productData.image,
                        productUrl: url,
                        inStock: true,
                    };
                    products.push(product);
                }
                // Gentle throttle
                if (i % 20 === 0 && !dryRun) {
                    await this.sleep(500);
                }
            }
            catch (error) {
                shared_1.logger.error(`Error scraping ${url}: ${error.message}`);
            }
        }
        shared_1.logger.info(`✅ Successfully scraped ${products.length} products`);
        return products;
    }
    transformToUnified(pwProduct) {
        // Extract brand from name if not found
        const brand = pwProduct.brand || this.extractBrand(pwProduct.name);
        // Extract category from name
        const category_name = this.extractCategory(pwProduct);
        // Planet World pricing: Scraped price is RRP (retail), cost is 25% less
        const retail_price = pwProduct.price; // This is the recommended retail from website
        const cost_price = retail_price * 0.75; // Cost is 25% less than retail
        const margin_percentage = 25; // 25% margin
        return {
            product_name: pwProduct.name,
            sku: pwProduct.sku,
            model: pwProduct.sku,
            brand,
            category_name,
            description: pwProduct.description,
            cost_price: cost_price,
            retail_price: retail_price,
            selling_price: retail_price,
            margin_percentage: margin_percentage,
            total_stock: pwProduct.inStock ? 10 : 0, // Default stock
            stock_jhb: pwProduct.inStock ? 10 : 0,
            stock_cpt: 0,
            stock_dbn: 0,
            images: pwProduct.image ? [pwProduct.image] : [],
            specifications: {
                product_url: pwProduct.productUrl,
                category: pwProduct.category,
            },
            supplier_id: this.supplier.id,
            supplier_sku: pwProduct.sku,
            active: pwProduct.inStock,
        };
    }
    extractBrand(name) {
        const nameUpper = name.toUpperCase();
        // Common brands
        const brands = [
            'SAMSUNG',
            'LG',
            'SONY',
            'HISENSE',
            'TCL',
            'PANASONIC',
            'PHILIPS',
            'JBL',
            'BOSE',
            'SONOS',
            'APPLE',
            'LOGITECH',
            'MICROSOFT',
        ];
        for (const brand of brands) {
            if (nameUpper.includes(brand)) {
                return brand.charAt(0) + brand.slice(1).toLowerCase();
            }
        }
        // If no match, take first word
        return name.split(' ')[0] || 'Unknown';
    }
    extractCategory(product) {
        const name = product.name?.toLowerCase() || '';
        const category = product.category?.toLowerCase() || '';
        const combined = name + ' ' + category;
        if (combined.includes('tv') || combined.includes('television'))
            return 'Video';
        if (combined.includes('soundbar') || combined.includes('speaker'))
            return 'Audio';
        if (combined.includes('receiver') || combined.includes('amplifier'))
            return 'Audio';
        if (combined.includes('projector') || combined.includes('screen'))
            return 'Video';
        if (combined.includes('cable') || combined.includes('mount'))
            return 'Accessories';
        if (combined.includes('gaming') || combined.includes('console'))
            return 'Gaming';
        return 'General';
    }
}
exports.PlanetWorldMCPServer = PlanetWorldMCPServer;
exports.default = PlanetWorldMCPServer;
//# sourceMappingURL=index.js.map