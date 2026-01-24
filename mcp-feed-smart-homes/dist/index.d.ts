/**
 * Smart Homes MCP Server
 * Shopify JSON feed integration (similar to Solution Technologies)
 */
import 'dotenv/config';
import { MCPSupplierTool, SyncOptions, SyncResult, SupplierStatus, Supplier } from '@audico/shared';
export declare class SmartHomesMCPServer implements MCPSupplierTool {
    private supabase;
    private supplier;
    private client;
    private config;
    constructor(supabaseUrl?: string, supabaseKey?: string);
    testConnection(): Promise<boolean>;
    syncProducts(options?: SyncOptions): Promise<SyncResult>;
    getStatus(): Promise<SupplierStatus>;
    getSupplierInfo(): Promise<Supplier>;
    private fetchAllProducts;
    private transformToUnified;
}
export default SmartHomesMCPServer;
//# sourceMappingURL=index.d.ts.map