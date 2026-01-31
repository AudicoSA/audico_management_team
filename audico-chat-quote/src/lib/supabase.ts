import { createClient } from "@supabase/supabase-js";

// Environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase environment variables. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY"
  );
}

/**
 * Supabase client for client-side use (browser)
 * Uses anon key with RLS
 */
export const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Supabase client for server-side use (API routes)
 * Uses service key to bypass RLS
 */
export function getSupabaseServer() {
  if (!supabaseServiceKey) {
    console.warn("SUPABASE_SERVICE_KEY not set, using anon key");
    return createClient(supabaseUrl, supabaseAnonKey);
  }
  return createClient(supabaseUrl, supabaseServiceKey);
}

/**
 * Database types for Supabase tables
 */
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          role: 'customer' | 'admin' | 'specialist' | 'super_admin';
          department: string | null;
          phone: string | null;
          avatar_url: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          role?: 'customer' | 'admin' | 'specialist' | 'super_admin';
          department?: string | null;
          phone?: string | null;
          avatar_url?: string | null;
          is_active?: boolean;
        };
        Update: {
          full_name?: string | null;
          role?: 'customer' | 'admin' | 'specialist' | 'super_admin';
          department?: string | null;
          phone?: string | null;
          avatar_url?: string | null;
          is_active?: boolean;
          updated_at?: string;
        };
      };
      products: {
        Row: {
          id: string;
          product_name: string;
          sku: string;
          model: string | null;
          brand: string | null;
          category_name: string | null;
          retail_price: number | null;
          cost_price: number | null;
          stock_jhb: number;
          stock_cpt: number;
          stock_dbn: number;
          images: string[] | null;
          specifications: Record<string, any> | null;
          supplier_id: string | null;
          active: boolean;
          use_case: string | null;
          mounting_type: string | null;
          embedding: number[] | null;
          created_at: string;
          updated_at: string;
        };
      };
      quotes: {
        Row: {
          id: string;
          session_id: string;
          flow_type: string;
          requirements: Record<string, any>;
          steps: Record<string, any>[];
          current_step_index: number;
          selected_products: Record<string, any>[];
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          flow_type: string;
          requirements: Record<string, any>;
          steps: Record<string, any>[];
          current_step_index?: number;
          selected_products?: Record<string, any>[];
          status?: string;
        };
        Update: {
          current_step_index?: number;
          selected_products?: Record<string, any>[];
          status?: string;
          steps?: Record<string, any>[];
          updated_at?: string;
        };
      };
      conversations: {
        Row: {
          id: string;
          chat_type: string;
          status: string;
          metadata: Record<string, any>;
          created_at: string;
          updated_at: string;
        };
      };
      chat_messages: {
        Row: {
          id: string;
          conversation_id: string;
          role: string;
          content: string;
          metadata: Record<string, any>;
          created_at: string;
        };
      };
      consultation_requests: {
        Row: {
          id: string;
          reference_code: string;
          session_id: string;
          created_at: string;
          updated_at: string;
          customer_name: string | null;
          customer_email: string;
          customer_phone: string | null;
          company_name: string | null;
          project_type: string;
          budget_total: number;
          timeline: string | null;
          zones: Record<string, any>[];
          requirements_summary: string;
          technical_notes: string | null;
          existing_equipment: string | null;
          complexity_score: number | null;
          zone_count: number | null;
          status: string;
          assigned_to: string | null;
          assigned_at: string | null;
          quote_id: string | null;
          notes: string | null;
          priority: string;
        };
        Insert: {
          id?: string;
          reference_code: string;
          session_id: string;
          customer_email: string;
          customer_name?: string | null;
          customer_phone?: string | null;
          company_name?: string | null;
          project_type: string;
          budget_total: number;
          timeline?: string | null;
          zones: Record<string, any>[];
          requirements_summary: string;
          technical_notes?: string | null;
          existing_equipment?: string | null;
          complexity_score?: number | null;
          zone_count?: number | null;
          status?: string;
          assigned_to?: string | null;
          quote_id?: string | null;
          notes?: string | null;
          priority?: string;
        };
        Update: {
          status?: string;
          assigned_to?: string | null;
          assigned_at?: string | null;
          quote_id?: string | null;
          notes?: string | null;
          priority?: string;
          technical_notes?: string | null;
          updated_at?: string;
        };
      };
    };
    Functions: {
      hybrid_product_search: {
        Args: {
          query_text: string;
          query_embedding: number[];
          min_price?: number;
          max_price?: number;
          brand_filter?: string | null;
          category_filter?: string | null;
          in_stock_only?: boolean;
          result_limit?: number;
          vector_weight?: number;
          bm25_weight?: number;
          use_case_filter?: string | null;
        };
        Returns: {
          id: string;
          product_name: string;
          sku: string;
          model: string | null;
          brand: string | null;
          category_name: string | null;
          retail_price: number | null;
          cost_price: number | null;
          total_stock: number;
          stock_jhb: number;
          stock_cpt: number;
          stock_dbn: number;
          images: string[] | null;
          specifications: Record<string, any> | null;
          supplier_id: string | null;
          active: boolean;
          hybrid_score: number;
          vec_score: number;
          bm25_score: number;
          use_case: string | null;
        }[];
      };
    };
  };
}
