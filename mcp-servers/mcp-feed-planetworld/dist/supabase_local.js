"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PartalSupabaseService = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const shared_1 = require("@audico/shared");
class PartalSupabaseService {
    constructor(url, key) {
        const supabaseUrl = url || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
        const supabaseKey = key || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
        if (!supabaseUrl || !supabaseKey) {
            throw new Error('Supabase credentials missing');
        }
        this.client = (0, supabase_js_1.createClient)(supabaseUrl, supabaseKey, {
            auth: {
                persistSession: false
            }
        });
    }
    async getSupplierByName(name) {
        const { data, error } = await this.client
            .from('suppliers')
            .select('*')
            .eq('name', name)
            .single();
        if (error) {
            if (error.code === 'PGRST116')
                return null; // Not found
            shared_1.logger.error(`Error getting supplier ${name}: ${error.message}`);
            return null;
        }
        return data;
    }
    async updateSupplierStatus(id, status, errorMessage) {
        await this.client.from('suppliers').update({
            status,
            error_message: errorMessage,
            updated_at: new Date().toISOString()
        }).eq('id', id);
    }
    async updateSupplierLastSync(id) {
        await this.client.from('suppliers').update({
            last_sync: new Date().toISOString()
        }).eq('id', id);
    }
    async createSyncSession(supplierId, name) {
        // Explicitly using mcp_sync_sessions
        const { data, error } = await this.client.from('mcp_sync_sessions').insert({
            triggered_by: name,
            status: 'running',
            started_at: new Date().toISOString(),
            total_suppliers: 1,
            completed_suppliers: 0,
            failed_suppliers: 0
        }).select().single();
        if (error)
            throw error;
        return data.id;
    }
    async completeSyncSession(id, stats) {
        await this.client.from('mcp_sync_sessions').update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            completed_suppliers: 1,
            notes: JSON.stringify(stats)
        }).eq('id', id);
    }
    async failSyncSession(id, error) {
        await this.client.from('mcp_sync_sessions').update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            failed_suppliers: 1,
            notes: `Error: ${error.message || String(error)}`
        }).eq('id', id);
    }
    async upsertProduct(product) {
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
        if (error)
            throw error;
        return { isNew: !existing, id: data.id };
    }
    async getProductCount(supplierId) {
        const { count, error } = await this.client
            .from('products')
            .select('*', { count: 'exact', head: true })
            .eq('supplier_id', supplierId);
        if (error)
            throw error;
        return count || 0;
    }
    async logCrash(params) {
        try {
            // Log to console for immediate visibility
            shared_1.logger.error(`💥 CRASH: ${params.supplierName} - ${params.errorType}: ${params.errorMessage}`);
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
                shared_1.logger.error(`Failed to log crash to database: ${error.message}`);
            }
        }
        catch (err) {
            // Defensive: never let crash logging itself crash
            shared_1.logger.error(`Crash logging failed: ${err}`);
        }
    }
}
exports.PartalSupabaseService = PartalSupabaseService;
