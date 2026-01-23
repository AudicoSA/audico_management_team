/**
 * Google Merchant Feed MCP Server
 *
 * PURPOSE: Sync OpenCart Google Merchant Feed products to Supabase
 *
 * LOOP PREVENTION:
 * - Only syncs products that don't exist from real suppliers (Nology, Esquire, etc.)
 * - Checks supplier_id before upserting
 * - Uses "Manual Upload" supplier for OpenCart products
 *
 * USAGE:
 * - One-time migration: npm run migrate (imports all 7k+ products)
 * - Ongoing sync: npm run sync (catches new manual products)
 */
import 'dotenv/config';
import { MCPSupplierTool, SyncOptions, SyncResult, SupplierStatus, Supplier } from '@audico/shared';
export declare class GoogleMerchantFeedMCPServer implements MCPSupplierTool {
    private supabase;
    private supplier;
    private client;
    private realSupplierIds;
    private config;
    constructor(supabaseUrl?: string, supabaseKey?: string);
    testConnection(): Promise<boolean>;
    syncProducts(options?: SyncOptions): Promise<SyncResult>;
    getStatus(): Promise<SupplierStatus>;
    getSupplierInfo(): Promise<Supplier>;
    /**
     * Load all real supplier IDs to prevent syncing their products
     */
    private loadRealSupplierIds;
    /**
     * LOOP PREVENTION: Check if product should be skipped
     * Returns true if product exists from a real supplier
     */
    private shouldSkipProduct;
    /**
     * Fetch and parse Google Merchant Feed XML
     */
    private fetchAndParseFeed;
    /**
     * Transform Google Feed product to UnifiedProduct schema
     */
    private transformToUnified;
    /**
     * Extract brand from product title
     */
    private extractBrandFromTitle;
}
export default GoogleMerchantFeedMCPServer;
