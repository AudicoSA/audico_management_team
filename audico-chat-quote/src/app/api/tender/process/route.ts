/**
 * Tender Document Process API
 * 
 * Complete pipeline: Vision extraction → Product matching → Results
 * Single endpoint for the full tender processing workflow.
 */

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { matchTenderItems, type ExtractedItem } from "@/lib/ai/tender-matcher";

// Lazy initialization to avoid build-time errors
let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
    if (!openaiClient) {
        openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" });
    }
    return openaiClient;
}

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

import PDFParser from "pdf2json";

// ... existing code ...

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get("file") as File | null;
        const sessionId = formData.get("sessionId") as string | null;

        if (!file) {
            return NextResponse.json(
                { error: "No file provided" },
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
        console.log(`[TenderProcess] Received file: ${file.name} (${file.type})`);

        let content = "";

        // Handle PDF files
        if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
            console.log(`[TenderProcess] Step 1: PDF text extraction...`);

            try {
                // Parse PDF text using pdf2json to avoid DOMMatrix/pdf.js environment errors in Next.js
                const pdfParser = new PDFParser(null, true); // true = text mode

                const pdfText = await new Promise<string>((resolve, reject) => {
                    pdfParser.on("pdfParser_dataError", (errData: any) => reject(new Error(errData.parserError)));
                    pdfParser.on("pdfParser_dataReady", (pdfData: any) => {
                        // pdf2json returns raw text in text mode
                        resolve(pdfParser.getRawTextContent());
                    });

                    // Convert File to Buffer
                    file.arrayBuffer().then(buffer => {
                        pdfParser.parseBuffer(Buffer.from(buffer));
                    }).catch(reject);
                });

                console.log(`[TenderProcess] Extracted ${pdfText.length} characters from PDF.`);

                // pdf2json adds page breaks like "----------------Page (0) Break----------------"
                // We need to clean these out to check if there is any ACTUAL text.
                const cleanText = pdfText.replace(/----------------Page \(\d+\) Break----------------/g, "").replace(/\r\n/g, "").trim();

                if (cleanText.length < 5) {
                    return NextResponse.json(
                        { error: "No readable text found in this PDF. It appears to be a scanned document or image-only PDF. Please convert it to an image (PNG/JPG) and upload it so our Vision AI can process it." },
                        { status: 400 }
                    );
                }

                // Send text to standard GPT-4o for extraction
                const textResponse = await getOpenAI().chat.completions.create({
                    model: "gpt-4o",
                    max_tokens: 4000,
                    messages: [
                        {
                            role: "user",
                            content: `${EXTRACTION_PROMPT}\n\nHere is the text extracted from the document:\n\n${pdfText}`,
                        },
                    ],
                    response_format: { type: "json_object" },
                });

                content = textResponse.choices[0]?.message?.content || "";

            } catch (pdfError: any) {
                console.error("[TenderProcess] PDF Parsing error:", pdfError);
                return NextResponse.json(
                    { error: `Failed to parse PDF document: ${pdfError.message}` },
                    { status: 500 }
                );
            }
        }
        // Handle Image files
        else if (file.type.startsWith("image/")) {
            console.log(`[TenderProcess] Step 1: Vision extraction...`);

            // Convert file to base64 Data URL
            const arrayBuffer = await file.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const base64Data = buffer.toString('base64');
            const dataUrl = `data:${file.type};base64,${base64Data}`;

            const imageContent: OpenAI.Chat.Completions.ChatCompletionContentPartImage = {
                type: "image_url",
                image_url: {
                    url: dataUrl,
                    detail: "high",
                },
            };

            const visionResponse = await getOpenAI().chat.completions.create({
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
                response_format: { type: "json_object" },
            });

            content = visionResponse.choices[0]?.message?.content || "";
        }
        else {
            return NextResponse.json(
                { error: `Unsupported file type: ${file.type}. Please upload a PDF or an image.` },
                { status: 400 }
            );
        }

        if (!content) {
            return NextResponse.json(
                { error: "Failed to extract content from document" },
                { status: 500 }
            );
        }

        // Parse JSON from response
        let extractedData: { items: ExtractedItem[]; notes?: string };
        try {
            let jsonStr = content.trim();
            // Try to extract from markdown code block if present
            const match = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
            if (match) {
                jsonStr = match[1].trim();
            } else {
                // Fallback: extract substring between first { and last }
                const firstBrace = jsonStr.indexOf('{');
                const lastBrace = jsonStr.lastIndexOf('}');
                if (firstBrace !== -1 && lastBrace !== -1) {
                    jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
                }
            }

            extractedData = JSON.parse(jsonStr);
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
