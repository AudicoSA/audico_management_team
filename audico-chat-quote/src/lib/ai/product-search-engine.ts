/**
 * Enhanced Product Search Engine for AI-Native System
 *
 * This search engine is optimized for AI tool calls, providing category-based
 * search with intelligent filtering to prevent irrelevant results.
 */

import { getSupabaseServer } from "@/lib/supabase";
import { searchProducts, searchProductsSafe, filterOutCarAudio } from "@/lib/search";
import type { Product, SearchFilters } from "@/lib/types";

/**
 * Category mapping for AI-native search
 */
const CATEGORY_MAPPINGS = {
  home_cinema: {
    keywords: ["home cinema", "home theater", "AVR", "receiver", "passive speaker", "subwoofer", "surround"],
    useCase: "Home",
    excludeKeywords: ["commercial", "100V", "PA", "active", "powered", "bluetooth speaker"],
  },
  commercial_bgm: {
    keywords: ["ceiling speaker", "commercial", "background music", "streaming amp", "distributed audio", "restaurant", "retail"],
    useCase: "Commercial",
    excludeKeywords: ["home cinema", "AVR", "passive"],
  },
  commercial_loud: {
    keywords: ["PA speaker", "commercial amplifier", "gym", "fitness", "high output", "powered speaker", "wireless microphone"],
    useCase: "Commercial",
    excludeKeywords: ["home cinema", "AVR", "ceiling"],
  },
  video_conference: {
    keywords: ["video bar", "room system", "conference", "speakerphone", "PTZ camera", "collaboration", "Poly", "Yealink", "Jabra"],
    useCase: "Commercial",
    excludeKeywords: ["home cinema", "passive speaker"],
  },
  worship: {
    keywords: ["PA speaker", "line array", "commercial amplifier", "wireless microphone", "mixer", "professional audio"],
    useCase: "Commercial",
    excludeKeywords: ["home cinema", "ceiling speaker"],
  },
  outdoor: {
    keywords: ["outdoor speaker", "weatherproof", "IP65", "IP67", "garden", "patio"],
    useCase: "Both",
    excludeKeywords: [],
  },
};

export class ProductSearchEngine {
  /**
   * Search products by category (use case)
   * This is the primary search method for the AI
   */
  static async searchByCategory(
    category: keyof typeof CATEGORY_MAPPINGS,
    filters: {
      minPrice?: number;
      maxPrice?: number;
      limit?: number;
    } = {}
  ): Promise<Product[]> {
    const mapping = CATEGORY_MAPPINGS[category];
    if (!mapping) {
      throw new Error(`Unknown category: ${category}`);
    }

    const limit = Math.min(filters.limit || 10, 20);
    const supabase = getSupabaseServer();

    console.log(`[ProductSearchEngine] Category search: ${category}`);

    try {
      // Build the base query
      let query = supabase
        .from("products")
        .select("*")
        .eq("active", true);

      // Apply use case filter if specified
      if (mapping.useCase !== "Both") {
        query = query.eq("use_case", mapping.useCase);
      }

      // Apply price filters
      if (filters.minPrice) {
        query = query.gte("retail_price", filters.minPrice);
      }
      if (filters.maxPrice) {
        query = query.lte("retail_price", filters.maxPrice);
      }

      // For home cinema, specifically filter for passive speakers and AVRs
      if (category === "home_cinema") {
        query = query.or(
          `component_type.eq.avr,component_type.eq.passive_speaker,component_type.eq.subwoofer,product_name.ilike.%receiver%,product_name.ilike.%speaker%,product_name.ilike.%subwoofer%`
        );
      }

      // Execute query
      query = query.order("stock_jhb", { ascending: false }).limit(limit * 2); // Get 2x limit for filtering

      const { data, error } = await query;

      if (error) {
        console.error("[ProductSearchEngine] Query error:", error);
        // Fallback to keyword search
        return await this.searchByKeywords(mapping.keywords.join(" "), filters);
      }

      if (!data || data.length === 0) {
        // Fallback to keyword search
        console.log(`[ProductSearchEngine] No direct results, trying keyword search`);
        return await this.searchByKeywords(mapping.keywords[0], filters);
      }

      // Transform and filter results
      let products = data.map(this.transformDbProduct);

      // Apply exclude keyword filtering
      if (mapping.excludeKeywords.length > 0) {
        products = products.filter((p) => {
          const searchText = `${p.name} ${p.category} ${JSON.stringify(p.specifications)}`.toLowerCase();
          return !mapping.excludeKeywords.some((kw) => searchText.includes(kw.toLowerCase()));
        });
      }

      // CRITICAL: Filter out car audio for home_cinema category
      if (category === "home_cinema") {
        const beforeCount = products.length;
        products = filterOutCarAudio(products);
        console.log(`[ProductSearchEngine] Car audio filter: ${beforeCount} → ${products.length} products`);
      }

      // Sort by relevance (in stock first, then by price)
      products.sort((a, b) => {
        if (a.stock.total > 0 && b.stock.total === 0) return -1;
        if (a.stock.total === 0 && b.stock.total > 0) return 1;
        return a.price - b.price;
      });

      console.log(`[ProductSearchEngine] Found ${products.length} products for ${category}`);
      return products.slice(0, limit);
    } catch (error) {
      console.error("[ProductSearchEngine] Search error:", error);
      // Ultimate fallback
      return await this.searchByKeywords(mapping.keywords[0], filters);
    }
  }

