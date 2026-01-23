"use strict";
/**
 * Connoisseur MCP Server
 * Shopify JSON feed integration with continuous pagination
 * Pricing: Retail price from Shopify, Cost = Retail * 0.8 (less 20%)
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConnoisseurMCPServer = void 0;
require("dotenv/config");
var axios_1 = require("axios");
var shared_1 = require("@audico/shared");
// ============================================
// CONNOISSEUR MCP SERVER
// ============================================
var ConnoisseurMCPServer = /** @class */ (function () {
    function ConnoisseurMCPServer(supabaseUrl, supabaseKey) {
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
    ConnoisseurMCPServer.prototype.testConnection = function () {
        return __awaiter(this, void 0, void 0, function () {
            var url, response, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        shared_1.logger.info('🔌 Testing Connoisseur API connection...');
                        url = "".concat(this.config.baseUrl, "/collections/").concat(this.config.collections[0], "/products.json?limit=1");
                        return [4 /*yield*/, this.client.get(url)];
                    case 1:
                        response = _a.sent();
                        if (response.data && response.data.products && response.data.products.length > 0) {
                            shared_1.logger.info("\u2705 Connoisseur API connection successful - products available");
                            return [2 /*return*/, true];
                        }
                        shared_1.logger.error('❌ Connoisseur API returned invalid data');
                        return [2 /*return*/, false];
                    case 2:
                        error_1 = _a.sent();
                        shared_1.logger.error("\u274C Connoisseur API connection failed: ".concat(error_1.message));
                        return [2 /*return*/, false];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    ConnoisseurMCPServer.prototype.syncProducts = function (options) {
        return __awaiter(this, void 0, void 0, function () {
            var startTime, sessionId, _a, allProducts, productsAdded, productsUpdated, productsUnchanged, errors, warnings, i, rawProduct, unifiedProduct, result, error_2, errorMsg, durationSeconds, error_3, durationSeconds;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        startTime = Date.now();
                        sessionId = '';
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 15, , 19]);
                        // Get supplier record
                        _a = this;
                        return [4 /*yield*/, this.supabase.getSupplierByName('Connoisseur')];
                    case 2:
                        // Get supplier record
                        _a.supplier = _b.sent();
                        if (!this.supplier) {
                            throw new Error('Connoisseur supplier not found in database');
                        }
                        // Update supplier status
                        return [4 /*yield*/, this.supabase.updateSupplierStatus(this.supplier.id, 'running')];
                    case 3:
                        // Update supplier status
                        _b.sent();
                        return [4 /*yield*/, this.supabase.createSyncSession(this.supplier.id, (options === null || options === void 0 ? void 0 : options.sessionName) || 'manual')];
                    case 4:
                        // Create sync session
                        sessionId = _b.sent();
                        shared_1.logSync.start('Connoisseur', sessionId);
                        // Fetch all products with pagination
                        shared_1.logger.info('📡 Fetching Connoisseur products with pagination...');
                        return [4 /*yield*/, this.fetchAllProducts(options === null || options === void 0 ? void 0 : options.limit)];
                    case 5:
                        allProducts = _b.sent();
                        shared_1.logger.info("\uD83D\uDCE6 Retrieved ".concat(allProducts.length, " products from Connoisseur"));
                        productsAdded = 0;
                        productsUpdated = 0;
                        productsUnchanged = 0;
                        errors = [];
                        warnings = [];
                        i = 0;
                        _b.label = 6;
                    case 6:
                        if (!(i < allProducts.length)) return [3 /*break*/, 11];
                        rawProduct = allProducts[i];
                        _b.label = 7;
                    case 7:
                        _b.trys.push([7, 9, , 10]);
                        if (i % 50 === 0) {
                            shared_1.logSync.progress('Connoisseur', i, allProducts.length);
                        }
                        unifiedProduct = this.transformToUnified(rawProduct);
                        if (options === null || options === void 0 ? void 0 : options.dryRun) {
                            shared_1.logger.info("[DRY RUN] Would upsert: ".concat(unifiedProduct.product_name));
                            return [3 /*break*/, 10];
                        }
                        return [4 /*yield*/, this.supabase.upsertProduct(unifiedProduct)];
                    case 8:
                        result = _b.sent();
                        if (result.isNew) {
                            productsAdded++;
                        }
                        else {
                            productsUpdated++;
                        }
                        return [3 /*break*/, 10];
                    case 9:
                        error_2 = _b.sent();
                        errorMsg = "Failed to process ".concat(rawProduct.id, ": ").concat(error_2.message);
                        errors.push(errorMsg);
                        shared_1.logger.error(errorMsg);
                        return [3 /*break*/, 10];
                    case 10:
                        i++;
                        return [3 /*break*/, 6];
                    case 11:
                        durationSeconds = Math.floor((Date.now() - startTime) / 1000);
                        // Complete sync session
                        return [4 /*yield*/, this.supabase.completeSyncSession(sessionId, {
                                products_added: productsAdded,
                                products_updated: productsUpdated,
                                products_unchanged: productsUnchanged,
                                errors: errors,
                                warnings: warnings,
                            })];
                    case 12:
                        // Complete sync session
                        _b.sent();
                        // Update supplier
                        return [4 /*yield*/, this.supabase.updateSupplierStatus(this.supplier.id, 'idle')];
                    case 13:
                        // Update supplier
                        _b.sent();
                        return [4 /*yield*/, this.supabase.updateSupplierLastSync(this.supplier.id)];
                    case 14:
                        _b.sent();
                        shared_1.logSync.complete('Connoisseur', sessionId, {
                            added: productsAdded,
                            updated: productsUpdated,
                            duration: durationSeconds,
                        });
                        return [2 /*return*/, {
                                success: true,
                                session_id: sessionId,
                                products_added: productsAdded,
                                products_updated: productsUpdated,
                                products_unchanged: productsUnchanged,
                                errors: errors,
                                warnings: warnings,
                                duration_seconds: durationSeconds,
                            }];
                    case 15:
                        error_3 = _b.sent();
                        shared_1.logger.error("\u274C Connoisseur sync failed: ".concat(error_3.message));
                        if (!(sessionId && this.supplier)) return [3 /*break*/, 18];
                        return [4 /*yield*/, this.supabase.failSyncSession(sessionId, error_3)];
                    case 16:
                        _b.sent();
                        return [4 /*yield*/, this.supabase.updateSupplierStatus(this.supplier.id, 'error', error_3.message)];
                    case 17:
                        _b.sent();
                        _b.label = 18;
                    case 18:
                        durationSeconds = Math.floor((Date.now() - startTime) / 1000);
                        return [2 /*return*/, {
                                success: false,
                                session_id: sessionId,
                                products_added: 0,
                                products_updated: 0,
                                products_unchanged: 0,
                                errors: [error_3.message],
                                warnings: [],
                                duration_seconds: durationSeconds,
                            }];
                    case 19: return [2 /*return*/];
                }
            });
        });
    };
    ConnoisseurMCPServer.prototype.getStatus = function () {
        return __awaiter(this, void 0, void 0, function () {
            var supplier, totalProducts;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.supabase.getSupplierByName('Connoisseur')];
                    case 1:
                        supplier = _a.sent();
                        if (!supplier) {
                            return [2 /*return*/, {
                                    supplier_name: 'Connoisseur',
                                    total_products: 0,
                                    status: 'error',
                                    error_message: 'Supplier not found in database',
                                }];
                        }
                        return [4 /*yield*/, this.supabase.getProductCount(supplier.id)];
                    case 2:
                        totalProducts = _a.sent();
                        return [2 /*return*/, {
                                supplier_name: supplier.name,
                                last_sync: supplier.last_sync ? new Date(supplier.last_sync) : undefined,
                                total_products: totalProducts,
                                status: supplier.status,
                                error_message: supplier.error_message || undefined,
                            }];
                }
            });
        });
    };
    ConnoisseurMCPServer.prototype.getSupplierInfo = function () {
        return __awaiter(this, void 0, void 0, function () {
            var supplier;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.supabase.getSupplierByName('Connoisseur')];
                    case 1:
                        supplier = _a.sent();
                        if (!supplier) {
                            throw new Error('Connoisseur supplier not found');
                        }
                        return [2 /*return*/, supplier];
                }
            });
        });
    };
    // ============================================
    // CONNOISSEUR-SPECIFIC METHODS
    // ============================================
    ConnoisseurMCPServer.prototype.fetchAllProducts = function (limit) {
        return __awaiter(this, void 0, void 0, function () {
            var allProducts, _i, _a, collection, page, hasMoreProducts, lastProductId, products, newProductsCount, _loop_1, _b, products_1, product, error_4;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        allProducts = [];
                        shared_1.logger.info('🔄 Starting multi-collection fetch...');
                        shared_1.logger.info("\uD83D\uDCDA Collections to fetch: ".concat(this.config.collections.join(', ')));
                        _i = 0, _a = this.config.collections;
                        _c.label = 1;
                    case 1:
                        if (!(_i < _a.length)) return [3 /*break*/, 11];
                        collection = _a[_i];
                        shared_1.logger.info("\n\uD83D\uDCC2 Fetching collection: ".concat(collection));
                        page = 1;
                        hasMoreProducts = true;
                        lastProductId = null;
                        _c.label = 2;
                    case 2:
                        if (!(hasMoreProducts && (!limit || allProducts.length < limit))) return [3 /*break*/, 9];
                        _c.label = 3;
                    case 3:
                        _c.trys.push([3, 7, , 8]);
                        shared_1.logger.info("\uD83D\uDCC4 Fetching ".concat(collection, " page ").concat(page, "..."));
                        return [4 /*yield*/, this.fetchProductPage(collection, page, lastProductId)];
                    case 4:
                        products = _c.sent();
                        if (products.length === 0) {
                            shared_1.logger.info("\uD83D\uDCC4 Page ".concat(page, " returned 0 products - collection complete"));
                            hasMoreProducts = false;
                            return [3 /*break*/, 9];
                        }
                        newProductsCount = 0;
                        _loop_1 = function (product) {
                            var exists = allProducts.some(function (p) { return p.id === product.id; });
                            if (!exists) {
                                allProducts.push(product);
                                newProductsCount++;
                                lastProductId = String(product.id);
                            }
                        };
                        for (_b = 0, products_1 = products; _b < products_1.length; _b++) {
                            product = products_1[_b];
                            _loop_1(product);
                        }
                        shared_1.logger.info("\uD83D\uDCE6 ".concat(collection, " page ").concat(page, ": Found ").concat(products.length, " products, ").concat(newProductsCount, " new, ").concat(allProducts.length, " total"));
                        if (newProductsCount === 0) {
                            shared_1.logger.info("\uD83D\uDED1 No new products found on page ".concat(page, " - stopping collection"));
                            hasMoreProducts = false;
                        }
                        else if (products.length < this.config.pageLimit) {
                            shared_1.logger.info("\uD83C\uDFC1 Page ".concat(page, " returned fewer than ").concat(this.config.pageLimit, " products - likely final page"));
                            hasMoreProducts = false;
                        }
                        page++;
                        // Safety limit per collection
                        if (page > 100) {
                            shared_1.logger.info('⚠️ Safety limit reached (100 pages) - stopping collection');
                            hasMoreProducts = false;
                        }
                        if (!hasMoreProducts) return [3 /*break*/, 6];
                        return [4 /*yield*/, this.delay(1000)];
                    case 5:
                        _c.sent();
                        _c.label = 6;
                    case 6: return [3 /*break*/, 8];
                    case 7:
                        error_4 = _c.sent();
                        shared_1.logger.error("\u274C Error fetching ".concat(collection, " page ").concat(page, ": ").concat(error_4.message));
                        hasMoreProducts = false;
                        return [3 /*break*/, 8];
                    case 8: return [3 /*break*/, 2];
                    case 9:
                        shared_1.logger.info("\u2705 Collection '".concat(collection, "' complete"));
                        _c.label = 10;
                    case 10:
                        _i++;
                        return [3 /*break*/, 1];
                    case 11:
                        shared_1.logger.info("\n\u2705 All collections fetched: ".concat(allProducts.length, " total products"));
                        // Apply limit if specified
                        if (limit && allProducts.length > limit) {
                            return [2 /*return*/, allProducts.slice(0, limit)];
                        }
                        return [2 /*return*/, allProducts];
                }
            });
        });
    };
    ConnoisseurMCPServer.prototype.fetchProductPage = function (collection, page, lastProductId) {
        return __awaiter(this, void 0, void 0, function () {
            var apiEndpoint, url, response, error_5, url, response, error_6;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        apiEndpoint = "/collections/".concat(collection, "/products.json");
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        url = "".concat(this.config.baseUrl).concat(apiEndpoint, "?limit=").concat(this.config.pageLimit, "&page=").concat(page);
                        return [4 /*yield*/, this.client.get(url)];
                    case 2:
                        response = _a.sent();
                        if (response.data && response.data.products && response.data.products.length > 0) {
                            return [2 /*return*/, response.data.products];
                        }
                        return [3 /*break*/, 4];
                    case 3:
                        error_5 = _a.sent();
                        shared_1.logger.info("\uD83D\uDCC4 Page-based pagination failed for ".concat(collection, " page ").concat(page));
                        return [3 /*break*/, 4];
                    case 4:
                        if (!(lastProductId && page > 1)) return [3 /*break*/, 8];
                        _a.label = 5;
                    case 5:
                        _a.trys.push([5, 7, , 8]);
                        url = "".concat(this.config.baseUrl).concat(apiEndpoint, "?limit=").concat(this.config.pageLimit, "&since_id=").concat(lastProductId);
                        return [4 /*yield*/, this.client.get(url)];
                    case 6:
                        response = _a.sent();
                        if (response.data && response.data.products && response.data.products.length > 0) {
                            return [2 /*return*/, response.data.products];
                        }
                        return [3 /*break*/, 8];
                    case 7:
                        error_6 = _a.sent();
                        shared_1.logger.info("\uD83D\uDCC4 Cursor-based pagination failed for ".concat(collection, " since_id ").concat(lastProductId));
                        return [3 /*break*/, 8];
                    case 8: return [2 /*return*/, []];
                }
            });
        });
    };
    ConnoisseurMCPServer.prototype.delay = function (ms) {
        return new Promise(function (resolve) { return setTimeout(resolve, ms); });
    };
    ConnoisseurMCPServer.prototype.transformToUnified = function (conProduct) {
        var mainVariant = conProduct.variants[0];
        var mainImage = conProduct.images[0];
        // Parse retail price from Shopify
        var retailPrice = parseFloat(mainVariant.price) || 0;
        // Calculate cost price (retail less 20%)
        var costPrice = retailPrice * 0.8;
        // Selling price is same as retail price
        var sellingPrice = retailPrice;
        // Calculate margin percentage
        var marginPercentage = costPrice > 0 ? ((sellingPrice - costPrice) / costPrice) * 100 : 0;
        // Extract category
        var category_name = this.mapProductType(conProduct.product_type);
        // Parse HTML description
        var description = this.parseHtmlDescription(conProduct.body_html);
        // Extract SKU from product (e.g., CON000859)
        var sku = mainVariant.sku || "con-".concat(conProduct.id);
        return {
            product_name: conProduct.title,
            sku: sku,
            model: conProduct.handle,
            brand: conProduct.vendor || 'Connoisseur',
            category_name: category_name,
            description: description,
            cost_price: costPrice,
            retail_price: retailPrice,
            selling_price: sellingPrice,
            margin_percentage: parseFloat(marginPercentage.toFixed(2)),
            total_stock: mainVariant.available ? 10 : 0,
            stock_jhb: mainVariant.available ? 10 : 0,
            stock_cpt: 0,
            stock_dbn: 0,
            images: conProduct.images.map(function (img) { return img.src; }),
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
        };
    };
    ConnoisseurMCPServer.prototype.parseHtmlDescription = function (html) {
        if (!html)
            return 'Premium audio and home entertainment product from Connoisseur.';
        // Remove HTML tags and clean up
        var text = html
            .replace(/<[^>]*>/g, ' ')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/\s+/g, ' ')
            .trim();
        // Limit length
        if (text.length < 50) {
            text = "".concat(text, " Premium audio and home entertainment product from Connoisseur.");
        }
        return text.substring(0, 500) + (text.length > 500 ? '...' : '');
    };
    ConnoisseurMCPServer.prototype.mapProductType = function (productType) {
        var typeMap = {
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
    };
    return ConnoisseurMCPServer;
}());
exports.ConnoisseurMCPServer = ConnoisseurMCPServer;
exports.default = ConnoisseurMCPServer;
