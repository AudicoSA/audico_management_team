import Anthropic from "@anthropic-ai/sdk";
import { searchProducts, searchProductsSafe, searchByKeywords } from "@/lib/search";
import { getSupabaseServer } from "@/lib/supabase";
import type { Product } from "@/lib/types";

/**
 * Sales Agent - An AI sales specialist trained on your product database
 *
 * This agent uses Claude with tool-calling to:
 * 1. Search your product database intelligently
 * 2. Reason about what products solve customer needs
 * 3. Recommend complete solutions with expert explanations
 *
 * Unlike hardcoded rules, this agent can handle ANY scenario by
 * searching and reasoning about your actual inventory.
 */

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

interface SalesAgentResult {
  message: string;
  products: Product[];
  needsMoreInfo?: boolean;
  followUpQuestion?: string;
}

/**
 * Tools available to the Sales Agent
 */
const SALES_AGENT_TOOLS: Anthropic.Tool[] = [
  {
    name: "search_products",
    description: `Search Audico's product database. Use this to find products matching customer needs.

TIPS FOR EFFECTIVE SEARCHES:
- Use specific product types: "video bar", "speakerphone", "PTZ camera", "ceiling speaker"
- Include brand names when customer mentions them: "Yealink", "Poly", "Jabra", "Shure"
- For conference rooms: try "video bar", "room system", "speakerphone", "conference camera"
- For audio: try "amplifier", "ceiling speaker", "outdoor speaker", "subwoofer"
- Search multiple times with different terms to find the best options`,
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Search terms - be specific about product type and brand",
        },
        minPrice: {
          type: "number",
          description: "Minimum price in Rand (optional)",
        },
        maxPrice: {
          type: "number",
          description: "Maximum price in Rand (optional)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_product_by_sku",
    description: "Get detailed information about a specific product by SKU or partial name match. Use this when customer asks about a specific product.",
    input_schema: {
      type: "object" as const,
      properties: {
        identifier: {
          type: "string",
          description: "Product SKU or name to look up",
        },
      },
      required: ["identifier"],
    },
  },
  {
    name: "browse_category",
    description: `Browse products by category. Use when you need to see what's available in a category.

COMMON CATEGORIES:
- Conference Systems: video bars, room systems, speakerphones
- Speakers: ceiling, outdoor, floorstanding, bookshelf
- Amplifiers: streaming amps, AV receivers, commercial amps
- Microphones: wireless, conference, ceiling arrays`,
    input_schema: {
      type: "object" as const,
      properties: {
        category: {
          type: "string",
          description: "Category to browse",
        },
        limit: {
          type: "number",
          description: "Max products to return (default 10)",
        },
      },
      required: ["category"],
    },
  },
  {
    name: "provide_recommendation",
    description: "Provide your final product recommendations to the customer. Call this when you've found the right products and are ready to present them.",
    input_schema: {
      type: "object" as const,
      properties: {
        products: {
          type: "array",
          items: {
            type: "object",
            properties: {
              sku: { type: "string", description: "Product SKU" },
              reason: { type: "string", description: "Why this product is recommended (1-2 sentences)" },
            },
            required: ["sku", "reason"],
          },
          description: "Products to recommend (include SKU and reason)",
        },
        explanation: {
          type: "string",
          description: "Overall explanation of your recommendation - why these products solve the customer's needs",
        },
        alternativeNote: {
          type: "string",
          description: "Optional note about alternatives or considerations",
        },
      },
      required: ["products", "explanation"],
    },
  },
  {
    name: "ask_clarifying_question",
    description: "Ask the customer a clarifying question if you need more information to make a good recommendation. Use sparingly - only when truly necessary.",
    input_schema: {
      type: "object" as const,
      properties: {
        question: {
          type: "string",
          description: "The question to ask",
        },
        reason: {
          type: "string",
          description: "Why you need this information (internal, not shown to customer)",
        },
      },
      required: ["question", "reason"],
    },
  },
];

/**
 * System prompt that trains the agent on being a sales specialist
 */
