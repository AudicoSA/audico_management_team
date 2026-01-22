
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import axios from "axios";
import dotenv from "dotenv";
import {
  UnifiedProduct,
  SyncResult,
  SupplierStatus,
  Supplier,
  SyncOptions,
} from "@audico/shared";
import { v4 as uuidv4 } from 'uuid';

import path from "path";
import fs from "fs";

// Try to load .env from project root (standard location in this monorepo structure)
const envPath = path.resolve(process.cwd(), "../../../.env");
console.log(`Loading .env from: ${envPath}`);
if (fs.existsSync(envPath)) {
  console.log("OK: .env file exists at path");
} else {
  console.error("ERROR: .env file NOT found at path");
}

dotenv.config({ path: envPath });

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("ERROR: Missing Supabase credentials in env!");
  console.error("SUPABASE_URL:", supabaseUrl ? "Set" : "Missing");
  console.error("SUPABASE_SERVICE_ROLE_KEY:", supabaseKey ? "Set" : "Missing");
  process.exit(1);
}

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

// Interfaces for WooCommerce Store API response
interface StoreProductPrice {
  price: string;
  regular_price: string;
  sale_price: string;
  currency_code: string;
  currency_symbol: string;
  currency_minor_unit: number;
  currency_prefix: string;
}

interface StoreProductImage {
  id: number;
  src: string;
  name: string;
  alt: string;
}

interface StoreProductCategory {
  id: number;
  name: string;
  slug: string;
}

interface StoreProduct {
  id: number;
  name: string;
  slug: string;
  permalink: string;
  sku: string;
  description: string;
  short_description: string;
  prices: StoreProductPrice;
  price_html: string;
  is_in_stock: boolean;
  images: StoreProductImage[];
  categories: StoreProductCategory[];
}

// Database record interface matching actual schema
interface ProductRecord {
  supplier_id: string;
  supplier_sku: string;
  product_name: string;
  description: string;
  category_name: string;
  retail_price: number;
  selling_price: number;
  cost_price: number;
  total_stock: number;
  images: string[];
  supplier_url: string;
  sku: string;
  active: boolean;
}

export class ProAudioMCPServer {
  private server: McpServer;
  private readonly SUPPLIER_NAME = "Pro Audio";
  private readonly SUPPLIER_ID = "f608fd75-ae4e-4e91-8132-4f741d01f07d";
  private readonly API_BASE = "https://proaudio.co.za/wp-json/wc/store/v1/products";
  private readonly USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
  private readonly DISCOUNT_PERCENT = 10; // 10% discount on scraped prices

  constructor() {
    this.server = new McpServer({
      name: "mcp-feed-proaudio",
      version: "2.0.0",
    });

    this.setupTools();
  }

  /**
   * Round to nearest R10. E.g., R1289 -> R1290, R13462.55 -> R13460
   */
  private roundToNearest10(value: number): number {
    return Math.round(value / 10) * 10;
  }

  /**
   * Apply discount and round to nearest R10.
   */
  private applyDiscountAndRound(price: number): number {
    const discounted = price * (1 - this.DISCOUNT_PERCENT / 100);
    return this.roundToNearest10(discounted);
  }

