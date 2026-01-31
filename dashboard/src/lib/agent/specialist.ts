import Anthropic from "@anthropic-ai/sdk";
import { searchProducts } from "@/lib/search";
import { getSupabaseServer } from "@/lib/supabase";
import type { Product, Step, Requirements, QuoteItem } from "@/lib/types";
import { PRODUCT_KNOWLEDGE } from "./knowledge";

/**
 * Context passed to the specialist agent for making recommendations
 */
export interface AgentContext {
  currentStep: Step;
  requirements: Requirements;
  selectedProducts: QuoteItem[];
  quoteId: string;
}

/**
 * Tool definitions for the Claude agent
 */
const AGENT_TOOLS: Anthropic.Tool[] = [
  {
    name: "search_products",
    description:
      "Search for audio products matching criteria. Use this to find products for the current step. Returns up to 20 products with name, brand, price, category, and stock info.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Search query - include brand names and product type keywords",
        },
        category: {
          type: "string",
          description: "Product category to filter by (e.g., 'AMPLIFIERS', 'SPEAKERS')",
        },
        minPrice: {
          type: "number",
          description: "Minimum price in South African Rand",
        },
        maxPrice: {
          type: "number",
          description: "Maximum price in South African Rand",
        },
        brand: {
          type: "string",
          description: "Filter by specific brand",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_product_details",
    description:
      "Get detailed specifications for a specific product by SKU. Returns full product info including specs, stock levels, and pricing.",
    input_schema: {
      type: "object" as const,
      properties: {
        sku: {
          type: "string",
          description: "Product SKU code",
        },
      },
      required: ["sku"],
    },
  },
  {
    name: "check_compatibility",
    description:
      "Check if an amplifier and speaker combination is compatible. Checks power output, impedance, and connection compatibility.",
    input_schema: {
      type: "object" as const,
      properties: {
        ampSku: {
          type: "string",
          description: "Amplifier SKU",
        },
        speakerSku: {
          type: "string",
          description: "Speaker SKU",
        },
      },
      required: ["ampSku", "speakerSku"],
    },
  },
  {
    name: "recommend_products",
    description:
      "Return your final product recommendations to the user. This must be called to complete the recommendation process.",
    input_schema: {
      type: "object" as const,
      properties: {
        products: {
          type: "array",
          items: {
            type: "object",
            properties: {
              sku: { type: "string" },
              reason: {
                type: "string",
                description: "Brief reason why this product is recommended (1-2 sentences)",
              },
            },
            required: ["sku", "reason"],
          },
          description: "List of recommended products with SKUs and reasons",
        },
        message: {
          type: "string",
          description: "Message to display to user explaining the recommendations",
        },
      },
      required: ["products", "message"],
    },
  },
];

/**
 * Specialist Agent for intelligent product recommendations
 * Uses Claude with tool-calling to search, analyze, and recommend products
 */
export class SpecialistAgent {
  private anthropic: Anthropic;
  private context: AgentContext;

  constructor(context: AgentContext) {
    this.anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
    this.context = context;
  }

  /**
   * Get product recommendations for the current step
   * The agent will use tools to search and analyze products
   */
  async getRecommendations(userMessage?: string): Promise<{
    products: Product[];
    message: string;
    reasoning?: string;
  }> {
    const systemPrompt = this.buildSystemPrompt();
    const userPrompt =
      userMessage ||
      `Find the best ${this.context.currentStep.label} options for this system.`;

    console.log("[SpecialistAgent] Starting recommendation for:", this.context.currentStep.label);

    try {
      // Initial request to Claude
      let response = await this.anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4000,
        system: systemPrompt,
        tools: AGENT_TOOLS,
        messages: [{ role: "user", content: userPrompt }],
      });

      // Process tool calls in a loop until we get final recommendations
      let iterations = 0;
      const maxIterations = 5;
      const messages: Anthropic.MessageParam[] = [{ role: "user", content: userPrompt }];

