import { v4 as uuidv4 } from "uuid";
import { getSupabaseServer } from "@/lib/supabase";
import type { Quote, QuoteItem, Product } from "@/lib/types";

/**
 * Simple Quote Engine
 * For direct product search and quote building without guided steps
 */
export class SimpleQuoteEngine {
  private quote: Quote;
  private supabase = getSupabaseServer();

  constructor(quote: Quote) {
    this.quote = quote;
  }

  /**
   * Create a new Simple Quote
   */
  static async create(sessionId: string): Promise<SimpleQuoteEngine> {
    const supabase = getSupabaseServer();

    const quoteId = uuidv4();
    const quote: Quote = {
      id: quoteId,
      sessionId,
      flowType: "simple_quote",
      requirements: { type: "home_cinema" }, // Simple quotes don't need full requirements
      steps: [],
      currentStepIndex: 0,
      selectedProducts: [],
      status: "in_progress",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const { error } = await supabase.from("quotes").insert({
      id: quoteId,
      session_id: sessionId,
      flow_type: "simple_quote",
      requirements: {},
      steps: [],
      current_step_index: 0,
      selected_products: [],
      status: "in_progress",
    });

    if (error) {
      throw new Error(`Failed to create quote: ${error.message}`);
    }

    return new SimpleQuoteEngine(quote);
  }

  /**
   * Load an existing quote from database
   */
  static async load(quoteId: string): Promise<SimpleQuoteEngine | null> {
    const supabase = getSupabaseServer();

    const { data, error } = await supabase
      .from("quotes")
      .select("*")
      .eq("id", quoteId)
      .single();

    if (error || !data) {
      return null;
    }

    const quote: Quote = {
      id: data.id,
      sessionId: data.session_id,
      flowType: data.flow_type as "simple_quote",
      requirements: data.requirements,
      steps: data.steps,
      currentStepIndex: data.current_step_index,
      selectedProducts: data.selected_products,
      status: data.status as Quote["status"],
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };

    return new SimpleQuoteEngine(quote);
  }

  /**
   * Get quote ID
   */
  getQuoteId(): string {
    return this.quote.id;
  }

  /**
   * Add a product to the quote
   */
  async addItem(product: Product, quantity: number = 1): Promise<QuoteItem> {
    // Check if product already exists in quote
    const existingIndex = this.quote.selectedProducts.findIndex(
      (item) => item.productId === product.id
    );

    let quoteItem: QuoteItem;

    if (existingIndex !== -1) {
      // Update quantity if product already in quote
      const existing = this.quote.selectedProducts[existingIndex];
      existing.quantity += quantity;
      existing.lineTotal = existing.product.price * existing.quantity;
      quoteItem = existing;
    } else {
      // Add new item
      quoteItem = {
        productId: product.id,
        product,
        quantity,
        lineTotal: product.price * quantity,
      };
      this.quote.selectedProducts.push(quoteItem);
    }

    await this.save();
    return quoteItem;
  }

  /**
   * Remove a product from the quote
   */
  async removeItem(productId: string): Promise<boolean> {
    const index = this.quote.selectedProducts.findIndex(
      (item) => item.productId === productId
    );

    if (index === -1) {
      return false;
    }

    this.quote.selectedProducts.splice(index, 1);
    await this.save();
    return true;
  }

  /**
   * Update quantity for a product
   */
  async updateQuantity(productId: string, quantity: number): Promise<QuoteItem | null> {
    const item = this.quote.selectedProducts.find(
      (item) => item.productId === productId
    );

    if (!item) {
      return null;
    }

    if (quantity <= 0) {
      await this.removeItem(productId);
      return null;
    }

    item.quantity = quantity;
    item.lineTotal = item.product.price * quantity;
    await this.save();
    return item;
  }

  /**
   * Get all items in the quote
   */
  getItems(): QuoteItem[] {
    return this.quote.selectedProducts;
  }

  /**
   * Get item count
   */
  getItemCount(): number {
    return this.quote.selectedProducts.reduce((sum, item) => sum + item.quantity, 0);
  }

  /**
   * Get quote total
   */
  getTotal(): number {
    return this.quote.selectedProducts.reduce(
      (sum, item) => sum + item.lineTotal,
      0
    );
  }

  /**
   * Clear all items from the quote
   */
  async clear(): Promise<void> {
    this.quote.selectedProducts = [];
    await this.save();
  }

  /**
   * Mark quote as complete
   */
  async complete(): Promise<void> {
    this.quote.status = "complete";
    await this.save();
  }

  /**
   * Save quote to database
   */
  private async save(): Promise<void> {
    const { error } = await this.supabase
      .from("quotes")
      .update({
        selected_products: this.quote.selectedProducts,
        status: this.quote.status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", this.quote.id);

    if (error) {
      console.error("Failed to save quote:", error);
      throw new Error(`Failed to save quote: ${error.message}`);
    }
  }

  /**
   * Get quote summary
   */
  getSummary() {
    return {
      id: this.quote.id,
      status: this.quote.status,
      items: this.quote.selectedProducts,
      itemCount: this.getItemCount(),
      total: this.getTotal(),
    };
  }
}
