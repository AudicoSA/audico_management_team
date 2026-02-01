/**
 * Tender Document Extraction API
 * 
 * Accepts image uploads and uses OpenAI Vision to extract product requirements.
 * Returns structured JSON of products for matching against the database.
 */

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

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

        console.log(`[TenderExtract] Processing image for session: ${sessionId}`);

        // Determine if image is base64 or URL
        let imageContent: OpenAI.Chat.Completions.ChatCompletionContentPartImage;

        if (image.startsWith("data:")) {
            // Base64 image
            imageContent = {
                type: "image_url",
                image_url: {
                    url: image,
                    detail: "high", // High detail for document reading
                },
            };
        } else {
            // URL
            imageContent = {
                type: "image_url",
                image_url: {
                    url: image,
                    detail: "high",
                },
            };
        }

        // Call OpenAI Vision
        const response = await openai.chat.completions.create({
            model: "gpt-4o", // GPT-4o has excellent vision capabilities
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

        const content = response.choices[0]?.message?.content;

        if (!content) {
            console.error("[TenderExtract] No content in OpenAI response");
            return NextResponse.json(
                { error: "Failed to extract content from image" },
                { status: 500 }
            );
        }

        console.log("[TenderExtract] Raw response:", content.substring(0, 500));

        // Parse JSON from response (handle markdown code blocks)
        let extractedData;
        try {
            // Remove markdown code blocks if present
            let jsonStr = content;
            if (content.includes("```json")) {
                jsonStr = content.replace(/```json\n?/g, "").replace(/```\n?/g, "");
            } else if (content.includes("```")) {
                jsonStr = content.replace(/```\n?/g, "");
            }

            extractedData = JSON.parse(jsonStr.trim());
        } catch (parseError) {
            console.error("[TenderExtract] Failed to parse JSON:", parseError);
            console.error("[TenderExtract] Content was:", content);
            return NextResponse.json(
                { error: "Failed to parse extracted data", raw: content },
                { status: 500 }
            );
        }

        console.log(`[TenderExtract] Extracted ${extractedData.items?.length || 0} items`);

        return NextResponse.json({
            success: true,
            items: extractedData.items || [],
            notes: extractedData.notes || null,
            sessionId,
        });

    } catch (error: any) {
        console.error("[TenderExtract] Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to process image" },
            { status: 500 }
        );
    }
}

// Health check
export async function GET() {
    return NextResponse.json({
        status: "healthy",
        service: "tender-extract",
        hasOpenAIKey: !!process.env.OPENAI_API_KEY,
    });
}
