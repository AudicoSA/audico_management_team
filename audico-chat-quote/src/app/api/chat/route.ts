import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { SystemDesignEngine } from "@/lib/flows/system-design/engine";
import { SimpleQuoteEngine } from "@/lib/flows/simple-quote/engine";
import { SalesAgent } from "@/lib/agent/sales-agent";
import { SalesAgentGPT } from "@/lib/agent/sales-agent-gpt";
import { searchProducts, searchProductsSafe } from "@/lib/search";
import { RequirementsSchema } from "@/lib/types";
import type { Product } from "@/lib/types";
import { v4 as uuidv4 } from "uuid";

export const dynamic = "force-dynamic";

// Toggle between GPT and Claude agents
const USE_GPT_AGENT = process.env.USE_GPT_AGENT === "true" || true; // Default to GPT

// Sales Agent caches (GPT and Claude versions)
const salesAgentCache = new Map<string, SalesAgent>();
const salesAgentGPTCache = new Map<string, SalesAgentGPT>();

function getSalesAgent(sessionId: string): SalesAgent | SalesAgentGPT {
  if (USE_GPT_AGENT) {
    if (!salesAgentGPTCache.has(sessionId)) {
      salesAgentGPTCache.set(sessionId, new SalesAgentGPT());
    }
    return salesAgentGPTCache.get(sessionId)!;
  } else {
    if (!salesAgentCache.has(sessionId)) {
      salesAgentCache.set(sessionId, new SalesAgent());
    }
    return salesAgentCache.get(sessionId)!;
  }
}

// Lazy initialization of API clients
let anthropic: Anthropic | null = null;
let openai: OpenAI | null = null;

function getAnthropic(): Anthropic {
  if (!anthropic) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is not configured");
    }
    anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropic;
}

function getOpenAI(): OpenAI {
  if (!openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}

/**
 * Detect user intent from their message
 */
async function detectIntent(
  message: string
): Promise<{
  intent: "system_design" | "simple_quote" | "tender" | "question" | "greeting";
  requirements?: any;
  searchQuery?: string;
}> {
  const systemPrompt = `You are an intent classifier for an audio equipment quote system.

Analyze the user message and return a JSON object with:
- intent: one of "system_design", "simple_quote", "tender", "question", "greeting"
- requirements: (only for system_design) object with type, channels, budgetTotal, surroundMounting
- searchQuery: (only for simple_quote) the product search query

Intent rules:
- system_design: mentions home cinema, surround sound, 5.1, 7.1, room setup, complete system, restaurant audio, gym speakers, etc.
- simple_quote: asks for price on specific product, SKU, brand+model, "how much", "price for", insurance replacement
- tender: mentions tender, RFQ, document, upload, spec sheet, bid
- question: asks about products, features, compatibility, recommendations without wanting a quote
- greeting: just saying hi, hello, thanks, etc.

Return ONLY valid JSON, no other text.`;

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: message },
    ],
    response_format: { type: "json_object" },
    temperature: 0.1,
  });

  const content = response.choices[0].message.content;
  if (!content) {
    return { intent: "question" };
  }

  try {
    return JSON.parse(content);
  } catch {
    return { intent: "question" };
  }
}

/**
 * Extract requirements from user message
 * NOTE: We do NOT blindly merge AI-detected requirements because the AI may return
 * values that don't match our exact enum values (e.g., "home theater" instead of "home_cinema")
 */
