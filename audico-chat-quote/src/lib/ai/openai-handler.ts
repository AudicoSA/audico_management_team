/**
 * OpenAI Handler - Alternative to Claude
 * Uses GPT-4 for product recommendations
 */

import OpenAI from "openai";
import { AI_TOOLS_OPENAI, type ToolResult } from "./tools-openai";
import { MASTER_SYSTEM_PROMPT } from "./system-prompts";
import { ProductSearchEngine } from "./product-search-engine";
import { QuoteManager } from "./quote-manager";
import { getSupabaseServer } from "@/lib/supabase";
import type { Product } from "@/lib/types";

interface ConversationContext {
  sessionId: string;
  currentQuoteId?: string;
  conversationHistory: OpenAI.ChatCompletionMessageParam[];
  currentQuote?: any;
  selectedProducts?: any[];
}

interface ChatResponse {
  message: string;
  products?: Product[];
  quoteId?: string;
  quoteItems?: any[];
  needsMoreInfo?: boolean;
  isComplete?: boolean;
  totalPrice?: number;
  consultationRequest?: any;
  isEscalated?: boolean;
}

export class OpenAIConversationHandler {
  private openai: OpenAI;
  private context: ConversationContext;
  private quoteManager: QuoteManager;

  constructor(sessionId: string, quoteId?: string) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.quoteManager = new QuoteManager();

