import { SupabaseClient } from '@supabase/supabase-js';
import { UnifiedProduct, SyncSession, Supplier } from './types';
export declare class SupabaseService {
    private client;
    constructor(supabaseUrl?: string, supabaseKey?: string);
    getSupplierByName(name: string): Promise<Supplier | null>;
    updateSupplierStatus(supplierId: string, status: 'idle' | 'running' | 'error', errorMessage?: string): Promise<void>;
    updateSupplierLastSync(supplierId: string): Promise<void>;
    createSyncSession(supplierId: string, triggeredBy?: string): Promise<string>;
    updateSyncSession(sessionId: string, updates: Partial<SyncSession>): Promise<void>;
    completeSyncSession(sessionId: string, result: {
        products_added: number;
        products_updated: number;
        products_unchanged: number;
        errors?: any[];
        warnings?: any[];
    }): Promise<void>;
    failSyncSession(sessionId: string, error: any): Promise<void>;
    private getSyncSessionStartTime;
    upsertProduct(product: UnifiedProduct): Promise<{
        id: string;
        isNew: boolean;
    }>;
    findExistingProduct(supplierId: string, supplierSku: string): Promise<{
        id: string;
    } | null>;
    getProductCount(supplierId: string): Promise<number>;
    deactivateOldProducts(supplierId: string, activeSkus: string[]): Promise<number>;
    searchProducts(query: string, limit?: number): Promise<any[]>;
    getClient(): SupabaseClient;
}
export default SupabaseService;
