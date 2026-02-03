/**
 * Master Claude Conversation Handler
 *
 * This is the core of the AI-native chat quote system. It routes ALL customer messages
 * through Claude, which uses tools to search products, manage quotes, and provide recommendations.
 *
 * This replaces fragile regex patterns with true natural language understanding.
 */

import Anthropic from "@anthropic-ai/sdk";
import { AI_TOOLS, type ToolContext, type ToolResult } from "./tools";
import { MASTER_SYSTEM_PROMPT } from "./system-prompts";
import { ProductSearchEngine } from "./product-search-engine";
import { QuoteManager } from "./quote-manager";
import { SystemDesignEngine } from "@/lib/flows/system-design/engine";
import { getSupabaseServer } from "@/lib/supabase";
import type { Product } from "@/lib/types";
import { analyzeComplexity, type ComplexityAnalysis, explainComplexity } from "./complexity-detector";
import { consultationRequestManager } from "./consultation-request-manager";

// Configurable model with fallback
const CLAUDE_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5-20250929";
const MAX_RETRIES = Number(process.env.ANTHROPIC_MAX_RETRIES) || 3;

/**
 * Retry helper with exponential backoff
 * Delays: 1s, 2s, 4s for retries 1, 2, 3
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = MAX_RETRIES
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      const isLastAttempt = i === maxRetries - 1;
      if (isLastAttempt) throw error;

      // Don't retry on client errors (400-499) except rate limits (429)
      const status = error?.status || error?.response?.status;
      if (status >= 400 && status < 500 && status !== 429) {
        throw error;
      }

      const delay = Math.pow(2, i) * 1000;
      console.warn(`[ClaudeHandler] ⚠️ Retry ${i + 1}/${maxRetries} after ${delay}ms...`, error?.message);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error("Unreachable");
}

interface ConversationContext {
  sessionId: string;
  currentQuoteId?: string;
  conversationHistory: Anthropic.MessageParam[];
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

export class ClaudeConversationHandler {
  private anthropic: Anthropic;
  private context: ConversationContext;
  private quoteManager: QuoteManager;
  private supabase = getSupabaseServer();

  constructor(sessionId: string, quoteId?: string) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is not configured");
    }

    this.anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    this.quoteManager = new QuoteManager();

    this.context = {
      sessionId,
      currentQuoteId: quoteId,
      conversationHistory: [],
    };

    // Load conversation history from database (async - happens in background)
    this.loadConversationHistoryFromDB();
  }

  /**
   * Load current quote context (if quote exists)
   * This populates context.currentQuote with full quote details including steps
   */
  private async loadQuoteContext(): Promise<void> {
    if (!this.context.currentQuoteId) {
      return;
    }

    try {
      const engine = await SystemDesignEngine.load(this.context.currentQuoteId);
      if (engine) {
        this.context.currentQuote = engine.getSummary();
        this.context.selectedProducts = this.context.currentQuote.selectedProducts;
      }
    } catch (error) {
      console.error("[ClaudeHandler] Failed to load quote context:", error);
    }
  }

  /**
   * Build context message with current quote state
   * This helps Claude understand where we are in the design process
   */
  private buildContextMessage(): string {
    const quote = this.context.currentQuote;
    if (!quote || !quote.steps) {
      return "";
    }

    const currentStep = quote.steps[quote.currentStepIndex];
    const selectedProducts = quote.selectedProducts || [];
    const budgetTotal = quote.requirements?.budgetTotal || 0;
    const budgetSpent = selectedProducts.reduce((sum: number, p: any) => sum + p.lineTotal, 0);
    const budgetRemaining = budgetTotal - budgetSpent;

    let contextMessage = `[SYSTEM CONTEXT - Current Quote State]\n`;
    contextMessage += `Quote ID: ${quote.id}\n`;
    contextMessage += `System Type: ${quote.requirements?.channels || quote.requirements?.type || "Unknown"}\n`;
    contextMessage += `Current Step: ${currentStep?.label || "Unknown"} (Step ${quote.currentStepIndex + 1} of ${quote.steps.length})\n`;

    if (budgetTotal > 0) {
      contextMessage += `\nBudget:\n`;
      contextMessage += `- Total: R${budgetTotal.toLocaleString()}\n`;
      contextMessage += `- Spent: R${budgetSpent.toLocaleString()}\n`;
      contextMessage += `- Remaining: R${budgetRemaining.toLocaleString()}\n`;

      // Add budget warnings if approaching limit
      const budgetUsedPercent = (budgetSpent / budgetTotal) * 100;
      if (budgetUsedPercent >= 80) {
        contextMessage += `\n⚠️  WARNING: ${budgetUsedPercent.toFixed(0)}% of budget used! Recommend affordable options only.\n`;
      } else if (budgetUsedPercent >= 60) {
        contextMessage += `\n⚠️  NOTE: ${budgetUsedPercent.toFixed(0)}% of budget used. Watch remaining budget carefully.\n`;
      }

      // Calculate recommended max price for next component (leave 10-15% buffer)
      const stepsRemaining = quote.steps.length - quote.currentStepIndex - 1;
      if (stepsRemaining > 0) {
        const recommendedMaxPerComponent = budgetRemaining * 0.85 / stepsRemaining;
        contextMessage += `- Recommended max per component: R${recommendedMaxPerComponent.toLocaleString()} (${stepsRemaining} steps remaining)\n`;
      }
    }

    if (selectedProducts.length > 0) {
      contextMessage += `\nSelected Products So Far:\n`;
      selectedProducts.forEach((p: any) => {
        contextMessage += `- ${p.product.name} (R${p.product.price.toLocaleString()})\n`;
      });
    } else {
      contextMessage += `\nSelected Products: None yet\n`;
    }

    const additionalZones = quote.requirements?.additionalZones;
    if (additionalZones && additionalZones.length > 0) {
      const zoneNames = additionalZones.map((z: any) => z.name).join(', ');
      contextMessage += `\nPending Additional Zones: ${zoneNames}\n`;
    }

    contextMessage += `\nYour Current Task: ${this.getStepInstruction(currentStep)}\n`;

    return contextMessage.trim();
  }

  /**
   * Get instruction for current step
   */
  private getStepInstruction(step: any): string {
    if (!step) return "Continue helping the customer";

    const component = step.component;
    switch (component) {
      case "avr":
        return "Search for AVRs/Receivers and show 3-4 options with provide_final_recommendation";
      case "fronts":
        return "Search for front speakers and show 3-4 options with provide_final_recommendation";
      case "center":
        return "Search for center channel speakers and show 3-4 options with provide_final_recommendation";
      case "surrounds":
        return "Search for surround speakers and show 3-4 options with provide_final_recommendation";
      case "subwoofer":
        return "Search for subwoofers and show 2-3 options with provide_final_recommendation";
      case "height":
        return "Search for height/Atmos speakers and show 2-3 options with provide_final_recommendation";
      case "amp":
        return "Search for amplifiers and show 3-4 options with provide_final_recommendation";
      case "ceiling_speakers":
        return "Search for ceiling speakers and show 3-4 options with provide_final_recommendation";
      default:
        return `Search for ${step.label} and show options with provide_final_recommendation`;
    }
  }

  /**
   * Load conversation history from database
   * Called in constructor to restore previous conversation
   */
  private async loadConversationHistoryFromDB(): Promise<void> {
    try {
      const { data, error } = await this.supabase
        .from('conversation_history')
        .select('role, content')
        .eq('session_id', this.context.sessionId)
        .order('message_index', { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        this.context.conversationHistory = data.map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content
        }));
        console.log(`[ClaudeHandler] ✅ Loaded ${data.length} messages from history`);
      } else {
        console.log('[ClaudeHandler] 📝 No previous conversation history found');
      }
    } catch (error) {
      console.warn('[ClaudeHandler] ⚠️ Non-critical: Failed to load conversation history:', error);
      // Continue without history - conversation will start fresh
    }
  }

  /**
   * Save a message to the database
   * Called after each user/assistant message to persist conversation
   */
  private async saveMessage(
    role: "user" | "assistant",
    content: any
  ): Promise<void> {
    try {
      await this.supabase.from('conversation_history').insert({
        session_id: this.context.sessionId,
        quote_id: this.context.currentQuoteId || null,
        message_index: this.context.conversationHistory.length,
        role,
        content,
      });
    } catch (error) {
      console.warn('[ClaudeHandler] ⚠️ Non-critical: Failed to save message:', error);
      // Don't throw - continue operation without breaking the chat
    }
  }

  /**
   * Main entry point - process a customer message
   */
  async chat(customerMessage: string): Promise<ChatResponse> {
    console.log(`\n[ClaudeHandler] 🎯 Processing: "${customerMessage}"`);
    console.log(`[ClaudeHandler] Session: ${this.context.sessionId}`);
    console.log(`[ClaudeHandler] Quote: ${this.context.currentQuoteId || "none"}`);

    // Load quote context if we have a quote ID
    await this.loadQuoteContext();

    // COMPLEXITY DETECTION (only on first message)
    let complexityAnalysis: ComplexityAnalysis | null = null;
    const isFirstMessage = this.context.conversationHistory.length === 0;

    if (isFirstMessage && !this.context.currentQuoteId) {
      // Analyze complexity of initial customer message
      complexityAnalysis = analyzeComplexity(customerMessage);

      console.log(`[ClaudeHandler] 🔍 Complexity Analysis:`);
      console.log(explainComplexity(complexityAnalysis));

      if (complexityAnalysis.shouldEscalate) {
        console.log(`[ClaudeHandler] ⚠️  COMPLEX PROJECT DETECTED - AI should escalate to specialist`);
      } else {
        console.log(`[ClaudeHandler] ✅ SIMPLE PROJECT - AI can handle autonomously`);
      }
    }

    // Build context message with current state
    const contextMessage = this.buildContextMessage();

    // Build complexity context if detected on first message
    let complexityContext = "";
    if (complexityAnalysis) {
      complexityContext = `[COMPLEXITY ANALYSIS]\n`;
      complexityContext += `Score: ${complexityAnalysis.score}/100\n`;
      complexityContext += `Should Escalate: ${complexityAnalysis.shouldEscalate ? "YES ⚠️" : "NO ✅"}\n`;
      if (complexityAnalysis.reasons.length > 0) {
        complexityContext += `Reasons:\n${complexityAnalysis.reasons.map(r => `- ${r}`).join('\n')}\n`;
      }
      complexityContext += `\n`;

      if (complexityAnalysis.shouldEscalate) {
        complexityContext += `⚠️ IMPORTANT: This is a COMPLEX project. Follow the "COMPLEX PROJECTS (Escalate to Specialist)" workflow from your system prompt. Gather requirements and use create_consultation_request tool.\n\n`;
      }
    }

    // Add customer message to history (with context prepended if available)
    if (contextMessage || complexityContext) {
      // Inject context before user message
      const userContent: any[] = [];

      if (contextMessage) {
        userContent.push({
          type: "text",
          text: contextMessage,
        });
      }

      if (complexityContext) {
        userContent.push({
          type: "text",
          text: complexityContext,
        });
      }

      userContent.push({
        type: "text",
        text: customerMessage,
      });

      this.context.conversationHistory.push({
        role: "user",
        content: userContent,
      });
      // Persist to database (async - don't wait)
      this.saveMessage("user", userContent);
      console.log(`[ClaudeHandler] 📊 Context injected: ${(contextMessage + complexityContext).substring(0, 150)}...`);
    } else {
      // No context, just add the message
      this.context.conversationHistory.push({
        role: "user",
        content: customerMessage,
      });
      // Persist to database (async - don't wait)
      this.saveMessage("user", customerMessage);
    }

    try {
      // Create initial request to Claude
      let response = await withRetry(() => this.anthropic.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 4000,
        system: MASTER_SYSTEM_PROMPT,
        tools: AI_TOOLS,
        messages: this.context.conversationHistory,
      }));

      console.log(`[ClaudeHandler] Initial response stop_reason: ${response.stop_reason}`);

      // Process tool calls in a loop
      let iterations = 0;
      const maxIterations = 10; // Allow multiple tool calls
      let consultationRequest: any = null;
      let isEscalated = false;

      while (response.stop_reason === "tool_use" && iterations < maxIterations) {
        iterations++;
        console.log(`[ClaudeHandler] 🔧 Tool iteration ${iterations}`);

        const toolResults: Anthropic.ToolResultBlockParam[] = [];

        // Process each tool call in the response
        for (const block of response.content) {
          if (block.type === "tool_use") {
            console.log(`[ClaudeHandler] Executing tool: ${block.name}`);
            console.log(`[ClaudeHandler] Tool input:`, JSON.stringify(block.input, null, 2));

            const result = await this.executeTool(block.name, block.input as Record<string, unknown>);

            console.log(`[ClaudeHandler] Tool result:`, JSON.stringify(result, null, 2).slice(0, 500));

            // Capture consultation request if created
            if (block.name === "create_consultation_request" && result.success) {
              consultationRequest = result.data;
              isEscalated = true;
              console.log(`[ClaudeHandler] 🚨 Project escalated: ${consultationRequest.reference_code}`);
            }

            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: JSON.stringify(result),
            });

            // Check for final recommendation
            if (block.name === "provide_final_recommendation") {
              const input = block.input as {
                quote_id?: string;
                products: { sku: string; quantity?: number; reason: string }[];
                explanation: string;
                total_price: number;
                alternative_note?: string;
              };

              // Get full product objects
              const productSkus = input.products.map((p) => p.sku);
              const products = await ProductSearchEngine.getProductsBySkus(productSkus);

              // Build the final message
              let message = input.explanation;
              if (input.alternative_note) {
                message += `\n\n${input.alternative_note}`;
              }
              message += `\n\n**Total: R${input.total_price.toLocaleString()}**`;

              // Save to quote if we have a valid UUID
              if (input.quote_id) {
                // Validate UUID format (basic check)
                const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                if (uuidRegex.test(input.quote_id)) {
                  this.context.currentQuoteId = input.quote_id;
                } else {
                  console.warn(`[ClaudeHandler] Invalid quote_id format: ${input.quote_id}, ignoring`);
                }
              }

              // Add assistant response AND tool results to history (critical for context)
              this.context.conversationHistory.push({
                role: "assistant",
                content: response.content,
              });
              // Persist assistant message
              this.saveMessage("assistant", response.content);

              this.context.conversationHistory.push({
                role: "user",
                content: toolResults,
              });
              // Persist tool results as user message
              this.saveMessage("user", toolResults);

              console.log(`[ClaudeHandler] ✅ Final recommendation provided`);

              return {
                message,
                products,
                quoteId: this.context.currentQuoteId,
                // DON'T return quoteItems - products should be displayed for user selection, not auto-added
                isComplete: false,
                totalPrice: input.total_price,
                consultationRequest,
                isEscalated,
              };
            }

            // Check for clarifying question
            if (block.name === "ask_clarifying_question") {
              const input = block.input as { question: string; reason: string; options?: string[] };

              console.log(`[ClaudeHandler] ❓ Clarifying question: ${input.question}`);

              // Add assistant response AND tool results to history (critical for context)
              this.context.conversationHistory.push({
                role: "assistant",
                content: response.content,
              });
              // Persist assistant message
              this.saveMessage("assistant", response.content);

              this.context.conversationHistory.push({
                role: "user",
                content: toolResults,
              });
              // Persist tool results as user message
              this.saveMessage("user", toolResults);

              let message = input.question;
              if (input.options && input.options.length > 0) {
                message += "\n\n" + input.options.map((opt, i) => `${i + 1}. ${opt}`).join("\n");
              }

              return {
                message,
                products: [],
                needsMoreInfo: true,
                quoteId: this.context.currentQuoteId,
                consultationRequest,
                isEscalated,
              };
            }
          }
        }

        // Continue conversation with tool results
        this.context.conversationHistory.push({
          role: "assistant",
          content: response.content,
        });
        // Persist assistant message
        this.saveMessage("assistant", response.content);

        this.context.conversationHistory.push({
          role: "user",
          content: toolResults,
        });
        // Persist tool results as user message
        this.saveMessage("user", toolResults);

        // Get next response from Claude
        response = await withRetry(() => this.anthropic.messages.create({
          model: CLAUDE_MODEL,
          max_tokens: 4000,
          system: MASTER_SYSTEM_PROMPT,
          tools: AI_TOOLS,
          messages: this.context.conversationHistory,
        }));

        console.log(`[ClaudeHandler] Next response stop_reason: ${response.stop_reason}`);
      }

      // If we get here, extract text response
      const textBlock = response.content.find((b) => b.type === "text");
      const message = (textBlock as Anthropic.TextBlock)?.text || "I'm here to help! What can I do for you today?";

      // Add assistant response to history
      this.context.conversationHistory.push({
        role: "assistant",
        content: response.content,
      });
      // Persist assistant message
      this.saveMessage("assistant", response.content);

      console.log(`[ClaudeHandler] 💬 Text response provided`);

      // Get current quote items if we have a quote ID
      let quoteItems: any[] | undefined;
      if (this.context.currentQuoteId) {
        try {
          quoteItems = await this.quoteManager.getQuoteItems(this.context.currentQuoteId);
        } catch (error) {
          console.error("[ClaudeHandler] Failed to get quote items:", error);
        }
      }

      return {
        message,
        products: [],
        quoteId: this.context.currentQuoteId,
        quoteItems,
        consultationRequest,
        isEscalated,
      };

    } catch (error: any) {
      console.error("[ClaudeHandler] ❌ Error occurred:");
      console.error("[ClaudeHandler] Error name:", error?.name);
      console.error("[ClaudeHandler] Error message:", error?.message);
      console.error("[ClaudeHandler] Error stack:", error?.stack);
      try {
        console.error("[ClaudeHandler] Full error:", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      } catch { /* ignore serialization error */ }
      return {
        message: "I apologize, I encountered an issue. Could you please rephrase your request?",
        products: [],
      };
    }
  }

  /**
   * Execute a tool call
   */
  private async executeTool(name: string, input: Record<string, unknown>): Promise<ToolResult> {
    try {
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

        case "create_consultation_request":
          return await this.handleCreateConsultationRequest(input);

        case "ask_clarifying_question":
        case "provide_final_recommendation":
          // These are handled specially in the main loop
          return { success: true, data: input };

        default:
          console.warn(`[ClaudeHandler] Unknown tool: ${name}`);
          return { success: false, error: `Unknown tool: ${name}` };
      }
    } catch (error: any) {
      console.error(`[ClaudeHandler] Tool execution error (${name}):`, error);
      return { success: false, error: error.message || "Tool execution failed" };
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

    // BUDGET ENFORCEMENT VALIDATION
    // Log warning if no maxPrice constraint is applied
    if (!maxPrice) {
      console.warn(`[ClaudeHandler] ⚠️  Keyword search without maxPrice: "${keywords}"`);
      console.warn(`[ClaudeHandler] ⚠️  This may return budget-inappropriate results (cheapest products first)`);
      console.warn(`[ClaudeHandler] ⚠️  If customer stated a budget, Claude should pass maxPrice parameter`);
    } else {
      console.log(`[ClaudeHandler] 💰 Keyword search with budget constraint: "${keywords}" (maxPrice: R${maxPrice.toLocaleString()})`);
    }

    const products = await ProductSearchEngine.searchByKeywords(keywords, { minPrice, maxPrice, limit });

    // LOG THE PRICE RANGE OF RESULTS
    // This helps diagnose if cheap junk products are being returned
    if (products.length > 0) {
      const prices = products.map(p => p.price);
      const minFound = Math.min(...prices);
      const maxFound = Math.max(...prices);
      const avgFound = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);

      console.log(`[ClaudeHandler] 📊 Search returned ${products.length} products:`);
      console.log(`[ClaudeHandler] 💵 Price range: R${minFound.toLocaleString()} - R${maxFound.toLocaleString()} (avg: R${avgFound.toLocaleString()})`);

      // WARNING if average price seems too low for the search query
      if (avgFound < 1000 && !keywords.toLowerCase().includes('cable') && !keywords.toLowerCase().includes('accessory')) {
        console.warn(`[ClaudeHandler] ⚠️  Average price (R${avgFound}) seems very low for query: "${keywords}"`);
        console.warn(`[ClaudeHandler] ⚠️  Results may be junk products. Consider adding minPrice or maxPrice filters.`);
      }
    } else {
      console.log(`[ClaudeHandler] ℹ️  No products found for: "${keywords}"`);
    }

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

    // Validate required parameter
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

    // Map AI tools types to DB FlowType
    // Tool Types: "home_cinema", "commercial_bgm", "video_conference", "simple"
    // DB Types: "system_design", "simple_quote", "tender"

    let dbFlowType = "simple_quote";
    if (quote_type === "simple") {
      dbFlowType = "simple_quote";
    } else if (["home_cinema", "commercial_bgm", "commercial_loud", "video_conference", "worship"].includes(quote_type)) {
      dbFlowType = "system_design";
      // Store the specific subtype in requirements for UI rendering
      if (!requirements.type) {
        requirements.type = quote_type;
      }
    } else {
      // Fallback for unknown types (e.g. tender)
      dbFlowType = "simple_quote";
    }

    const quoteId = await this.quoteManager.createQuote(this.context.sessionId, dbFlowType, requirements);
    this.context.currentQuoteId = quoteId;

    return {
      success: true,
      data: { quote_id: quoteId },
      message: `Quote ${quoteId} created`,
    };
  }

  private async handleAddToQuote(input: Record<string, unknown>): Promise<ToolResult> {
    let quote_id = input.quote_id as string | undefined;
    const sku = input.sku as string;
    const quantity = (input.quantity as number) || 1;
    const reason = input.reason as string | undefined;

    // Resolve quote ID logic
    if (!quote_id) {
      quote_id = this.context.currentQuoteId;
    }

    if (!quote_id) {
      console.log("[ClaudeHandler] ⚠️ No quote ID found for add_to_quote - performing IMPLICIT creation");
      try {
        // Auto-create a "simple" quote so we can add the item
        quote_id = await this.quoteManager.createQuote(
          this.context.sessionId,
          "simple_quote", // FIXED: "simple" -> "simple_quote" to match DB constraint
          { budget_total: 0, notes: "Implicitly created via add_to_quote" }
        );
        this.context.currentQuoteId = quote_id;
        console.log(`[ClaudeHandler] ✅ Implicitly created quote: ${quote_id}`);
      } catch (e: any) {
        console.error("[ClaudeHandler] Failed to implicitly create quote:", e);
        return { success: false, error: "Failed to create quote context to add this item." };
      }
    }

    const result = await this.quoteManager.addProduct(quote_id, sku, quantity, reason);

    // SANITIZE RESULT FOR AI CONTEXT
    // Don't send the full heavy object to Claude, just what it needs
    const sanitizedResult = {
      sku: result.product.sku,
      name: result.product.name,
      price: result.product.price,
      quantity: result.quantity,
      lineTotal: result.lineTotal,
      quote_id: quote_id,
    };

    return {
      success: true,
      data: sanitizedResult,
      message: `Added ${sku} to quote`,
    };
  }

  private async handleUpdateQuote(input: Record<string, unknown>): Promise<ToolResult> {
    let quote_id = input.quote_id as string | undefined;

    // Resolve quote ID logic
    if (!quote_id) {
      quote_id = this.context.currentQuoteId;
    }

    if (!quote_id) {
      return { success: false, error: "No active quote to update. Please create a quote first." };
    }
    const updates = input.updates as any;

    const result = await this.quoteManager.updateQuote(quote_id, updates);

    return {
      success: true,
      data: result,
      message: `Quote ${quote_id} updated`,
    };
  }

  private async handleCreateConsultationRequest(input: Record<string, unknown>): Promise<ToolResult> {
    try {
      console.log(`[ClaudeHandler] 📝 Creating consultation request...`);

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

      console.log(`[ClaudeHandler] ✅ Consultation request created: ${request.referenceCode}`);

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
      console.error(`[ClaudeHandler] ❌ Failed to create consultation request:`, error);
      return {
        success: false,
        error: error.message || "Failed to create consultation request",
      };
    }
  }

  /**
   * Get conversation history (for debugging/logging)
   */
  getConversationHistory(): Anthropic.MessageParam[] {
    return this.context.conversationHistory;
  }

  /**
   * Get current quote ID
   */
  getCurrentQuoteId(): string | undefined {
    return this.context.currentQuoteId;
  }

  /**
   * Reset conversation (for testing)
   */
  reset(): void {
    this.context.conversationHistory = [];
    this.context.currentQuoteId = undefined;
  }
}
