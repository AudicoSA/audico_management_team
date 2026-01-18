import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { UnifiedProduct, Supplier } from '@audico/shared';
import { logger } from '@audico/shared';

export class PartalSupabaseService {
    private client: SupabaseClient;

    constructor(url?: string, key?: string) {
        const supabaseUrl = url || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
        const supabaseKey = key || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseKey) {
            throw new Error('Supabase credentials missing');
        }

        this.client = createClient(supabaseUrl, supabaseKey, {
            auth: {
                persistSession: false
            }
        });
    }

    async getSupplierByName(name: string): Promise<Supplier | null> {
        const { data, error } = await this.client
            .from('suppliers')
            .select('*')
            .eq('name', name)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null; // Not found
            logger.error(`Error getting supplier ${name}: ${error.message}`);
            return null;
        }
        return data;
    }

    async updateSupplierStatus(id: string, status: string, errorMessage?: string): Promise<void> {
        await this.client.from('suppliers').update({
            status,
            error_message: errorMessage,
            updated_at: new Date().toISOString()
        }).eq('id', id);
    }

    async updateSupplierLastSync(id: string): Promise<void> {
        await this.client.from('suppliers').update({
            last_sync: new Date().toISOString()
        }).eq('id', id);
    }

    async createSyncSession(supplierId: string, name: string): Promise<string> {
        // Explicitly using mcp_sync_sessions
        const { data, error } = await this.client.from('mcp_sync_sessions').insert({
            triggered_by: name,
            status: 'running',
            started_at: new Date().toISOString(),
            total_suppliers: 1,
            completed_suppliers: 0,
            failed_suppliers: 0
        }).select().single();

        if (error) throw error;
        return data.id;
    }

    async completeSyncSession(id: string, stats: any): Promise<void> {
        await this.client.from('mcp_sync_sessions').update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            completed_suppliers: 1,
            notes: JSON.stringify(stats)
        }).eq('id', id);
    }

    async failSyncSession(id: string, error: any): Promise<void> {
        await this.client.from('mcp_sync_sessions').update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            failed_suppliers: 1,
            notes: `Error: ${error.message || String(error)}`
        }).eq('id', id);
    }

    async upsertProduct(product: UnifiedProduct): Promise<{ isNew: boolean; id: string }> {
        const { data: existing } = await this.client
            .from('products')
            .select('id')
            .eq('supplier_id', product.supplier_id)
            .eq('supplier_sku', product.supplier_sku)
            .single();

        const { data, error } = await this.client
            .from('products')
            .upsert(product, { onConflict: 'supplier_id,supplier_sku' })
            .select()
            .single();

        if (error) throw error;
        return { isNew: !existing, id: data.id };
    }

    async getProductCount(supplierId: string): Promise<number> {
        const { count, error } = await this.client
            .from('products')
            .select('*', { count: 'exact', head: true })
            .eq('supplier_id', supplierId);

        if (error) throw error;
        return count || 0;
    }

    async logCrash(params: {
        supplierName: string;
        errorType: string;
        errorMessage: string;
        stackTrace?: string;
        context?: any;
    }): Promise<void> {
        try {
            // Log to console for immediate visibility
            logger.error(`💥 CRASH: ${params.supplierName} - ${params.errorType}: ${params.errorMessage}`);

            // Insert crash log into database
            const { error } = await this.client.from('mcp_crash_log').insert({
                supplier_name: params.supplierName,
                error_type: params.errorType,
                error_message: params.errorMessage,
                stack_trace: params.stackTrace,
                context: params.context
            });

            if (error) {
                // Don't throw - we don't want crash logging to crash the app
                logger.error(`Failed to log crash to database: ${error.message}`);
            }
        } catch (err) {
            // Defensive: never let crash logging itself crash
            logger.error(`Crash logging failed: ${err}`);
        }
    }
}
