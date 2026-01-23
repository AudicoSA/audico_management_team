"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupabaseService = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
class SupabaseService {
    constructor(supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '', supabaseKey = process.env.SUPABASE_SERVICE_KEY || '') {
        if (!supabaseUrl || !supabaseKey) {
            throw new Error('Supabase credentials not provided');
        }
        this.client = (0, supabase_js_1.createClient)(supabaseUrl, supabaseKey, {
            auth: {
                persistSession: false,
            },
        });
    }
    // ============================================
    // SUPPLIER METHODS
    // ============================================
    async getSupplierByName(name) {
        const { data, error } = await this.client
            .from('suppliers')
            .select('*')
            .eq('name', name)
            .single();
        if (error) {
            console.error('Error fetching supplier:', error);
            return null;
        }
        return data;
    }
    async updateSupplierStatus(supplierId, status, errorMessage) {
        const { error } = await this.client
            .from('suppliers')
            .update({
            status,
            error_message: errorMessage || null,
            updated_at: new Date().toISOString(),
        })
            .eq('id', supplierId);
        if (error) {
            console.error('Error updating supplier status:', error);
        }
    }
    async updateSupplierLastSync(supplierId) {
        const { error } = await this.client
            .from('suppliers')
            .update({
            last_sync: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
            .eq('id', supplierId);
        if (error) {
            console.error('Error updating last sync:', error);
        }
    }
    // ============================================
    // SYNC SESSION METHODS
    // ============================================
    async createSyncSession(supplierId, triggeredBy = 'manual') {
        const { data, error } = await this.client
            .from('sync_sessions')
            .insert({
            supplier_id: supplierId,
            status: 'running',
            triggered_by: triggeredBy,
            started_at: new Date().toISOString(),
        })
            .select('id')
            .single();
        if (error) {
            throw new Error(`Failed to create sync session: ${error.message}`);
        }
        return data.id;
    }
    async updateSyncSession(sessionId, updates) {
        const { error } = await this.client
            .from('sync_sessions')
            .update(updates)
            .eq('id', sessionId);
        if (error) {
            console.error('Error updating sync session:', error);
        }
    }
    async completeSyncSession(sessionId, result) {
        const startTime = await this.getSyncSessionStartTime(sessionId);
        const duration = startTime
            ? Math.floor((Date.now() - startTime.getTime()) / 1000)
            : 0;
        await this.updateSyncSession(sessionId, {
            status: 'completed',
            completed_at: new Date(),
            duration_seconds: duration,
            products_added: result.products_added,
            products_updated: result.products_updated,
            products_unchanged: result.products_unchanged,
            errors: result.errors || [],
            warnings: result.warnings || [],
        });
    }
    async failSyncSession(sessionId, error) {
        const startTime = await this.getSyncSessionStartTime(sessionId);
        const duration = startTime
            ? Math.floor((Date.now() - startTime.getTime()) / 1000)
            : 0;
        await this.updateSyncSession(sessionId, {
            status: 'failed',
            completed_at: new Date(),
            duration_seconds: duration,
            errors: [
                {
                    message: error.message || String(error),
                    timestamp: new Date().toISOString(),
                },
            ],
        });
    }
    async getSyncSessionStartTime(sessionId) {
        const { data, error } = await this.client
            .from('sync_sessions')
            .select('started_at')
            .eq('id', sessionId)
            .single();
        if (error || !data)
            return null;
        return new Date(data.started_at);
    }
    // ============================================
    // PRODUCT METHODS
    // ============================================
    async upsertProduct(product) {
        const { data, error } = await this.client
            .from('products')
            .upsert({
            ...product,
            last_updated: new Date().toISOString(),
        }, {
            onConflict: 'supplier_id, supplier_sku',
            ignoreDuplicates: false
        })
            .select()
            .single();
        if (error) {
            throw new Error(`Failed to upsert product: ${error.message}`);
        }
        // Heuristic for isNew: if created_at is very close to last_updated (within 2 seconds)
        // Note: This assumes created_at is set by DB default on insert.
        // If we passed created_at, this logic might be flawed, but acceptable for stats.
        let isNew = false;
        if (data.created_at && data.last_updated) {
            const created = new Date(data.created_at).getTime();
            const updated = new Date(data.last_updated).getTime();
            isNew = Math.abs(updated - created) < 2000;
        }
        return { id: data.id, isNew };
    }
    async findExistingProduct(supplierId, supplierSku) {
        if (!supplierSku)
            return null;
        const { data, error } = await this.client
            .from('products')
            .select('id')
            .eq('supplier_id', supplierId)
            .eq('supplier_sku', supplierSku)
            .single();
        if (error || !data)
            return null;
        return data;
    }
    async getProductCount(supplierId) {
        const { count, error } = await this.client
            .from('products')
            .select('*', { count: 'exact', head: true })
            .eq('supplier_id', supplierId)
            .eq('active', true);
        if (error) {
            console.error('Error getting product count:', error);
            return 0;
        }
        return count || 0;
    }
    async deactivateOldProducts(supplierId, activeSkus) {
        const { data, error } = await this.client
            .from('products')
            .update({ active: false })
            .eq('supplier_id', supplierId)
            .not('supplier_sku', 'in', `(${activeSkus.join(',')})`)
            .select('id');
        if (error) {
            console.error('Error deactivating products:', error);
            return 0;
        }
        return (data === null || data === void 0 ? void 0 : data.length) || 0;
    }
    // ============================================
    // SEARCH METHODS
    // ============================================
    async searchProducts(query, limit = 20) {
        const { data, error } = await this.client.rpc('search_products', {
            query_text: query,
            match_count: limit,
        });
        if (error) {
            console.error('Error searching products:', error);
            return [];
        }
        return data || [];
    }
    // ============================================
    // UTILITY METHODS
    // ============================================
    getClient() {
        return this.client;
    }
}
exports.SupabaseService = SupabaseService;
exports.default = SupabaseService;
