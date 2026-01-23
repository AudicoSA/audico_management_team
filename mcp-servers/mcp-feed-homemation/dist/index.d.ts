/**
 * Homemation MCP Server
 * Playwright browser scraping for category pages with direct product listings
 * Based on GPT scraping recommendations
 */
import 'dotenv/config';
import { MCPSupplierTool, SyncOptions, SyncResult, SupplierStatus, Supplier } from '@audico/shared';
export declare class HomemationMCPServer implements MCPSupplierTool {
    private supabase;
    private supplier;
    private config;
    constructor(supabaseUrl?: string, supabaseKey?: string);
    testConnection(): Promise<boolean>;
    syncProducts(options?: SyncOptions): Promise<SyncResult>;
    getStatus(): Promise<SupplierStatus>;
    getSupplierInfo(): Promise<Supplier>;
    private scrapeCategory;
    private transformToUnified;
}
export default HomemationMCPServer;
//# sourceMappingURL=index.d.ts.map