/**
 * AI-Native Tool Definitions
 *
 * These tools give Claude the ability to search products, manage quotes,
 * and interact with the Audico database intelligently.
 */

import Anthropic from "@anthropic-ai/sdk";

export const AI_TOOLS: Anthropic.Tool[] = [
  {
    name: "search_products_by_category",
    description: `Search for products by use case category. Use this when you understand what the customer needs.

CATEGORIES:
- "home_cinema" - Home theater systems, AVRs, passive speakers, subwoofers for 5.1/7.1/Atmos
- "commercial_bgm" - Restaurant/retail background music (ceiling speakers, streaming amps)
- "commercial_loud" - Gym/fitness/club high-output audio (PA speakers, commercial amps)
- "video_conference" - Meeting room solutions (video bars, room systems, speakerphones)
- "worship" - Church/venue sound reinforcement
- "outdoor" - Weatherproof outdoor speakers and audio

This is your PRIMARY search tool - use it when you understand the customer's use case.`,
    input_schema: {
      type: "object" as const,
      properties: {
        category: {
          type: "string",
          enum: ["home_cinema", "commercial_bgm", "commercial_loud", "video_conference", "worship", "outdoor"],
          description: "The product category to search",
        },
        minPrice: {
          type: "number",
          description: "Minimum price in Rand (optional)",
        },
        maxPrice: {
          type: "number",
          description: "Maximum price in Rand (optional)",
        },
        limit: {
          type: "number",
          description: "Maximum number of results (default 10, max 20)",
        },
      },
      required: ["category"],
    },
  },
  {
    name: "search_products_by_keyword",
    description: `Search for specific products by keywords, brand names, or model numbers.

WHEN TO USE:
- Customer asks for specific product: "Denon AVR-X3800H"
- Customer wants a brand: "show me Yamaha receivers"
- Customer asks about product type: "subwoofers", "video bars", "wireless mics"
- You need to find a specific component: "passive bookshelf speakers"

SEARCH TIPS:
- Include brand names: "JBL ceiling speakers" is better than "ceiling speakers"
- Be specific: "video bar" is better than "camera"
- Try multiple searches if first doesn't work: "Poly Studio" then "Polycom video"`,
    input_schema: {
      type: "object" as const,
      properties: {
        keywords: {
          type: "string",
          description: "Search keywords - product name, brand, model, or type",
        },
        minPrice: {
          type: "number",
          description: "Minimum price in Rand (optional)",
        },
        maxPrice: {
          type: "number",
          description: "Maximum price in Rand (optional)",
        },
        limit: {
          type: "number",
          description: "Maximum number of results (default 10, max 20)",
        },
      },
      required: ["keywords"],
    },
  },
  {
    name: "filter_products",
    description: `Filter a list of products by specific criteria. Use this after searching to narrow down results.

FILTER CRITERIA:
- passive_only: true/false - Filter for passive speakers (critical for home cinema with AVR)
- brand: Filter by specific brand
- price_range: [min, max] - Filter by price
- component_type: "avr", "speakers", "subwoofer", "amplifier", etc.
- in_stock_only: true/false - Only show products in stock

IMPORTANT: Always filter passive_only=true for home cinema speakers (except subwoofer).`,
    input_schema: {
      type: "object" as const,
      properties: {
        products: {
          type: "array",
          description: "Array of product SKUs to filter",
          items: {
            type: "string",
          },
        },
        passive_only: {
          type: "boolean",
          description: "Only include passive speakers (critical for home cinema)",
        },
        brand: {
          type: "string",
          description: "Filter by brand name",
        },
        min_price: {
          type: "number",
          description: "Minimum price filter",
        },
        max_price: {
          type: "number",
          description: "Maximum price filter",
        },
        component_type: {
          type: "string",
          description: "Component type: avr, speakers, subwoofer, amplifier, etc.",
        },
        in_stock_only: {
          type: "boolean",
          description: "Only include products in stock",
        },
      },
      required: ["products"],
    },
  },
  {
    name: "get_product_details",
    description: `Get full details and specifications for a specific product.

USE WHEN:
- Customer asks about specific product specs
- You need technical details to make a recommendation
- Customer wants to know compatibility
- You want to verify product features before recommending`,
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
    name: "create_quote",
    description: `Create a new quote for the customer. Call this once you understand their needs and are ready to start building a solution.

QUOTE TYPES:
- "home_cinema" - 5.1/7.1/Atmos home theater system
- "commercial_bgm" - Restaurant/retail background music
- "commercial_loud" - Gym/fitness/club audio
- "video_conference" - Meeting room solution
- "simple" - General quote for specific products

Include requirements you've gathered (budget, room size, specific needs).`,
    input_schema: {
      type: "object" as const,
      properties: {
        quote_type: {
          type: "string",
          enum: ["home_cinema", "commercial_bgm", "commercial_loud", "video_conference", "simple"],
          description: "Type of quote to create",
        },
        requirements: {
          type: "object",
          description: "Customer requirements (budget, room size, specific needs)",
          properties: {
            budget_total: {
              type: "number",
              description: "Total budget in Rand",
            },
            room_size_sqm: {
              type: "number",
              description: "Room size in square meters",
            },
            channels: {
              type: "string",
              description: "For home cinema: 5.1, 7.1, 9.1",
            },
            venue_size: {
              type: "string",
              description: "For commercial: small, medium, large",
            },
            notes: {
              type: "string",
              description: "Any additional requirements or notes",
            },
          },
        },
      },
      required: ["quote_type"],
    },
  },
  {
    name: "add_to_quote",
    description: `Add a product to the current quote.

INCLUDE:
- Product SKU
- Quantity
- Brief reason why this product is being recommended

This helps build the quote and maintain context of the solution you're building.`,
    input_schema: {
      type: "object" as const,
      properties: {
        quote_id: {
          type: "string",
          description: "Quote ID to add product to",
        },
        sku: {
          type: "string",
          description: "Product SKU to add",
        },
        quantity: {
          type: "number",
          description: "Quantity (default 1)",
        },
        reason: {
          type: "string",
          description: "Brief explanation of why this product (for quote notes)",
        },
      },
      required: ["quote_id", "sku"],
    },
  },
  {
    name: "update_quote",
    description: `Update quote requirements or modify existing products.

USE WHEN:
- Customer changes budget
- Customer wants to add/remove products
- Requirements change mid-conversation`,
    input_schema: {
      type: "object" as const,
      properties: {
        quote_id: {
          type: "string",
          description: "Quote ID to update",
        },
        updates: {
          type: "object",
          description: "What to update",
          properties: {
            budget_total: {
              type: "number",
              description: "New budget",
            },
            requirements: {
              type: "object",
              description: "Updated requirements",
            },
            remove_sku: {
              type: "string",
              description: "Product SKU to remove",
            },
          },
        },
      },
      required: ["quote_id", "updates"],
    },
  },
  {
    name: "ask_clarifying_question",
    description: `Ask the customer a clarifying question to better understand their needs.

USE SPARINGLY - Only when:
- You genuinely need information to make a good recommendation
- The information isn't inferrable from context
- It significantly affects the solution

PROVIDE:
- Clear, focused question
- Why you need this information (internal reasoning)

DO NOT use this for:
- Information you can reasonably infer
- Nice-to-have details that don't affect core recommendation
- Questions you can answer through searching`,
    input_schema: {
      type: "object" as const,
      properties: {
        question: {
          type: "string",
          description: "The question to ask the customer",
        },
        reason: {
          type: "string",
          description: "Internal reasoning: why do you need this information?",
        },
        options: {
          type: "array",
          description: "Optional: provide choice options to make it easier for customer",
          items: {
            type: "string",
          },
        },
      },
      required: ["question", "reason"],
    },
  },
  {
    name: "create_consultation_request",
    description: `Create a consultation request for complex audio projects that require specialist attention.

USE THIS WHEN:
- Customer has 3+ zones (multi-zone audio projects)
- Budget is R150,000 or higher
- Project involves complex requirements (Dolby Atmos + distributed audio + outdoor)
- Customer is uncertain about what they need
- Commercial installations with multiple rooms
- Special venues (worship, large commercial spaces)

WORKFLOW:
1. Detect complexity (multi-zone, high budget, complex requirements)
2. Explain to customer why specialist consultation is beneficial
3. Gather structured information (zones, budget, requirements)
4. Create consultation request with this tool
5. Provide reference code to customer

REQUIRED INFORMATION:
- Customer email (required for follow-up)
- Project type (residential_multi_zone, commercial, home_cinema_premium, whole_home_audio, other)
- Total budget
- Zone details (at least one zone with name, location, use case)
- Requirements summary (what customer needs)

OPTIONAL INFORMATION:
- Customer name, phone, company name
- Timeline/urgency
- Technical notes
- Existing equipment to integrate
- Complexity score (0-100)

This ensures complex projects get proper specialist attention with CAD layouts and professional design.`,
    input_schema: {
      type: "object" as const,
      properties: {
        customer_email: {
          type: "string",
          description: "Customer email address (required for follow-up)",
        },
        customer_name: {
          type: "string",
          description: "Customer name (optional)",
        },
        customer_phone: {
          type: "string",
          description: "Customer phone number (optional)",
        },
        company_name: {
          type: "string",
          description: "Company name if commercial project (optional)",
        },
        project_type: {
          type: "string",
          enum: ["residential_multi_zone", "commercial", "home_cinema_premium", "whole_home_audio", "other"],
          description: "Type of audio project",
        },
        budget_total: {
          type: "number",
          description: "Total project budget in Rand",
        },
        timeline: {
          type: "string",
          description: "Project timeline or urgency (optional)",
        },
        zones: {
          type: "array",
          description: "Array of zones/rooms in the project (at least one required)",
          items: {
            type: "object",
            properties: {
              name: {
                type: "string",
                description: "Zone name (e.g., 'Main Cinema', 'Kitchen', 'Outdoor Patio')",
              },
              location: {
                type: "string",
                description: "Location description",
              },
              dimensions: {
                type: "object",
                description: "Room dimensions (optional)",
                properties: {
                  length: { type: "number" },
                  width: { type: "number" },
                  height: { type: "number" },
                },
              },
              use_case: {
                type: "string",
                description: "What the zone will be used for (e.g., 'Home cinema', 'Background music', 'Video conferencing')",
              },
              ceiling_type: {
                type: "string",
                description: "Ceiling type if relevant (e.g., 'drywall', 'concrete', 'suspended')",
              },
              budget_allocation: {
                type: "number",
                description: "Budget allocated to this zone (optional)",
              },
              notes: {
                type: "string",
                description: "Any additional notes for this zone",
              },
            },
            required: ["name", "location", "use_case"],
          },
        },
        requirements_summary: {
          type: "string",
          description: "Summary of customer requirements and project goals (min 10 characters)",
        },
        technical_notes: {
          type: "string",
          description: "Technical considerations, constraints, or special requirements (optional)",
        },
        existing_equipment: {
          type: "string",
          description: "Existing equipment to integrate or replace (optional)",
        },
        complexity_score: {
          type: "number",
          description: "AI-calculated complexity score 0-100 that triggered escalation (optional)",
        },
        priority: {
          type: "string",
          enum: ["low", "normal", "high", "urgent"],
          description: "Request priority (default: normal)",
        },
      },
      required: ["customer_email", "project_type", "budget_total", "zones", "requirements_summary"],
    },
  },
  {
    name: "provide_final_recommendation",
    description: `🚨 CRITICAL: This is how you SHOW PRODUCTS to the customer! 🚨

You MUST use this tool EVERY TIME you want to display products in the UI.

WHEN TO USE (use this tool OFTEN):
- Showing AVR options → Use this tool with 3-4 AVR products
- Showing speaker options → Use this tool with 3-4 speaker products
- Showing subwoofer options → Use this tool with 2-3 subwoofer products
- Showing any product results → Use this tool to display them

HOW IT WORKS:
- You provide product SKUs + explanation
- Customer sees beautiful product cards with images, prices, stock
- Customer can click to add to quote
- WITHOUT this tool, customer sees NOTHING (just text)

PROVIDE:
- Array of product SKUs (3-5 products recommended)
- Brief explanation of these options
- Total price (sum of recommended products)
- Optional note about alternatives

IMPORTANT: This is NOT just for "final" recommendations - use it for EVERY product display!`,
    input_schema: {
      type: "object" as const,
      properties: {
        quote_id: {
          type: "string",
          description: "Quote ID this recommendation is for",
        },
        products: {
          type: "array",
          description: "Recommended products with explanations",
          items: {
            type: "object",
            properties: {
              sku: {
                type: "string",
                description: "Product SKU",
              },
              quantity: {
                type: "number",
                description: "Quantity needed",
              },
              reason: {
                type: "string",
                description: "Why this specific product (1-2 sentences)",
              },
            },
            required: ["sku", "reason"],
          },
        },
        explanation: {
          type: "string",
          description: "Overall explanation of the complete solution - why these products solve the customer's problem",
        },
        total_price: {
          type: "number",
          description: "Total price of the solution",
        },
        alternative_note: {
          type: "string",
          description: "Optional note about alternatives, upgrades, or considerations",
        },
      },
      required: ["products", "explanation", "total_price"],
    },
  },
];

/**
 * Tool execution context - passed to tool handlers
 */
export interface ToolContext {
  sessionId: string;
  currentQuoteId?: string;
  conversationHistory?: any[];
}

/**
 * Tool execution result
 */
export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  message?: string;
}
