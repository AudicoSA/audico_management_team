#!/usr/bin/env tsx
"use strict";
/**
 * Connoisseur Sync CLI
 * Usage: npm run sync -- [options]
 * Options:
 *   --dry-run: Preview changes without saving
 *   --limit=N: Limit to N products
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
require("dotenv/config");
var index_1 = require("./index");
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var args, options, limitArg, server, connected, result, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    args = process.argv.slice(2);
                    options = {
                        dryRun: args.includes('--dry-run'),
                        limit: undefined,
                        sessionName: 'manual',
                    };
                    limitArg = args.find(function (arg) { return arg.startsWith('--limit='); });
                    if (limitArg) {
                        options.limit = parseInt(limitArg.split('=')[1]);
                    }
                    console.log('🔄 Connoisseur Product Sync');
                    console.log('================================\n');
                    if (options.dryRun) {
                        console.log('⚠️  DRY RUN MODE - No changes will be saved\n');
                    }
                    console.log('Configuration:');
                    console.log("  Base URL: ".concat(process.env.CONNOISSEUR_BASE_URL || 'https://www.connoisseur.co.za'));
                    console.log("  Limit: ".concat(options.limit || 'All products'));
                    console.log("  Dry Run: ".concat(options.dryRun ? 'Yes' : 'No'));
                    console.log();
                    server = new index_1.ConnoisseurMCPServer();
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 4, , 5]);
                    console.log('🔌 Testing connection...');
                    return [4 /*yield*/, server.testConnection()];
                case 2:
                    connected = _a.sent();
                    if (!connected) {
                        console.error('❌ Connection test failed');
                        process.exit(1);
                    }
                    console.log('✅ Connection successful\n');
                    console.log('📦 Starting product sync...\n');
                    return [4 /*yield*/, server.syncProducts(options)];
                case 3:
                    result = _a.sent();
                    console.log('\n================================');
                    console.log('📊 SYNC SUMMARY');
                    console.log('================================');
                    console.log("Status: ".concat(result.success ? '✅ SUCCESS' : '❌ FAILED'));
                    console.log("Session ID: ".concat(result.session_id));
                    console.log("Duration: ".concat(result.duration_seconds, "s"));
                    console.log();
                    console.log('Results:');
                    console.log("  \u2705 Added: ".concat(result.products_added));
                    console.log("  \u267B\uFE0F  Updated: ".concat(result.products_updated));
                    console.log("  \u23ED\uFE0F  Unchanged: ".concat(result.products_unchanged));
                    console.log();
                    if (result.errors.length > 0) {
                        console.log("\u274C Errors (".concat(result.errors.length, "):"));
                        result.errors.slice(0, 5).forEach(function (err) { return console.log("   - ".concat(err)); });
                        if (result.errors.length > 5) {
                            console.log("   ... and ".concat(result.errors.length - 5, " more"));
                        }
                        console.log();
                    }
                    if (result.warnings.length > 0) {
                        console.log("\u26A0\uFE0F  Warnings (".concat(result.warnings.length, "):"));
                        result.warnings.slice(0, 5).forEach(function (warn) { return console.log("   - ".concat(warn)); });
                        if (result.warnings.length > 5) {
                            console.log("   ... and ".concat(result.warnings.length - 5, " more"));
                        }
                        console.log();
                    }
                    console.log('🎉 Sync complete!');
                    process.exit(result.success ? 0 : 1);
                    return [3 /*break*/, 5];
                case 4:
                    error_1 = _a.sent();
                    console.error('\n❌ Sync failed:', error_1.message);
                    console.error(error_1.stack);
                    process.exit(1);
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/];
            }
        });
    });
}
main().catch(function (error) {
    console.error('Fatal error:', error);
    process.exit(1);
});
