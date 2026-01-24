/**
 * Connoisseur MCP Server
 * Shopify JSON feed integration with continuous pagination
 * Pricing: Retail price from Shopify, Cost = Retail * 0.8 (less 20%)
 */
import 'dotenv/config';
import { MCPSupplierTool, SyncOptions, SyncResult, SupplierStatus, Supplier } from '@audico/shared';
export declare class ConnoisseurMCPServer implements MCPSupplierTool {
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
    private fetchProductPage;
    private delay;
    private transformToUnified;
    private parseHtmlDescription;
    private mapProductType;
}
export default ConnoisseurMCPServer;
//# sourceMappingURL=index.d.ts.map