const SALES_AGENT_SYSTEM_PROMPT = `You are an expert audio/video sales specialist at Audico, South Africa's leading AV retailer. You have deep knowledge of professional audio, video conferencing, home cinema, and commercial sound systems.

## YOUR ROLE
You help customers find the perfect products for their needs. You're enthusiastic about technology, genuinely helpful, and focused on solving problems - not just making sales.

## HOW TO WORK
1. UNDERSTAND the customer's need first
2. SEARCH the database to find relevant products
3. REASON about which products best solve their problem
4. RECOMMEND with clear explanations of WHY

## SOLUTION KNOWLEDGE
You know these common patterns (but ALWAYS verify by searching):

**Video Conferencing:**
- Huddle rooms (2-4 people) → Video bars (Poly Studio, Jabra PanaCast, Yealink UVC)
- Medium rooms (5-8 people) → Video bars or room systems (Yealink MVC, Poly Studio X)
- Large boardrooms (10+) → Full room systems with PTZ cameras (Yealink MVC S60/S80)
- Focus rooms/phone booths → Personal speakerphones or webcam+headset

**Commercial Audio:**
- Restaurants/retail → Ceiling speakers + streaming amp (Sonos Amp, Yamaha)
- Gyms/fitness → High-power PA speakers + commercial amp
- Outdoor areas → Weatherproof speakers (IP65+)

**Home Cinema:**
- 5.1/7.1 systems → AVR + speakers + subwoofer
- Multi-room audio → Streaming amps + architectural speakers

## IMPORTANT RULES
1. ONLY recommend products that exist in Audico's inventory (use search tools)
2. If uncertain, SEARCH first - don't guess
3. Provide SOLUTIONS, not just products - explain why they work together
4. Be honest about trade-offs and alternatives
5. Prices are in South African Rand (R)
6. Always check stock availability when possible

## PERSONALITY
- Enthusiastic but not pushy
- Expert but approachable
- Focused on solving the customer's actual problem
- Honest about what's needed vs nice-to-have`;

export class SalesAgent {
  private anthropic: Anthropic;
  private conversationHistory: Anthropic.MessageParam[] = [];
  private foundProducts: Map<string, Product> = new Map();

  constructor() {
    this.anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  }

  /**
   * Process a customer message and return recommendations
   */
  async chat(
    customerMessage: string,
    context?: {
      selectedProducts?: any[];
      sessionHistory?: ConversationMessage[];
    }
  ): Promise<SalesAgentResult> {
    // Build context about current quote
    let contextInfo = "";
    if (context?.selectedProducts && context.selectedProducts.length > 0) {
      contextInfo = `\n\nCUSTOMER'S CURRENT QUOTE:\n${context.selectedProducts
        .map((p: any) => `- ${p.product?.name}: R${p.product?.price?.toLocaleString()}`)
        .join("\n")}\nTotal: R${context.selectedProducts
          .reduce((sum: number, p: any) => sum + (p.lineTotal || 0), 0)
          .toLocaleString()}`;
    }

    // Add the customer message
    this.conversationHistory.push({
      role: "user",
      content: customerMessage + contextInfo,
    });

    console.log(`[SalesAgent] Processing: "${customerMessage}"`);

    try {
      // Initial request to Claude
      let response = await this.anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4000,
        system: SALES_AGENT_SYSTEM_PROMPT,
        tools: SALES_AGENT_TOOLS,
        messages: this.conversationHistory,
      });

      // Process tool calls in a loop
      let iterations = 0;
      const maxIterations = 8; // Allow multiple searches

