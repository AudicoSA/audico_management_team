/**
 * Pro Audio MCP Server
 * WordPress REST API + Playwright browser scraping fallback
 */
import 'dotenv/config';
import { MCPSupplierTool, SyncOptions, SyncResult, SupplierStatus, Supplier } from '@audico/shared';
export declare class ProAudioMCPServer implements MCPSupplierTool {
    private supabase;
    private supplier;
    private client;
    private config;
    constructor(supabaseUrl?: string, supabaseKey?: string);
    testConnection(): Promise<boolean>;
    syncProducts(options?: SyncOptions): Promise<SyncResult>;
    getStatus(): Promise<SupplierStatus>;
    getSupplierInfo(): Promise<Supplier>;
    private scrapeProductDetails;
    private transformToUnified;
}
export default ProAudioMCPServer;
//# sourceMappingURL=index.d.ts.map