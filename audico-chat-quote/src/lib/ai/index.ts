/**
 * AI-Native System - Main Exports
 *
 * This file exports all the components of the AI-native chat quote system.
 * Import from here for clean, centralized access.
 */

// Core conversation handler
export { ClaudeConversationHandler } from "./claude-handler";

// System prompts
export { MASTER_SYSTEM_PROMPT, CLARIFYING_QUESTIONS_PROMPT, ERROR_RECOVERY_PROMPT } from "./system-prompts";

// Tools
export { AI_TOOLS } from "./tools";
export type { ToolContext, ToolResult } from "./tools";

// Product search
export { ProductSearchEngine } from "./product-search-engine";

// Quote management
export { QuoteManager } from "./quote-manager";

/**
 * Quick Start Example:
 *
 * ```typescript
 * import { ClaudeConversationHandler } from "@/lib/ai";
 *
 * const handler = new ClaudeConversationHandler("session-123");
 * const response = await handler.chat("Need audio for my gym");
 *
 * console.log(response.message);
 * console.log(response.products);
 * ```
 */
