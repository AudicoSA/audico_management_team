import { SyncResult, SupplierStatus, Supplier, SyncOptions } from "@audico/shared";
export declare class ProAudioMCPServer {
    private server;
    private readonly SUPPLIER_NAME;
    private readonly SUPPLIER_ID;
    private readonly API_BASE;
    private readonly USER_AGENT;
    private readonly DISCOUNT_PERCENT;
    constructor();
    /**
     * Round to nearest R10. E.g., R1289 -> R1290, R13462.55 -> R13460
     */
    private roundToNearest10;
    /**
     * Apply discount and round to nearest R10.
     */
    private applyDiscountAndRound;
    private setupTools;
    testConnection(): Promise<boolean>;
    getStatus(): Promise<SupplierStatus>;
    getSupplierInfo(): Promise<Supplier>;
    syncProducts(options?: SyncOptions): Promise<SyncResult>;
    private fetchAllProducts;
    private transformProduct;
    start(): Promise<void>;
}
