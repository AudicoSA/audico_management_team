/**
 * AI-Native Chat API Route
 *
 * This is the new AI-native endpoint that routes ALL messages through Claude.
 * No regex patterns. No intent detection. Just Claude understanding and tools.
 *
 * This is the future of the chat quote system.
 */

import { NextRequest, NextResponse } from "next/server";
import { ClaudeConversationHandler } from "@/lib/ai/claude-handler";
import { OpenAIConversationHandler } from "@/lib/ai/openai-handler";
import { v4 as uuidv4 } from "uuid";

// Choose AI provider based on environment variable
// Set AI_PROVIDER=openai in .env.local to use OpenAI/GPT-4
// Default is Claude (anthropic)
const AI_PROVIDER = process.env.AI_PROVIDER || "anthropic";

type ConversationHandler = ClaudeConversationHandler | OpenAIConversationHandler;

// Cache handlers by session ID to maintain conversation context
const handlerCache = new Map<string, ConversationHandler>();

// Clean up old sessions after 30 minutes of inactivity
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const sessionActivity = new Map<string, number>();

// Cleanup old sessions periodically
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, lastActivity] of Array.from(sessionActivity.entries())) {
    if (now - lastActivity > SESSION_TIMEOUT) {
      handlerCache.delete(sessionId);
      sessionActivity.delete(sessionId);
      console.log(`[AI-Native] Cleaned up session ${sessionId}`);
    }
  }
}, 5 * 60 * 1000); // Run every 5 minutes

/**
 * Get or create a conversation handler for a session
 */
function getHandler(sessionId: string, quoteId?: string): ConversationHandler {
  // Update activity timestamp
  sessionActivity.set(sessionId, Date.now());

  // Get existing handler
  if (handlerCache.has(sessionId)) {
    const handler = handlerCache.get(sessionId)!;
    return handler;
  }

  // Create new handler based on AI provider
  let handler: ConversationHandler;

  if (AI_PROVIDER === "openai") {
    console.log(`[AI-Native] Using OpenAI (GPT-4) provider`);
    handler = new OpenAIConversationHandler(sessionId, quoteId);
  } else {
    console.log(`[AI-Native] Using Claude (Anthropic) provider`);
    handler = new ClaudeConversationHandler(sessionId, quoteId);
  }

  handlerCache.set(sessionId, handler);
  console.log(`[AI-Native] Created new ${AI_PROVIDER} handler for session ${sessionId}`);

  return handler;
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await req.json();
    const { message, sessionId = uuidv4(), quoteId } = body;

    console.log("\n" + "=".repeat(80));
    console.log(`[AI-Native] 🚀 New request (Provider: ${AI_PROVIDER})`);
    console.log(`[AI-Native] Session: ${sessionId}`);
    console.log(`[AI-Native] Quote: ${quoteId || "none"}`);
    console.log(`[AI-Native] Message: "${message}"`);
    console.log("=".repeat(80));

    // Validate message
    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return NextResponse.json(
        { error: "Message is required and must be a non-empty string" },
        { status: 400 }
      );
    }

    // EXTRACT BUDGET FROM USER MESSAGE
    // This helps Claude understand budget constraints even before a structured quote exists
    let inferredBudget: number | null = null;
    const budgetPatterns = [
      /(?:budget|total).*?R\s*(\d+[,\s]?\d*)/i,           // "budget R50,000" or "total R 50000"
      /R\s*(\d+[,\s]?\d*).*?(?:budget|total)/i,           // "R50,000 budget"
      /(\d+[,\s]?\d*).*?(?:rand|budget)/i,                // "50000 rand"
      /(?:have|got|with)\s+R?\s*(\d+[,\s]?\d*)/i,        // "I have R50000" or "with 50000"
      /(?:around|about|roughly)\s+R?\s*(\d+[,\s]?\d*)/i, // "around R50000"
    ];

    for (const pattern of budgetPatterns) {
      const match = message.match(pattern);
      if (match) {
        const budgetStr = match[1].replace(/[,\s]/g, '');
        inferredBudget = parseInt(budgetStr, 10);

        // Sanity check: budget should be reasonable (R1000 - R10,000,000)
        if (inferredBudget >= 1000 && inferredBudget <= 10_000_000) {
          console.log(`[AI-Native] 💰 Extracted budget: R${inferredBudget.toLocaleString()}`);
          break;
        } else {
          console.log(`[AI-Native] ⚠️  Rejected unreasonable budget: R${inferredBudget}`);
          inferredBudget = null;
        }
      }
    }

    // INJECT BUDGET HINT INTO MESSAGE
    // This ensures Claude receives budget context even without a structured quote
    let enhancedMessage = message;
    if (inferredBudget && !quoteId) {
      enhancedMessage = `[EXTRACTED BUDGET: R${inferredBudget.toLocaleString()}]\n\n${message}`;
      console.log(`[AI-Native] 📝 Enhanced message with budget context`);
    }

    // Get or create conversation handler
    const handler = getHandler(sessionId, quoteId);

    // Process the message through Claude
    const response = await handler.chat(enhancedMessage);

    // Calculate processing time
    const processingTime = Date.now() - startTime;
    console.log(`[AI-Native] ⚡ Response generated in ${processingTime}ms`);

    // Build API response
    const apiResponse = {
      message: response.message,
      products: response.products || [],
      sessionId,
      quoteId: response.quoteId || quoteId,
      quoteItems: response.quoteItems || [],
      needsMoreInfo: response.needsMoreInfo || false,
      isComplete: response.isComplete || false,
      totalPrice: response.totalPrice,
      extractedBudget: inferredBudget || undefined,
      flowType: "ai_native",
      processingTime,
      consultationRequest: response.consultationRequest,
      isEscalated: response.isEscalated,
    };

    console.log(`[AI-Native] ✅ Success - Returning ${response.products?.length || 0} products`);
    console.log("=".repeat(80) + "\n");

    return NextResponse.json(apiResponse);

  } catch (error: any) {
    console.error("[AI-Native] ❌ Error:", error);
    console.error("[AI-Native] Stack:", error.stack);

    const processingTime = Date.now() - startTime;

    return NextResponse.json(
      {
        error: "Failed to process message",
        message: "I apologize, something went wrong. Could you please try rephrasing your request?",
        details: process.env.NODE_ENV === "development" ? error.message : undefined,
        processingTime,
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint for health check
 */
export async function GET() {
  return NextResponse.json({
    status: "healthy",
    endpoint: "ai-native",
    version: "1.0.0",
    activeSessions: handlerCache.size,
    description: "AI-Native chat quote system powered by Claude",
  });
}
