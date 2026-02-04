/**
 * Quote Manager for AI-Native System
 *
 * Handles quote creation, product additions, and quote updates.
 * This is a simplified quote engine focused on the AI-native flow.
 */

import { v4 as uuidv4 } from "uuid";
import { getSupabaseServer } from "@/lib/supabase";
import { ProductSearchEngine } from "./product-search-engine";
import type { Product } from "@/lib/types";

interface QuoteItem {
  productId: string;
  product: Product;
  quantity: number;
  lineTotal: number;
  reason?: string;
}

interface Quote {
  id: string;
  sessionId: string;
  quoteType: string;
  requirements: any;
  items: QuoteItem[];
  totalPrice: number;
  invoiceNumber?: string;
  createdAt: string;
  updatedAt: string;
}

export class QuoteManager {
  private quotes: Map<string, Quote> = new Map();

  /**
   * Create a new quote
   */
  async createQuote(sessionId: string, quoteType: string, requirements: any = {}): Promise<string> {
    const quoteId = uuidv4();

    const quote: Quote = {
      id: quoteId,
      sessionId,
      quoteType,
      requirements,
      items: [],
      totalPrice: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.quotes.set(quoteId, quote);

    console.log(`[QuoteManager] Created quote ${quoteId} of type ${quoteType}`);

    // Save to database
    await this.saveToDatabase(quote);

    return quoteId;
  }

  /**
   * Add a product to a quote
   */
  async addProduct(quoteId: string, sku: string, quantity: number = 1, reason?: string): Promise<QuoteItem> {
    // Use getQuote to load from DB if not in memory (critical for serverless)
    const quote = await this.getQuote(quoteId);
    if (!quote) {
      throw new Error(`Quote ${quoteId} not found`);
    }

    // Get product details
    const product = await ProductSearchEngine.getProductDetails(sku);
    if (!product) {
      throw new Error(`Product ${sku} not found`);
    }

    // VALIDATE PRODUCT PRICE
    // Products with invalid prices (null, undefined, NaN, or 0) should not be added to quotes
    // This prevents "N/A" from showing in quote totals and breaking calculations
    const priceValue = product.price;
    if (priceValue === undefined || priceValue === null || Number.isNaN(priceValue) || priceValue <= 0) {
      console.error(`[QuoteManager] ❌ Cannot add product with invalid price: ${sku} (price: ${priceValue})`);
      throw new Error(
        `Product "${product.name}" (${sku}) has an invalid price in the database. ` +
        `Please contact support to fix the product pricing.`
      );
    }

    console.log(`[QuoteManager] ✅ Product price validated: ${sku} at R${priceValue.toLocaleString()}`);

    // Check if product already in quote
    const existingIndex = quote.items.findIndex((item) => item.product.sku === sku);
    if (existingIndex >= 0) {
      // Update quantity
      quote.items[existingIndex].quantity += quantity;
      quote.items[existingIndex].lineTotal = quote.items[existingIndex].quantity * product.price;
      if (reason) {
        quote.items[existingIndex].reason = reason;
      }
    } else {
      // Add new item
      const item: QuoteItem = {
        productId: product.id,
        product,
        quantity,
        lineTotal: product.price * quantity,
        reason,
      };
      quote.items.push(item);
    }

    // Update total
    quote.totalPrice = quote.items.reduce((sum, item) => sum + item.lineTotal, 0);
    quote.updatedAt = new Date().toISOString();

    console.log(`[QuoteManager] Added ${quantity}x ${sku} to quote ${quoteId}`);

    // Save to database
    await this.saveToDatabase(quote);

    return quote.items[existingIndex >= 0 ? existingIndex : quote.items.length - 1];
  }

  /**
   * Remove a product from a quote
   */
  async removeProduct(quoteId: string, sku: string): Promise<void> {
    // Use getQuote to load from DB if not in memory (critical for serverless)
    const quote = await this.getQuote(quoteId);
    if (!quote) {
      throw new Error(`Quote ${quoteId} not found`);
    }

    const initialLength = quote.items.length;
    quote.items = quote.items.filter((item) => item.product.sku !== sku);

    if (quote.items.length < initialLength) {
      // Recalculate total
      quote.totalPrice = quote.items.reduce((sum, item) => sum + item.lineTotal, 0);
      quote.updatedAt = new Date().toISOString();

      console.log(`[QuoteManager] Removed ${sku} from quote ${quoteId}`);

      // Save to database
      await this.saveToDatabase(quote);
    }
  }

  /**
   * Update the quantity of a product in the quote
   */
  async updateQuantity(quoteId: string, productId: string, newQuantity: number): Promise<void> {
    // Use getQuote to load from DB if not in memory (critical for serverless)
    const quote = await this.getQuote(quoteId);
    if (!quote) {
      throw new Error(`Quote ${quoteId} not found`);
    }

    // Find the item by productId
    const itemIndex = quote.items.findIndex((item) => item.productId === productId);
    if (itemIndex < 0) {
      throw new Error(`Product ${productId} not found in quote ${quoteId}`);
    }

    const item = quote.items[itemIndex];

    if (newQuantity === 0) {
      // Remove the item
      quote.items.splice(itemIndex, 1);
      console.log(`[QuoteManager] Removed ${item.product.sku} from quote ${quoteId} (quantity set to 0)`);
    } else {
      // Update quantity and recalculate lineTotal
      item.quantity = newQuantity;
      item.lineTotal = item.product.price * newQuantity;
      console.log(`[QuoteManager] Updated ${item.product.sku} quantity to ${newQuantity} in quote ${quoteId}`);
    }

    // Recalculate total
    quote.totalPrice = quote.items.reduce((sum, item) => sum + item.lineTotal, 0);
    quote.updatedAt = new Date().toISOString();

    // Save to database
    await this.saveToDatabase(quote);
  }

  /**
   * Update quote requirements or properties
   */
  async updateQuote(quoteId: string, updates: any): Promise<Quote> {
    // Use getQuote to load from DB if not in memory (critical for serverless)
    const quote = await this.getQuote(quoteId);
    if (!quote) {
      throw new Error(`Quote ${quoteId} not found`);
    }

    // Handle remove_sku
    if (updates.remove_sku) {
      await this.removeProduct(quoteId, updates.remove_sku);
      return quote;
    }

    // Update budget
    if (updates.budget_total) {
      quote.requirements.budget_total = updates.budget_total;
    }

    // Update other requirements
    if (updates.requirements) {
      quote.requirements = { ...quote.requirements, ...updates.requirements };
    }

    quote.updatedAt = new Date().toISOString();

    console.log(`[QuoteManager] Updated quote ${quoteId}`);

    // Save to database
    await this.saveToDatabase(quote);

    return quote;
  }

  /**
   * Get a quote
   */
  async getQuote(quoteId: string): Promise<Quote | undefined> {
    // Check cache first
    if (this.quotes.has(quoteId)) {
      return this.quotes.get(quoteId);
    }

    // Load from database
    const quote = await this.loadFromDatabase(quoteId);
    if (quote) {
      this.quotes.set(quoteId, quote);
    }

    return quote;
  }

  /**
   * Get quote items
   */
  async getQuoteItems(quoteId: string): Promise<QuoteItem[]> {
    const quote = await this.getQuote(quoteId);
    return quote?.items || [];
  }

  /**
   * Get quote total
   */
  async getQuoteTotal(quoteId: string): Promise<number> {
    const quote = await this.getQuote(quoteId);
    return quote?.totalPrice || 0;
  }

  /**
   * Get or generate invoice number for a quote
   * Invoice numbers are generated once and persisted for EFT tracking
   */
  async getInvoiceNumber(quoteId: string): Promise<string> {
    const quote = await this.getQuote(quoteId);
    if (!quote) {
      throw new Error(`Quote ${quoteId} not found`);
    }

    // Return existing invoice number if already assigned
    if (quote.invoiceNumber) {
      return quote.invoiceNumber;
    }

    // Generate new invoice number
    const invoiceNumber = await this.generateInvoiceNumber();
    quote.invoiceNumber = invoiceNumber;
    quote.updatedAt = new Date().toISOString();

    // Save to database with invoice number
    await this.saveToDatabase(quote);

    console.log(`[QuoteManager] Generated invoice number ${invoiceNumber} for quote ${quoteId}`);

    return invoiceNumber;
  }

  /**
   * Generate a unique invoice number
   * Format: PF{YYMMDD}-{SEQ} e.g. PF260204-001
   * Uses database sequence for uniqueness, falls back to timestamp if DB unavailable
   */
  private async generateInvoiceNumber(): Promise<string> {
    const supabase = getSupabaseServer();

    try {
      // Try to use database function for guaranteed uniqueness
      const { data, error } = await supabase.rpc('generate_invoice_number');

      if (!error && data) {
        return data as string;
      }

      // Fallback: generate locally if DB function not available
      console.warn("[QuoteManager] DB invoice generator not available, using fallback");
    } catch (err) {
      console.warn("[QuoteManager] Error calling invoice generator:", err);
    }

    // Fallback generation (timestamp-based)
    const now = new Date();
    const yy = now.getFullYear().toString().slice(-2);
    const mm = (now.getMonth() + 1).toString().padStart(2, '0');
    const dd = now.getDate().toString().padStart(2, '0');
    const ms = now.getTime().toString().slice(-4);
    return `PF${yy}${mm}${dd}-${ms}`;
  }

  /**
   * Find quote by invoice number
   */
  async findByInvoiceNumber(invoiceNumber: string): Promise<Quote | undefined> {
    const supabase = getSupabaseServer();

    try {
      const { data, error } = await supabase
        .from("quotes")
        .select("*")
        .eq("invoice_number", invoiceNumber)
        .single();

      if (error || !data) {
        return undefined;
      }

      return this.loadFromDatabase(data.id);
    } catch (error) {
      console.error("[QuoteManager] Error finding quote by invoice:", error);
      return undefined;
    }
  }

  /**
   * Save quote to database
   */
  private async saveToDatabase(quote: Quote): Promise<void> {
    const supabase = getSupabaseServer();

    try {
      const { error } = await supabase.from("quotes").upsert({
        id: quote.id,
        session_id: quote.sessionId,
        flow_type: quote.quoteType,
        requirements: quote.requirements,
        selected_products: quote.items.map((item) => ({
          productId: item.productId,
          sku: item.product.sku,
          name: item.product.name,
          price: item.product.price,
          quantity: item.quantity,
          lineTotal: item.lineTotal,
          reason: item.reason,
        })),
        invoice_number: quote.invoiceNumber || null,
        status: "in_progress",
        created_at: quote.createdAt,
        updated_at: quote.updatedAt,
      });

      if (error) {
        console.error("[QuoteManager] Error saving quote:", error);
      }
    } catch (error) {
      console.error("[QuoteManager] Database error:", error);
    }
  }

  /**
   * Load quote from database
   */
  private async loadFromDatabase(quoteId: string): Promise<Quote | undefined> {
    const supabase = getSupabaseServer();

    try {
      const { data, error } = await supabase
        .from("quotes")
        .select("*")
        .eq("id", quoteId)
        .single();

      if (error || !data) {
        return undefined;
      }

      // Reconstruct quote
      const quote: Quote = {
        id: data.id,
        sessionId: data.session_id,
        quoteType: data.flow_type,
        requirements: data.requirements || {},
        items: [], // Will be populated below
        totalPrice: 0,
        invoiceNumber: data.invoice_number || undefined,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };

      // Load products
      if (data.selected_products && Array.isArray(data.selected_products)) {
        for (const item of data.selected_products) {
          const product = await ProductSearchEngine.getProductDetails(item.sku);
          if (product) {
            quote.items.push({
              productId: product.id,
              product,
              quantity: item.quantity || 1,
              lineTotal: item.lineTotal || product.price,
              reason: item.reason,
            });
          }
        }
      }

      quote.totalPrice = quote.items.reduce((sum, item) => sum + item.lineTotal, 0);

      return quote;
    } catch (error) {
      console.error("[QuoteManager] Error loading quote:", error);
      return undefined;
    }
  }
}