  /**
   * Search products by keywords
   * Used when customer asks for specific products or brands
   */
  static async searchByKeywords(
    keywords: string,
    filters: {
      minPrice?: number;
      maxPrice?: number;
      limit?: number;
    } = {}
  ): Promise<Product[]> {
    const limit = Math.min(filters.limit || 10, 20);

    console.log(`[ProductSearchEngine] Keyword search: "${keywords}"`);

    try {
      // Use the existing search function
      const results = await searchProductsSafe(keywords, {
        minPrice: filters.minPrice,
        maxPrice: filters.maxPrice,
      }, limit);

      console.log(`[ProductSearchEngine] Found ${results.length} products for "${keywords}"`);
      return results;
    } catch (error) {
      console.error("[ProductSearchEngine] Keyword search error:", error);
      return [];
    }
  }

  /**
   * Filter products by specific criteria
   */
  static async filterProducts(
    productSkus: string[],
    criteria: {
      passive_only?: boolean;
      brand?: string;
      min_price?: number;
      max_price?: number;
      component_type?: string;
      in_stock_only?: boolean;
    }
  ): Promise<Product[]> {
    const supabase = getSupabaseServer();

    console.log(`[ProductSearchEngine] Filtering ${productSkus.length} products`);

    if (productSkus.length === 0) {
      return [];
    }

    try {
      let query = supabase
        .from("products")
        .select("*")
        .in("sku", productSkus);

      // Apply filters
      if (criteria.brand) {
        query = query.ilike("brand", `%${criteria.brand}%`);
      }

      if (criteria.min_price) {
        query = query.gte("retail_price", criteria.min_price);
      }

      if (criteria.max_price) {
        query = query.lte("retail_price", criteria.max_price);
      }

      if (criteria.component_type) {
        query = query.eq("component_type", criteria.component_type);
      }

      if (criteria.passive_only) {
        query = query.eq("component_type", "passive_speaker");
      }

      const { data, error } = await query;

      if (error || !data) {
        console.error("[ProductSearchEngine] Filter error:", error);
        return [];
      }

      let products = data.map(this.transformDbProduct);

      // Apply in-stock filter if needed
      if (criteria.in_stock_only) {
        products = products.filter((p) => p.stock.total > 0);
      }

      console.log(`[ProductSearchEngine] Filtered to ${products.length} products`);
      return products;
    } catch (error) {
      console.error("[ProductSearchEngine] Filter error:", error);
      return [];
    }
  }

  /**
   * Get product details by SKU
   */
  static async getProductDetails(sku: string): Promise<Product | null> {
    const supabase = getSupabaseServer();

    console.log(`[ProductSearchEngine] Getting details for SKU: ${sku}`);

    try {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("sku", sku)
        .single();

      if (error || !data) {
        console.error("[ProductSearchEngine] Product not found:", sku);
        return null;
      }

      return this.transformDbProduct(data);
    } catch (error) {
      console.error("[ProductSearchEngine] Get product error:", error);
      return null;
    }
  }

  /**
   * Get multiple products by SKUs
   */
  static async getProductsBySkus(skus: string[]): Promise<Product[]> {
    if (skus.length === 0) return [];

    const supabase = getSupabaseServer();

    console.log(`[ProductSearchEngine] Getting ${skus.length} products by SKU`);

    try {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .in("sku", skus);

      if (error || !data) {
        console.error("[ProductSearchEngine] Error fetching products:", error);
        return [];
      }

      let products = data.map(this.transformDbProduct);

      // NOTE: Do NOT apply car audio filter when fetching by SKU
      // When Claude explicitly requests products by SKU in provide_final_recommendation,
      // we should trust that choice and return the exact products requested.
      // The car audio filter is applied during SEARCH, not during final retrieval.
      console.log(`[ProductSearchEngine] Retrieved ${products.length} products by SKU`);

      return products;
    } catch (error) {
      console.error("[ProductSearchEngine] Error:", error);
      return [];
    }
  }

  /**
   * Transform database product to Product type
   */
  private static transformDbProduct(db: any): Product {
    return {
      id: db.id,
      name: db.product_name,
      sku: db.sku,
      model: db.model,
      brand: db.brand,
      category: db.category_name,
      price: parseFloat(String(db.retail_price || 0)),
      cost: parseFloat(String(db.cost_price || 0)),
      stock: {
        total: (db.stock_jhb || 0) + (db.stock_cpt || 0) + (db.stock_dbn || 0),
        jhb: db.stock_jhb || 0,
        cpt: db.stock_cpt || 0,
        dbn: db.stock_dbn || 0,
      },
      images: db.images || [],
      specifications: db.specifications || {},
      useCase: db.use_case,
    };
  }
}
