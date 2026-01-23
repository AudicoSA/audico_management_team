"use strict";
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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductAutoTagger = exports.createProductText = exports.generateEmbedding = exports.PricingCalculator = exports.logSync = exports.logger = exports.SupabaseService = void 0;
// Export all shared utilities
__exportStar(require("./types"), exports);
__exportStar(require("./supabase-client"), exports);
__exportStar(require("./logger"), exports);
__exportStar(require("./pricing"), exports);
__exportStar(require("./embedding"), exports);
__exportStar(require("./auto-tagger"), exports);
// Default exports
var supabase_client_1 = require("./supabase-client");
Object.defineProperty(exports, "SupabaseService", { enumerable: true, get: function () { return supabase_client_1.SupabaseService; } });
var logger_1 = require("./logger");
Object.defineProperty(exports, "logger", { enumerable: true, get: function () { return logger_1.logger; } });
Object.defineProperty(exports, "logSync", { enumerable: true, get: function () { return logger_1.logSync; } });
var pricing_1 = require("./pricing");
Object.defineProperty(exports, "PricingCalculator", { enumerable: true, get: function () { return pricing_1.PricingCalculator; } });
var embedding_1 = require("./embedding");
Object.defineProperty(exports, "generateEmbedding", { enumerable: true, get: function () { return embedding_1.generateEmbedding; } });
Object.defineProperty(exports, "createProductText", { enumerable: true, get: function () { return embedding_1.createProductText; } });
var auto_tagger_1 = require("./auto-tagger");
Object.defineProperty(exports, "ProductAutoTagger", { enumerable: true, get: function () { return auto_tagger_1.ProductAutoTagger; } });
