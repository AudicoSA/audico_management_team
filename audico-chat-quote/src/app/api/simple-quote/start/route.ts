import { NextRequest, NextResponse } from "next/server";
import { SimpleQuoteEngine } from "@/lib/flows/simple-quote/engine";
import { v4 as uuidv4 } from "uuid";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId = uuidv4() } = body;

    // Create Simple Quote
    const engine = await SimpleQuoteEngine.create(sessionId);
    const summary = engine.getSummary();

    return NextResponse.json({
      success: true,
      quoteId: engine.getQuoteId(),
      items: summary.items,
      itemCount: summary.itemCount,
      total: summary.total,
    });
  } catch (error: any) {
    console.error("Simple Quote Start API error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to start quote" },
      { status: 500 }
    );
  }
}