      while (response.stop_reason === "tool_use" && iterations < maxIterations) {
        iterations++;
        console.log(`[SpecialistAgent] Tool iteration ${iterations}`);

        // Process all tool calls
        const toolResults: Anthropic.ToolResultBlockParam[] = [];

        for (const block of response.content) {
          if (block.type === "tool_use") {
            console.log(`[SpecialistAgent] Executing tool: ${block.name}`);
            const result = await this.executeTool(block.name, block.input as Record<string, unknown>);
            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: JSON.stringify(result),
            });
          }
        }

        // Check if we got recommend_products tool call - that's our final answer
        const recommendBlock = response.content.find(
          (b) => b.type === "tool_use" && b.name === "recommend_products"
        );

        if (recommendBlock && recommendBlock.type === "tool_use") {
          const input = recommendBlock.input as { products: { sku: string; reason: string }[]; message: string };
          const skus = input.products.map((p) => p.sku);
          const products = await this.getProductsBySkus(skus);

          console.log(`[SpecialistAgent] Final recommendations: ${products.length} products`);

          return {
            products,
            message: input.message,
            reasoning: input.products.map((p) => `${p.sku}: ${p.reason}`).join("\n"),
          };
        }

        // Continue conversation with tool results
        messages.push({ role: "assistant", content: response.content });
        messages.push({ role: "user", content: toolResults });

        response = await this.anthropic.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4000,
          system: systemPrompt,
          tools: AGENT_TOOLS,
          messages,
        });
      }

      // If we didn't get a recommend_products call, extract text response
      const textBlock = response.content.find((b) => b.type === "text");
      console.log("[SpecialistAgent] No tool call, using text response");

      return {
        products: [],
        message:
          (textBlock as Anthropic.TextBlock)?.text ||
          "I couldn't find specific recommendations. Please try searching manually.",
      };
    } catch (error) {
      console.error("[SpecialistAgent] Error:", error);
      throw error;
    }
  }

  /**
   * Build the system prompt with full context
   */
  private buildSystemPrompt(): string {
    const componentKnowledge = PRODUCT_KNOWLEDGE.componentTypes[
      this.context.currentStep.component as keyof typeof PRODUCT_KNOWLEDGE.componentTypes
    ];

    return `You are an expert audio system designer for Audico, a South African audio retailer. You help customers build complete audio systems by recommending the best products for each component.

## CURRENT TASK
Find products for: **${this.context.currentStep.label}**
Description: ${this.context.currentStep.description}
Budget allocation: R${this.context.currentStep.budget.min.toLocaleString()} - R${this.context.currentStep.budget.max.toLocaleString()}

## SYSTEM REQUIREMENTS
- System type: ${this.context.requirements.type}
- Total budget: R${this.context.requirements.budgetTotal?.toLocaleString() || "flexible"}
- Use case: ${this.context.requirements.useCase || "Home"}
${this.context.requirements.channels ? `- Channels: ${this.context.requirements.channels}` : ""}
${this.context.requirements.zoneCount ? `- Zones: ${this.context.requirements.zoneCount}` : ""}

## ALREADY SELECTED PRODUCTS
${
  this.context.selectedProducts.length > 0
    ? this.context.selectedProducts
        .map(
          (p) =>
            `- ${p.product.name} (${p.product.brand}) - R${p.product.price.toLocaleString()}`
        )
        .join("\n")
    : "Nothing selected yet"
}

${
  componentKnowledge
    ? `## PRODUCT KNOWLEDGE FOR ${this.context.currentStep.component.toUpperCase()}
${componentKnowledge.description}
Examples: ${componentKnowledge.examples.join(", ")}
NOT suitable: ${componentKnowledge.NOT.join(", ")}
${componentKnowledge.compatibility}`
    : ""
}

## BRAND MATCHING RULE
${
  this.context.selectedProducts.some((p) => p.product.brand)
    ? `The customer has already selected ${this.context.selectedProducts[0]?.product.brand} products. Try to recommend matching brands for a cohesive system.`
    : "No brand preference yet."
}

## INSTRUCTIONS
1. Use search_products to find relevant products. Include brand names and specific product type keywords.
2. Optionally use get_product_details to get more info on promising products.
3. If the customer selected an amp already, use check_compatibility to verify speaker matches.
4. MUST call recommend_products with your final 6-10 product recommendations and explanations.
5. Consider price, brand matching, stock availability, and technical compatibility.

Prices are in South African Rand (R). Focus on products appropriate for the ${this.context.requirements.useCase || "Home"} market.`;
  }

  /**
   * Execute a tool and return the result
   */
  private async executeTool(name: string, input: Record<string, unknown>): Promise<unknown> {
    switch (name) {
      case "search_products": {
        const results = await searchProducts(
          input.query as string,
          {
            category: input.category as string | undefined,
            minPrice: input.minPrice as number | undefined,
            maxPrice: input.maxPrice as number | undefined,
            brand: input.brand as string | undefined,
          },
          20
        );
        // Return simplified product info for the agent
        return results.map((p) => ({
          sku: p.sku,
          name: p.name,
          brand: p.brand,
          category: p.category,
          price: p.price,
          stock: p.stock.total,
          inStock: p.stock.total > 0,
        }));
      }

      case "get_product_details": {
        const supabase = getSupabaseServer();
        const { data } = await supabase
          .from("products")
          .select("*")
          .eq("sku", input.sku as string)
          .single();

        if (!data) return { error: "Product not found" };

        return {
          sku: data.sku,
          name: data.product_name,
          brand: data.brand,
          category: data.category_name,
          price: data.retail_price,
          specifications: data.specifications,
          stock: {
            jhb: data.stock_jhb,
            cpt: data.stock_cpt,
            dbn: data.stock_dbn,
            total: (data.stock_jhb || 0) + (data.stock_cpt || 0) + (data.stock_dbn || 0),
          },
        };
      }

      case "check_compatibility": {
        // For now, return basic compatibility info
        // In future, this could check actual specifications
        const ampSku = input.ampSku as string;
        const speakerSku = input.speakerSku as string;

        // Get both products
        const supabase = getSupabaseServer();
        const [ampResult, speakerResult] = await Promise.all([
          supabase.from("products").select("*").eq("sku", ampSku).single(),
          supabase.from("products").select("*").eq("sku", speakerSku).single(),
        ]);

        if (!ampResult.data || !speakerResult.data) {
          return { error: "One or both products not found" };
        }

        // Basic compatibility check based on product types
        const ampName = ampResult.data.product_name.toLowerCase();
        const speakerName = speakerResult.data.product_name.toLowerCase();

        const isCompatible =
          !ampName.includes("100v") || speakerName.includes("100v") || speakerName.includes("transformer");

        return {
          compatible: isCompatible,
          ampName: ampResult.data.product_name,
          speakerName: speakerResult.data.product_name,
          notes: isCompatible
            ? "These products should be compatible for typical installations."
            : "Warning: 100V line equipment requires matching 100V speakers.",
        };
      }

      case "recommend_products":
        // This is handled specially in getRecommendations
        return input;

      default:
        return { error: `Unknown tool: ${name}` };
    }
  }

  /**
   * Get full product objects by SKUs
   */
  private async getProductsBySkus(skus: string[]): Promise<Product[]> {
    if (skus.length === 0) return [];

    const supabase = getSupabaseServer();
    const { data } = await supabase.from("products").select("*").in("sku", skus);

    return (data || []).map(this.transformProduct);
  }

  /**
   * Transform database product to Product type
   */
  private transformProduct(dbProduct: Record<string, unknown>): Product {
    return {
      id: dbProduct.id as string,
      name: dbProduct.product_name as string,
      sku: dbProduct.sku as string,
      model: dbProduct.model as string | null,
      brand: dbProduct.brand as string | null,
      category: dbProduct.category_name as string | null,
      price: parseFloat(String(dbProduct.retail_price || 0)),
      cost: parseFloat(String(dbProduct.cost_price || 0)),
      stock: {
        total:
          ((dbProduct.stock_jhb as number) || 0) +
          ((dbProduct.stock_cpt as number) || 0) +
          ((dbProduct.stock_dbn as number) || 0),
        jhb: (dbProduct.stock_jhb as number) || 0,
        cpt: (dbProduct.stock_cpt as number) || 0,
        dbn: (dbProduct.stock_dbn as number) || 0,
      },
      images: (dbProduct.images as string[]) || [],
      specifications: (dbProduct.specifications as Record<string, unknown>) || {},
      useCase: dbProduct.use_case as string | undefined,
    };
  }
}
