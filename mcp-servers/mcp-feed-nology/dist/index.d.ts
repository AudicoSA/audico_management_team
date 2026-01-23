/**
 * Nology MCP Server
 * Extracts the gold from linkqage-ecommerce/lib/nology-service.ts
 * and transforms it to use the unified schema
 */
import { MCPSupplierTool, SyncOptions, SyncResult, SupplierStatus, Supplier } from '@audico/shared';
export declare class NologyMCPServer implements MCPSupplierTool {
    private supabase;
    private supplier;
    private config;
    constructor(supabaseUrl?: string, supabaseKey?: string);
    testConnection(): Promise<boolean>;
    syncProducts(options?: SyncOptions): Promise<SyncResult>;
    getStatus(): Promise<SupplierStatus>;
    getSupplierInfo(): Promise<Supplier>;
    private fetchProducts;
    private transformToUnified;
    private extractCategory;
    private extractBrand;
}
export default NologyMCPServer;
