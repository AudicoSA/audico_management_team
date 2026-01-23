/**
 * Stock2Shop (Linkqage) MCP Server
 * Official Stock2Shop API integration with Elasticsearch
 */
import 'dotenv/config';
import { MCPSupplierTool, SyncOptions, SyncResult, SupplierStatus, Supplier } from '@audico/shared';
export declare class Stock2ShopMCPServer implements MCPSupplierTool {
    private supabase;
    private supplier;
    private client;
    private token;
    private lastRequest;
    private config;
    constructor(supabaseUrl?: string, supabaseKey?: string);
    testConnection(): Promise<boolean>;
    syncProducts(options?: SyncOptions): Promise<SyncResult>;
    getStatus(): Promise<SupplierStatus>;
    getSupplierInfo(): Promise<Supplier>;
    private authenticate;
    private rateLimitDelay;
    private searchProducts;
    private transformToUnified;
    private extractBrand;
    private extractCategory;
}
export default Stock2ShopMCPServer;
