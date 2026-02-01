/**
 * Tender Document Process API
 * 
 * Complete pipeline: Vision extraction → Product matching → Results
 * Single endpoint for the full tender processing workflow.
 */

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { matchTenderItems, type ExtractedItem } from "@/lib/ai/tender-matcher";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// System prompt for product extraction
const EXTRACTION_PROMPT = `You are an expert at reading tender documents, BOMs (Bill of Materials), and product specifications for audio/video equipment.

Analyze the uploaded image and extract ALL products, equipment, or items mentioned.

For each item, extract:
- quantity (number, default to 1 if unclear)
- description (what the product is)
- brand (if mentioned, otherwise null)
- model (if mentioned, otherwise null)  
- specifications (any specs like watts, ohms, size, channels, etc.)
- category (one of: speaker, amplifier, receiver, subwoofer, microphone, cable, mounting, video, conferencing, other)

Return ONLY valid JSON in this exact format:
{
  "items": [
    {
      "quantity": 2,
      "description": "Ceiling speaker 6.5 inch",
      "brand": "JBL",
      "model": "Control 26CT",
      "specifications": {"size": "6.5 inch", "power": "150W", "impedance": "8 ohm"},
      "category": "speaker"
    }
  ],
  "notes": "Any additional context or uncertainty about the extraction"
}

Be thorough - extract every single product mentioned, even partial items.
If text is unclear or handwritten, make your best interpretation.`;

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { image, sessionId } = body;

        if (!image) {
            return NextResponse.json(
                { error: "No image provided" },
                { status: 400 }
            );
        }

        if (!process.env.OPENAI_API_KEY) {
            return NextResponse.json(
                { error: "OpenAI API key not configured" },
                { status: 500 }
            );
        }

        console.log(`[TenderProcess] Starting pipeline for session: ${sessionId}`);

        // Step 1: Extract products from image using Vision AI
        console.log(`[TenderProcess] Step 1: Vision extraction...`);

        const imageContent: OpenAI.Chat.Completions.ChatCompletionContentPartImage = {
            type: "image_url",
            image_url: {
                url: image,
                detail: "high",
            },
        };

        const visionResponse = await openai.chat.completions.create({
            model: "gpt-4o",
            max_tokens: 4000,
            messages: [
                {
                    role: "user",
                    content: [
                        { type: "text", text: EXTRACTION_PROMPT },
                        imageContent,
                    ],
                },
            ],
        });

        const content = visionResponse.choices[0]?.message?.content;

        if (!content) {
            return NextResponse.json(
                { error: "Failed to extract content from image" },
                { status: 500 }
            );
        }

        // Parse JSON from response
        let extractedData: { items: ExtractedItem[]; notes?: string };
        try {
            let jsonStr = content;
            if (content.includes("```json")) {
                jsonStr = content.replace(/```json\n?/g, "").replace(/```\n?/g, "");
            } else if (content.includes("```")) {
                jsonStr = content.replace(/```\n?/g, "");
            }

            extractedData = JSON.parse(jsonStr.trim());
        } catch (parseError) {
            console.error("[TenderProcess] Failed to parse JSON:", content);
            return NextResponse.json(
                { error: "Failed to parse extracted data", raw: content },
                { status: 500 }
            );
        }

        const items = extractedData.items || [];
        console.log(`[TenderProcess] Extracted ${items.length} items`);

        if (items.length === 0) {
            return NextResponse.json({
                success: true,
                message: "No products found in the document",
                extracted: [],
                matches: { results: [], summary: { total: 0, matched: 0, partial: 0, unmatched: 0 } },
                notes: extractedData.notes,
            });
        }

        // Step 2: Match products to database
        console.log(`[TenderProcess] Step 2: Matching products...`);

        const matchResults = await matchTenderItems(items, sessionId || "anonymous");

        console.log(`[TenderProcess] Complete: ${matchResults.summary.matched} matched, ${matchResults.summary.partial} partial, ${matchResults.summary.unmatched} unmatched`);

        return NextResponse.json({
            success: true,
            extracted: items,
            matches: matchResults,
            notes: extractedData.notes,
            sessionId,
        });

    } catch (error: any) {
        console.error("[TenderProcess] Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to process tender document" },
            { status: 500 }
        );
    }
}

// Health check
export async function GET() {
    return NextResponse.json({
        status: "healthy",
        service: "tender-process",
        hasOpenAIKey: !!process.env.OPENAI_API_KEY,
    });
}
