import OpenAI from "openai";
import { searchProducts, searchProductsSafe, searchByKeywords } from "@/lib/search";
import { getSupabaseServer } from "@/lib/supabase";
import type { Product } from "@/lib/types";

/**
 * GPT-4 Sales Agent - An AI sales specialist trained on your product database
 *
 * Uses OpenAI's GPT-4 with function calling to:
 * 1. Search your product database intelligently
 * 2. Reason about what products solve customer needs
 * 3. Recommend complete solutions with expert explanations
 */

interface SalesAgentResult {
  message: string;
  products: Product[];
  needsMoreInfo?: boolean;
}

/**
 * Tools (functions) available to GPT
 */
const GPT_FUNCTIONS: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "search_products",
      description: `Search Audico's product database. Use specific product types and brands.

IMPORTANT SEARCH TIPS:
- For HOME CINEMA bookshelf speakers, search: "bookshelf speaker home cinema passive"
- For HOME CINEMA floorstanding, search: "floorstanding tower speaker home"
- For ceiling speakers, search: "ceiling speaker in-ceiling"
- DO NOT include "active" or "powered" for home cinema (they don't work with AVRs)
- Include "passive" to filter out active/powered speakers for home cinema use`,
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search terms - be specific about product type",
          },
          minPrice: {
            type: "number",
            description: "Minimum price in Rand",
          },
          maxPrice: {
            type: "number",
            description: "Maximum price in Rand",
          },
          excludeKeywords: {
            type: "string",
            description: "Keywords to exclude from results (comma separated)",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_product_details",
      description: "Get detailed info about a specific product by SKU or name",
      parameters: {
        type: "object",
        properties: {
          identifier: {
            type: "string",
            description: "Product SKU or name",
          },
        },
        required: ["identifier"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "filter_products",
      description: "Filter a list of products to only include appropriate ones for the use case",
      parameters: {
        type: "object",
        properties: {
          productSkus: {
            type: "array",
            items: { type: "string" },
            description: "List of product SKUs to filter",
          },
          useCase: {
            type: "string",
            description: "Use case: 'home_cinema', 'commercial', 'outdoor', etc.",
          },
          speakerType: {
            type: "string",
            description: "Required type: 'bookshelf', 'floorstanding', 'ceiling', 'outdoor'",
          },
        },
        required: ["productSkus", "useCase"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "recommend",
      description: "REQUIRED: Always use this function when you want to show products to the customer. This ensures the products are properly displayed in the UI. Call this with the SKUs of products you found via search.",
      parameters: {
        type: "object",
        properties: {
          products: {
            type: "array",
            items: {
              type: "object",
              properties: {
                sku: { type: "string" },
                reason: { type: "string" },
              },
              required: ["sku", "reason"],
            },
            description: "Products to recommend with reasons",
          },
          explanation: {
            type: "string",
            description: "Overall explanation for the customer",
          },
        },
        required: ["products", "explanation"],
      },
    },
  },
];

/**
 * System prompt for GPT
 */
const GPT_SYSTEM_PROMPT = `You are an expert audio/video sales specialist at Audico, South Africa's leading AV retailer.

## CRITICAL PRODUCT KNOWLEDGE

### HOME CINEMA SPEAKERS
- MUST be PASSIVE speakers (no "active", "powered", "bluetooth" for home cinema)
- Bookshelf: JBL Stage, Klipsch Reference, Polk, Wharfedale, DALI
- Floorstanding: Klipsch, Polk, Wharfedale, DALI, KEF
- AVOID: Outdoor speakers, ceiling speakers, active/powered speakers, PA speakers, car audio

### CONFERENCE/VIDEO
- Huddle rooms: Video bars (Poly Studio, Jabra PanaCast, Yealink UVC)
- Medium rooms: Room systems or large video bars
- Large boardrooms: Full room systems (Yealink MVC, Poly Studio X70)

### COMMERCIAL AUDIO
- Restaurants/retail: Ceiling speakers + streaming amp
- Outdoor: Weatherproof speakers (check IP rating)

## RULES
1. ONLY recommend products from Audico inventory (search first!)
2. For home cinema with AVR: NEVER recommend active/powered speakers
3. Filter results to show ONLY appropriate products
4. Be enthusiastic but honest
5. Prices are in South African Rand (R)
6. CRITICAL: When presenting products to the customer, ALWAYS use the "recommend" function with specific SKUs - don't just describe products in text

## PERSONALITY
- Expert and knowledgeable
- Enthusiastic about good gear
- Honest about what's needed vs overkill
- South African friendly`;

export class SalesAgentGPT {
  private openai: OpenAI;
  private messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
  private foundProducts: Map<string, Product> = new Map();

  constructor() {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
    this.messages = [{ role: "system", content: GPT_SYSTEM_PROMPT }];
  }

  /**
   * Process a customer message
   */
  async chat(
    customerMessage: string,
    context?: { selectedProducts?: any[] }
  ): Promise<SalesAgentResult> {
    // Add context about current quote
    let contextInfo = "";
    if (context?.selectedProducts && context.selectedProducts.length > 0) {
      contextInfo = `\n\n[Current quote: ${context.selectedProducts
        .map((p: any) => p.product?.name)
        .join(", ")}]`;
    }

    this.messages.push({
      role: "user",
      content: customerMessage + contextInfo,
    });

    console.log(`[SalesAgentGPT] Processing: "${customerMessage}"`);

    try {
      let response = await this.openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: this.messages,
        tools: GPT_FUNCTIONS,
        tool_choice: "auto",
      });

      let iterations = 0;
      const maxIterations = 8;

      while (response.choices[0]?.message?.tool_calls && iterations < maxIterations) {
        iterations++;
        const assistantMessage = response.choices[0].message;
        this.messages.push(assistantMessage);

        const toolResults: OpenAI.Chat.ChatCompletionToolMessageParam[] = [];
        const toolCalls = assistantMessage.tool_calls || [];

        // Execute all tools first
        for (const toolCall of toolCalls) {
          const functionName = toolCall.function.name;
          const args = JSON.parse(toolCall.function.arguments);

          console.log(`[SalesAgentGPT] Tool: ${functionName}`, JSON.stringify(args).slice(0, 100));

          const result = await this.executeTool(functionName, args);

          toolResults.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify(result),
          });
        }

        // Add assistant and tool messages to history
        this.messages.push(...toolResults);

        // NOW check for terminal actions (recommend)
        // We do this loop just to find if we need to return early
        for (const toolCall of toolCalls) {
          const functionName = toolCall.function.name;

          if (functionName === "recommend") {
            const args = JSON.parse(toolCall.function.arguments);
            const products = await this.getProductsBySkus(
              args.products.map((p: any) => p.sku)
            );

            // We already tracked the tool result above as { success: true } (from executeTool)
            // Actually wait, executeTool for recommend returns args.
            // We should make sure the tool result content for 'recommend' is correct.
            // In the original code:
            // this.messages.push({ role: "tool", tool_call_id: toolCall.id, content: JSON.stringify({ success: true }) });
            // But executeTool returned args.
            // Let's look at executeTool for recommend: it returns args.
            // We should probably just return success: true for the tool result in history to keep it clean.

            return {
              message: args.explanation,
              products,
            };
          }
        }

        response = await this.openai.chat.completions.create({
          model: "gpt-4-turbo-preview",
          messages: this.messages,
          tools: GPT_FUNCTIONS,
          tool_choice: "auto",
        });
      }

      // No tool call - just text response
      const textResponse = response.choices[0]?.message?.content ||
        "How can I help you find the right audio solution?";

      this.messages.push({
        role: "assistant",
        content: textResponse,
      });

      return {
        message: textResponse,
        products: Array.from(this.foundProducts.values()).slice(0, 6),
      };

    } catch (error) {
      console.error("[SalesAgentGPT] Error:", error);
      return {
        message: "I encountered an issue. Could you tell me more about what you're looking for?",
        products: [],
      };
    }
  }

  /**
   * Execute a tool function
   */
  private async executeTool(name: string, args: Record<string, any>): Promise<any> {
    const supabase = getSupabaseServer();

    switch (name) {
      case "search_products": {
        const query = args.query as string;
        const excludeKeywords = (args.excludeKeywords as string || "").split(",").map(k => k.trim().toLowerCase());

        let results = await searchProductsSafe(query, {
          minPrice: args.minPrice,
          maxPrice: args.maxPrice,
        }, 15);

        // Apply exclude keywords
        if (excludeKeywords.length > 0 && excludeKeywords[0] !== "") {
          results = results.filter(p => {
            const nameLower = p.name.toLowerCase();
            return !excludeKeywords.some(kw => nameLower.includes(kw));
          });
        }

        // Store products
        results.forEach(p => this.foundProducts.set(p.sku, p));

        return results.map(p => ({
          sku: p.sku,
          name: p.name,
          brand: p.brand,
          price: p.price,
          category: p.category,
          inStock: p.stock.total > 0,
        }));
      }

      case "get_product_details": {
        const identifier = args.identifier as string;

        const { data } = await supabase
          .from("products")
          .select("*")
          .or(`sku.ilike.%${identifier}%,product_name.ilike.%${identifier}%`)
          .limit(3);

        if (!data || data.length === 0) {
          return { error: "Product not found" };
        }

        data.forEach(d => {
          this.foundProducts.set(d.sku, this.transformDbProduct(d));
        });

        return data.map(d => ({
          sku: d.sku,
          name: d.product_name,
          brand: d.brand,
          price: d.retail_price,
          category: d.category_name,
          inStock: (d.stock_jhb || 0) > 0,
        }));
      }

      case "filter_products": {
        const skus = args.productSkus as string[];
        const useCase = args.useCase as string;
        const speakerType = args.speakerType as string;

        // Get the products
        const products = skus
          .map(sku => this.foundProducts.get(sku))
          .filter(Boolean) as Product[];

        // Filter based on use case
        const filtered = products.filter(p => {
          const nameLower = p.name.toLowerCase();

          // Home cinema - exclude active/powered/outdoor/ceiling
          if (useCase === "home_cinema") {
            const badKeywords = ["active", "powered", "outdoor", "ceiling", "bluetooth speaker", "wireless speaker", "pa speaker"];
            if (badKeywords.some(kw => nameLower.includes(kw))) {
              return false;
            }
          }

          // Speaker type filter
          if (speakerType === "bookshelf") {
            if (nameLower.includes("floorstanding") || nameLower.includes("tower") ||
              nameLower.includes("ceiling") || nameLower.includes("outdoor")) {
              return false;
            }
          }

          return true;
        });

        return filtered.map(p => ({
          sku: p.sku,
          name: p.name,
          brand: p.brand,
          price: p.price,
          suitable: true,
        }));
      }

      case "recommend":
        return args; // Handled in main loop

      default:
        return { error: `Unknown function: ${name}` };
    }
  }

  /**
   * Get products by SKUs
   */
  private async getProductsBySkus(skus: string[]): Promise<Product[]> {
    const products: Product[] = [];

    for (const sku of skus) {
      if (this.foundProducts.has(sku)) {
        products.push(this.foundProducts.get(sku)!);
        continue;
      }

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
   * Transform DB product
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

  reset(): void {
    this.messages = [{ role: "system", content: GPT_SYSTEM_PROMPT }];
    this.foundProducts.clear();
  }
}
