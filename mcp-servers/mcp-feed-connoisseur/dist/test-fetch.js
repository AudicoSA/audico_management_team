#!/usr/bin/env tsx
"use strict";
/**
 * Simple test to fetch Connoisseur products via Shopify JSON API
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
var axios_1 = require("axios");
var BASE_URL = 'https://www.connoisseur.co.za';
var API_ENDPOINT = '/collections/all/products.json';
var PAGE_LIMIT = 250;
function fetchProducts() {
    return __awaiter(this, void 0, void 0, function () {
        var allProducts, page, hasMore, client, url, response, products, _loop_1, _i, products_1, product, error_1;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    console.log('🧪 Connoisseur Product Fetch Test');
                    console.log('================================\n');
                    allProducts = [];
                    page = 1;
                    hasMore = true;
                    client = axios_1.default.create({
                        timeout: 30000,
                        headers: {
                            'User-Agent': 'AudicoResearchBot/1.0 (+contact: hello@audico.co.za)',
                            Accept: 'application/json',
                        },
                    });
                    console.log("\uD83D\uDCE1 Fetching from: ".concat(BASE_URL).concat(API_ENDPOINT, "\n"));
                    _b.label = 1;
                case 1:
                    if (!(hasMore && page <= 10)) return [3 /*break*/, 8];
                    _b.label = 2;
                case 2:
                    _b.trys.push([2, 6, , 7]);
                    url = "".concat(BASE_URL).concat(API_ENDPOINT, "?limit=").concat(PAGE_LIMIT, "&page=").concat(page);
                    console.log("\uD83D\uDCC4 Page ".concat(page, "..."));
                    return [4 /*yield*/, client.get(url)];
                case 3:
                    response = _b.sent();
                    products = ((_a = response.data) === null || _a === void 0 ? void 0 : _a.products) || [];
                    if (products.length === 0) {
                        console.log("   \u2713 Page ".concat(page, ": No products (stopping)"));
                        hasMore = false;
                        return [3 /*break*/, 8];
                    }
                    console.log("   \u2713 Page ".concat(page, ": ").concat(products.length, " products found"));
                    _loop_1 = function (product) {
                        if (!allProducts.some(function (p) { return p.id === product.id; })) {
                            allProducts.push(product);
                        }
                    };
                    for (_i = 0, products_1 = products; _i < products_1.length; _i++) {
                        product = products_1[_i];
                        _loop_1(product);
                    }
                    if (products.length < PAGE_LIMIT) {
                        console.log("   \u2139\uFE0F Fewer than ".concat(PAGE_LIMIT, " products - likely last page"));
                        hasMore = false;
                    }
                    page++;
                    if (!hasMore) return [3 /*break*/, 5];
                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 1000); })];
                case 4:
                    _b.sent();
                    _b.label = 5;
                case 5: return [3 /*break*/, 7];
                case 6:
                    error_1 = _b.sent();
                    console.error("   \u274C Error on page ".concat(page, ":"), error_1.message);
                    hasMore = false;
                    return [3 /*break*/, 7];
                case 7: return [3 /*break*/, 1];
                case 8:
                    console.log('\n================================');
                    console.log('📊 RESULTS');
                    console.log('================================');
                    console.log("Total Products: ".concat(allProducts.length));
                    console.log("Pages Fetched: ".concat(page - 1));
                    if (allProducts.length > 0) {
                        console.log('\n📦 Sample Products (first 5):');
                        allProducts.slice(0, 5).forEach(function (p, i) {
                            var variant = p.variants[0];
                            var price = parseFloat(variant.price);
                            var cost = price * 0.8;
                            console.log("\n".concat(i + 1, ". ").concat(p.title));
                            console.log("   SKU: ".concat(variant.sku || 'N/A'));
                            console.log("   Brand: ".concat(p.vendor));
                            console.log("   Retail Price: R ".concat(price.toFixed(2)));
                            console.log("   Cost Price: R ".concat(cost.toFixed(2), " (retail \u00D7 0.8)"));
                            console.log("   Available: ".concat(variant.available ? 'Yes' : 'No'));
                        });
                    }
                    console.log('\n✅ Fetch complete!');
                    return [2 /*return*/];
            }
        });
    });
}
fetchProducts().catch(function (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
});
