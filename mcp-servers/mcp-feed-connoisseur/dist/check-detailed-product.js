"use strict";
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
var client = axios_1.default.create({
    timeout: 30000,
    headers: {
        'User-Agent': 'AudicoResearchBot/1.0',
        Accept: 'application/json',
    },
});
function checkDetailedProduct() {
    return __awaiter(this, void 0, void 0, function () {
        var url, response, product, stockMatch, productUrl, productResponse, error_1;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    url = 'https://www.connoisseur.co.za/collections/all/products.json?limit=1';
                    return [4 /*yield*/, client.get(url)];
                case 1:
                    response = _b.sent();
                    product = response.data.products[0];
                    console.log('📦 Detailed Product Data:\n');
                    console.log('Product:', product.title);
                    console.log('SKU:', product.variants[0].sku);
                    console.log('\n=== All Variant Fields ===');
                    console.log(JSON.stringify(product.variants[0], null, 2));
                    console.log('\n=== All Product Fields ===');
                    console.log('Tags:', product.tags);
                    console.log('Body HTML length:', ((_a = product.body_html) === null || _a === void 0 ? void 0 : _a.length) || 0);
                    // Check if body_html contains stock info
                    if (product.body_html && product.body_html.includes('stock')) {
                        console.log('\n⚠️ Found "stock" in body_html:');
                        stockMatch = product.body_html.match(/stock[^<>]*?(\d+)/i);
                        if (stockMatch) {
                            console.log('Stock number found:', stockMatch[1]);
                        }
                    }
                    // Try to fetch individual product page JSON
                    console.log('\n=== Trying Individual Product JSON ===');
                    _b.label = 2;
                case 2:
                    _b.trys.push([2, 4, , 5]);
                    productUrl = "https://www.connoisseur.co.za/products/".concat(product.handle, ".json");
                    console.log('URL:', productUrl);
                    return [4 /*yield*/, client.get(productUrl)];
                case 3:
                    productResponse = _b.sent();
                    console.log('\nVariant inventory_quantity:', productResponse.data.product.variants[0].inventory_quantity);
                    console.log('Variant inventory_management:', productResponse.data.product.variants[0].inventory_management);
                    console.log('\nAll variant fields:');
                    console.log(JSON.stringify(productResponse.data.product.variants[0], null, 2));
                    return [3 /*break*/, 5];
                case 4:
                    error_1 = _b.sent();
                    console.log('Error fetching individual product:', error_1.message);
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/];
            }
        });
    });
}
checkDetailedProduct();