function extractRequirements(message: string, detected: any) {
  const requirements: any = {
    type: "home_cinema",
    useCase: "Home",
  };

  // Detect channels - check Atmos configs FIRST (5.1.2, 5.1.4, 7.1.2, 7.1.4) before standard configs
  // This prevents "5.1.2" from being matched as just "5.1"
  if (/7\.1\.4|7\.2\.4/i.test(message)) {
    requirements.channels = "7.1.4";  // 7 base + sub + 4 height
  } else if (/7\.1\.2|7\.2\.2/i.test(message)) {
    requirements.channels = "7.1.2";  // 7 base + sub + 2 height
  } else if (/5\.1\.4|5\.2\.4/i.test(message)) {
    requirements.channels = "5.1.4";  // 5 base + sub + 4 height
  } else if (/5\.1\.2|5\.2\.2/i.test(message)) {
    requirements.channels = "5.1.2";  // 5 base + sub + 2 height
  } else if (/7\.1|7\.2|seven\s*(point|\.)\s*one|7\s*channel/i.test(message)) {
    requirements.channels = "7.1";    // 7 base + sub only
  } else if (/5\.1|5\.2|five\s*(point|\.)\s*one|5\s*channel/i.test(message)) {
    requirements.channels = "5.1";    // 5 base + sub only
  } else if (/9\.1|9\.2|atmos|dolby\s*atmos/i.test(message)) {
    requirements.channels = "9.1";    // 9 base + sub (or generic Atmos)
  }

  // Detect type - home cinema keywords
  if (/home\s*(cinema|theatre|theater)|lounge|living\s*room|movie/i.test(message)) {
    requirements.type = "home_cinema";
    requirements.useCase = "Home";
  } else if (/restaurant|cafe|retail|shop|background\s*music|bgm/i.test(message)) {
    requirements.type = "commercial_bgm";
    requirements.useCase = "Commercial";
  } else if (/gym|club|loud|dance|fitness/i.test(message)) {
    requirements.type = "commercial_loud";
    requirements.useCase = "Commercial";
  } else if (/church|worship|hall/i.test(message)) {
    requirements.type = "worship";
    requirements.useCase = "Commercial";
  } else if (/video\s*conferenc|boardroom|conference\s*room/i.test(message)) {
    requirements.type = "video_conference";
    requirements.useCase = "Commercial";
  } else if (/meeting\s*room|huddle|teams|zoom|google\s*meet/i.test(message)) {
    // Check if this looks like a conference follow-up (room size + platform mentioned)
    const hasRoomSize = /small|medium|large|huddle|boardroom|\d+\s*(people|person|pax)/i.test(message);
    const hasPlatform = /teams|zoom|google\s*meet|webex/i.test(message);
    if (hasRoomSize || hasPlatform) {
      requirements.type = "video_conference_details";
      requirements.useCase = "Commercial";
      // Extract details
      if (/small|huddle|2-4|2\s*to\s*4/i.test(message)) {
        requirements.roomSize = "small";
      } else if (/medium|5-8|5\s*to\s*8|meeting\s*room/i.test(message)) {
        requirements.roomSize = "medium";
      } else if (/large|boardroom|10\+|10\s*or\s*more/i.test(message)) {
        requirements.roomSize = "large";
      }
      if (/teams/i.test(message)) requirements.platform = "teams";
      else if (/zoom/i.test(message)) requirements.platform = "zoom";
      else if (/google|meet/i.test(message)) requirements.platform = "google";
    } else {
      requirements.type = "video_conference";
      requirements.useCase = "Commercial";
    }
  }

  // Detect commercial BGM follow-up (has zones + size info, but NOT home cinema keywords)
  const hasZones = /zone|indoor|outdoor|patio|inside|outside/i.test(message);
  const hasVenueSize = /small|medium|large|cafe|restaurant|warehouse/i.test(message);
  const isNotHomeCinema = !/5\.1|7\.1|home\s*cinema|surround|movie|lounge|living/i.test(message);
  if (hasZones && hasVenueSize && isNotHomeCinema) {
    requirements.type = "commercial_bgm_details";
    requirements.useCase = "Commercial";
    // Extract size
    if (/small|cafe|shop/i.test(message)) {
      requirements.venueSize = "small";
    } else if (/medium|restaurant(?!\s*large)/i.test(message)) {
      requirements.venueSize = "medium";
    } else if (/large|warehouse|big/i.test(message)) {
      requirements.venueSize = "large";
    }
    // Extract zones
    if (/single\s*zone|one\s*zone|1\s*zone/i.test(message)) {
      requirements.zoneCount = 1;
    } else if (/two\s*zone|2\s*zone|2-3|inside.*outside|indoor.*outdoor/i.test(message)) {
      requirements.zoneCount = 2;
    } else if (/4\+|four|multiple|many/i.test(message)) {
      requirements.zoneCount = 4;
    }
    // Extract indoor/outdoor
    requirements.hasOutdoor = /outdoor|outside|patio|garden/i.test(message);
  }

  // Detect gym/fitness follow-up (has size + spin/class/mic info)
  const hasGymKeywords = /spin|class|studio|mic|microphone|gym\s*floor/i.test(message);
  if (hasGymKeywords && hasVenueSize && isNotHomeCinema && requirements.type !== "commercial_bgm_details") {
    requirements.type = "commercial_loud_details";
    requirements.useCase = "Commercial";
    // Extract size
    if (/small|boutique|studio/i.test(message) && !/spin\s*studio/i.test(message)) {
      requirements.venueSize = "small";
    } else if (/medium|standard/i.test(message)) {
      requirements.venueSize = "medium";
    } else if (/large|fitness\s*center|big/i.test(message)) {
      requirements.venueSize = "large";
    }
    // Extract class/spin
    requirements.hasSpinClass = /spin|class|studio/i.test(message);
    // Extract mic needs
    requirements.needsMic = /mic|microphone|wireless/i.test(message);
  }

  // Detect budget - handle various formats: R150000, R150,000, R150 000, 150000, 150k, etc.
  const budgetPatterns = [
    /(\d+)\s*k\b/i,                                 // 150k (check this first)
    /r?\s*(\d{1,3})[,\s](\d{3})[,\s]?(\d{3})?/i,  // R150,000 or R1,500,000
    /r?\s*(\d{4,7})\b/i,                           // R150000 (4-7 digits)
  ];

  for (const pattern of budgetPatterns) {
    const match = message.match(pattern);
    if (match) {
      let amount: number;
      if (/k\b/i.test(pattern.source)) {
        // Handle "150k" format
        amount = parseInt(match[1], 10) * 1000;
      } else if (match[3]) {
        // Handle "1,500,000" format
        amount = parseInt(match[1] + match[2] + match[3], 10);
      } else if (match[2]) {
        // Handle "150,000" format
        amount = parseInt(match[1] + match[2], 10);
      } else {
        // Handle "150000" format
        amount = parseInt(match[1], 10);
      }
      if (amount >= 10000 && amount <= 10000000) {
        requirements.budgetTotal = amount;
        break;
      }
    }
  }

  // Detect surround mounting
  if (/ceiling|in-ceiling/i.test(message)) {
    requirements.surroundMounting = "ceiling";
  } else if (/bookshelf|stand/i.test(message)) {
    requirements.surroundMounting = "bookshelf";
  }

  // Detect additional zones (kitchen, outdoor, patio, bedroom, bar, etc.)
  const zones: { name: string; type: string; mounting?: string }[] = [];
  const zonePatterns = [
    { pattern: /\bbar\b|pub|lounge(?!\s*(room|cinema))/i, name: "Bar", type: "commercial_loud" },  // NEW: Bar zone for high-output audio
    { pattern: /kitchen\s*(speaker|ceiling|zone)?s?/i, name: "Kitchen", type: "ceiling_zone" },
    { pattern: /outdoor\s*(speaker|zone)?s?|patio|garden|pool/i, name: "Outdoor", type: "outdoor_zone" },
    { pattern: /bedroom\s*(speaker|zone)?s?/i, name: "Bedroom", type: "ceiling_zone" },
    { pattern: /bathroom\s*(speaker|zone)?s?/i, name: "Bathroom", type: "ceiling_zone" },
    { pattern: /office\s*(speaker|zone)?s?/i, name: "Office", type: "ceiling_zone" },
    { pattern: /dining\s*(room)?\s*(speaker|zone)?s?/i, name: "Dining", type: "ceiling_zone" },
  ];

  for (const { pattern, name, type } of zonePatterns) {
    if (pattern.test(message)) {
      const zone: { name: string; type: string; mounting?: string } = { name, type };
      // Check if ceiling mounting is mentioned near this zone
      if (/ceiling/i.test(message)) {
        zone.mounting = "ceiling";
      }
      zones.push(zone);
    }
  }

  if (zones.length > 0) {
    requirements.additionalZones = zones;
  }

  // Only merge VALID detected requirements (validate against our enums)
  if (detected.requirements) {
    const validTypes = ["home_cinema", "commercial_bgm", "commercial_loud", "worship", "education", "video_conference"];
    const validChannels = ["5.1", "5.1.2", "5.1.4", "7.1", "7.1.2", "7.1.4", "9.1", "2.0", "stereo"];
    const validMounting = ["ceiling", "bookshelf", "wall"];

    // Only use AI values if they match our exact enums
    if (detected.requirements.type && validTypes.includes(detected.requirements.type)) {
      requirements.type = detected.requirements.type;
    }
    if (detected.requirements.channels && validChannels.includes(detected.requirements.channels)) {
      requirements.channels = detected.requirements.channels;
    }
    if (detected.requirements.surroundMounting && validMounting.includes(detected.requirements.surroundMounting)) {
      requirements.surroundMounting = detected.requirements.surroundMounting;
    }
    if (typeof detected.requirements.budgetTotal === 'number' && detected.requirements.budgetTotal > 0) {
      requirements.budgetTotal = detected.requirements.budgetTotal;
    }
  }

  console.log("[extractRequirements] Input message:", message);
  console.log("[extractRequirements] Detected from AI:", JSON.stringify(detected.requirements));
  console.log("[extractRequirements] Final requirements:", JSON.stringify(requirements));

  return requirements;
}

