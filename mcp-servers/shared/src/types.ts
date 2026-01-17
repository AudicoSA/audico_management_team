export interface SyncOptions {
    limit?: number;
    dryRun?: boolean;
    sessionName?: string;
    force?: boolean;
}

export interface SyncResult {
    success: boolean;
    session_id: string;
    products_added: number;
    products_updated: number;
    products_unchanged: number;
    errors: string[];
    warnings: string[];
    duration_seconds: number;
}

export interface SupplierStatus {
    supplier_name: string;
    last_sync?: Date;
    total_products: number;
    status: 'idle' | 'running' | 'error' | 'success';
    error_message?: string;
}

export interface Supplier {
    id: string;
    name: string;
    description?: string;
    url?: string;
    status?: string;
    last_sync?: string;
    error_message?: string;
    config?: any;
    type?: string;
    active?: boolean;
}

export interface UnifiedProduct {
    product_name: string;
    sku: string;
    model?: string;
    brand: string;
    category_name: string;
    description?: string;

    cost_price: number;
    retail_price: number;
    selling_price: number;
    margin_percentage: number;

    total_stock: number;
    stock_jhb?: number;
    stock_cpt?: number;
    stock_dbn?: number;

    images: string[];
    specifications?: any;

    supplier_id: string;
    supplier_sku: string;

    active: boolean;
}

export interface MCPSupplierTool {
    testConnection(): Promise<boolean>;
    syncProducts(options?: SyncOptions): Promise<SyncResult>;
    getStatus(): Promise<SupplierStatus>;
    getSupplierInfo(): Promise<Supplier>;
}

export class PricingCalculator {
    static calculate(cost: number, markup: number): number {
        return cost * (1 + markup / 100);
    }
}
