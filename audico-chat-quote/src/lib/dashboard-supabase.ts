import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Check if we're in a browser environment
const isBrowser = typeof window !== "undefined";

// Lazy initialization to prevent build-time crashes when env vars are not available
let _supabase: SupabaseClient | null = null

// No-op query builder for SSR - returns empty data
const noopQueryBuilder = {
    select: () => noopQueryBuilder,
    insert: () => noopQueryBuilder,
    update: () => noopQueryBuilder,
    delete: () => noopQueryBuilder,
    eq: () => noopQueryBuilder,
    neq: () => noopQueryBuilder,
    in: () => noopQueryBuilder,
    order: () => noopQueryBuilder,
    limit: () => noopQueryBuilder,
    single: () => noopQueryBuilder,
    maybeSingle: () => noopQueryBuilder,
    then: (resolve: any) => resolve({ data: null, error: null }),
};

export const supabase = {
    get instance(): SupabaseClient {
        if (!_supabase) {
            const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
            const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

            if (!supabaseUrl || !supabaseAnonKey) {
                throw new Error('Missing Supabase environment variables')
            }

            _supabase = createClient(supabaseUrl, supabaseAnonKey)
        }
        return _supabase
    },
    from: (table: string) => {
        if (!isBrowser) {
            // During SSR, return no-op to allow pre-rendering
            return noopQueryBuilder as any;
        }
        return supabase.instance.from(table);
    },
}

export type EmailLog = {
    id: string
    gmail_message_id: string
    from_email: string
    subject: string
    category: string
    status: string
    handled_by: string | null
    payload: any
    created_at: string
    updated_at: string
}

export interface Supplier {
    id: string
    name: string
    company: string
    street_address: string
    local_area: string
    city: string
    code: string
    country_code: string
    contact_name?: string
    contact_phone?: string
    contact_email?: string
    created_at?: string
}

export interface OrderTracker {
    order_no: string
    order_name: string | null
    supplier: string | null
    notes: string | null
    cost: number | null
    invoice_no: string | null
    order_paid: boolean | null
    supplier_amount: number | null
    supplier_invoice_no: string | null
    supplier_quote_no: string | null
    supplier_status: string | null
    supplier_invoice_url: string | null
    shipping: number | null
    profit: number | null
    updates: string | null
    owner_wade: boolean | null
    owner_lucky: boolean | null
    owner_kenny: boolean | null
    owner_accounts: boolean | null
    flag_done: boolean | null
    flag_urgent: boolean | null
    source: string | null
}

export type AgentLog = {
    id: string
    created_at: string
    agent: string
    level: string
    event_type: string
    context: any
}
