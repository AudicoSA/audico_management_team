/**
 * Esquire MCP Server
 * Shopify XML feed integration
 */
import 'dotenv/config';
import { MCPSupplierTool, SyncOptions, SyncResult, SupplierStatus, Supplier } from '@audico/shared';
export declare class EsquireMCPServer implements MCPSupplierTool {
    private supabase;
    private supplier;
    private client;
    private config;
    constructor(supabaseUrl?: string, supabaseKey?: string);
    testConnection(): Promise<boolean>;
    syncProducts(options?: SyncOptions): Promise<SyncResult>;
    getStatus(): Promise<SupplierStatus>;
    getSupplierInfo(): Promise<Supplier>;
    private transformToUnified;
    private extractBrand;
    private extractCategory;
}
export default EsquireMCPServer;