    this.context = {
      sessionId,
      currentQuoteId: quoteId,
      conversationHistory: [],
    };
  }

  async chat(customerMessage: string): Promise<ChatResponse> {
    console.log(`\n[OpenAIHandler] 🎯 Processing: "${customerMessage}"`);
    console.log(`[OpenAIHandler] Session: ${this.context.sessionId}`);

    // Add user message to history
    this.context.conversationHistory.push({
      role: "user",
      content: customerMessage,
    });

    try {
      // Call OpenAI with function calling
      let response = await this.openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: [
          { role: "system", content: MASTER_SYSTEM_PROMPT },
          ...this.context.conversationHistory,
        ],
        tools: AI_TOOLS_OPENAI,
        tool_choice: "auto",
      });

      let iterations = 0;
      const maxIterations = 10;
      let latestQuoteItems: any[] | undefined; // Track quote items for immediate cart updates

      while (response.choices[0].finish_reason === "tool_calls" && iterations < maxIterations) {
        iterations++;
        console.log(`[OpenAIHandler] 🔧 Tool iteration ${iterations}`);

        const toolCalls = response.choices[0].message.tool_calls || [];

        // Add assistant message to history
        this.context.conversationHistory.push(response.choices[0].message);

        // Execute tools
        for (const toolCall of toolCalls) {
          const functionName = toolCall.function.name;
          const functionArgs = JSON.parse(toolCall.function.arguments);

          console.log(`[OpenAIHandler] Executing tool: ${functionName}`);

          const result = await this.executeTool(functionName, functionArgs);

          // Capture quote items if product was added
          if (functionName === "add_to_quote" && result.success && result.data?.quoteItems) {
            latestQuoteItems = result.data.quoteItems;
            console.log(`[OpenAIHandler] 🛒 Quote updated: ${latestQuoteItems?.length || 0} items in cart`);
          }

          // Check for final recommendation
          if (functionName === "provide_final_recommendation") {
            const products = await ProductSearchEngine.getProductsBySkus(
              functionArgs.products.map((p: any) => p.sku)
            );

            return {
              message: functionArgs.explanation,
              products,
              quoteItems: latestQuoteItems, // Include updated quote items
              totalPrice: functionArgs.total_price,
            };
          }

          // Add tool result to history
          this.context.conversationHistory.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify(result),
          });
        }

        // Get next response
        response = await this.openai.chat.completions.create({
          model: "gpt-4-turbo-preview",
          messages: [
            { role: "system", content: MASTER_SYSTEM_PROMPT },
            ...this.context.conversationHistory,
          ],
          tools: AI_TOOLS_OPENAI,
          tool_choice: "auto",
        });
      }

      // Extract final text response
      const message = response.choices[0].message.content || "How can I help you?";

      // Add to history
      this.context.conversationHistory.push({
        role: "assistant",
        content: message,
      });

      return {
        message,
        products: [],
        quoteItems: latestQuoteItems, // Include updated quote items
      };
    } catch (error) {
      console.error("[OpenAIHandler] ❌ Error:", error);
      return {
        message: "I apologize, I encountered an issue. Could you please rephrase your request?",
        products: [],
      };
    }
  }

  private async executeTool(name: string, input: Record<string, unknown>): Promise<ToolResult> {
    try {
      console.log(`[OpenAIHandler] Executing tool: ${name}`);

      switch (name) {
        case "search_products_by_category":
          return await this.handleSearchByCategory(input);

        case "search_products_by_keyword":
          return await this.handleSearchByKeyword(input);

        case "filter_products":
          return await this.handleFilterProducts(input);

        case "get_product_details":
          return await this.handleGetProductDetails(input);

        case "create_quote":
          return await this.handleCreateQuote(input);

        case "add_to_quote":
          return await this.handleAddToQuote(input);

        case "update_quote":
          return await this.handleUpdateQuote(input);

        case "ask_clarifying_question":
          return await this.handleAskClarifyingQuestion(input);

        case "create_consultation_request":
          return await this.handleCreateConsultationRequest(input);

        case "provide_final_recommendation":
          // This tool doesn't need a handler - we handle it in the main loop
          return { success: true, message: "Final recommendation provided" };

        default:
          return { success: false, error: `Unknown tool: ${name}` };
      }
    } catch (error: any) {
      console.error(`[OpenAIHandler] Tool execution failed: ${name}`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Tool Handlers
   */

  private async handleSearchByCategory(input: Record<string, unknown>): Promise<ToolResult> {
    const category = input.category as string;
    const minPrice = input.minPrice as number | undefined;
    const maxPrice = input.maxPrice as number | undefined;
    const limit = input.limit as number | undefined;

    const products = await ProductSearchEngine.searchByCategory(
      category as any,
      { minPrice, maxPrice, limit }
    );

    return {
      success: true,
      data: products.map((p) => ({
        sku: p.sku,
        name: p.name,
        brand: p.brand,
        price: p.price,
        category: p.category,
        in_stock: p.stock.total > 0,
        stock_jhb: p.stock.jhb,
        use_case: p.useCase,
      })),
      message: `Found ${products.length} products in category ${category}`,
    };
  }

  private async handleSearchByKeyword(input: Record<string, unknown>): Promise<ToolResult> {
    const keywords = input.keywords as string;
    const minPrice = input.minPrice as number | undefined;
    const maxPrice = input.maxPrice as number | undefined;
    const limit = input.limit as number | undefined;

    const products = await ProductSearchEngine.searchByKeywords(keywords, { minPrice, maxPrice, limit });

    return {
      success: true,
      data: products.map((p) => ({
        sku: p.sku,
        name: p.name,
        brand: p.brand,
        price: p.price,
        category: p.category,
        in_stock: p.stock.total > 0,
        stock_jhb: p.stock.jhb,
        use_case: p.useCase,
      })),
      message: `Found ${products.length} products matching "${keywords}"`,
    };
  }

  private async handleFilterProducts(input: Record<string, unknown>): Promise<ToolResult> {
    const productSkus = input.products as string[];

    if (!productSkus || !Array.isArray(productSkus) || productSkus.length === 0) {
      return {
        success: false,
        error: "products parameter is required and must be a non-empty array of SKUs",
      };
    }

    const passive_only = input.passive_only as boolean | undefined;
    const brand = input.brand as string | undefined;
    const min_price = input.min_price as number | undefined;
    const max_price = input.max_price as number | undefined;
    const component_type = input.component_type as string | undefined;
    const in_stock_only = input.in_stock_only as boolean | undefined;

    const products = await ProductSearchEngine.filterProducts(productSkus, {
      passive_only,
      brand,
      min_price,
      max_price,
      component_type,
      in_stock_only,
    });

    return {
      success: true,
      data: products.map((p) => ({
        sku: p.sku,
        name: p.name,
        brand: p.brand,
        price: p.price,
        in_stock: p.stock.total > 0,
      })),
      message: `Filtered to ${products.length} products`,
    };
  }

  private async handleGetProductDetails(input: Record<string, unknown>): Promise<ToolResult> {
    const sku = input.sku as string;

    const product = await ProductSearchEngine.getProductDetails(sku);

    if (!product) {
      return {
        success: false,
        error: `Product ${sku} not found`,
      };
    }

    return {
      success: true,
      data: {
        sku: product.sku,
        name: product.name,
        brand: product.brand,
        price: product.price,
        category: product.category,
        specifications: product.specifications,
        in_stock: product.stock.total > 0,
        stock: product.stock,
        images: product.images,
      },
      message: `Product details for ${sku}`,
    };
  }

  private async handleCreateQuote(input: Record<string, unknown>): Promise<ToolResult> {
    const quote_type = input.quote_type as string;
    const requirements = input.requirements as any;

    const quoteId = await this.quoteManager.createQuote(this.context.sessionId, quote_type, requirements);
    this.context.currentQuoteId = quoteId;

    return {
      success: true,
      data: { quote_id: quoteId },
      message: `Quote ${quoteId} created`,
    };
  }

  private async handleAddToQuote(input: Record<string, unknown>): Promise<ToolResult> {
    const quote_id = input.quote_id as string;
    const sku = input.sku as string;
    const quantity = (input.quantity as number) || 1;
    const reason = input.reason as string | undefined;

    await this.quoteManager.addProduct(quote_id, sku, quantity, reason);

    // Get the updated quote items to return to frontend for immediate cart update
    const quoteItems = await this.quoteManager.getQuoteItems(quote_id);

    return {
      success: true,
      data: {
        sku,
        quantity,
        quoteItems, // Include full quote items for immediate frontend update
      },
      message: `Added ${sku} to quote`,
    };
  }

  private async handleUpdateQuote(input: Record<string, unknown>): Promise<ToolResult> {
    const quote_id = input.quote_id as string;
    const updates = input.updates as any;

    const result = await this.quoteManager.updateQuote(quote_id, updates);

    return {
      success: true,
      data: result,
      message: `Quote ${quote_id} updated`,
    };
  }

  private async handleAskClarifyingQuestion(input: Record<string, unknown>): Promise<ToolResult> {
    const question = input.question as string;
    const reason = input.reason as string;
    const options = input.options as string[] | undefined;

    return {
      success: true,
      data: { question, reason, options },
      message: `Asked clarifying question: ${question}`,
    };
  }

  private async handleCreateConsultationRequest(input: Record<string, unknown>): Promise<ToolResult> {
    try {
      console.log(`[OpenAIHandler] 📝 Creating consultation request...`);

      // Extract and validate required fields
      const customer_email = input.customer_email as string;
      const project_type = input.project_type as string;
      const budget_total = input.budget_total as number;
      const zones = input.zones as any[];
      const requirements_summary = input.requirements_summary as string;

      // Validate required fields
      if (!customer_email || !project_type || !budget_total || !zones || !requirements_summary) {
        return {
          success: false,
          error: "Missing required fields: customer_email, project_type, budget_total, zones, requirements_summary",
        };
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(customer_email)) {
        return {
          success: false,
          error: "Invalid email address format",
        };
      }

      // Validate zones array
      if (!Array.isArray(zones) || zones.length === 0) {
        return {
          success: false,
          error: "At least one zone is required",
        };
      }

      // Import consultation manager
      const { consultationRequestManager } = await import("./consultation-request-manager");

      // Create consultation request using manager
      const request = await consultationRequestManager.createRequest({
        sessionId: this.context.sessionId,
        customerName: input.customer_name as string | undefined,
        customerEmail: customer_email,
        customerPhone: input.customer_phone as string | undefined,
        companyName: input.company_name as string | undefined,
        projectType: project_type as any,
        budgetTotal: budget_total,
        timeline: input.timeline as string | undefined,
        zones: zones,
        requirementsSummary: requirements_summary,
        technicalNotes: input.technical_notes as string | undefined,
        existingEquipment: input.existing_equipment as string | undefined,
        complexityScore: input.complexity_score as number | undefined,
        priority: input.priority as any,
      });

      console.log(`[OpenAIHandler] ✅ Consultation request created: ${request.referenceCode}`);

      return {
        success: true,
        data: {
          reference_code: request.referenceCode,
          id: request.id,
          customer_email: request.customerEmail,
          project_type: request.projectType,
          budget_total: request.budgetTotal,
          zone_count: request.zoneCount,
          status: request.status,
          created_at: request.createdAt,
        },
        message: `Consultation request ${request.referenceCode} created successfully`,
      };
    } catch (error: any) {
      console.error(`[OpenAIHandler] ❌ Failed to create consultation request:`, error);
      return {
        success: false,
        error: error.message || "Failed to create consultation request",
      };
    }
  }
}