  private setupTools() {
    this.server.tool(
      "sync",
      "Synchronize products from ProAudio via WooCommerce Store API",
      {
        limit: z.number().optional(),
        dryRun: z.boolean().optional(),
      },
      async ({ limit, dryRun }) => {
        try {
          const result = await this.syncProducts({ limit, dryRun });
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        } catch (error: any) {
          console.error("Sync error:", error);
          return {
            content: [{ type: "text", text: `Sync failed: ${error.message}` }],
            isError: true,
          };
        }
      }
    );
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await axios.get(this.API_BASE, {
        params: { per_page: 1 },
        headers: { "User-Agent": this.USER_AGENT },
        timeout: 10000
      });
      return response.status === 200;
    } catch (error) {
      console.error("Connection test failed:", error);
      return false;
    }
  }

  async getStatus(): Promise<SupplierStatus> {
    const { count } = await supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("supplier_id", this.SUPPLIER_ID);

    return {
      supplier_name: this.SUPPLIER_NAME,
      total_products: count || 0,
      status: 'active'
    };
  }

  async getSupplierInfo(): Promise<Supplier> {
    return {
      id: this.SUPPLIER_ID,
      name: this.SUPPLIER_NAME,
      type: 'feed',
      active: true,
      status: 'idle'
    };
  }

  async syncProducts(options: SyncOptions = {}): Promise<SyncResult> {
    const startTime = Date.now();
    const sessionId = uuidv4();
    const result: SyncResult = {
      success: false,
      session_id: sessionId,
      products_added: 0,
      products_updated: 0,
      products_unchanged: 0,
      errors: [],
      warnings: [],
      duration_seconds: 0
    };

    console.log(`Starting sync session ${sessionId} for ${this.SUPPLIER_NAME}`);
    console.log(`Price logic: -${this.DISCOUNT_PERCENT}% then round to nearest R10`);
    console.log(`Stock logic: Has price & in stock -> 10, "Ask/Call For Price" -> 0 (keeps price for alignment)`);
    if (options.dryRun) console.log("DRY RUN MODE - no changes will be saved");

    try {
      // 1. Fetch all products from API
      const rawProducts = await this.fetchAllProducts(options.limit);
      console.log(`Fetched ${rawProducts.length} raw products from API`);

      // 2. Transform and separate by price status
      const productsWithPrice: ProductRecord[] = [];
      const productsNoPrice: ProductRecord[] = [];

      for (const p of rawProducts) {
        const transformed = this.transformProduct(p);
        if (transformed.hasRealPrice) {
          productsWithPrice.push(transformed.record);
        } else {
          productsNoPrice.push(transformed.record);
        }
      }

      console.log(`Products with price: ${productsWithPrice.length}`);
      console.log(`Products without price (Ask for Price): ${productsNoPrice.length}`);

      // 3. Upsert products WITH prices (full upsert)
      if (!options.dryRun && productsWithPrice.length > 0) {
        console.log(`Upserting ${productsWithPrice.length} products with prices...`);

        const chunkSize = 100;
        for (let i = 0; i < productsWithPrice.length; i += chunkSize) {
          const chunk = productsWithPrice.slice(i, i + chunkSize);

          const { error } = await supabase
            .from("products")
            .upsert(chunk, {
              onConflict: "supplier_sku,supplier_id",
              ignoreDuplicates: false,
            });

          if (error) {
            console.error(`Error upserting chunk ${Math.floor(i / chunkSize) + 1}:`, error);
            result.errors.push(error.message);
          } else {
            result.products_updated += chunk.length;
            console.log(`  Saved chunk ${Math.floor(i / chunkSize) + 1}/${Math.ceil(productsWithPrice.length / chunkSize)}`);
          }
        }
      }

      // 4. For products WITHOUT prices: Only update stock to 0, keep existing price
      if (!options.dryRun && productsNoPrice.length > 0) {
        console.log(`Updating stock to 0 for ${productsNoPrice.length} 'Ask for Price' products...`);

        let processedCount = 0;
        for (const p of productsNoPrice) {
          try {
            // Check if product exists
            const { data: existing } = await supabase
              .from("products")
              .select("id, retail_price, selling_price")
              .eq("supplier_sku", p.supplier_sku)
              .eq("supplier_id", p.supplier_id)
              .single();

            if (existing) {
              // Product exists - update only stock fields, keep prices
              await supabase
                .from("products")
                .update({ total_stock: 0, active: false })
                .eq("id", existing.id);
              result.products_updated++;
            } else {
              // Product doesn't exist - insert with 0 price
              await supabase.from("products").insert(p);
              result.products_added++;
            }

            processedCount++;
            if (processedCount % 50 === 0) {
              console.log(`  Processed ${processedCount}/${productsNoPrice.length} no-price products`);
            }
          } catch (err: any) {
            console.error(`Error updating ${p.supplier_sku}:`, err.message);
            result.errors.push(`${p.supplier_sku}: ${err.message}`);
          }
        }
      }

      result.success = result.errors.length === 0;

    } catch (error: any) {
      console.error("Sync failed with exception:", error);
      result.errors.push(error.message);
      result.success = false;
    } finally {
      result.duration_seconds = (Date.now() - startTime) / 1000;
      console.log(`Sync completed in ${result.duration_seconds.toFixed(1)}s`);
      console.log(`  Updated: ${result.products_updated}, Added: ${result.products_added}, Errors: ${result.errors.length}`);
    }

    return result;
  }

  private async fetchAllProducts(limit?: number): Promise<StoreProduct[]> {
    const allProducts: StoreProduct[] = [];
    let page = 1;
    const perPage = 100; // Max allowed by WooCommerce Store API

    console.log(`Connecting to Pro Audio API: ${this.API_BASE}`);

    while (true) {
      if (limit && allProducts.length >= limit) break;

      try {
        console.log(`  Fetching page ${page}...`);
        const response = await axios.get<StoreProduct[]>(this.API_BASE, {
          params: {
            per_page: perPage,
            page: page,
          },
          headers: {
            "User-Agent": this.USER_AGENT,
          },
          timeout: 30000,
        });

        const products = response.data;
        if (!Array.isArray(products) || products.length === 0) {
          console.log(`  Reached end of product list at page ${page}`);
          break;
        }

        allProducts.push(...products);
        console.log(`  Page ${page}: ${products.length} products (Total: ${allProducts.length})`);

        // Check limit
        if (limit && allProducts.length >= limit) {
          allProducts.splice(limit);
          break;
        }

        page++;

        // Polite delay between requests
        await new Promise(r => setTimeout(r, 500));

      } catch (error: any) {
        if (axios.isAxiosError(error) && error.response?.status === 400) {
          console.log(`  Reached end of pages (400 Bad Request) at page ${page}`);
          break;
        }
        console.error(`  Error fetching page ${page}:`, error.message);
        throw error;
      }
    }

    return allProducts;
  }

  private transformProduct(product: StoreProduct): { record: ProductRecord; hasRealPrice: boolean } {
    // Parse price from cents
    const rawPriceCents = parseInt(product.prices.price, 10);
    const currencyMinorUnit = product.prices.currency_minor_unit || 2;

    let rawPrice = 0;
    let hasRealPrice = false;

    if (!isNaN(rawPriceCents) && rawPriceCents > 0) {
      rawPrice = rawPriceCents / Math.pow(10, currencyMinorUnit);
      hasRealPrice = true;
    }

    // Check if price_html indicates "Ask for Price" or "Call For Price" (out of stock)
    const priceHtml = (product.price_html || "").toLowerCase();
    const isAskForPrice = priceHtml.includes("ask for price") || priceHtml.includes("call for price");

    // Apply pricing logic:
    // - Has price AND not "Ask for Price": Apply 10% discount, round to nearest R10, set stock to 10
    // - Has price BUT "Ask for Price": Keep price (for alignment), but set stock to 0
    // - No price: Set price to 0, stock to 0
    let finalPrice = 0;
    let stockLevel = 0;

    if (hasRealPrice) {
      finalPrice = this.applyDiscountAndRound(rawPrice);
      // Only set stock if NOT "Ask for Price"
      stockLevel = isAskForPrice ? 0 : 10;
    }

    // Generate SKU if missing
    let sku = product.sku?.trim() || "";
    if (!sku) {
      sku = `PA-${product.slug}`;
    }

    // Get category string
    const categoryStr = product.categories.map(c => c.name).join(" > ");

    // Get images as array
    const images = product.images.map(img => img.src).filter(Boolean);

    const record: ProductRecord = {
      supplier_id: this.SUPPLIER_ID,
      supplier_sku: sku,
      product_name: product.name,
      description: product.description || product.short_description || "",
      category_name: categoryStr,
      retail_price: finalPrice,
      selling_price: finalPrice,
      cost_price: 0,
      total_stock: stockLevel,
      images: images,
      supplier_url: product.permalink,
      sku: sku,
      active: stockLevel > 0,
    };

    return { record, hasRealPrice };
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.log("Pro Audio MCP Server running on stdio (v2.0 - API-based)");
  }
}

const server = new ProAudioMCPServer();
server.start().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
