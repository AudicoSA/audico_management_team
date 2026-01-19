// ============================================
// UNIFIED PRODUCT TYPES
// ============================================

export interface UnifiedProduct {
  // Basic Information
  product_name: string;
  sku?: string;
  model?: string;
  brand?: string;
  category_id?: string;
  category_name?: string;
  description?: string;

  // Pricing (ZAR)
  cost_price?: number;
  retail_price?: number;
  selling_price?: number;
  margin_percentage?: number;

  // Stock
  total_stock: number;
  stock_jhb?: number;
  stock_cpt?: number;
  stock_dbn?: number;

  // Product Details
  images?: string[];
  specifications?: Record<string, any>;
  features?: string[];
  dimensions?: string;
  weight?: string;
  warranty?: string;

  // URLs
  supplier_url?: string;
  datasheet_url?: string;

  // Source
  supplier_id: string;
  supplier_sku?: string;

  // Metadata
  active?: boolean;

  // Consultation Mode Fields (Build #10)
  scenario_tags?: string[];        // ['commercial_bgm', 'home_cinema', 'conference']
  mounting_type?: string;          // 'ceiling' | 'wall' | 'floor' | 'in-wall'
  exclude_from_consultation?: boolean;  // true for brackets, cables, car audio
}

// ============================================
// SUPPLIER TYPES
// ============================================

export interface Supplier {
  id: string;
  name: string;
  type: 'scrape' | 'feed' | 'manual';
  api_endpoint?: string;
  credentials?: Record<string, any>;
  sync_schedule?: string;
  last_sync?: Date;
  active: boolean;
  status: 'idle' | 'running' | 'error';
  error_message?: string;
  total_products?: number;
  created_at?: Date;
  updated_at?: Date;
}

// ============================================
// SYNC SESSION TYPES
// ============================================

export interface SyncSession {
  id: string;
  supplier_id: string;
  started_at: Date;
  completed_at?: Date;
  duration_seconds?: number;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  products_added: number;
  products_updated: number;
  products_unchanged: number;
  products_deactivated: number;
  errors: any[];
  warnings: any[];
  metadata?: Record<string, any>;
  triggered_by?: string;
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

// ============================================
// MCP TOOL INTERFACE
// ============================================

export interface MCPSupplierTool {
  /**
   * Test connection to supplier API/website
   */
  testConnection(): Promise<boolean>;

  /**
   * Sync products from supplier to unified database
   */
  syncProducts(options?: SyncOptions): Promise<SyncResult>;

  /**
   * Get current status of supplier integration
   */
  getStatus(): Promise<SupplierStatus>;

  /**
   * Get supplier information
   */
  getSupplierInfo(): Promise<Supplier>;
}

export interface SyncOptions {
  limit?: number;
  fullSync?: boolean;
  dryRun?: boolean;
  sessionName?: string;
}

export interface SupplierStatus {
  supplier_name: string;
  last_sync?: Date;
  total_products: number;
  status: 'active' | 'error' | 'idle';
  error_message?: string;
  next_sync?: Date;
}

// ============================================
// PRICE CALCULATION TYPES
// ============================================

export interface PriceCalculation {
  cost_price: number;
  retail_price?: number;
  selling_price: number;
  margin_percentage: number;
  vat_inclusive: boolean;
}

export interface PricingRule {
  vat_percentage: number;
  margin_percentage: number;
  apply_vat_to_cost?: boolean;
  apply_margin_to_vat_inclusive?: boolean;
}

// ============================================
// STOCK TYPES
// ============================================

export interface StockInfo {
  total: number;
  jhb?: number;
  cpt?: number;
  dbn?: number;
  available: boolean;
  status: 'In Stock' | 'Low Stock' | 'Out of Stock';
}

// ============================================
// CATEGORY TYPES
// ============================================

export interface ProductCategory {
  id: string;
  name: string;
  parent_id?: string;
  ai_context?: string;
  keywords?: string[];
  level: number;
  path?: string;
}
