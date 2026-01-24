/**
 * Stage-One MCP Server
 * WordPress/WooCommerce integration with session-based authentication
 *
 * Stage-One uses a "login to see prices" plugin that hides prices from the REST API.
 * Solution: Authenticate via WordPress login, then scrape HTML category pages.
 */
import 'dotenv/config';
import { MCPSupplierTool, SyncOptions, SyncResult, SupplierStatus, Supplier } from '@audico/shared';
export declare class StageOneMCPServer implements MCPSupplierTool {
    private supabase;
    private supplier;
    private client;
    private cookieJar;
    private isAuthenticated;
    private config;
    constructor(supabaseUrl?: string, supabaseKey?: string);
    private extractNonce;
    private authenticate;
    private parsePrice;
    private scrapeCategoryPage;
    private scrapeProductDetails;
    private scrapeAllProducts;
    testConnection(): Promise<boolean>;
    syncProducts(options?: SyncOptions): Promise<SyncResult>;
    getStatus(): Promise<SupplierStatus>;
    getSupplierInfo(): Promise<Supplier>;
    private transformToUnified;
    private slugToSku;
    private extractBrand;
}
export default StageOneMCPServer;
//# sourceMappingURL=index.d.ts.map