/**
 * Planet World MCP Server
 * Playwright-based web scraping with JavaScript extraction
 */
import 'dotenv/config';
import { MCPSupplierTool, SyncOptions, SyncResult, SupplierStatus, Supplier } from '@audico/shared';
export declare class PlanetWorldMCPServer implements MCPSupplierTool {
    private supabase;
    private supplier;
    private config;
    constructor(supabaseUrl?: string, supabaseKey?: string);
    testConnection(): Promise<boolean>;
    syncProducts(options?: SyncOptions): Promise<SyncResult>;
    getStatus(): Promise<SupplierStatus>;
    getSupplierInfo(): Promise<Supplier>;
    private sleep;
    private dismissPopups;
    private collectProductLinks;
    private capturePricingStock;
    private scrapeProductDetails;
    private transformToUnified;
    private extractBrand;
    private extractCategory;
}
export default PlanetWorldMCPServer;