/**
 * Detect intent when user is in an active guided flow
 * Returns skip, selection, or question (default to question for natural conversation)
 */
function detectFlowIntent(message: string): {
  type: "skip" | "selection" | "question";
  reason?: string;
} {
  const msgLower = message.toLowerCase().trim();

  // Skip detection - user wants to skip the current step
  const skipPatterns = [
    /^skip$/i,
    /\b(skip|pass|next|move on)\b/i,
    /\b(don't need|dont need|not needed|already have)\b/i,
    /\b(no thanks|none|nothing)\b/i,
  ];
  for (const pattern of skipPatterns) {
    if (pattern.test(msgLower)) {
      return { type: "skip", reason: message };
    }
  }

  // Selection detection - user is selecting a product by name/brand
  // Only if they mention a specific product that might be in the list
  // This is very narrow - numbers, SKUs, or "select [product]"
  const selectionPatterns = [
    /^(select|choose|add|pick)\s+/i,  // "select the Denon"
    /^[a-z0-9]{5,15}$/i,  // SKU-like patterns
    /^#?\d+$/,  // Just a number (product #)
  ];
  for (const pattern of selectionPatterns) {
    if (pattern.test(msgLower)) {
      return { type: "selection" };
    }
  }

  // Everything else is treated as a question/request - we help the user!
  // This enables natural conversation instead of rigid pattern matching
  return { type: "question" };
}

/**
 * Detect if user is requesting a specific speaker/product type
 * Returns the product type keyword and any preferences
 */
function detectProductTypeRequest(message: string): {
  isProductRequest: boolean;
  speakerType?: "floor" | "bookshelf" | "ceiling" | "wall" | "outdoor" | "pendant";
  componentOverride?: string;
} {
  const msgLower = message.toLowerCase();

  // Floor/floorstanding speakers
  if (/\b(floor|floorstand|tower|standing)\b/i.test(msgLower)) {
    return { isProductRequest: true, speakerType: "floor", componentOverride: "fronts" };
  }

  // Bookshelf speakers
  if (/\b(bookshelf|shelf|compact|desktop|standmount)\b/i.test(msgLower)) {
    return { isProductRequest: true, speakerType: "bookshelf", componentOverride: "fronts" };
  }

  // Ceiling speakers
  if (/\b(ceiling|in-ceiling|inceiling)\b/i.test(msgLower)) {
    return { isProductRequest: true, speakerType: "ceiling" };
  }

  // Pendant speakers
  if (/\b(pendant|hanging|suspended)\b/i.test(msgLower)) {
    return { isProductRequest: true, speakerType: "pendant" };
  }

  // Wall speakers
  if (/\b(wall|on-wall|onwall|wall-mount)\b/i.test(msgLower)) {
    return { isProductRequest: true, speakerType: "wall" };
  }

  // Outdoor speakers
  if (/\b(outdoor|outside|garden|patio|weatherproof)\b/i.test(msgLower)) {
    return { isProductRequest: true, speakerType: "outdoor" };
  }

  return { isProductRequest: false };
}

/**
 * Answer a question during guided flow using GPT Sales Agent
 * Routes product requests through the intelligent agent for better filtering
 */
async function answerFlowQuestion(
  question: string,
  context: any,
  sessionId: string
): Promise<{ message: string; products?: Product[] }> {
  const currentStep = context?.steps?.[context?.currentStepIndex];
  const selectedProducts = context?.selectedProducts || [];
  const currentComponent = currentStep?.component || 'fronts';
  // Fallback chain: useCase → type → 'Home' (prevents gym/restaurant becoming home cinema)
  const useCase = context?.requirements?.useCase || context?.requirements?.type || 'Home';

  // Check if user is asking for a specific product type
  const productRequest = detectProductTypeRequest(question);

  // If it's a product request, use the GPT Sales Agent for intelligent search
  if (productRequest.isProductRequest) {
    const speakerType = productRequest.speakerType;
    console.log(`[answerFlowQuestion] Product request detected: ${speakerType} for ${currentComponent}, using GPT agent`);

    // Build a natural language request for the agent
    // Use the specific type (gym, restaurant, commercial_loud) from requirements, not generic useCase
    const systemType = context?.requirements?.type || useCase.toLowerCase();
    let agentPrompt = `I need ${speakerType} speakers for my ${systemType} `;

    if (useCase === "Home" || context?.requirements?.type === "home_cinema") {
      agentPrompt += "system. ";
      agentPrompt += "I have an AV receiver so I need PASSIVE speakers only - no active/powered/bluetooth speakers. ";
      if (speakerType === "bookshelf") {
        agentPrompt += "Looking for quality bookshelf speakers suitable for front channels.";
      } else if (speakerType === "floor") {
        agentPrompt += "Looking for floorstanding/tower speakers for front channels.";
      }
    } else {
      agentPrompt += `system. Looking for ${speakerType} speakers.`;
    }

    // Use the GPT agent
    const agent = getSalesAgent(sessionId);
    const result = await agent.chat(agentPrompt, { selectedProducts });

    return {
      message: result.message,
      products: result.products.length > 0 ? result.products : undefined,
    };
  }

  // For ALL questions (including non-product), use GPT Sales Agent
  // This ensures consistent, intelligent responses throughout
  console.log(`[answerFlowQuestion] General question, using GPT agent`);

  // Build RICH context for the agent - include budget, step progress, etc.
  const budgetTotal = context?.requirements?.budgetTotal || 0;
  const budgetSpent = selectedProducts.reduce((sum: number, p: any) => sum + (p.lineTotal || 0), 0);
  const budgetRemaining = budgetTotal - budgetSpent;

  const contextPrompt = `[CONTEXT] You are helping with an in-progress quote (ID: ${context?.id || 'unknown'}).

Current State:
- System Type: ${context?.requirements?.channels || context?.requirements?.type || 'audio system'}
- Current Step: ${currentStep?.label || 'Unknown'} (Step ${(context?.currentStepIndex || 0) + 1} of ${context?.steps?.length || '?'})
- Budget: R${budgetTotal.toLocaleString()} total (R${budgetSpent.toLocaleString()} spent, R${budgetRemaining.toLocaleString()} remaining)
- Selected Products: ${selectedProducts.length > 0
      ? selectedProducts.map((p: any) => p.product?.name).join(', ')
      : 'Nothing yet'}

The customer asked: "${question}"

IMPORTANT:
- Answer their question helpfully and reference the products they've already selected
- DO NOT restart the design process or suggest new AVRs/components if they already chose them
- Stay focused on their current step: ${currentStep?.label || 'continue helping'}
- After answering, guide them back to the current step if needed`;

  const agent = getSalesAgent(sessionId);
  const result = await agent.chat(contextPrompt, { selectedProducts });

  return {
    message: result.message,
    products: result.products.length > 0 ? result.products : undefined,
  };
}

/**
 * Handle messages in simple_quote flow using the Sales Agent
 * The agent searches the database intelligently and reasons about solutions
 */
async function handleSimpleQuoteMessage(
  message: string,
  quoteId: string,
  sessionId: string
): Promise<{ message: string; products?: Product[] }> {
  // Load quote to get context (selected products)
  const engine = await SimpleQuoteEngine.load(quoteId);
  const selectedProducts = engine?.getItems() || [];

  // Get or create sales agent for this session
  const agent = getSalesAgent(sessionId);

  // Let the agent handle the conversation
  const result = await agent.chat(message, { selectedProducts });

  return {
    message: result.message,
    products: result.products.length > 0 ? result.products : undefined,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, quoteId, flowType, sessionId = uuidv4() } = body;

    if (!message || message.trim().length === 0) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    // If we have an existing quote, continue that flow
    if (quoteId && flowType) {
      if (flowType === "system_design") {
        // Detect if user wants to skip or is asking a question
        const flowIntent = detectFlowIntent(message);

        if (flowIntent.type === "skip") {
          // User wants to skip this step
          const engine = await SystemDesignEngine.load(quoteId);
          if (!engine) {
            return NextResponse.json({ error: "Quote not found" }, { status: 404 });
          }

          try {
            const result = await engine.skipCurrentStep(flowIntent.reason);
            return NextResponse.json({
              message: result.message,
              products: result.products,
              currentStep: result.nextStep,
              quoteId,
              flowType,
              isComplete: result.isComplete,
              quoteItems: engine.getSelectedProducts(),
              totalSteps: engine.getTotalSteps(),
            });
          } catch (error: any) {
            return NextResponse.json({
              message: error.message || "Cannot skip this step",
              quoteId,
              flowType,
            });
          }
        }

        // Default: treat as question/request and answer naturally
        // This enables conversational flow instead of rigid "select a product" responses
        const engine = await SystemDesignEngine.load(quoteId);
        const context = engine?.getSummary();
        const result = await answerFlowQuestion(message, context, sessionId);

        // If we found products (e.g., user asked for "floor speakers"), include them
        // Otherwise, keep showing current step's products
        const response: Record<string, unknown> = {
          message: result.message,
          quoteId,
          flowType,
        };

        if (result.products && result.products.length > 0) {
          response.products = result.products;
          console.log(`[chat] Returning ${result.products.length} products for user request`);
        }

        return NextResponse.json(response);
      } else if (flowType === "simple_quote") {
        // Use Sales Agent to understand intent and recommend products
        const simpleQuoteResult = await handleSimpleQuoteMessage(message, quoteId, sessionId);
        return NextResponse.json({
          ...simpleQuoteResult,
          quoteId,
          flowType,
        });
      }
    }

    // Detect intent for new conversation
    const detected = await detectIntent(message);
    console.log("[chat] Message:", message);
    console.log("[chat] Detected intent:", detected.intent);
    console.log("[chat] Detected requirements:", JSON.stringify(detected.requirements));

    switch (detected.intent) {
      case "system_design": {
        const requirements = extractRequirements(message, detected);

        // Handle video conferencing - ask discovery questions first
        if (requirements.type === "video_conference") {
          // Create a draft quote to maintain context
          const draftQuote = await SimpleQuoteEngine.create(sessionId);

          return NextResponse.json({
            message:
              "I can help with video conferencing! To recommend the right solution, I need a few details:\n\n" +
              "**1. Room size?**\n" +
              "• Small (2-4 people, huddle room)\n" +
              "• Medium (5-8 people, meeting room)\n" +
              "• Large (10+ people, boardroom)\n\n" +
              "**2. Primary platform?**\n" +
              "• Microsoft Teams\n" +
              "• Zoom\n" +
              "• Google Meet\n" +
              "• Multiple/Other\n\n" +
              "**3. What do you already have?**\n" +
              "• Nothing - need full setup\n" +
              "• Display/TV only\n" +
              "• Webcam only\n" +
              "• Just need audio solution\n\n" +
              "**4. Approximate budget?**\n\n" +
              "Just reply with something like: \"Medium room, Teams, have a TV, R20k budget\"",
            quoteId: draftQuote.getQuoteId(),
            flowType: "simple_quote",
          });
        }

        // Handle video conferencing follow-up with details
        // Use the Sales Agent to recommend products intelligently
        if (requirements.type === "video_conference_details") {
          const platform = requirements.platform || "video conferencing";
          const roomSize = requirements.roomSize || "medium";

          // Create a simple quote first
          const quoteEngine = await SimpleQuoteEngine.create(sessionId);

          // Build a natural language request for the Sales Agent
          let agentPrompt = `I need a ${platform} solution for a `;
          if (roomSize === "small") {
            agentPrompt += "small huddle room (2-4 people). It should be simple and plug-and-play.";
          } else if (roomSize === "medium") {
            agentPrompt += "medium meeting room (5-8 people). Needs good audio and video quality.";
          } else {
            agentPrompt += "large boardroom (10+ people). Needs professional quality with good coverage.";
          }

          // Let the Sales Agent search and recommend
          const agent = getSalesAgent(sessionId);
          const result = await agent.chat(agentPrompt);

          return NextResponse.json({
            message: result.message,
            products: result.products,
            flowType: "simple_quote",
            quoteId: quoteEngine.getQuoteId(),
            quoteItems: [],
          });
        }

        // Handle commercial BGM (restaurant/retail) - ask discovery questions
        if (requirements.type === "commercial_bgm") {
          // Create a draft quote to maintain context
          const draftQuote = await SimpleQuoteEngine.create(sessionId);

          return NextResponse.json({
            message:
              "I can help with background music for your venue! A few quick questions:\n\n" +
              "**1. Venue size?**\n" +
              "• Small (cafe, small shop, <100m²)\n" +
              "• Medium (restaurant, retail store, 100-300m²)\n" +
              "• Large (large restaurant, warehouse, 300m²+)\n\n" +
              "**2. How many audio zones?**\n" +
              "• Single zone (same music everywhere)\n" +
              "• 2-3 zones (e.g. inside + outside)\n" +
              "• 4+ zones (different areas need separate control)\n\n" +
              "**3. Indoor, outdoor, or both?**\n\n" +
              "**4. Approximate budget?**\n\n" +
              "Example: \"Medium restaurant, 2 zones (inside + patio), R30k budget\"",
            quoteId: draftQuote.getQuoteId(),
            flowType: "simple_quote",
          });
        }

        // Handle commercial loud (gym/club) - ask discovery questions
        if (requirements.type === "commercial_loud") {
          // Create a draft quote to maintain context across messages
          const draftQuote = await SimpleQuoteEngine.create(sessionId);

          return NextResponse.json({
            message:
              "I can help with audio for your gym or fitness space! A few questions:\n\n" +
              "**1. Space size?**\n" +
              "• Small (boutique studio, <150m²)\n" +
              "• Medium (standard gym, 150-400m²)\n" +
              "• Large (fitness center, 400m²+)\n\n" +
              "**2. Do you have group/spin classes?**\n" +
              "• No - just general gym floor\n" +
              "• Yes - need separate audio for class studio\n\n" +
              "**3. Need instructor microphones?**\n\n" +
              "**4. Approximate budget?**\n\n" +
              "Example: \"Medium gym with spin studio, need 2 wireless mics, R50k budget\"",
            quoteId: draftQuote.getQuoteId(),
            flowType: "simple_quote",
          });
        }

        // Handle commercial BGM follow-up with details - use guided flow like home cinema
        if (requirements.type === "commercial_bgm_details") {
          // Build commercial requirements for the engine
          const commercialRequirements = {
            type: "commercial_bgm" as const,
            useCase: "Commercial" as const,
            budgetTotal: requirements.budgetTotal,
            zoneCount: requirements.zoneCount || 1,
            hasOutdoor: requirements.hasOutdoor || false,
            venueSize: requirements.venueSize || "medium",
          };

          console.log("[commercial_bgm] Creating guided flow with:", JSON.stringify(commercialRequirements));

          // Create System Design quote (guided step-by-step flow)
          const { engine, products, message: welcomeMessage } =
            await SystemDesignEngine.create(sessionId, commercialRequirements);

          const summary = engine.getSummary();

          return NextResponse.json({
            message: welcomeMessage,
            products,
            quoteId: engine.getQuoteId(),
            flowType: "system_design",
            currentStep: summary.steps[0],
            totalSteps: summary.totalSteps,
            quoteItems: [],
          });
        }

        // Handle gym/fitness follow-up with details
        if (requirements.type === "commercial_loud_details") {
          let sizeDesc = requirements.venueSize || "medium";
          const hasSpin = requirements.hasSpinClass;
          const needsMic = requirements.needsMic;

          // Simple, targeted search
          let searchQuery = needsMic
            ? "wireless microphone fitness instructor"
            : "PA speaker powered commercial gym";

          const products = await searchProductsSafe(searchQuery, {}, 6);

          // Create a simple quote so products can be added
          const engine = await SimpleQuoteEngine.create(sessionId);

          return NextResponse.json({
            message:
              `Great! For a **${sizeDesc} gym**${hasSpin ? " with spin/class studio" : ""}${needsMic ? " (with wireless mics)" : ""}, here are my recommendations:\n\n` +
              "You'll typically need:\n" +
              "• **Amplifier** - commercial-grade power amp\n" +
              `• **Speakers** - ${sizeDesc === "small" ? "2-4" : sizeDesc === "medium" ? "4-6" : "6-10"} high-output speakers\n` +
              (hasSpin ? "• **Studio system** - separate audio for class room\n" : "") +
              (needsMic ? "• **Wireless mics** - for instructors\n" : "") +
              (sizeDesc !== "small" ? "• **Subwoofer** - for bass impact\n" : "") +
              "\nHere are some options to get started:",
            products,
            flowType: "simple_quote",
            quoteId: engine.getQuoteId(),
            quoteItems: [],
          });
        }

        // Validate requirements
        const validated = RequirementsSchema.safeParse(requirements);
        if (!validated.success) {
          console.log("[system_design] Validation failed:", JSON.stringify(validated.error.errors));
          console.log("[system_design] Requirements were:", JSON.stringify(requirements));
          // Ask for clarification
          return NextResponse.json({
            message:
              "I'd love to help you build your audio system! Could you tell me:\n\n" +
              "1. What type of setup? (home cinema 5.1/7.1, restaurant background music, gym, etc.)\n" +
              "2. What's your approximate budget?",
          });
        }

        console.log("[system_design] Validation passed! Creating quote with:", JSON.stringify(validated.data));

        // Create System Design quote
        const { engine, products, message: welcomeMessage } =
          await SystemDesignEngine.create(sessionId, validated.data);

        const summary = engine.getSummary();

        return NextResponse.json({
          message: welcomeMessage,
          products,
          quoteId: engine.getQuoteId(),
          flowType: "system_design",
          currentStep: summary.steps[0],
          totalSteps: summary.totalSteps,
          quoteItems: [],
        });
      }

      case "simple_quote": {
        const searchQuery = detected.searchQuery || message;
        const products = await searchProductsSafe(searchQuery, {}, 6);

        // Create Simple Quote
        const engine = await SimpleQuoteEngine.create(sessionId);

        return NextResponse.json({
          message: `Here's what I found for "${searchQuery}". Click to add items to your quote:`,
          products,
          quoteId: engine.getQuoteId(),
          flowType: "simple_quote",
          quoteItems: [],
        });
      }

      case "tender": {
        return NextResponse.json({
          message:
            "I can help you with tender documents! Please upload your PDF, Excel, or Word document, and I'll extract the specifications and find matching products.\n\n" +
            "(Document upload coming soon - for now, you can paste the specifications as text)",
        });
      }

      case "greeting": {
        return NextResponse.json({
          message:
            "Hi there! 👋 I'm your Audico assistant. I can help you:\n\n" +
            "• **Build a complete audio system** - Just tell me about your space and needs\n" +
            "• **Get quick product quotes** - Ask for prices on specific products\n" +
            "• **Process tender documents** - Upload specs and I'll find matches\n\n" +
            "What would you like to do today?",
        });
      }

      case "question":
      default: {
        // Generate a helpful response using Claude
        const response = await getAnthropic().messages.create({
          model: "claude-3-haiku-20240307",
          max_tokens: 300,
          system:
            "You are a helpful audio equipment assistant for Audico, a South African audio retailer. " +
            "Answer questions about audio equipment, home cinema, commercial audio, etc. " +
            "Keep responses concise and helpful. If the user seems to want to make a purchase, " +
            "guide them to describe their needs so you can start a quote. " +
            "Prices are in South African Rand (R).",
          messages: [{ role: "user", content: message }],
        });

        const textContent = response.content.find((c) => c.type === "text");
        return NextResponse.json({
          message:
            textContent?.text ||
            "I'm not sure how to help with that. Would you like to build a quote or search for products?",
        });
      }
    }
  } catch (error: any) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: error.message || "Something went wrong" },
      { status: 500 }
    );
  }
}
