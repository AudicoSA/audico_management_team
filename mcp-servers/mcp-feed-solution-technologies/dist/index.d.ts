/**
 * Solution Technologies MCP Server
 * Shopify JSON feed integration with continuous pagination
 */
import 'dotenv/config';
import { MCPSupplierTool, SyncOptions, SyncResult, SupplierStatus, Supplier } from '@audico/shared';
export declare class SolutionTechnologiesMCPServer implements MCPSupplierTool {
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
export default SolutionTechnologiesMCPServer;
