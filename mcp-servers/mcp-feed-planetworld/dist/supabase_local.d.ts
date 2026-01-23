import { UnifiedProduct, Supplier } from '@audico/shared';
export declare class PartalSupabaseService {
    private client;
    constructor(url?: string, key?: string);
    getSupplierByName(name: string): Promise<Supplier | null>;
    updateSupplierStatus(id: string, status: string, errorMessage?: string): Promise<void>;
    updateSupplierLastSync(id: string): Promise<void>;
    createSyncSession(supplierId: string, name: string): Promise<string>;
    completeSyncSession(id: string, stats: any): Promise<void>;
    failSyncSession(id: string, error: any): Promise<void>;
    upsertProduct(product: UnifiedProduct): Promise<{
        isNew: boolean;
        id: string;
    }>;
    getProductCount(supplierId: string): Promise<number>;
    logCrash(params: {
        supplierName: string;
        errorType: string;
        errorMessage: string;
        stackTrace?: string;
        context?: any;
    }): Promise<void>;
}