      while (response.stop_reason === "tool_use" && iterations < maxIterations) {
        iterations++;
        const toolResults: Anthropic.ToolResultBlockParam[] = [];

        // Execute all tools
        for (const block of response.content) {
          if (block.type === "tool_use") {
            console.log(`[SalesAgent] Tool: ${block.name}`, JSON.stringify(block.input).slice(0, 100));
            const result = await this.executeTool(block.name, block.input as Record<string, unknown>);

            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: JSON.stringify(result),
            });
          }
        }

        // Add assistant's tool use message AND user's tool results to history
        this.conversationHistory.push({
          role: "assistant",
          content: response.content,
        });

        this.conversationHistory.push({
          role: "user",
          content: toolResults,
        });

        // Now check if we need to return early (terminal tools)
        for (const block of response.content) {
          if (block.type === "tool_use") {
            // Check for final recommendation
            if (block.name === "provide_recommendation") {
              const input = block.input as {
                products: { sku: string; reason: string }[];
                explanation: string;
                alternativeNote?: string;
              };

              // Get full product objects
              const products = await this.getProductsBySkus(
                input.products.map((p) => p.sku)
              );

              // Build the message
              let message = input.explanation;
              if (input.alternativeNote) {
                message += `\n\n${input.alternativeNote}`;
              }

              // We already pushed the tool results, so we can just return now
              // The next time the agent is called, it will see the tool results in history
              // But for now, we return the response to the user
              return {
                message,
                products,
              };
            }

            // Check for clarifying question
            if (block.name === "ask_clarifying_question") {
              const input = block.input as { question: string };

              return {
                message: input.question,
                products: [],
                needsMoreInfo: true,
                followUpQuestion: input.question,
              };
            }
          }
        }

        response = await this.anthropic.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4000,
          system: SALES_AGENT_SYSTEM_PROMPT,
          tools: SALES_AGENT_TOOLS,
          messages: this.conversationHistory,
        });
      }

      // If we get here without a recommendation, extract text response
      const textBlock = response.content.find((b) => b.type === "text");
      const message = (textBlock as Anthropic.TextBlock)?.text ||
        "I'd be happy to help! Could you tell me more about what you're looking for?";

      // Get any products we found during searches
      const products = Array.from(this.foundProducts.values()).slice(0, 8);

      this.conversationHistory.push({
        role: "assistant",
        content: response.content,
      });

      return { message, products };

    } catch (error) {
      console.error("[SalesAgent] Error:", error);
      return {
        message: "I apologize, I encountered an issue. Could you tell me more about what you're looking for?",
        products: [],
      };
    }
  }

  /**
   * Execute a tool and return results
   */
  private async executeTool(name: string, input: Record<string, unknown>): Promise<unknown> {
    const supabase = getSupabaseServer();

    switch (name) {
      case "search_products": {
        const query = input.query as string;
        const minPrice = input.minPrice as number | undefined;
        const maxPrice = input.maxPrice as number | undefined;

        try {
          const results = await searchProductsSafe(
            query,
            { minPrice, maxPrice },
            12
          );

          // Store found products for later
          results.forEach((p) => this.foundProducts.set(p.sku, p));

          // Return simplified info for the agent
          return results.map((p) => ({
            sku: p.sku,
            name: p.name,
            brand: p.brand,
            price: p.price,
            category: p.category,
            inStock: p.stock.total > 0,
            stockJHB: p.stock.jhb,
          }));
        } catch (error) {
          console.error("[SalesAgent] Search error:", error);
          return { error: "Search failed, try different keywords" };
        }
      }

      case "get_product_by_sku": {
        const identifier = input.identifier as string;

        // Try exact SKU match first
        let { data } = await supabase
          .from("products")
          .select("*")
          .ilike("sku", `%${identifier}%`)
          .limit(5);

        // If no results, try name match
        if (!data || data.length === 0) {
          const result = await supabase
            .from("products")
            .select("*")
            .ilike("product_name", `%${identifier}%`)
            .limit(5);
          data = result.data;
        }

        if (!data || data.length === 0) {
          return { error: "Product not found" };
        }

        // Store and return
        const products = data.map((d: any) => ({
          sku: d.sku,
          name: d.product_name,
          brand: d.brand,
          price: d.retail_price,
          category: d.category_name,
          inStock: (d.stock_jhb || 0) + (d.stock_cpt || 0) + (d.stock_dbn || 0) > 0,
          stockJHB: d.stock_jhb,
          specifications: d.specifications,
        }));

        products.forEach((p: any) => {
          if (p.sku) {
            this.foundProducts.set(p.sku, this.transformDbProduct(data.find((d: any) => d.sku === p.sku)));
          }
        });

        return products;
      }

      case "browse_category": {
        const category = input.category as string;
        const limit = (input.limit as number) || 10;

        const { data } = await supabase
          .from("products")
          .select("*")
          .ilike("category_name", `%${category}%`)
          .eq("active", true)
          .order("stock_jhb", { ascending: false })
          .limit(limit);

        if (!data || data.length === 0) {
          // Try product name search as fallback
          const results = await searchByKeywords(category, {}, limit);
          results.forEach((p) => this.foundProducts.set(p.sku, p));
          return results.map((p) => ({
            sku: p.sku,
            name: p.name,
            brand: p.brand,
            price: p.price,
            inStock: p.stock.total > 0,
          }));
        }

        const products = data.map((d: any) => ({
          sku: d.sku,
          name: d.product_name,
          brand: d.brand,
          price: d.retail_price,
          inStock: (d.stock_jhb || 0) > 0,
        }));

        data.forEach((d: any) => {
          this.foundProducts.set(d.sku, this.transformDbProduct(d));
        });

        return products;
      }

      case "provide_recommendation":
      case "ask_clarifying_question":
        // These are handled specially in the main loop
        return input;

      default:
        return { error: `Unknown tool: ${name}` };
    }
  }

  /**
   * Get full product objects by SKUs
   */
  private async getProductsBySkus(skus: string[]): Promise<Product[]> {
    const products: Product[] = [];

    for (const sku of skus) {
      // Check cache first
      if (this.foundProducts.has(sku)) {
        products.push(this.foundProducts.get(sku)!);
        continue;
      }

      // Otherwise fetch from DB
      const supabase = getSupabaseServer();
      const { data } = await supabase
        .from("products")
        .select("*")
        .eq("sku", sku)
        .single();

      if (data) {
        products.push(this.transformDbProduct(data));
      }
    }

    return products;
  }

  /**
   * Transform database product to Product type
   */
  private transformDbProduct(db: any): Product {
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

  /**
   * Reset conversation history
   */
  reset(): void {
    this.conversationHistory = [];
    this.foundProducts.clear();
  }
}
